import { useEffect, useState } from 'react';
import { REGION_META } from '@tf/shared';
import { api, type CodexEntry } from '../net/api.js';

// FR-10 차트 도감 — 열람 전용, 로고 없이 티커 텍스트 + 섹터 색상 (C3)
// 디자인: Dead Cat Bounce Flow 목업 06번 "도감 · 시장의 기록" 희귀도 카드
const RARITY_KO: Record<string, string> = { common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' };
const SECTORS = ['금융', 'IT·플랫폼', '중공업·에너지'];

const CHART_W = 260;
const CHART_H = 92;

/** 실제 플레이한 종가 시계열을 카드 크기에 맞춘 SVG 패스로 변환 */
function chartPaths(spark: number[]): { line: string; area: string } | null {
  if (spark.length < 2) return null;
  const lo = Math.min(...spark);
  const hi = Math.max(...spark);
  const span = hi - lo || 1;
  const pad = 6;
  const pts = spark.map((c, i) => {
    const x = (i / (spark.length - 1)) * CHART_W;
    const y = pad + (1 - (c - lo) / span) * (CHART_H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { line: `M${pts.join('L')}`, area: `M0,${CHART_H} L${pts.join('L')} L${CHART_W},${CHART_H} Z` };
}

/** 2024-03-05 → 24.03.05 */
const shortDate = (d: string) => d.slice(2).replace(/-/g, '.');

export function CodexScreen({ onBack, from = 'map' }: { onBack: () => void; from?: 'title' | 'map' }) {
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [sector, setSector] = useState('');
  const [rarity, setRarity] = useState('');
  const [sort, setSort] = useState<'date' | 'rarity'>('date');

  useEffect(() => {
    const q = new URLSearchParams();
    if (sector) q.set('sector', sector);
    if (rarity) q.set('rarity', rarity);
    if (sort === 'rarity') q.set('sort', 'rarity');
    api.codex(q.toString() ? `?${q}` : '').then((r) => setEntries(r.entries)).catch(() => {});
  }, [sector, rarity, sort]);

  return (
    <div className="screen codex">
      <header className="codex-head">
        <div>
          <h2>도감 · 시장의 기록</h2>
          <div className="sub">수집 {entries.length}종 · 전설 {entries.filter((e) => e.rarity === 'legendary').length}</div>
        </div>
        <div className="filters">
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">전체 섹터</option>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="">전체 희귀도</option>
            {Object.entries(RARITY_KO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'rarity')}>
            <option value="date">날짜순</option>
            <option value="rarity">희귀도순</option>
          </select>
          <button className="ghost" onClick={onBack}>← {from === 'title' ? '타이틀' : '지도'}</button>
        </div>
      </header>

      {entries.length === 0 && <div className="codex-empty">클리어한 차트가 여기에 기록됩니다</div>}

      <div className="codex-grid">
        {entries.map((e) => {
          const pos = e.day_change_pct >= 0;
          const paths = chartPaths(e.spark ?? []);
          const region = REGION_META[e.region_id]?.name ?? e.region_id;
          const period = e.date_start ? `${shortDate(e.date_start)} ~ ${shortDate(e.trade_date)}` : e.trade_date;
          return (
            <div key={`${e.ticker}-${e.trade_date}`} className={`codex-card rarity-${e.rarity}`}>
              <div className="chead">
                <span>{e.rarity.toUpperCase()}</span>
                <span className="cstage">{region} · <b className={`mode-${e.best_mode}`}>{e.best_mode === 'easy' ? '이지' : '하드'}</b></span>
              </div>
              <div className="cchart">
                {paths ? (
                  <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className={pos ? 'up' : 'down'}>
                    <path className="area" d={paths.area} />
                    <path className="line" d={paths.line} />
                  </svg>
                ) : (
                  <div className="small dim nochart">차트 없음</div>
                )}
                <span className={`cpct ${pos ? '' : 'neg'}`}>
                  {pos ? '▲ +' : '▼ '}{e.day_change_pct.toFixed(1)}%
                </span>
              </div>
              <div className="cperiod">{period} · {e.spark?.length ? '실제 플레이 구간' : ''}</div>
              <div className="cbody">
                <b>{e.company_name}</b>
                <span className="small dim">{e.ticker} · {e.sector}</span>
                <div className="cfoot">
                  <span>적중률 {(e.best_accuracy * 100).toFixed(0)}%</span>
                  <span className={`rank rank-${e.best_grade ?? 'C'}`}>RANK {e.best_grade}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
