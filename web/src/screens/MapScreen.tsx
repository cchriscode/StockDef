import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { MapRes, RegionId, StageMode } from '@tf/shared';
import { api } from '../net/api.js';
import { COUNTRIES, KR_COLS, KR_ROWS, WORLD_COLS, WORLD_ROWS, krSegs, worldSegs } from '../game/pixelMaps.js';

// FR-2 세계지도 — 목업 "War Room Map": 레이더 스윕·핑이 도는 전략 상황실.
// 지도(픽셀 세계지도/한반도)는 기존 자산을 그대로 쓰고 바깥 크롬만 워룸 형식으로 재구성했다.
interface Props {
  onEnterStage: (regionId: RegionId, mode: StageMode) => void;
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
  R1: { x: 106, y: 312 }, // 여의도 — DMZ(y≈302) 바로 남쪽 서울 서측
  R2: { x: 124, y: 338 }, // 판교 — 서울 남동
  R3: { x: 218, y: 448 }, // 울산 — 남동 해안
};
const KR_ON_WORLD = { x: 984, y: 152 }; // 세계지도 위 한국 좌표 (핑·조준 브래킷)
const JP_ON_WORLD = { x: 1012, y: 168 };

const STATUS_LABEL = { open: '진행 중', next: '해금 예정', locked: '잠김' } as const;
const STATUS_COLOR = { open: '#7BD8A0', next: '#FF9E86', locked: '#4E5B72' } as const;

/** 가용 폭·높이에 맞춰 고정 크기 지도를 확대·축소 (양옆 패널과 겹치지 않게 딱 맞춤)
 *  콜백 ref 사용: 로딩 화면 뒤에 늦게 마운트되어도 관측이 확실히 붙는다. */
function useFitScale(naturalW: number, naturalH: number, cap: number) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setScale(Math.min(cap, el.clientWidth / naturalW, el.clientHeight > 40 ? el.clientHeight / naturalH : cap));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, naturalW, naturalH, cap]);
  return { ref: setEl, scale };
}

/** 상황실 시계 — 목업 헤더의 실시간 타임스탬프 */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} · ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

export function MapScreen({ onEnterStage, onCodex, onTutorial, onTitle }: Props) {
  const [pickMode, setPickMode] = useState<RegionId | null>(null); // FR-2.6
  const [map, setMap] = useState<MapRes | null>(null);
  const [view, setView] = useState<'world' | 'kr'>('world');
  const [selCountry, setSelCountry] = useState('k');
  const [selRegion, setSelRegion] = useState<RegionId | null>(null);
  const [notice, setNotice] = useState('');
  const { ref: midRef, scale } = useFitScale(WORLD_W + 8, WORLD_H + 40, 1.6);
  const { ref: krRef, scale: krScale } = useFitScale(KR_COLS * KR_CELL + 16, KR_ROWS * KR_CELL + 30, 1.5);
  const clock = useClock();

  useEffect(() => {
    api.map().then(setMap).catch((e) => setNotice(String(e.message)));
  }, []);

  const wSegs = useMemo(() => worldSegs(WORLD_CELL), []);
  const kSegs = useMemo(() => krSegs(KR_CELL), []);

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
  const isKr = view === 'kr';

  const enterRegion = (regionId: RegionId, state: string) => {
    if (state === 'locked') {
      flash('인접 지역을 먼저 점령하세요');
      return;
    }
    setPickMode(regionId); // FR-2.6 난이도 선택 후 진입
  };

  // 하단 피드 — 실제 진행 상황으로 채운다 (장식용 가짜 시세를 쓰지 않는다)
  const feed = [
    ...regions.map((r, i) => `R${i + 1} ${r.name} ${r.state === 'captured' ? '점령 완료' : r.state === 'open' ? '교전 개시' : '해금 대기'}`),
    `점령 ${map.capturedCount} / ${regions.length}`,
    `경계도 ×${map.heat.toFixed(2)}`,
    `운영비 ${map.upkeepTotal} G`,
    `자본금 ${map.capital.toLocaleString()}`,
  ].join('   ·   ');

  const openCount = regions.filter((r) => r.state !== 'locked').length;
  const contested = Math.round((openCount / Math.max(regions.length, 1)) * 100);

  return (
    <div className="map-room war">
      <header className="wr-head">
        <div className="left">
          <div className="wr-live"><i /><span>LIVE</span></div>
          <span className="wr-title">{isKr ? '전략 상황실 · 국내 전선' : '전략 상황실 · 글로벌 전역'}</span>
          <span className="wr-sub">{isKr ? 'REPUBLIC OF KOREA' : 'THEATER OVERVIEW'}</span>
        </div>
        <div className="wr-chips">
          <span>점령 {map.capturedCount} / {regions.length}</span>
          <span>{clock}<i style={{ animation: 'wr-caret 1s steps(1) infinite', fontStyle: 'normal' }}>_</i></span>
          <span className="ok">SYNC OK</span>
        </div>
      </header>

      <div className="wr-body">
        <div className="wr-radar" ref={isKr ? krRef : midRef}>
          <div className="rings">
            {[0.34, 0.58, 0.86, 1.2].map((r) => (
              <i key={r} style={{ width: `${r * 100}%`, aspectRatio: '1' }} />
            ))}
          </div>
          <div className="sweep" />

          {isKr ? (
            <div style={{ transform: `scale(${krScale})`, transformOrigin: 'center' }}>
              <div className="pixmap" style={{ width: KR_COLS * KR_CELL, height: KR_ROWS * KR_CELL }}>
                {kSegs.map((s, i) => (
                  <div key={i} className="cell" style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: s.y < 38 * KR_CELL ? '#1C3140' : '#22394A' }} />
                ))}
                <div className="grid-overlay" />
                {/* DMZ 점선 */}
                <div style={{ position: 'absolute', left: 32, top: 302, width: 216, height: 4, background: 'repeating-linear-gradient(to right, #7C89A3 0 8px, transparent 8px 16px)', opacity: 0.5, pointerEvents: 'none' }} />
                {regions.map((r, i) => {
                  const pos = KR_MARKS[`R${i + 1}`] ?? { x: 120, y: 320 + i * 60 };
                  return (
                    <div key={r.regionId}>
                      {r.state !== 'locked' && (
                        <div className="wr-ping" style={{ left: pos.x + 8, top: pos.y + 8, color: r.state === 'captured' ? '#7BD8A0' : '#FFC53D' }}>
                          <i /><i className="d" /><b />
                        </div>
                      )}
                      <div
                        className={`kmark ${r.state} ${sel?.regionId === r.regionId ? 'sel' : ''}`}
                        style={{ left: pos.x, top: pos.y }}
                        onClick={() => setSelRegion(r.regionId)}
                      >
                        <span className="box" />
                        <span className="klabel">R{i + 1} {r.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
              <div className="pixmap" style={{ width: WORLD_W, height: WORLD_H }}>
                {wSegs.map((s, i) => {
                  const c = COUNTRIES.find((cc) => cc.key === s.k)!;
                  const base = c.status === 'open' ? 1 : c.status === 'next' ? 0.85 : 0.36;
                  return (
                    <div
                      key={i}
                      className="cell"
                      style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: c.color, opacity: s.k === selCountry ? Math.max(base, 0.9) : base, cursor: 'pointer' }}
                      onClick={() => pickCountry(s.k)}
                    />
                  );
                })}
                <div className="grid-overlay" />
                <div className="lat eq" style={{ top: 268 }} />
                <div className="lat" style={{ top: 188 }} />
                <div className="lat" style={{ top: 348 }} />
                <div className="meridian" style={{ left: 576 }} />

                {/* 한국 = 교전 중 / 일본 = 해금 예정 */}
                <div className="wr-ping" style={{ left: KR_ON_WORLD.x, top: KR_ON_WORLD.y, color: '#7BD8A0' }}><i /><i className="d" /><b /></div>
                <div className="wr-ping" style={{ left: JP_ON_WORLD.x, top: JP_ON_WORLD.y, color: '#FF9E86' }}><i /><i className="d" /><b /></div>
                <div className="wr-lock" style={{ left: KR_ON_WORLD.x, top: KR_ON_WORLD.y }}>
                  <i style={{ left: 0, top: 0, width: 8, height: 2 }} /><i style={{ left: 0, top: 0, width: 2, height: 8 }} />
                  <i style={{ right: 0, top: 0, width: 8, height: 2 }} /><i style={{ right: 0, top: 0, width: 2, height: 8 }} />
                  <i style={{ left: 0, bottom: 0, width: 8, height: 2 }} /><i style={{ left: 0, bottom: 0, width: 2, height: 8 }} />
                  <i style={{ right: 0, bottom: 0, width: 8, height: 2 }} /><i style={{ right: 0, bottom: 0, width: 2, height: 8 }} />
                </div>
                {/* 한국 클릭 히트박스 (셀이 작아 영역 전체를 클릭 가능하게) */}
                <div
                  style={{ position: 'absolute', left: 956, top: 124, width: 56, height: 56, cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                  onClick={() => pickCountry('k')}
                />
              </div>
            </div>
          )}

          <div className="scanline" />
          <div className="caption">
            {isKr ? `KOREAN PENINSULA · 8px/CELL · DMZ 38°N` : `MERCATOR · 8px/CELL · SWEEP 5.5s`}
          </div>
        </div>

        <aside className="wr-side">
          <div className="wr-panel">
            <div className="ph">
              <span>SELECTED THEATER</span>
              <span style={{ color: isKr ? '#7BD8A0' : country.color }}>{isKr ? sel?.regionId : country.en}</span>
            </div>
            <div className="wr-theater">
              <span className="nm">{isKr ? sel?.name : country.name}</span>
              <span className="en">{isKr ? `${sel?.sector} · 난이도 ${'★'.repeat(sel?.difficulty ?? 1)}${'☆'.repeat(3 - (sel?.difficulty ?? 1))}` : country.en}</span>
              <span className="desc">
                {isKr
                  ? '정체를 가린 실제 과거 차트를 읽어 자금을 만들고, 13웨이브의 베어 공세에서 사옥을 지켜낸다.'
                  : country.desc}
              </span>
            </div>
          </div>

          <div className="wr-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="ph">
              <span>{isKr ? 'STAGE QUEUE' : 'THEATER LIST'}</span>
              <span>{isKr ? `▸ ${regions.length} 스테이지` : `▸ ${COUNTRIES.length} 전역`}</span>
            </div>
            <div className="wr-queue">
              {isKr ? (
                <>
                  <button className={`wr-qrow ${map.tutorialDone ? 'captured' : 'open'}`} onClick={onTutorial}>
                    <span className="id">R0</span>
                    <span className="nm">사옥 · 튜토리얼</span>
                    <span className="st">{map.tutorialDone ? '수료' : '진행'}</span>
                  </button>
                  {regions.map((r, i) => (
                    <button
                      key={r.regionId}
                      className={`wr-qrow ${r.state} ${sel?.regionId === r.regionId ? 'sel' : ''}`}
                      onClick={() => setSelRegion(r.regionId)}
                    >
                      <span className="id">R{i + 1}</span>
                      <span className="nm">{r.name} · {r.sector}</span>
                      <span className="st">
                        {r.state === 'captured' ? (r.bestGrade ? `CLEAR ${r.bestGrade}` : '점령') : r.state === 'open' ? '진입 가능' : 'LOCKED'}
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                COUNTRIES.map((c) => (
                  <button
                    key={c.key}
                    className={`wr-qrow ${c.status === 'open' ? 'open' : ''} ${selCountry === c.key ? 'sel' : ''}`}
                    onClick={() => pickCountry(c.key)}
                  >
                    <span className="id" style={{ background: c.color, width: 12, height: 12 }} />
                    <span className="nm">{c.name}</span>
                    <span className="st" style={{ color: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status]}</span>
                  </button>
                ))
              )}
            </div>
            <button
              className="cta wr-cta"
              disabled={isKr ? sel?.state === 'locked' : country.status !== 'open'}
              onClick={() => (isKr ? sel && enterRegion(sel.regionId, sel.state) : country.status === 'open' && setView('kr'))}
            >
              {isKr
                ? (sel?.state === 'locked' ? '잠김 — 인접 점령 필요' : '작 전 개 시')
                : (country.status === 'open' ? '진 입' : country.status === 'next' ? '한국 점령 후 해금' : '해금 조건 미충족')}
            </button>
          </div>
        </aside>
      </div>

      <div className="wr-stats">
        <div className="blk">
          <div className="lbl">THEATER LOAD</div>
          <div className="kv"><span>전선 개방</span><span>{contested}%</span></div>
          <div className="wr-gauge"><i style={{ width: `${contested}%` }} /></div>
          <div className="kv"><span>경계도</span><span>×{map.heat.toFixed(2)}</span></div>
          <div className="wr-gauge warn"><i style={{ width: `${Math.min(100, (map.heat - 1) * 1000)}%` }} /></div>
        </div>
        <div className="blk">
          <div className="lbl">OPERATIONS</div>
          <div className="kv"><span>점령 지역</span><span>{map.capturedCount} / {regions.length}</span></div>
          <div className="kv"><span>운영비</span><span>{map.upkeepTotal} G</span></div>
          <div className="kv"><span>다음 해금</span><span>{regions.find((r) => r.state === 'locked')?.name ?? '없음'}</span></div>
        </div>
        <div className="blk">
          <div className="lbl">TREASURY</div>
          <div className="kv"><span>자본금</span><span style={{ color: 'var(--gold)' }}>{map.capital.toLocaleString()}</span></div>
          <div className="kv"><span>튜토리얼</span><span>{map.tutorialDone ? '수료' : '미수료'}</span></div>
          <div className="kv"><span>링크</span><span style={{ color: 'var(--green2)' }}>STABLE</span></div>
        </div>
      </div>

      {notice && <p className="notice">{notice}</p>}

      <div className="wr-feed">
        <span className="tag">FEED</span>
        <div className="track"><div>{feed}   ·   {feed}   ·   </div></div>
        <div className="map-actions">
          {isKr && <button className="ghost small" onClick={() => setView('world')}>← 세계지도</button>}
          <button className="ghost small" onClick={onTitle}>◀ 타이틀</button>
          <button className="small" onClick={onCodex}>도감</button>
        </div>
      </div>

      {/* FR-2.6 난이도 선택 — 스테이지 진입 직전 */}
      {pickMode && (
        <div className="overlay center" onClick={() => setPickMode(null)}>
          <div className="card mode-pick" onClick={(e) => e.stopPropagation()}>
            <h3>작전 난이도</h3>
            <p className="small dim">차트와 트레이딩 규칙은 동일하고, 방어전의 압박만 달라집니다.</p>
            <div className="mode-row">
              <button className="mode easy" onClick={() => onEnterStage(pickMode, 'easy')}>
                <b>이지</b>
                <span className="small">적 체력 −60% · 공격력 −55% · 수 −40%</span>
                <span className="small dim">자본금 보상 70%</span>
              </button>
              <button className="mode hard" onClick={() => onEnterStage(pickMode, 'hard')}>
                <b>하드</b>
                <span className="small">기본 밸런스 — 설계된 난이도</span>
                <span className="small dim">자본금 보상 100%</span>
              </button>
            </div>
            <button className="ghost small" onClick={() => setPickMode(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
