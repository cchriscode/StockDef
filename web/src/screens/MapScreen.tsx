import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MapRes, RegionId } from '@tf/shared';
import { api } from '../net/api.js';
import { COUNTRIES, KR_COLS, KR_ROWS, WORLD_COLS, WORLD_ROWS, krSegs, worldSegs } from '../game/pixelMaps.js';

// FR-2 세계지도 — 목업 03번: 전략 상황실 홀로그램 톤. 세계지도 → 한국 → 전선 목록 → 작전 개시
interface Props {
  onEnterStage: (regionId: RegionId) => void;
  onCodex: () => void;
  onTutorial: () => void;
  onTitle: () => void;
}

const WORLD_CELL = 8; // 목업 원본 스케일 (144×57 셀 = 1152×456)
const KR_CELL = 8;    // 41×74 셀 = 328×592
const WORLD_W = WORLD_COLS * WORLD_CELL;
const WORLD_H = WORLD_ROWS * WORLD_CELL;
// 한반도 지도 위 거점 좌표 (KR_CELL 기준 px)
const KR_MARKS: Record<string, { x: number; y: number }> = {
  R1: { x: 118, y: 148 },
  R2: { x: 134, y: 176 },
  R3: { x: 218, y: 378 },
};

const STATUS_LABEL = { open: '진행 중', next: '해금', locked: '잠김' } as const;
const STATUS_COLOR = { open: '#7BD8A0', next: '#FF9E86', locked: '#4E5B72' } as const;

/** 중앙 컬럼 폭에 맞춰 고정 크기 지도를 확대·축소 (상황실 레이아웃 유지, 최대 1.6배) */
function useFitScale(natural: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1.6, el.clientWidth / natural)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);
  return { ref, scale };
}

export function MapScreen({ onEnterStage, onCodex, onTutorial, onTitle }: Props) {
  const [map, setMap] = useState<MapRes | null>(null);
  const [view, setView] = useState<'world' | 'kr'>('world');
  const [selCountry, setSelCountry] = useState('k');
  const [selRegion, setSelRegion] = useState<RegionId | null>(null);
  const [notice, setNotice] = useState('');
  const { ref: midRef, scale } = useFitScale(WORLD_W + 8);

  useEffect(() => {
    api.map().then(setMap).catch((e) => setNotice(String(e.message)));
  }, []);

  const wSegs = useMemo(() => worldSegs(WORLD_CELL), []);
  const kSegs = useMemo(() => krSegs(KR_CELL), []);
  // 국가별 바운딩 박스 — 리스트 선택 시 지도 하이라이트 프레임용
  const wBounds = useMemo(() => {
    const m = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
    for (const s of wSegs) {
      const b = m.get(s.k) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      b.x0 = Math.min(b.x0, s.x);
      b.y0 = Math.min(b.y0, s.y);
      b.x1 = Math.max(b.x1, s.x + s.w);
      b.y1 = Math.max(b.y1, s.y + s.h);
      m.set(s.k, b);
    }
    return m;
  }, [wSegs]);

  if (!map) return <div className="screen center"><p className="dim">지도 로딩…</p></div>;

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
    <div className="map-room">
      <header className="mr-head">
        <div>
          <h1>{view === 'world' ? '세계지도' : '전선 선택'}</h1>
          <div className="sub">{view === 'world' ? 'GLOBAL THEATER · 10 REGIONS' : 'CHAPTER 1 — 국내 시장'}</div>
        </div>
        {/* FR-2.5 상시 표시 */}
        <div className="map-stats mono">
          <span>자본금 <b className="gold">{map.capital.toLocaleString()}</b></span>
          <span>점령 <b>{map.capturedCount}/3</b></span>
          <span>운영비 <b>{map.upkeepTotal} G</b></span>
          <span>경계도 <b>×{map.heat.toFixed(2)}</b></span>
        </div>
      </header>

      {view === 'world' ? (
        <div className="mr-cols">
          <div className="country-col">
            {COUNTRIES.map((c) => (
              <button
                key={c.key}
                className={`country-row ${c.status === 'locked' ? 'locked' : ''} ${selCountry === c.key ? 'sel' : ''}`}
                style={selCountry === c.key ? { boxShadow: `0 0 0 2px ${c.color}` } : undefined}
                onClick={() => pickCountry(c.key)}
              >
                <span className="swatch" style={{ background: c.color }} />
                <span className="cmain">
                  <span className="cname">{c.name}</span>
                  <span className="cstages">{c.stages} STAGES</span>
                </span>
                <span className="cstat" style={{ color: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status]}</span>
              </button>
            ))}
          </div>

          <div className="mr-mid" ref={midRef}>
            <div className="mr-glow" />
            <div style={{ width: WORLD_W * scale, height: (WORLD_H + 46) * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: WORLD_W }}>
                <div className="map-caption" style={{ marginBottom: 6 }}>EQUIRECTANGULAR · 2.5° / CELL · 8px</div>
                <div className="pixmap" style={{ width: WORLD_W, height: WORLD_H }}>
                  {wSegs.map((s, i) => {
                    const c = COUNTRIES.find((cc) => cc.key === s.k)!;
                    const base = c.status === 'open' ? 1 : c.status === 'next' ? 0.85 : 0.36;
                    const opacity = s.k === selCountry ? Math.max(base, 0.9) : base; // 선택 국가는 밝게
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
                  {/* 위선·경선 (목업 장식) */}
                  <div className="lat eq" style={{ top: 268 }} />
                  <div className="lat" style={{ top: 188 }} />
                  <div className="lat" style={{ top: 348 }} />
                  <div className="meridian" style={{ left: 576 }} />
                  {/* 콜아웃 (한국 진행 중 / 일본 해금) */}
                  <div className="callout">
                    <div className="tick" style={{ left: 1012, top: 150, width: 48, background: '#7BD8A0' }} />
                    <div className="clabel" style={{ left: 1066, top: 141, color: '#7BD8A0' }}>한국 · 진행 중</div>
                    <div className="tick" style={{ left: 1040, top: 202, width: 24, background: '#B85C7A' }} />
                    <div className="clabel" style={{ left: 1070, top: 193, color: '#E8A0B4' }}>일본 · 해금</div>
                  </div>
                  {/* 리스트 선택 국가 하이라이트 프레임 */}
                  {(() => {
                    const bb = wBounds.get(selCountry);
                    if (!bb) return null;
                    return (
                      <div
                        className="sel-frame"
                        style={{ left: bb.x0 - 8, top: bb.y0 - 8, width: bb.x1 - bb.x0 + 16, height: bb.y1 - bb.y0 + 16, borderColor: country.color }}
                      />
                    );
                  })()}
                  {/* 한국 클릭 히트박스 (셀이 작아 프레임 영역 전체를 클릭 가능하게) */}
                  <div
                    style={{ position: 'absolute', left: 956, top: 124, width: 56, height: 56, cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                    onClick={() => pickCountry('k')}
                  />
                </div>
                <div className="lon-labels">
                  <span>180°W</span><span>90°W</span><span>0°</span><span>90°E</span><span>180°E</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`briefing mr-brief ${country.status === 'next' ? 'next-lock' : ''}`}>
            <div className="bhead"><span>REGION</span><span style={{ color: country.color }}>{country.en}</span></div>
            <div className="bbody">
              <div className="bname" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 26, height: 26, background: country.color, display: 'inline-block' }} />
                {country.name}
              </div>
              <div className="bdesc">{country.desc}</div>
              <div className="bline" />
              <div className="bstat"><span>스테이지</span><span>{country.key === 'k' ? `${regions.length} 스테이지` : `${country.stages} 스테이지`}</span></div>
              <div className="bstat"><span>지도 톤</span><span className="dim">홀로그램 · 상황실</span></div>
              <div className="bstat"><span>셀 그리드</span><span className="dim">8px · {WORLD_COLS}×{WORLD_ROWS}</span></div>
              <button
                className="cta"
                disabled={country.status !== 'open'}
                onClick={() => country.status === 'open' && setView('kr')}
              >
                {country.status === 'open' ? '진 입' : country.status === 'next' ? '한국 점령 후 해금' : '해금 조건 미충족'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mr-cols">
          <div className="country-col" style={{ width: 300 }}>
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
            <button className="ghost" style={{ marginTop: 12 }} onClick={() => setView('world')}>← 세계지도</button>
          </div>

          <div className="mr-mid">
            <div className="mr-glow" />
            <div className="pixmap" style={{ width: KR_COLS * KR_CELL, height: KR_ROWS * KR_CELL }}>
              {kSegs.map((s, i) => (
                <div key={i} className="cell" style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: s.y < 38 * KR_CELL ? '#1C3140' : '#22394A' }} />
              ))}
              <div className="grid-overlay" />
              {/* DMZ 점선 (목업 장식) */}
              <div style={{ position: 'absolute', left: 32, top: 302, width: 216, height: 4, background: 'repeating-linear-gradient(to right, #7C89A3 0 8px, transparent 8px 16px)', opacity: 0.5, pointerEvents: 'none' }} />
              {regions.map((r, i) => {
                const pos = KR_MARKS[`R${i + 1}`] ?? { x: 120, y: 180 + i * 70 };
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
            <div className="map-caption" style={{ marginTop: 8 }}>KOREAN PENINSULA · 0.14° / CELL · 8px · DMZ 38°N</div>
          </div>

          <div className="mr-brief" style={{ display: 'flex' }}>
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
        <button onClick={onCodex}>도감</button>
      </div>
    </div>
  );
}
