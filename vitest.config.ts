import { defineConfig } from "vitest/config";

// e2e/ is Playwright's (npm run demo:e2e); vitest owns the unit/gate tests.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
