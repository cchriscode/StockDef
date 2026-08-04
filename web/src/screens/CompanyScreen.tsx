import { useEffect, useState } from 'react';
import { BALANCE, DEPTS, type MeRes } from '@tf/shared';
import { api } from '../net/api.js';

// FR-11 회사 & 부서 업그레이드
export function CompanyScreen({ onBack }: { onBack: () => void }) {
  const [me, setMe] = useState<MeRes | null>(null);
  const [msg, setMsg] = useState('');

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

  return (
    <div className="screen company">
      <header className="row">
        <button className="ghost" onClick={onBack}>← 타이틀</button>
        <h2>1인 투자회사</h2>
        <span>자본금 <b className="gold">{me.capital.toLocaleString()}</b></span>
      </header>
      <p className="dim">
        초기 AUM {BALANCE.AUM_BY_DESK_LV[me.depts.trading_desk - 1].toLocaleString()} ·
        점령 {me.territories.filter((t) => t.state === 'captured').length}지역 · 도감 {me.codexCount}종
      </p>
      {msg && <p className="notice">{msg}</p>}
      <div className="dept-list">
        {DEPTS.map((d) => {
          const lv = me.depts[d.key];
          const maxed = lv >= d.maxLv;
          const cost = maxed ? null : d.costs[lv - 1];
          const afford = cost != null && me.capital >= cost;
          return (
            <div key={d.key} className="card dept">
              <div>
                <b>{d.name}</b> <span className="lv">Lv{lv}</span>
                <p className="small">{d.desc(lv)}{!maxed && <> → <b>{d.desc(lv + 1)}</b></>}</p>
              </div>
              {/* FR-11.4: 부족 시 비활성 + 부족액 표시. FR-11.5: 환불 없음 */}
              <button disabled={maxed || !afford} onClick={() => upgrade(d.key)}>
                {maxed ? 'MAX' : afford ? `${cost!.toLocaleString()} G` : `부족 ${(cost! - me.capital).toLocaleString()}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="small dim">업그레이드는 되돌릴 수 없습니다 · 모든 효과는 합연산</p>
    </div>
  );
}
