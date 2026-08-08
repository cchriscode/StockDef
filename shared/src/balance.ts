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
  LEVERAGES: [1, 2, 3, 5] as number[], // 진입 시 선택하는 배율 — g에 곱해 손익 양방향 증폭 (손실은 MAX_LOSS_RATE 클램프 유지)

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
  SKILL_COOLDOWN_S: 25, // 2026-08-05 난이도 개편: 스킬을 더 자주 쓰는 대신 적이 강해짐
  SKILL_DAMAGE: 80,
  ENEMY_HP_MULT: 1.3, // 2026-08-05 전 지역 적 체력 +30% (플레이테스트 "너무 쉽다" 반영)
  ENEMY_DPS_MULT: 1.3, // 적 공격력 +30%
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

// FR-6.4 타워 — handoff 리그 팩 6종 전체 (2026-08-05 확장). 수치는 봇 시뮬레이터로 검증
export interface TowerSpec {
  key: 'limit' | 'dividend' | 'barrier' | 'cannon' | 'spire' | 'flame';
  name: string;
  cost: number;
  upgradeCost: number;
  target: 'ground' | 'air' | 'both' | 'none'; // none = 비공격 구조물
  dmgType: DmgType;
  dmg: number; // 발당 (0 = 비공격)
  rate: number; // 초당 발사
  range: number;
  splashRadius: number; // 0이면 단일
  slowPct: number; // 명중 시 슬로우 (0이면 없음)
  slowDur: number;
  projSpeed: number; // 투사체 속도 px/s
  lv2Mult: number; // 업그레이드 시 dmg·수입·내구 배수
  lv2Pierce: boolean; // Lv2 철갑탄: 물리 → 마법(armor 관통) 전환
  incomeAmount: number; // 배당 파밍: 주기당 골드 (0 = 없음)
  incomePeriod: number; // 배당 파밍: 주기 (초)
  barrierHP: number; // 손절 방벽: 내구도 (0 = 차단 없음)
  rampPct: number; // 복리 화염: 같은 대상 연속 명중당 피해 증가율 (0 = 없음)
  rampMax: number; // 복리 화염: 증가 상한 (배수 가산치)
}

export const TOWERS: TowerSpec[] = [
  { key: 'limit', name: '지정가 포탑', cost: 110, upgradeCost: 160, target: 'both', dmgType: 'physical', dmg: 16, rate: 1.4, range: 460, splashRadius: 0, slowPct: 0, slowDur: 0, projSpeed: 680, lv2Mult: 1.8, lv2Pierce: true, incomeAmount: 0, incomePeriod: 0, barrierHP: 0, rampPct: 0, rampMax: 0 },
  { key: 'cannon', name: '공매도 캐논', cost: 150, upgradeCost: 210, target: 'ground', dmgType: 'physical', dmg: 21, rate: 0.5, range: 390, splashRadius: 60, slowPct: 0, slowDur: 0, projSpeed: 420, lv2Mult: 1.8, lv2Pierce: false, incomeAmount: 0, incomePeriod: 0, barrierHP: 0, rampPct: 0, rampMax: 0 },
  { key: 'spire', name: '옵션 스파이어', cost: 140, upgradeCost: 200, target: 'both', dmgType: 'magic', dmg: 11, rate: 0.9, range: 430, splashRadius: 0, slowPct: 0.3, slowDur: 1.5, projSpeed: 620, lv2Mult: 1.6, lv2Pierce: false, incomeAmount: 0, incomePeriod: 0, barrierHP: 0, rampPct: 0, rampMax: 0 },
  { key: 'flame', name: '복리 화염', cost: 120, upgradeCost: 170, target: 'ground', dmgType: 'physical', dmg: 6.5, rate: 2.2, range: 320, splashRadius: 0, slowPct: 0, slowDur: 0, projSpeed: 520, lv2Mult: 1.8, lv2Pierce: false, incomeAmount: 0, incomePeriod: 0, barrierHP: 0, rampPct: 0.12, rampMax: 1.2 },
  { key: 'dividend', name: '배당 파밍', cost: 130, upgradeCost: 190, target: 'none', dmgType: 'physical', dmg: 0, rate: 0, range: 0, splashRadius: 0, slowPct: 0, slowDur: 0, projSpeed: 0, lv2Mult: 1.8, lv2Pierce: false, incomeAmount: 8, incomePeriod: 10, barrierHP: 0, rampPct: 0, rampMax: 0 },
  { key: 'barrier', name: '손절 방벽', cost: 70, upgradeCost: 100, target: 'none', dmgType: 'physical', dmg: 0, rate: 0, range: 0, splashRadius: 0, slowPct: 0, slowDur: 0, projSpeed: 0, lv2Mult: 1.8, lv2Pierce: false, incomeAmount: 0, incomePeriod: 0, barrierHP: 260, rampPct: 0, rampMax: 0 },
];

// FR-6.5 유닛 — handoff 리그 팩 6직군: 블로커 / 원거리 / 근접 브루저 / 관통 창병 / 마법 원거리 / 서포터
export interface UnitSpec {
  key: 'intern' | 'analyst' | 'trader' | 'lancer' | 'mage' | 'riskmgr' | 'cane'
    // [임시] 신규 아트 프리뷰 유닛 10종 (전부 1G) — 확정 시 정식 스탯·비용 책정 또는 제거
    | 'club' | 'scissor' | 'foreman' | 'apprentice' | 'pistol' | 'gasmask' | 'sniper' | 'roundshield' | 'shutter' | 'bricker';
  name: string;
  cost: number;
  hp: number;
  dps: number;
  speed: number;
  range: number; // 교전 사거리 (근접 26)
  cleave: number; // 동시 타격 수
  antiAirPct: number; // 공중 공격 배율 (0 = 불가)
  block: number; // 동시에 붙잡을 수 있는 적 수 (초과분은 통과)
  dmgType: DmgType; // 마법은 armor 관통 (Kingdom Rush 이분법)
  baseHealPerSec: number; // 리스크 매니저: 사옥 회복/초 (생존 중, BASE_HP 상한)
  guardPct: number; // 리스크 매니저: 주변 아군 피해 감소율
  guardRadius: number;
}

export const UNITS: UnitSpec[] = [
  { key: 'intern', name: '인턴', cost: 30, hp: 60, dps: 3, speed: 23, range: 26, cleave: 1, antiAirPct: 0, block: 3, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'analyst', name: '애널리스트', cost: 60, hp: 70, dps: 12, speed: 21, range: 110, cleave: 1, antiAirPct: 0.5, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'lancer', name: '창병', cost: 75, hp: 120, dps: 13, speed: 20, range: 34, cleave: 3, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'trader', name: '트레이더', cost: 90, hp: 170, dps: 18, speed: 20, range: 26, cleave: 2, antiAirPct: 0, block: 2, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'mage', name: '술사', cost: 110, hp: 55, dps: 14, speed: 20, range: 130, cleave: 1, antiAirPct: 0.6, block: 1, dmgType: 'magic', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'riskmgr', name: '리스크 매니저', cost: 90, hp: 80, dps: 0, speed: 20, range: 0, cleave: 0, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0.5, guardPct: 0.2, guardRadius: 120 },
  // 임시 테스트 유닛 (PNG 스프라이트 프리뷰용, handoff-walk-cane) — 확정 시 정식 스탯·비용 책정
  { key: 'cane', name: '지팡이 신사', cost: 1, hp: 100, dps: 15, speed: 20, range: 30, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  // [임시] ally-sprites 로스터 10종 — 전부 1G, 역할별 임시 스탯 (아트 확인용)
  { key: 'club', name: '종머리 곤봉병', cost: 1, hp: 140, dps: 18, speed: 20, range: 30, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'scissor', name: '가위 병사', cost: 1, hp: 120, dps: 20, speed: 20, range: 28, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'apprentice', name: '망치 견습공', cost: 1, hp: 110, dps: 16, speed: 20, range: 28, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'foreman', name: '망치 작업반장', cost: 1, hp: 240, dps: 12, speed: 20, range: 28, cleave: 2, antiAirPct: 0, block: 3, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'roundshield', name: '원형 방패병', cost: 1, hp: 200, dps: 8, speed: 20, range: 26, cleave: 1, antiAirPct: 0, block: 3, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'shutter', name: '셔터 장교', cost: 1, hp: 190, dps: 9, speed: 20, range: 26, cleave: 1, antiAirPct: 0, block: 3, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'bricker', name: '벽돌 짐꾼', cost: 1, hp: 210, dps: 10, speed: 20, range: 26, cleave: 1, antiAirPct: 0, block: 2, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'pistol', name: '권총 장교', cost: 1, hp: 80, dps: 14, speed: 20, range: 120, cleave: 1, antiAirPct: 0.5, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'gasmask', name: '방독면 포수', cost: 1, hp: 85, dps: 16, speed: 20, range: 110, cleave: 1, antiAirPct: 0.4, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'sniper', name: '저격수', cost: 1, hp: 70, dps: 22, speed: 20, range: 160, cleave: 1, antiAirPct: 0.6, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
];

// FR-6.5b/6.7b 자동 스킬 주기 (초) — 유닛·적이 일정 주기마다 고유 스킬을 자동 시전 (리그 skill 모션+VFX 재생)
export const UNIT_SKILL_PERIOD: Record<UnitSpec['key'], number> = {
  intern: 12, // 원금 보장 — 3초간 받는 피해 −60% 돔
  analyst: 12, // 화살 세례 — 사거리 내 최대 4기 다중 사격 (dps×1.2/발)
  lancer: 10, // 리밸런싱 — 확장 사거리 일직선 전원 관통 (dps×1.8)
  trader: 9, // 복리 참격 — 주변 지상 광역 일격 (dps×2.5)
  mage: 14, // 레버리지 오브 — 마법 광역탄 (dps×2.2, 폭발 70)
  riskmgr: 5, // 헤지 커버 — 사옥 즉시 +3 회복 (오라 패시브와 별도 버스트)
  cane: 9999, // 임시 유닛 — 스킬 없음
  club: 9999, scissor: 9999, apprentice: 9999, foreman: 9999, roundshield: 9999, // [임시] 프리뷰 유닛 — 스킬 없음
  shutter: 9999, bricker: 9999, pistol: 9999, gasmask: 9999, sniper: 9999,
};
export const ENEMY_SKILL_PERIOD: Record<EnemyTypeSpec['key'], number> = {
  grunt: 9, // 3점사 — 블로킹 중 추가 일격 (dps×1.5)
  runner: 8, // 질주 — 2초간 이속 ×1.5
  tank: 11, // 전진 독려 — 주변 지상 적 2초 가속
  shield: 12, // 육각 실드 — 2.5초간 받는 피해 −70%
  healer: 10, // 응급 수리 — 주변 적 즉시 +30 회복
  air: 11, // 광학 볼트 — 사거리 내 아군 유닛 저격 (14)
  boss: 15, // 마진콜 충격파 — 주변 아군 유닛 전체 22 피해
};

// 사옥 자동 포탑 (Age of War 본진 방어) — 최후 방어선
export const BASE_TURRET = { dmg: 4.5, rate: 1.0, range: 260, dmgType: 'physical' as DmgType }; // 2026-08-05 난이도 개편: 아군 공격력 −20%

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
// 지수형 곡선 (2026-08-05 개정): 초반은 가볍게 시작해 후반으로 갈수록 물량·HP가 가파르게 상승.
// 앞 웨이브는 트레이딩·배치에 집중할 여유를 주고, W10+는 확실한 위협이 되도록.
const R1_WAVES: WaveSpec[] = [
  { count: 2, hp: 45, speed: 1.0, air: false },
  { count: 3, hp: 52, speed: 1.0, air: false },
  { count: 3, hp: 62, speed: 1.0, air: true },
  { count: 4, hp: 75, speed: 1.0, air: false },
  { count: 5, hp: 92, speed: 1.0, air: true },
  { count: 6, hp: 115, speed: 1.0, air: false },
  { count: 7, hp: 145, speed: 1.05, air: true },
  { count: 8, hp: 180, speed: 1.05, air: true },
  { count: 10, hp: 225, speed: 1.05, air: false },
  { count: 12, hp: 280, speed: 1.1, air: true },
  { count: 14, hp: 330, speed: 1.1, air: true },
  { count: 16, hp: 410, speed: 1.1, air: true },
  { count: 18, hp: 510, speed: 1.15, air: true },
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
  { key: 'margin', name: '마진 데스크', desc: (lv) => `레버리지 최대 ${[1, 3, 5][lv - 1]}×`, maxLv: 3, costs: [1200, 3200] }, // FR-5.6b: Lv2 → 2·3× / Lv3 → 5× 해금
];

export const DEPT_EFFECTS = {
  towerDmgMult: (lv: number) => 1 + [0, 0.08, 0.16][lv - 1], // 합연산 (FR-11.3)
  unitHpMult: (lv: number) => 1 + [0, 0.1, 0.2][lv - 1],
  legalCut: (lv: number) => [0, 0.05, 0.1][lv - 1],
  irBonus: (lv: number) => [0, 0.05, 0.1][lv - 1],
  maxLeverage: (lv: number) => [1, 3, 5][lv - 1],
};
