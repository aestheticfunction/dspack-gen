#!/usr/bin/env bash
# Pack-and-install boundary test: the package must be consumable exactly as
# published — root, ./core, ./adapter-types and ./theme subpaths all resolve from
# the tarball, and the adapter contract's runtime pieces work.
set -euo pipefail
cd "$(dirname "$0")/.."

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

npm run build >/dev/null
TARBALL="$(npm pack --pack-destination "$WORK" 2>/dev/null | tail -1)"
echo "packed: $TARBALL"

cd "$WORK"
npm init -y >/dev/null 2>&1
npm install --no-fund --no-audit "./$TARBALL" >/dev/null

cat > smoke.mjs <<'EOF'
import { runPipeline, ScriptedAdapter } from "@aestheticfunction/dspack-gen";
import { lintSurface, compileContext } from "@aestheticfunction/dspack-gen/core";
import { AdapterOutputError, parseJsonOutput } from "@aestheticfunction/dspack-gen/adapter-types";
import { compileRealizations, COMPILER_VERSION } from "@aestheticfunction/dspack-gen/theme";
import { compileProposal } from "@aestheticfunction/dspack-gen/theme/compile.mjs";
import { createRequire } from "node:module";

if (typeof runPipeline !== "function" || typeof ScriptedAdapter !== "function") throw new Error("root exports missing");
if (typeof lintSurface !== "function" || typeof compileContext !== "function") throw new Error("./core exports missing");
if (typeof parseJsonOutput !== "function") throw new Error("./adapter-types exports missing");
const err = new AdapterOutputError("test:adapter", "raw", "why");
if (err.name !== "AdapterOutputError") throw new Error("typed error broken from packed install");
if (JSON.stringify(parseJsonOutput("test:adapter", '{"ok":true}')) !== '{"ok":true}') throw new Error("parseJsonOutput broken");
if (typeof compileRealizations !== "function" || typeof compileProposal !== "function" || !COMPILER_VERSION) throw new Error("./theme exports missing");
const themeSchema = createRequire(import.meta.url)("@aestheticfunction/dspack-gen/theme/theme-direction.v1.schema.json");
if (themeSchema.title !== "theme-direction.v1") throw new Error("./theme schema missing");
console.log("pack-and-install smoke: OK (root + ./core + ./adapter-types + ./theme resolve)");
EOF
node smoke.mjs

# PipelineEvent must ship in the packed types (type-only: grep the d.ts).
grep -q "PipelineEvent" node_modules/@aestheticfunction/dspack-gen/dist/index.d.ts \
  || { echo "PipelineEvent missing from packed root types"; exit 1; }
echo "types smoke: OK (PipelineEvent in packed root types)"

# The theme compiler ships its own types; its parity fixtures do not ship.
test -f node_modules/@aestheticfunction/dspack-gen/src/theme/index.d.ts || { echo "theme types missing"; exit 1; }
test ! -e node_modules/@aestheticfunction/dspack-gen/src/theme/fixtures || { echo "theme fixtures were packed"; exit 1; }
echo "theme smoke: OK (types packed, fixtures not)"
