import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.js';

// MVP 익명 토큰: accountId.HMAC — 외부 배포 시 JWT+회전 필요
const SECRET = process.env.TF_SECRET ?? 'tf-mvp-local-secret';

function sign(id: string): string {
  return crypto.createHmac('sha256', SECRET).update(id).digest('base64url');
}

export function issueToken(id: string): string {
  return `${id}.${sign(id)}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(id)))) return null;
  } catch {
    return null;
  }
  return id;
}

export interface AuthedRequest extends Request {
  accountId: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const id = verifyToken(token);
  if (!id) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const row = db.prepare('SELECT id FROM accounts WHERE id = ?').get(id);
  if (!row) return res.status(401).json({ error: 'UNAUTHORIZED' });
  (req as AuthedRequest).accountId = id;
  db.prepare("UPDATE accounts SET last_seen_at = datetime('now') WHERE id = ?").run(id);
  next();
}
