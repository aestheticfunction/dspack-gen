#!/usr/bin/env python3
"""Decompose rule.trigger-carries-label first-attempt violations into the two
buckets the findings addendum reports:

- genuinely-unprojectable: no trigger in the surface carries a projectable
  label (neither direct trigger text nor any button descendant with direct
  text) — the measured v0.3 gap class (A3 would have refused the emission).
- projectable-but-stricter: every trigger has a projectable label bearer, but
  the rule's per-node (for-every-button) semantics flag textless sibling
  buttons — surfaces A3 would have ACCEPTED at v0.3.

Run from the repo root against an evidence dir:
  python3 docs/evidence/2026-07-04-v04-effect/decompose-trigger-label.py \
    docs/evidence/2026-07-04-v04-effect/reports
"""
import collections
import glob
import json
import sys

reports_dir = sys.argv[1] if len(sys.argv) > 1 else "docs/evidence/2026-07-04-v04-effect/reports"


def triggers(root):
    found = []

    def walk(n):
        if n.get("component") == "alert-dialog-trigger":
            found.append(n)
        for c in n.get("children", []):
            walk(c)
        for s in n.get("slots", {}).values():
            for c in s if isinstance(s, list) else [s]:
                walk(c)

    walk(root)
    return found


def projectable(trig):
    """A3-projectable label bearer: the trigger's own direct text, or at
    least one button descendant carrying direct text (the emitter's
    subButtonText projection)."""
    if trig.get("text"):
        return True

    def any_labeled_button(n):
        for c in n.get("children", []):
            if c.get("component") == "button" and c.get("text"):
                return True
            if any_labeled_button(c):
                return True
        return False

    return any_labeled_button(trig)


buckets = collections.Counter()
per_model = collections.defaultdict(collections.Counter)
for path in sorted(glob.glob(f"{reports_dir}/*audit-report.json")):
    report = json.load(open(path))
    model = path.split("/")[-1].split("--")[0]
    first = report["attempts"][0]
    if not first.get("surface"):
        continue
    flagged = [f for f in first.get("findings", []) if f["ruleId"] == "rule.trigger-carries-label"]
    if not flagged:
        continue
    trigs = triggers(first["surface"]["root"])
    bucket = (
        "projectable-but-stricter"
        if trigs and all(projectable(t) for t in trigs)
        else "genuinely-unprojectable"
    )
    buckets[bucket] += 1
    per_model[model][bucket] += 1

print("first-attempt runs with a rule.trigger-carries-label finding, bucketed:")
for k, v in sorted(buckets.items()):
    print(f"  {k}: {v}")
for m in sorted(per_model):
    print(f"  {m}: {dict(per_model[m])}")
