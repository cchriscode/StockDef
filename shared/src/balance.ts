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
  MAX_POSITIONS: 10, // FR-5.13: 스테이지당 거래 횟수 (리서치 데스크 부서로 확장)
  POSITIONS_PER_DESK_LV: 5, // 부서 레벨당 +5회
  MAX_CONCURRENT: 1,
  OPEN_RATE_LIMIT_MS: 1000,
  STAKE_PCTS: [0.1, 0.25, 0.5, 1.0],
  GOLD_PER_TRADE_CAP: 500, // FR-5.5c: 청산 1건당 골드 환전 상한 — 초과 수익은 AUM으로 적립
  // FR-5.14 거래 수수료 — 명목가(스테이크 × 배율) 기준으로 진입·청산 양쪽에서 AUM에서 빠진다.
  // 배율을 올리면 수수료도 비례해 늘어 "무조건 최대 배율"이 정답이 되지 않게 하는 장치.
  FEE_RATE: 0.004,
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
  // FR-6.11 (2026-08-10): 적은 사옥을 통과해 소멸하지 않고 그 자리에서 사옥을 친다.
  // 초당 피해 = 적 baseDmg × 이 계수 (봇 시뮬로 결정)
  BASE_ATTACK_DPS_MULT: 0.35,
  ENEMY_BASE_HP: 300,
  RETRY_CAPITAL_MULT: 0.5,
  // FR-6.3c (2026-08-10): 슬롯 3칸 — 사옥 위 2 + 지면 1. 사옥을 등분해 옥상·중층에 포탑을 얹는다
  TOWER_SLOTS_BASE: 3,
  TOWER_SLOTS_MAX: 6, // 사옥 2 + 지면 최대 3 + 점령 보상 1
  BASE_TOWER_SLOTS: 2, // 앞 2칸은 사옥 탑재 (지면 차단물 불가)
  SKILL_COST: 200,
  SKILL_COOLDOWN_S: 25, // 2026-08-05 난이도 개편: 스킬을 더 자주 쓰는 대신 적이 강해짐
  SKILL_DAMAGE: 80,
  // FR-2.6 난이도 모드 — 스테이지 진입 전 선택. 하드가 기본 밸런스이고 이지는 완화 계수를 곱한다.
  // 계수는 봇 시뮬 실측으로 정한다 (R1 p=55% 기준 이지 50~60%가 목표).
  // 골드를 늘리는 방식은 +100%를 줘도 10→13%에 그쳐(전열이 먼저 무너짐) 스탯 완화로 간다.
  // 2026-08-10 재조정: 적이 사옥 앞에 쌓여 계속 싸우게 되면서(FR-6.11) 압력이 올라 한 단계 더 완화.
  EASY_HP_MULT: 0.35, // 이지: 하드 대비 −65% (비율 고정 — 하드가 오르면 이지도 함께 오른다)
  EASY_DPS_MULT: 0.39, // 이지: 하드 대비 −61%
  EASY_COUNT_MULT: 0.6, // 이지: 적 수 −40%
  EASY_CAPITAL_MULT: 0.7, // 이지: 자본금 보상 70% (쉬운 만큼 성장은 느리게)
  // 2026-08-10 재상향(2차): 플레이테스트 기준으로 하드를 1.7배까지 올린다.
  // 이지 계수는 여기에 곱해지므로 비율을 유지하면 이지도 같은 폭으로 함께 올라간다.
  ENEMY_HP_MULT: 1.7, // 전 지역 적 체력 +70%
  ENEMY_DPS_MULT: 1.7, // 적 공격력 +70%
  // FR-6.10b 위기 반격 충격파 — 본진 앞까지 밀고 온 아군을 중원까지 밀어낸다 (러시 견제)
  RAGE_PUSH_TO_X: 500, // 밀려나는 목표 지점 (필드 중앙)
  RAGE_PUSH_SECONDS: 0.9, // 밀려나는 시간 (이 동안 이동·공격 불가)
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
  key: 'limit' | 'cannon' | 'spire'; // FR-6.4c (2026-08-10): 신규 포탑 3종만 운용
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
  groundOnly: boolean; // FR-6.4e 사옥 위에는 올릴 수 없는 포탑 (지면 슬롯 전용)
}

export const TOWERS: TowerSpec[] = [
  { key: 'limit', name: '지정가 포탑', cost: 165, upgradeCost: 240, target: 'both', dmgType: 'physical', dmg: 14, rate: 1.4, range: 380, splashRadius: 0, slowPct: 0, slowDur: 0, projSpeed: 680, lv2Mult: 1.8, lv2Pierce: true, incomeAmount: 0, incomePeriod: 0, barrierHP: 0, rampPct: 0, rampMax: 0, groundOnly: false },
  { key: 'cannon', name: '공매도 캐논', cost: 225, upgradeCost: 315, target: 'ground', dmgType: 'physical', dmg: 18, rate: 0.5, range: 330, splashRadius: 60, slowPct: 0, slowDur: 0, projSpeed: 420, lv2Mult: 1.8, lv2Pierce: false, incomeAmount: 0, incomePeriod: 0, barrierHP: 0, rampPct: 0, rampMax: 0, groundOnly: false },
  { key: 'spire', name: '옵션 스파이어', cost: 210, upgradeCost: 300, target: 'both', dmgType: 'magic', dmg: 10, rate: 0.9, range: 350, splashRadius: 0, slowPct: 0.3, slowDur: 1.5, projSpeed: 620, lv2Mult: 1.6, lv2Pierce: false, incomeAmount: 0, incomePeriod: 0, barrierHP: 0, rampPct: 0, rampMax: 0, groundOnly: true },
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
  antiAirPct: number; // 공중 공격 배율 — FR-6.5f(2026-08-10): 전 유닛 0. 공중 요격은 포탑 전담
  block: number; // 동시에 붙잡을 수 있는 적 수 (초과분은 통과)
  dmgType: DmgType; // 마법은 armor 관통 (Kingdom Rush 이분법)
  baseHealPerSec: number; // 리스크 매니저: 사옥 회복/초 (생존 중, BASE_HP 상한)
  guardPct: number; // 리스크 매니저: 주변 아군 피해 감소율
  guardRadius: number;
}

export const UNITS: UnitSpec[] = [
  { key: 'intern', name: '인턴', cost: 30, hp: 60, dps: 3, speed: 23, range: 26, cleave: 1, antiAirPct: 0, block: 3, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'analyst', name: '애널리스트', cost: 60, hp: 70, dps: 12, speed: 21, range: 110, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'lancer', name: '창병', cost: 75, hp: 120, dps: 13, speed: 20, range: 34, cleave: 3, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'trader', name: '트레이더', cost: 90, hp: 170, dps: 18, speed: 20, range: 26, cleave: 2, antiAirPct: 0, block: 2, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'mage', name: '술사', cost: 110, hp: 55, dps: 14, speed: 20, range: 130, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'magic', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'riskmgr', name: '리스크 매니저', cost: 90, hp: 80, dps: 0, speed: 20, range: 0, cleave: 0, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0.5, guardPct: 0.2, guardRadius: 120 },
  // 임시 테스트 유닛 (PNG 스프라이트 프리뷰용, handoff-walk-cane) — 확정 시 정식 스탯·비용 책정
  // 지팡이는 내려치는 무기라 리치가 짧다 — 적이 바짝 붙어야 타격 (사거리 = 블로킹 간격)
  { key: 'cane', name: '지팡이 신사', cost: 1, hp: 100, dps: 15, speed: 20, range: 16, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  // FR-6.5c 신규 로스터 — 스킬 이펙트에 맞춘 효과·가격 (2026-08-10 확정)
  { key: 'apprentice', name: '망치 견습공', cost: 35, hp: 110, dps: 16, speed: 20, range: 20, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'scissor', name: '가위 병사', cost: 60, hp: 120, dps: 20, speed: 20, range: 22, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'club', name: '종머리 곤봉병', cost: 70, hp: 140, dps: 18, speed: 20, range: 16, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'roundshield', name: '원형 방패병', cost: 80, hp: 200, dps: 8, speed: 20, range: 20, cleave: 1, antiAirPct: 0, block: 3, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'bricker', name: '벽돌 짐꾼', cost: 85, hp: 210, dps: 10, speed: 20, range: 22, cleave: 1, antiAirPct: 0, block: 2, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'shutter', name: '셔터 장교', cost: 90, hp: 190, dps: 9, speed: 20, range: 20, cleave: 1, antiAirPct: 0, block: 3, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'gasmask', name: '방독면 포수', cost: 95, hp: 85, dps: 16, speed: 20, range: 110, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'foreman', name: '망치 작업반장', cost: 110, hp: 240, dps: 12, speed: 20, range: 24, cleave: 2, antiAirPct: 0, block: 3, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'sniper', name: '저격수', cost: 120, hp: 70, dps: 22, speed: 20, range: 135, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
  { key: 'pistol', name: '권총 장교', cost: 60, hp: 80, dps: 14, speed: 20, range: 120, cleave: 1, antiAirPct: 0, block: 1, dmgType: 'physical', baseHealPerSec: 0, guardPct: 0, guardRadius: 0 },
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
  // 신규 로스터 자동 스킬 (skill-sprites 시트 연동): 근접 강타 / 탱커 방벽 강타 / 원거리 강화탄
  club: 9, scissor: 9, apprentice: 8, // 근접 — 전방 광역 강타
  foreman: 11, roundshield: 12, shutter: 12, bricker: 11, // 탱커 — 강타 + 자기 방어
  pistol: 9999, gasmask: 12, sniper: 12, // 원거리 — 강화탄 (권총 장교는 스킬 시트 없음)
};
/**
 * FR-6.7d 적 스킬 발동 — 아군과 동일하게 **교전 누적 후 시전**한다 (2026-08-10).
 * 적은 평타가 아니라 지속 피해(dps×dt)로 싸우므로, "교전한 시간"을 평타 횟수로 환산한다.
 * 아군 평타 주기가 0.8초이므로 교전 N초 = 평타 N/0.8회에 해당한다.
 * 원거리·전역형(포병·정찰기·보스)은 교전하지 않으므로 사거리 판정만으로 시전한다.
 */
export const ENEMY_SKILL_HITS: Record<string, number> = {
  grunt: 5, // 창 망령 — 교전 4.0초 (평타 5회분)
  shield: 6, // 방패 파쇄병 — 4.8초
  runner: 4, // 석궁 사수 — 3.2초 (사격형이라 빠름)
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

/**
 * FR-6.5c 스킬 수치표 — **스킬 이펙트(스프라이트 모션)와 일치하는 효과만** 정의한다.
 * 시각과 맞지 않는 원안 항목은 시각 쪽으로 맞춰 대체했다:
 *  - 작업반장 '공중 띄움' → 1D 전장이라 무의미 → 내리찍기에 어울리는 기절+둔화
 *  - 벽돌 짐꾼 '장애물 설치' → 모션이 '던지기'라 광역 투척 피해+둔화 (방벽 타워와 역할 중복도 해소)
 *  - 방독면 포수 '장판' → 착탄 광역 + 회복 차단(가스) 으로 축약 (지속 장판은 미구현 시스템)
 *  - 견습공 '마나 회수' → 자원 개념 없음 → 다음 스킬 쿨다운 단축
 *  - 권총 장교 '회피 무시' → 회피 스탯 없음 + 스킬 시트도 없음 → 로스터 제외
 */
export const UNIT_SKILL = {
  club: { mult: 1.2, maxTargets: 4, arc: 60, stun: 0.9, knock: 50 }, // 종울림 강타
  scissor: { mult: 0.8, hits: 2, bleedPct: 0.2, bleedDur: 4, armorCut: 0.25, cutDur: 4 }, // 십자 절단
  foreman: { mult: 1.5, maxTargets: 5, arc: 72, stun: 0.8, slowPct: 0.45, slowDur: 2, selfGuard: 4 }, // 작업 개시
  apprentice: { mult: 0.5, hits: 4, hitCut: 2 }, // 견습의 연타 (다음 시전 필요 타수 −2)
  gasmask: { mult: 0.8, splash: 55, slowPct: 0.2, slowDur: 5, healBlock: 5 }, // 독가스탄 (투사체)
  sniper: { mult: 2.2, pierceArmor: 0.5, chainPct: 0.6, maxTargets: 4 }, // 조준 관통 사격 (투사체)
  roundshield: { mult: 0.9, maxTargets: 3, knock: 140, selfGuard: 3 }, // 돌격 방패
  shutter: { mult: 0.6, maxTargets: 3, shieldPct: 0.25, shieldDur: 5, allies: 3 }, // 셔터 전개
  bricker: { mult: 1.1, maxTargets: 4, arc: 56, slowPct: 0.4, slowDur: 3 }, // 벽돌 투척
} as const;

/**
 * FR-6.5d 스킬 발동 조건 — **평타 N회 후 시전** (타이머 아님).
 * 유닛은 교전 중에만 평타를 치므로, 실제로 싸운 만큼만 스킬이 나간다.
 * 평타 주기는 0.8초이므로 N×0.8초가 최소 간격이 된다.
 */
export const UNIT_SKILL_HITS: Record<string, number> = {
  apprentice: 5, // 4.0초 — 가장 빠른 회전
  scissor: 7, // 5.6초
  club: 8, // 6.4초
  sniper: 8, // 6.4초
  gasmask: 8, // 6.4초
  foreman: 10, // 8.0초
  roundshield: 10,
  bricker: 10,
  shutter: 11, // 8.8초 — 보호막이라 가장 김
};

/** 평타 발사 프레임까지의 지연(초) — 공격 시트 5프레임 중 4번째(인덱스 3)에서 총구 화염이 터진다 (실측) */
export const ATTACK_CUE_S = 0.3;

/** 스킬 큐 프레임까지의 지연(초) — 이 시점에 판정·투사체가 나가야 모션과 맞는다 */
export const SKILL_CUE_S: Record<string, number> = {
  club: 0.27, scissor: 0.27, foreman: 0.27, apprentice: 0.09,
  gasmask: 0.27, sniper: 0.27, roundshield: 0.27, shutter: 0.27, bricker: 0.27,
  grunt: 0.27, shield: 0.27, runner: 0.27, tank: 0.27, air: 0.20, healer: 0.27, boss: 0.45,
};

/** FR-6.7c 적 스킬 수치표 (엔진 타입 기준 — 렌더 시트와 1:1) */
export const ENEMY_SKILL = {
  grunt: { mult: 1.1, pierceArmor: 0.3, targets: 2, chainPct: 0.7, selfHaste: 2 }, // 창 망령 관통 찌르기
  shield: { mult: 0.9, breakShield: true, markPct: 0.2, markDur: 5 }, // 방패 파쇄병 방패 부수기
  runner: { mult: 0.85, hits: 2, slowPct: 0.3, slowDur: 3 }, // 석궁 사수 삼연사
  tank: { mult: 0.8, spots: 2 }, // 다연장 포병 융단 포격
  air: { markPct: 0.12, markDur: 6 }, // 연 정찰기 표적 지정
  healer: { dpsBuff: 0.12, dur: 5, radius: 340, selfVuln: 0.2 }, // 확성기 드론 선동 방송
  boss: { mult: 0.8, targets: 2, stun: 0.5, markPct: 0.12, markDur: 3 }, // 번개 왕 낙뢰 심판
} as const;

/**
 * FR-6.5e 유닛 재소환 쿨다운(초) — 골드가 쌓여도 한 번에 쏟아붓지 못하게 한다.
 * 값이 셀수록 길다. 전역 간격(SPAWN_GLOBAL_CD)도 함께 걸려 동시 투입을 막는다.
 */
export const UNIT_SPAWN_CD: Record<string, number> = {
  apprentice: 1.0, // 견습공 — 소모품, 가장 빠른 회전
  scissor: 2.0,
  club: 2.5,
  roundshield: 3.0,
  bricker: 3.0,
  shutter: 3.5,
  gasmask: 3.5,
  foreman: 4.5,
  sniper: 5.0, // 저격수 — 최고 화력, 가장 김
};
export const SPAWN_GLOBAL_CD = 0.7; // 종류가 달라도 이 간격 안에는 연속 소환 불가

export const STUN_IMMUNE_S = 3; // 기절 종료 후 재기절 면역 (스턴락 방지)

/**
 * 총구/발사 지점 — 투사체가 캐릭터 중심이 아니라 무기 끝에서 나가도록.
 * fx = 전방 오프셋(필드 좌표, 엔진이 시작 x에 더함) / y = 지면 기준 높이(px, 렌더 전용)
 */
// 값은 발사 프레임(기본공격 attack[3] / 스킬 cueFrame)의 총구 화염 위치를 실측해 산출.
// 기본공격과 스킬은 시트 셀·앵커가 달라 총구도 다르므로 `키:skill`로 분리한다.
export const MUZZLE: Record<string, { fx: number; y: number }> = {
  sniper: { fx: 27, y: 56 }, // 저격총 — 어깨 견착, 장신이라 총구가 높다 (평타 발사 프레임 실측)
  'sniper:skill': { fx: 16, y: 35 }, // 관통탄 — 자세를 낮춰 조준
  gasmask: { fx: 16, y: 31 }, // 방독면 포수 — 포구를 앞으로 내밀고 발사 (실측)
  'gasmask:skill': { fx: 16, y: 22 }, // 강화탄 — 포구를 앞으로 내밀고 낮게
  pistol: { fx: 17, y: 47 }, // 권총 장교 — 가슴 높이 (스킬 없음, 실측)
  analyst: { fx: 9, y: 30 }, // (레거시) 애널리스트 활
  mage: { fx: 9, y: 34 }, // (레거시) 술사 오브
};

// 2026-08-10: 사옥 자동 포탑(BASE_TURRET) 제거 — 방어는 플레이어가 세운 포탑·유닛으로만 한다.

// 포탑 발사 모션의 섬광 프레임(f1) 시각 — 유닛 평타와 같이 모션 뒤에 투사체가 나가게 맞춘다
// turrets.json 실측: fire durationsMs [90,110,140,180] = 520ms, cueFrame 1(=90ms)에서 포구 섬광
export const TOWER_FIRE_CUE_S = 0.09;
export const TOWER_FIRE_ANIM_S = 0.52;

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
  // 확성기 드론 스프라이트를 쓰므로 실제로도 공중 유닛 (지상 판정이면 드론이 걸어 다닌다)
  healer: { key: 'healer', name: '리스크 헤지', icon: '➕', hpMult: 0.9, speedMult: 0.9, armor: 0, mr: 0.3, dpsMult: 0.5, healPerSec: 6, baseDmg: 8, isAir: true, size: 8, aumBounty: 3 },
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
  // 2026-08-10 후반 곡선 재조정: 지수 상승은 유지하되 상단을 아군 화력 도달권으로 낮춘다
  // (기존 W13 총 실효 12,849 HP = 아군 20초 화력의 4.4배 → 산술적으로 클리어 불가였음)
  { count: 2, hp: 45, speed: 1.0, air: false },
  { count: 3, hp: 52, speed: 1.0, air: false },
  { count: 3, hp: 62, speed: 1.0, air: true },
  { count: 4, hp: 75, speed: 1.0, air: false },
  { count: 5, hp: 92, speed: 1.0, air: true },
  { count: 6, hp: 112, speed: 1.0, air: false },
  { count: 7, hp: 135, speed: 1.05, air: true },
  { count: 8, hp: 160, speed: 1.05, air: true },
  { count: 9, hp: 190, speed: 1.05, air: false },
  { count: 11, hp: 215, speed: 1.1, air: true },
  { count: 12, hp: 240, speed: 1.1, air: true },
  { count: 14, hp: 265, speed: 1.1, air: true },
  { count: 16, hp: 290, speed: 1.15, air: true },
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
  R2: scaleWaves(R1_WAVES, 1.05, 1.12), // 2026-08-10 재조정 (1.25→1.12)
  R3: scaleWaves(R1_WAVES, 1.05, 1.22), // 2026-08-10 재조정 (1.5→1.18)
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
  { key: 'research', name: '리서치 데스크', desc: (lv) => `스테이지당 거래 ${[10, 15, 20][lv - 1]}회`, maxLv: 3, costs: [900, 2400] }, // FR-5.13
  { key: 'facility', name: '시설팀', desc: (lv) => `지면 포탑 슬롯 ${[1, 2, 3][lv - 1]}칸`, maxLv: 3, costs: [1100, 2800] }, // FR-6.4e
];

export const DEPT_EFFECTS = {
  towerDmgMult: (lv: number) => 1 + [0, 0.08, 0.16][lv - 1], // 합연산 (FR-11.3)
  unitHpMult: (lv: number) => 1 + [0, 0.1, 0.2][lv - 1],
  legalCut: (lv: number) => [0, 0.05, 0.1][lv - 1],
  irBonus: (lv: number) => [0, 0.05, 0.1][lv - 1],
  maxLeverage: (lv: number) => [1, 3, 5][lv - 1],
  maxPositions: (lv: number) => BALANCE.MAX_POSITIONS + (lv - 1) * BALANCE.POSITIONS_PER_DESK_LV,
  groundSlots: (lv: number) => [1, 2, 3][lv - 1], // FR-6.4e 시설팀 — 지면 슬롯 수
};

// FR-12.2b 튜토리얼 첫 거래 규칙 — 서버(진입 창 계산)와 클라(가이드 잠금)가 공유한다
export const TUT_HOLD_BARS = 26;    // 이 봉수를 채워야 청산 가능 (승리 보장 구간 길이)
export const TUT_MIN_ENTRY_BAR = 22; // 가이드 설명이 끝나는 시점
