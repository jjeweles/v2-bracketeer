# Bracketeer (Bun API + React UI + Tauri Desktop)

Bracket/session management app for bowling side brackets.

## Stack

- Backend: Bun (`./src/server.ts`)
- Engine + SQLite logic: (`./src/lib/engine.ts`, `./src/lib/db.ts`)
- Frontend: React + Vite (`./src/ui/App.jsx`)
- Desktop shell: Tauri (`./src-tauri`)
- DB file: `./data/app.db`

## Core Workflow

1. Create or load a session on the Session page.
2. Add/edit/import bowlers on the Bowlers page.
3. Generate brackets on the Brackets page.
4. Enter scores on the Scores page (Game 1 -> Game 2 -> Game 3).
5. Use the Payouts page to settle:
   - payouts
   - refunds
   - pay-later owed balances
6. Complete the session (locks it read-only).

## Feature Behavior

### Sessions

- Session names are made unique automatically.
- If a name already includes a date suffix (`YYYY-MM-DD`), duplicates use counters like `(2)`, `(3)` instead of repeating the date.
- You can clone from an existing session.
- Clone behavior resets bowler entry state:
  - `scratchEntries = 0`
  - `handicapEntries = 0`
  - `payLater = false`
  - `allBracketsMode = off`

### Bowlers

- Alphabetical display by `Last, First`.
- Inline click-to-edit for:
  - name
  - average
  - scratch entries
  - handicap entries
- Delete with confirmation modal.
- Search/filter for large lists.
- Optional pay-later tracking per bowler.
- `All Brackets` modes:
  - `Off`
  - `All (Both)`
  - `All-Handicap`
  - `All-Scratch`

### PDF Import

- Supported import from LeagueSecretary-style Bowler List PDF.
- Import is on the Bowlers page.
- Imported bowlers start with:
  - scratch entries = 0
  - handicap entries = 0
- Duplicate names in the same import/session are skipped.

### Brackets + Scores

- Brackets are 8-person seeded brackets.
- Supports scratch and handicap bracket pools.
- Match structure per bracket:
  - Round 1: `1v8`, `2v7`, `3v6`, `4v5`
  - Round 2: winners advance
  - Round 3: final
- Scores are entered once per bowler per game and reused across their bracket entries.
- Game tabs are gated:
  - Game 2 locked until Game 1 saved
  - Game 3 locked until Game 2 saved

### ALL Mode Semantics

- `All (Both)` = enter every possible scratch bracket and every possible handicap bracket.
- `All-Scratch` = enter every possible scratch bracket.
- `All-Handicap` = enter every possible handicap bracket.
- No manual count is required in UI for ALL mode.

### Refunds, Payouts, Owed

- Refunds are generated from leftover bracket entries.
- Payouts page contains:
  - `View Refunds` modal
  - `View Owed` modal
  - payout list with mark-paid toggles
- Refund/owed/payout rows can be marked settled/paid.
- KPI cards show remaining outstanding amounts.
- For pay-later bowlers:
  - owed = bracket costs (based on actual generated entries)
  - payout summary amount is net (`gross winnings - owed`)

### Session Completion

- A session can be completed only when:
  - bracket scoring is complete
  - refunds are fully settled
  - payouts are fully paid
  - owed balances are settled
- Completed sessions are read-only.

### Maintenance

- Dedicated Maintenance page to delete mistaken/old sessions.

## API Surface (high-level)

- `GET /api/sessions`
- `POST /api/sessions`
- `POST /api/sessions/:id/clone`
- `POST /api/sessions/:id/complete`
- `DELETE /api/sessions/:id`
- `GET /api/sessions/:id/snapshot`
- `GET /api/sessions/:id/bowlers`
- `POST /api/sessions/:id/bowlers`
- `PATCH /api/sessions/:id/bowlers/:bowlerId`
- `DELETE /api/sessions/:id/bowlers/:bowlerId`
- `POST /api/sessions/:id/import-bowlers-pdf`
- `POST /api/sessions/:id/generate-brackets`
- `POST /api/sessions/:id/scores/:gameNumber`
- `PATCH /api/sessions/:id/refunds/:bowlerId/paid`
- `PATCH /api/sessions/:id/payouts/:bowlerId/paid`
- `PATCH /api/sessions/:id/owes/:bowlerId/paid`

## Local Development

## Prerequisites

1. Bun: [https://bun.sh](https://bun.sh)
2. Rust (for Tauri): [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)
3. Tauri system prerequisites: [https://v2.tauri.app/start/prerequisites/](https://v2.tauri.app/start/prerequisites/)
4. Node runtime compatible with your Vite version (Vite 8 expects Node `20.19+` or `22.12+`).

## Install

```bash
bun install
```

## Run (Web)

```bash
bun run dev
```

- Serves API + static UI on [http://localhost:3000](http://localhost:3000)

## Run (UI only, Vite dev server)

```bash
bun run ui:dev
```

## Run (Desktop dev)

```bash
bun run desktop:dev
```

## Build UI

```bash
bun run ui:build
```

## Build Desktop App

```bash
bun run desktop:build
```

- Bundles output under `/v2-bracketeer/src-tauri/target/release/bundle/`
