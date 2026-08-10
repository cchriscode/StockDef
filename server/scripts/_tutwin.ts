// 튜토리얼 첫 거래: 진입 봉별로 26봉 보유 시 승패 (가이드 창을 데이터로 정하기 위해)
import fs from 'node:fs';
import path from 'node:path';
import { BALANCE, judge, type BarsFile } from '@tf/shared';
const ROOT = 'C:/Users/USER/StockDef';
const sets = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline/out/chart_sets.json'), 'utf-8')) as { region_id: string; bars_url: string }[];
const tut = sets.filter((s) => s.region_id === 'TUT');
console.log('튜토리얼 차트 세트', tut.length, '개');
for (const cs of tut) {
  const bars = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', cs.bars_url.replace('/static/', 'static/')), 'utf-8')) as BarsFile;
  const HOLD = 26;
  const win: number[] = [];
  for (let i = 1; i + HOLD < bars.barCount; i++) {
    const r = judge(bars.bars[i].c, bars.bars[i + HOLD].c, bars.sigma['30'], 'long', 500, BALANCE.LOSS_RATE.TUT, 1);
    if (r.outcome === 'win') win.push(i);
  }
  // 연속 구간으로 압축
  const runs: string[] = [];
  let s0 = -1, prev = -2;
  for (const i of [...win, -99]) {
    if (i !== prev + 1) { if (s0 >= 0) runs.push(`${s0}~${prev}`); s0 = i; }
    prev = i;
  }
  console.log(`봉 ${bars.barCount} · 롱 26봉 보유 시 승리 진입구간: ${runs.slice(0, 12).join(', ')}${runs.length > 12 ? ' …' : ''}`);
  console.log(`  현재 가이드 창 22~34 안의 승리 진입: ${win.filter((i) => i >= 22 && i <= 34).length}/13봉`);
}
