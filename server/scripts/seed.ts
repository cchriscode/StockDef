// pipeline/out/chart_sets.json → SQLite chart_sets (파이프라인 ⑦ 편성)
import fs from 'node:fs';
import path from 'node:path';
import { db, SERVER_ROOT } from '../src/db.js';

const setsPath = path.resolve(SERVER_ROOT, '..', 'pipeline', 'out', 'chart_sets.json');
if (!fs.existsSync(setsPath)) {
  console.error('chart_sets.json 없음 — 먼저 `npm run fetch && npm run build:data` 실행');
  process.exit(1);
}
const sets = JSON.parse(fs.readFileSync(setsPath, 'utf-8')) as Record<string, unknown>[];

db.prepare('DELETE FROM chart_sets').run();
const ins = db.prepare(`
  INSERT INTO chart_sets (id, ticker, company_name, trade_date, market, sector, cap_tier, region_id,
    archetype, day_change_pct, rarity, difficulty, bars_url, sigma_15m, sigma_30m, sigma_60m, events, news, ohlcv_day)
  VALUES (@id, @ticker, @company_name, @trade_date, @market, @sector, @cap_tier, @region_id,
    @archetype, @day_change_pct, @rarity, @difficulty, @bars_url, @sigma_15m, @sigma_30m, @sigma_60m, @events, @news, @ohlcv_day)
`);
const tx = db.transaction(() => {
  for (const s of sets) {
    ins.run({
      ...s,
      events: JSON.stringify(s.events),
      news: JSON.stringify(s.news),
      ohlcv_day: JSON.stringify(s.ohlcv_day),
    });
  }
});
tx();
const n = (db.prepare('SELECT COUNT(*) AS n FROM chart_sets').get() as { n: number }).n;
const missing = sets.filter((s) => !fs.existsSync(path.join(SERVER_ROOT, String(s.bars_url).replace('/static/', 'static/')))).length;
console.log(`시드 완료: chart_sets ${n}건, bars 파일 누락 ${missing}건`);
