#!/usr/bin/env python3
"""Strict verifier for the cross-family projection-gap signature count (78/78).

Signature (corrected precondition, per the findings correction note): outcome
failed-gate, A3 failed with a missing triggerLabel/child error, and a trigger
exists whose label is UNPROJECTABLE by the pre-amendment subButtonText
projection — i.e. NO button descendant carries direct text. A trigger's own
text does NOT count as projectable (the pre-amendment projection never
consumed it; the 7 multi-trigger own-text cases are therefore signature).

Run: python3 docs/evidence/verify-signature-78.py
"""
import collections, glob, json

def triggers(root):
    out = []
    def walk(n):
        if n.get("component") == "alert-dialog-trigger": out.append(n)
        for c in n.get("children", []): walk(c)
        for s in n.get("slots", {}).values():
            for c in (s if isinstance(s, list) else [s]): walk(c)
    walk(root); return out

def labeled_button(n):
    for c in n.get("children", []):
        if c.get("component") == "button" and c.get("text"): return True
        if labeled_button(c): return True
    return False

total = collections.Counter()
for name, pat in [
    ("two-family", "docs/evidence/2026-07-03-eval-rerun/reports/ollama-*.audit-report.json"),
    ("gpt-oss-E0", "docs/evidence/2026-07-03-gptoss-third-family/reports/*.audit-report.json"),
]:
    buckets = collections.Counter()
    for f in sorted(glob.glob(pat)):
        with open(f) as fp:
            r = json.load(fp)
        if r["outcome"] != "failed-gate": continue
        errs = [e for v in (r.get("emitted") or {}).get("validations", [])
                for g in v.get("gates", []) if g.get("gate") == "A3" and not g.get("pass")
                for e in (g.get("errors") or [])]
        if (r.get("emitted") or {}).get("refusal"): buckets["refusal"] += 1; continue
        final = [a for a in r["attempts"] if a.get("surface")][-1]["surface"]
        trigs = triggers(final["root"])
        label_err = any("triggerLabel" in e or "child" in e for e in errs)
        if trigs and label_err and not any(labeled_button(t) for t in trigs):
            buckets["signature"] += 1
        elif not trigs:
            buckets["no-trigger"] += 1
        else:
            buckets["other"] += 1
    print(f"{name}: {dict(buckets)}")
    total += buckets
print(f"TOTAL: {dict(total)}  (claim: signature == 78, everything else == 0)")
assert total["signature"] == 78 and total["no-trigger"] == 0 and total["other"] == 0 and total["refusal"] == 0
print("VERIFIED: 78/78")
