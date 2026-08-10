import { useEffect, useState } from 'react';
import { BALANCE, DEPTS, DEPT_EFFECTS, type MeRes } from '@tf/shared';
import { api } from '../net/api.js';

// FR-11 회사 & 부서 업그레이드 — 목업 "Dead Cat Bounce - Upgrade" 자본 배분 데스크.
// 부서별 코드·강조색·아이콘 픽셀은 목업 원본 값 그대로.
interface DeptSkin { code: string; accent: string; light: string; icon: [number, number, number, number, 0 | 1][] }
const SKIN: Record<string, DeptSkin> = {
  trading_desk: { code: 'TRD', accent: '#46A574', light: '#7BD8A0', icon: [[8, 20, 6, 16, 1], [18, 12, 6, 24, 0], [28, 24, 6, 12, 1], [18, 6, 6, 6, 0]] },
  rnd: { code: 'RND', accent: '#9B6BFF', light: '#C4A8FF', icon: [[16, 4, 8, 12, 1], [12, 16, 16, 20, 0], [8, 28, 24, 8, 1]] },
  hr: { code: 'HRD', accent: '#C79A22', light: '#FFC53D', icon: [[14, 4, 12, 12, 1], [8, 20, 24, 16, 0], [4, 24, 6, 12, 1], [30, 24, 6, 12, 0]] },
  legal: { code: 'LGL', accent: '#6E7C90', light: '#A9B6C4', icon: [[18, 4, 4, 32, 1], [4, 12, 32, 4, 0], [4, 16, 8, 8, 1], [28, 16, 8, 8, 0]] },
  ir: { code: 'IRT', accent: '#22A0A0', light: '#3ED8D8', icon: [[6, 14, 10, 12, 1], [16, 8, 12, 24, 0], [30, 4, 6, 6, 1], [30, 30, 6, 6, 0]] },
  margin: { code: 'MGN', accent: '#E8654F', light: '#FF9E86', icon: [[4, 28, 32, 8, 1], [8, 8, 6, 20, 0], [18, 14, 6, 14, 1], [28, 20, 6, 8, 0]] },
  research: { code: 'RSC', accent: '#F08B2E', light: '#FFC48E', icon: [[6, 6, 12, 28, 1], [22, 6, 12, 28, 0], [18, 4, 4, 32, 1]] },
  facility: { code: 'FAC', accent: '#4E7FB8', light: '#8FC4F0', icon: [[4, 26, 32, 10, 1], [8, 14, 10, 12, 0], [22, 8, 10, 18, 1], [16, 20, 6, 6, 0]] },
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

export function CompanyScreen({ onBack }: { onBack: () => void }) {
  const [me, setMe] = useState<MeRes | null>(null);
  const [msg, setMsg] = useState('');
  const clock = useClock();

  const load = () => api.me().then(setMe).catch(() => {});
  useEffect(() => { load(); }, []);

  if (!me) return <div className="screen center"><p>로딩…</p></div>;

  const upgrade = async (deptKey: (typeof DEPTS)[number]['key']) => {
    try {
      await api.deptUpgrade(deptKey);
      setMsg('');
      load();
    } catch (e) {
      const err = e as Error & { body?: { shortfall?: number } };
      setMsg(err.body?.shortfall ? `자본금 부족: ${err.body.shortfall.toLocaleString()} 더 필요합니다` : err.message);
    }
  };

  const rows = DEPTS.map((d) => {
    const lv = me.depts[d.key];
    const maxed = lv >= d.maxLv;
    const cost = maxed ? null : d.costs[lv - 1];
    return { d, sk: SKIN[d.key], lv, maxed, cost, afford: cost != null && me.capital >= cost };
  });
  const lvSum = rows.reduce((s, r) => s + r.lv, 0);
  const lvMax = rows.reduce((s, r) => s + r.d.maxLv, 0);
  const buyable = rows.filter((r) => r.afford).length;
  const cheapest = rows.filter((r) => !r.maxed).sort((a, b) => a.cost! - b.cost!)[0];
  const captured = me.territories.filter((t) => t.state === 'captured').length;

  const build: [string, string][] = [
    ['초기 AUM', BALANCE.AUM_BY_DESK_LV[me.depts.trading_desk - 1].toLocaleString()],
    ['타워 피해', `+${Math.round((DEPT_EFFECTS.towerDmgMult(me.depts.rnd) - 1) * 100)}%`],
    ['유닛 HP', `+${Math.round((DEPT_EFFECTS.unitHpMult(me.depts.hr) - 1) * 100)}%`],
    ['손실률', `−${DEPT_EFFECTS.legalCut(me.depts.legal).toFixed(2)}`],
    ['정산 보너스', `+${Math.round(DEPT_EFFECTS.irBonus(me.depts.ir) * 100)}%`],
    ['레버리지 최대', `${DEPT_EFFECTS.maxLeverage(me.depts.margin)}×`],
    ['스테이지당 거래', `${DEPT_EFFECTS.maxPositions(me.depts.research)}회`],
  ];

  const queue = rows
    .filter((r) => !r.maxed)
    .sort((a, b) => (Number(b.afford) - Number(a.afford)) || (a.cost! - b.cost!))
    .slice(0, 3)
    .map((r) => `${r.d.name} — ${r.afford ? '지금 구매 가능' : `${(r.cost! - me.capital).toLocaleString()} 더 필요`} · ${r.d.desc(Math.min(r.lv + 1, r.d.maxLv))}`);

  const feed = [
    `자본금 ${me.capital.toLocaleString()}`,
    buyable > 0 ? `구매 가능 업그레이드 ${buyable}건` : '구매 가능 업그레이드 없음',
    cheapest ? `최저 비용 ${cheapest.d.name} ${cheapest.cost!.toLocaleString()}` : '모든 부서 MAX',
    '업그레이드는 되돌릴 수 없습니다',
    '모든 효과는 합연산',
  ].join('   ·   ');

  const capPct = cheapest ? Math.min(100, (me.capital / cheapest.cost!) * 100) : 100;

  return (
    <div className="map-room war desk">
      <header className="wr-head">
        <div className="left">
          <button className="dk-back" onClick={onBack}>← 타이틀</button>
          <div className="dk-title">
            <div className="dk-title-row">
              <div className="wr-live gold"><i /><span>LIVE</span></div>
              <span className="wr-title">1인 투자회사</span>
              <span className="wr-sub">CAPITAL ALLOCATION</span>
              <div className="dk-cap"><span>자본금</span><i /><b>{me.capital.toLocaleString()}</b></div>
            </div>
            <span className="dk-meta">초기 AUM {BALANCE.AUM_BY_DESK_LV[me.depts.trading_desk - 1].toLocaleString()} · 점령 {captured}지역 · 도감 {me.codexCount}종</span>
          </div>
        </div>
        <div className="wr-chips">
          <span>DEPT {DEPTS.length} · LV {lvSum}/{lvMax}</span>
          <span>{clock}<i style={{ animation: 'wr-caret 1s steps(1) infinite', fontStyle: 'normal' }}>_</i></span>
          <span className={buyable > 0 ? 'ok' : 'warn'}>구매 가능 {buyable}</span>
        </div>
      </header>
      {msg && <p className="notice">{msg}</p>}

      <div className="wr-body">
        <div className="dk-list">
          {rows.map(({ d, sk, lv, maxed, cost, afford }) => (
            <div
              key={d.key}
              className={`dk-row ${afford ? 'ready' : ''} ${maxed ? 'maxed' : ''}`}
              style={{ borderLeftColor: sk.accent, ...(afford ? { borderColor: sk.accent } : null) }}
            >
              {afford && <div className="glow" style={{ background: sk.light }} />}
              <div className="dk-icon" style={{ borderColor: sk.accent }}>
                {sk.icon.map(([x, y, w, h, tone], i) => (
                  <i key={i} style={{ left: x, top: y, width: w, height: h, background: tone ? sk.light : sk.accent }} />
                ))}
                <span className="scan" />
              </div>

              <div className="dk-name">
                <div className="nm"><b>{d.name}</b><em>{sk.code}</em></div>
                <div className="lv">
                  <span style={{ color: sk.light }}>Lv{lv}</span>
                  <div className="pips">
                    {Array.from({ length: d.maxLv }, (_, i) => (
                      <i
                        key={i}
                        style={i < lv
                          ? { background: sk.light }
                          : i === lv ? { boxShadow: `inset 0 0 0 1px ${sk.light}` } : undefined}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="dk-eff">
                <span className="cur">{d.desc(lv)}</span>
                {!maxed && (
                  <>
                    <div className="dash" style={{ backgroundImage: `repeating-linear-gradient(to right, ${sk.accent} 0 6px, transparent 6px 11px)` }} />
                    <span className="arw" style={{ color: sk.light }}>▸</span>
                    <span className="nxt" style={{ color: sk.light }}>{d.desc(lv + 1)}</span>
                  </>
                )}
              </div>

              {/* FR-11.4 부족 시 비활성 + 부족액 / FR-11.5 환불 없음 */}
              <div className="dk-buy">
                {maxed ? (
                  <>
                    <div className="box maxed"><i style={{ background: '#FFC53D' }} /><span>MAX</span></div>
                    <span className="req">LV {lv}/{d.maxLv} · COMPLETE</span>
                  </>
                ) : (
                  <>
                    <button className="box" disabled={!afford} onClick={() => upgrade(d.key)} style={afford ? { borderColor: sk.accent } : undefined}>
                      <i style={{ background: afford ? sk.light : '#E8654F', opacity: afford ? 1 : 0.45 }} />
                      <span style={afford ? { color: sk.light } : undefined}>
                        {afford ? `구매 ${cost!.toLocaleString()}` : `부족 ${(cost! - me.capital).toLocaleString()}`}
                      </span>
                    </button>
                    <span className="req">REQ {cost!.toLocaleString()} · {afford ? 'READY' : 'LOCKED'}</span>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="dk-scan" />
        </div>

        <aside className="dk-rail">
          <div className="dk-panel gold">
            <span className="br tl" /><span className="br tr" /><span className="br bl" /><span className="br br2" />
            <div className="glow" />
            <div className="ph"><span>CAPITAL</span><span className="sub">스테이지 정산으로 획득</span></div>
            <div className="cap-row">
              <span className="big">{me.capital.toLocaleString()}</span>
              <span className="sub">{cheapest ? `/ 최소 ${cheapest.cost!.toLocaleString()} 필요` : '모든 부서 MAX'}</span>
            </div>
            <div className="cap-bar"><i style={{ width: `${capPct}%` }} /></div>
            <div className="cap-foot">
              <span>{me.capital.toLocaleString()}</span>
              <span>{cheapest ? (me.capital >= cheapest.cost! ? `${cheapest.d.name} 구매 가능` : `최저 비용 업그레이드까지 ${(cheapest.cost! - me.capital).toLocaleString()}`) : '완료'}</span>
            </div>
          </div>

          <div className="dk-panel">
            <span className="br tl" /><span className="br tr" /><span className="br bl" /><span className="br br2" />
            <div className="ph line"><span>CURRENT BUILD</span><div className="rule" /><span className="sub">{lvSum === DEPTS.length ? 'BASE' : `LV ${lvSum}`}</span></div>
            <div className="kvs">
              {build.map(([k, v]) => <div key={k} className="kv"><span>{k}</span><span>{v}</span></div>)}
            </div>
          </div>

          <div className="dk-panel">
            <span className="br tl" /><span className="br tr" /><span className="br bl" /><span className="br br2" />
            <div className="ph line"><span>PRIORITY QUEUE</span><div className="rule" /><span className="sub">▸ 대기 {queue.length}</span></div>
            <div className="qs">
              {queue.length === 0 && <div className="q dim">모든 부서가 MAX입니다.</div>}
              {queue.map((q, i) => <div key={q} className="q"><span className="no">{i + 1}</span><span>{q}</span></div>)}
            </div>
          </div>

          <div className="dk-actions">
            <button className="cta" onClick={onBack}>자본금 벌러 가기</button>
            <button className="ghost" onClick={onBack}>상황실</button>
          </div>
          <p className="dk-note">업그레이드는 되돌릴 수 없습니다 · 모든 효과는 합연산</p>
        </aside>
      </div>

      <div className="wr-feed">
        <span className="tag">DESK</span>
        <div className="track"><div>{feed}   ·   {feed}   ·   </div></div>
      </div>
    </div>
  );
}
