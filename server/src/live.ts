// 진행 중 스테이지 세션의 서버측 권위 상태 + 판정 엔진 (PRD §7.2~7.3, FR-5)
import fs from 'node:fs';
import path from 'node:path';
import {
  BALANCE, judge,
  type BarsFile, type Direction, type StageParams, type WsServerMsg,
} from '@tf/shared';
import type { WebSocket } from 'ws';
import { db, SERVER_ROOT, type ChartSetRow, type SessionRow } from './db.js';

export class LiveSession {
  readonly id: string;
  readonly accountId: string;
  readonly chartSet: ChartSetRow;
  readonly params: StageParams;
  readonly speed: number;
  readonly bars: BarsFile;
  t0: number | null = null;
  aum: number;
  payoutSum = 0;
  wins = 0; loses = 0; draws = 0;
  open: { seq: number; direction: Direction; stake: number; openBarIdx: number; basePrice: number } | null = null;
  closing = false;
  positionCount = 0;
  combatCredited = 0; // 전투 처치로 크레딧된 AUM 누적 (상한 clamp)
  lastOpenAt = 0;
  ws: WebSocket | null = null;
  private timers: NodeJS.Timeout[] = [];
  private endTimerSet = false;

  constructor(row: SessionRow, chartSet: ChartSetRow) {
    this.id = row.id;
    this.accountId = row.account_id;
    this.chartSet = chartSet;
    this.params = JSON.parse(row.params) as StageParams;
    this.speed = row.speed;
    this.aum = this.params.aum;
    const barsPath = path.join(SERVER_ROOT, chartSet.bars_url.replace('/static/', 'static/'));
    this.bars = JSON.parse(fs.readFileSync(barsPath, 'utf-8')) as BarsFile;
  }

  get barMs(): number {
    return 1000 / this.speed;
  }

  send(msg: WsServerMsg) {
    if (this.ws && this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  start() {
    if (this.t0 == null) {
      this.t0 = Date.now();
      db.prepare('UPDATE stage_sessions SET t0_ms = ? WHERE id = ?').run(this.t0, this.id);
    }
    // FR-5.11: 스테이지 종료(마지막 봉 마감) 시 미청산 포지션은 마지막 봉 종가로 강제 청산
    if (!this.endTimerSet) {
      this.endTimerSet = true;
      const endAt = this.t0 + this.bars.barCount * this.barMs + 50;
      this.timers.push(setTimeout(() => {
        if (this.open && !this.closing) this.settleClose(this.bars.barCount - 1, true);
      }, Math.max(0, endAt - Date.now())));
    }
    this.send({ op: 'started', serverT0: this.t0 });
  }

  serverBarIdx(now = Date.now()): number {
    if (this.t0 == null) return -1;
    return Math.floor((now - this.t0) / this.barMs);
  }

  /** 웨이브 시계 기준 현재까지 지급된 기본 수입 (FR-6.8) */
  incomeSoFar(barIdx: number): number {
    const started = Math.min(this.params.waveCount, Math.floor(Math.max(barIdx, 0) / BALANCE.CYCLE_SECONDS) + 1);
    if (started <= 0) return 0;
    if (started >= this.params.waveCount) return this.params.totalBaseIncome;
    return this.params.incomePerWave * started;
  }

  openPosition(seq: number, direction: Direction, stake: number) {
    const now = Date.now();
    const err = (code: Parameters<typeof this.errMsg>[0]) => this.send(this.errMsg(code, seq));
    if (this.t0 == null) return err('SESSION_ENDED');
    // FR-5.10: 오픈 "요청" 기준 초당 1건 — 시도 자체에 타임스탬프를 찍는다
    if (now - this.lastOpenAt < BALANCE.OPEN_RATE_LIMIT_MS) return err('RATE_LIMITED');
    this.lastOpenAt = now;
    if (this.open != null) return err('POSITION_ALREADY_OPEN');
    if (this.positionCount >= this.params.maxPositions) return err('MAX_POSITIONS');
    if (!Number.isInteger(stake) || stake <= 0 || stake > this.aum) return err('INSUFFICIENT_AUM');
    if (direction !== 'long' && direction !== 'short') return err('INVALID_SEQ');
    if (!Number.isInteger(seq) || seq !== this.positionCount + 1) return err('INVALID_SEQ');

    const i = this.serverBarIdx(now);
    const openBarIdx = i + 1; // FR-5.4: 다음 1분봉의 종가로 체결 (시장가 주문 지연)
    if (i < 0 || openBarIdx >= this.bars.barCount - 1) return err('SESSION_ENDED');

    const basePrice = this.bars.bars[openBarIdx].c;
    this.open = { seq, direction, stake, openBarIdx, basePrice };
    this.positionCount += 1;
    this.aum -= stake;

    db.prepare(
      `INSERT INTO positions (session_id, seq, direction, stake, open_bar_idx, base_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(this.id, seq, direction, stake, openBarIdx, basePrice);

    this.send({ op: 'position.opened', seq, openBarIdx, basePrice, aumLeft: this.aum });
  }

  // FR-5.5: 청산 요청 → 다음 1분봉 종가로 체결 (진입 봉보다 이르게는 불가)
  closePosition(seq: number) {
    const err = (code: Parameters<typeof this.errMsg>[0]) => this.send(this.errMsg(code, seq));
    if (this.t0 == null) return err('SESSION_ENDED');
    if (!this.open || this.open.seq !== seq || this.closing) return err('NO_OPEN_POSITION');

    const i = this.serverBarIdx();
    const exitBarIdx = Math.min(Math.max(i + 1, this.open.openBarIdx), this.bars.barCount - 1);
    this.closing = true;
    this.send({ op: 'position.closing', seq, exitBarIdx });

    // exitBarIdx 봉이 "닫히는" 실제 시각에 판정
    const settleAt = this.t0 + (exitBarIdx + 1) * this.barMs + 30;
    this.timers.push(setTimeout(() => this.settleClose(exitBarIdx, false), Math.max(0, settleAt - Date.now())));
  }

  private settleClose(exitBarIdx: number, forced: boolean) {
    if (!this.open) return;
    const { seq, direction, stake, basePrice } = this.open;
    const closePrice = this.bars.bars[exitBarIdx].c;
    const r = judge(basePrice, closePrice, this.bars.sigma['30'], direction, stake, this.params.lossRate);

    if (r.outcome === 'win') this.wins += 1;
    else if (r.outcome === 'lose') this.loses += 1;
    else this.draws += 1;
    this.payoutSum += r.payout;
    this.open = null;
    this.closing = false;

    db.prepare(
      `UPDATE positions SET close_bar_idx = ?, close_price = ?, delta_pct = ?, z_norm = ?, outcome = ?, payout = ?, forced = ?, resolved_at = datetime('now')
       WHERE session_id = ? AND seq = ?`,
    ).run(exitBarIdx, closePrice, r.deltaPct, r.g, r.outcome, r.payout, forced ? 1 : 0, this.id, seq);

    const earnedTotal = this.incomeSoFar(this.serverBarIdx()) + this.payoutSum;
    this.send({
      op: 'position.closed', seq, outcome: r.outcome,
      deltaPct: Math.round(r.deltaPct * 100) / 100, g: Math.round(r.g * 1000) / 1000,
      payout: r.payout, pnl: r.pnl, exitBarIdx, forced, earnedTotal, aumLeft: this.aum,
    });
  }

  /** 적 처치 AUM 보고 — 클라 전투는 비권위이므로 aum × CAP_RATE 상한으로만 신뢰 (누적 단조 증가) */
  reportCombatAum(earned: number) {
    if (this.t0 == null) return;
    if (!Number.isFinite(earned)) return;
    const cap = Math.floor(this.params.aum * BALANCE.AUM_COMBAT_CAP_RATE);
    const target = Math.min(Math.max(0, Math.floor(earned)), cap);
    if (target > this.combatCredited) {
      this.aum += target - this.combatCredited;
      this.combatCredited = target;
    }
    this.send({ op: 'aum.update', aumLeft: this.aum, combatCredited: this.combatCredited });
  }

  clockSync(clientBarIdx: number) {
    const s = this.serverBarIdx();
    if (s >= 0 && Math.abs(clientBarIdx - s) > 3) {
      this.send({ op: 'clock.resync', serverBarIdx: s });
    }
  }

  /** 정산 직전: 미청산 포지션 취소·환불, 타이머 해제 (정상 종료 시엔 강제 청산이 이미 처리) */
  teardown() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.open != null) {
      const { seq, stake } = this.open;
      const row = db.prepare('SELECT stake FROM positions WHERE session_id = ? AND seq = ? AND outcome IS NULL').get(this.id, seq) as { stake: number } | undefined;
      if (row) {
        this.aum += stake;
        db.prepare('DELETE FROM positions WHERE session_id = ? AND seq = ? AND outcome IS NULL').run(this.id, seq);
        this.positionCount -= 1;
      }
      this.open = null;
      this.closing = false;
    }
  }

  private errMsg(code: 'POSITION_ALREADY_OPEN' | 'NO_OPEN_POSITION' | 'RATE_LIMITED' | 'MAX_POSITIONS' | 'INSUFFICIENT_AUM' | 'SESSION_ENDED' | 'INVALID_SEQ', seq?: number): WsServerMsg {
    return { op: 'error', code, seq };
  }
}

export const liveSessions = new Map<string, LiveSession>();

export function getLive(sessionId: string): LiveSession | undefined {
  return liveSessions.get(sessionId);
}

export function loadLive(sessionId: string): LiveSession | null {
  const existing = liveSessions.get(sessionId);
  if (existing) return existing;
  const row = db.prepare("SELECT * FROM stage_sessions WHERE id = ? AND status = 'active'").get(sessionId) as SessionRow | undefined;
  if (!row) return null;
  const cs = db.prepare('SELECT * FROM chart_sets WHERE id = ?').get(row.chart_set_id) as ChartSetRow;
  const live = new LiveSession(row, cs);
  if (row.t0_ms) live.t0 = row.t0_ms;
  liveSessions.set(sessionId, live);
  return live;
}

export function dropLive(sessionId: string) {
  liveSessions.get(sessionId)?.teardown();
  liveSessions.delete(sessionId);
}
