// FR-6 전투 시뮬레이션 — 렌더러와 완전 분리된 순수 로직 (§11).
// 웹 클라이언트는 이 엔진의 상태를 그리기만 하고, 봇 시뮬레이터는 헤드리스로 돌린다.
import { BALANCE, TOWERS, UNITS, type TowerSpec, type UnitSpec } from './balance.js';
import type { MarketEvent, StageParams } from './types.js';

export const FIELD_W = 1000;
const PLAYER_BASE_X = 0;
const ENEMY_BASE_X = FIELD_W;
const UNIT_SPAWN_X = 70;
const ENGAGE_RANGE = 26;
const ENEMY_ARRIVE_DMG = 10;
const SIM_DT = 0.05;

export interface Enemy {
  id: number;
  x: number;
  hp: number;
  maxHp: number;
  speed: number;
  air: boolean;
  dps: number;
  wave: number;
}

export interface Unit {
  id: number;
  key: UnitSpec['key'];
  x: number;
  hp: number;
  maxHp: number;
  dps: number;
  speed: number;
}

export interface Tower {
  slot: number;
  key: TowerSpec['key'];
  lv: 1 | 2;
  cooldown: number;
  lastTargetX: number | null; // 렌더용
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
  air: boolean;
  hp: number;
  speed: number;
}

export type BattlePhase = 'prep' | 'wave' | 'overtime' | 'done';

export class Battle {
  readonly params: StageParams;
  gold = 0;
  goldEarned = 0;
  goldSpent = 0;
  baseHP: number = BALANCE.BASE_HP;
  enemyBaseHP: number = BALANCE.ENEMY_BASE_HP;
  enemyBaseDestroyed = false;
  towers: (Tower | null)[];
  units: Unit[] = [];
  enemies: Enemy[] = [];
  waveIdx = 0; // 0 = 시작 전, 1..waveCount
  phase: BattlePhase = 'prep';
  skillReadyAt = 0;
  victory = false;
  t = 0;
  activeEvent: MarketEvent | null = null; // 현재 웨이브에 적용 중인 이벤트 (배너용)

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
      const targetWave = Math.floor(ev.t / BALANCE.CYCLE_SECONDS) + 2; // 발동 시점 웨이브의 다음
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
    this.towers[slot] = { slot, key, lv: 1, cooldown: 0, lastTargetX: null };
    return true;
  }

  upgradeTower(slot: number): boolean {
    const tw = this.towers[slot];
    if (!tw || tw.lv >= 2) return false;
    const spec = TOWERS.find((s) => s.key === tw.key)!;
    if (!this.spend(spec.upgradeCost)) return false;
    tw.lv = 2;
    return true;
  }

  unitCost(key: UnitSpec['key']): number {
    const spec = UNITS.find((s) => s.key === key)!;
    return Math.floor(spec.cost * this.params.unitCostMult);
  }

  spawnUnit(key: UnitSpec['key']): boolean {
    const spec = UNITS.find((s) => s.key === key)!;
    if (!this.spend(this.unitCost(key))) return false;
    const hp = Math.round(spec.hp * this.params.unitHpMult);
    this.units.push({ id: this.nextId++, key, x: UNIT_SPAWN_X, hp, maxHp: hp, dps: spec.dps, speed: spec.speed });
    return true;
  }

  useSkill(): boolean {
    if (this.t < this.skillReadyAt) return false;
    if (!this.spend(BALANCE.SKILL_COST)) return false;
    this.skillReadyAt = this.t + BALANCE.SKILL_COOLDOWN_S;
    for (const e of this.enemies) if (!e.air) e.hp -= BALANCE.SKILL_DAMAGE;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    return true;
  }

  towerSlotX(slot: number): number {
    return 100 + slot * 46;
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
      const inWave = t - (w - 1) * cycle >= BALANCE.PREP_SECONDS;
      this.waveIdx = w;
      this.phase = inWave ? 'wave' : 'prep';

      // 웨이브 시작 시 기본 수입 (FR-6.8)
      if (!this.incomeGranted.has(w)) {
        this.incomeGranted.add(w);
        const amount = w === this.params.waveCount ? this.params.incomeLastWave : this.params.incomePerWave;
        this.addGold(amount);
        this.activeEvent = this.waveMods[w].event;
      }

      // 웨이브 스폰 스케줄 (진행 20초에 균등 분배)
      if (inWave && !this.spawnedWaves.has(w)) {
        this.spawnedWaves.add(w);
        const spec = this.params.waveTable[w - 1];
        const mod = this.waveMods[w];
        const count = Math.ceil(spec.count * this.params.heat * mod.countMult);
        const hp = spec.hp * this.params.heat * mod.enemyHpMult;
        const speed = 30 * spec.speed * mod.speedMult;
        const interval = BALANCE.WAVE_SECONDS / count;
        const waveStart = (w - 1) * cycle + BALANCE.PREP_SECONDS;
        for (let i = 0; i < count; i++) {
          const air = spec.air && i % 3 === 2; // 공중 플래그 웨이브는 1/3이 공중
          this.pending.push({ at: waveStart + i * interval, wave: w, air, hp, speed });
        }
      }
    } else if (this.enemies.length > 0 || this.pending.length > 0) {
      this.phase = 'overtime'; // 13웨이브 종료 후 잔적 처리 (최대 40초)
      if (t > this.stageEndT + 40) {
        this.enemies = [];
        this.pending = [];
      }
    } else {
      this.phase = 'done';
      this.victory = this.baseHP > 0;
      return;
    }

    // 스폰 실행
    while (this.pending.length && this.pending[0].at <= t) {
      const p = this.pending.shift()!;
      this.enemies.push({
        id: this.nextId++, x: ENEMY_BASE_X - 10,
        hp: p.hp, maxHp: p.hp, speed: p.speed, air: p.air,
        dps: 6 + p.wave * 1.2, wave: p.wave,
      });
    }
    this.pending.sort((a, b) => a.at - b.at);

    const atkMult = this.currentAllyAtkMult();

    // 유닛 이동·교전
    for (const u of this.units) {
      const target = this.enemies
        .filter((e) => !e.air && e.x >= u.x && e.x - u.x <= ENGAGE_RANGE)
        .sort((a, b) => a.x - b.x)[0];
      if (target) {
        target.hp -= u.dps * atkMult * dt;
      } else if (u.x >= ENEMY_BASE_X - 60) {
        this.enemyBaseHP -= u.dps * atkMult * dt; // FR-6.10 적 본진 공격
      } else {
        u.x += u.speed * dt;
      }
    }

    // 적 이동·교전
    for (const e of this.enemies) {
      if (e.air) {
        e.x -= e.speed * dt; // 공중은 유닛 무시하고 직행
      } else {
        const target = this.units
          .filter((u) => u.x <= e.x && e.x - u.x <= ENGAGE_RANGE)
          .sort((a, b) => b.x - a.x)[0];
        if (target) target.hp -= e.dps * dt;
        else e.x -= e.speed * dt;
      }
      if (e.x <= PLAYER_BASE_X + 12) {
        this.baseHP -= ENEMY_ARRIVE_DMG;
        e.hp = 0;
      }
    }

    // 타워 사격
    for (const tw of this.towers) {
      if (!tw) continue;
      tw.cooldown -= dt;
      if (tw.cooldown > 0) continue;
      const spec = TOWERS.find((s) => s.key === tw.key)!;
      const dmgBase = spec.dmg * (tw.lv === 2 ? spec.lv2Mult : 1) * this.params.towerDmgMult * atkMult;
      const tx = this.towerSlotX(tw.slot);
      const candidates = this.enemies
        .filter((e) => (spec.target === 'air' ? e.air : !e.air) && Math.abs(e.x - tx) <= spec.range && e.hp > 0)
        .sort((a, b) => a.x - b.x);
      const target = candidates[0];
      if (!target) { tw.lastTargetX = null; continue; }
      tw.cooldown = 1 / spec.rate;
      tw.lastTargetX = target.x;
      if (spec.splashRadius > 0) {
        for (const e of this.enemies) {
          if (!e.air && Math.abs(e.x - target.x) <= spec.splashRadius) e.hp -= dmgBase;
        }
      } else {
        target.hp -= dmgBase;
      }
    }

    // 사망 정리
    this.units = this.units.filter((u) => u.hp > 0);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    if (this.enemyBaseHP <= 0) {
      this.enemyBaseDestroyed = true;
      this.enemyBaseHP = 0;
    }

    // 패배 (FR-6.9)
    if (this.baseHP <= 0) {
      this.baseHP = 0;
      this.phase = 'done';
      this.victory = false;
    }
  }
}
