// FR-6.1 일자형 전투 렌더러 — Battle 엔진 상태를 그리기만 한다 (로직·렌더 분리, §11)
import { BASE_TURRET, ENEMY_TYPES, TOWERS, type Battle, type Enemy } from '@tf/shared';

const AIR_Y = 48;
const GROUND_Y = 150;

const ENEMY_COLORS: Record<Enemy['type'], string> = {
  grunt: '#e05656', runner: '#ff8a5c', tank: '#a04848', shield: '#c9a84a',
  healer: '#6fdc9f', air: '#e88ab0', boss: '#c22a2a',
};
const UNIT_COLORS = { intern: '#9be89b', analyst: '#5ecf9e', trader: '#2eaf5e' };
const TOWER_COLORS = { basic: '#7ab6ff', aa: '#b98aff', splash: '#ffb36b' };
const MODE_LABEL = { first: '선두', last: '후미', strong: '강적', close: '근접' };

export function drawBattle(canvas: HTMLCanvasElement, b: Battle, shake: number, selectedSlot: number | null) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const sx = (x: number) => (x / 1000) * W;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.clearRect(-8, -8, W + 16, H + 16);

  // 바닥
  ctx.fillStyle = '#20202c';
  ctx.fillRect(0, GROUND_Y + 16, W, H - GROUND_Y - 16);
  ctx.strokeStyle = '#34344a';
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 16); ctx.lineTo(W, GROUND_Y + 16); ctx.stroke();

  // 선택 타워 사거리 원 (설치 판단용)
  if (selectedSlot != null) {
    const tw = b.towers[selectedSlot];
    const tx = sx(b.towerSlotX(selectedSlot));
    const range = tw ? TOWERS.find((s) => s.key === tw.key)!.range : 420;
    ctx.fillStyle = 'rgba(90,120,255,0.07)';
    ctx.strokeStyle = 'rgba(90,120,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(tx, GROUND_Y - 10, sx(range), 46, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  // 본진 (사옥 + 자동 포탑) / 적 본진
  drawBase(ctx, 8, GROUND_Y - 50, 40, 64, '#5c78c9', b.baseHP / 100, '사옥');
  ctx.fillStyle = '#8aa2e8';
  ctx.fillRect(44, GROUND_Y - 58, 8, 12); // 사옥 자동 포탑 총구
  drawBase(ctx, W - 48, GROUND_Y - 50, 40, 64, '#c95c5c', b.enemyBaseHP / 300, '베어');

  // 타워
  for (let s = 0; s < b.towers.length; s++) {
    const tx = sx(b.towerSlotX(s));
    const tw = b.towers[s];
    if (!tw) {
      ctx.strokeStyle = s === selectedSlot ? '#7a9aff' : '#3c3c52';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(tx - 12, GROUND_Y - 24, 24, 36);
      ctx.setLineDash([]);
      ctx.fillStyle = '#55556a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s + 1}`, tx, GROUND_Y - 4);
      continue;
    }
    const col = TOWER_COLORS[tw.key];
    ctx.fillStyle = col;
    ctx.fillRect(tx - 11, GROUND_Y - 22, 22, 34);
    if (tw.lv === 2) {
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(tx - 11, GROUND_Y - 28, 22, 5);
    }
    // 타겟팅 모드 배지 (Bloons)
    ctx.fillStyle = '#14141c';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(MODE_LABEL[tw.mode], tx, GROUND_Y - 8);
  }

  // 유닛
  for (const u of b.units) {
    const ux = sx(u.x);
    const col = UNIT_COLORS[u.key];
    const r = u.key === 'trader' ? 9 : u.key === 'intern' ? 7 : 8;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(ux, GROUND_Y, r, 0, Math.PI * 2);
    ctx.fill();
    if (u.key === 'analyst') { // 원거리 표시
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(ux + r, GROUND_Y - 3); ctx.lineTo(ux + r + 6, GROUND_Y - 3); ctx.stroke();
    }
    hpBar(ctx, ux - 9, GROUND_Y - 18, 18, u.hp / u.maxHp, '#6fdc6f');
  }

  // 적 (타입별 형태 + 상태 표시)
  for (const e of b.enemies) {
    const ex = sx(e.x);
    const y = e.air ? AIR_Y : GROUND_Y;
    const col = ENEMY_COLORS[e.type];
    const slowed = b.t < e.slowUntil;
    const stunned = b.t < e.stunUntil;
    ctx.fillStyle = slowed ? '#7ab0e0' : col;
    if (e.air) {
      ctx.beginPath();
      ctx.moveTo(ex, y - e.size);
      ctx.lineTo(ex - e.size, y + e.size * 0.7);
      ctx.lineTo(ex + e.size, y + e.size * 0.7);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'tank' || e.type === 'shield' || e.type === 'boss') {
      ctx.fillRect(ex - e.size, y - e.size, e.size * 2, e.size * 2); // 중장갑 = 사각
      if (e.type === 'shield') { // 방패 테두리
        ctx.strokeStyle = '#ffe9a8';
        ctx.lineWidth = 2;
        ctx.strokeRect(ex - e.size, y - e.size, e.size * 2, e.size * 2);
        ctx.lineWidth = 1;
      }
    } else {
      ctx.beginPath();
      ctx.arc(ex, y, e.size, 0, Math.PI * 2);
      ctx.fill();
      if (e.type === 'healer') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex - 1.5, y - 5, 3, 10);
        ctx.fillRect(ex - 5, y - 1.5, 10, 3);
      }
    }
    if (stunned) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✶', ex, y - e.size - 10);
    }
    const bw = e.type === 'boss' ? 34 : 18;
    hpBar(ctx, ex - bw / 2, y - e.size - 8, bw, e.hp / e.maxHp, col);
  }

  // 투사체 (마법=보라, 물리=밝은 점)
  for (const p of b.projectiles) {
    const y = (p.air ? AIR_Y : GROUND_Y) - (p.fromTower ? 14 : 4);
    ctx.fillStyle = p.dmgType === 'magic' ? '#c98aff' : '#ffe9a8';
    ctx.beginPath();
    ctx.arc(sx(p.x), y + Math.sin(p.x * 0.15) * 2, p.splashRadius > 0 ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 이펙트: 데미지 숫자 · 사망 · 힐 · 스킬
  ctx.textAlign = 'center';
  for (const f of b.fx) {
    const age = b.t - f.t;
    const alpha = Math.max(0, 1 - age / 1.2);
    const y = (f.air ? AIR_Y : GROUND_Y) - 18 - age * 22;
    if (f.kind === 'dmg' && f.amount > 0) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffe9a8';
      ctx.font = f.amount >= 30 ? 'bold 12px monospace' : '10px monospace';
      ctx.fillText(String(f.amount), sx(f.x), y);
    } else if (f.kind === 'death') {
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = '#9a9ab0';
      const r = 4 + age * 14;
      ctx.beginPath();
      ctx.arc(sx(f.x), f.air ? AIR_Y : GROUND_Y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'skill') {
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#c98aff';
      ctx.fillRect(0, GROUND_Y - 40 + age * 20, W, 44 - age * 20);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBase(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, hpRate: number, label: string) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#14141c';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
  hpBar(ctx, x, y - 8, w, hpRate, col);
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rate: number, col: string) {
  ctx.fillStyle = '#101018';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, rate)), 4);
}

export { ENEMY_TYPES, BASE_TURRET };
