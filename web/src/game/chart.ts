// FR-3.3 차트 리플레이 렌더러 — 1분봉 선형 보간, 표현 전용 (판정은 서버)
// FR-4.1: Y축은 당일 시가 = 0% 기준 백분율만. 가격 절대값 미표시.
import type { BarsFile } from '@tf/shared';

export interface OpenMarker {
  openBarIdx: number;
  basePricePct: number; // 시가 대비 %
  direction: 'long' | 'short';
}

const VISIBLE = 64;

export function pctOf(price: number, openPrice: number): number {
  return (price / openPrice - 1) * 100;
}

/** 보간된 현재가 (%). barF = 실수 bar 인덱스 */
export function interpPct(data: BarsFile, barF: number): number {
  const i = Math.floor(barF);
  const frac = barF - i;
  const prev = i <= 0 ? data.bars[0].o : data.bars[i - 1].c;
  const cur = data.bars[Math.min(i, data.barCount - 1)].c;
  return pctOf(prev + (cur - prev) * frac, data.openPrice);
}

export function drawChart(
  canvas: HTMLCanvasElement,
  data: BarsFile,
  barF: number,
  opts: { colorBlind: boolean; marker: OpenMarker | null; showResearch: boolean },
) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const volH = 34;
  const priceH = H - volH - 6;
  ctx.clearRect(0, 0, W, H);

  const up = opts.colorBlind ? '#e8c34a' : '#46A574';   // 디자인 팔레트: 상승 녹 (색약: 황)
  const down = opts.colorBlind ? '#4aa8e8' : '#E8654F'; // 하락 적

  const iNow = Math.min(Math.floor(barF), data.barCount - 1);
  const start = Math.max(0, iNow - VISIBLE + 8);
  const end = start + VISIBLE;
  const bw = W / VISIBLE;

  // 가시 범위 % 스케일
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = start; i <= Math.min(iNow, data.barCount - 1); i++) {
    lo = Math.min(lo, pctOf(data.bars[i].l, data.openPrice));
    hi = Math.max(hi, pctOf(data.bars[i].h, data.openPrice));
  }
  if (!Number.isFinite(lo)) { lo = -0.5; hi = 0.5; }
  const pad = Math.max((hi - lo) * 0.18, 0.15);
  lo -= pad; hi += pad;
  if (opts.marker) {
    lo = Math.min(lo, opts.marker.basePricePct - 0.05);
    hi = Math.max(hi, opts.marker.basePricePct + 0.05);
  }
  const y = (pct: number) => priceH - ((pct - lo) / (hi - lo)) * priceH;
  const x = (i: number) => (i - start) * bw + bw / 2;

  // 그리드 + % 라벨
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  const stepPct = niceStep((hi - lo) / 4);
  for (let g = Math.ceil(lo / stepPct) * stepPct; g <= hi; g += stepPct) {
    const gy = y(g);
    ctx.strokeStyle = Math.abs(g) < stepPct / 2 ? '#3E5570' : '#161F31';
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    ctx.fillStyle = '#7C89A3';
    ctx.fillText(`${g > 0 ? '+' : ''}${g.toFixed(1)}%`, W - 4, gy - 3);
  }

  // 캔들 (완성 봉)
  for (let i = start; i < Math.min(iNow, end); i++) {
    const b = data.bars[i];
    const o = pctOf(b.o, data.openPrice);
    const c = pctOf(b.c, data.openPrice);
    const col = c >= o ? up : down;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x(i), y(pctOf(b.h, data.openPrice)));
    ctx.lineTo(x(i), y(pctOf(b.l, data.openPrice)));
    ctx.stroke();
    const top = y(Math.max(o, c));
    const hgt = Math.max(Math.abs(y(o) - y(c)), 1);
    ctx.fillRect(x(i) - bw * 0.32, top, bw * 0.64, hgt);
  }

  // 형성 중인 봉 (보간)
  if (iNow < data.barCount) {
    const b = data.bars[iNow];
    const o = pctOf(b.o, data.openPrice);
    const c = interpPct(data, barF);
    const col = c >= o ? up : down;
    ctx.fillStyle = col;
    const top = y(Math.max(o, c));
    const hgt = Math.max(Math.abs(y(o) - y(c)), 1.5);
    ctx.fillRect(x(iNow) - bw * 0.32, top, bw * 0.64, hgt);
    // 현재가 라인
    ctx.strokeStyle = col;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(0, y(c)); ctx.lineTo(W, y(c)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.fillText(`${c > 0 ? '+' : ''}${c.toFixed(2)}%`, 4, y(c) - 4);
  }

  // FR-5.8 진입 마커
  if (opts.marker) {
    const m = opts.marker;
    const my = y(m.basePricePct);
    ctx.strokeStyle = '#FFC53D';
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FFC53D';
    ctx.textAlign = 'left';
    ctx.fillText(m.direction === 'long' ? '▲ LONG' : '▼ SHORT', 4, my + 12);
    if (m.openBarIdx >= start && m.openBarIdx <= end) {
      ctx.beginPath();
      ctx.arc(x(m.openBarIdx), my, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 거래량 (FR-4.1: 20일 평균 대비 배수만) — 정보 보상 시 30분봉 집계 표시
  const volTop = priceH + 6;
  let maxV = 1;
  for (let i = start; i <= Math.min(iNow, end - 1); i++) maxV = Math.max(maxV, data.bars[i].v);
  if (opts.showResearch) {
    ctx.fillStyle = 'rgba(140,120,220,0.35)';
    for (let g = Math.floor(start / 30) * 30; g < end; g += 30) {
      let sum = 0;
      let n = 0;
      for (let i = g; i < Math.min(g + 30, iNow + 1); i++) if (i >= 0) { sum += data.bars[i].v; n++; }
      if (!n) continue;
      const avg = sum / n;
      const h2 = Math.min((avg / maxV) * volH * 1.6, volH);
      ctx.fillRect((Math.max(g, start) - start) * bw, volTop + volH - h2, (Math.min(g + 30, end) - Math.max(g, start)) * bw - 1, h2);
    }
  }
  for (let i = start; i <= Math.min(iNow, end - 1); i++) {
    const b = data.bars[i];
    const h2 = (b.v / maxV) * volH;
    ctx.fillStyle = i === iNow ? '#7C89A3' : '#3E5570';
    ctx.fillRect(x(i) - bw * 0.3, volTop + volH - h2, bw * 0.6, h2);
  }
  const curMult = data.bars[iNow].v / Math.max(data.volumeAvg20d, 1);
  ctx.fillStyle = curMult >= 2 ? '#FFC53D' : '#7C89A3';
  ctx.textAlign = 'right';
  ctx.font = '11px monospace';
  ctx.fillText(`거래량 ${curMult.toFixed(1)}×`, W - 4, volTop + 11);
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
}

/** FR-3.7 진행 표시: 1봉 = 1거래일 → 상대 표기 D+n (실제 날짜 은닉, FR-4) */
export function clockLabel(barF: number, barCount: number): string {
  return `D+${Math.min(Math.floor(barF), barCount)}`;
}
