// FR-6 전투 시뮬레이션 — 렌더러와 완전 분리된 순수 로직 (§11).
// 웹 클라이언트는 이 엔진의 상태를 그리기만 하고, 봇 시뮬레이터는 헤드리스로 돌린다.
//
// 심화 메커니즘 레퍼런스:
//  - Kingdom Rush: armor(물리 감소)/마법 관통 이분법, 공중은 특정 타워만 요격, 힐러 저격
//  - Bloons TD: 타워 타겟팅 모드 first/last/strong/close
//  - Age of War: 블로커+원거리 역할 조합, 본진 자동 포탑, 화면 클리어 스킬
import {
  BALANCE, BASE_TURRET, BOSS_WAVES, ENEMY_SKILL_PERIOD, ENEMY_SKILL, MUZZLE, STUN_IMMUNE_S, UNIT_SKILL, ENEMY_TYPES, TOWERS, UNITS, UNIT_SKILL_PERIOD, WAVE_COMPS,
  type DmgType, type EnemyTypeSpec, type TargetingMode, type TowerSpec, type UnitSpec,
} from './balance.js';
import type { MarketEvent, RegionId, StageParams } from './types.js';

export const FIELD_W = 1000;
const PLAYER_BASE_X = 0;
const ENEMY_BASE_X = FIELD_W;
const UNIT_SPAWN_X = 70;
const SIM_DT = 0.05;
const HEAL_RADIUS = 120;
const PROJ_HIT_DIST = 12;

export interface Enemy {
  id: number;
  type: EnemyTypeSpec['key'];
  x: number;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  dps: number;
  armor: number;
  mr: number;
  air: boolean;
  size: number;
  wave: number;
  baseDmg: number;
  healPerSec: number;
  slowUntil: number;
  slowPct: number;
  stunUntil: number;
  leaked: boolean; // 본진 도달로 소멸 (처치 아님 → AUM 보상 없음)
  nextSkillAt: number; // FR-6.7b 자동 스킬 다음 시전 시각
  lastSkillAt: number; // 최근 시전 시각 (렌더 재생 기준)
  shieldUntil: number; // 실드베어러 육각 실드 — 받는 피해 −70% 만료 시각
  hasteUntil: number; // 러너 질주·탱커 독려 — 이속 ×1.5 만료 시각
  armorCutUntil: number; // 취약 — 방어 감소 만료 (가위 절단)
  armorCutPct: number;
  dotUntil: number; // 출혈 — 지속 피해 만료
  dotDps: number;
  healBlockUntil: number; // 독가스 — 회복 차단 만료
  knockUntil: number; // 넉백 슬라이드 (곤봉·방패 돌격)
  knockFrom: number;
  knockTo: number;
  stunImmuneUntil: number; // 재기절 면역 (스턴락 방지)
  dpsBuffUntil: number; // 확성기 선동 — 공격력 버프 만료
  dpsBuffPct: number;
  vulnUntil: number; // 자신이 받는 피해 증가 (방송 중 드론)
  vulnPct: number;
}

export interface Unit {
  id: number;
  key: UnitSpec['key'];
  x: number;
  hp: number;
  maxHp: number;
  spec: UnitSpec;
  shotCd: number;
  nextSkillAt: number; // FR-6.5b 자동 스킬 다음 시전 시각
  lastSkillAt: number; // 최근 시전 시각 (렌더 skill 모션·VFX 재생 기준)
  shieldUntil: number; // 인턴 원금 보장 — 받는 피해 −60% 만료 시각
  knockUntil: number; // FR-6.10b 충격파 넉백 종료 시각 (이 동안 이동·공격 불가)
  knockFrom: number; // 넉백 시작 x
  knockTo: number; // 넉백 목표 x
  stunUntil: number; // 적 스킬 기절 (번개 왕 등)
  stunImmuneUntil: number;
  slowUntil: number; // 적 스킬 둔화 (석궁 삼연사)
  slowPct: number;
  absorb: number; // 셔터 보호막 잔량
  absorbUntil: number;
  markUntil: number; // 표식 — 받는 피해 증가 만료
  markPct: number;
}

export interface Tower {
  slot: number;
  key: TowerSpec['key'];
  lv: 1 | 2;
  cooldown: number;
  mode: TargetingMode;
  lastTargetX: number | null;
  hp: number; // 손절 방벽 잔여 내구 (비방벽 0)
  maxHp: number;
  nextIncomeAt: number; // 배당 파밍 다음 지급 시각 (비파밍 Infinity)
  lastTargetId: number | null; // 복리 화염: 직전 사격 대상 (같은 대상 연속 명중 추적)
  rampN: number; // 복리 화염: 연속 명중 수
}

export interface Projectile {
  id: number;
  x: number;
  targetId: number;
  air: boolean; // 목표 레인 (렌더용)
  fromTower: boolean;
  speed: number;
  dmg: number;
  dmgType: DmgType;
  splashRadius: number;
  slowPct: number;
  slowDur: number;
  srcKey?: string; // 발사 주체 키 (렌더가 총구 높이를 찾는 데 사용)
}

export interface Fx {
  kind: 'dmg' | 'death' | 'heal' | 'stun' | 'skill' | 'aum' | 'gold';
  x: number;
  air: boolean;
  amount: number;
  t: number; // 발생 시각 (battle.t)
}

interface WaveMod {
  countMult: number;
  speedMult: number;
  allyAtkMult: number;
  enemyHpMult: number;
  event: MarketEvent | null;
}

interface PendingSpawn {
  at: number;
  wave: number;
  type: EnemyTypeSpec['key'];
  hp: number;
  speed: number;
}

// [임시] 신규 시트 로스터 역할군 — 자동 스킬 분기용
const SHEET_MELEE = new Set(['club', 'scissor', 'apprentice']);
const SHEET_TANK = new Set(['foreman', 'roundshield', 'shutter', 'bricker']);
const SHEET_RANGED = new Set(['gasmask', 'sniper']);

export type BattlePhase = 'prep' | 'wave' | 'overtime' | 'done';

export class Battle {
  readonly params: StageParams;
  gold = 0;
  goldEarned = 0;
  goldSpent = 0;
  aumEarned = 0; // 적 처치로 획득한 AUM 누적 (서버가 상한 clamp 후 크레딧)
  baseHP: number = BALANCE.BASE_HP;
  enemyBaseHP: number = BALANCE.ENEMY_BASE_HP;
  enemyBaseDestroyed = false;
  towers: (Tower | null)[];
  units: Unit[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  fx: Fx[] = [];
  waveIdx = 0;
  phase: BattlePhase = 'prep';
  skillReadyAt = 0;
  baseTurretCd = 0;
  rageStage = 0; // FR-6.10b 적 본진 위기 반격 (0 → 40% 돌파 시 1 → 20% 돌파 시 2)
  rageAt = -9; // 최근 반격 발동 시각 (충격파 연출 기준)
  victory = false;
  t = 0;
  activeEvent: MarketEvent | null = null;

  private waveMods: WaveMod[];
  private pending: PendingSpawn[] = [];
  private incomeGranted = new Set<number>();
  private spawnedWaves = new Set<number>();
  private nextId = 1;
  private stageEndT: number;

  constructor(params: StageParams, events: MarketEvent[]) {
    this.params = params;
    this.towers = new Array(params.towerSlots).fill(null);
    this.stageEndT = params.waveCount * BALANCE.CYCLE_SECONDS;

    // FR-7: 이벤트는 "다음 웨이브"에 적용. 같은 웨이브 중복 시 나중 것이 대체 (FR-7.4)
    this.waveMods = Array.from({ length: params.waveCount + 1 }, () => ({
      countMult: 1, speedMult: 1, allyAtkMult: 1, enemyHpMult: 1, event: null,
    }));
    for (const ev of events) {
      const targetWave = Math.floor(ev.t / BALANCE.CYCLE_SECONDS) + 2;
      if (targetWave < 1 || targetWave > params.waveCount) continue;
      const mod = this.waveMods[targetWave];
      mod.countMult = 1; mod.speedMult = 1; mod.allyAtkMult = 1; mod.enemyHpMult = 1;
      if (ev.type === 'panic_sell') {
        mod.countMult = BALANCE.PANIC_COUNT_MULT;
        mod.speedMult = BALANCE.PANIC_SPEED_MULT;
      } else {
        mod.allyAtkMult = BALANCE.FOMO_ALLY_ATK_MULT;
        mod.enemyHpMult = BALANCE.FOMO_ENEMY_HP_MULT;
      }
      mod.event = ev;
    }
  }

  // ─── 외부 입력 ───
  addGold(amount: number) {
    this.gold += amount;
    this.goldEarned += amount;
  }

  private spend(cost: number): boolean {
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.goldSpent += cost;
    return true;
  }

  buildTower(slot: number, key: TowerSpec['key']): boolean {
    if (slot < 0 || slot >= this.towers.length || this.towers[slot]) return false;
    const spec = TOWERS.find((s) => s.key === key)!;
    if (!this.spend(spec.cost)) return false;
    this.towers[slot] = {
      slot, key, lv: 1, cooldown: 0, mode: 'first', lastTargetX: null, lastTargetId: null, rampN: 0,
      hp: spec.barrierHP, maxHp: spec.barrierHP,
      nextIncomeAt: spec.incomeAmount > 0 ? this.t + spec.incomePeriod : Infinity,
    };
    return true;
  }

  upgradeTower(slot: number): boolean {
    const tw = this.towers[slot];
    if (!tw || tw.lv >= 2) return false;
    const spec = TOWERS.find((s) => s.key === tw.key)!;
    if (!this.spend(spec.upgradeCost)) return false;
    tw.lv = 2;
    if (spec.barrierHP > 0) { // 방벽 업그레이드 = 내구 강화 + 완전 수리
      tw.maxHp = Math.round(spec.barrierHP * spec.lv2Mult);
      tw.hp = tw.maxHp;
    }
    return true;
  }

  /** Bloons식 타겟팅 모드 순환: first → last → strong → close */
  cycleTargeting(slot: number): TargetingMode | null {
    const tw = this.towers[slot];
    if (!tw) return null;
    const modes: TargetingMode[] = ['first', 'last', 'strong', 'close'];
    tw.mode = modes[(modes.indexOf(tw.mode) + 1) % modes.length];
    return tw.mode;
  }

  unitCost(key: UnitSpec['key']): number {
    const spec = UNITS.find((s) => s.key === key)!;
    return Math.floor(spec.cost * this.params.unitCostMult);
  }

  spawnUnit(key: UnitSpec['key']): boolean {
    const spec = UNITS.find((s) => s.key === key)!;
    if (!this.spend(this.unitCost(key))) return false;
    const hp = Math.round(spec.hp * this.params.unitHpMult);
    this.units.push({
      id: this.nextId++, key, x: UNIT_SPAWN_X, hp, maxHp: hp, spec, shotCd: 0,
      nextSkillAt: this.t + UNIT_SKILL_PERIOD[key], lastSkillAt: -9, shieldUntil: 0,
      knockUntil: 0, knockFrom: 0, knockTo: 0,
      stunUntil: 0, stunImmuneUntil: 0, slowUntil: 0, slowPct: 0,
      absorb: 0, absorbUntil: 0, markUntil: 0, markPct: 0,
    });
    return true;
  }

  useSkill(): boolean {
    if (this.t < this.skillReadyAt) return false;
    if (!this.spend(BALANCE.SKILL_COST)) return false;
    this.skillReadyAt = this.t + BALANCE.SKILL_COOLDOWN_S;
    // 공시폭탄: 마법 광역 + 스턴 (armor 관통, mr에만 감소)
    for (const e of this.enemies) {
      if (e.air) continue;
      this.damage(e, BALANCE.SKILL_DAMAGE, 'magic');
      e.stunUntil = Math.max(e.stunUntil, this.t + 1.2);
      this.pushFx('stun', e.x, false, 0);
    }
    this.pushFx('skill', 500, false, 0);
    this.enemies = this.enemies.filter((e) => this.aliveOrDeathFx(e));
    return true;
  }

  towerSlotX(slot: number): number {
    // 일자형 TD 관례: 기지 주변(90~365)에 밀집 배치 — 사옥 앞 방어선을 이룬다
    return 90 + slot * 55;
  }

  /** 준비 페이즈 UI용: 다음 웨이브 조합 미리보기 */
  previewWave(w: number): { type: EnemyTypeSpec['key']; count: number }[] {
    if (w < 1 || w > this.params.waveCount) return [];
    const list = this.compose(w);
    const agg = new Map<EnemyTypeSpec['key'], number>();
    for (const t of list) agg.set(t, (agg.get(t) ?? 0) + 1);
    if (BOSS_WAVES[this.params.regionId].includes(w)) agg.set('boss', 1);
    return [...agg.entries()].map(([type, count]) => ({ type, count }));
  }

  // ─── 내부 ───
  private pushFx(kind: Fx['kind'], x: number, air: boolean, amount: number) {
    this.fx.push({ kind, x, air, amount, t: this.t });
    if (this.fx.length > 90) this.fx.splice(0, this.fx.length - 90);
  }

  /** 피해 적용 — Kingdom Rush식: 물리는 armor, 마법은 mr에만 감소 */
  private damage(e: Enemy, raw: number, type: DmgType, pierceArmor = 0) {
    if (this.t < e.shieldUntil) raw *= 0.3; // FR-6.7b 육각 실드 — 받는 피해 −70%
    if (this.t < e.vulnUntil) raw *= 1 + e.vulnPct; // 방송 중 드론 등 자기 취약
    const cut = this.t < e.armorCutUntil ? e.armorCutPct : 0; // 취약(방어 감소) — 합산 40% 상한
    const armor = Math.max(0, e.armor * (1 - Math.min(cut + pierceArmor, 0.9)));
    const mult = type === 'physical' ? 1 - armor : 1 - e.mr;
    const dealt = raw * mult;
    e.hp -= dealt;
    if (dealt >= 1) this.pushFx('dmg', e.x, e.air, Math.round(dealt));
  }

  private aliveOrDeathFx(e: Enemy): boolean {
    if (e.hp > 0) return true;
    this.pushFx('death', e.x, e.air, 0);
    if (!e.leaked) { // 처치 보상: 트레이딩 자본(AUM) 회복
      const bounty = ENEMY_TYPES[e.type].aumBounty;
      this.aumEarned += bounty;
      this.pushFx('aum', e.x, e.air, bounty);
    }
    return false;
  }

  /** 웨이브 총 수를 조합 비율로 분배 (최대 잔여 방식 — 총합 보존) */
  private compose(w: number): EnemyTypeSpec['key'][] {
    const spec = this.params.waveTable[w - 1];
    const mod = this.waveMods[w];
    const total = Math.ceil(spec.count * this.params.heat * mod.countMult);
    const ratios = WAVE_COMPS[this.params.regionId][w - 1] ?? { grunt: 1 };
    const entries = Object.entries(ratios) as [EnemyTypeSpec['key'], number][];
    const rsum = entries.reduce((s, [, r]) => s + r, 0);
    const counts = entries.map(([type, r]) => ({ type, exact: (total * r) / rsum, n: Math.floor((total * r) / rsum) }));
    let left = total - counts.reduce((s, c) => s + c.n, 0);
    counts.sort((a, b) => (b.exact - b.n) - (a.exact - a.n));
    for (let i = 0; left > 0; i = (i + 1) % counts.length, left--) counts[i].n += 1;
    // 라운드로빈 섞기 (러너·탱커가 스트림에 섞여 나오도록)
    const out: EnemyTypeSpec['key'][] = [];
    const queues = counts.map((c) => ({ type: c.type, n: c.n }));
    while (out.length < total) {
      for (const q of queues) if (q.n > 0) { out.push(q.type); q.n -= 1; }
    }
    return out;
  }

  /** FR-6.10b: 적 본진이 위기에 몰리면 정예 반격 분대 투입 (조기 파괴 러시 견제) */
  private checkRage() {
    if (this.params.regionId === 'TUT' || this.phase === 'done') return;
    if (this.t >= this.stageEndT) return; // 오버타임(13웨이브 생존 확정 후) 마무리 러시엔 발동하지 않는다
    const rate = this.enemyBaseHP / BALANCE.ENEMY_BASE_HP;
    if (this.rageStage < 1 && rate <= 0.4) { this.rageStage = 1; this.rageAt = this.t; this.spawnRageSquad(1); this.rageShockwave(); }
    if (this.rageStage < 2 && rate <= 0.2) { this.rageStage = 2; this.rageAt = this.t; this.spawnRageSquad(2); this.rageShockwave(); }
  }

  /** FR-6.10b 충격파: 적 본진 앞까지 밀고 온 아군을 중원(RAGE_PUSH_TO_X)까지 밀어낸다 */
  private rageShockwave() {
    const to = BALANCE.RAGE_PUSH_TO_X;
    for (const u of this.units) {
      if (u.x <= to) continue;
      u.knockFrom = u.x;
      u.knockTo = to - (u.id % 5) * 12; // 겹침 방지 — 결정론적 분산
      u.knockUntil = this.t + BALANCE.RAGE_PUSH_SECONDS;
    }
  }

  private spawnRageSquad(stage: 1 | 2) {
    // 유닛이 자동 전진하며 본진을 갉아먹는 구조라 사실상 매 판 발동 — 과하면 전 지역 클리어 불능 (봇심 검증)
    // 러시(=이길 뻔한 판)만 발동하는 구조라 과하면 승리 경로가 통째로 막힌다 — 봇심으로 검증된 경량 구성
    const comps: EnemyTypeSpec['key'][] = stage === 1
      ? ['tank', 'shield', 'runner', 'air']
      : ['tank', 'shield', 'healer', 'air', 'runner'];
    const w = Math.min(Math.max(this.waveIdx, 1), this.params.waveTable.length);
    const hpW = Math.min(w, 6); // 체력 기준 웨이브 상한 — 후반 발동 시 지수 체력이 그대로 실리면 클리어 불능 (봇심 검증)
    const spec = this.params.waveTable[hpW - 1];
    const eliteMult = (stage === 1 ? 0.95 : 1.1) * BALANCE.ENEMY_HP_MULT;
    comps.forEach((type, i) => {
      const et = ENEMY_TYPES[type];
      this.pending.push({
        at: this.t + 0.6 * i, wave: w, type,
        hp: spec.hp * eliteMult * this.params.heat * et.hpMult,
        speed: 15 * spec.speed * et.speedMult * 1.1,
      });
    });
    this.pending.sort((a, b) => a.at - b.at);
  }

  private scheduleWave(w: number) {
    const spec = this.params.waveTable[w - 1];
    const mod = this.waveMods[w];
    const types = this.compose(w);
    const interval = BALANCE.WAVE_SECONDS / types.length;
    const waveStart = (w - 1) * BALANCE.CYCLE_SECONDS + BALANCE.PREP_SECONDS;
    const buff = this.params.regionId === 'TUT' ? 1 : BALANCE.ENEMY_HP_MULT; // 튜토리얼은 난이도 상향 제외
    types.forEach((type, i) => {
      const et = ENEMY_TYPES[type];
      this.pending.push({
        at: waveStart + i * interval, wave: w, type,
        hp: spec.hp * buff * this.params.heat * mod.enemyHpMult * et.hpMult,
        speed: 15 * spec.speed * mod.speedMult * et.speedMult, // 2026-08-05 이동속도 절반 (아군과 동일 하향)
      });
    });
    if (BOSS_WAVES[this.params.regionId].includes(w)) {
      const et = ENEMY_TYPES.boss;
      this.pending.push({
        at: waveStart + 2, wave: w, type: 'boss',
        hp: spec.hp * buff * this.params.heat * mod.enemyHpMult * et.hpMult,
        speed: 15 * spec.speed * et.speedMult,
      });
    }
    this.pending.sort((a, b) => a.at - b.at);
  }

  private spawn(p: PendingSpawn) {
    const et = ENEMY_TYPES[p.type];
    this.enemies.push({
      id: this.nextId++, type: p.type, x: ENEMY_BASE_X - 10,
      hp: p.hp, maxHp: p.hp, baseSpeed: p.speed,
      // 2026-08-10: 적 공격력 성장 완화 (1.2→0.6). 아군 유닛 체력은 고정인데 적 dps만 웨이브에 비례해
      // 커져 후반에 전열이 통째로 녹았다 — 물량·체력(웨이브 표)으로 난이도를 주고 개체 화력은 완만하게.
      dps: (6 + p.wave * 0.6) * et.dpsMult * (this.params.regionId === 'TUT' ? 1 : BALANCE.ENEMY_DPS_MULT),
      armor: et.armor, mr: et.mr, air: et.isAir, size: et.size,
      wave: p.wave, baseDmg: et.baseDmg, healPerSec: et.healPerSec,
      slowUntil: 0, slowPct: 0, stunUntil: 0, leaked: false,
      nextSkillAt: this.t + ENEMY_SKILL_PERIOD[p.type], lastSkillAt: -9, shieldUntil: 0, hasteUntil: 0,
      armorCutUntil: 0, armorCutPct: 0, dotUntil: 0, dotDps: 0, healBlockUntil: 0,
      knockUntil: 0, knockFrom: 0, knockTo: 0, stunImmuneUntil: 0,
      dpsBuffUntil: 0, dpsBuffPct: 0, vulnUntil: 0, vulnPct: 0,
    });
  }


  /** 기절 부여 (재기절 면역 적용 — 스턴락 방지) */
  private applyStun(e: Enemy, dur: number) {
    if (this.t < e.stunImmuneUntil) return;
    e.stunUntil = this.t + dur;
    e.stunImmuneUntil = e.stunUntil + STUN_IMMUNE_S;
    this.pushFx('stun', e.x, e.air, 0);
  }

  /** 적 넉백 — 뒤(적 본진 쪽)로 밀어낸다 */
  private applyKnock(e: Enemy, px: number) {
    if (e.air) return; // 공중은 밀리지 않는다
    e.knockFrom = e.x;
    e.knockTo = Math.min(ENEMY_BASE_X - 4, e.x + px / 1.8); // px → 필드 좌표
    e.knockUntil = this.t + 0.35;
  }

  /** 아군 피격 — 보호막 흡수 → 표식 증폭 → 가드 순 */
  private damageUnit(u: Unit, raw: number) {
    let dmg = raw;
    if (this.t < u.markUntil) dmg *= 1 + u.markPct;
    if (this.t < u.shieldUntil) dmg *= 0.4;
    if (this.t < u.absorbUntil && u.absorb > 0) { // 셔터 보호막 흡수
      const used = Math.min(u.absorb, dmg);
      u.absorb -= used;
      dmg -= used;
    }
    u.hp -= dmg;
  }

  /** FR-6.5b 유닛 자동 스킬 — 주기마다 조건 충족 시 시전 (대상 없으면 1.5초 후 재시도) */
  private castUnitSkills(atkMult: number) {
    const t = this.t;
    for (const u of this.units) {
      if (t < u.nextSkillAt) continue;
      const inRange = (r: number) =>
        this.enemies.filter((e) => e.hp > 0 && e.x >= u.x - 6 && e.x - u.x <= r && (!e.air || u.spec.antiAirPct > 0));
      let cast = false;
      if (u.key === 'intern') { // 원금 보장 — 교전 중일 때만
        if (this.enemies.some((e) => !e.air && e.hp > 0 && e.x - u.x >= -6 && e.x - u.x <= 30)) {
          u.shieldUntil = t + 3;
          cast = true;
        }
      } else if (u.key === 'trader') { // 복리 참격 — 주변 지상 광역
        const ts = this.enemies.filter((e) => !e.air && e.hp > 0 && Math.abs(e.x - u.x) <= 60);
        if (ts.length) {
          for (const e of ts) this.damage(e, u.spec.dps * 2.5 * atkMult, 'physical');
          cast = true;
        }
      } else if (u.key === 'analyst') { // 화살 세례 — 최대 4기 다중 사격
        const ts = inRange(u.spec.range).slice(0, 4);
        if (ts.length) {
          for (const e of ts) {
            this.fireProjectile(u.x, e, u.spec.dps * 1.2 * atkMult * (e.air ? u.spec.antiAirPct : 1),
              { dmgType: 'physical', projSpeed: 560, splashRadius: 0, slowPct: 0, slowDur: 0 }, false, u.key);
          }
          cast = true;
        }
      } else if (u.key === 'lancer') { // 리밸런싱 — 확장 사거리 전원 관통 (2기 이상일 때)
        const ts = this.enemies.filter((e) => !e.air && e.hp > 0 && e.x >= u.x - 6 && e.x - u.x <= u.spec.range + 36);
        if (ts.length >= 2) {
          for (const e of ts) this.damage(e, u.spec.dps * 1.8 * atkMult, 'physical');
          cast = true;
        }
      } else if (u.key === 'mage') { // 레버리지 오브 — 마법 광역탄
        const ts = inRange(u.spec.range);
        if (ts.length) {
          this.fireProjectile(u.x, ts[0], u.spec.dps * 2.2 * atkMult,
            { dmgType: 'magic', projSpeed: 480, splashRadius: 70, slowPct: 0, slowDur: 0 }, false, u.key);
          cast = true;
        }
      } else if (u.key === 'riskmgr') { // 헤지 커버 — 사옥 즉시 회복 버스트
        this.baseHP = Math.min(BALANCE.BASE_HP, this.baseHP + 3);
        cast = true;
      } else if (UNIT_SKILL[u.key as keyof typeof UNIT_SKILL]) {
        cast = this.castSheetSkill(u, atkMult);
      }
      if (cast) {
        u.lastSkillAt = t;
        u.nextSkillAt = t + UNIT_SKILL_PERIOD[u.key];
      } else {
        u.nextSkillAt = t + 1.5;
      }
    }
  }


  /** FR-6.5c 신규 로스터 스킬 — 각 스프라이트 모션에 대응하는 효과 */
  private castSheetSkill(u: Unit, atkMult: number): boolean {
    const t = this.t;
    const S = UNIT_SKILL[u.key as keyof typeof UNIT_SKILL] as Record<string, number | boolean>;
    const base = u.spec.dps * atkMult;
    const ground = (reach: number, n: number) => this.enemies
      .filter((e) => !e.air && e.hp > 0 && e.x - u.x >= -10 && e.x - u.x <= reach)
      .sort((a, b) => a.x - b.x).slice(0, n);

    switch (u.key) {
      case 'club': { // 종울림 강타 — 전방 부채꼴 광역 + 기절 + 소폭 넉백
        const ts = ground(S.arc as number, S.maxTargets as number);
        if (!ts.length) return false;
        for (const e of ts) {
          this.damage(e, base * (S.mult as number), 'physical');
          this.applyStun(e, S.stun as number);
          this.applyKnock(e, S.knock as number);
        }
        return true;
      }
      case 'foreman': { // 작업 개시 — 내리찍기 광역 + 기절 + 둔화, 자신 방어
        const ts = ground(S.arc as number, S.maxTargets as number);
        if (!ts.length) return false;
        for (const e of ts) {
          this.damage(e, base * (S.mult as number), 'physical');
          this.applyStun(e, S.stun as number);
          e.slowUntil = t + (S.slowDur as number);
          e.slowPct = Math.max(e.slowPct, S.slowPct as number);
        }
        u.shieldUntil = t + (S.selfGuard as number);
        return true;
      }
      case 'bricker': { // 벽돌 투척 — 광역 피해 + 파편 둔화
        const ts = ground(S.arc as number, S.maxTargets as number);
        if (!ts.length) return false;
        for (const e of ts) {
          this.damage(e, base * (S.mult as number), 'physical');
          e.slowUntil = t + (S.slowDur as number);
          e.slowPct = Math.max(e.slowPct, S.slowPct as number);
        }
        return true;
      }
      case 'roundshield': { // 돌격 방패 — 밀어내기 + 자신 피해 감소
        const ts = ground(52, S.maxTargets as number);
        if (!ts.length) return false;
        for (const e of ts) {
          this.damage(e, base * (S.mult as number), 'physical');
          this.applyKnock(e, S.knock as number);
        }
        u.shieldUntil = t + (S.selfGuard as number);
        return true;
      }
      case 'scissor': { // 십자 절단 — 단일 2회 + 출혈 + 취약
        const ts = ground(30, 1);
        if (!ts.length) return false;
        const e = ts[0];
        for (let i = 0; i < (S.hits as number); i++) this.damage(e, base * (S.mult as number), 'physical');
        e.dotUntil = t + (S.bleedDur as number);
        e.dotDps = base * (S.bleedPct as number);
        e.armorCutUntil = t + (S.cutDur as number);
        e.armorCutPct = Math.max(e.armorCutPct, S.armorCut as number);
        return true;
      }
      case 'apprentice': { // 견습의 연타 — 빠른 4연타 + 다음 쿨 단축
        const ts = ground(30, 1);
        if (!ts.length) return false;
        for (let i = 0; i < (S.hits as number); i++) this.damage(ts[0], base * (S.mult as number), 'physical');
        u.nextSkillAt = t + UNIT_SKILL_PERIOD[u.key] - (S.cdCut as number);
        this.pushFx('skill', u.x, false, 0);
        return true;
      }
      case 'gasmask': { // 독가스탄 — 착탄 광역 + 둔화 + 회복 차단
        const inR = this.enemies.filter((e) => e.hp > 0 && e.x >= u.x - 10 && e.x - u.x <= u.spec.range);
        if (!inR.length) return false;
        const cx = inR.sort((a, b) => a.x - b.x)[0].x;
        for (const e of this.enemies) {
          if (e.hp <= 0 || Math.abs(e.x - cx) > (S.splash as number)) continue;
          this.damage(e, base * (S.mult as number), 'physical');
          e.slowUntil = t + (S.slowDur as number);
          e.slowPct = Math.max(e.slowPct, S.slowPct as number);
          e.healBlockUntil = t + (S.healBlock as number);
        }
        return true;
      }
      case 'sniper': { // 조준 관통 사격 — 경로 관통, 첫 대상 최대 피해
        const line = this.enemies
          .filter((e) => e.hp > 0 && e.x >= u.x - 10 && e.x - u.x <= u.spec.range && (!e.air || u.spec.antiAirPct > 0))
          .sort((a, b) => a.x - b.x).slice(0, S.maxTargets as number);
        if (!line.length) return false;
        line.forEach((e, i) => {
          const f = i === 0 ? 1 : Math.pow(S.chainPct as number, i);
          this.damage(e, base * (S.mult as number) * f, 'physical', S.pierceArmor as number);
        });
        return true;
      }
      case 'shutter': { // 셔터 전개 — 전열 아군 보호막 + 닿은 적 타격
        const front = [...this.units].sort((a, b) => b.x - a.x).slice(0, S.allies as number);
        if (!front.length) return false;
        for (const a of front) {
          a.absorb = Math.max(a.absorb, Math.round(a.maxHp * (S.shieldPct as number)));
          a.absorbUntil = t + (S.shieldDur as number);
          a.stunUntil = 0; // 둔화·기절 1회 정화
          a.slowUntil = 0;
        }
        for (const e of ground(46, S.maxTargets as number)) this.damage(e, base * (S.mult as number), 'physical');
        this.pushFx('heal', u.x, false, 0);
        return true;
      }
      default: return false;
    }
  }

  /** FR-6.7b 적 자동 스킬 — 유형별 주기 시전 (스턴 중 불가) */
  private castEnemySkills() {
    const t = this.t;
    for (const e of this.enemies) {
      if (e.hp <= 0 || t < e.stunUntil || t < (e.nextSkillAt ?? Infinity)) continue;
      let cast = false;
      const ES = ENEMY_SKILL[e.type] as Record<string, number | boolean>;
      const nearUnits = (reach: number) => this.units
        .filter((u) => e.x - u.x >= -10 && e.x - u.x <= reach && u.hp > 0)
        .sort((a, b) => b.x - a.x);
      if (e.type === 'grunt') { // 창 망령 — 관통 찌르기 (앞의 2명, 방어 무시)
        const ts = nearUnits(46).slice(0, ES.targets as number);
        if (ts.length) {
          ts.forEach((u, i) => this.damageUnit(u, e.dps * (ES.mult as number) * (i === 0 ? 1 : (ES.chainPct as number))));
          e.hasteUntil = t + (ES.selfHaste as number);
          cast = true;
        }
      } else if (e.type === 'shield') { // 방패 파쇄병 — 보호막 파괴 + 취약
        const ts = nearUnits(40);
        const target = ts.find((u) => u.absorb > 0 && t < u.absorbUntil) ?? ts[0];
        if (target) {
          target.absorb = 0;
          target.markUntil = t + (ES.markDur as number);
          target.markPct = Math.max(target.markPct, ES.markPct as number);
          this.damageUnit(target, e.dps * (ES.mult as number));
          cast = true;
        }
      } else if (e.type === 'runner') { // 석궁 사수 — 삼연사 + 둔화
        const ts = nearUnits(120);
        if (ts.length) {
          for (let i = 0; i < (ES.hits as number); i++) this.damageUnit(ts[0], e.dps * (ES.mult as number));
          if (ts[1]) this.damageUnit(ts[1], e.dps * (ES.mult as number) * 0.5);
          ts[0].slowUntil = t + (ES.slowDur as number);
          ts[0].slowPct = Math.max(ts[0].slowPct, ES.slowPct as number);
          cast = true;
        }
      } else if (e.type === 'tank') { // 다연장 포병 — 다지점 융단 포격
        const ts = [...this.units].sort((a, b) => b.x - a.x).slice(0, ES.spots as number);
        if (ts.length) {
          for (const u of ts) this.damageUnit(u, e.dps * (ES.mult as number));
          cast = true;
        }
      } else if (e.type === 'air') { // 연 정찰기 — 체력 최저 아군에 표식
        const target = [...this.units].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (target) {
          target.markUntil = t + (ES.markDur as number);
          target.markPct = Math.max(target.markPct, ES.markPct as number);
          cast = true;
        }
      } else if (e.type === 'healer') { // 확성기 드론 — 주변 적 공격력 버프 (자신은 취약)
        const buffed = this.enemies.filter((o) => o.hp > 0 && Math.abs(o.x - e.x) <= (ES.radius as number) / 1.8);
        for (const o of buffed) {
          o.dpsBuffUntil = t + (ES.dur as number);
          o.dpsBuffPct = ES.dpsBuff as number;
          o.slowUntil = 0; // 둔화 1회 정화
        }
        e.vulnUntil = t + (ES.dur as number);
        e.vulnPct = ES.selfVuln as number;
        this.pushFx('heal', e.x, e.air, 0);
        cast = buffed.length > 0;
      } else if (e.type === 'boss') { // 번개 왕 — 다지점 낙뢰 (기절 + 표식)
        const ts = [...this.units].sort((a, b) => b.x - a.x).slice(0, ES.targets as number);
        if (ts.length) {
          for (const u of ts) {
            this.damageUnit(u, e.dps * (ES.mult as number));
            if (t >= u.stunImmuneUntil) {
              u.stunUntil = t + (ES.stun as number);
              u.stunImmuneUntil = u.stunUntil + STUN_IMMUNE_S;
            }
            u.markUntil = t + (ES.markDur as number);
            u.markPct = Math.max(u.markPct, ES.markPct as number);
          }
          cast = true;
        }
      }
      if (cast) {
        e.lastSkillAt = t;
        e.nextSkillAt = t + ENEMY_SKILL_PERIOD[e.type];
      } else {
        e.nextSkillAt = t + 1.5;
      }
    }
  }

  private enemySpeed(e: Enemy): number {
    return e.baseSpeed * (this.t < e.slowUntil ? 1 - e.slowPct : 1) * (this.t < e.hasteUntil ? 1.5 : 1); // 질주·독려
  }

  private fireProjectile(fromX: number, target: Enemy, dmg: number, spec: { dmgType: DmgType; projSpeed: number; splashRadius: number; slowPct: number; slowDur: number }, fromTower: boolean, srcKey?: string) {
    // 무기 끝에서 나가도록 전방 오프셋 적용 (총구 위치 — MUZZLE)
    const fx = srcKey ? (MUZZLE[srcKey]?.fx ?? 0) : 0;
    this.projectiles.push({
      id: this.nextId++, x: fromX + fx, targetId: target.id, air: target.air, fromTower,
      speed: spec.projSpeed, dmg, dmgType: spec.dmgType,
      splashRadius: spec.splashRadius, slowPct: spec.slowPct, slowDur: spec.slowDur, srcKey,
    });
  }

  private pickTarget(candidates: Enemy[], mode: TargetingMode, towerX: number): Enemy | undefined {
    if (!candidates.length) return undefined;
    switch (mode) {
      case 'first': return candidates.reduce((a, b) => (a.x < b.x ? a : b)); // 본진에 가장 가까운
      case 'last': return candidates.reduce((a, b) => (a.x > b.x ? a : b));
      case 'strong': return candidates.reduce((a, b) => (a.hp > b.hp ? a : b));
      case 'close': return candidates.reduce((a, b) => (Math.abs(a.x - towerX) < Math.abs(b.x - towerX) ? a : b));
    }
  }

  // ─── 시뮬레이션 ───
  advanceTo(stageT: number) {
    while (this.t < stageT && this.phase !== 'done') {
      this.step(Math.min(SIM_DT, stageT - this.t));
    }
  }

  private currentAllyAtkMult(): number {
    const w = Math.min(this.waveIdx, this.params.waveCount);
    return w >= 1 ? this.waveMods[w].allyAtkMult : 1;
  }

  private step(dt: number) {
    this.t += dt;
    const t = this.t;
    const cycle = BALANCE.CYCLE_SECONDS;

    if (t < this.stageEndT) {
      const w = Math.floor(t / cycle) + 1;
      this.waveIdx = w;
      this.phase = t - (w - 1) * cycle >= BALANCE.PREP_SECONDS ? 'wave' : 'prep';
      if (!this.incomeGranted.has(w)) {
        this.incomeGranted.add(w);
        this.addGold(w === this.params.waveCount ? this.params.incomeLastWave : this.params.incomePerWave);
        this.activeEvent = this.waveMods[w].event;
      }
      if (this.phase === 'wave' && !this.spawnedWaves.has(w)) {
        this.spawnedWaves.add(w);
        this.scheduleWave(w);
      }
    } else if (this.enemies.length > 0 || this.pending.length > 0) {
      this.phase = 'overtime';
      if (t > this.stageEndT + 90) { // 이동속도 절반에 맞춰 연장 — 마지막 웨이브가 도달 전에 소거되지 않게
        this.enemies = [];
        this.pending = [];
      }
    } else {
      this.phase = 'done';
      this.victory = this.baseHP > 0;
      return;
    }

    while (this.pending.length && this.pending[0].at <= t) this.spawn(this.pending.shift()!);

    const atkMult = this.currentAllyAtkMult();

    // 배당 파밍: 주기적 골드 생산 (비전투 타워)
    for (const tw of this.towers) {
      if (!tw) continue;
      const spec = TOWERS.find((s) => s.key === tw.key)!;
      if (spec.incomeAmount <= 0) continue;
      while (t >= tw.nextIncomeAt) {
        const amount = Math.round(spec.incomeAmount * (tw.lv === 2 ? spec.lv2Mult : 1));
        this.addGold(amount);
        this.pushFx('gold', this.towerSlotX(tw.slot), false, amount);
        tw.nextIncomeAt += spec.incomePeriod;
      }
    }

    // 리스크 매니저: 사옥 회복 (생존 중, 상한 BASE_HP)
    const healSum = this.units.reduce((s2, u) => s2 + u.spec.baseHealPerSec, 0);
    if (healSum > 0 && this.baseHP > 0) this.baseHP = Math.min(BALANCE.BASE_HP, this.baseHP + healSum * dt);

    // 출혈 지속 피해 (가위 병사 십자 절단)
    for (const e of this.enemies) {
      if (e.hp > 0 && this.t < e.dotUntil && e.dotDps > 0) e.hp -= e.dotDps * dt;
    }

    // 힐러 오라 (Kingdom Rush 실드 사제 — strong 타겟팅으로 저격하는 카운터 플레이)
    for (const h of this.enemies) {
      if (h.healPerSec <= 0 || h.hp <= 0) continue;
      for (const e of this.enemies) {
        if (e === h || e.air || e.hp <= 0 || e.hp >= e.maxHp) continue;
        if (this.t < e.healBlockUntil) continue; // 독가스 — 회복 차단
        if (Math.abs(e.x - h.x) <= HEAL_RADIUS) {
          e.hp = Math.min(e.maxHp, e.hp + h.healPerSec * dt);
        }
      }
    }

    // 블로킹 배정: 지상 적 → 사거리 내 유닛, 유닛당 block 수 제한 (초과분은 통과)
    const blockCount = new Map<number, number>();
    const engagedBy = new Map<number, Unit>(); // enemyId → 붙잡은 유닛
    for (const e of this.enemies) {
      if (e.air || this.t < e.stunUntil) continue;
      // 붙잡는 간격은 무기 리치를 따른다 (짧은 무기일수록 적이 더 가까이 붙는다). 원거리는 28 상한.
      const candidates = this.units
        .filter((u) => u.x <= e.x && e.x - u.x <= Math.min(u.spec.range, 28) && (blockCount.get(u.id) ?? 0) < u.spec.block)
        .sort((a, b) => b.x - a.x);
      const u = candidates[0];
      if (u) {
        blockCount.set(u.id, (blockCount.get(u.id) ?? 0) + 1);
        engagedBy.set(e.id, u);
      }
    }

    // 유닛 행동 (블로커는 붙잡고, 원거리는 뒤에서, 브루저는 광역, 서포터는 후열 유지)
    for (const u of this.units) {
      u.shotCd -= dt;
      if (t < u.stunUntil) continue; // 적 스킬 기절 — 이동·공격 불가
      if (t < u.knockUntil) { // FR-6.10b 충격파에 밀리는 중 — 이동·공격 불가 (easeOut 슬라이드)
        const p = 1 - (u.knockUntil - t) / BALANCE.RAGE_PUSH_SECONDS;
        const e3 = 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);
        u.x = u.knockFrom + (u.knockTo - u.knockFrom) * e3;
        continue;
      }
      if (u.spec.dps <= 0) { // 서포터(리스크 매니저): 비공격 — 전열 뒤에서 따라간다
        const ahead = this.units.some((o) => o !== u && o.spec.dps > 0 && o.x > u.x && o.x - u.x < 40);
        const enemyNear = this.enemies.some((e) => !e.air && e.x - u.x >= -6 && e.x - u.x <= 30);
        if (!ahead && !enemyNear && u.x < ENEMY_BASE_X - 80) u.x += u.spec.speed * dt;
        continue;
      }
      const inRange = this.enemies.filter((e) =>
        e.hp > 0 && e.x >= u.x - 6 && e.x - u.x <= u.spec.range && (!e.air || u.spec.antiAirPct > 0));
      const ground = inRange.filter((e) => !e.air).sort((a, b) => a.x - b.x);
      const airs = inRange.filter((e) => e.air).sort((a, b) => a.x - b.x);
      const targets = ground.length ? ground.slice(0, u.spec.cleave) : airs.slice(0, 1);
      if (targets.length) {
        if (u.shotCd <= 0) {
          u.shotCd = 0.8;
          const dmg = u.spec.dps * 0.8 * atkMult;
          for (const e of targets) {
            const mult = e.air ? u.spec.antiAirPct : 1;
            if (u.spec.range > 40) {
              this.fireProjectile(u.x, e, dmg * mult, { dmgType: u.spec.dmgType, projSpeed: 520, splashRadius: 0, slowPct: 0, slowDur: 0 }, false, u.key);
            } else {
              this.damage(e, dmg * mult, u.spec.dmgType);
            }
          }
        }
      } else if (u.x >= ENEMY_BASE_X - 60) {
        this.enemyBaseHP -= u.spec.dps * atkMult * dt; // FR-6.10 적 본진 공격
      } else {
        u.x += u.spec.speed * (t < u.slowUntil ? 1 - u.slowPct : 1) * dt; // 둔화 반영
      }
    }
    this.checkRage(); // FR-6.10b 본진 위기 → 반격 분대
    this.castUnitSkills(atkMult); // FR-6.5b 유닛 자동 스킬
    this.castEnemySkills(); // FR-6.7b 적 자동 스킬

    // 적 행동
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (this.t < e.stunUntil) continue; // 스턴: 이동·공격 불가
      const blocker = engagedBy.get(e.id);
      if (blocker) {
        // 리스크 매니저 가드: 근처 서포터가 있으면 아군이 받는 피해 감소
        const guard = this.units.some((u) => u.spec.guardPct > 0 && Math.abs(u.x - blocker.x) <= u.spec.guardRadius)
          ? 1 - UNITS.find((s) => s.key === 'riskmgr')!.guardPct : 1;
        const shield = this.t < blocker.shieldUntil ? 0.4 : 1; // FR-6.5b 원금 보장 돔
        const eDps = e.dps * (this.t < e.dpsBuffUntil ? 1 + e.dpsBuffPct : 1); // 선동 방송 버프
        const inc = this.t < blocker.markUntil ? 1 + blocker.markPct : 1; // 표식 — 받는 피해 증가
        blocker.hp -= eDps * guard * shield * inc * dt; // 블로킹된 적은 유닛과 교전
      } else {
        // 손절 방벽: 지상 적의 경로를 물리적으로 막는다 — 파괴될 때까지 정지·공격
        const bar = this.towers.find((tw) => {
          if (!tw || tw.hp <= 0) return false;
          const dx = e.x - this.towerSlotX(tw.slot);
          return dx > 0 && dx <= 16;
        });
        if (bar && !e.air) {
          bar.hp -= e.dps * dt;
          if (bar.hp <= 0) {
            this.pushFx('death', this.towerSlotX(bar.slot), false, 0);
            this.towers[bar.slot] = null;
          }
        } else if (this.t < e.knockUntil) { // 넉백 슬라이드 (곤봉·방패 돌격)
          const p2 = 1 - (e.knockUntil - this.t) / 0.35;
          e.x = e.knockFrom + (e.knockTo - e.knockFrom) * (1 - Math.pow(1 - Math.max(0, Math.min(1, p2)), 3));
        } else {
          e.x -= this.enemySpeed(e) * dt;
        }
      }
      if (e.x <= PLAYER_BASE_X + 12) {
        this.baseHP -= e.baseDmg;
        this.pushFx('death', e.x, e.air, 0);
        e.leaked = true; // 도달 소멸 — 처치 아님
        e.hp = 0;
      }
    }

    // 타워 사격 (타겟팅 모드 적용 — 비공격 구조물은 제외)
    for (const tw of this.towers) {
      if (!tw) continue;
      const spec = TOWERS.find((s) => s.key === tw.key)!;
      if (spec.dmg <= 0) continue;
      tw.cooldown -= dt;
      if (tw.cooldown > 0) continue;
      const tx = this.towerSlotX(tw.slot);
      const candidates = this.enemies.filter((e) =>
        (spec.target === 'both' ? true : spec.target === 'air' ? e.air : !e.air) && e.hp > 0 && Math.abs(e.x - tx) <= spec.range);
      const target = this.pickTarget(candidates, tw.mode, tx);
      if (!target) { tw.lastTargetX = null; continue; }
      tw.cooldown = 1 / spec.rate;
      tw.lastTargetX = target.x;
      if (spec.rampPct > 0) { // 복리 화염: 같은 대상 연속 명중마다 피해 복리 증가
        tw.rampN = tw.lastTargetId === target.id ? tw.rampN + 1 : 0;
        tw.lastTargetId = target.id;
      }
      const ramp = spec.rampPct > 0 ? 1 + Math.min(tw.rampN * spec.rampPct, spec.rampMax) : 1;
      const dmg = spec.dmg * (tw.lv === 2 ? spec.lv2Mult : 1) * this.params.towerDmgMult * atkMult * ramp;
      const slowPct = tw.lv === 2 && spec.slowPct > 0 ? spec.slowPct + 0.1 : spec.slowPct;
      const dmgType = spec.lv2Pierce && tw.lv === 2 ? 'magic' as const : spec.dmgType; // Lv2 철갑탄 (armor 관통)
      this.fireProjectile(tx, target, dmg, { ...spec, dmgType, slowPct }, true);
    }

    // 사옥 자동 포탑 (최후 방어선)
    this.baseTurretCd -= dt;
    if (this.baseTurretCd <= 0) {
      const near = this.enemies.filter((e) => e.hp > 0 && e.x <= BASE_TURRET.range);
      const target = this.pickTarget(near, 'first', 0);
      if (target) {
        this.baseTurretCd = 1 / BASE_TURRET.rate;
        this.fireProjectile(20, target, BASE_TURRET.dmg * atkMult, { dmgType: BASE_TURRET.dmgType, projSpeed: 380, splashRadius: 0, slowPct: 0, slowDur: 0 }, true); // 투척 궤적에 맞춘 체공
      }
    }

    // 투사체 비행·명중
    const byId = new Map(this.enemies.map((e) => [e.id, e]));
    for (const p of this.projectiles) {
      const target = byId.get(p.targetId);
      const destX = target && target.hp > 0 ? target.x : p.x; // 목표 소실 시 현재 위치에서 소멸/폭발
      const dir = Math.sign(destX - p.x) || 1;
      p.x += dir * p.speed * dt;
      const arrived = !target || target.hp <= 0 || Math.abs(p.x - destX) <= PROJ_HIT_DIST;
      if (!arrived) continue;
      p.speed = -1; // 소멸 마크
      if (p.splashRadius > 0) {
        for (const e of this.enemies) {
          if (e.air || e.hp <= 0 || Math.abs(e.x - p.x) > p.splashRadius) continue;
          this.damage(e, p.dmg, p.dmgType);
          if (p.slowPct > 0) {
            e.slowPct = Math.max(e.slowPct, p.slowPct);
            e.slowUntil = Math.max(e.slowUntil, this.t + p.slowDur);
          }
        }
      } else if (target && target.hp > 0) {
        this.damage(target, p.dmg, p.dmgType);
        if (p.slowPct > 0) {
          target.slowPct = Math.max(target.slowPct, p.slowPct);
          target.slowUntil = Math.max(target.slowUntil, this.t + p.slowDur);
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.speed > 0);

    // 사망 정리
    this.units = this.units.filter((u) => u.hp > 0);
    this.enemies = this.enemies.filter((e) => this.aliveOrDeathFx(e));
    this.fx = this.fx.filter((f) => this.t - f.t < 1.4);

    if (this.baseHP <= 0) { // 패배 우선 (같은 틱에 둘 다 0이면 패배)
      this.baseHP = 0;
      this.phase = 'done';
      this.victory = false;
      return;
    }
    if (this.enemyBaseHP <= 0) { // FR-6.10: 적 본진 파괴 = 즉시 승리 (남은 웨이브 생략)
      this.enemyBaseDestroyed = true;
      this.enemyBaseHP = 0;
      this.phase = 'done';
      this.victory = true;
    }
  }
}
