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
  openSeq: number | null = null;
  positionCount = 0;
  lastOpenAt = 0;
  ws: WebSocket | null = null;
  private timers: NodeJS.Timeout[] = [];

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

  openPosition(seq: number, direction: Direction, stake: number, expiryBars: number) {
    const now = Date.now();
    const err = (code: Parameters<typeof this.errMsg>[0]) => this.send(this.errMsg(code, seq));
    if (this.t0 == null) return err('SESSION_ENDED');
    // FR-5.10: 오픈 "요청" 기준 초당 1건 — 시도 자체에 타임스탬프를 찍는다
    if (now - this.lastOpenAt < BALANCE.OPEN_RATE_LIMIT_MS) return err('RATE_LIMITED');
    this.lastOpenAt = now;
    if (this.openSeq != null) return err('POSITION_ALREADY_OPEN');
    if (this.positionCount >= this.params.maxPositions) return err('MAX_POSITIONS');
    if (!Number.isInteger(stake) || stake <= 0 || stake > this.aum) return err('INSUFFICIENT_AUM');
    if (!BALANCE.EXPIRY_BARS.includes(expiryBars as 15 | 30)) return err('INVALID_SEQ');
    if (direction !== 'long' && direction !== 'short') return err('INVALID_SEQ');
    if (!Number.isInteger(seq) || seq !== this.positionCount + 1) return err('INVALID_SEQ');

    const i = this.serverBarIdx(now);
    const openBarIdx = i + 1; // FR-5.4: 다음 1분봉의 종가가 기준가
    const closeBarIdx = openBarIdx + expiryBars;
    if (i < 0 || closeBarIdx >= this.bars.barCount) return err('SESSION_ENDED');

    this.openSeq = seq;
    this.positionCount += 1;
    this.aum -= stake;
    const basePrice = this.bars.bars[openBarIdx].c;

    db.prepare(
      `INSERT INTO positions (session_id, seq, direction, stake, expiry_bars, open_bar_idx, close_bar_idx, base_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(this.id, seq, direction, stake, expiryBars, openBarIdx, closeBarIdx, basePrice);

    this.send({ op: 'position.opened', seq, openBarIdx, closeBarIdx, basePrice, aumLeft: this.aum });

    // closeBarIdx 봉이 "닫히는" 실제 시각에 판정
    const resolveAt = this.t0! + (closeBarIdx + 1) * this.barMs + 30;
    const timer = setTimeout(() => this.resolve(seq, direction, stake, expiryBars, basePrice, closeBarIdx), Math.max(0, resolveAt - now));
    this.timers.push(timer);
  }

  private resolve(seq: number, direction: Direction, stake: number, expiryBars: number, basePrice: number, closeBarIdx: number) {
    const closePrice = this.bars.bars[closeBarIdx].c;
    const sigma = expiryBars === 15 ? this.bars.sigma['15'] : this.bars.sigma['30'];
    const r = judge(basePrice, closePrice, sigma, direction, stake, this.params.lossRate);

    if (r.outcome === 'win') this.wins += 1;
    else if (r.outcome === 'lose') this.loses += 1;
    else this.draws += 1;
    this.payoutSum += r.payout;
    this.openSeq = null;

    db.prepare(
      `UPDATE positions SET close_price = ?, delta_pct = ?, m_multiplier = ?, outcome = ?, payout = ?, resolved_at = datetime('now')
       WHERE session_id = ? AND seq = ?`,
    ).run(closePrice, r.deltaPct, r.m, r.outcome, r.payout, this.id, seq);

    const earnedTotal = this.incomeSoFar(this.serverBarIdx()) + this.payoutSum;
    this.send({
      op: 'position.resolved', seq, outcome: r.outcome,
      deltaPct: Math.round(r.deltaPct * 100) / 100, m: Math.round(r.m * 1000) / 1000,
      payout: r.payout, earnedTotal, aumLeft: this.aum,
    });
  }

  clockSync(clientBarIdx: number) {
    const s = this.serverBarIdx();
    if (s >= 0 && Math.abs(clientBarIdx - s) > 3) {
      this.send({ op: 'clock.resync', serverBarIdx: s });
    }
  }

  /** 정산 직전: 미해결 포지션 취소·환불, 타이머 해제 */
  teardown() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.openSeq != null) {
      const row = db.prepare('SELECT stake FROM positions WHERE session_id = ? AND seq = ? AND outcome IS NULL').get(this.id, this.openSeq) as { stake: number } | undefined;
      if (row) {
        this.aum += row.stake;
        db.prepare('DELETE FROM positions WHERE session_id = ? AND seq = ? AND outcome IS NULL').run(this.id, this.openSeq);
        this.positionCount -= 1;
      }
      this.openSeq = null;
    }
  }

  private errMsg(code: 'POSITION_ALREADY_OPEN' | 'RATE_LIMITED' | 'MAX_POSITIONS' | 'INSUFFICIENT_AUM' | 'SESSION_ENDED' | 'INVALID_SEQ', seq?: number): WsServerMsg {
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
