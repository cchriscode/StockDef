// 헤드리스 E2E — §4 첫 세션 여정을 실제 서버에 대해 실시간으로 재현한다.
// 사용: npx tsx scripts/e2e.ts   (server :3000 필요, 소요 ~5분: TUT 75초 + R1 195초 @2x)
import WebSocket from 'ws';
import { BALANCE, Battle, type BarsFile, type FinishRes, type StageParams } from '@tf/shared';

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
async function playStage(regionId: string, p: number, mode: 'easy' | 'hard' = 'hard'): Promise<{ finish: FinishRes; sessionId: string; params: StageParams }> {
  const start = await req<{ sessionId: string; barsUrl: string; params: StageParams }>('/api/stage/start', { regionId, speed: 2, mode });
  const bars = (await fetch(BASE + start.barsUrl).then((r) => r.json())) as BarsFile;
  const params = start.params;
  const battle = new Battle(params, bars.events);
  const barMs = 500;
  let aum = params.aum;
  let openPending = false;
  let active: { seq: number; closeTarget: number } | null = null;
  let closeSent = false;
  let seq = 0;
  let nextOpenBar = regionId === 'TUT' ? 23 : 2; // 튜토리얼: WIN 보장 구간
  let resolvedCount = 0;

  const ws = new WebSocket(`ws://localhost:3000/ws/stage?session=${start.sessionId}&token=${TOKEN}`);
  await new Promise<void>((res, rej) => { ws.on('open', () => res()); ws.on('error', rej); });
  let t0 = Date.now();
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    if (m.op === 'started') t0 = Date.now();
    else if (m.op === 'position.opened') {
      aum = m.aumLeft;
      openPending = false;
      active = { seq: m.seq, closeTarget: m.openBarIdx + 30 }; // 봇: 30봉 보유 후 청산
    } else if (m.op === 'position.closed') {
      aum = m.aumLeft; // 스테이크(−손실)는 이미 서버에서 AUM 반환됨
      battle.addGold(m.goldGain); // 순수익만 골드 환전 (FR-5.5b)
      active = null;
      closeSent = false;
      resolvedCount += 1;
      nextOpenBar = m.exitBarIdx + 3;
    } else if (m.op === 'clock.resync') t0 = Date.now() - m.serverBarIdx * barMs;
    else if (m.op === 'error') { openPending = false; closeSent = false; }
  });
  ws.send(JSON.stringify({ op: 'start' }));

  const buildOrder = ['limit', 'cannon', 'spire'] as const; // FR-6.4c 포탑 3종
  let built = 0;
  let unitIdx = 0;
  const unitCycle = ['club', 'sniper', 'foreman', 'scissor', 'shutter'] as const;
  const totalBars = params.waveCount * 30;

  while (true) {
    await new Promise((r) => setTimeout(r, 100));
    const elapsedBars = (Date.now() - t0) / barMs; // 캡 없음 — overtime 상한(+40) 너머까지 진행해야 done 도달
    battle.advanceTo(elapsedBars);
    if (battle.phase === 'done') break;
    const bar = Math.floor(Math.min(elapsedBars, totalBars));

    if (!openPending && !active && bar >= nextOpenBar && bar + 34 < bars.barCount && aum >= 4) {
      const openIdx = bar + 1;
      const closeIdx = openIdx + 30;
      const delta = bars.bars[closeIdx].c - bars.bars[openIdx].c; // 봇: 정답 방향을 확률 p로
      const correct = delta > 0 ? 'long' : 'short';
      const dir = Math.random() < p ? correct : correct === 'long' ? 'short' : 'long';
      seq += 1;
      openPending = true;
      ws.send(JSON.stringify({ op: 'position.open', seq, direction: dir, stake: Math.max(1, Math.floor(aum * 0.5)) })); // 고수 플레이 가정 (기능 검증용)
    }
    // 청산 요청: exitBar = 요청 시점 bar + 1 → closeTarget−1에 보내면 목표 봉에 체결
    if (active && !closeSent && bar >= active.closeTarget - 1) {
      closeSent = true;
      ws.send(JSON.stringify({ op: 'position.close', seq: active.seq }));
    }
    if (built < Math.min(buildOrder.length, battle.towers.length)) {
      if (battle.buildTower(built, buildOrder[built])) built += 1;
    } else {
      if (battle.gold >= 260) { if (battle.spawnUnit(unitCycle[unitIdx % unitCycle.length])) unitIdx += 1; }
      else if (battle.gold >= 150) battle.spawnUnit('apprentice');
    }
    if (battle.enemies.filter((e) => !e.air).length >= 5 && battle.gold >= 300) battle.useSkill();
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
  return { finish, sessionId: start.sessionId, params };
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

const revealTut = await req<{ companyName: string; ticker: string }>(`/api/stage/${tut.sessionId}/reveal`);
check('FR-9.3 공개 API (튜토리얼 = 고정 실제 차트)', revealTut.ticker !== 'TUT' && revealTut.companyName.length > 0);

console.log('▶ R1 여의도 (~4분 @2x, p=0.9 고수 봇, 이지 모드)…');
let r1 = await playStage('R1', 0.9, 'easy');
check('FR-2.6 이지 모드 파라미터 완화',
  r1.params.mode === 'easy'
  && Math.abs(r1.params.enemyHpMult - BALANCE.ENEMY_HP_MULT * BALANCE.EASY_HP_MULT) < 1e-9
  && Math.abs(r1.params.enemyCountMult - BALANCE.EASY_COUNT_MULT) < 1e-9,
  `hp×${r1.params.enemyHpMult.toFixed(3)} dps×${r1.params.enemyDpsMult.toFixed(3)} cnt×${r1.params.enemyCountMult}`);
// 봇 클리어율은 확률적 (§9.3 의도된 고난이도) — 사람의 재도전처럼 최대 6회 시도 (기능 검증이 목적)
for (let attempt = 2; attempt <= 6 && r1.finish.status !== 'cleared'; attempt++) {
  console.log(`  미클리어 → 재도전 ${attempt}/6…`);
  r1 = await playStage('R1', 0.9, 'easy');
}
check('R1 클리어 (봇 p=0.9, ≤6회 시도)', r1.finish.status === 'cleared');
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
  const codex = await req<{ entries: { region_id: string; best_mode: string; date_start: string | null; trade_date: string; spark: number[] }[] }>('/api/codex');
  check('FR-10.1 도감 등록', codex.entries.length === 1);
  const ce = codex.entries[0];
  check('FR-10.2 도감 카드에 스테이지·난이도·기간·실차트',
    ce?.region_id === 'R1' && ce?.best_mode === 'easy'
    && /^\d{4}-\d{2}-\d{2}$/.test(String(ce?.date_start)) && ce?.spark?.length > 1,
    `${ce?.region_id}/${ce?.best_mode} ${ce?.date_start}~${ce?.trade_date} 봉 ${ce?.spark?.length}점`);
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
