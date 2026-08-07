#!/usr/bin/env node
/**
 * Contract-copy drift check (dspack-gen#7).
 *
 * The ecosystem deliberately carries copies of shared artifacts (the shadcn
 * v0.3 contract; see the manifest below) instead of a shared package — repo
 * rule: no shared types/utils package. The price of copies is silent drift;
 * this script makes drift loud: every entry must match its source of truth
 * BYTE-FOR-BYTE. CI runs it on every push/PR; a red check means the source
 * moved (or the copy was edited locally) — run with --write to re-sync,
 * then regenerate anything derived (goldens) and commit both together.
 *
 * Boring by design: node builtins + global fetch, one retry, no deps.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const RAW = "https://raw.githubusercontent.com/aestheticfunction/dspack";
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const MANIFEST = [
  {
    local: "fixtures/astryx.v0_1_2.dspack.json",
    source:
      "https://raw.githubusercontent.com/aestheticfunction/dspack/main/examples/astryx.dspack.json",
    note: "the Astryx contract fixture — copy of the spec repo's source of truth",
  },
  {
    local: "fixtures/shadcn.v0_4.dspack.json",
    source: `${RAW}/805732c154f0f214721c9934a450b0edb2656c99/examples/shadcn-ui.dspack.json`,
    note: "the pipeline's contract fixture — copy of the spec repo's source of truth",
    // A DELIBERATE PIN, not staleness — the same policy, commit, and sha256
    // already ratified and shipped in dspack-emit and dspack-studio. dspack
    // main now carries the 32-component production contract (dspack#35), but
    // this package's fixtures, goldens, and eval corpus were built against
    // the 8-component v2.3.0 contract; migrating is gated on the emit
    // representation milestone (aestheticfunction/dspack-emit#28). See
    // docs/CONTRACT-PIN.md.
    pin: {
      ref: "805732c154f0f214721c9934a450b0edb2656c99",
      version: "2.3.0",
      sha256: "ca19f8410a97f2004cf1d6f6dd2d7542abccfbb5430b756e0ccdc1ee954c7bb7",
      tracks: `${RAW}/main/examples/shadcn-ui.dspack.json`,
      removeWhen:
        "the dspack-emit representation foundation's T-capabilities land and the profile migration completes — " +
        "the emitter must represent the production catalog before this package's corpus follows it",
      issue: "aestheticfunction/dspack-gen#51",
    },
  },
];

/** A pinned ref must be immutable; report how far behind the tracked branch it sits. */
async function reportPin(entry, source) {
  const { pin } = entry;
  const actual = sha256(source);
  if (actual !== pin.sha256) {
    console.error(`TAMPERED ${entry.local}  the PINNED artifact itself changed`);
    console.error(`         ref      ${pin.ref}`);
    console.error(`         expected sha256 ${pin.sha256}`);
    console.error(`         actual   sha256 ${actual}`);
    console.error(`         a pinned commit must be immutable — investigate before re-syncing.`);
    return false;
  }
  let ahead = "unavailable";
  try {
    const head = await fetchSource(pin.tracks);
    ahead = head.equals(source)
      ? "none — main matches the pin; the pin can be lifted"
      : `main has moved (v${JSON.parse(head.toString()).version}, ${head.length} bytes vs pinned ${source.length})`;
  } catch {
    /* offline: the pin still verifies against its own hash */
  }
  console.log(`PINNED   ${entry.local}  v${pin.version} @ ${pin.ref.slice(0, 7)} (sha256 verified)`);
  console.log(`         upstream drift: ${ahead}`);
  console.log(`         NOT current shadcn coverage — see docs/CONTRACT-PIN.md (${pin.issue})`);
  return true;
}

const write = process.argv.includes("--write");

async function fetchSource(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= 2) throw new Error(`fetching ${url}: ${error.message ?? error}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

let drifted = 0;
for (const entry of MANIFEST) {
  const source = await fetchSource(entry.source);
  if (entry.pin && !(await reportPin(entry, source))) {
    drifted++;
    continue;
  }
  let local;
  try {
    local = readFileSync(entry.local);
  } catch {
    local = null;
  }
  if (local && source.equals(local)) {
    if (!entry.pin) console.log(`in sync  ${entry.local}`);
    continue;
  }
  if (write) {
    writeFileSync(entry.local, source);
    console.log(`SYNCED   ${entry.local}  <-  ${entry.source}`);
    console.log(`         regenerate derived goldens before committing (see README).`);
  } else {
    drifted++;
    console.error(`DRIFT    ${entry.local}  (${entry.note})`);
    console.error(`         differs from ${entry.source}`);
    console.error(`         fix: node scripts/check-sync.mjs --write, regenerate derived goldens, commit together.`);
  }
}
if (drifted > 0) process.exit(1);
