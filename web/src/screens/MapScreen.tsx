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
// 한반도 지도 위 거점 좌표 (KR_CELL 기준 px)
const KR_MARKS: Record<string, { x: number; y: number }> = {
  R1: { x: 106, y: 312 }, // 여의도 — DMZ(y≈302) 바로 남쪽 서울 서측
  R2: { x: 124, y: 338 }, // 판교 — 서울 남동
  R3: { x: 218, y: 448 }, // 울산 — 남동 해안
};
const KR_ON_WORLD = { x: 984, y: 160 }; // 세계지도 위 한국 좌표 (핑·조준·레이더 중심)
const JP_ON_WORLD = { x: 1020, y: 140 };

// 목업 War Room Map의 지도 위 콜아웃 — 앵커에서 리더선이 꺾여 라벨로 이어진다 (원본 px 좌표)
interface Callout {
  k: string; x: number; y: number; tick: number; drop: number;
  lx: number; ly: number; side: 'left' | 'right'; note: string;
}
const CALLOUTS: Callout[] = [
  { k: 'k', x: 984, y: 154, tick: 74, drop: 82, lx: -190, ly: 80, side: 'left', note: '● 교전 중' },
  { k: 'j', x: 1030, y: 150, tick: 40, drop: 132, lx: -72, ly: 132, side: 'left', note: '● 해금 예정' },
  { k: 'c', x: 872, y: 150, tick: 92, drop: 40, lx: -208, ly: 38, side: 'left', note: '○ 잠김' },
  { k: 'e', x: 600, y: 180, tick: 70, drop: 64, lx: -186, ly: 62, side: 'left', note: '○ 잠김' },
  { k: 'n', x: 220, y: 140, tick: 66, drop: 52, lx: 72, ly: 50, side: 'right', note: '○ 잠김' },
];

const STATUS_LABEL = { open: '진행 중', next: '해금 예정', locked: '잠김' } as const;
const STATUS_COLOR = { open: '#7BD8A0', next: '#FF9E86', locked: '#4E5B72' } as const;

/** 패널 크기에 맞는 **정수** 셀 크기를 고른다.
 *  CSS scale로 늘리면 8px 셀이 소수 픽셀에 앉아 가장자리가 뭉개진다 —
 *  셀 자체를 정수 px로 만들어 그리면 어떤 화면에서도 윤곽이 또렷하다.
 *  콜백 ref 사용: 로딩 화면 뒤에 늦게 마운트되어도 관측이 확실히 붙는다. */
function useCellSize(cols: number, rows: number, max: number) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [cell, setCell] = useState(6);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 28;
      const h = el.clientHeight - 44;
      setCell(Math.max(2, Math.min(max, Math.floor(w / cols), Math.floor(h / rows))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, cols, rows, max]);
  return { ref: setEl, cell };
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
  const { ref: midRef, cell: wCell } = useCellSize(WORLD_COLS, WORLD_ROWS, 14);
  const { ref: krRef, cell: kCell } = useCellSize(KR_COLS, KR_ROWS, 18);
  const clock = useClock();

  useEffect(() => {
    api.map().then(setMap).catch((e) => setNotice(String(e.message)));
  }, []);

  const wSegs = useMemo(() => worldSegs(wCell), [wCell]);
  /** 국가별 레이더 중심 — 지도 셀 바운딩 박스의 중앙 (선택한 나라로 레이더가 옮겨간다) */
  const centers = useMemo(() => {
    const bb = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
    for (const g of wSegs) {
      const o = bb.get(g.k) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      o.x0 = Math.min(o.x0, g.x); o.y0 = Math.min(o.y0, g.y);
      o.x1 = Math.max(o.x1, g.x + g.w); o.y1 = Math.max(o.y1, g.y + g.h);
      bb.set(g.k, o);
    }
    const out = new Map<string, { x: number; y: number }>();
    for (const [k, o] of bb) out.set(k, { x: (o.x0 + o.x1) / 2, y: (o.y0 + o.y1) / 2 });
    return out;
  }, [wSegs]);
  const kSegs = useMemo(() => krSegs(kCell), [kCell]);
  const kq = kCell / KR_CELL; // 목업 8px 기준 좌표 → 현재 셀 크기
  const wq = wCell / WORLD_CELL;

  if (!map) return <div className="screen center"><p className="dim">지도 로딩…</p></div>;

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 1800);
  };

  // 지도 클릭은 **선택만** 한다 — 전선 진입은 우측 CTA로 (바로 들어가면 브리핑을 볼 틈이 없다)
  const pickCountry = (key: string) => setSelCountry(key);

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

  // 선택 국가의 지도상 중심 — 레이더 링·스윕·조준 브래킷이 여기로 옮겨간다
  const focus = centers.get(selCountry) ?? { x: KR_ON_WORLD.x * wq, y: KR_ON_WORLD.y * wq };

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

          {isKr ? (
            <div>
              <div className="pixmap" style={{ width: KR_COLS * kCell, height: KR_ROWS * kCell }}>
                {kSegs.map((s, i) => (
                  <div key={i} className="cell" style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: s.y < 38 * kCell ? '#1C3140' : '#22394A' }} />
                ))}
                <div className="grid-overlay" style={{ backgroundSize: `${kCell}px ${kCell}px` }} />
                {/* DMZ 점선 */}
                <div style={{ position: 'absolute', left: 4 * kCell, top: 37.75 * kCell, width: 27 * kCell, height: Math.max(2, kCell / 2), background: `repeating-linear-gradient(to right, #7C89A3 0 ${kCell}px, transparent ${kCell}px ${kCell * 2}px)`, opacity: 0.5, pointerEvents: 'none' }} />
                {regions.map((r, i) => {
                  const m = KR_MARKS[`R${i + 1}`] ?? { x: 120, y: 320 + i * 60 };
                  const pos = { x: m.x * kq, y: m.y * kq };
                  return (
                    <div key={r.regionId}>
                      {/* 딩딩거리는 핑은 "지금 들어갈 수 있는 곳" 하나에만 — 점령지는 마커로 충분하다 */}
                      {r.state === 'open' && (
                        <div className="wr-ping" style={{ left: pos.x + kCell, top: pos.y + kCell, color: '#FFC53D' }}>
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
            <div>
              <div className="pixmap" style={{ width: WORLD_COLS * wCell, height: WORLD_ROWS * wCell }}>
                {wSegs.map((s, i) => {
                  const c = COUNTRIES.find((cc) => cc.key === s.k)!;
                  const base = c.status === 'open' ? 1 : c.status === 'next' ? 0.92 : 0.62;
                  return (
                    <div
                      key={i}
                      className="cell"
                      style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: c.color, opacity: s.k === selCountry ? Math.max(base, 0.9) : base, cursor: 'pointer' }}
                      onClick={() => pickCountry(s.k)}
                    />
                  );
                })}
                <div className="grid-overlay" style={{ backgroundSize: `${wCell}px ${wCell}px` }} />

                {/* 레이더는 패널 중앙이 아니라 선택한 나라를 중심으로 돈다 */}
                {[240, 480, 720, 940].map((d) => (
                  <i
                    key={d}
                    className="wr-ring"
                    style={{ left: focus.x - (d / 2) * wq, top: focus.y - (d / 2) * wq, width: d * wq, height: d * wq }}
                  />
                ))}
                <div
                  className="wr-sweep"
                  style={{ left: focus.x - 470 * wq, top: focus.y - 470 * wq, width: 940 * wq, height: 940 * wq }}
                />
                <div className="wr-cross h" style={{ top: focus.y }} />
                <div className="wr-cross v" style={{ left: focus.x }} />

                <div className="wr-ping" style={{ left: KR_ON_WORLD.x * wq, top: KR_ON_WORLD.y * wq, color: '#7BD8A0' }}><i /><i className="d" /><b /></div>
                <div className="wr-ping" style={{ left: JP_ON_WORLD.x * wq, top: JP_ON_WORLD.y * wq, color: '#FF9E86' }}><i /><i className="d" /><b /></div>
                <div className="wr-lock" style={{ left: focus.x, top: focus.y, color: country.color }}>
                  <i style={{ left: 0, top: 0, width: 9, height: 2 }} /><i style={{ left: 0, top: 0, width: 2, height: 9 }} />
                  <i style={{ right: 0, top: 0, width: 9, height: 2 }} /><i style={{ right: 0, top: 0, width: 2, height: 9 }} />
                  <i style={{ left: 0, bottom: 0, width: 9, height: 2 }} /><i style={{ left: 0, bottom: 0, width: 2, height: 9 }} />
                  <i style={{ right: 0, bottom: 0, width: 9, height: 2 }} /><i style={{ right: 0, bottom: 0, width: 2, height: 9 }} />
                </div>

                {/* 지도 위 국가 콜아웃 — 리더선 + 라벨 (목업 핵심 인상) */}
                {CALLOUTS.map((co) => {
                  const c = COUNTRIES.find((cc) => cc.key === co.k)!;
                  const right = co.side === 'right';
                  return (
                    <div key={co.k} className="wr-callout" style={{ left: co.x * wq, top: co.y * wq }}>
                      <i style={{ width: co.tick * wq, height: 2, background: c.color, transform: right ? undefined : `translateX(${-co.tick * wq}px)` }} />
                      <i style={{ left: (right ? co.tick : -co.tick) * wq, top: 0, width: 2, height: co.drop * wq, background: c.color }} />
                      <span
                        className="lb"
                        style={{ left: co.lx * wq, top: co.ly * wq, width: 150 * wq, alignItems: right ? 'flex-start' : 'flex-end' }}
                      >
                        <b>{c.name}</b>
                        <em style={{ color: c.color }}>{c.en}{co.k === 'k' ? ` · R1-R${regions.length}` : ''}</em>
                        <em style={{ color: c.status === 'open' ? '#7BD8A0' : c.status === 'next' ? '#FF9E86' : '#4E5B72' }}>{co.note}</em>
                      </span>
                    </div>
                  );
                })}
                {/* 한국 클릭 히트박스 (셀이 작아 영역 전체를 클릭 가능하게) */}
                <div
                  style={{ position: 'absolute', left: 119.5 * wCell, top: 15.5 * wCell, width: 7 * wCell, height: 7 * wCell, cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                  onClick={() => pickCountry('k')}
                />
              </div>
            </div>
          )}

          <div className="wr-scanband" />
          <div className="wr-corner tl" /><div className="wr-corner tr" />
          <div className="wr-corner bl" /><div className="wr-corner br" />
          {isKr && <button className="ghost small wr-back" onClick={() => setView('world')}>← 세계지도</button>}
          <div className="scanline" />
          <div className="caption">
            {isKr ? `KOREAN PENINSULA · 8px/CELL · DMZ 38°N` : `MERCATOR · 8px/CELL · SWEEP 5.5s`}
          </div>
        </div>

        <aside className="wr-side">
          {/* SELECTED THEATER — 선택 색으로 테두리를 두르고 상태 칩을 우상단에 (목업) */}
          <div className="wr-panel theater" style={{ borderColor: country.status === 'locked' ? undefined : country.color }}>
            <div className="wr-theater">
              <div className="trow">
                <div className="tcol">
                  <span className="lbl">SELECTED THEATER</span>
                  <span className="nm">{country.name}</span>
                  <span className="en" style={{ color: country.color }}>{country.en}</span>
                </div>
                <div className="tcol right">
                  <span className="chip" style={{ color: STATUS_COLOR[country.status], borderColor: STATUS_COLOR[country.status] }}>
                    {STATUS_LABEL[country.status]}
                  </span>
                  <span className="lbl">{country.key === 'k' ? `${regions.length} STAGES` : `${country.stages} STAGES`}</span>
                </div>
              </div>
              <span className="desc">{country.desc}</span>
            </div>
          </div>

          <div className="wr-panel queue">
            <div className="ph">
              <span>STAGE QUEUE</span>
              <span>{country.key === 'k' ? `▸ 대기 중 ${regions.filter((r) => r.state === 'locked').length}` : '▸ 미해금'}</span>
            </div>
            <div className="wr-queue">
              {country.key === 'k' ? (
                <>
                  <button className={`wr-qrow ${map.tutorialDone ? 'captured' : 'open'}`} onClick={onTutorial}>
                    <span className="id">R0</span>
                    <span className="nm">사옥 · 튜토리얼</span>
                    <span className="st">{map.tutorialDone ? 'CLEAR' : '진행'}</span>
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
                <div className="wr-locked">한국을 점령해야 열리는 전역입니다.</div>
              )}
            </div>
          </div>

          <button
            className="cta wr-cta"
            disabled={country.key !== 'k' || sel?.state === 'locked'}
            onClick={() => {
              if (country.key !== 'k' || !sel) return;
              if (!isKr) { setView('kr'); return; } // 세계지도에서는 먼저 국내 전선으로
              enterRegion(sel.regionId, sel.state);
            }}
          >
            {country.key !== 'k'
              ? '해금 조건 미충족'
              : !isKr ? '전 선 진 입'
                : sel?.state === 'locked' ? '잠김 — 인접 점령 필요' : '작 전 개 시'}
          </button>
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
