// FR-6.1 일자형 전투 렌더러 — Battle 엔진 상태를 그리기만 한다 (로직·렌더 분리, §11)
// 스프라이트: handoff 리그 팩 — 로드 시 rigFrames가 고프레임으로 구워둔 시퀀스를 blit
import { BASE_TURRET, ENEMY_TYPES, TOWERS, type Battle, type Enemy } from '@tf/shared';
import { BACKDROPS, BACKDROP_GROUND, BACKDROP_H, BACKDROP_W, type Backdrop } from './battleBackdrops.js';
import { RIG_ENEMY, RIG_TOWER, RIG_UNIT, rigFrame } from './rigFrames.js';
import { VFX } from './rig/rig-player.js';
import { // [임시] 신규 아트 로스터 (아군·적군 전면 교체)
  SHEET_UNIT, SHOT_SHEET, SKILL_TOTAL_MS, drawPreviews, drawSheetChar, drawShot, drawSkill,
  enemySheetId, hasSkillSheet, sheetCharHeight,
} from './previewSprites.js';

const AIR_Y = 96;
const GROUND_Y = 258; // 캔버스 1400×300 기준 — 스프라이트는 고정 px, 레인만 길어진다

const ENEMY_COLORS: Record<Enemy['type'], string> = {
  grunt: '#E8654F', runner: '#FF9E86', tank: '#A83A2E', shield: '#C9A84A',
  healer: '#8FD8B0', air: '#E8A0B4', boss: '#C22A2A',
};
const UNIT_COLORS: Record<string, string> = { intern: '#7BD8A0', analyst: '#46A574', trader: '#3E8C68', lancer: '#6BAF8C', mage: '#9B6BFF', riskmgr: '#5EC0B0', cane: '#D8C4A8' };
const TOWER_COLORS: Record<string, string> = { limit: '#4E7FB8', cannon: '#B85A4E', spire: '#9B6BFF', flame: '#E8A54F', dividend: '#FFC53D', barrier: '#7C89A3' };
const MODE_LABEL = { first: '선두', last: '후미', strong: '강적', close: '근접' };

// 렌더 모션 타이밍 (리그 저작 길이와 무관하게 게임 리듬에 맞춰 위상 스케일)
const HIT_DUR = 0.4; // 피격 경직 연출 길이
const UNIT_ATK_DUR = 0.8; // 유닛 발사 주기(shotCd 리셋값)에 공격 모션을 맞춘다
const DEATH_DUR = 1.4; // 사망 붕괴 (저작 3s를 압축)
const SKILL_DUR = 1.3; // 자동 스킬 시전 연출 길이 (저작 2s를 압축)

/** 리그 캔버스 VFX를 엔티티 발밑 기준 박스로 그린다 (fxDraw 좌표계: cx=W/2, 지면=H*0.78) */
function drawRigVfx(ctx: CanvasRenderingContext2D, idx: number, motion: string, phase: number, feetX: number, feetY: number, scale: number) {
  const BW = 150;
  const BH = 130;
  ctx.save();
  ctx.translate(feetX - BW * scale * 0.5, feetY - BH * scale * 0.78);
  ctx.scale(scale, scale);
  VFX.drawFor(ctx, BW, BH, idx, motion, phase);
  ctx.restore();
}

// vfx 단일 SVG 로더 (game_vector_assets 팩의 vfx/ — 배당·메테오·슬로우 등은 계속 사용)
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

// 지팡이 신사 (임시 PNG 시트 유닛, handoff-walk-cane) — 150×210 프레임, 발끝 = 하단 18px 위
const CANE = { fw: 150, fh: 210, footPad: 18, walk: { frames: 4, ms: 140 }, atk: { frames: 5, ms: 120 } };
function pngImg(src: string): HTMLImageElement | null {
  let img = vCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    vCache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** 임시 유닛 전용 시트 드로잉 — 공격 원샷(0.6s) 아니면 걷기 루프 */
function drawCane(ctx: CanvasRenderingContext2D, t: number, shotCd: number, ux: number, groundTop: number): boolean {
  const atkEl = 0.8 - shotCd; // UNIT_ATK_DUR 사이클
  const attacking = shotCd > 0 && atkEl < (CANE.atk.frames * CANE.atk.ms) / 1000;
  const img = pngImg(attacking ? '/assets/units/cane/atk-strip.png' : '/assets/units/cane/wk-strip.png');
  if (!img) return false;
  const f = attacking
    ? Math.min(Math.floor((atkEl * 1000) / CANE.atk.ms), CANE.atk.frames - 1)
    : Math.floor((t * 1000) / CANE.walk.ms) % CANE.walk.frames;
  const hh = 56;
  const ww = (hh * CANE.fw) / CANE.fh;
  const yBottom = groundTop + (CANE.footPad * hh) / CANE.fh; // 발끝 앵커 정합
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, f * CANE.fw, 0, CANE.fw, CANE.fh, ux - ww / 2, yBottom - hh, ww, hh);
  ctx.imageSmoothingEnabled = true;
  return true;
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
interface Corpse { rigIdx: number; x: number; y: number; h: number; t0: number }
interface VfxShot { name: string; x: number; y: number; t0: number; dur: number; s0: number; s1: number }
interface RenderFxState {
  lastFxT: number;
  prevProj: Map<number, { x: number; air: boolean; fromTower: boolean; base?: boolean; x0?: number }>;
  lastHp: Map<string, number>; // 'u3'/'e17'/'t0' → 지난 프레임 hp (피격 감지)
  hitT: Map<string, number>; // 피격 애니메이션 시작 시각
  prevUnits: Map<number, { key: string; x: number }>;
  prevEnemies: Map<number, { type: Enemy['type']; x: number; air: boolean; h: number }>;
  prevTowers: (string | null)[]; // slot → key (파괴 감지)
  corpses: Corpse[];
  vfx: VfxShot[];
  rigVfx: { idx: number; motion: string; x: number; y: number; scale: number; t0: number; dur: number }[]; // 리그 캔버스 VFX 원샷
}
const fxStates = new WeakMap<Battle, RenderFxState>();

function fxStateOf(b: Battle): RenderFxState {
  let st = fxStates.get(b);
  if (!st) {
    st = {
      lastFxT: 0, prevProj: new Map(), lastHp: new Map(), hitT: new Map(),
      prevUnits: new Map(), prevEnemies: new Map(), prevTowers: [], corpses: [], vfx: [], rigVfx: [],
    };
    fxStates.set(b, st);
  }
  return st;
}

/** hp 하락 감지 → 피격 애니메이션 트리거 (재트리거 쿨다운 — 지속 피격이 공격 모션을 영구히 덮지 않게) */
function trackHit(st: RenderFxState, key: string, hp: number, t: number) {
  const prev = st.lastHp.get(key);
  if (prev != null && hp < prev - 0.5 && t - (st.hitT.get(key) ?? -9) > 1.1) st.hitT.set(key, t);
  st.lastHp.set(key, hp);
}

function pushVfx(st: RenderFxState, name: string, x: number, y: number, t0: number, dur: number, s0: number, s1: number) {
  st.vfx.push({ name, x, y, t0, dur, s0, s1 });
  if (st.vfx.length > 60) st.vfx.splice(0, st.vfx.length - 60);
}

// ─── 도시별 전장 배경 — 이미지 배경(있으면 우선) 또는 목업 트레이스, 오프스크린 1회 렌더 후 재사용 ───
const backdropCache = new Map<string, HTMLCanvasElement>();

// 지역별 픽셀아트 배경 이미지 (높이를 지면선에 맞추고 가로 타일링)
const IMAGE_BACKDROPS: Record<string, string> = {
  R1: '/assets/backdrops/r1.png', R2: '/assets/backdrops/r2.png', R3: '/assets/backdrops/r3.png',
};
const bdImgCache = new Map<string, HTMLImageElement>();

function backdropImage(regionId: string): HTMLImageElement | null {
  const src = IMAGE_BACKDROPS[regionId];
  if (!src) return null;
  let img = bdImgCache.get(regionId);
  if (!img) {
    img = new Image();
    img.src = src;
    bdImgCache.set(regionId, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

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
  // 이미지 배경: 높이를 지면선에 정합시키고 가로 타일링 (픽셀아트 크리스프 유지)
  const bimg = backdropImage(regionId);
  if (bimg) {
    const icv = document.createElement('canvas');
    icv.width = W;
    icv.height = H;
    const ictx = icv.getContext('2d')!;
    ictx.imageSmoothingEnabled = false;
    const tw = (groundTop / bimg.naturalHeight) * bimg.naturalWidth;
    for (let x = 0, i = 0; x < W; x += tw, i += 1) {
      if (i % 2) { // 미러 타일링 — 하늘 그라데이션 이음새 제거
        ictx.save();
        ictx.translate(x + tw, 0);
        ictx.scale(-1, 1);
        ictx.drawImage(bimg, 0, 0, tw, groundTop);
        ictx.restore();
      } else {
        ictx.drawImage(bimg, x, 0, tw, groundTop);
      }
    }
    ictx.fillStyle = '#1A2740'; // 지면 아래는 기존 지면 톤
    ictx.fillRect(0, groundTop, W, H - groundTop);
    backdropCache.set(key, icv);
    return icv;
  }
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
  if (!IMAGE_BACKDROPS[regionId]) backdropCache.set(key, cv); // 이미지 로딩 중엔 캐시하지 않고 다음 프레임에 재시도
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
  ctx.fillStyle = '#C39C4C'; // 사옥 옥상 투척대 (자동 포탑 발사 원점)
  ctx.fillRect(38, groundTop - 124, 12, 6);
  ctx.fillStyle = '#FFE9C4';
  ctx.fillRect(41, groundTop - 127, 6, 3);
  if (b.rageStage > 0) { // FR-6.10b 위기 반격 — 적 본진 붉은 오라 펄스
    const pulse = (0.22 + 0.14 * Math.sin(b.t * 5)) * b.rageStage;
    const cxr = W - 64;
    const grad = ctx.createRadialGradient(cxr, groundTop - 44, 8, cxr, groundTop - 44, 116);
    grad.addColorStop(0, `rgba(232,101,79,${Math.min(pulse, 0.55)})`);
    grad.addColorStop(1, 'rgba(232,101,79,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(W - 190, groundTop - 164, 190, 172);
  }
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

  // 사망·파괴 연출 (본체 아래 레이어) — death 모션 원샷 + 전용 사망 VFX (드론 자폭·실드 파쇄)
  st.corpses = st.corpses.filter((c) => {
    const phase = (b.t - c.t0) / DEATH_DUR;
    const img = rigFrame(c.rigIdx, 'death', phase, true);
    if (!img) return b.t - c.t0 < 0;
    const w = (c.h * img.width) / img.height;
    ctx.drawImage(img, sx(c.x) - w / 2, c.y - c.h, w, c.h);
    drawRigVfx(ctx, c.rigIdx, 'death', phase, sx(c.x), c.y, c.h / 100); // VFX 없는 리그는 no-op
    return true;
  });

  // 타워 — idle 루프 / 발사·지급 시 attack 원샷 / 방벽 피격 hit
  for (let s = 0; s < b.towers.length; s++) {
    const tx = sx(b.towerSlotX(s));
    const tw = b.towers[s];
    // 파괴 감지 (방벽 소실 → death 연출)
    const prevKey = st.prevTowers[s] ?? null;
    if (prevKey && !tw) {
      st.corpses.push({ rigIdx: RIG_TOWER[prevKey], x: b.towerSlotX(s), y: groundTop, h: 58, t0: b.t });
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
    const rigIdx = RIG_TOWER[tw.key];
    if (tw.maxHp > 0) trackHit(st, `t${s}`, tw.hp, b.t);
    const hitEl = b.t - (st.hitT.get(`t${s}`) ?? -9);
    // 모션 선택: 발리스타=발사 사이클에 attack 스케일 / 금고=지급 직후 attack / 방벽=피격 hit
    let img: HTMLCanvasElement | null = null;
    let atkPhase: number | null = null;
    if (spec.rate > 0 && tw.cooldown > 0) {
      const cycle = 1 / spec.rate;
      atkPhase = (cycle - tw.cooldown) / Math.min(cycle, 1.25);
      img = rigFrame(rigIdx, 'attack', atkPhase, true);
    } else if (spec.incomeAmount > 0) {
      img = rigFrame(rigIdx, 'attack', (spec.incomePeriod - (tw.nextIncomeAt - b.t)) / 1.25, true);
    } else if (hitEl < HIT_DUR) {
      img = rigFrame(rigIdx, 'hit', hitEl / HIT_DUR, true);
    }
    if (!img) img = rigFrame(rigIdx, 'walk', (b.t + s * 0.29) % 1, false); // 타워 walk = 설치+대기 루프
    const hh = 58;
    if (img) {
      const wwt = (hh * img.width) / img.height;
      ctx.drawImage(img, tx - wwt / 2, groundTop - hh, wwt, hh);
    } else {
      ctx.fillStyle = TOWER_COLORS[tw.key];
      ctx.fillRect(tx - 11, groundTop - 36, 22, 34);
    }
    if (atkPhase != null && atkPhase < 1) drawRigVfx(ctx, rigIdx, 'attack', atkPhase, tx, groundTop, 0.6); // 캐논 포구 화염 (타 타워는 no-op)
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
    const rigIdx = RIG_UNIT[u.key];
    const hh = 50;
    trackHit(st, `u${u.id}`, u.hp, b.t);
    const hitEl = b.t - (st.hitT.get(`u${u.id}`) ?? -9);
    const moved = Math.abs(u.x - (st.prevUnits.get(u.id)?.x ?? u.x)) > 0.01;
    const atkEl = UNIT_ATK_DUR - u.shotCd; // 발사 시 shotCd=0.8 리셋 → 경과 위상
    if (SHEET_UNIT[u.key]) { // [임시] 신규 시트 유닛 — 리그 대신 PNG 시트 (스킬 모션 우선)
      const sid = SHEET_UNIT[u.key];
      const skEl = b.t - u.lastSkillAt;
      const skTotal = (SKILL_TOTAL_MS[sid] ?? 0) / 1000;
      if (hasSkillSheet(sid) && skEl >= 0 && skEl < skTotal) {
        drawSkill(ctx, sid, skEl, ux, groundTop);
        hpBar(ctx, ux - 9, groundTop - sheetCharHeight(sid) - 8, 18, u.hp / u.maxHp, '#7BD8A0');
        st.prevUnits.set(u.id, { key: u.key, x: u.x });
        continue;
      }
      const atkEl = UNIT_ATK_DUR - u.shotCd;
      const phase = u.shotCd > 0 && atkEl >= 0 && atkEl < 0.5 ? atkEl / 0.5 : null;
      if (!drawSheetChar(ctx, sid, 'ground', phase, b.t, ux, groundTop)) {
        ctx.fillStyle = '#7BD8A0';
        ctx.beginPath();
        ctx.arc(ux, groundTop - 10, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      // 체력바는 실제 키 위에 (저격수처럼 큰 유닛의 얼굴을 가리지 않도록)
      hpBar(ctx, ux - 9, groundTop - sheetCharHeight(SHEET_UNIT[u.key]) - 8, 18, u.hp / u.maxHp, '#7BD8A0');
      st.prevUnits.set(u.id, { key: u.key, x: u.x });
      continue;
    }
    if (u.key === 'cane') { // 임시 PNG 시트 유닛 — 리그 경로 대신 전용 드로잉
      if (!drawCane(ctx, b.t, u.shotCd, ux, groundTop)) {
        ctx.fillStyle = UNIT_COLORS.cane;
        ctx.beginPath();
        ctx.arc(ux, groundTop - 10, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      hpBar(ctx, ux - 9, groundTop - hh - 8, 18, u.hp / u.maxHp, '#D8C4A8');
      st.prevUnits.set(u.id, { key: u.key, x: u.x });
      continue;
    }
    const knocked = b.t < u.knockUntil; // FR-6.10b 충격파에 밀리는 중 — 뒤로 기울고 먼지가 인다
    const skillEl = b.t - u.lastSkillAt; // FR-6.5b 자동 스킬 시전 연출
    let img: HTMLCanvasElement | null = null;
    if (hitEl < HIT_DUR) img = rigFrame(rigIdx, 'hit', hitEl / HIT_DUR, true);
    else if (skillEl >= 0 && skillEl < SKILL_DUR) img = rigFrame(rigIdx, 'skill', skillEl / SKILL_DUR, true);
    else if (u.shotCd > 0 && atkEl < UNIT_ATK_DUR) img = rigFrame(rigIdx, 'attack', atkEl / UNIT_ATK_DUR, true);
    else if (moved) img = rigFrame(rigIdx, 'walk', (b.t * 0.6 + u.id * 0.37) % 1, false); // 이동속도 절반에 맞춘 보폭
    else img = rigFrame(rigIdx, 'walk', (b.t * 0.35 + u.id * 0.37) % 1, false); // 대기 = 저속 제자리 걸음
    if (img) {
      const wwu = (hh * img.width) / img.height;
      if (knocked) { // 밀려나는 동안 뒤로 기울이고 발밑 먼지
        const kp = 1 - (u.knockUntil - b.t) / 0.9;
        ctx.save();
        ctx.translate(ux, groundTop);
        ctx.rotate(-0.22 * Math.sin(Math.PI * Math.max(0, Math.min(1, kp))));
        ctx.drawImage(img, -wwu / 2, -hh, wwu, hh);
        ctx.restore();
        ctx.fillStyle = `rgba(200,180,150,${0.4 * (1 - kp)})`;
        for (let d = 0; d < 3; d++) {
          const dr = 4 + kp * 16 + d * 5;
          ctx.beginPath();
          ctx.arc(ux + 8 + d * 7 + kp * 14, groundTop - 3 - d * 2, Math.max(1, 5 - d), 0, Math.PI * 2);
          ctx.fill();
          void dr;
        }
      } else {
        ctx.drawImage(img, ux - wwu / 2, groundTop - hh, wwu, hh);
      }
    } else {
      ctx.fillStyle = UNIT_COLORS[u.key];
      ctx.beginPath();
      ctx.arc(ux, groundTop - 10, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (skillEl >= 0 && skillEl < SKILL_DUR) drawRigVfx(ctx, rigIdx, 'skill', skillEl / SKILL_DUR, ux, groundTop, 0.55);
    hpBar(ctx, ux - 9, groundTop - hh - 8, 18, u.hp / u.maxHp, '#7BD8A0');
    st.prevUnits.set(u.id, { key: u.key, x: u.x });
  }
  // 유닛 소멸 감지 → 사망 애니메이션 (엔진은 유닛 death fx를 만들지 않는다)
  for (const [id, info] of st.prevUnits) {
    if (liveUnits.has(id)) continue;
    st.prevUnits.delete(id);
    st.lastHp.delete(`u${id}`);
    st.hitT.delete(`u${id}`);
    if (b.phase !== 'done' && RIG_UNIT[info.key] != null) { // 시트 유닛(프리뷰)은 사망 연출 없음
      st.corpses.push({ rigIdx: RIG_UNIT[info.key], x: info.x, y: groundTop, h: 50, t0: b.t });
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
    const rigIdx = RIG_ENEMY[e.type];
    const hh = e.air ? 36 : Math.min(34 + e.size * 2.4, 72);
    const topY = e.air ? AIR_Y - hh / 2 : groundTop - hh;
    trackHit(st, `e${e.id}`, e.hp, b.t);
    const hitEl = b.t - (st.hitT.get(`e${e.id}`) ?? -9);
    const prevX = st.prevEnemies.get(e.id)?.x;
    const moved = prevX == null || Math.abs(e.x - prevX) > 0.01;
    const eSkillEl = b.t - (e.lastSkillAt ?? -9); // FR-6.7b 적 자동 스킬 연출
    // [임시] 신규 시트 적 — 리그 대신 PNG 시트 (스킬 → 교전 → 이동 순 우선)
    const esid = enemySheetId(e.type, b.params.regionId);
    const eskTotal = (SKILL_TOTAL_MS[esid] ?? 0) / 1000;
    const eBaseY = e.air ? AIR_Y + hh / 2 : groundTop;
    let drawn = false;
    if (!stunned && hasSkillSheet(esid) && eSkillEl >= 0 && eSkillEl < eskTotal) {
      drawn = drawSkill(ctx, esid, eSkillEl, ex, eBaseY);
    }
    if (!drawn) {
      const engagedNow = !moved && !stunned;
      const aPhase = engagedNow ? ((b.t + e.id * 0.41) % 0.6) / 0.6 : null;
      drawn = drawSheetChar(ctx, esid, e.type === 'boss' ? 'boss' : e.air ? 'air' : 'ground', aPhase, b.t + e.id * 0.41, ex, eBaseY);
    }
    if (drawn) {
      if (slowed) { // 슬로우 표시는 오버레이로 (시트에 필터를 걸면 매 프레임 비용이 큼)
        ctx.fillStyle = 'rgba(94,154,160,0.22)';
        ctx.fillRect(ex - 18, topY, 36, hh);
      }
      const bw2 = e.type === 'boss' ? 34 : 18;
      hpBar(ctx, ex - bw2 / 2, (e.air ? AIR_Y + hh / 2 : groundTop) - sheetCharHeight(esid) - 8, bw2, e.hp / e.maxHp, col);
      if (stunned) {
        ctx.fillStyle = '#FFC53D';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✶', ex, topY - 10);
      }
      st.prevEnemies.set(e.id, { type: e.type, x: e.x, air: e.air, h: hh });
      continue;
    }
    let img: HTMLCanvasElement | null = null;
    if (stunned) img = rigFrame(rigIdx, 'hit', 0.55, true); // 경직 프레임 고정
    else if (hitEl < HIT_DUR) img = rigFrame(rigIdx, 'hit', hitEl / HIT_DUR, true);
    else if (eSkillEl >= 0 && eSkillEl < SKILL_DUR) img = rigFrame(rigIdx, 'skill', eSkillEl / SKILL_DUR, true);
    else if (!moved) img = rigFrame(rigIdx, 'attack', ((b.t + e.id * 0.41) % 1.25) / 1.25, false); // 교전 루프 (저작 1.25s)
    else img = rigFrame(rigIdx, 'walk', (b.t + e.id * 0.41) % 1, false);
    if (img) {
      const wwe = (hh * img.width) / img.height;
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
    if (!stunned && eSkillEl >= 0 && eSkillEl < SKILL_DUR) {
      drawRigVfx(ctx, rigIdx, 'skill', eSkillEl / SKILL_DUR, ex, e.air ? AIR_Y + hh / 2 : groundTop, hh / 95);
    }
    const bw = e.type === 'boss' ? 34 : 18;
    hpBar(ctx, ex - bw / 2, topY - 7, bw, e.hp / e.maxHp, col);
    st.prevEnemies.set(e.id, { type: e.type, x: e.x, air: e.air, h: hh });
  }
  // 적 소멸 감지 → 사망 애니메이션 (도달 소멸 포함 — 본진 앞에서 쓰러진다)
  for (const [id, info] of st.prevEnemies) {
    if (liveEnemies.has(id)) continue;
    st.prevEnemies.delete(id);
    st.lastHp.delete(`e${id}`);
    st.hitT.delete(`e${id}`);
    // [임시] 적이 PNG 시트로 교체된 동안에는 리그 사망 연출을 쓰지 않는다 (시트에 death 모션 없음)
    void RIG_ENEMY;
  }

  // 투사체 — 사옥 자동 포탑=옥상 투척 골드 주머니(포물선) / 타워·유닛=팔레트 볼트, 소멸 시 충격파 vfx
  const liveProj = new Set<number>();
  for (const p of b.projectiles) {
    liveProj.add(p.id);
    const px = sx(p.x);
    const prev = st.prevProj.get(p.id);
    const isBase = prev ? !!prev.base : p.fromTower && p.x < 70; // 사옥 발사 원점(x=20) 식별
    const x0 = prev?.x0 ?? p.x;
    if (isBase) {
      // 투척 궤적: 옥상에서 목표 레인까지 포물선 낙하
      const laneY = (p.air ? AIR_Y : GROUND_Y) - 8;
      const roofY = groundTop - 118;
      const prog = Math.max(0, Math.min(1, (p.x - x0) / 220));
      const y = roofY + (laneY - roofY) * prog - 46 * Math.sin(Math.PI * prog);
      ctx.save();
      ctx.shadowColor = '#FFC53D';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#C39C4C';
      ctx.beginPath();
      ctx.arc(px, y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#8A6510'; // 주머니 매듭
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, y - 6, 2.6, 0, Math.PI * 2);
      ctx.stroke();
      const spin = b.t * 9 + p.id;
      ctx.fillStyle = '#FFE9C4';
      ctx.fillRect(px + Math.cos(spin) * 3 - 1.5, y + Math.sin(spin) * 3 - 1.5, 3, 3);
      ctx.restore();
    } else if (!p.fromTower && drawShot(ctx, 'A-02_3', 'ally', b.t + p.id, px, (p.air ? AIR_Y : GROUND_Y) - 6, null)) {
      // [임시] 아군 유닛 투사체 — 신규 시트 (저격탄 공용)
    } else {
      const y = (p.air ? AIR_Y : GROUND_Y) - (p.fromTower ? 14 : 4) + Math.sin(p.x * 0.15) * 2;
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
    }
    st.prevProj.set(p.id, { x: p.x, air: p.air, fromTower: p.fromTower, base: isBase, x0 });
  }
  // 소멸한 투사체 → 착탄 충격파 (사옥 투척은 더 크게)
  for (const [id, info] of st.prevProj) {
    if (liveProj.has(id)) continue;
    st.prevProj.delete(id);
    const size = info.base ? 52 : info.fromTower ? 34 : 26;
    pushVfx(st, 'ally_pierce-shockwave', info.x, (info.air ? AIR_Y : GROUND_Y) - 12, b.t, info.base ? 0.38 : 0.28, 12, size);
  }

  // 엔진 fx 이벤트 → 리그 캔버스 VFX 원샷 (배당 지급=금고 코인 흡수 / 공시폭탄=메테오)
  for (const f of b.fx) {
    if (f.t <= st.lastFxT) continue;
    if (f.kind === 'gold' && f.amount > 0) {
      st.rigVfx.push({ idx: RIG_TOWER.dividend, motion: 'skill', x: f.x, y: groundTop, scale: 0.6, t0: f.t, dur: 0.9 });
    } else if (f.kind === 'skill') {
      st.rigVfx.push({ idx: 5, motion: 'skill', x: f.x, y: groundTop, scale: 1.6, t0: f.t, dur: 1.1 }); // 레버리지 술사 메테오
    }
    if (st.rigVfx.length > 40) st.rigVfx.splice(0, st.rigVfx.length - 40);
  }
  st.lastFxT = b.t;

  // 리그 VFX 원샷 재생
  st.rigVfx = st.rigVfx.filter((v) => {
    const p = (b.t - v.t0) / v.dur;
    if (p >= 1) return false;
    if (p >= 0) drawRigVfx(ctx, v.idx, v.motion, p, sx(v.x), v.y, v.scale);
    return true;
  });

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

  // FR-6.10b 위기 반격 충격파 — 적 본진에서 퍼지는 돔 (아군을 중원까지 밀어내는 연출)
  const shockEl = b.t - b.rageAt;
  if (shockEl >= 0 && shockEl < 1.1) {
    const p = shockEl / 1.1;
    const originX = W - 60;
    const r = 60 + (W * 0.8) * (1 - Math.pow(1 - p, 2)); // 빠르게 퍼졌다 감속
    const alpha = Math.pow(1 - p, 1.6);
    ctx.save();
    ctx.beginPath(); // 지면 위 반구만 보이도록 클리핑
    ctx.rect(0, 0, W, groundTop);
    ctx.clip();
    const g2 = ctx.createRadialGradient(originX, groundTop, Math.max(r * 0.55, 1), originX, groundTop, Math.max(r, 2));
    g2.addColorStop(0, 'rgba(232,101,79,0)');
    g2.addColorStop(0.82, `rgba(232,101,79,${0.16 * alpha})`);
    g2.addColorStop(1, `rgba(255,158,134,${0.5 * alpha})`);
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(originX, groundTop, r, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,214,196,${0.85 * alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(originX, groundTop, r, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = `rgba(232,101,79,${0.45 * alpha})`; // 후행 링
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(originX, groundTop, Math.max(r - 26, 1), Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawPreviews(ctx, b.t, sx, groundTop, AIR_Y); // [임시] 신규 아트 프리뷰 (엔진 무관)

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
