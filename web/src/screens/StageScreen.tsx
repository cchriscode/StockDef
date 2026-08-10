import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BALANCE, Battle, ENEMY_TYPES, TOWERS, TUT_HOLD_BARS, TUT_MIN_ENTRY_BAR, UNITS, judge, liquidationDeltaPct, tradeFee,
  type BarsFile, type Direction, type FinishRes, type RegionId, type StageMode, type StageStartRes, type WsServerMsg,
} from '@tf/shared';
import { api, getSettings, getToken, track } from '../net/api.js';
import { StageWs } from '../net/stageWs.js';
import { chartScale, clockLabel, drawChart, interpPct, pctOf, sltpChipHit, type OpenMarker } from '../game/chart.js';
import { drawBattle, slotScreenPos } from '../game/battleRender.js';
import { sfx } from '../game/sfx.js';
import { TOWER_INFO, UNIT_INFO, towerStatsLine, unitStatsLine } from '../game/unitInfo.js';
import { RIG_UNIT } from '../game/rigFrames.js';
import { RigPreview } from '../ui/RigPreview.js';
import { PREVIEW_ROSTER, SHEET_UNIT, TURRET_BY_TYPE, clearPreviews, hasSkillSheet, spawnPreview } from '../game/previewSprites.js'; // [임시] 신규 아트 프리뷰

// 튜토리얼 첫 거래 규칙은 서버와 공유한다 (진입 창을 서버가 실제 차트에서 계산해 내려준다)
const TUT_CLOSE_HOLD_BARS = TUT_HOLD_BARS;

interface Props {
  regionId: RegionId;
  mode?: StageMode;
  onFinish: (sessionId: string, finish: FinishRes, regionId: RegionId) => void;
  onSkipTutorial: () => void;
}

interface ResultPopup {
  outcome: 'win' | 'lose' | 'draw';
  amount: number;   // pnl (AUM)
  goldGain: number; // 골드 환전액 (수익 × PROFIT_TO_GOLD)
  liquidated?: boolean; // FR-5.12 마진콜 — 스테이크 전액 소멸
  excessAum?: number; // FR-5.5c 골드 상한 초과분 (AUM 적립)
  trigger?: 'sl' | 'tp'; // FR-5.15 지정 레벨 자동 체결
}

type GuideStep = 0 | 1 | 2 | 3 | 4 | 5; // FR-12.2 강제 가이드

export function StageScreen({ regionId, mode = 'hard', onFinish, onSkipTutorial }: Props) {
  const isTut = regionId === 'TUT';
  const settings = getSettings();

  const chartRef = useRef<HTMLCanvasElement>(null);
  // FR-5.15 손절·익절 (시가 대비 %) / FR-5.16 이동평균선 표시
  const [sltp, setSltp] = useState<{ slPct: number | null; tpPct: number | null }>({ slPct: null, tpPct: null });
  const [showMA, setShowMA] = useState(true);
  const dragRef = useRef<'sl' | 'tp' | null>(null);
  const sltpRef = useRef<{ slPct: number | null; tpPct: number | null }>({ slPct: null, tpPct: null });
  const applySltp = (next: { slPct: number | null; tpPct: number | null }) => { sltpRef.current = next; setSltp(next); };
  const [feeInfo, setFeeInfo] = useState<{ open: number; total: number }>({ open: 0, total: 0 });
  const battleRef = useRef<HTMLCanvasElement>(null);
  const lastHud = useRef(0);

  // 게임 가변 상태 (렌더 루프 전용 — ref)
  const g = useRef<{
    start: StageStartRes | null;
    bars: BarsFile | null;
    battle: Battle | null;
    ws: StageWs | null;
    t0: number;
    barMs: number;
    seq: number;
    openMarker: (OpenMarker & { stake: number; basePrice: number; leverage: number }) | null;
    pendingOpen: boolean;
    aum: number;
    aumReported: number;
    lastAumReportAt: number;
    lastGoldEarned: number;
    lastUnitCount: number;
    finished: boolean;
    lastPayoutAt: number;
    lastEventKey: string;
    shakeUntil: number;
    lastRage: number;
  }>({
    start: null, bars: null, battle: null, ws: null, t0: 0, barMs: 1000,
    seq: 0, openMarker: null, pendingOpen: false, aum: 0,
    aumReported: 0, lastAumReportAt: 0, lastGoldEarned: 0, lastUnitCount: 0, finished: false,
    lastPayoutAt: 0, lastEventKey: '', shakeUntil: 0, lastRage: 0,
  });

  const [phase, setPhase] = useState<'loading' | 'playing' | 'settling' | 'error'>('loading');
  const [hud, setHud] = useState({ gold: 0, aum: 0, hp: 100, ebhp: 300, wave: 0, waveCount: 13, prep: true, barF: 0, barCount: 390, posCount: 0, skillCd: 0, upnl: null as number | null, udelta: null as number | null, unitCd: {} as Record<string, number> });
  const [popup, setPopup] = useState<ResultPopup | null>(null);
  const [banner, setBanner] = useState<{ text: string; kind: 'panic' | 'fomo' | 'danger' } | null>(null);
  const [stakePct, setStakePct] = useState(0.25);
  const [leverage, setLeverage] = useState(1); // FR-5.6b 배율 (진입 시점 값이 포지션에 고정, 마진 데스크로 해금)
  const [infoKey, setInfoKey] = useState<{ kind: 'unit' | 'tower'; key: string } | null>(null); // ? 도움말 카드
  const [showPreviewBar, setShowPreviewBar] = useState(false); // [임시] 신규 아트 프리뷰 바
  const [placing, setPlacingState] = useState<(typeof TOWERS)[number]['key'] | null>(null); // 타워 배치 모드
  const placingRef = useRef<typeof placing>(null);
  const setPlacing = (v: typeof placing) => { placingRef.current = v; setPlacingState(v); };
  const [slotMenu, setSlotMenuState] = useState<number | null>(null);
  const slotMenuRef = useRef<number | null>(null); // 렌더 루프에서 사거리 원 표시용
  const setSlotMenu = (v: number | null) => { slotMenuRef.current = v; setSlotMenuState(v); };
  const [, forceUi] = useState(0); // 타겟팅 모드 변경 등 즉시 반영
  const [guide, setGuide] = useState<GuideStep>(isTut ? 0 : 5);
  const [errMsg, setErrMsg] = useState('');
  const [tint, setTint] = useState('');

  const finishStage = useCallback(async (giveUp = false) => {
    const s = g.current;
    if (s.finished || !s.battle || !s.start) return;
    s.finished = true;
    s.ws?.close();
    setPhase('settling');
    const b = s.battle;
    track('stage_end', { region: regionId, hp: b.baseHP, gold: b.gold, positions: s.seq });
    // 승패 사유 (표시 전용) — 파산은 이탈과 같은 giveUp 경로라 전투 상태로 직접 판정
    const effAum = s.aum + Math.max(0, Math.floor(b.aumEarned) - s.aumReported);
    const endReason = b.victory
      ? (b.enemyBaseDestroyed ? 'destroy' : 'survive')
      : b.baseHP <= 0 ? 'hq'
        : effAum < 1 && !s.openMarker ? 'bankrupt'
          : 'leave';
    try {
      const res = await api.stageFinish(s.start.sessionId, {
        goldLeft: Math.floor(b.gold),
        goldSpent: Math.floor(b.goldSpent),
        hpLeft: giveUp ? 0 : Math.max(0, Math.ceil(b.baseHP)), // 살아 있으면 절대 0으로 내리지 않는다 (0 = 패배 판정)
        enemyBaseDestroyed: b.enemyBaseDestroyed,
      });
      onFinish(s.start.sessionId, { ...res, endReason }, regionId);
    } catch (e) {
      setErrMsg(`정산 실패: ${(e as Error).message}`);
      setPhase('error');
    }
  }, [onFinish, regionId]);

  // ─── 초기화: §8.1 LOADING (bars 전량 프리로드 + WS 연결) ───
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    (async () => {
      try {
        const start = await api.stageStart(regionId, isTut ? 1 : settings.speed, isTut ? 'easy' : mode);
        const bars = (await fetch(start.barsUrl).then((r) => r.json())) as BarsFile;
        if (cancelled) return;
        const s = g.current;
        s.start = start;
        s.bars = bars;
        s.battle = new Battle(start.params, bars.events);
        s.aum = start.params.aum;
        s.barMs = 1000 / (isTut ? 1 : settings.speed);
        const ws = new StageWs(start.sessionId, getToken());
        s.ws = ws;
        ws.onMsg = handleWs;
        await ws.ready(); // 리그 베이킹은 앱 부팅 시 백그라운드로 진행 — 진입을 막지 않는다
        ws.start();
        ws.beginClockSync(() => Math.floor((Date.now() - s.t0) / s.barMs));
        track('stage_start', { region: regionId, speed: settings.speed, aum: start.params.aum, isTut });
      } catch (e) {
        if (!cancelled) {
          setErrMsg(`스테이지 로딩 실패: ${(e as Error).message}`);
          setPhase('error');
        }
      }
    })();

    function handleWs(m: WsServerMsg) {
      const s = g.current;
      if (m.op === 'started') {
        s.t0 = Date.now();
        setPhase('playing');
        loop();
      } else if (m.op === 'position.opened') {
        if (s.openMarker?.direction === 'short') sfx.fillShort();
        else sfx.fillLong();
        s.pendingOpen = false;
        s.aum = m.aumLeft;
        s.openMarker = {
          openBarIdx: m.openBarIdx,
          basePricePct: pctOf(m.basePrice, s.bars!.openPrice),
          basePrice: m.basePrice,
          direction: s.openMarker?.direction ?? 'long',
          stake: s.openMarker?.stake ?? 0,
          leverage: s.openMarker?.leverage ?? 1,
        };
        applySltp({ slPct: null, tpPct: null }); // FR-5.15 새 포지션은 레벨 없이 시작
        setFeeInfo((f) => ({ open: m.fee, total: f.total + m.fee }));
      } else if (m.op === 'position.closed') {
        s.aum = m.aumLeft;
        const holdBars = s.openMarker ? m.exitBarIdx - s.openMarker.openBarIdx : null;
        s.openMarker = null;
        applySltp({ slPct: null, tpPct: null });
        setFeeInfo((f) => ({ open: 0, total: f.total + m.fee }));
        s.battle?.addGold(m.goldGain); // FR-5.5b: 순수익만 골드로 자동 환전 (스테이크는 AUM 반환)
        if (m.outcome === 'win') sfx.win();
        else if (m.outcome === 'lose') sfx.lose();
        else sfx.draw();
        s.lastPayoutAt = Date.now();
        setPopup({
          outcome: m.outcome, amount: m.pnl, goldGain: m.goldGain, liquidated: !!m.liquidated,
          excessAum: Math.max(0, m.pnl - m.goldGain), // 골드 상한 초과분은 AUM으로
          trigger: m.trigger, // FR-5.15 손절·익절 자동 체결
        });
        setTimeout(() => setPopup(null), m.liquidated ? 1400 : 800); // FR-5.9 (마진콜은 조금 더 길게)
        track('position_closed', { outcome: m.outcome, g: m.g, payout: m.payout, pnl: m.pnl, goldGain: m.goldGain, holdBars, forced: m.forced, liquidated: !!m.liquidated });
        if (isTut) setGuide((cur) => (cur === 2 ? 3 : cur));
      } else if (m.op === 'position.sltp') {
        const op = s.bars!.openPrice; // 서버 확정 레벨을 차트 좌표(%)로
        applySltp({ slPct: m.sl == null ? null : pctOf(m.sl, op), tpPct: m.tp == null ? null : pctOf(m.tp, op) });
      } else if (m.op === 'aum.update') {
        s.aum = m.aumLeft; // 전투 처치 AUM 크레딧 (서버 clamp 결과)
      } else if (m.op === 'clock.resync') {
        s.t0 = Date.now() - m.serverBarIdx * s.barMs;
      } else if (m.op === 'error') {
        s.pendingOpen = false;
        if (s.openMarker && !s.openMarker.basePricePct) s.openMarker = null;
      }
    }

    function loop() {
      const s = g.current;
      if (cancelled || s.finished || !s.battle || !s.bars) return;
      // 전투 시간은 캡 없이 진행 (13웨이브 후 잔적 overtime 처리 — 엔진이 내부에서 종료 판단)
      const elapsedBars = (Date.now() - s.t0) / s.barMs;
      const barF = Math.min(elapsedBars, s.bars.barCount); // 차트 표시용만 캡
      s.battle.advanceTo(elapsedBars);

      // FR-7.2 이벤트 연출
      const ev = s.battle.activeEvent;
      const key = ev ? `${ev.t}:${ev.type}` : '';
      if (key && key !== s.lastEventKey) {
        s.lastEventKey = key;
        const isPanic = ev!.type === 'panic_sell';
        setBanner({ text: isPanic ? '⚡ 속보: 패닉 셀 — 다음 웨이브 적 증원!' : '⚡ 속보: FOMO 랠리 — 아군 공격력 상승!', kind: isPanic ? 'panic' : 'fomo' });
        setTint(isPanic ? 'tint-panic' : 'tint-fomo');
        if (!settings.reduceShake) s.shakeUntil = Date.now() + 600;
        setTimeout(() => setBanner(null), 2000);
        setTimeout(() => setTint(''), 2500);
      }

      // FR-6.10b DANGER — 적 본진 위기 반격 경고
      if (s.battle.rageStage > s.lastRage) {
        s.lastRage = s.battle.rageStage;
        setBanner({
          text: s.lastRage === 1 ? '⚠ DANGER — 베어 요새가 정예 반격 분대를 투입합니다!' : '⚠ DANGER — 총공세! 최정예 병력 출현!',
          kind: 'danger',
        });
        sfx.danger();
        if (!settings.reduceShake) s.shakeUntil = Date.now() + 700;
        setTimeout(() => setBanner(null), 2400);
      }

      if (chartRef.current) {
        drawChart(chartRef.current, s.bars, barF, {
          colorBlind: settings.colorBlind,
          marker: s.openMarker,
          showResearch: s.start!.params.hasInfoResearch,
          showMA,
          sltp: s.openMarker ? { ...sltpRef.current, ...sltpPnl(), dragging: dragRef.current } : null,
        });
      }
      if (battleRef.current) {
        drawBattle(battleRef.current, s.battle, Date.now() < s.shakeUntil ? 5 : 0, slotMenuRef.current);
      }

      // 효과음: 골드 증가(수입·배당·환전) 코인음 / 아군 유닛 사망음
      if (s.battle.goldEarned > s.lastGoldEarned) {
        s.lastGoldEarned = s.battle.goldEarned;
        sfx.coin();
      }
      if (s.battle.units.length < s.lastUnitCount) sfx.unitDeath();
      s.lastUnitCount = s.battle.units.length;

      // 적 처치 AUM 보고 (1초 스로틀, 누적 단조 증가 — 서버가 상한 clamp 후 aum.update로 응답)
      const earned = Math.floor(s.battle.aumEarned);
      if (earned > s.aumReported && Date.now() - s.lastAumReportAt >= 1000) {
        s.aumReported = earned;
        s.lastAumReportAt = Date.now();
        s.ws?.reportCombatAum(earned);
      }

      // HUD는 100ms 스로틀 — 캔버스는 60fps, DOM 리렌더는 10fps면 충분
      const b = s.battle;
      if (Date.now() - lastHud.current >= 100) {
        lastHud.current = Date.now();
        // 미실현 손익 (보간가 기준, 표현 전용 — 확정 손익은 서버 판정)
        let upnl: number | null = null;
        let udelta: number | null = null;
        const mk = s.openMarker;
        if (mk && mk.basePrice > 0) {
          const curPrice = s.bars.openPrice * (1 + interpPct(s.bars, barF) / 100);
          const dPct = ((curPrice - mk.basePrice) / mk.basePrice) * 100;
          udelta = dPct;
          const gNorm = (mk.direction === 'long' ? 1 : -1) * (dPct / Math.max(s.bars.sigma['30'], 1e-6)) * mk.leverage;
          const p = s.start!.params;
          const raw = gNorm >= 0 ? p.payoutBase * gNorm : p.lossRate * gNorm;
          upnl = Math.floor(mk.stake * Math.min(Math.max(raw, -p.maxLossRate), p.payoutBase * BALANCE.Z_CAP));
        }
        setHud({
          gold: Math.floor(b.gold), aum: s.aum, hp: Math.max(0, Math.round(b.baseHP)), ebhp: Math.max(0, Math.round(b.enemyBaseHP)),
          wave: b.waveIdx, waveCount: s.start!.params.waveCount,
          prep: b.phase === 'prep', barF, barCount: s.bars.barCount,
          posCount: s.seq, skillCd: Math.max(0, Math.ceil(b.skillReadyAt - b.t)), upnl, udelta,
          unitCd: Object.fromEntries(UNITS.map((u) => [u.key, b.spawnCdLeft(u.key)])), // FR-6.5e 재소환 대기
        });
      }

      if (b.phase === 'done') {
        void finishStage();
        return;
      }
      // FR-6.9 파산 패배: AUM 전량 소진 + 무포지션 (미보고 처치 AUM까지 포함해 판정)
      const effAum = s.aum + Math.max(0, Math.floor(s.battle.aumEarned) - s.aumReported);
      if (effAum < 1 && !s.openMarker && !s.pendingOpen) {
        track('bankrupt', { region: regionId, barF });
        void finishStage(true);
        return;
      }
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      g.current.ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId]);

  // ─── FR-5 포지션 진입·청산 ───
  /** 튜토리얼 진입 창 — 서버가 실제 차트에서 계산한 "지금 사면 이기는" 구간들 */
  const tutWindows = (): [number, number][] => {
    const w = g.current.start?.params.tutEntryWindows;
    return w && w.length ? w : [[TUT_MIN_ENTRY_BAR, TUT_MIN_ENTRY_BAR + 12]]; // 서버 계산 실패 시 폴백
  };
  const inTutWindow = (bar: number) => tutWindows().some(([a2, b2]) => bar >= a2 && bar <= b2);
  /** 창을 놓쳤을 때 다음 창까지 남은 초 (없으면 null) */
  const nextTutWindowIn = (bar: number): number | null => {
    const nxt = tutWindows().find(([a2]) => a2 > bar);
    return nxt ? Math.ceil(nxt[0] - bar) : null;
  };

  // FR-12.2c: 창이 끝나가면 대신 눌러 준다 — 놓쳐서 튜토리얼이 멈추는 상황을 없앤다
  const autoEntered = useRef(false);
  useEffect(() => {
    if (!isTut || guide !== 1 || phase !== 'playing' || autoEntered.current) return;
    const s2 = g.current;
    if (s2.openMarker || s2.pendingOpen) return;
    const win = tutWindows().find(([a2, b2]) => hud.barF >= a2 && hud.barF <= b2);
    if (!win || hud.barF < win[1] - 2) return; // 창의 마지막 2초에만
    autoEntered.current = true;
    setBanner({ text: '⏱ 진입 시점이 지나갈 참이라 자동으로 LONG 진입했습니다', kind: 'fomo' });
    setTimeout(() => setBanner(null), 2600);
    openPosition('long');
    // openPosition은 최신 렌더의 클로저를 쓰므로 의존성에 넣지 않는다 (매 렌더 새 함수)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTut, guide, phase, hud.barF]);

  const canOpen = (() => {
    const s = g.current;
    if (phase !== 'playing' || s.pendingOpen || s.openMarker || !s.start) return false;
    if (s.seq >= s.start.params.maxPositions) return false;
    if (s.aum < 1) return false;
    if (hud.barF + 3 >= hud.barCount) return false; // 종료 직전엔 체결 불가
    if (isTut && guide < 1) return false;
    if (isTut && guide === 1 && !inTutWindow(hud.barF)) return false;
    if (isTut && guide === 2) return false;
    return true;
  })();

  const openPosition = (direction: Direction) => {
    const s = g.current;
    if (!canOpen || !s.ws) return;
    const stake = Math.max(1, Math.floor(s.aum * stakePct));
    s.seq += 1;
    s.pendingOpen = true;
    s.openMarker = { openBarIdx: 0, basePricePct: 0, basePrice: 0, direction, stake, leverage };
    s.ws.openPosition(s.seq, direction, stake, leverage);
    track('position_open', { seq: s.seq, direction, stakePct, leverage, waveIdx: hud.wave, phase: hud.prep ? 'prep' : 'wave' });
    if (isTut && guide === 1) setGuide(2);
  };

  // 튜토리얼 ③단계: WIN이 보장되는 상승 구간이 지난 뒤에만 청산 허용
  const canClose = (() => {
    const s = g.current;
    if (phase !== 'playing' || !s.openMarker || s.openMarker.basePrice <= 0) return false;
    if (isTut && guide === 2 && hud.barF < s.openMarker.openBarIdx + TUT_CLOSE_HOLD_BARS) return false;
    return true;
  })();

  // 대기가 의도된 것임을 알리려고 남은 시간을 버튼에 띄운다 (튜토리얼은 1배속 고정 = 1봉 1초)
  const closeWaitS = (() => {
    const s = g.current;
    if (canClose || phase !== 'playing' || !isTut || guide !== 2 || !s.openMarker) return 0;
    return Math.max(0, Math.ceil(s.openMarker.openBarIdx + TUT_CLOSE_HOLD_BARS - hud.barF));
  })();

  /** 지정 레벨에 닿았을 때 실현될 손익 (왕복 수수료 차감) — 라벨 칩에 표시 */
  const sltpPnl = (): { slPnl: number | null; tpPnl: number | null } => {
    const s = g.current;
    const mk = s.openMarker;
    if (!mk || !s.bars || !s.start) return { slPnl: null, tpPnl: null };
    const fee2 = tradeFee(mk.stake, mk.leverage) * 2;
    const at = (pct: number | null) => {
      if (pct == null) return null;
      const price = s.bars!.openPrice * (1 + pct / 100);
      const r = judge(mk.basePrice, price, s.bars!.sigma['30'], mk.direction, mk.stake, s.start!.params.lossRate, mk.leverage);
      return r.pnl - fee2;
    };
    return { slPnl: at(sltpRef.current.slPct), tpPnl: at(sltpRef.current.tpPct) };
  };

  // FR-5.15 손절·익절 드래그 — 차트 위에서 선을 잡아 끌어 레벨을 정한다 (실거래소 방식).
  // 진입가 위/아래 어느 쪽을 잡았는지로 익절/손절을 자동 판별한다.
  const sltpFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): number | null => {
    const s = g.current;
    const cv = chartRef.current;
    if (!cv || !s.bars || !s.openMarker) return null;
    const r = cv.getBoundingClientRect();
    const yCanvas = ((e.clientY - r.top) / r.height) * cv.height;
    const sc = chartScale(s.bars, hud.barF, s.openMarker, cv.height);
    if (yCanvas > sc.priceH) return null; // 거래량 영역
    return sc.pctOfY(yCanvas);
  };

  const onChartDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = g.current;
    if (!s.openMarker || !s.bars) return;
    const cv = chartRef.current!;
    const r = cv.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * cv.width;
    const py = ((e.clientY - r.top) / r.height) * cv.height;
    const sc = chartScale(s.bars, hud.barF, s.openMarker, cv.height);

    // 라벨 칩 먼저 — × 는 해당 레벨만 취소, 본체는 잡아끌기 (바이낸스식)
    for (const [kind, lvl] of [['sl', sltpRef.current.slPct], ['tp', sltpRef.current.tpPct]] as ['sl' | 'tp', number | null][]) {
      if (lvl == null) continue;
      const hit = sltpChipHit(px, py, sc.yOf(lvl), cv.width);
      if (!hit) continue;
      if (hit === 'close') {
        const next = { ...sltpRef.current, [kind === 'sl' ? 'slPct' : 'tpPct']: null };
        applySltp(next);
        pushSltp(next);
      } else {
        dragRef.current = kind;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    const pct = sltpFromEvent(e);
    if (pct == null) return;
    const long = s.openMarker.direction === 'long';
    // 진입가보다 유리한 쪽 = 익절, 불리한 쪽 = 손절
    const kind: 'sl' | 'tp' = (long ? pct > s.openMarker.basePricePct : pct < s.openMarker.basePricePct) ? 'tp' : 'sl';
    dragRef.current = kind;
    e.currentTarget.setPointerCapture(e.pointerId);
    applySltp({ ...sltpRef.current, [kind === 'sl' ? 'slPct' : 'tpPct']: clampSltp(kind, pct) });
  };

  /** 손절은 진입가 불리한 쪽, 익절은 유리한 쪽에만 놓일 수 있다 (서버 검증과 같은 규칙) */
  const clampSltp = (kind: 'sl' | 'tp', pct: number): number => {
    const mk = g.current.openMarker;
    if (!mk) return pct;
    const base = mk.basePricePct;
    const eps = 0.01;
    const wantAbove = mk.direction === 'long' ? kind === 'tp' : kind === 'sl';
    return wantAbove ? Math.max(pct, base + eps) : Math.min(pct, base - eps);
  };

  const onChartMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const kind = dragRef.current;
    if (!kind) return;
    const pct = sltpFromEvent(e);
    if (pct == null) return;
    applySltp({ ...sltpRef.current, [kind === 'sl' ? 'slPct' : 'tpPct']: clampSltp(kind, pct) });
  };

  /** 확정은 서버 판정 — 화면 %를 가격으로 바꿔 보낸다 */
  const pushSltp = (lv: { slPct: number | null; tpPct: number | null }) => {
    const s = g.current;
    if (!s.openMarker || !s.bars || !s.ws) return;
    const op = s.bars.openPrice;
    const toPrice = (pct: number | null) => (pct == null ? null : op * (1 + pct / 100));
    s.ws.setSltp(s.seq, toPrice(lv.slPct), toPrice(lv.tpPct));
  };

  const onChartUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    pushSltp(sltpRef.current);
  };

  const clearSltp = () => {
    applySltp({ slPct: null, tpPct: null });
    pushSltp({ slPct: null, tpPct: null });
  };

  const closePosition = () => {
    const s = g.current;
    if (!canClose || !s.ws || !s.openMarker) return;
    s.ws.closePosition(s.seq);
    track('position_close_req', { seq: s.seq, holdBars: Math.floor(hud.barF - s.openMarker.openBarIdx) });
  };

  // ─── FR-6 전투 입력 ───
  const spendTrack = (item: string, cost: number) => {
    track('gold_spent', { item, cost, waveIdx: hud.wave, msSincePayout: g.current.lastPayoutAt ? Date.now() - g.current.lastPayoutAt : null });
  };

  const buildTower = (slot: number, key: (typeof TOWERS)[number]['key']) => {
    const b = g.current.battle;
    if (!b) return;
    const spec = TOWERS.find((t) => t.key === key)!;
    if (b.buildTower(slot, key)) {
      spendTrack(`tower:${key}`, spec.cost);
      if (isTut && guide === 3) setGuide(4);
    }
    setSlotMenu(null);
  };

  const upgradeTower = (slot: number) => {
    const b = g.current.battle;
    if (!b) return;
    const tw = b.towers[slot];
    if (tw && b.upgradeTower(slot)) spendTrack(`upgrade:${tw.key}`, TOWERS.find((t) => t.key === tw.key)!.upgradeCost);
    setSlotMenu(null);
  };

  const spawnUnit = (key: (typeof UNITS)[number]['key']) => {
    const b = g.current.battle;
    if (!b) return;
    const cost = b.unitCost(key);
    if (b.spawnUnit(key)) {
      sfx.spawn();
      g.current.lastUnitCount = b.units.length; // 소환 직후 사망음 오탐 방지
      spendTrack(`unit:${key}`, cost);
      if (isTut && guide === 4) setGuide(5);
    }
  };

  const useSkill = () => {
    const b = g.current.battle;
    if (b?.useSkill()) spendTrack('skill', BALANCE.SKILL_COST);
  };

  const onBattleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const b = g.current.battle;
    const canvas = battleRef.current;
    if (!b || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    // 캔버스 내부 좌표로 환산 — 사옥 슬롯은 x가 같고 높이만 다르므로 2D로 판정한다
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    let best = -1;
    let bestD = 70;
    for (let s = 0; s < b.towers.length; s++) {
      const pos = slotScreenPos(b, s, canvas.width);
      const d = Math.hypot(pos.x - cx, pos.y - 18 - cy); // 구조물 몸통 중심 기준
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best < 0) { setSlotMenu(null); return; }
    if (placingRef.current) { // 배치 모드 — 빈 슬롯이면 건설
      if (!b.towers[best]) buildTower(best, placingRef.current);
      setPlacing(null);
      setSlotMenu(null);
      return;
    }
    setSlotMenu(b.towers[best] ? best : null); // 지어진 타워만 선택 (업그레이드·타겟팅)
  };

  // ─── 렌더 ───
  if (phase === 'error') {
    return (
      <div className="screen center">
        <p>{errMsg}</p>
        <button onClick={() => location.reload()}>다시 시도</button>
      </div>
    );
  }
  if (phase === 'loading' || !g.current.start) {
    return <div className="screen center"><p>차트 데이터 프리로드 중…</p></div>;
  }

  const s = g.current;
  const p = s.start!.params;
  const tags = s.bars!.tags;
  const battle = s.battle!;
  const progress = Math.min(hud.barF / hud.barCount, 1);
  const hasPosition = !!s.openMarker && s.openMarker.basePrice > 0;

  return (
    <div className={`screen stage ${tint}`}>
      {/* 블라인드 태그 + 진행바 (FR-3.7, FR-4.2) */}
      <div className="stage-top">
        <span className="tags">{tags.region} · {tags.sector} · {tags.capTier === 'large' ? '대형주' : '중형주'} · ???</span>
        <div className="clockbar">
          <span>D+0</span>
          <div className="track"><div className="fill" style={{ width: `${progress * 100}%` }} /></div>
          <span>D+{hud.barCount}</span>
          <b>{clockLabel(hud.barF, hud.barCount)}</b>
        </div>
        <button className="ghost small" onClick={() => (isTut ? onSkipTutorial() : confirm('이탈하면 패배 처리됩니다 (FR-6.11)') && finishStage(true))}>
          {isTut ? '튜토리얼 스킵' : '이탈'}
        </button>
      </div>

      {/* 차트 밴드: 좌 차트 + 우 트레이드 패널 (FR-5.1 자유 진입·청산) */}
      <div className="chart-band">
        <div className="chart-area">
          <canvas
            ref={chartRef}
            width={1500}
            height={252}
            className={`chart ${g.current.openMarker ? 'sltp-ready' : ''}`}
            onPointerDown={onChartDown}
            onPointerMove={onChartMove}
            onPointerUp={onChartUp}
            onPointerCancel={onChartUp}
          />
          <div className="chart-tools">
            <button className={`ghost small ${showMA ? 'on' : ''}`} onClick={() => setShowMA((v) => !v)}>MA 5·20·60</button>
            {g.current.openMarker && (
              <>
                <span className="small dim">차트를 끌어 손절·익절 지정</span>
                {(sltp.slPct != null || sltp.tpPct != null) && <button className="ghost small" onClick={clearSltp}>지정 해제</button>}
              </>
            )}
          </div>
        </div>
        <div className="trade-panel">
          <div className="ls-row">
            <button className={`long ${isTut && guide === 1 ? 'pulse' : ''}`} disabled={!canOpen} onClick={() => openPosition('long')}>
              <span className="arrow">▲</span>LONG<span className="hint">상승에 베팅</span>
            </button>
            <button className="short" disabled={!canOpen || (isTut && guide <= 2)} onClick={() => openPosition('short')}>
              <span className="arrow">▼</span>SHORT<span className="hint">하락에 베팅</span>
            </button>
          </div>
          <div className="stake-row">
            <span className="lbl">투입</span>
            {BALANCE.STAKE_PCTS.map((v) => (
              <button key={v} className={`opt ${stakePct === v ? 'on' : ''}`} disabled={isTut && guide <= 2 && v !== 0.25} onClick={() => setStakePct(v)}>
                {v === 1 ? 'ALL' : `${v * 100}%`}
              </button>
            ))}
          </div>
          <div className="stake-row">
            <span className="lbl">배율</span>
            {BALANCE.LEVERAGES.map((v) => (
              <button
                key={v}
                className={`opt ${leverage === v ? 'on' : ''}`}
                disabled={v > p.maxLeverage || (isTut && v !== 1)}
                title={v > p.maxLeverage ? '회사 → 마진 데스크 업그레이드로 해금' : undefined}
                onClick={() => setLeverage(v)}
              >
                {v}×{v > p.maxLeverage ? ' 🔒' : ''}
              </button>
            ))}
          </div>
          <div className="fee-row">
            <span className="lbl">수수료</span>
            <span className="mono dim">
              왕복 {(tradeFee(Math.max(1, Math.floor(hud.aum * stakePct)), leverage) * 2).toLocaleString()} AUM
              <i className="hint"> (명목가 {(BALANCE.FEE_RATE * 100).toFixed(1)}% ×2)</i>
            </span>
          </div>
          <div className="pos-box">
            <div className="pr">
              <span>거래 횟수</span>
              <span className={p.maxPositions - hud.posCount <= 2 ? 'down' : ''}>
                {hud.posCount}/{p.maxPositions} (남은 {Math.max(0, p.maxPositions - hud.posCount)}회)
              </span>
            </div>
            {hasPosition ? (
              <>
                <div className="pr">
                  <span>방향</span>
                  <span className={s.openMarker!.direction === 'long' ? 'dir-long' : 'dir-short'}>
                    {s.openMarker!.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                  </span>
                </div>
                <div className="pr"><span>투입</span><span>{s.openMarker!.stake.toLocaleString()} AUM × {s.openMarker!.leverage}배</span></div>
                <div className="pr">
                  <span>진입 대비</span>
                  <span className={`upnl ${hud.udelta != null && hud.udelta < 0 ? 'neg' : 'pos'}`}>
                    {hud.udelta != null ? `${hud.udelta >= 0 ? '+' : ''}${hud.udelta.toFixed(2)}%` : '…'}
                  </span>
                </div>
                <div className="pr">
                  <span>청산선</span>
                  <span className="dim mono">
                    {(() => { const d = liquidationDeltaPct(g.current.bars!.sigma['30'], p.lossRate, s.openMarker!.leverage, s.openMarker!.direction); return `${d >= 0 ? '+' : ''}${d.toFixed(2)}%`; })()}
                  </span>
                </div>
                <div className="pr">
                  <span>P&amp;L</span>
                  <span className={`upnl ${hud.upnl != null && hud.upnl < 0 ? 'neg' : 'pos'}`}>
                    {hud.upnl != null ? `${hud.upnl >= 0 ? '+' : ''}${hud.upnl.toLocaleString()} AUM` : '…'}
                  </span>
                </div>
                <button
                  className={`close-pos ${isTut && guide === 2 && canClose ? 'pulse' : ''} ${closeWaitS > 0 ? 'waiting' : ''}`}
                  disabled={!canClose}
                  onClick={closePosition}
                >
                  {closeWaitS > 0 ? `${closeWaitS}초 후 청산 가능` : '청산 ✕'}
                </button>
              </>
            ) : (
              <span className="none">무포지션<br />LONG / SHORT로 진입</span>
            )}
          </div>
        </div>
      </div>

      <div className="battle-wrap">
        <canvas ref={battleRef} width={1800} height={300} className="battle" onClick={onBattleClick} />
        {/* 양측 HP + 웨이브 (목업 04번 오버레이) */}
        <div className="hp-overlay left">
          <div className="who"><i />우리 사옥</div>
          <div className="track"><div className="fillbar" style={{ width: `${hud.hp}%` }} /></div>
          <div className="num">{hud.hp} / 100</div>
        </div>
        <div className="hp-overlay right">
          <div className="who">베어 요새<i /></div>
          <div className="track"><div className="fillbar" style={{ width: `${(hud.ebhp / 300) * 100}%` }} /></div>
          <div className="num">{hud.ebhp} / 300</div>
        </div>
        <div className="wave-pill">
          <div className="w">WAVE {Math.min(Math.max(hud.wave, 1), hud.waveCount)} / {hud.waveCount}</div>
          <div className="n">{hud.prep ? 'PREP' : 'ENGAGED'}</div>
        </div>
        {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}
        {popup && (
          <div className={`popup ${popup.outcome}`}>
            {popup.liquidated
              ? `⚠ 강제청산 ${popup.amount.toLocaleString()} AUM 전액 소멸`
              : popup.trigger
                ? `${popup.trigger === 'tp' ? '익절' : '손절'} 체결 ${popup.amount >= 0 ? '+' : ''}${popup.amount.toLocaleString()} AUM`
                : popup.outcome === 'win'
                ? `WIN +${popup.goldGain.toLocaleString()} G 입금${popup.excessAum ? ` · +${popup.excessAum.toLocaleString()} AUM` : ''}`
                : popup.outcome === 'lose'
                  ? `LOSE ${popup.amount.toLocaleString()} AUM`
                  : `DRAW ${popup.goldGain > 0 ? `+${popup.goldGain.toLocaleString()} G` : `${popup.amount.toLocaleString()} AUM`}`}
          </div>
        )}
        {/* 준비 페이즈: 이번 웨이브 조합 미리보기 */}
        {hud.prep && hud.wave >= 1 && hud.wave <= hud.waveCount && (
          <div className="wave-preview">
            <b>W{hud.wave}</b>
            {battle.previewWave(hud.wave).map((c) => (
              <span key={c.type} title={ENEMY_TYPES[c.type].name}>
                {ENEMY_TYPES[c.type].icon}×{c.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 하단 커맨드 바 (FR-6.5 / FR-6.6) */}
      <div className="cmd-bar">
        <div className="cmd-funds">
          <div className="f g"><i />{hud.gold.toLocaleString()}</div>
          <div className="f a"><i />{hud.aum.toLocaleString()}</div>
        </div>
        <div className="cmd-units">
          {/* [임시] 신규 아트 로스터 중 스킬이 있는 유닛만 노출 (권총 장교·지팡이 신사는 스킬 시트 없음) */}
          {UNITS.filter((u) => SHEET_UNIT[u.key] && hasSkillSheet(SHEET_UNIT[u.key])).map((u) => {
            const cost = battle.unitCost(u.key);
            return (
              <span key={u.key} className="ub-wrap">
                <button className={isTut && guide === 4 ? 'pulse' : ''}
                  disabled={hud.gold < cost || phase !== 'playing' || (hud.unitCd[u.key] ?? 0) > 0}
                  onClick={() => spawnUnit(u.key)}>
                  {u.name}
                  <span className="cost">
                    {(hud.unitCd[u.key] ?? 0) > 0 ? `${Math.ceil(hud.unitCd[u.key])}s` : `${cost} G`}
                  </span>
                </button>
                <button className="qmark" title="유닛 설명" onClick={() => setInfoKey({ kind: 'unit', key: u.key })}>?</button>
              </span>
            );
          })}
          <button className="skill" disabled={hud.gold < BALANCE.SKILL_COST || hud.skillCd > 0} onClick={useSkill}>
            공시폭탄<span className="cost">{hud.skillCd > 0 ? `${hud.skillCd}s` : `${BALANCE.SKILL_COST} G`}</span>
          </button>
        </div>
        <div className="cmd-towers">
          {slotMenu != null && battle.towers[slotMenu] ? (
            <>
              <span className="lbl">{TOWERS.find((t) => t.key === battle.towers[slotMenu]!.key)!.name}</span>
              <button onClick={() => { battle.cycleTargeting(slotMenu); forceUi((v) => v + 1); }}>
                타겟: {{ first: '선두', last: '후미', strong: '강적', close: '근접' }[battle.towers[slotMenu]!.mode]} ↻
              </button>
              {battle.towers[slotMenu]!.lv < 2 ? (
                <button disabled={hud.gold < TOWERS.find((t) => t.key === battle.towers[slotMenu]!.key)!.upgradeCost}
                  onClick={() => upgradeTower(slotMenu)}>
                  업그레이드 {TOWERS.find((t) => t.key === battle.towers[slotMenu]!.key)!.upgradeCost} G
                </button>
              ) : <span className="small dim">최대 레벨</span>}
              <button className="ghost small" onClick={() => setSlotMenu(null)}>해제</button>
            </>
          ) : (
            <>
              <span className="lbl">타워</span>
              {TOWERS.map((t) => (
                <span key={t.key} className="ub-wrap">
                  <button className={placing === t.key ? 'on' : ''} disabled={hud.gold < t.cost}
                    onClick={() => setPlacing(placing === t.key ? null : t.key)}>
                    {t.name}<span className="cost">{t.cost} G</span>
                  </button>
                  <button className="qmark" title="타워 설명" onClick={() => setInfoKey({ kind: 'tower', key: t.key })}>?</button>
                </span>
              ))}
              {placing && <span className="small up">설치할 위치를 클릭하세요 (사옥 위 2칸 · 지면 1칸)</span>}
            </>
          )}
        </div>
        <div className="cmd-right">
          <button className="ghost small" onClick={() => setShowPreviewBar((v) => !v)}>🎭 아트 프리뷰</button>
          <span className="small dim mono">L={p.lossRate} · heat {p.heat.toFixed(2)}</span>
        </div>
      </div>

      {/* [임시] 신규 스프라이트 프리뷰 — 아군·적군 모두 클릭 소환 (엔진 무관, 생김새 확인용) */}
      {showPreviewBar && (
        <div className="preview-bar">
          <div className="pb-head">
            <b>적군 아트 프리뷰</b>
            <span className="small dim">클릭하면 전장에 걸어 나옵니다 (2.2초마다 공격 모션 · 전투에는 관여하지 않음). 아군은 아래 커맨드 바에 1G로 들어가 있습니다.</span>
            <button className="ghost small" onClick={() => clearPreviews()}>전부 지우기</button>
            <button className="ghost small" onClick={() => setShowPreviewBar(false)}>✕</button>
          </div>
          <div className="pb-row">
            <span className="lbl down">적군</span>
            {PREVIEW_ROSTER.filter((s) => s.side === 'enemy').map((s) => (
              <button key={s.id} onClick={() => spawnPreview(s.id, battle.t)}>
                {s.name}{s.kind === 'air' ? ' ✈' : s.kind === 'boss' ? ' ★' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ? 도움말 카드 — 유닛/타워 역할·스킬·수치 */}
      {infoKey && (() => {
        const isUnit = infoKey.kind === 'unit';
        const card = isUnit ? UNIT_INFO[infoKey.key as keyof typeof UNIT_INFO] : TOWER_INFO[infoKey.key as keyof typeof TOWER_INFO];
        const name = isUnit
          ? UNITS.find((u) => u.key === infoKey.key)!.name
          : TOWERS.find((t) => t.key === infoKey.key)!.name;
        const stats = isUnit
          ? unitStatsLine(infoKey.key as keyof typeof UNIT_INFO)
          : towerStatsLine(infoKey.key as keyof typeof TOWER_INFO);
        // 타워는 실제로 세워지는 신규 포탑 스프라이트를 보여준다 (구 리그 그림이 뜨던 문제)
        const turretId = !isUnit ? TURRET_BY_TYPE[infoKey.key] : undefined;
        const rigIdx = isUnit ? RIG_UNIT[infoKey.key] : undefined;
        return (
          <div className="overlay center" onClick={() => setInfoKey(null)}>
            <div className="card info-card" onClick={(e) => e.stopPropagation()}>
              <h3>{name} <span className="small dim">{card.role}</span></h3>
              {turretId ? (
                <img src={`/assets/turrets/${turretId}.png`} alt="" style={{ height: 150, objectFit: 'contain', margin: '0 auto' }} />
              ) : rigIdx != null ? (
                <RigPreview unit={rigIdx} height={150} />
              ) : (
                <img
                  src={SHEET_UNIT[infoKey.key] ? `/assets/preview/${SHEET_UNIT[infoKey.key]}_walk.png` : '/assets/units/cane/wk-strip.png'}
                  alt=""
                  style={{ width: SHEET_UNIT[infoKey.key] ? 150 : 100, height: 150, objectFit: 'cover', objectPosition: 'left', imageRendering: SHEET_UNIT[infoKey.key] ? 'auto' : 'pixelated', margin: '0 auto' }}
                />
              )}
              <p>{card.desc}</p>
              <p className="skill-line">✦ {card.skill}</p>
              <p className="small mono dim">{stats}</p>
              <button onClick={() => setInfoKey(null)}>닫기</button>
            </div>
          </div>
        );
      })()}

      <p className="disclaimer">본 콘텐츠는 과거 데이터를 활용한 게임이며 투자 조언이 아닙니다.</p>

      {/* FR-12 튜토리얼 가이드 */}
      {isTut && guide < 5 && (
        <div className="guide">
          {guide === 0 && (
            <>
              <p>📈 차트는 <b>일봉</b>입니다 — 1봉 = 1거래일, 1초에 하루씩 흐릅니다. 실전에서는 실제 과거 장세가 나오며 어느 회사의 어느 시기인지는 숨겨져 있습니다.<br />
                Y축은 시작 시점 대비 %입니다. 오를 것 같으면 LONG, 내릴 것 같으면 SHORT.</p>
              <button onClick={() => setGuide(1)}>다음</button>
            </>
          )}
          {guide === 1 && (() => {
            const waitS = nextTutWindowIn(hud.barF);
            const open = inTutWindow(hud.barF);
            return (
              <p>
                🎯 {open ? '지금 상승 흐름입니다.' : '지금은 진입 시점이 아닙니다.'} <b>LONG ▲</b> 버튼을 눌러 포지션에 진입해 보세요!
                {!open && waitS != null && ` (${waitS}초 후 다음 기회)`}
              </p>
            );
          })()}
          {guide === 2 && (
            <p>
              ⏳ 진입했습니다! 가격이 오르는 동안 미실현 손익이 실시간으로 움직입니다. 충분히 오르면 <b>청산 ✕</b> 버튼으로 이익을 확정하세요.<br />
              💡 <b>차트를 위아래로 끌면</b> 손절·익절 선을 걸 수 있습니다 — 진입가보다 위를 잡으면 익절, 아래를 잡으면 손절입니다.
              선에 붙은 라벨에는 그 가격에 닿았을 때의 손익이 뜨고, <b>×</b>로 해제합니다. 자리를 비워도 자동으로 체결됩니다.
            </p>
          )}
          {guide === 3 && <p>💰 골드가 입금됐습니다! 이 돈으로 방어하세요. 아래 커맨드 바의 <b>타워 버튼</b>을 누른 다음, 전장에서 <b>설치할 위치(점선 슬롯)</b>를 클릭하면 지어집니다.</p>}
          {guide === 4 && <p>⚔ 이제 <b>유닛</b>을 소환해 전선을 미세요. 아래 인턴/애널리스트 버튼!</p>}
        </div>
      )}
      {phase === 'settling' && <div className="overlay center"><p>정산 중…</p></div>}
    </div>
  );
}
