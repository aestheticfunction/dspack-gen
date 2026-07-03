/**
 * The M1 demo gate (`npm run demo:e2e`): drives the flagship Generate view
 * end-to-end against `dspack-gen serve` in fake (deterministic scripted
 * adapter) mode — no model, no network beyond localhost.
 *
 * The demo app lives in the dspack-emit repo (formerly dspack-to-a2ui);
 * point DEMO_DIR at a checkout that has the Generate view (default: a
 * sibling clone named after the current repo name). CI checks the repo out
 * next to this one.
 */
import { defineConfig } from "@playwright/test";

const DEMO_DIR = process.env.DEMO_DIR ?? "../dspack-emit";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:5173" },
  webServer: [
    {
      command: "npx tsx src/cli.ts serve --port 8787",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true,
    },
    {
      command: `npm --prefix ${DEMO_DIR}/demo run dev -- --host 127.0.0.1 --port 5173 --strictPort`,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
  ],
});
