## Conflict Detection Report

Synthesized 2026-05-17 from 3 classified documents (1 ADR, 1 PRD, 1 SPEC). Mode: new (fresh bootstrap, no existing CONTEXT.md to reconcile against).

Precedence applied: ADR > SPEC > PRD > DOC (default). Per-doc overrides: ADR precedence=0 (locked), SPEC=1, PRD=2.

---

### BLOCKERS (0)

None.

No LOCKED-vs-LOCKED ADR contradictions found (only one ADR in the ingest set).
No UNKNOWN-confidence-low classifications (all three docs are high-confidence with manifest_override=true).
No reference-graph cycles detected (cross_refs point to external wiki anchors and slash-commands, not back into the ingest set).
No existing locked CONTEXT.md decisions to contradict (fresh bootstrap).

---

### WARNINGS (0)

None.

No competing acceptance-criteria variants. Only one PRD in the ingest set; its requirements have a single acceptance specification per requirement. The PRD's three originally-proposed PRs (PR1/PR2/PR3) were re-segmented by the ADR into PR1/PR2a/PR2b/PR3/PR4/PR5/PR0 — this is an explicit supersession recorded in the ADR frontmatter (`supersedes_design: gestione-affitti-design-pwa-20260517.md`), not a competing variant.

---

### INFO (4)

[INFO] ADR supersedes PRD design doc (explicit, not a conflict)
  source: docs/ingest/ADR-ceo-plan.md frontmatter `supersedes_design: gestione-affitti-design-pwa-20260517.md`
  Note: The CEO plan ADR explicitly supersedes the PRD design document. Per precedence (ADR=0 > PRD=2) the ADR wins on every overlapping decision. The PRD remains the canonical source for vision, user personas, problem statement, and success criteria — these were not overridden by the ADR. Synthesized intel reflects this: decisions.md sources from the ADR, requirements.md sources from the PRD's user-facing goals annotated with ADR refinements, context.md preserves PRD personas/problem framing verbatim.

[INFO] Auto-resolved: ADR > PRD on PR boundary segmentation
  Found: docs/ingest/PRD-design-pwa.md proposed 3 PRs (PR1 data safety, PR2 PWA+sync combined, PR3 features)
  Found: docs/ingest/ADR-ceo-plan.md split into PR0/PR1/PR2a/PR2b/PR3/PR4/PR5
  Resolution: ADR wins per precedence — schema migration (PR2b) isolated from PWA shell (PR2a) for de-risking; PR0 (Apple redesign) and PR5 (Playwright) added as cherry-picks 1 and 8.
  Captured as DEC-001, DEC-004 in decisions.md.

[INFO] Auto-resolved: ADR > PRD on Inquilini scope (resolves PRD open question)
  Found: docs/ingest/PRD-design-pwa.md Open Question #1 — "Inquilini come entità separata? PR3 o successivo?"
  Found: docs/ingest/ADR-ceo-plan.md cherry-pick #2 — Inquilini accepted as PR2b entity (required for valid PDF receipts)
  Resolution: ADR resolves the open question by promoting Inquilini into PR2b as a first-class entity with fields nome/codice_fiscale/telefono/email/proprieta_id.
  Captured as DEC-005, REQ-inquilini-entity.

[INFO] Auto-resolved: ADR > PRD on icon sourcing (resolves PRD open question)
  Found: docs/ingest/PRD-design-pwa.md Open Question #4 — "Icone PWA: chi le disegna?"
  Resolution: PRD self-resolved with suggestion (favicon.io from emoji 🏠 + gradient); ADR did not override, so the PRD recommendation stands.
  Captured in REQ-pwa-manifest acceptance criteria.

---

## Reference-graph traversal

Built directed graph from `cross_refs` of all 3 classifications. Traversal depth: max 2. No cycles.

Edges observed (all leave the ingest set):
- ADR-ceo-plan → gestione-affitti-design-pwa-20260517.md (= PRD-design-pwa.md, intra-set, terminal)
- ADR-ceo-plan → gestione-affitti-test-plan-20260517.md (= SPEC-test-plan.md, intra-set, terminal)
- ADR-ceo-plan → TUTORIAL.md, TODOS.md, .design-ref/ (external)
- PRD-design-pwa → `gestione-affitti` (project anchor, external)
- SPEC-test-plan → /plan-eng-review, /qa, /qa-only (slash-commands, external)

DFS completed cleanly.

---

## Summary

- BLOCKERS: 0
- WARNINGS: 0
- INFO: 4 (all auto-resolved via precedence)

STATUS: READY — safe to route to gsd-roadmapper.
