# Bowling Bracket Manager (Bun API + Tauri Desktop)

This project now supports both:
- Bun web runtime (existing)
- Tauri cross-platform desktop shell (new)

## Implemented app functionality (MVP)

- Session creation with:
  - name
  - entry fee
  - handicap percent/base config
  - custom first/second payouts
- Bowler entry with:
  - name
  - average
  - handicap value
  - scratch entry count
  - handicap entry count
- Bracket generation:
  - scratch + handicap bracket pools
  - 8 unique bowlers per bracket
  - randomized seeding
  - fixed matchup structure: 1v8, 2v7, 3v6, 4v5
  - leftover entries refund recap
- Global game scoring:
  - one scratch score per bowler per game
  - score reused across all that bowler's entries
  - handicap effective score = scratch + handicap value
- Round advancement:
  - game 1 -> round 1
  - game 2 -> round 2 (tie-forward behavior)
  - game 3 -> final
- Payout summary per completed bracket

## Desktop setup (Tauri)

### Prerequisites

1. Install Bun: [https://bun.sh](https://bun.sh)
2. Install Rust (stable): [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)
3. Install Tauri system dependencies:
   - macOS: Xcode Command Line Tools
   - Windows: WebView2 + MSVC build tools
   - Linux: see Tauri prerequisites docs

Tauri prerequisites docs: [https://v2.tauri.app/start/prerequisites/](https://v2.tauri.app/start/prerequisites/)

### Install JS dependencies

```bash
bun install
```

### Run as desktop app (dev)

```bash
bun run desktop:dev
```

This starts your Bun server (`beforeDevCommand`) and opens the native desktop window.

### Build desktop installers/bundles

```bash
bun run desktop:build
```

Output goes under `src-tauri/target/release/bundle/`.

## Web-only mode (optional)

```bash
bun run dev
```

Open `http://localhost:3000`.

## Data storage

SQLite database path:

`data/app.db`
