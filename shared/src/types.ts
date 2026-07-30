// PRD §6.2 스테이지 데이터 파일 (블라인드 — 종목·날짜 미포함)
export interface Bar {
  t: number; // 0-based 분 인덱스
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface MarketEvent {
  t: number; // 발동 시점 (게임초 = bar 인덱스)
  type: 'panic_sell' | 'fomo_rally';
  strength: number;
}

export interface BarsFile {
  v: 1;
  barCount: number;
  openPrice: number;
  bars: Bar[];
  volumeAvg20d: number; // 분당 평균 거래량 (20거래일)
  sigma: { '15': number; '30': number; '60': number };
  events: MarketEvent[];
  tags: { region: string; sector: string; capTier: string };
}

export type RegionId = 'R1' | 'R2' | 'R3' | 'TUT';
export type RewardLine = 'finance' | 'info' | 'defense' | 'offense';
export type DeptKey = 'trading_desk' | 'rnd' | 'hr' | 'legal' | 'ir';
export type Grade = 'S' | 'A' | 'B' | 'C';
export type Outcome = 'win' | 'lose' | 'draw';
export type Direction = 'long' | 'short';

// POST /api/stage/start 응답 (PRD §7.1)
export interface StageParams {
  aum: number;
  totalBaseIncome: number;
  incomePerWave: number;
  incomeLastWave: number;
  heat: number;
  lossRate: number;
  payoutBase: number;
  drawBand: number;
  towerSlots: number;
  maxPositions: number;
  waveCount: number;
  unitHpMult: number;
  towerDmgMult: number;
  unitCostMult: number;
  hasInfoResearch: boolean;
  waveTable: WaveSpec[];
}

export interface WaveSpec {
  count: number;
  hp: number;
  speed: number;
  air: boolean;
}

export interface StageStartRes {
  sessionId: string;
  barsUrl: string;
  params: StageParams;
}

// WebSocket 메시지 (PRD §7.2)
export type WsClientMsg =
  | { op: 'start' }
  | { op: 'position.open'; seq: number; direction: Direction; stake: number; expirySec: number }
  | { op: 'clock.sync'; clientBarIdx: number };

export type WsServerMsg =
  | { op: 'started'; serverT0: number }
  | { op: 'position.opened'; seq: number; openBarIdx: number; closeBarIdx: number; basePrice: number; aumLeft: number }
  | { op: 'position.resolved'; seq: number; outcome: Outcome; deltaPct: number; m: number; payout: number; earnedTotal: number; aumLeft: number }
  | { op: 'clock.resync'; serverBarIdx: number }
  | { op: 'error'; code: WsErrorCode; seq?: number };

export type WsErrorCode =
  | 'POSITION_ALREADY_OPEN'
  | 'RATE_LIMITED'
  | 'MAX_POSITIONS'
  | 'INSUFFICIENT_AUM'
  | 'SESSION_ENDED'
  | 'INVALID_SEQ';

export interface FinishReq {
  goldLeft: number;
  goldSpent: number;
  hpLeft: number;
  enemyBaseDestroyed: boolean;
}

export interface FinishRes {
  status: 'cleared' | 'failed' | 'invalid';
  grade: Grade | null;
  accuracy: number;
  goldLeftRate: number;
  capitalAwarded: number;
  eligibleLines: RewardLine[];
  alreadyOwnedLines: RewardLine[];
  isRetry: boolean;
  capitalTotal: number;
}

export interface RevealRes {
  ticker: string;
  companyName: string;
  tradeDate: string; // YYYY-MM-DD
  sector: string;
  dayChangePct: number;
  rarity: string;
  news: { headline: string; source?: string }[];
  dailyAround: { d: string; o: number; h: number; l: number; c: number }[];
  dayIndex: number; // dailyAround 내 당일 위치
  positions: {
    seq: number; direction: Direction; stake: number;
    openBarIdx: number; closeBarIdx: number; outcome: Outcome; payout: number;
  }[];
  hits: number;
  misses: number;
  status: string;
}

export interface MapRegion {
  regionId: RegionId;
  name: string;
  sector: string;
  difficulty: number;
  state: 'locked' | 'open' | 'captured';
  rewardsTaken: RewardLine[];
  bestGrade: Grade | null;
}

export interface MapRes {
  regions: MapRegion[];
  capital: number;
  capturedCount: number;
  upkeepTotal: number;
  heat: number;
  tutorialDone: boolean;
}

export interface MeRes {
  accountId: string;
  capital: number;
  depts: Record<DeptKey, number>;
  territories: MapRegion[];
  codexCount: number;
  tutorialDone: boolean;
}
