import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import type { WsClientMsg } from '@tf/shared';
import { verifyToken } from './auth.js';
import { SERVER_ROOT } from './db.js';
import { loadLive } from './live.js';
import { router } from './routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', router);
// FR-4.5: bars 파일은 불투명 UUID 파일명만 서빙 (디렉토리 리스팅 없음)
app.use('/static/bars', express.static(path.join(SERVER_ROOT, 'static', 'bars'), { index: false, maxAge: '1h' }));

const server = http.createServer(app);

// §7.2 포지션 판정 전용 WebSocket
const wss = new WebSocketServer({ server, path: '/ws/stage' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const sessionId = url.searchParams.get('session') ?? '';
  const accountId = verifyToken(url.searchParams.get('token') ?? undefined);
  const live = accountId ? loadLive(sessionId) : null;
  if (!live || live.accountId !== accountId) {
    ws.send(JSON.stringify({ op: 'error', code: 'SESSION_ENDED' }));
    ws.close();
    return;
  }
  live.ws = ws;

  ws.on('message', (raw) => {
    let msg: WsClientMsg;
    try {
      msg = JSON.parse(String(raw)) as WsClientMsg;
    } catch {
      return;
    }
    if (msg.op === 'start') live.start();
    else if (msg.op === 'position.open') live.openPosition(msg.seq, msg.direction, msg.stake);
    else if (msg.op === 'position.close') live.closePosition(msg.seq);
    else if (msg.op === 'combat.aum') live.reportCombatAum(msg.earned);
    else if (msg.op === 'clock.sync') live.clockSync(msg.clientBarIdx);
  });
  ws.on('close', () => {
    if (live.ws === ws) live.ws = null;
  });
});

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} (REST + /ws/stage + /static/bars)`);
});
