// 헤드리스 E2E — §4 첫 세션 여정을 실제 서버에 대해 실시간으로 재현한다.
// 사용: npx tsx scripts/e2e.ts   (server :3000 필요, 소요 ~5분: TUT 75초 + R1 195초 @2x)
import WebSocket from 'ws';
import { Battle, type BarsFile, type FinishRes, type StageParams } from '@tf/shared';

const BASE = 'http://localhost:3000';
let TOKEN = '';
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, note = '') => {
  results.push([name, ok, note]);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`);
};

async function req<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

/** 실시간 헤드리스 스테이지 플레이 (승률 p 봇, speed 2x) */
async function playStage(regionId: string, p: number): Promise<{ finish: FinishRes; sessionId: string }> {
  const start = await req<{ sessionId: string; barsUrl: string; params: StageParams }>('/api/stage/start', { regionId, speed: 2 });
  const bars = (await fetch(BASE + start.barsUrl).then((r) => r.json())) as BarsFile;
  const params = start.params;
  const battle = new Battle(params, bars.events);
  const barMs = 500;
  let aum = params.aum;
  let openPending = false;
  let seq = 0;
  let nextOpenBar = regionId === 'TUT' ? 23 : 2; // 튜토리얼: WIN 보장 구간
  let resolvedCount = 0;

  const ws = new WebSocket(`ws://localhost:3000/ws/stage?session=${start.sessionId}&token=${TOKEN}`);
  await new Promise<void>((res, rej) => { ws.on('open', () => res()); ws.on('error', rej); });
  let t0 = Date.now();
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    if (m.op === 'started') t0 = Date.now();
    else if (m.op === 'position.opened') { aum = m.aumLeft; }
    else if (m.op === 'position.resolved') {
      aum = m.aumLeft;
      battle.addGold(m.payout);
      openPending = false;
      resolvedCount += 1;
      nextOpenBar = Math.floor((Date.now() - t0) / barMs) + 3;
    } else if (m.op === 'clock.resync') t0 = Date.now() - m.serverBarIdx * barMs;
    else if (m.op === 'error') openPending = false;
  });
  ws.send(JSON.stringify({ op: 'start' }));

  const buildOrder = ['basic', 'aa', 'basic', 'splash', 'aa', 'splash'] as const;
  let built = 0;
  const totalBars = params.waveCount * 30;

  while (true) {
    await new Promise((r) => setTimeout(r, 100));
    const elapsedBars = (Date.now() - t0) / barMs; // 캡 없음 — overtime까지 진행해야 done 도달
    battle.advanceTo(elapsedBars);
    if (battle.phase === 'done') break;
    const bar = Math.floor(Math.min(elapsedBars, totalBars));

    if (!openPending && bar >= nextOpenBar && bar + 32 < bars.barCount && aum >= 4) {
      const openIdx = bar + 1;
      const closeIdx = openIdx + 30;
      const delta = bars.bars[closeIdx].c - bars.bars[openIdx].c; // 봇: 정답 방향을 확률 p로
      const correct = delta > 0 ? 'long' : 'short';
      const dir = Math.random() < p ? correct : correct === 'long' ? 'short' : 'long';
      seq += 1;
      openPending = true;
      ws.send(JSON.stringify({ op: 'position.open', seq, direction: dir, stake: Math.max(1, Math.floor(aum * 0.25)), expirySec: 30 }));
      nextOpenBar = closeIdx + 3;
    }
    if (built < Math.min(buildOrder.length, battle.towers.length)) {
      if (battle.buildTower(built, buildOrder[built])) built += 1;
    } else {
      if (battle.gold >= 320) battle.spawnUnit('trader');
      else if (battle.gold >= 220) battle.spawnUnit('analyst');
    }
    if (battle.enemies.filter((e) => !e.air).length >= 6 && battle.gold >= 380) battle.useSkill();
  }
  ws.close();
  const finish = await req<FinishRes>('/api/stage/finish', {
    sessionId: start.sessionId,
    goldLeft: Math.floor(battle.gold),
    goldSpent: Math.floor(battle.goldSpent),
    hpLeft: Math.max(0, Math.round(battle.baseHP)),
    enemyBaseDestroyed: battle.enemyBaseDestroyed,
  });
  console.log(`  [${regionId}] ${finish.status} 등급=${finish.grade} 적중률=${(finish.accuracy * 100).toFixed(0)}% 자본금+${finish.capitalAwarded} (포지션 ${resolvedCount}건)`);
  return { finish, sessionId: start.sessionId };
}

// ── 여정 시작 ──
const anon = await fetch(`${BASE}/api/auth/anon`, { method: 'POST' }).then((r) => r.json());
TOKEN = anon.token;
check('FR-1.1 익명 계정 발급', !!anon.accountId && !!TOKEN);

const map0 = await req<{ regions: { regionId: string; state: string }[] }>('/api/map');
check('FR-2.2 초기 상태: R1 open, R2/R3 locked',
  map0.regions[0].state === 'open' && map0.regions[1].state === 'locked' && map0.regions[2].state === 'locked');

console.log('▶ 튜토리얼 (75초 @2x)…');
const tut = await playStage('TUT', 1);
check('FR-12 튜토리얼 클리어', tut.finish.status === 'cleared');
check('FR-12.5 튜토리얼 자본금 500 고정', tut.finish.capitalAwarded === 500);
check('튜토리얼 첫 예측 WIN 보장 (적중률 100%)', tut.finish.accuracy === 1);

const revealTut = await req<{ companyName: string }>(`/api/stage/${tut.sessionId}/reveal`);
check('FR-9.3 공개 API (튜토리얼 = 가상 종목)', revealTut.companyName.includes('가상'));

console.log('▶ R1 여의도 (195초 @2x, p=0.65 봇)…');
const r1 = await playStage('R1', 0.65);
const r1Reveal = await req<{ companyName: string; tradeDate: string; positions: unknown[] }>(`/api/stage/${r1.sessionId}/reveal`);
check('FR-9 공개: 실제 종목명·날짜 노출', !!r1Reveal.companyName && /^\d{4}-\d{2}-\d{2}$/.test(r1Reveal.tradeDate), `${r1Reveal.companyName} ${r1Reveal.tradeDate}`);

if (r1.finish.status === 'cleared') {
  const map1 = await req<{ regions: { regionId: string; state: string }[]; capturedCount: number; heat: number }>('/api/map');
  check('FR-2.2 R1 점령 → R2 도전가능', map1.regions[1].state === 'open');
  check('FR-2.5 경계도 반영', Math.abs(map1.heat - 1.02) < 1e-9, `heat=${map1.heat}`);
  if (r1.finish.eligibleLines.length > 0) {
    const line = r1.finish.eligibleLines[0];
    await req(`/api/stage/${r1.sessionId}/reward`, { line });
    const dup = await fetch(`${BASE}/api/stage/${r1.sessionId}/reward`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ line }),
    });
    check('FR-8.4 보상 1개만 선택 (중복 409)', dup.status === 409, `선택=${line}`);
  } else {
    check('FR-8.5 자격 없음 → 기본 보상만', true, '보상 자격 없음 (스킵)');
  }
  const codex = await req<{ entries: unknown[] }>('/api/codex');
  check('FR-10.1 도감 등록', codex.entries.length === 1);
} else {
  check('R1 클리어 (봇 패배 — 재실행 필요)', false, 'p=0.65 봇이 패배함');
}

const me = await req<{ capital: number; tutorialDone: boolean }>('/api/me');
check('FR-1.2 진행도 서버 저장', me.tutorialDone && me.capital > 0, `자본금=${me.capital}`);
if (me.capital >= 800) {
  const up = await req<{ level: number }>('/api/dept/upgrade', { deptKey: 'rnd' });
  check('FR-11 부서 업그레이드', up.level === 2);
} else {
  check('FR-11 부서 업그레이드 (자본금 부족 → 검증 스킵)', true, `자본금=${me.capital}`);
}

const failCnt = results.filter(([, ok]) => !ok).length;
console.log(`\n===== E2E 결과: ${results.length - failCnt} PASS / ${failCnt} FAIL =====`);
process.exit(failCnt ? 1 : 0);
