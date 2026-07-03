/**
 * Serve hardening gates (Copilot review on PR #5): CORS restricted to the
 * demo dev-server origins, request bodies size-capped (413), fake mode fails
 * fast when the contract has no example for the requested intent, and the
 * happy NDJSON path still streams the full event sequence.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer } from "./serve.js";

let base: string;
let server: ReturnType<typeof startServer>;

beforeAll(async () => {
  server = startServer({ contractPath: "fixtures/shadcn.v0_4.dspack.json", port: 0 });
  await new Promise((resolve) => server.on("listening", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(() => server.close());

describe("serve hardening", () => {
  it("reflects only the demo dev-server origins in CORS headers", async () => {
    const allowed = await fetch(`${base}/health`, { headers: { origin: "http://localhost:5173" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(allowed.headers.get("access-control-allow-methods")).toContain("POST");

    const denied = await fetch(`${base}/health`, { headers: { origin: "https://evil.example" } });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("caps request bodies at 64KB with a 413", async () => {
    const response = await fetch(`${base}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "x".repeat(70 * 1024), fake: true }),
    });
    expect(response.status).toBe(413);
  });

  it("fake mode fails fast when the contract has no example for the intent", async () => {
    const response = await fetch(`${base}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fake: true, intent: "bulk-edit" }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/no example for intent 'bulk-edit'/);
  });

  it("streams the full flagship event sequence for a fake run", async () => {
    const response = await fetch(`${base}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fake: true }),
    });
    expect(response.status).toBe(200);
    const lines = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.map((event) => event.type)).toEqual(["start", "attempt", "repair", "attempt", "emitted", "done"]);
    expect(lines.at(-1).outcome).toBe("passed");
  });

  it("a contract without examples yields a clear fake-mode error, not undefined output", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dspack-serve-"));
    const bare = join(dir, "bare.dspack.json");
    writeFileSync(bare, JSON.stringify({ dspack: "0.3", name: "bare", components: {}, intents: [{ id: "destructive-action", description: "x" }] }));
    const bareServer = startServer({ contractPath: bare, port: 0 });
    await new Promise((resolve) => bareServer.on("listening", resolve));
    const address = bareServer.address();
    const bareBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    const response = await fetch(`${bareBase}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fake: true }),
    });
    expect(response.status).toBe(400);
    bareServer.close();
  });
});
