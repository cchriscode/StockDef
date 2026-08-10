import { useEffect, useState } from 'react';
import { BALANCE, DEPTS, DEPT_EFFECTS, type MeRes } from '@tf/shared';
import { api } from '../net/api.js';

// FR-11 회사 & 부서 업그레이드 — 목업 "Dead Cat Bounce - Upgrade" (자본 배분 데스크)
const CODE: Record<string, string> = {
  trading_desk: 'TRD', rnd: 'RND', hr: 'HRD', legal: 'LGL', ir: 'IRT', margin: 'MGN', research: 'RSC',
};

/** 데스크 시계 — 목업 헤더의 실시간 타임스탬프 */
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
    return { d, lv, maxed, cost, afford: cost != null && me.capital >= cost };
  });
  const lvSum = rows.reduce((s, r) => s + r.lv, 0);
  const lvMax = rows.reduce((s, r) => s + r.d.maxLv, 0);
  const buyable = rows.filter((r) => r.afford).length;
  const cheapest = rows.filter((r) => !r.maxed).sort((a, b) => a.cost! - b.cost!)[0];
  const captured = me.territories.filter((t) => t.state === 'captured').length;

  // 현재 빌드 요약 — 부서 효과를 실제 수치로 (목업 CURRENT BUILD)
  const build: [string, string][] = [
    ['초기 AUM', BALANCE.AUM_BY_DESK_LV[me.depts.trading_desk - 1].toLocaleString()],
    ['타워 피해', `+${Math.round((DEPT_EFFECTS.towerDmgMult(me.depts.rnd) - 1) * 100)}%`],
    ['유닛 HP', `+${Math.round((DEPT_EFFECTS.unitHpMult(me.depts.hr) - 1) * 100)}%`],
    ['손실률', `−${DEPT_EFFECTS.legalCut(me.depts.legal).toFixed(2)}`],
    ['정산 보너스', `+${Math.round(DEPT_EFFECTS.irBonus(me.depts.ir) * 100)}%`],
    ['레버리지 최대', `${DEPT_EFFECTS.maxLeverage(me.depts.margin)}×`],
    ['스테이지당 거래', `${DEPT_EFFECTS.maxPositions(me.depts.research)}회`],
  ];

  // 추천 순서 — 살 수 있는 것 우선, 그다음 싼 것 (근거를 함께 보여준다)
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

  return (
    <div className="map-room war desk">
      <header className="wr-head">
        <div className="left">
          <button className="ghost small" onClick={onBack}>← 타이틀</button>
          <div className="wr-live"><i /><span>LIVE</span></div>
          <span className="wr-title">1인 투자회사</span>
          <span className="wr-sub">CAPITAL ALLOCATION</span>
          <span className="dk-cap">자본금 <b>{me.capital.toLocaleString()}</b></span>
        </div>
        <div className="wr-chips">
          <span>DEPT {DEPTS.length} · LV {lvSum}/{lvMax}</span>
          <span>{clock}<i style={{ animation: 'wr-caret 1s steps(1) infinite', fontStyle: 'normal' }}>_</i></span>
          <span className={buyable > 0 ? 'ok' : ''}>구매 가능 {buyable}</span>
        </div>
      </header>
      <p className="wr-sub">초기 AUM {BALANCE.AUM_BY_DESK_LV[me.depts.trading_desk - 1].toLocaleString()} · 점령 {captured}지역 · 도감 {me.codexCount}종</p>
      {msg && <p className="notice">{msg}</p>}

      <div className="wr-body">
        <div className="dk-grid">
          {rows.map(({ d, lv, maxed, cost, afford }) => (
            <div key={d.key} className={`dk-card ${maxed ? 'maxed' : afford ? 'ready' : 'locked'}`}>
              <div className="dk-top">
                <div className="dk-name">
                  <b>{d.name}</b>
                  <em>{CODE[d.key]}</em>
                </div>
                <div className="dk-lv">
                  <span>Lv{lv}</span>
                  <div className="pips">
                    {Array.from({ length: d.maxLv }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}
                  </div>
                </div>
              </div>

              <div className="dk-eff">
                <span className="cur">{d.desc(lv)}</span>
                {!maxed && <><span className="arw">▸</span><span className="nxt">{d.desc(lv + 1)}</span></>}
              </div>

              {/* FR-11.4: 부족하면 비활성 + 부족액. FR-11.5: 환불 없음 */}
              {maxed ? (
                <div className="dk-buy"><span className="max">MAX — 더 올릴 수 없습니다</span></div>
              ) : (
                <div className="dk-buy">
                  <div className="bar"><i style={{ width: `${Math.min(100, (me.capital / cost!) * 100)}%` }} /></div>
                  <button className={afford ? 'primary' : ''} disabled={!afford} onClick={() => upgrade(d.key)}>
                    {afford ? `구매 ${cost!.toLocaleString()}` : `부족 ${(cost! - me.capital).toLocaleString()}`}
                  </button>
                  <span className="req">REQ {cost!.toLocaleString()} · {afford ? 'READY' : 'LOCKED'}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <aside className="wr-side">
          <div className="wr-panel">
            <div className="ph"><span>CAPITAL</span><span>스테이지 정산으로 획득</span></div>
            <div className="dk-cap-panel">
              <div className="big">{me.capital.toLocaleString()}</div>
              <span className="small dim">{cheapest ? `/ 최소 ${cheapest.cost!.toLocaleString()} 필요` : '모든 부서 MAX'}</span>
              {cheapest && (
                <>
                  <div className="bar"><i style={{ width: `${Math.min(100, (me.capital / cheapest.cost!) * 100)}%` }} /></div>
                  <span className="small dim">
                    {me.capital >= cheapest.cost!
                      ? `${cheapest.d.name} 구매 가능`
                      : `최저 비용 업그레이드까지 ${(cheapest.cost! - me.capital).toLocaleString()}`}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="wr-panel">
            <div className="ph"><span>CURRENT BUILD</span><span>{lvSum === DEPTS.length ? 'BASE' : `LV ${lvSum}`}</span></div>
            <div className="dk-build">
              {build.map(([k, v]) => (
                <div key={k} className="kv"><span>{k}</span><span>{v}</span></div>
              ))}
            </div>
          </div>

          <div className="wr-panel">
            <div className="ph"><span>PRIORITY QUEUE</span><span>▸ 대기 {queue.length}</span></div>
            <div className="dk-queue">
              {queue.length === 0 && <div className="wr-locked">모든 부서가 MAX입니다.</div>}
              {queue.map((q, i) => (
                <div key={q} className="qrow"><span className="no">{i + 1}</span><span>{q}</span></div>
              ))}
            </div>
          </div>

          <button className="cta wr-cta" onClick={onBack}>자본금 벌러 가기</button>
          <p className="small dim center">업그레이드는 되돌릴 수 없습니다 · 모든 효과는 합연산</p>
        </aside>
      </div>

      <div className="wr-feed">
        <span className="tag">DESK</span>
        <div className="track"><div>{feed}   ·   {feed}   ·   </div></div>
      </div>
    </div>
  );
}
