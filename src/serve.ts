/**
 * `dspack-gen serve` — the demo's local pipeline endpoint. Incidental
 * plumbing: node:http, localhost-only, no framework.
 *
 *   POST /run  {prompt?, intent?, model?, fake?, maxRepairs?, noSteering?}
 *     → NDJSON stream of PipelineEvent lines (start / attempt / repair /
 *       emitted / done — the `done` event carries the full audit report v1).
 *
 * `fake: true` runs the deterministic ScriptedAdapter (golden violating
 * fixture F1, then the contract's worked example) — the demo's verification
 * mode and the Playwright gate's backend. Live mode requires `model`
 * ("ollama:<tag>" | "anthropic:<id>"); as everywhere, no default model
 * exists in code.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Contract } from "./core/contract.js";
import { UnknownRuleTypeError } from "./core/lint/index.js";
import { adapterFor } from "./adapters/index.js";
import { ScriptedAdapter } from "./adapters/fake.js";
import { runPipeline } from "./run/orchestrator.js";

export interface ServeOptions {
  contractPath: string;
  port?: number;
}

interface RunBody {
  prompt?: string;
  intent?: string;
  model?: string;
  fake?: boolean;
  maxRepairs?: number;
  noSteering?: boolean;
}

export function startServer(options: ServeOptions): ReturnType<typeof createServer> {
  const contract = JSON.parse(readFileSync(resolve(options.contractPath), "utf8")) as Contract;
  const violating = JSON.parse(
    readFileSync(resolve("fixtures/golden/violating/F1-dialog-for-delete.dsurface.json"), "utf8"),
  ) as unknown;

  const server = createServer((request, response) => {
    // The demo app runs on the Vite dev origin; this server is localhost-only.
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "content-type");
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, contract: contract.name }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/run") {
      response.writeHead(404).end();
      return;
    }

    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      void (async () => {
        let body: RunBody;
        try {
          body = raw ? (JSON.parse(raw) as RunBody) : {};
        } catch {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "invalid JSON body" }));
          return;
        }

        const workedExample = (contract.examples ?? [])[0]?.surface;
        const adapter = body.fake
          ? new ScriptedAdapter([{ output: violating }, { output: workedExample }])
          : body.model
            ? adapterFor(body.model)
            : null;
        if (!adapter) {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "either fake: true or model: 'ollama:<tag>|anthropic:<id>' is required" }));
          return;
        }

        response.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-store" });
        const send = (event: unknown): void => {
          response.write(JSON.stringify(event) + "\n");
        };
        try {
          await runPipeline({
            contract,
            intent: body.intent ?? "destructive-action",
            prompt: body.prompt ?? "a screen to delete my account",
            adapter,
            maxRepairs: body.maxRepairs,
            compile: { omitRuleSteering: body.noSteering },
            onEvent: send,
          });
        } catch (error) {
          send({
            type: "error",
            exitCode: error instanceof UnknownRuleTypeError ? 4 : 1,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        response.end();
      })();
    });
  });

  const port = options.port ?? 8787;
  server.listen(port, "127.0.0.1", () => {
    console.error(`dspack-gen serve: http://127.0.0.1:${port} (contract: ${contract.name})`);
  });
  return server;
}
