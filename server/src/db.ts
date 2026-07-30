import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');

export const db = new Database(path.join(SERVER_ROOT, 'data.db'));
db.pragma('journal_mode = WAL');

// PRD §6.1 스키마 (SQLite 이식 — JSON은 TEXT 컬럼)
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  capital       INTEGER NOT NULL DEFAULT 0,
  company_rank  INTEGER NOT NULL DEFAULT 1,
  tutorial_done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS departments (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  dept_key   TEXT NOT NULL,
  level      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (account_id, dept_key)
);
CREATE TABLE IF NOT EXISTS territories (
  account_id    TEXT NOT NULL REFERENCES accounts(id),
  region_id     TEXT NOT NULL,
  captured_at   TEXT,
  rewards_taken TEXT NOT NULL DEFAULT '[]',
  best_grade    TEXT,
  play_count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, region_id)
);
CREATE TABLE IF NOT EXISTS chart_sets (
  id             TEXT PRIMARY KEY,
  ticker         TEXT NOT NULL,
  company_name   TEXT NOT NULL,
  trade_date     TEXT NOT NULL,
  market         TEXT NOT NULL,
  sector         TEXT NOT NULL,
  cap_tier       TEXT NOT NULL,
  region_id      TEXT NOT NULL,
  archetype      TEXT NOT NULL,
  day_change_pct REAL NOT NULL,
  rarity         TEXT NOT NULL,
  difficulty     INTEGER NOT NULL,
  bars_url       TEXT NOT NULL,
  sigma_15m      REAL NOT NULL,
  sigma_30m      REAL NOT NULL,
  sigma_60m      REAL NOT NULL,
  events         TEXT NOT NULL,
  news           TEXT NOT NULL,
  ohlcv_day      TEXT NOT NULL,
  UNIQUE (ticker, trade_date)
);
CREATE INDEX IF NOT EXISTS idx_chart_sets_region ON chart_sets (region_id, difficulty);
CREATE TABLE IF NOT EXISTS stage_sessions (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id),
  region_id     TEXT NOT NULL,
  chart_set_id  TEXT NOT NULL REFERENCES chart_sets(id),
  is_retry      INTEGER NOT NULL,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  t0_ms         INTEGER,
  ended_at      TEXT,
  status        TEXT NOT NULL,
  speed         REAL NOT NULL DEFAULT 1.0,
  params        TEXT NOT NULL,
  gold_earned   INTEGER, gold_left INTEGER, aum_left INTEGER,
  hp_left       INTEGER,
  hits INTEGER, misses INTEGER, draws INTEGER,
  enemy_base_destroyed INTEGER,
  grade TEXT, capital_awarded INTEGER,
  eligible_lines TEXT, reward_taken TEXT
);
CREATE TABLE IF NOT EXISTS positions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL REFERENCES stage_sessions(id),
  seq           INTEGER NOT NULL,
  direction     TEXT NOT NULL,
  stake         INTEGER NOT NULL,
  expiry_bars   INTEGER NOT NULL,
  open_bar_idx  INTEGER NOT NULL,
  close_bar_idx INTEGER NOT NULL,
  base_price    REAL NOT NULL,
  close_price   REAL,
  delta_pct     REAL,
  m_multiplier  REAL,
  outcome       TEXT,
  payout        INTEGER,
  resolved_at   TEXT
);
CREATE TABLE IF NOT EXISTS codex_entries (
  account_id       TEXT NOT NULL REFERENCES accounts(id),
  chart_set_id     TEXT NOT NULL REFERENCES chart_sets(id),
  first_cleared_at TEXT NOT NULL DEFAULT (datetime('now')),
  best_accuracy    REAL,
  best_grade       TEXT,
  PRIMARY KEY (account_id, chart_set_id)
);
CREATE TABLE IF NOT EXISTS telemetry (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT,
  event      TEXT NOT NULL,
  props      TEXT,
  at         TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export interface ChartSetRow {
  id: string; ticker: string; company_name: string; trade_date: string;
  market: string; sector: string; cap_tier: string; region_id: string;
  archetype: string; day_change_pct: number; rarity: string; difficulty: number;
  bars_url: string; sigma_15m: number; sigma_30m: number; sigma_60m: number;
  events: string; news: string; ohlcv_day: string;
}

export interface SessionRow {
  id: string; account_id: string; region_id: string; chart_set_id: string;
  is_retry: number; started_at: string; t0_ms: number | null; ended_at: string | null;
  status: string; speed: number; params: string;
  gold_earned: number | null; gold_left: number | null; aum_left: number | null;
  hp_left: number | null; hits: number | null; misses: number | null; draws: number | null;
  enemy_base_destroyed: number | null; grade: string | null; capital_awarded: number | null;
  eligible_lines: string | null; reward_taken: string | null;
}

export interface TerritoryRow {
  account_id: string; region_id: string; captured_at: string | null;
  rewards_taken: string; best_grade: string | null; play_count: number;
}
