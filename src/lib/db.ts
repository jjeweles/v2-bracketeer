import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.BRACKETEER_DB_PATH || "data/app.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

const RESET_TO_DEMO_ON_BOOT = true;

function calculateHandicap(
  average: number,
  percent: number,
  base: number,
): number {
  const raw = ((base - average) * percent) / 100;
  return Math.max(0, Math.round(raw));
}

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  entry_fee_cents INTEGER NOT NULL,
  handicap_percent INTEGER NOT NULL,
  handicap_base INTEGER NOT NULL,
  payout_first_cents INTEGER NOT NULL,
  payout_second_cents INTEGER NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  brackets_printed_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bowlers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lane_number INTEGER,
  average INTEGER NOT NULL,
  handicap_value INTEGER NOT NULL,
  scratch_entries INTEGER NOT NULL,
  handicap_entries INTEGER NOT NULL,
  pay_later INTEGER NOT NULL DEFAULT 0,
  all_brackets INTEGER NOT NULL DEFAULT 0,
  all_brackets_count INTEGER NOT NULL DEFAULT 0,
  all_brackets_mode TEXT NOT NULL DEFAULT 'off',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brackets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('scratch','handicap')),
  bracket_number INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, kind, bracket_number)
);

CREATE TABLE IF NOT EXISTS bracket_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bracket_id INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  seed INTEGER NOT NULL CHECK(seed BETWEEN 1 AND 8),
  bowler_id INTEGER NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  UNIQUE(bracket_id, seed)
);

CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler_id INTEGER NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('scratch','handicap')),
  entry_count INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bowler_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler_id INTEGER NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL CHECK(game_number BETWEEN 1 AND 3),
  scratch_score INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, bowler_id, game_number)
);

CREATE TABLE IF NOT EXISTS refund_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler_id INTEGER NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, bowler_id)
);

CREATE TABLE IF NOT EXISTS payout_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler_id INTEGER NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, bowler_id)
);

CREATE TABLE IF NOT EXISTS owed_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler_id INTEGER NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, bowler_id)
);
`);

function hasColumn(table: string, column: string): boolean {
  const rows = db.query(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return rows.some((row) => row.name === column);
}

if (!hasColumn("sessions", "is_completed")) {
  db.exec(
    `ALTER TABLE sessions ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0`,
  );
}

if (!hasColumn("sessions", "completed_at")) {
  db.exec(`ALTER TABLE sessions ADD COLUMN completed_at TEXT`);
}

if (!hasColumn("sessions", "brackets_printed_at")) {
  db.exec(`ALTER TABLE sessions ADD COLUMN brackets_printed_at TEXT`);
}

if (!hasColumn("bowlers", "pay_later")) {
  db.exec(
    `ALTER TABLE bowlers ADD COLUMN pay_later INTEGER NOT NULL DEFAULT 0`,
  );
}

if (!hasColumn("bowlers", "all_brackets")) {
  db.exec(
    `ALTER TABLE bowlers ADD COLUMN all_brackets INTEGER NOT NULL DEFAULT 0`,
  );
}

if (!hasColumn("bowlers", "all_brackets_count")) {
  db.exec(
    `ALTER TABLE bowlers ADD COLUMN all_brackets_count INTEGER NOT NULL DEFAULT 0`,
  );
}

if (!hasColumn("bowlers", "all_brackets_mode")) {
  db.exec(
    `ALTER TABLE bowlers ADD COLUMN all_brackets_mode TEXT NOT NULL DEFAULT 'off'`,
  );
}

if (!hasColumn("bowlers", "lane_number")) {
  db.exec(`ALTER TABLE bowlers ADD COLUMN lane_number INTEGER`);
}

const seedDemoSession = db.transaction(() => {
  if (RESET_TO_DEMO_ON_BOOT) {
    db.query(`DELETE FROM sessions`).run();
  }

  const existingDemo = db
    .query(`SELECT id FROM sessions WHERE name = ? LIMIT 1`)
    .get("Demo Session - Thursday Night") as { id: number } | null;

  if (existingDemo) {
    return;
  }

  const session = db
    .query(
      `INSERT INTO sessions (name, entry_fee_cents, handicap_percent, handicap_base, payout_first_cents, payout_second_cents)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id, handicap_percent, handicap_base`,
    )
    .get("Demo Session - Thursday Night", 500, 80, 220, 2_500, 1_000) as {
    id: number;
    handicap_percent: number;
    handicap_base: number;
  };

  const addBowler = db.query(
    `INSERT INTO bowlers (session_id, name, lane_number, average, handicap_value, scratch_entries, handicap_entries)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const bowlers: Array<[string, number, number, number, number]> = [
    ["BRANDON", 1, 212, 0, 1],
    ["BROCK", 1, 198, 0, 3],
    ["BRYAN VOLLMER", 2, 205, 0, 3],
    ["DREGGORS", 2, 187, 0, 3],
    ["EMIL", 3, 194, 0, 1],
    ["GALLER", 3, 176, 0, 14],
    ["JUSTIN JEWELL", 4, 201, 0, 14],
    ["JUSTIN WREN", 4, 189, 0, 10],
    ["LANCE G", 4, 189, 0, 1],
    ["LARRY KASSNER", 4, 189, 0, 2],
    ["LUIS DELEON", 4, 189, 0, 14],
    ["MATT CABANSKI", 4, 189, 0, 14],
    ["NELSON", 4, 189, 0, 6],
    ["RANDY RANGEL", 4, 189, 0, 3],
    ["RICH A SR", 4, 189, 0, 2],
    ["RYAN BODY", 4, 189, 0, 1],
    ["S CORBETT", 4, 189, 0, 14],
    ["TJ D", 4, 189, 0, 1],
    ["TONY HOUSTON", 4, 189, 0, 5],
  ];

  for (const [
    name,
    laneNumber,
    average,
    scratchEntries,
    handicapEntries,
  ] of bowlers) {
    const handicapValue = calculateHandicap(
      average,
      session.handicap_percent,
      session.handicap_base,
    );
    addBowler.run(
      session.id,
      name,
      laneNumber,
      average,
      handicapValue,
      scratchEntries,
      handicapEntries,
    );
  }
});

seedDemoSession();
