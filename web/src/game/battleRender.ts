// FR-6.1 일자형 전투 렌더러 — Battle 엔진 상태를 그리기만 한다 (로직·렌더 분리, §11)
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

// ─── 유닛·타워·기지 SVG 스프라이트 (Units/Bases 컨셉 시트) ───
// 시트 직군 매핑: 인턴(블로커)→밸류 홀더 / 애널리스트→애널리스트 / 트레이더(근접)→스캘퍼 / 리스크 매니저→리스크 매니저
const UNIT_SPRITE: Record<string, string> = { intern: 'holder', analyst: 'analyst', trader: 'scalper', riskmgr: 'riskmgr' };
const TOWER_SPRITE: Record<string, string> = { limit: 'limit', dividend: 'dividend', barrier: 'barrier' };
const ENEMY_SPRITE: Record<Enemy['type'], string> = {
  grunt: 'broker', runner: 'ronin', tank: 'golem', shield: 'bureaucrat',
  healer: 'bureaucrat', air: 'algobot', boss: 'giant',
};
const sprCache = new Map<string, HTMLImageElement>();

// ─── 공격·피격 이펙트 오버레이 (시트 11종 × 3프레임, 유닛 위 별도 레이어) ───
const FX_FRAME_DUR = 0.09; // 프레임당 초 (배틀 시계 기준)
const FX_TOTAL = FX_FRAME_DUR * 3;

interface FxAnim { name: string; x: number; y: number; t0: number; size: number }
interface RenderFxState {
  anims: FxAnim[];
  lastFxT: number; // 엔진 fx 이벤트 처리 커서
  prevProj: Map<number, { x: number; air: boolean; fromTower: boolean }>;
}
const fxStates = new WeakMap<Battle, RenderFxState>();

function fxStateOf(b: Battle): RenderFxState {
  let st = fxStates.get(b);
  if (!st) {
    st = { anims: [], lastFxT: 0, prevProj: new Map() };
    fxStates.set(b, st);
  }
  return st;
}

function pushAnim(st: RenderFxState, name: string, x: number, y: number, size: number, t: number) {
  st.anims.push({ name, x, y, t0: t, size });
  if (st.anims.length > 60) st.anims.splice(0, st.anims.length - 60);
}

/** 진행 중 애니메이션 프레임 이미지 (0~2), 만료 시 null */
function fxFrame(name: string, elapsed: number): HTMLImageElement | null {
  if (elapsed < 0 || elapsed >= FX_TOTAL) return null;
  return spr(`${name}_${Math.min(Math.floor(elapsed / FX_FRAME_DUR), 2) + 1}`);
}

/** 주기 루프 연출 (교전 검격·헤지 오라 등): period마다 3프레임 재생 */
function drawCycleFx(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, t: number, period: number, phase: number) {
  const local = (t + phase) % period;
  const img = fxFrame(name, local);
  if (img) ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
}

function unitEngaged(b: Battle, x: number): boolean {
  return b.enemies.some((e) => !e.air && e.x - x >= -6 && e.x - x <= 30);
}

function spr(name: string): HTMLImageElement | null {
  let img = sprCache.get(name);
  if (!img) {
    img = new Image();
    img.src = `/assets/sprites/${name}.svg`;
    sprCache.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
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

  // 본진 (사옥 + 자동 포탑) / 적 본진
  // 기지 — 체력 3상태 스프라이트 (정상 / 손상 59~25% / 위기 24~0%)
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

  // 타워 — 대기/작동 2상태 스프라이트
  for (let s = 0; s < b.towers.length; s++) {
    const tx = sx(b.towerSlotX(s));
    const tw = b.towers[s];
    if (!tw) {
      ctx.strokeStyle = s === selectedSlot ? '#7BD8A0' : '#3E5570';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(tx - 12, groundTop - 40, 24, 38);
      ctx.setLineDash([]);
      ctx.fillStyle = '#4E5B72';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s + 1}`, tx, groundTop - 18);
      continue;
    }
    const spec = TOWERS.find((t) => t.key === tw.key)!;
    // 작동 프레임: 포탑=발사 직후 / 배당=지급 직후 / 방벽=손상 상태
    const active = spec.rate > 0
      ? tw.cooldown > (1 / spec.rate) * 0.55
      : spec.incomeAmount > 0
        ? tw.nextIncomeAt - b.t > spec.incomePeriod - 0.8
        : tw.hp < tw.maxHp;
    const img = spr(`${TOWER_SPRITE[tw.key]}_${active ? 'active' : 'idle'}`);
    if (img) {
      const hh = 54;
      const wwt = (hh * 80) / 112;
      ctx.drawImage(img, tx - wwt / 2, groundTop - hh, wwt, hh);
    } else {
      ctx.fillStyle = TOWER_COLORS[tw.key];
      ctx.fillRect(tx - 11, groundTop - 36, 22, 34);
    }
    if (tw.lv === 2) {
      ctx.fillStyle = '#FFC53D';
      ctx.fillRect(tx - 12, groundTop - 60, 24, 4);
    }
    if (tw.maxHp > 0) hpBar(ctx, tx - 12, groundTop - 62, 24, tw.hp / tw.maxHp, '#7C89A3'); // 방벽 내구
    if (spec.dmg > 0) { // 타겟팅 모드 배지 (공격 타워만)
      ctx.fillStyle = '#7C89A3';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(MODE_LABEL[tw.mode], tx, groundTop + 12);
    }
  }

  // 유닛 — 컨셉 시트 스프라이트 (IDLE/WALK 교대 + 사격 직후 ATK) + 직군별 이펙트
  const walkFrame = Math.floor(b.t * 4) % 2 === 0;
  for (const u of b.units) {
    const ux = sx(u.x);
    const pose = u.shotCd > 0.45 ? 'atk' : walkFrame ? 'walk' : 'idle';
    const img = spr(`${UNIT_SPRITE[u.key]}_${pose}`);
    const hh = u.key === 'trader' ? 42 : u.key === 'intern' ? 46 : 44;
    if (img) {
      const wwu = (hh * 80) / 112;
      ctx.drawImage(img, ux - wwu / 2, groundTop - hh, wwu, hh);
    } else {
      ctx.fillStyle = UNIT_COLORS[u.key];
      ctx.beginPath();
      ctx.arc(ux, groundTop - 10, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    const midY = groundTop - hh * 0.55;
    if ((u.key === 'trader' || u.key === 'intern') && u.shotCd > 0) { // 근접 검격 (발사 후 경과로 프레임)
      const fimg = fxFrame('fx_slash', 0.8 - u.shotCd);
      if (fimg) ctx.drawImage(fimg, ux + 6, midY - 16, 32, 32);
    }
    if (u.key === 'intern' && unitEngaged(b, u.x)) { // 탱커 방어 임팩트 (피격 중)
      drawCycleFx(ctx, 'fx_guard', ux, midY, 30, b.t, 1.3, u.id * 0.31);
    }
    if (u.key === 'riskmgr') { // 헤지 오라 펄스
      drawCycleFx(ctx, 'fx_hedge', ux, groundTop - hh - 16, 28, b.t, 2.4, u.id * 0.5);
    }
    hpBar(ctx, ux - 9, groundTop - hh - 8, 18, u.hp / u.maxHp, '#7BD8A0');
  }

  // 적 — 지역 컨셉 스프라이트 (걷기/공격 포즈, 슬로우·힐러는 필터 변주)
  for (const e of b.enemies) {
    const ex = sx(e.x);
    const col = ENEMY_COLORS[e.type];
    const slowed = b.t < e.slowUntil;
    const stunned = b.t < e.stunUntil;
    const hh = e.air ? 34 : Math.min(30 + e.size * 2.4, 68);
    const topY = e.air ? AIR_Y - hh / 2 : groundTop - hh;
    const engaged = !e.air && b.units.some((u) => e.x - u.x >= -6 && e.x - u.x <= 30);
    const pose = stunned ? 'idle' : engaged ? 'atk' : walkFrame ? 'walk' : 'idle';
    const img = spr(`${ENEMY_SPRITE[e.type]}_${pose}`);
    if (img) {
      const wwe = (hh * 80) / 112;
      const filters: string[] = [];
      if (e.type === 'healer') filters.push('hue-rotate(130deg) saturate(1.1)'); // 관료 색 변주 = 리스크 헤지
      if (slowed) filters.push('saturate(0.4) brightness(0.8)');
      if (filters.length) ctx.filter = filters.join(' ');
      ctx.drawImage(img, ex - wwe / 2, topY, wwe, hh);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = slowed ? '#5E9AA0' : col;
      ctx.beginPath();
      ctx.arc(ex, e.air ? AIR_Y : groundTop - e.size, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (engaged && !stunned) { // 적 근접 타격 이펙트 (중장갑·보스는 충격파)
      const fxName = e.type === 'tank' || e.type === 'boss' ? 'fx_shock' : 'fx_slash_foe';
      drawCycleFx(ctx, fxName, ex - 24, groundTop - hh * 0.5, e.type === 'boss' ? 40 : 30, b.t, 1.1, e.id * 0.37);
    }
    if (stunned) {
      ctx.fillStyle = '#FFC53D';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✶', ex, topY - 10);
    }
    const bw = e.type === 'boss' ? 34 : 18;
    hpBar(ctx, ex - bw / 2, topY - 7, bw, e.hp / e.maxHp, col);
  }

  // 투사체 — 타워=레일 트레이서 / 애널리스트=지표 오브 (프레임 순환)
  const liveProj = new Set<number>();
  for (const p of b.projectiles) {
    liveProj.add(p.id);
    const y = (p.air ? AIR_Y : GROUND_Y) - (p.fromTower ? 14 : 4) + Math.sin(p.x * 0.15) * 2;
    const name = p.fromTower ? 'fx_rail' : 'fx_orb';
    const img = spr(`${name}_${(Math.floor(b.t / FX_FRAME_DUR) + p.id) % 3 + 1}`);
    if (img) {
      const size = p.fromTower ? 26 : 20;
      ctx.drawImage(img, sx(p.x) - size / 2, y - size / 2, size, size);
    } else {
      ctx.fillStyle = p.dmgType === 'magic' ? '#C4A8FF' : '#FFE9C4';
      ctx.beginPath();
      ctx.arc(sx(p.x), y, p.splashRadius > 0 ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    st.prevProj.set(p.id, { x: p.x, air: p.air, fromTower: p.fromTower });
  }
  // 소멸한 애널리스트 투사체 → 광역 리포트 착탄 연출
  for (const [id, info] of st.prevProj) {
    if (liveProj.has(id)) continue;
    st.prevProj.delete(id);
    if (!info.fromTower) {
      pushAnim(st, 'fx_report', info.x, info.air ? AIR_Y : GROUND_Y - 12, 34, b.t);
    }
  }

  // 엔진 fx 이벤트 → 오버레이 애니메이션 (피격 스파크 / 배당 획득)
  for (const f of b.fx) {
    if (f.t <= st.lastFxT) continue;
    if (f.kind === 'dmg' && f.amount > 0) {
      pushAnim(st, 'fx_spark', f.x, (f.air ? AIR_Y : GROUND_Y) - 14, 22, f.t);
    } else if (f.kind === 'gold' && f.amount > 0) {
      pushAnim(st, 'fx_dividend', f.x, GROUND_Y - 40, 30, f.t);
    }
  }
  st.lastFxT = b.t;

  // 이펙트: 데미지 숫자 · 사망 · 힐 · 스킬
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
    } else if (f.kind === 'death') {
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = '#A9B6C4';
      const r = 4 + age * 14;
      ctx.beginPath();
      ctx.arc(sx(f.x), f.air ? AIR_Y : GROUND_Y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'skill') {
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#9B6BFF';
      ctx.fillRect(0, GROUND_Y - 40 + age * 20, W, 44 - age * 20);
    }
    ctx.globalAlpha = 1;
  }

  // 오버레이 이펙트 애니메이션 재생 (피격 스파크·광역 리포트·배당 획득 — 최상단 레이어)
  st.anims = st.anims.filter((a) => {
    const img = fxFrame(a.name, b.t - a.t0);
    if (!img) return b.t - a.t0 < 0; // 만료 제거
    ctx.drawImage(img, sx(a.x) - a.size / 2, a.y - a.size / 2, a.size, a.size);
    return true;
  });
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
