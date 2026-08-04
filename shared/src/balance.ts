// PRD §9 밸런스 상수표 — 서버 컨피그가 권위, 클라이언트는 params 스냅샷을 통해서만 받는다.
import type { DeptKey, RegionId, WaveSpec } from './types.js';

export const BALANCE = {
  // §9.1 예측 파라미터 (선물식 자유 진입·청산)
  PAYOUT_BASE: 0.9, // B: 상방 계수 (전 지역 고정)
  // L: 지역별 하방 계수 (난이도 노브). 실데이터 30봉 |g| 분포로 손익분기 승률을
  // R1 40.5% / R2 45.4% / R3 50.2%에 맞춰 역산 — 재계산: npx tsx server/scripts/calibrate_pnl.ts
  LOSS_RATE: { R1: 0.7, R2: 1.05, R3: 1.7, TUT: 0.5 } as Record<RegionId, number>,
  MAX_LOSS_RATE: 0.95, // 포지션당 최대 손실 (stake 대비) — 하방 클램프
  DRAW_BAND: 0.25, // |g| < 0.25 → 통계상 DRAW (손익은 연속)
  Z_CAP: 3.0, // 정규화 수익 g의 상방 클램프 → 최대 배당 1 + B×3
  MAX_POSITIONS: 30,
  MAX_CONCURRENT: 1,
  OPEN_RATE_LIMIT_MS: 1000,
  STAKE_PCTS: [0.1, 0.25, 0.5, 1.0],

  // §9.2 경제 파라미터
  // 적 처치 → AUM 획득 (전투가 트레이딩 자본을 되채우는 루프). 서버는 클라 보고를
  // aum × CAP_RATE 상한으로 clamp — R1 전량 처치 시 이론 획득 ≈ 초기 AUM의 ~12%
  // (그 이상 주면 §9.3 실력 게이트가 무너짐 — 봇 시뮬로 확인, npm run sim).
  AUM_COMBAT_CAP_RATE: 0.2,
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

  // FR-3.6b 지역별 차트 아키타입 가중 추첨 — 쉬운 지역은 박스권(작은 |g|, 실수에 관대),
  // 어려운 지역은 원웨이·급변(방향 맞으면 대박, 틀리면 L 계수로 크게 잃음 → 실력 게이트 강화).
  // 미기재 아키타입 가중치는 1. 봇 시뮬(npm run sim)로 §9.3 곡선 재검증할 것.
  ARCHETYPE_WEIGHTS: {
    TUT: {},
    R1: { range: 5, reversal: 3, surge: 1, plunge: 1, panic: 1, earnings: 0.5 },
    R2: { range: 2, reversal: 3, surge: 2, plunge: 2, panic: 2, earnings: 1 },
    R3: { range: 0.5, reversal: 1, surge: 3, plunge: 3, panic: 3, earnings: 3 },
  } as Record<RegionId, Record<string, number>>,

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

// ─── 전투 심화 설계 (레퍼런스: Kingdom Rush 방어구/마법 이분법, Bloons TD 타겟팅 모드, Age of War 유닛 역할) ───

export type DmgType = 'physical' | 'magic'; // 물리는 armor에 감소, 마법은 armor 관통·mr에 감소
export type TargetingMode = 'first' | 'last' | 'strong' | 'close';
export const TARGETING_MODES: TargetingMode[] = ['first', 'last', 'strong', 'close'];

// FR-6.4 타워 (세부 스펙은 PRD 미정 → 설계값, 봇 시뮬레이터로 검증)
export interface TowerSpec {
  key: 'basic' | 'aa' | 'splash';
  name: string;
  cost: number;
  upgradeCost: number;
  target: 'ground' | 'air';
  dmgType: DmgType;
  dmg: number; // 발당
  rate: number; // 초당 발사
  range: number;
  splashRadius: number; // 0이면 단일
  slowPct: number; // 명중 시 슬로우 (0이면 없음)
  slowDur: number;
  projSpeed: number; // 투사체 속도 px/s
  lv2Mult: number; // 업그레이드 시 dmg 배수
}

export const TOWERS: TowerSpec[] = [
  { key: 'basic', name: '기본 포탑', cost: 120, upgradeCost: 180, target: 'ground', dmgType: 'physical', dmg: 14, rate: 1.25, range: 420, splashRadius: 0, slowPct: 0, slowDur: 0, projSpeed: 640, lv2Mult: 1.8 },
  { key: 'aa', name: '대공 포대', cost: 120, upgradeCost: 180, target: 'air', dmgType: 'physical', dmg: 20, rate: 1.2, range: 470, splashRadius: 0, slowPct: 0, slowDur: 0, projSpeed: 720, lv2Mult: 1.8 },
  { key: 'splash', name: '광역 포탑', cost: 160, upgradeCost: 220, target: 'ground', dmgType: 'magic', dmg: 12, rate: 0.9, range: 330, splashRadius: 90, slowPct: 0.25, slowDur: 1.2, projSpeed: 460, lv2Mult: 1.8 },
];

// FR-6.5 유닛 — Age of War 역할 분담: 블로커 / 원거리 딜러 / 근접 브루저
export interface UnitSpec {
  key: 'intern' | 'analyst' | 'trader';
  name: string;
  cost: number;
  hp: number;
  dps: number;
  speed: number;
  range: number; // 교전 사거리 (근접 26)
  cleave: number; // 동시 타격 수
  antiAirPct: number; // 공중 공격 배율 (0 = 불가)
  block: number; // 동시에 붙잡을 수 있는 적 수 (초과분은 통과)
}

export const UNITS: UnitSpec[] = [
  { key: 'intern', name: '인턴', cost: 30, hp: 60, dps: 4, speed: 46, range: 26, cleave: 1, antiAirPct: 0, block: 3 },
  { key: 'analyst', name: '애널리스트', cost: 60, hp: 70, dps: 15, speed: 42, range: 110, cleave: 1, antiAirPct: 0.5, block: 1 },
  { key: 'trader', name: '트레이더', cost: 90, hp: 170, dps: 22, speed: 40, range: 26, cleave: 2, antiAirPct: 0, block: 2 },
];

// 사옥 자동 포탑 (Age of War 본진 방어) — 최후 방어선
export const BASE_TURRET = { dmg: 8, rate: 1.0, range: 260, dmgType: 'physical' as DmgType };

// 적 아키타입 — Kingdom Rush식 카운터 관계 (armor ↔ 마법, 공중 ↔ 대공/애널리스트)
export interface EnemyTypeSpec {
  key: 'grunt' | 'runner' | 'tank' | 'shield' | 'healer' | 'air' | 'boss';
  name: string;
  icon: string;
  hpMult: number;
  speedMult: number;
  armor: number; // 물리 피해 감소율 0~1
  mr: number;    // 마법 피해 감소율 0~1
  dpsMult: number;
  healPerSec: number; // 주변 아군 회복 (healer)
  baseDmg: number; // 본진 도달 시 피해
  isAir: boolean;
  size: number; // 렌더 반경
  aumBounty: number; // 처치 시 AUM 획득 (본진 도달로 죽으면 0)
}

export const ENEMY_TYPES: Record<EnemyTypeSpec['key'], EnemyTypeSpec> = {
  grunt: { key: 'grunt', name: '공매도 요원', icon: '👤', hpMult: 1.0, speedMult: 1.0, armor: 0, mr: 0, dpsMult: 1, healPerSec: 0, baseDmg: 10, isAir: false, size: 8, aumBounty: 2 },
  runner: { key: 'runner', name: '스캘퍼', icon: '💨', hpMult: 0.55, speedMult: 1.8, armor: 0, mr: 0, dpsMult: 0.7, healPerSec: 0, baseDmg: 8, isAir: false, size: 6, aumBounty: 1 },
  tank: { key: 'tank', name: '기관 물량', icon: '🛡', hpMult: 2.2, speedMult: 0.6, armor: 0.4, mr: 0, dpsMult: 1.4, healPerSec: 0, baseDmg: 18, isAir: false, size: 11, aumBounty: 5 },
  shield: { key: 'shield', name: '로펌 실드', icon: '⚖', hpMult: 1.3, speedMult: 0.8, armor: 0.55, mr: 0, dpsMult: 1, healPerSec: 0, baseDmg: 12, isAir: false, size: 9, aumBounty: 3 },
  healer: { key: 'healer', name: '리스크 헤지', icon: '➕', hpMult: 0.9, speedMult: 0.9, armor: 0, mr: 0.3, dpsMult: 0.5, healPerSec: 6, baseDmg: 8, isAir: false, size: 8, aumBounty: 3 },
  air: { key: 'air', name: '드론', icon: '✈', hpMult: 0.8, speedMult: 1.15, armor: 0, mr: 0.3, dpsMult: 0.8, healPerSec: 0, baseDmg: 10, isAir: true, size: 8, aumBounty: 2 },
  boss: { key: 'boss', name: '베어 간부', icon: '👹', hpMult: 5.5, speedMult: 0.45, armor: 0.25, mr: 0.2, dpsMult: 3, healPerSec: 0, baseDmg: 30, isAir: false, size: 15, aumBounty: 12 },
};

// 웨이브 조합 (비율) — 지역별로 성격이 다르다: R2 고속·공중 / R3 중장갑
type CompRatio = Partial<Record<EnemyTypeSpec['key'], number>>;
const COMP_R1: CompRatio[] = [
  { grunt: 1 },
  { grunt: 1 },
  { grunt: 3, air: 1 },
  { grunt: 3, runner: 2 },
  { grunt: 2, air: 1, runner: 1 },
  { grunt: 3, tank: 1 },
  { grunt: 2, runner: 1, air: 1 },
  { grunt: 3, tank: 1, air: 1 },
  { grunt: 2, runner: 2, air: 1 },
  { grunt: 3, tank: 1, air: 1 },
  { grunt: 2, runner: 2, air: 1, healer: 1 },
  { grunt: 2, tank: 1, shield: 1, air: 1 },
  { grunt: 2, runner: 2, tank: 1, air: 1, healer: 1 }, // + 보스
];
const COMP_R2: CompRatio[] = COMP_R1.map((c, i) => (i >= 2 ? { ...c, runner: (c.runner ?? 0) + 1, air: (c.air ?? 0) + 1 } : c));
const COMP_R3: CompRatio[] = COMP_R1.map((c, i) => (i >= 3 ? { ...c, tank: (c.tank ?? 0) + 1, shield: (c.shield ?? 0) + (i >= 8 ? 1 : 0) } : c));
const COMP_TUT: CompRatio[] = [{ grunt: 1 }, { grunt: 1 }, { grunt: 2, runner: 1 }, { grunt: 2, air: 1 }, { grunt: 2, runner: 1 }];

export const WAVE_COMPS: Record<RegionId, CompRatio[]> = { R1: COMP_R1, R2: COMP_R2, R3: COMP_R3, TUT: COMP_TUT };
export const BOSS_WAVES: Record<RegionId, number[]> = { R1: [13], R2: [7, 13], R3: [7, 13], TUT: [] };

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

// 스케일 근거: §9.3 목표 지출 비율 (R2 2550/2000 ≈ ×1.28, R3 3100/2000 ≈ ×1.55) — 봇 시뮬레이터로 검증
export const WAVE_TABLES: Record<RegionId, WaveSpec[]> = {
  R1: R1_WAVES,
  R2: scaleWaves(R1_WAVES, 1.05, 1.25),
  R3: scaleWaves(R1_WAVES, 1.05, 1.5),
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
