/**
 * Surface-tree traversal shared by S2 and S3. Paths use the `$.root…` JSONPath
 * style that findings, the emitter, and the spec's worked failures all share.
 * "Descendants" (spec §5.3) = everything reachable through `children` and
 * `slots`, at any depth.
 */
import type { Surface, SurfaceNode } from "../contract.js";

export interface VisitedNode {
  node: SurfaceNode;
  path: string;
}

export function walkSurface(surface: Surface): VisitedNode[] {
  const visited: VisitedNode[] = [];
  const visit = (node: SurfaceNode, path: string): void => {
    visited.push({ node, path });
    (node.children ?? []).forEach((child, i) => visit(child, `${path}.children[${i}]`));
    for (const slot of Object.keys(node.slots ?? {}).sort()) {
      node.slots![slot].forEach((child, i) => visit(child, `${path}.slots.${slot}[${i}]`));
    }
  };
  visit(surface.root, "$.root");
  return visited;
}

/** Descendants of `origin` (excluding itself), with absolute paths. */
export function descendantsOf(origin: VisitedNode): VisitedNode[] {
  const visited: VisitedNode[] = [];
  const visit = (node: SurfaceNode, path: string): void => {
    (node.children ?? []).forEach((child, i) => {
      visited.push({ node: child, path: `${path}.children[${i}]` });
      visit(child, `${path}.children[${i}]`);
    });
    for (const slot of Object.keys(node.slots ?? {}).sort()) {
      node.slots![slot].forEach((child, i) => {
        visited.push({ node: child, path: `${path}.slots.${slot}[${i}]` });
        visit(child, `${path}.slots.${slot}[${i}]`);
      });
    }
  };
  visit(origin.node, origin.path);
  return visited;
}
