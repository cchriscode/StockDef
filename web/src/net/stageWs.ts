import type { Direction, WsClientMsg, WsServerMsg } from '@tf/shared';

// §7.2 포지션 판정 전용 WebSocket 클라이언트
export class StageWs {
  private ws: WebSocket;
  private syncTimer: number | undefined;
  onMsg: (m: WsServerMsg) => void = () => {};
  onClose: () => void = () => {};

  constructor(sessionId: string, token: string) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws/stage?session=${sessionId}&token=${encodeURIComponent(token)}`);
    this.ws.onmessage = (e) => this.onMsg(JSON.parse(e.data) as WsServerMsg);
    this.ws.onclose = () => {
      clearInterval(this.syncTimer);
      this.onClose();
    };
  }

  ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(), { once: true });
      this.ws.addEventListener('error', () => reject(new Error('WS_CONNECT_FAILED')), { once: true });
    });
  }

  private send(m: WsClientMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  start() {
    this.send({ op: 'start' });
  }

  openPosition(seq: number, direction: Direction, stake: number) {
    this.send({ op: 'position.open', seq, direction, stake });
  }

  closePosition(seq: number) {
    this.send({ op: 'position.close', seq });
  }

  reportCombatAum(earned: number) {
    this.send({ op: 'combat.aum', earned });
  }

  beginClockSync(getBarIdx: () => number) {
    this.syncTimer = window.setInterval(() => this.send({ op: 'clock.sync', clientBarIdx: getBarIdx() }), 5000);
  }

  close() {
    clearInterval(this.syncTimer);
    this.ws.close();
  }
}
