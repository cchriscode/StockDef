// 칩튠 효과음 — Web Audio 오실레이터로 합성 (에셋 없음, 픽셀 아트 톤 매칭)
// 마스터 볼륨은 설정(FR-13.1)의 volume. AudioContext는 첫 사용자 제스처 이후 활성화된다.
import { getSettings } from '../net/api.js';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Note {
  freq: number;
  to?: number; // 주파수 슬라이드 목표
  dur: number;
  at?: number; // 시작 지연 (초)
  type?: OscillatorType;
  vol?: number;
}

function play(notes: Note[]) {
  const a = ac();
  const master = getSettings().volume;
  if (!a || master <= 0) return;
  const t0 = a.currentTime;
  for (const n of notes) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    const start = t0 + (n.at ?? 0);
    osc.type = n.type ?? 'square';
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.dur);
    const v = (n.vol ?? 0.16) * master;
    gain.gain.setValueAtTime(v, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);
    osc.connect(gain).connect(a.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  }
}

/** 노이즈 버스트 (파괴·사망) */
function burst(dur: number, vol: number) {
  const a = ac();
  const master = getSettings().volume;
  if (!a || master <= 0) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const gain = a.createGain();
  gain.gain.value = vol * master;
  src.connect(gain).connect(a.destination);
  src.start();
}

let lastCoinAt = 0;

export const sfx = {
  /** 골드 획득 (기본 수입·배당 파밍·청산 수익) — 코인 딸랑, 300ms 스로틀 */
  coin() {
    const now = Date.now();
    if (now - lastCoinAt < 300) return;
    lastCoinAt = now;
    play([
      { freq: 988, dur: 0.06, vol: 0.12 },
      { freq: 1319, dur: 0.12, at: 0.06, vol: 0.12 },
    ]);
  },
  /** LONG 진입 체결 — 상승 처프 */
  fillLong() {
    play([{ freq: 330, to: 660, dur: 0.12, type: 'sawtooth', vol: 0.14 }]);
  },
  /** SHORT 진입 체결 — 하강 처프 */
  fillShort() {
    play([{ freq: 660, to: 330, dur: 0.12, type: 'sawtooth', vol: 0.14 }]);
  },
  /** 청산 WIN — 상승 아르페지오 */
  win() {
    play([
      { freq: 523, dur: 0.08, vol: 0.15 },
      { freq: 659, dur: 0.08, at: 0.07, vol: 0.15 },
      { freq: 784, dur: 0.16, at: 0.14, vol: 0.15 },
    ]);
  },
  /** 청산 LOSE — 저음 하강 */
  lose() {
    play([{ freq: 220, to: 110, dur: 0.3, vol: 0.15 }]);
  },
  /** 청산 DRAW — 중립 단음 */
  draw() {
    play([{ freq: 440, dur: 0.1, type: 'triangle', vol: 0.12 }]);
  },
  /** 유닛 소환 — 팝 */
  spawn() {
    play([{ freq: 262, to: 523, dur: 0.09, vol: 0.14 }]);
  },
  /** 아군 유닛 사망 — 하강 + 노이즈 */
  unitDeath() {
    play([{ freq: 196, to: 82, dur: 0.18, type: 'triangle', vol: 0.14 }]);
    burst(0.1, 0.05);
  },
  /** DANGER 경보 — 2음 클락션 반복 (적 본진 위기 반격) */
  danger() {
    play([
      { freq: 622, dur: 0.16, type: 'sawtooth', vol: 0.15 },
      { freq: 466, dur: 0.16, at: 0.18, type: 'sawtooth', vol: 0.15 },
      { freq: 622, dur: 0.16, at: 0.4, type: 'sawtooth', vol: 0.13 },
      { freq: 466, dur: 0.22, at: 0.58, type: 'sawtooth', vol: 0.13 },
    ]);
  },
};
