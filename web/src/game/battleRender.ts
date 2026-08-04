// FR-6.1 일자형 전투 렌더러 — Battle 엔진 상태를 그리기만 한다 (로직·렌더 분리, §11)
import { BASE_TURRET, ENEMY_TYPES, TOWERS, type Battle, type Enemy } from '@tf/shared';

const AIR_Y = 48;
const GROUND_Y = 150;

const ENEMY_COLORS: Record<Enemy['type'], string> = {
  grunt: '#E8654F', runner: '#FF9E86', tank: '#A83A2E', shield: '#C9A84A',
  healer: '#8FD8B0', air: '#E8A0B4', boss: '#C22A2A',
};
const UNIT_COLORS = { intern: '#7BD8A0', analyst: '#46A574', trader: '#3E8C68' };
const TOWER_COLORS = { basic: '#4E7FB8', aa: '#9B6BFF', splash: '#F79B76' };
const MODE_LABEL = { first: '선두', last: '후미', strong: '강적', close: '근접' };

// 석양 8단계 램프 (목업 04번 전장 하늘)
const SKY_RAMP = ['#17223A', '#3A3350', '#6E4358', '#B0565A', '#D96A5C', '#F79B76', '#FFC48E'];
// 원경 실루엣: 좌 = 아군 그린 지구, 우 = 베어 요새 레드 지구 (x는 0~1000 논리 좌표)
const SKYLINE: { x: number; w: number; h: number; col: string }[] = [
  { x: 30, w: 60, h: 76, col: '#173C31' }, { x: 105, w: 44, h: 52, col: '#12332A' },
  { x: 160, w: 52, h: 88, col: '#173C31' }, { x: 225, w: 40, h: 44, col: '#12332A' },
  { x: 300, w: 56, h: 62, col: '#1B4636' },
  { x: 640, w: 48, h: 50, col: '#5E2019' }, { x: 700, w: 60, h: 80, col: '#7A2A20' },
  { x: 775, w: 40, h: 58, col: '#5E2019' }, { x: 830, w: 56, h: 94, col: '#7A2A20' },
  { x: 900, w: 44, h: 66, col: '#5E2019' }, { x: 950, w: 48, h: 84, col: '#7A2A20' },
];

export function drawBattle(canvas: HTMLCanvasElement, b: Battle, shake: number, selectedSlot: number | null) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const sx = (x: number) => (x / 1000) * W;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.clearRect(-8, -8, W + 16, H + 16);

  // 하늘 (석양 램프 + 디더 경계) / 원경 실루엣 / 지면
  const groundTop = GROUND_Y + 16;
  const bandH = Math.ceil(groundTop / SKY_RAMP.length);
  for (let i = 0; i < SKY_RAMP.length; i++) {
    ctx.fillStyle = SKY_RAMP[i];
    ctx.fillRect(-8, i * bandH, W + 16, bandH);
    if (i > 0) { // 4px 체커 디더
      for (let x = 0; x < W; x += 8) {
        ctx.fillRect(x + ((i % 2) * 4), i * bandH - 4, 4, 4);
      }
    }
  }
  for (const bd of SKYLINE) {
    ctx.fillStyle = bd.col;
    ctx.fillRect(sx(bd.x), groundTop - bd.h, sx(bd.w), bd.h);
  }
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
  drawBase(ctx, 8, GROUND_Y - 50, 40, 64, '#46A574', '#0C1A12', b.baseHP / 100, '사옥');
  ctx.fillStyle = '#7BD8A0';
  ctx.fillRect(44, GROUND_Y - 58, 8, 12); // 사옥 자동 포탑 총구
  drawBase(ctx, W - 48, GROUND_Y - 50, 40, 64, '#A83A2E', '#FFE9C4', b.enemyBaseHP / 300, '베어');

  // 타워
  for (let s = 0; s < b.towers.length; s++) {
    const tx = sx(b.towerSlotX(s));
    const tw = b.towers[s];
    if (!tw) {
      ctx.strokeStyle = s === selectedSlot ? '#7BD8A0' : '#3E5570';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(tx - 12, GROUND_Y - 24, 24, 36);
      ctx.setLineDash([]);
      ctx.fillStyle = '#4E5B72';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s + 1}`, tx, GROUND_Y - 4);
      continue;
    }
    const col = TOWER_COLORS[tw.key];
    ctx.fillStyle = col;
    ctx.fillRect(tx - 11, GROUND_Y - 22, 22, 34);
    if (tw.lv === 2) {
      ctx.fillStyle = '#FFC53D';
      ctx.fillRect(tx - 11, GROUND_Y - 28, 22, 5);
    }
    // 타겟팅 모드 배지 (Bloons)
    ctx.fillStyle = '#0A0E14';
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
    hpBar(ctx, ux - 9, GROUND_Y - 18, 18, u.hp / u.maxHp, '#7BD8A0');
  }

  // 적 (타입별 형태 + 상태 표시)
  for (const e of b.enemies) {
    const ex = sx(e.x);
    const y = e.air ? AIR_Y : GROUND_Y;
    const col = ENEMY_COLORS[e.type];
    const slowed = b.t < e.slowUntil;
    const stunned = b.t < e.stunUntil;
    ctx.fillStyle = slowed ? '#5E9AA0' : col;
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
        ctx.strokeStyle = '#FFE9C4';
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
      ctx.fillStyle = '#FFC53D';
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
    ctx.fillStyle = p.dmgType === 'magic' ? '#C4A8FF' : '#FFE9C4';
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
      ctx.fillStyle = '#FFE9C4';
      ctx.font = f.amount >= 30 ? 'bold 12px monospace' : '10px monospace';
      ctx.fillText(String(f.amount), sx(f.x), y);
    } else if (f.kind === 'aum' && f.amount > 0) { // 처치 AUM 보상 (보라)
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#C4A8FF';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`+${f.amount}`, sx(f.x), y - 10);
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
