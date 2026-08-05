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
export type DeptKey = 'trading_desk' | 'rnd' | 'hr' | 'legal' | 'ir' | 'margin';
export type Grade = 'S' | 'A' | 'B' | 'C';
export type Outcome = 'win' | 'lose' | 'draw';
export type Direction = 'long' | 'short';

// POST /api/stage/start 응답 (PRD §7.1)
export interface StageParams {
  regionId: RegionId;
  aum: number;
  totalBaseIncome: number;
  incomePerWave: number;
  incomeLastWave: number;
  heat: number;
  lossRate: number; // L: 하방 계수 (지역 노브)
  maxLossRate: number; // 포지션당 최대 손실률
  maxLeverage: number; // FR-5.6b: 마진 데스크 레벨로 해금된 최대 배율 (기본 1)
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

// WebSocket 메시지 (PRD §7.2) — 선물식 자유 진입·청산
export type WsClientMsg =
  | { op: 'start' }
  | { op: 'position.open'; seq: number; direction: Direction; stake: number; leverage?: number }
  | { op: 'position.close'; seq: number }
  | { op: 'combat.aum'; earned: number } // 전투 처치 AUM 누적 보고 (서버가 상한 clamp)
  | { op: 'clock.sync'; clientBarIdx: number };

export type WsServerMsg =
  | { op: 'started'; serverT0: number }
  | { op: 'position.opened'; seq: number; openBarIdx: number; basePrice: number; aumLeft: number }
  | {
      op: 'position.closed'; seq: number; outcome: Outcome; deltaPct: number; g: number; goldGain: number;
      payout: number; pnl: number; exitBarIdx: number; forced: boolean; earnedTotal: number; aumLeft: number;
    }
  | { op: 'aum.update'; aumLeft: number; combatCredited: number }
  | { op: 'clock.resync'; serverBarIdx: number }
  | { op: 'error'; code: WsErrorCode; seq?: number };

export type WsErrorCode =
  | 'POSITION_ALREADY_OPEN'
  | 'NO_OPEN_POSITION'
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
  tradeDate: string; // 기간 종료일 YYYY-MM-DD
  tradeStart?: string; // 기간 시작일 YYYY-MM-DD (일봉 윈도우)
  sector: string;
  dayChangePct: number; // 기간 전체 등락률
  rarity: string;
  news: { headline: string; source?: string }[];
  dailyAround: { d: string; o: number; h: number; l: number; c: number }[]; // 다운샘플 문맥 차트
  dayIndex: number; // dailyAround 내 윈도우 시작 위치
  windowLen?: number; // dailyAround 단위의 윈도우 길이
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
