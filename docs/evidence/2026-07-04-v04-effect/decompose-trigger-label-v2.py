#!/usr/bin/env python3
"""CORRECTED decomposition (v2) of rule.trigger-carries-label first-attempt
violations — three buckets (supersedes decompose-trigger-label.py, whose
'projectable' definition wrongly counted a trigger's own text as consumable
by the pre-amendment projection; see the findings correction note):

- projectable-today (labeled button): at least one button descendant carries
  direct text — the pre-amendment subButtonText projection succeeds; A3
  would have ACCEPTED the emission (the rule's ∀-semantics flagged a
  textless sibling).
- liftable (text exists, not on a button): label text exists under the
  trigger but no labeled button — recoverable by the audited emitter lift
  (dspack-emit#14), unprojectable before it.
- unmappable (no text anywhere): no label text under any trigger — the
  irreducible governance class; only generation/repair can fix these.

Run from the repo root against an evidence dir:
  python3 docs/evidence/2026-07-04-v04-effect/decompose-trigger-label-v2.py \
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
    """A3-projectable label bearer under the PRE-AMENDMENT emitter: at least
    one button descendant carrying direct text (the subButtonText
    projection). CORRECTION vs decompose-trigger-label.py: the trigger's own
    text is NOT consumed by the pre-amendment projection — v1 of this script
    over-counted 'projectable' by 6 runs (73 -> 67); a third bucket separates
    liftable misplaced text (20) from no-text-anywhere (117)."""

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
    def any_text(n):
        if n.get("text"):
            return True
        return any(any_text(c) for c in n.get("children", []))

    if trigs and all(projectable(t) for t in trigs):
        bucket = "projectable-today (labeled button)"
    elif trigs and all(any_text(t) for t in trigs):
        bucket = "liftable (text exists, not on a button)"
    else:
        bucket = "unmappable (no text anywhere)"
    buckets[bucket] += 1
    per_model[model][bucket] += 1

print("first-attempt runs with a rule.trigger-carries-label finding, bucketed:")
for k, v in sorted(buckets.items()):
    print(f"  {k}: {v}")
for m in sorted(per_model):
    print(f"  {m}: {dict(per_model[m])}")
