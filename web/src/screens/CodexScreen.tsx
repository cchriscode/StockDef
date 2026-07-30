import { useEffect, useState } from 'react';
import { api, type CodexEntry } from '../net/api.js';

// FR-10 차트 도감 — 열람 전용, 로고 없이 티커 텍스트 + 섹터 색상 (C3)
const RARITY_KO: Record<string, string> = { common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' };
const SECTORS = ['금융', 'IT·플랫폼', '중공업·에너지'];

export function CodexScreen({ onBack }: { onBack: () => void }) {
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
      <header className="row">
        <button className="ghost" onClick={onBack}>← 지도</button>
        <h2>차트 도감</h2>
        <span className="dim">{entries.length}종</span>
      </header>
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
      </div>
      {entries.length === 0 && <p className="center dim">클리어한 차트가 여기에 등록됩니다</p>}
      <div className="codex-grid">
        {entries.map((e) => (
          <div key={`${e.ticker}-${e.trade_date}`} className={`codex-card rarity-${e.rarity}`}>
            <b>{e.ticker}</b>
            <span>{e.company_name}</span>
            <span className="small">{e.trade_date} · {e.sector}</span>
            <span className={e.day_change_pct >= 0 ? 'up' : 'down'}>
              {e.day_change_pct >= 0 ? '+' : ''}{e.day_change_pct.toFixed(1)}%
            </span>
            <span className="small">적중률 {(e.best_accuracy * 100).toFixed(0)}% · {e.best_grade} · {RARITY_KO[e.rarity]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
