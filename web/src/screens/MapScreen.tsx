import { useEffect, useState } from 'react';
import type { MapRes, RegionId } from '@tf/shared';
import { api, getSettings, saveSettings, type Settings } from '../net/api.js';

// FR-2 세계지도 (MVP: 대한민국 3지역, 인접 점령)
interface Props {
  onEnterStage: (regionId: RegionId) => void;
  onCompany: () => void;
  onCodex: () => void;
  onTutorial: () => void;
}

const LINE_KO: Record<string, string> = { finance: '재무', info: '정보', defense: '방어', offense: '공격' };

export function MapScreen({ onEnterStage, onCompany, onCodex, onTutorial }: Props) {
  const [map, setMap] = useState<MapRes | null>(null);
  const [notice, setNotice] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(getSettings());

  useEffect(() => {
    api.map().then(setMap).catch((e) => setNotice(String(e.message)));
  }, []);

  if (!map) return <div className="screen center"><p>지도 로딩…</p></div>;

  const clickRegion = (regionId: RegionId, state: string) => {
    if (state === 'locked') {
      setNotice('인접 지역을 먼저 점령하세요');
      setTimeout(() => setNotice(''), 1800);
      return;
    }
    onEnterStage(regionId);
  };

  const applySettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div className="screen map">
      <header className="map-head">
        <h1>TICKER FRONT</h1>
        {/* FR-2.5 상시 표시 */}
        <div className="map-stats">
          <span>자본금 <b className="gold">{map.capital.toLocaleString()}</b></span>
          <span>점령 <b>{map.capturedCount}/3</b></span>
          <span>운영비 <b>{map.upkeepTotal} G</b>/스테이지</span>
          <span>경계도 <b>×{map.heat.toFixed(2)}</b></span>
        </div>
      </header>

      <div className="region-row">
        {map.regions.map((r, i) => (
          <div key={r.regionId} className="region-slot">
            {i > 0 && <div className={`link ${r.state !== 'locked' ? 'on' : ''}`}>→</div>}
            <button
              className={`region ${r.state}`}
              onClick={() => clickRegion(r.regionId, r.state)}
            >
              <span className="rname">{r.name}</span>
              <span className="rsector">{r.sector}</span>
              <span className="rstar">{'★'.repeat(r.difficulty)}{'☆'.repeat(3 - r.difficulty)}</span>
              <span className="rstate">
                {r.state === 'captured' ? `점령 ${r.bestGrade ? `(최고 ${r.bestGrade})` : ''}` : r.state === 'open' ? '도전 가능' : '잠김 🔒'}
              </span>
              {r.rewardsTaken.length > 0 && (
                <span className="rrewards">{r.rewardsTaken.map((l) => LINE_KO[l]).join(' · ')}</span>
              )}
              {r.state === 'captured' && <span className="small dim">재도전: 다른 조합 · 자본금 50%</span>}
            </button>
          </div>
        ))}
      </div>

      {notice && <p className="notice">{notice}</p>}

      <div className="map-actions">
        <button onClick={onCompany}>🏢 회사</button>
        <button onClick={onCodex}>📒 차트 도감</button>
        <button onClick={() => setShowSettings(true)}>⚙ 설정</button>
        {!map.tutorialDone && <button className="primary" onClick={onTutorial}>튜토리얼 다시 하기</button>}
      </div>

      {showSettings && (
        <div className="overlay center" onClick={() => setShowSettings(false)}>
          <div className="card settings" onClick={(e) => e.stopPropagation()}>
            <h3>설정 (FR-13)</h3>
            <label>배속 (스테이지 시작 전에만 적용)
              <div>
                {([0.5, 1, 2] as const).map((v) => (
                  <button key={v} className={`opt ${settings.speed === v ? 'on' : ''}`} onClick={() => applySettings({ speed: v })}>{v}x</button>
                ))}
              </div>
            </label>
            <label>
              <input type="checkbox" checked={settings.colorBlind} onChange={(e) => applySettings({ colorBlind: e.target.checked })} />
              색약 모드 (상승/하락 → 황/청)
            </label>
            <label>
              <input type="checkbox" checked={settings.reduceShake} onChange={(e) => applySettings({ reduceShake: e.target.checked })} />
              화면 흔들림 감소
            </label>
            <button className="primary" onClick={() => setShowSettings(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
