# Changelog

All notable changes to this project are documented here.

## 2026-04-09

### Added
- Added a project `CHANGELOG.md` to track updates by date.
- Added live "Can Make" metrics on Bowlers page:
  - `Scratch Can Make`
  - `Hdcp Can Make`

### Changed
- Updated bowlers metrics UI to separate concerns visually:
  - `Needed` metrics grouped together
  - `Can Make` metrics grouped together with spacing/divider
- Dynamic ALL-mode entry projections now flow through a shared effective-entry mapping in the app state.
- Updated `README.md` for distribution-ready documentation and current feature behavior.

### Fixed
- Entrants list and entrants print now use effective dynamic entry counts (including ALL-mode projections).
- "Entries needed for full brackets" now uses the same effective dynamic counts, keeping calculations aligned with on-screen values.

### Removed
- None.
