// FR-6.1 일자형 전투 렌더러 — Battle 엔진 상태를 그리기만 한다 (로직·렌더 분리, §11)
import { FIELD_W, TOWERS, type Battle } from '@tf/shared';

const AIR_Y = 52;
const GROUND_Y = 150;

export function drawBattle(canvas: HTMLCanvasElement, b: Battle, shake: number) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const sx = (x: number) => (x / FIELD_W) * W;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.clearRect(-8, -8, W + 16, H + 16);

  // 바닥
  ctx.fillStyle = '#20202c';
  ctx.fillRect(0, GROUND_Y + 14, W, H - GROUND_Y - 14);
  ctx.strokeStyle = '#34344a';
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 14); ctx.lineTo(W, GROUND_Y + 14); ctx.stroke();

  // 본진 (사옥)
  drawBase(ctx, 8, GROUND_Y - 52, 40, 66, '#5c78c9', b.baseHP / 100, '사옥');
  drawBase(ctx, W - 48, GROUND_Y - 52, 40, 66, '#c95c5c', b.enemyBaseHP / 300, '베어');

  // 타워 슬롯
  for (let s = 0; s < b.towers.length; s++) {
    const tx = sx(b.towerSlotX(s));
    const tw = b.towers[s];
    if (!tw) {
      ctx.strokeStyle = '#3c3c52';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(tx - 12, GROUND_Y - 26, 24, 36);
      ctx.setLineDash([]);
      ctx.fillStyle = '#55556a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s + 1}`, tx, GROUND_Y - 6);
    } else {
      const col = tw.key === 'basic' ? '#7ab6ff' : tw.key === 'aa' ? '#b98aff' : '#ffb36b';
      ctx.fillStyle = col;
      ctx.fillRect(tx - 11, GROUND_Y - 24, 22, 34);
      if (tw.lv === 2) {
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(tx - 11, GROUND_Y - 30, 22, 5);
      }
      // 사격선
      if (tw.lastTargetX != null) {
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(tx, GROUND_Y - 22);
        const spec = TOWERS.find((t) => t.key === tw.key)!;
        ctx.lineTo(sx(tw.lastTargetX), spec.target === 'air' ? AIR_Y : GROUND_Y - 6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // 유닛
  for (const u of b.units) {
    const ux = sx(u.x);
    const col = u.key === 'intern' ? '#9be89b' : u.key === 'analyst' ? '#5ecf5e' : '#2eaf5e';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(ux, GROUND_Y, 8, 0, Math.PI * 2);
    ctx.fill();
    hpBar(ctx, ux - 9, GROUND_Y - 16, 18, u.hp / u.maxHp, '#6fdc6f');
  }

  // 적
  for (const e of b.enemies) {
    const ex = sx(e.x);
    if (e.air) {
      ctx.fillStyle = '#e88ab0';
      ctx.beginPath();
      ctx.moveTo(ex, AIR_Y - 8);
      ctx.lineTo(ex - 8, AIR_Y + 6);
      ctx.lineTo(ex + 8, AIR_Y + 6);
      ctx.closePath();
      ctx.fill();
      hpBar(ctx, ex - 9, AIR_Y - 16, 18, e.hp / e.maxHp, '#e88ab0');
    } else {
      ctx.fillStyle = '#e05656';
      ctx.fillRect(ex - 7, GROUND_Y - 8, 14, 16);
      hpBar(ctx, ex - 9, GROUND_Y - 20, 18, e.hp / e.maxHp, '#e05656');
    }
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
