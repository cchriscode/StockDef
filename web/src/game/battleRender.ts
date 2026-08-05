// FR-6.1 일자형 전투 렌더러 — Battle 엔진 상태를 그리기만 한다 (로직·렌더 분리, §11)
// 스프라이트: game_vector_assets 팩 (관절 리그 모션 — idle/walk/hit/attack/death/destroy 프레임 시퀀스)
import { BASE_TURRET, ENEMY_TYPES, TOWERS, type Battle, type Enemy } from '@tf/shared';
import { BACKDROPS, BACKDROP_GROUND, BACKDROP_H, BACKDROP_W, type Backdrop } from './battleBackdrops.js';

const AIR_Y = 96;
const GROUND_Y = 258; // 캔버스 1400×300 기준 — 스프라이트는 고정 px, 레인만 길어진다

const ENEMY_COLORS: Record<Enemy['type'], string> = {
  grunt: '#E8654F', runner: '#FF9E86', tank: '#A83A2E', shield: '#C9A84A',
  healer: '#8FD8B0', air: '#E8A0B4', boss: '#C22A2A',
};
const UNIT_COLORS = { intern: '#7BD8A0', analyst: '#46A574', trader: '#3E8C68', riskmgr: '#5EC0B0' };
const TOWER_COLORS = { limit: '#4E7FB8', dividend: '#FFC53D', barrier: '#7C89A3' };
const MODE_LABEL = { first: '선두', last: '후미', strong: '강적', close: '근접' };

// ─── 벡터 팩 매핑 (역할 → 슬러그) ───
const UNIT_SLUG: Record<string, string> = {
  intern: 'bond-guardian', analyst: 'analyst-ranger', trader: 'growth-blade', riskmgr: 'dividend-cleric',
};
const TOWER_SLUG: Record<string, string> = {
  limit: 'exchange-ballista', dividend: 'central-bank-vault', barrier: 'circuit-breaker',
};
const ENEMY_SLUG: Record<Enemy['type'], string> = {
  grunt: 'bear-trooper', runner: 'flash-crash', tank: 'inflation-crawler', shield: 'hedge-shieldbearer',
  healer: 'panic-sell-drone', air: 'algo-drone', boss: 'margin-call-titan',
};

// 모션별 [프레임 수, fps] — 팩 README 권장값
const MOTIONS: Record<string, [number, number]> = {
  idle: [4, 5], walk: [8, 12], hit: [3, 8], attack: [6, 12], death: [5, 7], skill: [5, 9], destroy: [5, 7],
};
const HIT_DUR = 3 / 8;
const ATTACK_DUR = 6 / 12;
const DEATH_DUR = 5 / 7;

const vCache = new Map<string, HTMLImageElement>();
function vspr(path: string): HTMLImageElement | null {
  let img = vCache.get(path);
  if (!img) {
    img = new Image();
    img.src = `/assets/vector/${path}.svg`;
    vCache.set(path, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** 루프 모션 프레임 (idle/walk/attack 루프 재생) */
function loopFrame(dir: string, motion: string, t: number, phase: number): HTMLImageElement | null {
  const [n, fps] = MOTIONS[motion];
  return vspr(`anim/${dir}/${motion}_${Math.floor(t * fps + phase) % n}`);
}

/** 원샷 모션 프레임 (hit/attack/death/destroy) — 경과 초과 시 null */
function shotFrame(dir: string, motion: string, elapsed: number): HTMLImageElement | null {
  const [n, fps] = MOTIONS[motion];
  if (elapsed < 0 || elapsed >= n / fps) return null;
  return vspr(`anim/${dir}/${motion}_${Math.min(Math.floor(elapsed * fps), n - 1)}`);
}

// 구 스프라이트 로더 — 기지(사옥/베어 본진)는 벡터 팩에 없어 Bases 시트 유지
const sprCache = new Map<string, HTMLImageElement>();
function spr(name: string): HTMLImageElement | null {
  let img = sprCache.get(name);
  if (!img) {
    img = new Image();
    img.src = `/assets/sprites/${name}.svg`;
    sprCache.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// ─── 렌더 상태 (배틀 인스턴스별) — 피격/사망 감지·단발 연출 ───
interface Corpse { dir: string; x: number; y: number; w: number; h: number; t0: number }
interface VfxShot { name: string; x: number; y: number; t0: number; dur: number; s0: number; s1: number }
interface RenderFxState {
  lastFxT: number;
  prevProj: Map<number, { x: number; air: boolean; fromTower: boolean }>;
  lastHp: Map<string, number>; // 'u3'/'e17'/'t0' → 지난 프레임 hp (피격 감지)
  hitT: Map<string, number>; // 피격 애니메이션 시작 시각
  prevUnits: Map<number, { key: string; x: number }>;
  prevEnemies: Map<number, { type: Enemy['type']; x: number; air: boolean; w: number; h: number }>;
  prevTowers: (string | null)[]; // slot → key (파괴 감지)
  corpses: Corpse[];
  vfx: VfxShot[];
}
const fxStates = new WeakMap<Battle, RenderFxState>();

function fxStateOf(b: Battle): RenderFxState {
  let st = fxStates.get(b);
  if (!st) {
    st = {
      lastFxT: 0, prevProj: new Map(), lastHp: new Map(), hitT: new Map(),
      prevUnits: new Map(), prevEnemies: new Map(), prevTowers: [], corpses: [], vfx: [],
    };
    fxStates.set(b, st);
  }
  return st;
}

/** hp 하락 감지 → 피격 애니메이션 트리거 */
function trackHit(st: RenderFxState, key: string, hp: number, t: number) {
  const prev = st.lastHp.get(key);
  if (prev != null && hp < prev - 0.5) st.hitT.set(key, t);
  st.lastHp.set(key, hp);
}

function pushVfx(st: RenderFxState, name: string, x: number, y: number, t0: number, dur: number, s0: number, s1: number) {
  st.vfx.push({ name, x, y, t0, dur, s0, s1 });
  if (st.vfx.length > 60) st.vfx.splice(0, st.vfx.length - 60);
}

// ─── 도시별 전장 배경 (Backgrounds 목업 트레이스 세트) — 오프스크린 1회 렌더 후 재사용 ───
const backdropCache = new Map<string, HTMLCanvasElement>();

function drawStripes(ctx: CanvasRenderingContext2D, r: { xx: number; yy: number; ww: number; hh: number }, layer: Backdrop['rects'][number]['g'], sx2: number, sy2: number) {
  if (!layer) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.xx, r.yy, r.ww, r.hh);
  ctx.clip();
  // CSS는 먼저 선언된 레이어가 위 — 캔버스는 뒤집어서 그린다
  for (let li = layer.length - 1; li >= 0; li--) {
    const st = layer[li];
    const scale = st.dir === 'x' ? sx2 : sy2;
    const period = Math.max(st.period * scale, 1);
    const len = st.dir === 'x' ? r.ww : r.hh;
    for (let off = 0; off < len; off += period) {
      for (const seg of st.segs) {
        ctx.fillStyle = seg.c;
        const a = off + seg.a * scale;
        const b = off + seg.b * scale;
        if (st.dir === 'x') ctx.fillRect(r.xx + a, r.yy, b - a, r.hh);
        else ctx.fillRect(r.xx, r.yy + a, r.ww, b - a);
      }
    }
  }
  ctx.restore();
}

function backdropFor(regionId: string, W: number, H: number, groundTop: number): HTMLCanvasElement {
  const key = `${regionId}:${W}x${H}`;
  const hit = backdropCache.get(key);
  if (hit) return hit;
  const bd = BACKDROPS[regionId] ?? BACKDROPS.R1;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const sx2 = W / BACKDROP_W;
  const sy2 = groundTop / (BACKDROP_H - BACKDROP_GROUND); // 패널 지면선 → 우리 지면선 정합
  // 하늘 램프 (디더 포함)
  let y = 0;
  for (const band of bd.bands) {
    const h = band.h < 0 ? Math.max(H - y, 0) : band.h * sy2;
    if (band.c) {
      ctx.fillStyle = band.c;
      ctx.fillRect(0, y, W, h + 1);
    } else if (band.d) {
      ctx.fillStyle = band.d[0];
      ctx.fillRect(0, y, W, h + 1);
      ctx.fillStyle = band.d[1];
      for (let yy = 0; yy < h; yy += 4) {
        for (let xx = ((yy / 4) % 2) * 4; xx < W; xx += 8) ctx.fillRect(xx, y + yy, 4, Math.min(4, h - yy));
      }
    }
    y += h;
    if (y >= H) break;
  }
  // 실루엣·랜드마크 사각형 (t = 하늘 앵커 / b = 지면선 앵커)
  for (const r of bd.rects) {
    const ww = r.x * sx2 + r.w * sx2 - Math.floor(r.x * sx2); // 반올림 이음새 방지
    const xx = Math.floor(r.x * sx2);
    const hh = r.h * sy2;
    let yy: number;
    if (r.t != null) yy = r.t * sy2;
    else yy = groundTop - (r.b! - BACKDROP_GROUND) * sy2 - hh;
    ctx.globalAlpha = r.o ?? 1;
    if (r.c) {
      ctx.fillStyle = r.c;
      ctx.fillRect(xx, yy, ww, hh);
    }
    drawStripes(ctx, { xx, yy, ww, hh }, r.g, sx2, sy2);
    ctx.globalAlpha = 1;
  }
  backdropCache.set(key, cv);
  return cv;
}

export function drawBattle(canvas: HTMLCanvasElement, b: Battle, shake: number, selectedSlot: number | null) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const sx = (x: number) => (x / 1000) * W;
  const st = fxStateOf(b);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.clearRect(-8, -8, W + 16, H + 16);

  // 도시별 전장 배경 (오프스크린 캐시) + 지면
  const groundTop = GROUND_Y + 16;
  const regionKey = b.params.regionId === 'TUT' ? 'R1' : b.params.regionId;
  ctx.drawImage(backdropFor(regionKey, W, H, groundTop), 0, 0);
  ctx.fillStyle = '#2E3D57';
  ctx.fillRect(-8, groundTop, W + 16, 4);
  ctx.fillStyle = 'rgba(123,216,160,0.5)';
  ctx.fillRect(-8, groundTop, W + 16, 2);
  ctx.fillStyle = '#1A2740';
  ctx.fillRect(-8, groundTop + 4, W + 16, H - groundTop - 4);

  // 선택 타워 사거리 원 (설치 판단용)
  if (selectedSlot != null) {
    const tw = b.towers[selectedSlot];
    const tx = sx(b.towerSlotX(selectedSlot));
    const range = tw ? TOWERS.find((s) => s.key === tw.key)!.range : 420;
    ctx.fillStyle = 'rgba(123,216,160,0.08)';
    ctx.strokeStyle = 'rgba(123,216,160,0.35)';
    ctx.beginPath();
    ctx.ellipse(tx, GROUND_Y - 10, sx(range), 46, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  // 본진 (사옥 + 자동 포탑) / 적 본진 — 체력 3상태 스프라이트 (Bases 시트 유지)
  ctx.imageSmoothingEnabled = false;
  const hpState = (rate: number) => (rate >= 0.6 ? '100' : rate >= 0.25 ? '59' : '24');
  const hq = spr(`hq_${hpState(b.baseHP / 100)}`);
  if (hq) {
    const hh = 116;
    const wwq = (hh * 112) / 160;
    ctx.drawImage(hq, 4, groundTop - hh, wwq, hh);
    hpBar(ctx, 8, groundTop - hh - 8, wwq - 8, b.baseHP / 100, '#46A574');
  } else {
    drawBase(ctx, 8, GROUND_Y - 50, 40, 64, '#46A574', '#0C1A12', b.baseHP / 100, '사옥');
  }
  ctx.fillStyle = '#7BD8A0';
  ctx.fillRect(78, GROUND_Y - 46, 8, 8); // 사옥 자동 포탑 총구
  const foe = spr(`foe_${hpState(b.enemyBaseHP / 300)}`);
  if (foe) {
    const hh = 88;
    const wwf = (hh * 176) / 128;
    ctx.drawImage(foe, W - wwf - 2, groundTop - hh, wwf, hh);
    hpBar(ctx, W - wwf + 2, groundTop - hh - 8, wwf - 8, b.enemyBaseHP / 300, '#E8654F');
  } else {
    drawBase(ctx, W - 48, GROUND_Y - 50, 40, 64, '#A83A2E', '#FFE9C4', b.enemyBaseHP / 300, '베어');
  }
  ctx.imageSmoothingEnabled = true; // 벡터 팩은 스무딩 렌더

  // 사망·파괴 연출 (본체 아래 레이어) — death/destroy 프레임 원샷
  st.corpses = st.corpses.filter((c) => {
    const motion = c.dir.startsWith('towers/') ? 'destroy' : 'death';
    const img = shotFrame(c.dir, motion, b.t - c.t0);
    if (!img) return b.t - c.t0 < 0;
    ctx.drawImage(img, sx(c.x) - c.w / 2, c.y - c.h, c.w, c.h);
    return true;
  });

  // 타워 — idle 루프 / 발사·지급 시 attack 원샷 / 방벽 피격 hit
  for (let s = 0; s < b.towers.length; s++) {
    const tx = sx(b.towerSlotX(s));
    const tw = b.towers[s];
    // 파괴 감지 (방벽 소실 → destroy 연출)
    const prevKey = st.prevTowers[s] ?? null;
    if (prevKey && !tw) {
      st.corpses.push({ dir: `towers/${TOWER_SLUG[prevKey]}`, x: b.towerSlotX(s), y: groundTop, w: 46, h: 58, t0: b.t });
      st.lastHp.delete(`t${s}`);
    }
    st.prevTowers[s] = tw ? tw.key : null;
    if (!tw) {
      ctx.fillStyle = 'rgba(110,143,181,0.14)';
      ctx.fillRect(tx - 12, groundTop - 40, 24, 38);
      ctx.strokeStyle = s === selectedSlot ? '#7BD8A0' : '#6E8FB5';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(tx - 12, groundTop - 40, 24, 38);
      ctx.setLineDash([]);
      ctx.fillStyle = '#8FA8C7';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s + 1}`, tx, groundTop - 18);
      continue;
    }
    const spec = TOWERS.find((t) => t.key === tw.key)!;
    const dir = `towers/${TOWER_SLUG[tw.key]}`;
    if (tw.maxHp > 0) trackHit(st, `t${s}`, tw.hp, b.t);
    const hitEl = b.t - (st.hitT.get(`t${s}`) ?? -9);
    // 모션 선택: 발리스타=발사 직후 / 금고=지급 직후 attack, 방벽=피격 hit
    let img: HTMLImageElement | null = null;
    if (spec.rate > 0 && tw.cooldown > 0) img = shotFrame(dir, 'attack', 1 / spec.rate - tw.cooldown);
    else if (spec.incomeAmount > 0) img = shotFrame(dir, 'attack', spec.incomePeriod - (tw.nextIncomeAt - b.t));
    else if (hitEl < HIT_DUR) img = shotFrame(dir, 'hit', hitEl);
    if (!img) img = loopFrame(dir, 'idle', b.t, s * 2);
    const hh = 58;
    const wwt = (hh * 160) / 200;
    if (img) {
      ctx.drawImage(img, tx - wwt / 2, groundTop - hh, wwt, hh);
    } else {
      ctx.fillStyle = TOWER_COLORS[tw.key];
      ctx.fillRect(tx - 11, groundTop - 36, 22, 34);
    }
    if (tw.lv === 2) {
      ctx.fillStyle = '#FFC53D';
      ctx.fillRect(tx - 12, groundTop - hh - 6, 24, 4);
    }
    if (tw.maxHp > 0) hpBar(ctx, tx - 12, groundTop - hh - 8, 24, tw.hp / tw.maxHp, '#7C89A3'); // 방벽 내구
    if (spec.dmg > 0) { // 타겟팅 모드 배지 (공격 타워만)
      ctx.fillStyle = '#7C89A3';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(MODE_LABEL[tw.mode], tx, groundTop + 12);
    }
  }

  // 유닛 — 이동=walk / 사격 직후=attack 원샷 / 피격=hit / 소멸=death
  const liveUnits = new Set<number>();
  for (const u of b.units) {
    liveUnits.add(u.id);
    const ux = sx(u.x);
    const dir = `units/${UNIT_SLUG[u.key]}`;
    const hh = 50;
    const wwu = (hh * 160) / 200;
    trackHit(st, `u${u.id}`, u.hp, b.t);
    const hitEl = b.t - (st.hitT.get(`u${u.id}`) ?? -9);
    const moved = Math.abs(u.x - (st.prevUnits.get(u.id)?.x ?? u.x)) > 0.01;
    const atkEl = 0.8 - u.shotCd; // 발사 시 shotCd=0.8 리셋 → 경과로 프레임
    let img: HTMLImageElement | null = null;
    if (hitEl < HIT_DUR) img = shotFrame(dir, 'hit', hitEl);
    else if (u.shotCd > 0 && atkEl < ATTACK_DUR) img = shotFrame(dir, 'attack', atkEl);
    else if (moved) img = loopFrame(dir, 'walk', b.t, u.id);
    else img = loopFrame(dir, 'idle', b.t, u.id);
    if (img) {
      ctx.drawImage(img, ux - wwu / 2, groundTop - hh, wwu, hh);
    } else {
      ctx.fillStyle = UNIT_COLORS[u.key];
      ctx.beginPath();
      ctx.arc(ux, groundTop - 10, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.key === 'riskmgr') { // 헤지 오라 (보증 방벽 vfx 펄스)
      const aura = vspr('vfx/ally_barrier-guarantee');
      if (aura) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(b.t * 2.6 + u.id);
        ctx.drawImage(aura, ux - 22, groundTop - hh - 30, 44, 44);
        ctx.globalAlpha = 1;
      }
    }
    hpBar(ctx, ux - 9, groundTop - hh - 8, 18, u.hp / u.maxHp, '#7BD8A0');
    st.prevUnits.set(u.id, { key: u.key, x: u.x });
  }
  // 유닛 소멸 감지 → 사망 애니메이션 (엔진은 유닛 death fx를 만들지 않는다)
  for (const [id, info] of st.prevUnits) {
    if (liveUnits.has(id)) continue;
    st.prevUnits.delete(id);
    st.lastHp.delete(`u${id}`);
    st.hitT.delete(`u${id}`);
    if (b.phase !== 'done') {
      st.corpses.push({ dir: `units/${UNIT_SLUG[info.key]}`, x: info.x, y: groundTop, w: 40, h: 50, t0: b.t });
    }
  }

  // 적 — 이동=walk / 정지(교전·방벽)=attack 루프 / 피격=hit / 소멸=death
  const liveEnemies = new Set<number>();
  for (const e of b.enemies) {
    liveEnemies.add(e.id);
    const ex = sx(e.x);
    const col = ENEMY_COLORS[e.type];
    const slowed = b.t < e.slowUntil;
    const stunned = b.t < e.stunUntil;
    const dir = `enemies/${ENEMY_SLUG[e.type]}`;
    const hh = e.air ? 36 : Math.min(34 + e.size * 2.4, 72);
    const wwe = hh * (e.type === 'boss' ? 220 / 200 : 160 / 200);
    const topY = e.air ? AIR_Y - hh / 2 : groundTop - hh;
    trackHit(st, `e${e.id}`, e.hp, b.t);
    const hitEl = b.t - (st.hitT.get(`e${e.id}`) ?? -9);
    const prevX = st.prevEnemies.get(e.id)?.x;
    const moved = prevX == null || Math.abs(e.x - prevX) > 0.01;
    let img: HTMLImageElement | null = null;
    if (stunned) img = vspr(`anim/${dir}/idle_0`);
    else if (hitEl < HIT_DUR) img = shotFrame(dir, 'hit', hitEl);
    else if (!moved) img = loopFrame(dir, 'attack', b.t, e.id); // 블로커·방벽에 막혀 교전 중
    else img = loopFrame(dir, 'walk', b.t, e.id);
    if (img) {
      if (slowed) ctx.filter = 'saturate(0.4) brightness(0.8)';
      ctx.drawImage(img, ex - wwe / 2, topY, wwe, hh);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = slowed ? '#5E9AA0' : col;
      ctx.beginPath();
      ctx.arc(ex, e.air ? AIR_Y : groundTop - e.size, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (slowed) { // 프로스트 홀트 vfx (슬로우 표시)
      const frost = vspr('vfx/ally_frost-halt');
      if (frost) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(frost, ex - 14, topY - 16, 28, 28);
        ctx.globalAlpha = 1;
      }
    }
    if (stunned) {
      ctx.fillStyle = '#FFC53D';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✶', ex, topY - 10);
    }
    const bw = e.type === 'boss' ? 34 : 18;
    hpBar(ctx, ex - bw / 2, topY - 7, bw, e.hp / e.maxHp, col);
    st.prevEnemies.set(e.id, { type: e.type, x: e.x, air: e.air, w: wwe, h: hh });
  }
  // 적 소멸 감지 → 사망 애니메이션 (도달 소멸 포함 — 본진 앞에서 쓰러진다)
  for (const [id, info] of st.prevEnemies) {
    if (liveEnemies.has(id)) continue;
    st.prevEnemies.delete(id);
    st.lastHp.delete(`e${id}`);
    st.hitT.delete(`e${id}`);
    if (b.phase !== 'done') {
      const y = info.air ? AIR_Y + info.h / 2 : groundTop;
      st.corpses.push({ dir: `enemies/${ENEMY_SLUG[info.type]}`, x: info.x, y, w: info.w, h: info.h, t0: b.t });
    }
  }

  // 투사체 — 아군 팔레트 볼트 (타워=골드 대형 / 유닛=크림 소형), 소멸 시 관통 충격파 vfx
  const liveProj = new Set<number>();
  for (const p of b.projectiles) {
    liveProj.add(p.id);
    const y = (p.air ? AIR_Y : GROUND_Y) - (p.fromTower ? 14 : 4) + Math.sin(p.x * 0.15) * 2;
    const px = sx(p.x);
    const len = p.fromTower ? 16 : 11;
    const core = p.dmgType === 'magic' ? '#C4A8FF' : p.fromTower ? '#C39C4C' : '#E8D9A0';
    ctx.save();
    ctx.shadowColor = core;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = core;
    ctx.lineWidth = p.fromTower ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(px - len / 2, y);
    ctx.lineTo(px + len / 2, y);
    ctx.stroke();
    ctx.fillStyle = '#FFF6E0';
    ctx.fillRect(px + len / 2 - 2, y - 1.5, 3, 3);
    ctx.restore();
    st.prevProj.set(p.id, { x: p.x, air: p.air, fromTower: p.fromTower });
  }
  // 소멸한 투사체 → 착탄 충격파
  for (const [id, info] of st.prevProj) {
    if (liveProj.has(id)) continue;
    st.prevProj.delete(id);
    pushVfx(st, 'ally_pierce-shockwave', info.x, (info.air ? AIR_Y : GROUND_Y) - 12, b.t, 0.28, 10, info.fromTower ? 34 : 26);
  }

  // 엔진 fx 이벤트 → vfx 원샷 (배당 지급 / 공시폭탄)
  for (const f of b.fx) {
    if (f.t <= st.lastFxT) continue;
    if (f.kind === 'gold' && f.amount > 0) {
      pushVfx(st, 'ally_dividend-payout', f.x, GROUND_Y - 44, f.t, 0.6, 22, 44);
    } else if (f.kind === 'skill') {
      pushVfx(st, 'ally_meteor-impact', f.x, GROUND_Y - 34, f.t, 0.55, 60, 150);
    }
  }
  st.lastFxT = b.t;

  // vfx 원샷 재생 (스케일 업 + 페이드)
  st.vfx = st.vfx.filter((v) => {
    const p = (b.t - v.t0) / v.dur;
    if (p >= 1) return false;
    if (p < 0) return true;
    const img = vspr(`vfx/${v.name}`);
    if (img) {
      const size = v.s0 + (v.s1 - v.s0) * p;
      ctx.globalAlpha = 1 - p * p;
      ctx.drawImage(img, sx(v.x) - size / 2, v.y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }
    return true;
  });

  // 이펙트: 데미지 숫자 · 힐 · 스킬 플래시
  ctx.textAlign = 'center';
  for (const f of b.fx) {
    const age = b.t - f.t;
    const alpha = Math.max(0, 1 - age / 1.2);
    const y = (f.air ? AIR_Y : GROUND_Y) - 18 - age * 22;
    if (f.kind === 'dmg' && f.amount > 0) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFE9C4';
      ctx.font = f.amount >= 30 ? 'bold 12px monospace' : '10px monospace';
      ctx.fillText(String(f.amount), sx(f.x), y);
    } else if (f.kind === 'aum' && f.amount > 0) { // 처치 AUM 보상 (보라)
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#C4A8FF';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`+${f.amount}`, sx(f.x), y - 10);
    } else if (f.kind === 'gold' && f.amount > 0) { // 배당 파밍 지급 (골드)
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFC53D';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`+${f.amount}G`, sx(f.x), y - 24);
    } else if (f.kind === 'skill') {
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#9B6BFF';
      ctx.fillRect(0, GROUND_Y - 40 + age * 20, W, 44 - age * 20);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBase(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, labelCol: string, hpRate: number, label: string) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
  // 창문 픽셀 (목업 사옥 커튼월)
  ctx.fillStyle = 'rgba(10,14,20,0.35)';
  for (let wy = y + 8; wy < y + h - 8; wy += 12) {
    for (let wx = x + 6; wx < x + w - 8; wx += 12) ctx.fillRect(wx, wy, 6, 7);
  }
  ctx.fillStyle = labelCol;
  ctx.font = '11px Galmuri11, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
  hpBar(ctx, x, y - 8, w, hpRate, col);
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rate: number, col: string) {
  ctx.fillStyle = '#0A0E14';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, rate)), 4);
}

export { ENEMY_TYPES, BASE_TURRET };
