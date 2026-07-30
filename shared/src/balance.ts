// PRD §9 밸런스 상수표 — 서버 컨피그가 권위, 클라이언트는 params 스냅샷을 통해서만 받는다.
import type { DeptKey, RegionId, WaveSpec } from './types.js';

export const BALANCE = {
  // §9.1 예측 파라미터
  PAYOUT_BASE: 0.9,
  LOSS_RATE: { R1: 0.6, R2: 0.75, R3: 0.9, TUT: 0.5 } as Record<RegionId, number>,
  DRAW_BAND: 0.25,
  M_CLAMP: [0.5, 3.0] as const,
  MAX_POSITIONS: 24,
  MAX_CONCURRENT: 1,
  OPEN_RATE_LIMIT_MS: 1000,
  STAKE_PCTS: [0.1, 0.25, 0.5, 1.0],
  EXPIRY_BARS: [15, 30],

  // §9.2 경제 파라미터
  BASE_INCOME_PER_WAVE: 25,
  WAVE_COUNT: 13,
  UPKEEP_PER_TERRITORY: 25,
  UPKEEP_FINANCE_DISCOUNT: 10, // 재무 보상 1개당 −10 G/지역
  HEAT_PER_TERRITORY: 0.02,
  AUM_BY_DESK_LV: [2000, 2400, 2800],
  BASE_HP: 100,
  ENEMY_BASE_HP: 300,
  RETRY_CAPITAL_MULT: 0.5,
  TOWER_SLOTS_BASE: 6,
  TOWER_SLOTS_MAX: 8,
  SKILL_COST: 200,
  SKILL_COOLDOWN_S: 45,
  SKILL_DAMAGE: 80,
  COOLDOWN_PLAYS: 20, // FR-3.6 조합 재출현 쿨다운

  // 웨이브 사이클 (FR-3.1)
  PREP_SECONDS: 10,
  WAVE_SECONDS: 20,
  CYCLE_SECONDS: 30,
  STAGE_BARS: 390,
  TUTORIAL_WAVES: 5,
  TUTORIAL_BARS: 150,
  TUTORIAL_CAPITAL: 500, // FR-12.5

  // FR-7 시장 이벤트
  EVENT_MAX_PER_STAGE: 4,
  PANIC_COUNT_MULT: 1.3,
  PANIC_SPEED_MULT: 1.2,
  FOMO_ALLY_ATK_MULT: 1.25,
  FOMO_ENEMY_HP_MULT: 1.15,

  // 정산 (FR-8)
  GRADE_MULT: { S: 1.6, A: 1.3, B: 1.1, C: 1.0 } as Record<string, number>,
  BONUS_HP_FULL: 0.2,
  BONUS_ACC_60: 0.15,
  BONUS_ACC_70: 0.3,

  // 점령 보상 (FR-8.3)
  REWARD_OFFENSE_COST_CUT: 0.15, // 유닛 비용 −15% (보유 1개당, 합연산)
} as const;

// FR-6.4 타워 (DPS 등 세부 스펙은 PRD 미정 → 설계값, 봇 시뮬레이터로 검증)
export interface TowerSpec {
  key: 'basic' | 'aa' | 'splash';
  name: string;
  cost: number;
  upgradeCost: number;
  target: 'ground' | 'air';
  dmg: number; // 발당
  rate: number; // 초당 발사
  range: number;
  splashRadius: number; // 0이면 단일
  lv2Mult: number; // 업그레이드 시 dmg 배수
}

export const TOWERS: TowerSpec[] = [
  { key: 'basic', name: '기본 포탑', cost: 120, upgradeCost: 180, target: 'ground', dmg: 12, rate: 1.25, range: 420, splashRadius: 0, lv2Mult: 1.8 },
  { key: 'aa', name: '대공 포대', cost: 120, upgradeCost: 180, target: 'air', dmg: 18, rate: 1.2, range: 470, splashRadius: 0, lv2Mult: 1.8 },
  { key: 'splash', name: '광역 포탑', cost: 160, upgradeCost: 220, target: 'ground', dmg: 9, rate: 0.8, range: 330, splashRadius: 90, lv2Mult: 1.8 },
];

// FR-6.5 유닛
export interface UnitSpec {
  key: 'intern' | 'analyst' | 'trader';
  name: string;
  cost: number;
  hp: number;
  dps: number;
  speed: number;
}

export const UNITS: UnitSpec[] = [
  { key: 'intern', name: '인턴', cost: 30, hp: 45, dps: 5, speed: 46 },
  { key: 'analyst', name: '애널리스트', cost: 60, hp: 95, dps: 12, speed: 42 },
  { key: 'trader', name: '트레이더', cost: 90, hp: 170, dps: 22, speed: 40 },
];

// §9.4 웨이브 테이블 — R1 원본, R2/R3는 배수 스케일
const R1_WAVES: WaveSpec[] = [
  { count: 3, hp: 50, speed: 1.0, air: false },
  { count: 4, hp: 55, speed: 1.0, air: false },
  { count: 5, hp: 60, speed: 1.0, air: true },
  { count: 5, hp: 70, speed: 1.0, air: false },
  { count: 6, hp: 80, speed: 1.0, air: true },
  { count: 7, hp: 90, speed: 1.0, air: false },
  { count: 7, hp: 105, speed: 1.05, air: true },
  { count: 8, hp: 120, speed: 1.05, air: true },
  { count: 9, hp: 140, speed: 1.05, air: false },
  { count: 10, hp: 160, speed: 1.1, air: true },
  { count: 11, hp: 185, speed: 1.1, air: true },
  { count: 12, hp: 215, speed: 1.1, air: true },
  { count: 14, hp: 260, speed: 1.15, air: true },
];

function scaleWaves(base: WaveSpec[], countMult: number, hpMult: number): WaveSpec[] {
  return base.map((w) => ({
    count: Math.ceil(w.count * countMult),
    hp: Math.round(w.hp * hpMult),
    speed: w.speed,
    air: w.air,
  }));
}

export const WAVE_TABLES: Record<RegionId, WaveSpec[]> = {
  R1: R1_WAVES,
  R2: scaleWaves(R1_WAVES, 1.1, 1.35),
  R3: scaleWaves(R1_WAVES, 1.2, 1.7),
  TUT: [
    { count: 2, hp: 40, speed: 0.9, air: false },
    { count: 3, hp: 45, speed: 0.9, air: false },
    { count: 3, hp: 50, speed: 0.9, air: false },
    { count: 4, hp: 55, speed: 0.9, air: true },
    { count: 5, hp: 65, speed: 0.9, air: false },
  ],
};

export const REGION_META: Record<RegionId, { name: string; sector: string; difficulty: number; adjacent: RegionId | null }> = {
  TUT: { name: '튜토리얼', sector: '연습', difficulty: 0, adjacent: null },
  R1: { name: '여의도', sector: '금융', difficulty: 1, adjacent: null },
  R2: { name: '판교', sector: 'IT·플랫폼', difficulty: 2, adjacent: 'R1' },
  R3: { name: '울산', sector: '중공업·에너지', difficulty: 3, adjacent: 'R2' },
};

// FR-11.2 부서 5종 — level은 1부터, 배열 인덱스 = level-1
export interface DeptSpec {
  key: DeptKey;
  name: string;
  desc: (lv: number) => string;
  maxLv: 3;
  costs: [number, number]; // Lv2, Lv3 비용
}

export const DEPTS: DeptSpec[] = [
  { key: 'trading_desk', name: '트레이딩 데스크', desc: (lv) => `초기 AUM ${BALANCE.AUM_BY_DESK_LV[lv - 1]}`, maxLv: 3, costs: [1200, 3000] },
  { key: 'rnd', name: 'R&D', desc: (lv) => `타워 피해 +${[0, 8, 16][lv - 1]}%`, maxLv: 3, costs: [800, 2000] },
  { key: 'hr', name: '인사팀', desc: (lv) => `유닛 HP +${[0, 10, 20][lv - 1]}%`, maxLv: 3, costs: [800, 2000] },
  { key: 'legal', name: '법무팀', desc: (lv) => `손실률 −${[0, 0.05, 0.1][lv - 1].toFixed(2)}`, maxLv: 3, costs: [1500, 3500] },
  { key: 'ir', name: 'IR팀', desc: (lv) => `정산 보너스 +${[0, 5, 10][lv - 1]}%`, maxLv: 3, costs: [1000, 2500] },
];

export const DEPT_EFFECTS = {
  towerDmgMult: (lv: number) => 1 + [0, 0.08, 0.16][lv - 1], // 합연산 (FR-11.3)
  unitHpMult: (lv: number) => 1 + [0, 0.1, 0.2][lv - 1],
  legalCut: (lv: number) => [0, 0.05, 0.1][lv - 1],
  irBonus: (lv: number) => [0, 0.05, 0.1][lv - 1],
};
