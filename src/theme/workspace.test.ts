/**
 * The workspace layer (./theme, workspace.mjs): status colours, density, text scale, label case, display and a
 * canvas surround, compiled from one proposal. It adds to the compiler's output and never changes it.
 */
import { describe, expect, it } from "vitest";
import { grid } from "./fixtures/parity-grid.mjs";
import { COMPILER_VERSION, compileProposal, compileWorkspace, contrastRatio, DEFAULT_WORKSPACE, SURROUND, TEXT_RATIO, WORKSPACE_OPTIONS, WORKSPACE_VERSION, workspaceOptionIssues } from "./index.mjs";

const proposals = grid().map((g: { proposal: unknown }) => g.proposal);

describe("the workspace layer", () => {
  it("adds tokens and never changes one the compiler produced, in either scheme", () => {
    for (const proposal of proposals) {
      for (const scheme of ["dark", "light"] as const) {
        const base = compileProposal({ proposal, scheme, contract: { tokens: {} } });
        const ws = compileWorkspace({ proposal, scheme });
        expect(ws.ok).toBe(base.ok);
        if (!base.ok || !ws.ok) continue;
        for (const [k, v] of Object.entries(base.tokens)) expect(ws.tokens[k], k).toBe(v);
        expect(ws.compilerVersion).toBe(COMPILER_VERSION);
        expect(ws.workspaceVersion).toBe(WORKSPACE_VERSION);
      }
    }
  });

  it("every status colour and the link read at the text ratio on every surface", () => {
    for (const proposal of proposals) {
      for (const scheme of ["dark", "light"] as const) {
        const ws = compileWorkspace({ proposal, scheme });
        if (!ws.ok) continue;
        for (const role of ["success", "warning", "error", "info", "link"])
          for (const surface of ["surface.bg", "surface.bg-1", "surface.bg-2"]) expect(contrastRatio(ws.tokens[`status.${role}`]!, ws.tokens[surface]!)!, `${scheme} ${role} on ${surface}`).toBeGreaterThanOrEqual(TEXT_RATIO);
        expect(ws.constraints.filter((c) => c.disposition === "failed")).toEqual([]);
      }
    }
  });

  it("the choices map to closed values; defaults apply when a choice is left out", () => {
    const p = proposals[4];
    const d = compileWorkspace({ proposal: p });
    expect(d.ok && d.options).toEqual(DEFAULT_WORKSPACE);
    expect(d.ok && [d.tokens["space.scale"], d.tokens["type.scale"], d.tokens["label.transform"], d.tokens["surround.bg"]]).toEqual(["1", "1", "none", d.ok ? d.tokens["surface.bg"] : null]);
    const c = compileWorkspace({ proposal: p, scheme: "light", options: { density: "compact", textScale: "large", labelCase: "capitals", display: "plain", surround: "dark" } });
    expect(c.ok && [c.tokens["space.scale"], c.tokens["type.scale"], c.tokens["label.transform"], c.tokens["label.tracking"], c.tokens["type.workspace-display"], c.tokens["surround.bg"]]).toEqual(["0.8", "1.125", "uppercase", "0.06em", "plain", SURROUND.dark]);
    for (const [key, values] of Object.entries(WORKSPACE_OPTIONS)) for (const v of values) expect(compileWorkspace({ proposal: p, options: { [key]: v } }).ok, `${key}=${v}`).toBe(true);
  });

  it("is fail-closed: an unknown choice or a rejected proposal compiles to nothing", () => {
    expect(workspaceOptionIssues({ density: "airy" })).toEqual(["workspace option density must be one of comfortable, compact"]);
    expect(workspaceOptionIssues({ colour: "#fff" })).toEqual(['unknown workspace option "colour"']);
    expect(compileWorkspace({ proposal: proposals[0], options: { density: "airy" } as never })).toMatchObject({ ok: false, tokens: null });
    expect(compileWorkspace({ proposal: { directionVersion: "2" } })).toMatchObject({ ok: false, tokens: null });
  });

  it("is deterministic", () => {
    expect(JSON.stringify(compileWorkspace({ proposal: proposals[9], scheme: "light" }))).toBe(JSON.stringify(compileWorkspace({ proposal: proposals[9], scheme: "light" })));
  });
});
