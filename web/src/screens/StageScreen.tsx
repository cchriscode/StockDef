import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BALANCE, Battle, ENEMY_TYPES, TOWERS, UNITS,
  type BarsFile, type Direction, type FinishRes, type RegionId, type StageStartRes, type WsServerMsg,
} from '@tf/shared';
import { api, getSettings, getToken, track } from '../net/api.js';
import { StageWs } from '../net/stageWs.js';
import { clockLabel, drawChart, interpPct, pctOf, type OpenMarker } from '../game/chart.js';
import { drawBattle } from '../game/battleRender.js';

interface Props {
  regionId: RegionId;
  onFinish: (sessionId: string, finish: FinishRes, regionId: RegionId) => void;
  onSkipTutorial: () => void;
}

interface ResultPopup {
  outcome: 'win' | 'lose' | 'draw';
  amount: number;   // pnl (AUM)
  goldGain: number; // 골드 환전액 (수익 × PROFIT_TO_GOLD)
}

type GuideStep = 0 | 1 | 2 | 3 | 4 | 5; // FR-12.2 강제 가이드

export function StageScreen({ regionId, onFinish, onSkipTutorial }: Props) {
  const isTut = regionId === 'TUT';
  const settings = getSettings();

  const chartRef = useRef<HTMLCanvasElement>(null);
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
    openMarker: (OpenMarker & { stake: number; basePrice: number }) | null;
    pendingOpen: boolean;
    closing: boolean;
    aum: number;
    aumReported: number;
    lastAumReportAt: number;
    finished: boolean;
    lastPayoutAt: number;
    lastEventKey: string;
    shakeUntil: number;
  }>({
    start: null, bars: null, battle: null, ws: null, t0: 0, barMs: 1000,
    seq: 0, openMarker: null, pendingOpen: false, closing: false, aum: 0,
    aumReported: 0, lastAumReportAt: 0, finished: false,
    lastPayoutAt: 0, lastEventKey: '', shakeUntil: 0,
  });

  const [phase, setPhase] = useState<'loading' | 'playing' | 'settling' | 'error'>('loading');
  const [hud, setHud] = useState({ gold: 0, aum: 0, hp: 100, ebhp: 300, wave: 0, waveCount: 13, prep: true, barF: 0, barCount: 390, posCount: 0, skillCd: 0, upnl: null as number | null, udelta: null as number | null });
  const [popup, setPopup] = useState<ResultPopup | null>(null);
  const [banner, setBanner] = useState<{ text: string; kind: 'panic' | 'fomo' } | null>(null);
  const [stakePct, setStakePct] = useState(0.25);
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
    try {
      const res = await api.stageFinish(s.start.sessionId, {
        goldLeft: Math.floor(b.gold),
        goldSpent: Math.floor(b.goldSpent),
        hpLeft: giveUp ? 0 : Math.max(0, Math.round(b.baseHP)),
        enemyBaseDestroyed: b.enemyBaseDestroyed,
      });
      onFinish(s.start.sessionId, res, regionId);
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
        const start = await api.stageStart(regionId, isTut ? 1 : settings.speed);
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
        await ws.ready();
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
        s.pendingOpen = false;
        s.aum = m.aumLeft;
        s.openMarker = {
          openBarIdx: m.openBarIdx,
          basePricePct: pctOf(m.basePrice, s.bars!.openPrice),
          basePrice: m.basePrice,
          direction: s.openMarker?.direction ?? 'long',
          stake: s.openMarker?.stake ?? 0,
        };
      } else if (m.op === 'position.closing') {
        s.closing = true;
      } else if (m.op === 'position.closed') {
        s.aum = m.aumLeft;
        const holdBars = s.openMarker ? m.exitBarIdx - s.openMarker.openBarIdx : null;
        s.openMarker = null;
        s.closing = false;
        s.battle?.addGold(m.goldGain); // FR-5.5b: 순수익만 골드로 자동 환전 (스테이크는 AUM 반환)
        s.lastPayoutAt = Date.now();
        setPopup({ outcome: m.outcome, amount: m.pnl, goldGain: m.goldGain });
        setTimeout(() => setPopup(null), 800); // FR-5.9: 0.8초 이내
        track('position_closed', { outcome: m.outcome, g: m.g, payout: m.payout, pnl: m.pnl, goldGain: m.goldGain, holdBars, forced: m.forced });
        if (isTut) setGuide((cur) => (cur === 2 ? 3 : cur));
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

      if (chartRef.current) {
        drawChart(chartRef.current, s.bars, barF, {
          colorBlind: settings.colorBlind,
          marker: s.openMarker,
          showResearch: s.start!.params.hasInfoResearch,
        });
      }
      if (battleRef.current) {
        drawBattle(battleRef.current, s.battle, Date.now() < s.shakeUntil ? 5 : 0, slotMenuRef.current);
      }

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
          const gNorm = (mk.direction === 'long' ? 1 : -1) * (dPct / Math.max(s.bars.sigma['30'], 1e-6));
          const p = s.start!.params;
          const raw = gNorm >= 0 ? p.payoutBase * gNorm : p.lossRate * gNorm;
          upnl = Math.floor(mk.stake * Math.min(Math.max(raw, -p.maxLossRate), p.payoutBase * BALANCE.Z_CAP));
        }
        setHud({
          gold: Math.floor(b.gold), aum: s.aum, hp: Math.max(0, Math.round(b.baseHP)), ebhp: Math.max(0, Math.round(b.enemyBaseHP)),
          wave: b.waveIdx, waveCount: s.start!.params.waveCount,
          prep: b.phase === 'prep', barF, barCount: s.bars.barCount,
          posCount: s.seq, skillCd: Math.max(0, Math.ceil(b.skillReadyAt - b.t)), upnl, udelta,
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
  const canOpen = (() => {
    const s = g.current;
    if (phase !== 'playing' || s.pendingOpen || s.openMarker || !s.start) return false;
    if (s.seq >= s.start.params.maxPositions) return false;
    if (s.aum < 1) return false;
    if (hud.barF + 3 >= hud.barCount) return false; // 종료 직전엔 체결 불가
    if (isTut && guide < 1) return false;
    if (isTut && guide === 1 && (hud.barF < 22 || hud.barF > 34)) return false;
    if (isTut && guide === 2) return false;
    return true;
  })();

  const openPosition = (direction: Direction) => {
    const s = g.current;
    if (!canOpen || !s.ws) return;
    const stake = Math.max(1, Math.floor(s.aum * stakePct));
    s.seq += 1;
    s.pendingOpen = true;
    s.openMarker = { openBarIdx: 0, basePricePct: 0, basePrice: 0, direction, stake };
    s.ws.openPosition(s.seq, direction, stake);
    track('position_open', { seq: s.seq, direction, stakePct, waveIdx: hud.wave, phase: hud.prep ? 'prep' : 'wave' });
    if (isTut && guide === 1) setGuide(2);
  };

  // 튜토리얼 ③단계: WIN이 보장되는 상승 구간이 지난 뒤에만 청산 허용
  const canClose = (() => {
    const s = g.current;
    if (phase !== 'playing' || !s.openMarker || s.openMarker.basePrice <= 0 || s.closing) return false;
    if (isTut && guide === 2 && hud.barF < s.openMarker.openBarIdx + 26) return false;
    return true;
  })();

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

  const buildTower = (slot: number, key: 'basic' | 'aa' | 'splash') => {
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

  const spawnUnit = (key: 'intern' | 'analyst' | 'trader') => {
    const b = g.current.battle;
    if (!b) return;
    const cost = b.unitCost(key);
    if (b.spawnUnit(key)) {
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
    const fx = ((e.clientX - rect.left) / rect.width) * 1000;
    let best = -1;
    let bestD = 40;
    for (let s = 0; s < b.towers.length; s++) {
      const d = Math.abs(b.towerSlotX(s) - fx);
      if (d < bestD) { bestD = d; best = s; }
    }
    setSlotMenu(best >= 0 ? best : null);
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
          <span>09:00</span>
          <div className="track"><div className="fill" style={{ width: `${progress * 100}%` }} /></div>
          <span>15:30</span>
          <b>{clockLabel(hud.barF, hud.barCount)}</b>
        </div>
        <button className="ghost small" onClick={() => (isTut ? onSkipTutorial() : confirm('이탈하면 패배 처리됩니다 (FR-6.11)') && finishStage(true))}>
          {isTut ? '튜토리얼 스킵' : '이탈'}
        </button>
      </div>

      {/* 차트 밴드: 좌 차트 + 우 트레이드 패널 (FR-5.1 자유 진입·청산) */}
      <div className="chart-band">
        <div className="chart-area">
          <canvas ref={chartRef} width={700} height={252} className="chart" />
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
          <div className="pos-box">
            <div className="pr"><span>POSITION</span><span>{hud.posCount}/{p.maxPositions}</span></div>
            {hasPosition ? (
              <>
                <div className="pr">
                  <span>방향</span>
                  <span className={s.openMarker!.direction === 'long' ? 'dir-long' : 'dir-short'}>
                    {s.openMarker!.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                  </span>
                </div>
                <div className="pr"><span>투입</span><span>{s.openMarker!.stake.toLocaleString()} AUM</span></div>
                <div className="pr">
                  <span>진입 대비</span>
                  <span className={`upnl ${hud.udelta != null && hud.udelta < 0 ? 'neg' : 'pos'}`}>
                    {hud.udelta != null ? `${hud.udelta >= 0 ? '+' : ''}${hud.udelta.toFixed(2)}%` : '…'}
                  </span>
                </div>
                <div className="pr">
                  <span>P&amp;L</span>
                  <span className={`upnl ${hud.upnl != null && hud.upnl < 0 ? 'neg' : 'pos'}`}>
                    {hud.upnl != null ? `${hud.upnl >= 0 ? '+' : ''}${hud.upnl.toLocaleString()} AUM` : '…'}
                  </span>
                </div>
                <button className={`close-pos ${isTut && guide === 2 && canClose ? 'pulse' : ''}`} disabled={!canClose} onClick={closePosition}>
                  {s.closing ? '청산 중…' : '청산 ✕'}
                </button>
              </>
            ) : (
              <span className="none">무포지션<br />LONG / SHORT로 진입</span>
            )}
          </div>
        </div>
      </div>

      <div className="battle-wrap">
        <canvas ref={battleRef} width={860} height={190} className="battle" onClick={onBattleClick} />
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
            {popup.outcome === 'win'
              ? `WIN +${popup.goldGain.toLocaleString()} G 입금`
              : popup.outcome === 'lose'
                ? `LOSE ${popup.amount.toLocaleString()} AUM`
                : `DRAW ${popup.goldGain > 0 ? `+${popup.goldGain.toLocaleString()} G` : `${popup.amount.toLocaleString()} AUM`}`}
          </div>
        )}
        {slotMenu != null && (
          <div className="slot-menu" style={{ left: `${(battle.towerSlotX(slotMenu) / 1000) * 100}%` }}>
            {battle.towers[slotMenu] ? (
              <>
                <button onClick={() => { battle.cycleTargeting(slotMenu); forceUi((v) => v + 1); }}>
                  타겟: {{ first: '선두', last: '후미', strong: '강적', close: '근접' }[battle.towers[slotMenu]!.mode]} ↻
                </button>
                {battle.towers[slotMenu]!.lv < 2 ? (
                  <button onClick={() => upgradeTower(slotMenu)}>
                    업그레이드 {TOWERS.find((t) => t.key === battle.towers[slotMenu]!.key)!.upgradeCost} G
                  </button>
                ) : (
                  <span className="small">최대 레벨</span>
                )}
              </>
            ) : (
              TOWERS.map((t) => (
                <button key={t.key} disabled={hud.gold < t.cost} onClick={() => buildTower(slotMenu, t.key)}>
                  {t.name} {t.cost} G
                  <span className="small dim"> {t.dmgType === 'magic' ? '마법·슬로우' : t.target === 'air' ? '대공 전용' : '물리'}</span>
                </button>
              ))
            )}
            <button className="ghost" onClick={() => setSlotMenu(null)}>✕</button>
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
          {UNITS.map((u) => {
            const cost = battle.unitCost(u.key);
            return (
              <button key={u.key} className={isTut && guide === 4 ? 'pulse' : ''} disabled={hud.gold < cost || phase !== 'playing'} onClick={() => spawnUnit(u.key)}>
                {u.name}<span className="cost">{cost} G</span>
              </button>
            );
          })}
          <button className="skill" disabled={hud.gold < BALANCE.SKILL_COST || hud.skillCd > 0} onClick={useSkill}>
            공시폭탄<span className="cost">{hud.skillCd > 0 ? `${hud.skillCd}s` : `${BALANCE.SKILL_COST} G`}</span>
          </button>
        </div>
        <div className="cmd-right">
          <span className="small dim mono">L={p.lossRate} · heat {p.heat.toFixed(2)}</span>
        </div>
      </div>

      <p className="disclaimer">본 콘텐츠는 과거 데이터를 활용한 게임이며 투자 조언이 아닙니다.</p>

      {/* FR-12 튜토리얼 가이드 */}
      {isTut && guide < 5 && (
        <div className="guide">
          {guide === 0 && (
            <>
              <p>📈 위 차트는 <b>실제 과거 거래일</b>의 1분봉입니다. 어느 회사의 어느 날인지는 숨겨져 있습니다.<br />
                Y축은 당일 시가 대비 %입니다. 차트가 오를 것 같으면 LONG, 내릴 것 같으면 SHORT.</p>
              <button onClick={() => setGuide(1)}>다음</button>
            </>
          )}
          {guide === 1 && <p>🎯 지금 상승 흐름입니다. <b>LONG ▲</b> 버튼을 눌러 포지션에 진입해 보세요! {hud.barF < 22 ? `(${Math.ceil(22 - hud.barF)}초 후 활성화)` : ''}</p>}
          {guide === 2 && <p>⏳ 진입했습니다! 가격이 오르는 동안 미실현 손익이 실시간으로 움직입니다. 충분히 오르면 <b>청산 ✕</b> 버튼으로 이익을 확정하세요.</p>}
          {guide === 3 && <p>💰 골드가 입금됐습니다! 이 돈으로 방어하세요. <b>전장의 빈 슬롯(점선)</b>을 눌러 타워를 지으세요.</p>}
          {guide === 4 && <p>⚔ 이제 <b>유닛</b>을 소환해 전선을 미세요. 아래 인턴/애널리스트 버튼!</p>}
        </div>
      )}
      {phase === 'settling' && <div className="overlay center"><p>정산 중…</p></div>}
    </div>
  );
}
