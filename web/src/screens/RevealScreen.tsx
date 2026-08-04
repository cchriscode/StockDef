import { useEffect, useRef, useState } from 'react';
import type { FinishRes, RegionId, RevealRes, RewardLine } from '@tf/shared';
import { api, getSettings, track } from '../net/api.js';

// FR-9 공개 연출 (★ H2 검증 대상) — 정산 직후, 보상 선택 전에 실행
interface Props {
  sessionId: string;
  finish: FinishRes;
  regionId: RegionId;
  onDone: () => void;
}

const STEP_MS = [1500, 1500, 2000, 1500, 2000, 1500];
const LINE_INFO: Record<RewardLine, { name: string; desc: string }> = {
  finance: { name: '재무', desc: '운영비 −10 G/지역' },
  info: { name: '정보', desc: '리서치 Lv1 (거래량 30분봉 표시)' },
  defense: { name: '방어', desc: '타워 슬롯 +1' },
  offense: { name: '공격', desc: '유닛 소환 비용 −15%' },
};
const RARITY_KO: Record<string, string> = { common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' };

export function RevealScreen({ sessionId, finish, regionId, onDone }: Props) {
  const [data, setData] = useState<RevealRes | null>(null);
  const [step, setStep] = useState(0); // 0..5 연출, 6 = 정산+보상
  const [typed, setTyped] = useState('');
  const [showSkip, setShowSkip] = useState(false);
  const [picked, setPicked] = useState<RewardLine | null>(null);
  const [picking, setPicking] = useState(false);
  const dailyRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef<HTMLCanvasElement>(null);
  const openedAt = useRef(Date.now());
  const firstReveal = !localStorage.getItem('tf.revealSeen');
  const isTut = regionId === 'TUT';

  useEffect(() => {
    api.reveal(sessionId).then(setData).catch(() => setStep(6));
  }, [sessionId]);

  // 자동 진행 + 스킵 노출 (FR-9.4: 3초 후, 첫 회차는 스킵 불가)
  useEffect(() => {
    if (!data || step >= 6) return;
    const skip = data.news.length === 0 && step === 2 ? 300 : STEP_MS[step];
    const t = setTimeout(() => setStep((v) => (v + 1) as typeof step), skip);
    return () => clearTimeout(t);
  }, [data, step]);

  useEffect(() => {
    const t = setTimeout(() => setShowSkip(!firstReveal), 3000);
    return () => clearTimeout(t);
  }, [firstReveal]);

  useEffect(() => {
    if (step >= 6) {
      localStorage.setItem('tf.revealSeen', '1');
      track('reveal_view', { dwellMs: Date.now() - openedAt.current, skipped: false, stepReached: 6 });
    }
  }, [step]);

  // 2단계: 종목명+기간 타이핑 연출 (일봉 윈도우: 시작~종료)
  useEffect(() => {
    if (!data || step !== 1) return;
    const fmt = (s: string) => s.replaceAll('-', '.');
    const full = data.tradeStart
      ? `${fmt(data.tradeStart)} ~ ${fmt(data.tradeDate)} · ${data.companyName}`
      : `${fmt(data.tradeDate)} · ${data.companyName}`;
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(t);
    }, Math.max(30, 1200 / full.length));
    return () => clearInterval(t);
  }, [data, step]);

  // 1단계: 전후 60거래일 일봉 줌아웃
  useEffect(() => {
    if (!data || !dailyRef.current || step < 0) return;
    const cv = dailyRef.current;
    const ctx = cv.getContext('2d')!;
    const { colorBlind } = getSettings();
    const up = colorBlind ? '#e8c34a' : '#46A574';
    const down = colorBlind ? '#4aa8e8' : '#E8654F';
    ctx.clearRect(0, 0, cv.width, cv.height);
    const arr = data.dailyAround;
    if (!arr.length) return;
    const lo = Math.min(...arr.map((b) => b.l));
    const hi = Math.max(...arr.map((b) => b.h));
    const bw = cv.width / arr.length;
    const y = (p: number) => cv.height - ((p - lo) / (hi - lo || 1)) * (cv.height - 16) - 8;
    arr.forEach((b, i) => {
      const cx = i * bw + bw / 2;
      const col = b.c >= b.o ? up : down;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(cx, y(b.h)); ctx.lineTo(cx, y(b.l)); ctx.stroke();
      ctx.fillRect(cx - bw * 0.3, y(Math.max(b.o, b.c)), bw * 0.6, Math.max(Math.abs(y(b.o) - y(b.c)), 1));
    });
    // 플레이한 구간 하이라이트 (일봉 윈도우 — windowLen 만큼의 범위)
    const span = Math.max(data.windowLen ?? 1, 1);
    const dx = data.dayIndex * bw;
    const dw = Math.min(span * bw, cv.width - dx);
    ctx.strokeStyle = '#FFC53D';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx, 4, dw, cv.height - 8);
    ctx.lineWidth = 1;
    ctx.fillStyle = '#FFC53D';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('이 구간', Math.min(Math.max(dx + dw / 2, 22), cv.width - 22), 14);
  }, [data, step]);

  // 4단계: 포지션 마커 (○ WIN / ✕ LOSE / − DRAW)
  useEffect(() => {
    if (!data || !posRef.current || step < 3) return;
    const cv = posRef.current;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#24314A';
    ctx.strokeRect(0, 0, cv.width, cv.height);
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    const bx = (bar: number) => (bar / 390) * (cv.width - 20) + 10;
    ctx.fillStyle = '#4E5B72';
    ctx.fillText('D+0', 24, cv.height - 6);
    ctx.fillText('D+390', cv.width - 30, cv.height - 6);
    data.positions.forEach((p) => {
      const x = bx(p.openBarIdx);
      const col = p.outcome === 'win' ? '#7BD8A0' : p.outcome === 'lose' ? '#FF9E86' : '#7C89A3';
      ctx.fillStyle = col;
      ctx.fillText(p.outcome === 'win' ? '○' : p.outcome === 'lose' ? '✕' : '−', x, 22 + (p.seq % 3) * 16);
    });
  }, [data, step]);

  const skipAll = () => {
    track('reveal_view', { dwellMs: Date.now() - openedAt.current, skipped: true, stepReached: step });
    setStep(6);
  };

  const pickReward = async (line: RewardLine) => {
    if (picking || picked) return;
    setPicking(true);
    try {
      await api.reward(sessionId, line);
      setPicked(line);
      track('reward_pick', { line, availableLines: finish.eligibleLines });
    } finally {
      setPicking(false);
    }
  };

  if (!data) return <div className="screen center"><p>공개 정보 로딩…</p></div>;

  const failed = finish.status !== 'cleared';

  if (step >= 6) {
    // 정산 카드 + 랭크 뱃지 + 점령 보상 선택 (FR-8.4~8.6)
    return (
      <div className="screen center reveal-final">
        <div className={`rank-badge ${failed ? 'fail' : ''}`}><i>{failed ? '✕' : finish.grade}</i></div>
        <h2>{failed ? '패배 — 다시 도전하세요' : '방어 성공'}</h2>
        <div className="card settle">
          <p>적중률 {(finish.accuracy * 100).toFixed(0)}% · 잔여골드율 {(finish.goldLeftRate * 100).toFixed(0)}%</p>
          <p className="big">자본금 +{finish.capitalAwarded.toLocaleString()}{finish.isRetry ? ' (재도전 50%)' : ''}</p>
          <p>보유 자본금 {finish.capitalTotal.toLocaleString()}</p>
        </div>
        {!failed && !isTut && finish.eligibleLines.length > 0 && !picked && (
          <div className="card">
            <h3>점령 보상 — 1개만 선택 (나머지는 이 지역에서 포기)</h3>
            <div className="reward-list">
              {finish.eligibleLines.map((l) => (
                <button key={l} disabled={picking} onClick={() => pickReward(l)}>
                  <b>{LINE_INFO[l].name}</b><span>{LINE_INFO[l].desc}</span>
                </button>
              ))}
              {finish.alreadyOwnedLines.map((l) => (
                <button key={l} disabled className="owned"><b>{LINE_INFO[l].name}</b><span>이미 보유</span></button>
              ))}
            </div>
          </div>
        )}
        {picked && <p className="picked">✔ {LINE_INFO[picked].name} 계열 획득!</p>}
        {!failed && !isTut && finish.eligibleLines.length === 0 && <p>열린 보상 자격이 없습니다 (기본 보상만 지급)</p>}
        <button className="primary" onClick={onDone}>
          {isTut ? '세계지도로' : '지도로 돌아가기'}
        </button>
      </div>
    );
  }

  return (
    <div className="screen center reveal">
      <div className="kicker">DISCLOSURE</div>
      <h3 className="dim">{failed ? '방어에는 실패했지만… 이 차트의 정체는' : '당신이 방금 플레이한 차트는'}</h3>

      <div className="disclosure-card">
        <div className="dhead">
          <span>{step >= 1 ? `${data.tradeStart ? data.tradeStart + ' ~ ' : ''}${data.tradeDate}` : '????.??.?? ~ ????.??.??'} · KRX</span>
          <span>기간 공시</span>
        </div>
        <div className="dbody">
          {step >= 0 && (
            <div className="reveal-step">
              <canvas ref={dailyRef} width={560} height={140} />
              <p className="small dim">긴 흐름 속 그 구간 (주봉 근사)</p>
            </div>
          )}
          {step >= 1 && <h1 className="typing">{typed}<span className="cursor">|</span></h1>}
          {step >= 2 && data.news.length > 0 && (
            <ul className="news">
              {data.news.slice(0, 3).map((n, i) => <li key={i}>{n.headline}</li>)}
            </ul>
          )}
          {step >= 3 && (
            <div className="reveal-step">
              <canvas ref={posRef} width={560} height={80} />
              <p className="small dim">당신의 포지션 — ○ 적중 · ✕ 실패 · − 무승부</p>
            </div>
          )}
          {step >= 4 && (
            <p className="reveal-summary">
              {failed
                ? `${data.hits + data.misses}번 중 ${data.hits}번 적중. 이 기간 실제 등락은 ${data.dayChangePct > 0 ? '+' : ''}${data.dayChangePct.toFixed(1)}%였습니다.`
                : `당신은 ${data.hits + data.misses}번 중 ${data.hits}번 적중. 이 기간 실제 등락은 ${data.dayChangePct > 0 ? '+' : ''}${data.dayChangePct.toFixed(1)}%였습니다.`}
            </p>
          )}
        </div>
      </div>
      {step >= 5 && !failed && !isTut && (
        <div className={`codex-card inline rarity-${data.rarity}`}>
          <div className="chead"><span>{data.rarity.toUpperCase()} · {RARITY_KO[data.rarity] ?? data.rarity}</span><span>도감 등록</span></div>
          <div className="cbody"><b>{data.ticker}</b><span className="small dim">차트 도감에 기록되었습니다</span></div>
        </div>
      )}
      {showSkip && <button className="ghost skip" onClick={skipAll}>스킵 ≫</button>}
    </div>
  );
}
