// 진행 중 스테이지 세션의 서버측 권위 상태 + 판정 엔진 (PRD §7.2~7.3, FR-5)
import fs from 'node:fs';
import path from 'node:path';
import {
  BALANCE, judge, splitPayout, sltpHit, sltpValid, sltpWickHit, tradeFee,
  type BarsFile, type Direction, type StageParams, type WsErrorCode, type WsServerMsg,
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
  stakeSum = 0; // 정산된 포지션의 총 투입 (수익률 = (payoutSum − stakeSum) / stakeSum)
  goldSum = 0; // 골드로 환전된 순수익 누적 (payout − 반환 스테이크)
  feeSum = 0; // FR-5.14 거래 수수료 누적 (AUM에서 빠져나간 총액)
  wins = 0; loses = 0; draws = 0;
  open: { seq: number; direction: Direction; stake: number; openBarIdx: number; basePrice: number; leverage: number; sl: number | null; tp: number | null } | null = null;
  positionCount = 0;
  combatCredited = 0; // 전투 처치로 크레딧된 AUM 누적 (상한 clamp)
  lastOpenAt = 0;
  ws: WebSocket | null = null;
  private timers: NodeJS.Timeout[] = [];
  private endTimerSet = false;
  private wickCheckedBar = -1; // 꼬리 판정을 끝낸 마지막 봉

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
        if (this.open) this.settleClose(this.bars.barCount - 1, this.bars.bars[this.bars.barCount - 1].c, true);
      }, Math.max(0, endAt - Date.now())));
      // FR-5.12 마진콜: 미실현 손실이 MAX_LOSS_RATE에 닿으면 즉시 전액 청산 (서버 권위, 보간가 기준)
      this.timers.push(setInterval(() => this.checkLiquidation(), 250));
    }
    this.send({ op: 'started', serverT0: this.t0 });
  }

  serverBarIdx(now = Date.now()): number {
    if (this.t0 == null) return -1;
    return Math.floor((now - this.t0) / this.barMs);
  }

  /** FR-5.4 즉시 체결가 — 차트 렌더와 동일한 선형 보간(직전 봉 종가 → 현재 봉 종가)을 서버 시계로 재현 */
  interpPrice(now = Date.now()): { price: number; barIdx: number } {
    const n = this.bars.barCount;
    const barF = Math.max((now - this.t0!) / this.barMs, 0);
    const i = Math.min(Math.floor(barF), n - 1);
    const frac = Math.min(barF - i, 1);
    const prev = i <= 0 ? this.bars.bars[0].o : this.bars.bars[i - 1].c;
    const cur = this.bars.bars[i].c;
    return { price: prev + (cur - prev) * frac, barIdx: i };
  }

  /** 웨이브 시계 기준 현재까지 지급된 기본 수입 (FR-6.8) */
  incomeSoFar(barIdx: number): number {
    const started = Math.min(this.params.waveCount, Math.floor(Math.max(barIdx, 0) / BALANCE.CYCLE_SECONDS) + 1);
    if (started <= 0) return 0;
    if (started >= this.params.waveCount) return this.params.totalBaseIncome;
    return this.params.incomePerWave * started;
  }

  openPosition(seq: number, direction: Direction, stake: number, leverage = 1) {
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
    if (!BALANCE.LEVERAGES.includes(leverage) || leverage > this.params.maxLeverage) return err('INVALID_SEQ'); // FR-5.6b 해금된 배율만

    // FR-5.4: 요청 순간 화면에 보이는 보간 가격으로 즉시 체결 (서버가 동일 보간식으로 재현 — 권위 유지)
    const i = this.serverBarIdx(now);
    if (i < 0 || i >= this.bars.barCount - 2) return err('SESSION_ENDED'); // 종료 직전 진입 불가
    const { price: basePrice, barIdx: openBarIdx } = this.interpPrice(now);
    const fee = tradeFee(stake, leverage); // FR-5.14 진입 수수료
    this.wickCheckedBar = openBarIdx; // 진입한 봉의 꼬리는 이미 지나갔을 수 있어 다음 봉부터 본다
    this.open = { seq, direction, stake, openBarIdx, basePrice, leverage, sl: null, tp: null };
    this.positionCount += 1;
    this.aum -= stake + fee;
    this.feeSum += fee;

    db.prepare(
      `INSERT INTO positions (session_id, seq, direction, stake, open_bar_idx, base_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(this.id, seq, direction, stake, openBarIdx, basePrice);

    this.send({ op: 'position.opened', seq, openBarIdx, basePrice, aumLeft: this.aum, fee });
  }

  // FR-5.4: 청산도 요청 순간 보간 가격으로 즉시 체결·정산
  closePosition(seq: number) {
    const err = (code: Parameters<typeof this.errMsg>[0]) => this.send(this.errMsg(code, seq));
    if (this.t0 == null) return err('SESSION_ENDED');
    if (!this.open || this.open.seq !== seq) return err('NO_OPEN_POSITION');

    const { price, barIdx } = this.interpPrice();
    this.settleClose(Math.max(barIdx, this.open.openBarIdx), price, false);
  }

  /** FR-5.15 손절·익절 지정 — 방향과 맞는 쪽인지 서버가 검증하고 확정값을 에코한다 */
  setSltp(seq: number, sl: number | null, tp: number | null) {
    const err = (code: Parameters<typeof this.errMsg>[0]) => this.send(this.errMsg(code, seq));
    if (this.t0 == null) return err('SESSION_ENDED');
    if (!this.open || this.open.seq !== seq) return err('NO_OPEN_POSITION');
    const s = sl == null || !Number.isFinite(sl) ? null : sl;
    const t = tp == null || !Number.isFinite(tp) ? null : tp;
    if (!sltpValid(this.open.direction, this.open.basePrice, s, t)) return err('INVALID_SLTP');
    this.open.sl = s;
    this.open.tp = t;
    this.send({ op: 'position.sltp', seq, sl: s, tp: t });
  }

  /** FR-5.12: 손실률이 MAX_LOSS_RATE 도달 → 마진콜 (스테이크 전액 소멸 — 올인이면 파산 패배로 이어진다) */
  private checkLiquidation() {
    if (!this.open || this.t0 == null) return;
    const { price, barIdx } = this.interpPrice();
    // FR-5.15: 지정 레벨 도달은 마진콜보다 먼저 본다 (손절이 마진콜 앞에서 손실을 끊는 게 지정 목적)
    // FR-5.15b: 완성된 봉의 꼬리(고가·저가)가 레벨을 스쳐도 체결이다 — 보간 종가만 보면
    // 화면의 심지가 선을 뚫고 지나가는데도 체결이 안 되는 일이 생긴다.
    if (this.open.sl != null || this.open.tp != null) {
      for (let i = Math.max(this.wickCheckedBar + 1, this.open.openBarIdx + 1); i < barIdx; i++) {
        const bar = this.bars.bars[i];
        if (!bar) continue;
        const wick = sltpWickHit(this.open.direction, bar.l, bar.h, this.open.sl, this.open.tp);
        if (wick) {
          this.wickCheckedBar = i;
          this.settleClose(Math.max(i, this.open.openBarIdx), wick.price, true, false, wick.kind);
          return;
        }
      }
    }
    this.wickCheckedBar = Math.max(this.wickCheckedBar, barIdx - 1);

    const hit = sltpHit(this.open.direction, price, this.open.sl, this.open.tp);
    if (hit) {
      this.settleClose(Math.max(barIdx, this.open.openBarIdx), hit.price, true, false, hit.kind);
      return;
    }
    const { direction, basePrice, leverage, openBarIdx } = this.open;
    const deltaPct = ((price - basePrice) / basePrice) * 100;
    const g = (direction === 'long' ? 1 : -1) * (deltaPct / Math.max(this.bars.sigma['30'], 1e-6)) * leverage;
    if (g < 0 && this.params.lossRate * g <= -BALANCE.MAX_LOSS_RATE) {
      this.settleClose(Math.max(barIdx, openBarIdx), price, true, true);
    }
  }

  private settleClose(exitBarIdx: number, closePrice: number, forced: boolean, liquidated = false, trigger?: 'sl' | 'tp') {
    if (!this.open) return;
    const { seq, direction, stake, basePrice, leverage } = this.open;
    const rj = judge(basePrice, closePrice, this.bars.sigma['30'], direction, stake, this.params.lossRate, leverage);
    const r = liquidated ? { ...rj, outcome: 'lose' as const, payout: 0, pnl: -stake } : rj; // 마진콜 = 전액 소멸

    if (r.outcome === 'win') this.wins += 1;
    else if (r.outcome === 'lose') this.loses += 1;
    else this.draws += 1;
    this.payoutSum += r.payout;
    this.stakeSum += stake;
    // FR-5.5b/5.5c 정산 분해: 스테이크는 AUM 반환, 순수익은 상한(500G)까지 골드·초과분은 AUM
    const { returnToAum, goldGain } = splitPayout(r.payout, stake);
    const fee = tradeFee(stake, leverage); // FR-5.14 청산 수수료 (진입 명목가 기준 — 왕복 비용을 미리 확정)
    this.aum += returnToAum - fee;
    if (this.aum < 0) this.aum = 0;
    this.feeSum += fee;
    this.goldSum += goldGain;
    this.open = null;

    db.prepare(
      `UPDATE positions SET close_bar_idx = ?, close_price = ?, delta_pct = ?, z_norm = ?, outcome = ?, payout = ?, forced = ?, resolved_at = datetime('now')
       WHERE session_id = ? AND seq = ?`,
    ).run(exitBarIdx, closePrice, r.deltaPct, r.g, r.outcome, r.payout, forced ? 1 : 0, this.id, seq);

    const earnedTotal = this.incomeSoFar(this.serverBarIdx()) + this.goldSum;
    this.send({
      op: 'position.closed', seq, outcome: r.outcome,
      deltaPct: Math.round(r.deltaPct * 100) / 100, g: Math.round(r.g * 1000) / 1000,
      payout: r.payout, pnl: r.pnl, goldGain, exitBarIdx, forced, liquidated, earnedTotal, aumLeft: this.aum, fee, trigger,
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
    }
  }

  private errMsg(code: WsErrorCode, seq?: number): WsServerMsg {
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
