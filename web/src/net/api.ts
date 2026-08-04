import type {
  DeptKey, FinishReq, FinishRes, MapRes, MeRes, RegionId, RevealRes, RewardLine, StageStartRes,
} from '@tf/shared';

let token: string | null = localStorage.getItem('tf.token');

export async function ensureAccount(): Promise<void> {
  if (token) return;
  const r = await fetch('/api/auth/anon', { method: 'POST' }).then((x) => x.json());
  token = r.token;
  localStorage.setItem('tf.token', token!);
}

export function getToken(): string {
  return token ?? '';
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (r.status === 401) {
    // FR-1.4: 토큰 유실 시 복구 불가 — 새 계정 발급
    localStorage.removeItem('tf.token');
    token = null;
    await ensureAccount();
    return req(path, init);
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `HTTP ${r.status}`), { body, status: r.status });
  }
  return r.json();
}

export const api = {
  me: () => req<MeRes>('/api/me'),
  map: () => req<MapRes>('/api/map'),
  stageStart: (regionId: RegionId, speed: number) =>
    req<StageStartRes>('/api/stage/start', { method: 'POST', body: JSON.stringify({ regionId, speed }) }),
  stageFinish: (sessionId: string, body: FinishReq) =>
    req<FinishRes>('/api/stage/finish', { method: 'POST', body: JSON.stringify({ sessionId, ...body }) }),
  reveal: (sessionId: string) => req<RevealRes>(`/api/stage/${sessionId}/reveal`),
  reward: (sessionId: string, line: RewardLine) =>
    req<{ ok: boolean }>(`/api/stage/${sessionId}/reward`, { method: 'POST', body: JSON.stringify({ line }) }),
  deptUpgrade: (deptKey: DeptKey) =>
    req<{ ok: boolean; level: number; capital: number }>('/api/dept/upgrade', { method: 'POST', body: JSON.stringify({ deptKey }) }),
  codex: (q = '') => req<{ entries: CodexEntry[] }>(`/api/codex${q}`),
};

export interface CodexEntry {
  first_cleared_at: string;
  best_accuracy: number;
  best_grade: string;
  ticker: string;
  company_name: string;
  trade_date: string;
  sector: string;
  day_change_pct: number;
  rarity: string;
}

// §12 텔레메트리 — fire & forget 배치
let telemetryBuf: { event: string; props?: unknown }[] = [];
export function track(event: string, props?: unknown) {
  telemetryBuf.push({ event, props });
  if (telemetryBuf.length >= 10) flushTelemetry();
}
export function flushTelemetry() {
  if (!telemetryBuf.length || !token) return;
  const events = telemetryBuf;
  telemetryBuf = [];
  fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  }).catch(() => {});
}
setInterval(flushTelemetry, 5000);

// FR-13 설정 (localStorage tf.settings)
export interface Settings {
  speed: 0.5 | 1 | 2;
  colorBlind: boolean;
  reduceShake: boolean;
  volume: number; // 마스터 볼륨 0~1 (FR-13.1)
}
export function getSettings(): Settings {
  try {
    return { speed: 1, colorBlind: false, reduceShake: false, volume: 0.5, ...JSON.parse(localStorage.getItem('tf.settings') ?? '{}') };
  } catch {
    return { speed: 1, colorBlind: false, reduceShake: false, volume: 0.5 };
  }
}
export function saveSettings(s: Settings) {
  localStorage.setItem('tf.settings', JSON.stringify(s));
}
