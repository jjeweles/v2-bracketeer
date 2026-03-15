import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = "data/app.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

const RESET_TO_DEMO_ON_BOOT = false;

function calculateHandicap(average: number, percent: number, base: number): number {
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bowlers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  average INTEGER NOT NULL,
  handicap_value INTEGER NOT NULL,
  scratch_entries INTEGER NOT NULL,
  handicap_entries INTEGER NOT NULL,
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
`);

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
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id, handicap_percent, handicap_base`
    )
    .get("Demo Session - Thursday Night", 500, 80, 220, 2_500, 1_000) as {
    id: number;
    handicap_percent: number;
    handicap_base: number;
  };

  const addBowler = db.query(
    `INSERT INTO bowlers (session_id, name, average, handicap_value, scratch_entries, handicap_entries)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const bowlers: Array<[string, number, number, number]> = [
    ["Alex Carter", 212, 2, 2],
    ["Brooke Diaz", 198, 2, 2],
    ["Chris Foster", 205, 2, 2],
    ["Dana Hayes", 187, 2, 1],
    ["Evan Reed", 194, 2, 1],
    ["Frankie Shaw", 176, 2, 1],
    ["Gabe Turner", 201, 2, 1],
    ["Harper Wells", 189, 2, 1],
  ];

  for (const [name, average, scratchEntries, handicapEntries] of bowlers) {
    const handicapValue = calculateHandicap(average, session.handicap_percent, session.handicap_base);
    addBowler.run(session.id, name, average, handicapValue, scratchEntries, handicapEntries);
  }
});

seedDemoSession();
