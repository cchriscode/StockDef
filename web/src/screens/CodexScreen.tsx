import { useEffect, useState } from 'react';
import { api, type CodexEntry } from '../net/api.js';

// FR-10 차트 도감 — 열람 전용, 로고 없이 티커 텍스트 + 섹터 색상 (C3)
// 디자인: Dead Cat Bounce Flow 목업 06번 "도감 · 시장의 기록" 희귀도 카드
const RARITY_KO: Record<string, string> = { common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' };
const SECTORS = ['금융', 'IT·플랫폼', '중공업·에너지'];

/** 장식용 미니 바 차트 — 티커+날짜 해시 시드, 등락 부호에 맞춰 추세 편향 (실데이터 아님) */
function miniBars(seedStr: string, changePct: number): { h: number; up: boolean }[] {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const upBias = changePct >= 0 ? 0.65 : 0.35;
  const bars: { h: number; up: boolean }[] = [];
  let level = changePct >= 0 ? 25 : 75;
  for (let i = 0; i < 8; i++) {
    const up = rnd() < upBias;
    level += (up ? 1 : -1) * (6 + rnd() * 10);
    level = Math.max(12, Math.min(92, level));
    bars.push({ h: Math.round(level), up });
  }
  return bars;
}

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
          <button className="ghost" onClick={onBack}>← 지도</button>
        </div>
      </header>

      {entries.length === 0 && <div className="codex-empty">클리어한 차트가 여기에 기록됩니다</div>}

      <div className="codex-grid">
        {entries.map((e) => {
          const pos = e.day_change_pct >= 0;
          return (
            <div key={`${e.ticker}-${e.trade_date}`} className={`codex-card rarity-${e.rarity}`}>
              <div className="chead">
                <span>{e.rarity.toUpperCase()}</span>
                <span>{e.trade_date}</span>
              </div>
              <div className="cchart">
                <div className="cbars">
                  {miniBars(e.ticker + e.trade_date, e.day_change_pct).map((b, i) => (
                    <i key={i} className={b.up ? 'u' : 'd'} style={{ height: `${b.h}%` }} />
                  ))}
                </div>
                <span className={`cpct ${pos ? '' : 'neg'}`}>
                  {pos ? '▲ +' : '▼ '}{e.day_change_pct.toFixed(1)}%
                </span>
              </div>
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
