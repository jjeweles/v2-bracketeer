#!/usr/bin/env bash
set -euo pipefail

bun run ui:build
mkdir -p src-tauri/resources
bun build src/server.ts --compile --outfile src-tauri/resources/bracketeer-server
chmod +x src-tauri/resources/bracketeer-server
