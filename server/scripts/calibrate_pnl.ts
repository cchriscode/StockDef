// §9.1 하방 계수(L) 캘리브레이션 — 실데이터 30봉 보유 |g| 분포에서 지역별 목표
// 손익분기 승률(R1 40.3% / R2 45.6% / R3 50.2%)을 만족하는 L을 역산하고 환율 표를 출력한다.
// 데이터 재수집(npm run fetch/build:data) 후 실행해 shared/src/balance.ts LOSS_RATE를 갱신할 것.
// 사용: npx tsx server/scripts/calibrate_pnl.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BALANCE } from '@tf/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline', 'out', 'chart_sets.json'), 'utf-8')) as {
  id: string; region_id: string; bars_url: string;
}[];

const B = BALANCE.PAYOUT_BASE;
const UP_CAP = B * BALANCE.Z_CAP;
const MAX_LOSS = BALANCE.MAX_LOSS_RATE;
const TARGET_BREAKEVEN: [string, number][] = [['R1', 0.403], ['R2', 0.456], ['R3', 0.502]];

function sampleG(region?: string): number[] {
  const pool = SETS.filter((s) => s.region_id !== 'TUT' && (!region || s.region_id === region));
  const gs: number[] = [];
  for (const s of pool) {
    const bf = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', s.bars_url.replace('/static/', 'static/')), 'utf-8'));
    const sig = Math.max(bf.sigma['30'], 1e-6);
    for (let t = 1; t + 30 < bf.barCount; t += 7) {
      const d = ((bf.bars[t + 30].c - bf.bars[t].c) / bf.bars[t].c) * 100;
      gs.push(Math.abs(d) / sig);
    }
  }
  return gs;
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const gAll = sampleG();
console.log(`샘플 ${gAll.length}건, E|g|=${mean(gAll).toFixed(3)}`);
for (const r of ['R1', 'R2', 'R3']) console.log(`  ${r}: E|g|=${mean(sampleG(r)).toFixed(3)} (σ30 정규화 → 지역 간 유사해야 정상)`);

const U = mean(gAll.map((g) => Math.min(B * g, UP_CAP)));
const Dn = (L: number) => mean(gAll.map((g) => Math.min(L * g, MAX_LOSS)));
console.log(`\n상방 기대 U = E[min(${B}g, ${UP_CAP})] = ${U.toFixed(4)}`);

function solveL(pStar: number): number {
  const target = (pStar * U) / (1 - pStar);
  let lo = 0.1;
  let hi = 3.0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (Dn(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const LS = TARGET_BREAKEVEN.map(([r, p]) => [r, Math.round(solveL(p) * 20) / 20] as const); // 0.05 단위
console.log('권장 L:', LS.map(([r, l]) => `${r}=${l}`).join(' / '), `(현행: ${(['R1', 'R2', 'R3'] as const).map((r) => BALANCE.LOSS_RATE[r]).join('/')})`);

console.log('\n환율 표: rate(p) = 1 + p·U − (1−p)·Dn(L)');
console.log(['p', ...LS.map(([r, l]) => `${r}(L=${l})`)].join(' | '));
for (const p of [0.4, 0.45, 0.5, 0.55, 0.6, 0.65]) {
  console.log(`${(p * 100).toFixed(0)}% | ${LS.map(([, l]) => (1 + p * U - (1 - p) * Dn(l)).toFixed(2)).join(' | ')}`);
}
for (const [r, l] of LS) {
  const dn = Dn(l);
  console.log(`${r} L=${l} → 손익분기 p* = ${((dn / (U + dn)) * 100).toFixed(1)}%`);
}

// ─── FR-5.5b 골드 기댓값 (수익만 골드 환전) ───
// 트레이드당 골드 전환 기대 = stake × p × U   (손실은 골드가 아니라 AUM에서 깎임)
// 트레이드당 AUM 소모 기대  = stake × (1−p) × Dn(L)
// 스테이지 추정: 30봉 보유 × 11회, 투입 25% (봇 전략과 동일) — AUM은 기대치로 축차 감소
console.log('\n골드 기댓값: 트레이드당 골드 = stake × p × U (U는 지역 공통, L 무관)');
console.log('스테이지 추정 (AUM 2000, 25% 투입 × 11회, 기본수입·배당·처치AUM 제외):');
console.log(['p', ...LS.map(([r]) => `${r} 골드`), ...LS.map(([r]) => `${r} AUM잔여`)].join(' | '));
for (const p of [0.45, 0.5, 0.55, 0.6, 0.65]) {
  const golds: string[] = [];
  const aums: string[] = [];
  for (const [, l] of LS) {
    let aum = 2000;
    let gold = 0;
    for (let i = 0; i < 11; i++) {
      const stake = aum * 0.25;
      gold += stake * p * U;
      aum -= stake * (1 - p) * Dn(l);
    }
    golds.push(String(Math.round(gold)));
    aums.push(String(Math.round(aum)));
  }
  console.log(`${(p * 100).toFixed(0)}% | ${golds.join(' | ')} | ${aums.join(' | ')}`);
}
console.log('※ §9.3 목표 지출(타워·유닛): R1 2,000 / R2 2,550 / R3 3,100 G — 기본수입(275~325)과 배당 파밍을 더해 비교할 것');
