import { useEffect, useMemo, useState } from 'react';
import type { MapRes, RegionId } from '@tf/shared';
import { api, getSettings, saveSettings, type Settings } from '../net/api.js';
import { COUNTRIES, KR_COLS, KR_ROWS, WORLD_COLS, WORLD_ROWS, krSegs, worldSegs } from '../game/pixelMaps.js';

// FR-2 세계지도 — Dead Cat Bounce Flow 목업 03번: 세계지도 → 국가 진입 → 전선(스테이지) 목록 → 작전 개시
interface Props {
  onEnterStage: (regionId: RegionId) => void;
  onCompany: () => void;
  onCodex: () => void;
  onTutorial: () => void;
  onTitle: () => void;
}

const WORLD_CELL = 5;
const KR_CELL = 6;
// 한반도 지도 위 거점 좌표 (KR_CELL 기준 px)
const KR_MARKS: Record<string, { x: number; y: number }> = {
  R1: { x: 84, y: 108 },
  R2: { x: 100, y: 132 },
  R3: { x: 160, y: 278 },
};

export function MapScreen({ onEnterStage, onCompany, onCodex, onTutorial, onTitle }: Props) {
  const [map, setMap] = useState<MapRes | null>(null);
  const [view, setView] = useState<'world' | 'kr'>('world');
  const [selCountry, setSelCountry] = useState('k');
  const [selRegion, setSelRegion] = useState<RegionId | null>(null);
  const [notice, setNotice] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(getSettings());

  useEffect(() => {
    api.map().then(setMap).catch((e) => setNotice(String(e.message)));
  }, []);

  const wSegs = useMemo(() => worldSegs(WORLD_CELL), []);
  const kSegs = useMemo(() => krSegs(KR_CELL), []);

  if (!map) return <div className="screen center"><p className="dim">지도 로딩…</p></div>;

  const applySettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 1800);
  };

  const pickCountry = (key: string) => {
    setSelCountry(key);
    if (key === 'k') setView('kr');
  };

  const regions = map.regions;
  const sel = regions.find((r) => r.regionId === selRegion) ?? regions.find((r) => r.state === 'open') ?? regions[0];
  const country = COUNTRIES.find((c) => c.key === selCountry)!;

  const enterRegion = (regionId: RegionId, state: string) => {
    if (state === 'locked') {
      flash('인접 지역을 먼저 점령하세요');
      return;
    }
    onEnterStage(regionId);
  };

  return (
    <div className="screen map">
      <header className="map-head">
        <div>
          <h1>{view === 'world' ? '세계지도' : '전선 선택'}</h1>
          <div className="sub">{view === 'world' ? 'GLOBAL THEATER · 10 REGIONS' : 'CHAPTER 1 — 국내 시장'}</div>
        </div>
        {/* FR-2.5 상시 표시 */}
        <div className="map-stats">
          <span>자본금 <b className="gold">{map.capital.toLocaleString()}</b></span>
          <span>점령 <b>{map.capturedCount}/3</b></span>
          <span>운영비 <b>{map.upkeepTotal} G</b></span>
          <span>경계도 <b>×{map.heat.toFixed(2)}</b></span>
        </div>
      </header>

      {view === 'world' ? (
        <>
          <div className="mid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div className="pixmap" style={{ width: WORLD_COLS * WORLD_CELL, height: WORLD_ROWS * WORLD_CELL, maxWidth: '100%' }}>
              {wSegs.map((s, i) => {
                const c = COUNTRIES.find((cc) => cc.key === s.k)!;
                const opacity = c.status === 'open' ? 1 : c.status === 'next' ? 0.85 : 0.36;
                return (
                  <div
                    key={i}
                    className="cell"
                    style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: c.color, opacity, cursor: 'pointer' }}
                    onClick={() => pickCountry(s.k)}
                  />
                );
              })}
              <div className="grid-overlay" />
              {/* 한국 하이라이트 프레임 */}
              <div style={{ position: 'absolute', left: 121 * WORLD_CELL - 14, top: 18 * WORLD_CELL - 14, width: 40, height: 40, border: '3px solid #7BD8A0', pointerEvents: 'none' }} />
            </div>
            <div className="map-caption">EQUIRECTANGULAR · 2.5° / CELL</div>
          </div>

          <div className="map-layout">
            <div className="side country-list" style={{ width: 440, flex: 'none' }}>
              {COUNTRIES.map((c) => (
                <button
                  key={c.key}
                  className={`country-row ${c.status === 'locked' ? 'locked' : ''} ${selCountry === c.key ? 'sel' : ''}`}
                  style={selCountry === c.key ? { boxShadow: `0 0 0 2px ${c.color}` } : undefined}
                  onClick={() => pickCountry(c.key)}
                >
                  <span className="swatch" style={{ background: c.color }} />
                  <span className="cname">{c.name}</span>
                  <span className="cstat" style={{ color: c.status === 'open' ? '#7BD8A0' : '#4E5B72' }}>
                    {c.status === 'open' ? '진행 중' : '잠김'}
                  </span>
                </button>
              ))}
            </div>
            <div className="briefing" style={{ flex: 1 }}>
              <div className="bhead"><span>REGION</span><span style={{ color: country.color }}>{country.en}</span></div>
              <div className="bbody">
                <div className="bname" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 22, height: 22, background: country.color, display: 'inline-block' }} />
                  {country.name}
                </div>
                <div className="bdesc">{country.desc}</div>
                <div className="bline" />
                <div className="bstat"><span>스테이지</span><span>{country.key === 'k' ? `${regions.length} 전선` : `${country.stages} 스테이지`}</span></div>
                <div className="bstat"><span>상태</span><span>{country.status === 'open' ? '진행 중' : '잠김'}</span></div>
                <button
                  className="cta"
                  disabled={country.status !== 'open'}
                  onClick={() => country.status === 'open' && setView('kr')}
                >
                  {country.status === 'open' ? '진 입' : '해금 조건 미충족'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="map-layout">
          <div className="side">
            <div className="front-list">
              <button
                className={`front-row ${map.tutorialDone ? 'captured' : 'open'}`}
                onClick={onTutorial}
              >
                <span className="fid">R0</span>
                <span className="fname">튜토리얼 · 사옥</span>
                <span className="fstat">{map.tutorialDone ? '수료' : '진행'}</span>
              </button>
              {regions.map((r, i) => (
                <button
                  key={r.regionId}
                  className={`front-row ${r.state} ${sel?.regionId === r.regionId ? 'sel' : ''}`}
                  onClick={() => setSelRegion(r.regionId)}
                >
                  <span className="fid">R{i + 1}</span>
                  <span className="fname">{r.name} · {r.sector}</span>
                  <span className="fstat">
                    {r.state === 'captured' ? (r.bestGrade ? `점령 · ${r.bestGrade}` : '점령') : r.state === 'open' ? '도전 가능' : '잠김'}
                  </span>
                </button>
              ))}
            </div>
            <button className="ghost" onClick={() => setView('world')}>← 세계지도</button>
          </div>

          <div className="mid">
            <div className="pixmap" style={{ width: KR_COLS * KR_CELL, height: KR_ROWS * KR_CELL }}>
              {kSegs.map((s, i) => (
                <div key={i} className="cell" style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: s.y < 38 * KR_CELL ? '#1C3140' : '#22394A' }} />
              ))}
              <div className="grid-overlay" />
              {regions.map((r, i) => {
                const pos = KR_MARKS[`R${i + 1}`] ?? { x: 100, y: 150 + i * 60 };
                return (
                  <div
                    key={r.regionId}
                    className={`kmark ${r.state}`}
                    style={{ left: pos.x, top: pos.y }}
                    onClick={() => setSelRegion(r.regionId)}
                  >
                    <span className="box" />
                    <span className="klabel">R{i + 1} {r.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="map-caption">KOREAN PENINSULA · 0.14° / CELL · DMZ 38°N</div>
          </div>

          <div className="side">
            {sel && (
              <div className="briefing" style={{ flex: 1 }}>
                <div className="bhead">
                  <span>REGION BRIEFING</span>
                  <span style={{ color: '#7BD8A0' }}>{sel.regionId}</span>
                </div>
                <div className="bbody">
                  <div className="bname">{sel.name}</div>
                  <div className="bdesc">{sel.sector} 전선. 정체를 가린 실제 과거 차트를 읽어 자금을 만들고, 13웨이브의 베어 공세에서 사옥을 지켜낸다.</div>
                  <div className="bline" />
                  <div className="bstat"><span>웨이브</span><span>13</span></div>
                  <div className="bstat"><span>난이도</span><span style={{ color: '#FFC53D' }}>{'★'.repeat(sel.difficulty)}{'☆'.repeat(3 - sel.difficulty)}</span></div>
                  {sel.bestGrade && <div className="bstat"><span>최고 등급</span><span style={{ color: '#FFC53D' }}>{sel.bestGrade}</span></div>}
                  {sel.rewardsTaken.length > 0 && (
                    <div className="bstat"><span>확보 계열</span><span style={{ color: '#7BD8A0' }}>{sel.rewardsTaken.length}종</span></div>
                  )}
                  {sel.state === 'captured' && <div className="bstat"><span>재도전</span><span className="dim">자본금 보상 50%</span></div>}
                  <button className="cta" disabled={sel.state === 'locked'} onClick={() => enterRegion(sel.regionId, sel.state)}>
                    {sel.state === 'locked' ? '잠김 — 인접 점령 필요' : '작 전 개 시'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {notice && <p className="notice">{notice}</p>}

      <div className="map-actions">
        <button className="ghost" onClick={onTitle}>◀ 타이틀</button>
        <button onClick={onCompany}>회사</button>
        <button onClick={onCodex}>도감</button>
        <button onClick={() => setShowSettings(true)}>설정</button>
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
