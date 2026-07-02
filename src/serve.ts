/**
 * `dspack-gen serve` — the demo's local pipeline endpoint. Incidental
 * plumbing: node:http, localhost-only, no framework.
 *
 *   POST /run  {prompt?, intent?, model?, fake?, maxRepairs?, noSteering?}
 *     → NDJSON stream of PipelineEvent lines (start / attempt / repair /
 *       emitted / done — the `done` event carries the full audit report v1).
 *
 * `fake: true` runs the deterministic ScriptedAdapter (golden violating
 * fixture F1, then the contract's worked example for the requested intent) —
 * the demo's verification mode and the Playwright gate's backend. Live mode
 * requires `model` ("ollama:<tag>" | "anthropic:<id>"); as everywhere, no
 * default model exists in code.
 *
 * Hardening (localhost-only is not a security boundary while a browser is
 * running): CORS is restricted to the demo dev-server origins, request
 * bodies are size-capped, and event emission can never fail a run.
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
  /** 1–65535 (validated by the CLI); 0 is permitted for tests (ephemeral port). */
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

/** Only the demo dev server may read responses cross-origin. */
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

/** Pipeline requests are small JSON documents; anything bigger is a mistake. */
const MAX_BODY_BYTES = 64 * 1024;

export function startServer(options: ServeOptions): ReturnType<typeof createServer> {
  const contract = JSON.parse(readFileSync(resolve(options.contractPath), "utf8")) as Contract;
  const violating = JSON.parse(
    readFileSync(resolve("fixtures/golden/violating/F1-dialog-for-delete.dsurface.json"), "utf8"),
  ) as unknown;

  const server = createServer((request, response) => {
    const origin = request.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("vary", "origin");
      response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      response.setHeader("access-control-allow-headers", "content-type");
    }
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
    let bytes = 0;
    let tooLarge = false;
    request.on("data", (chunk: Buffer) => {
      if (tooLarge) return;
      bytes += chunk.length; // byte-accurate: string length counts UTF-16 code units
      raw += chunk;
      if (bytes > MAX_BODY_BYTES) {
        tooLarge = true;
        response.writeHead(413, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: `request body exceeds ${MAX_BODY_BYTES} bytes` }));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (tooLarge) return;
      void (async () => {
        let body: RunBody;
        try {
          body = raw ? (JSON.parse(raw) as RunBody) : {};
        } catch {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "invalid JSON body" }));
          return;
        }

        const intent = body.intent ?? "destructive-action";
        // Untrusted JSON: booleans are strict, numbers are validated.
        const fake = body.fake === true;
        const noSteering = body.noSteering === true;
        if (body.maxRepairs !== undefined && (!Number.isInteger(body.maxRepairs) || body.maxRepairs < 0)) {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "maxRepairs must be a non-negative integer" }));
          return;
        }
        let adapter;
        if (fake) {
          // The scripted repair must land on the contract's worked example
          // FOR THIS INTENT — fail fast instead of scripting `undefined`.
          const example = (contract.examples ?? []).find((e) => e.intent === intent);
          if (!example) {
            response.writeHead(400, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: `contract has no example for intent '${intent}' — fake mode needs one` }));
            return;
          }
          adapter = new ScriptedAdapter([{ output: violating }, { output: example.surface }]);
        } else if (typeof body.model === "string") {
          adapter = adapterFor(body.model);
        } else {
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
            intent,
            prompt: body.prompt ?? "a screen to delete my account",
            adapter,
            maxRepairs: body.maxRepairs,
            compile: { omitRuleSteering: noSteering },
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
    const address = server.address();
    const actual = typeof address === "object" && address ? address.port : port;
    console.error(`dspack-gen serve: http://127.0.0.1:${actual} (contract: ${contract.name})`);
  });
  return server;
}
