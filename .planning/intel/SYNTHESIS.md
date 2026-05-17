# Synthesis Summary

Entry point for downstream consumers (`gsd-roadmapper`). Generated 2026-05-17 from 3 classified documents.

Project: **gestione-affitti** — single-file Alpine.js + Tailwind + Supabase PWA for family-tier rental property management (1-3 users).

---

## Inputs consumed

| Type | Count | Source paths |
|------|-------|--------------|
| ADR  | 1 | `docs/ingest/ADR-ceo-plan.md` (LOCKED, precedence 0) |
| PRD  | 1 | `docs/ingest/PRD-design-pwa.md` (precedence 2) |
| SPEC | 1 | `docs/ingest/SPEC-test-plan.md` (precedence 1) |
| DOC  | 0 | — |

All 3 high-confidence, manifest-override=true. No UNKNOWN-confidence classifications.

---

## Synthesized output

### Decisions — 23 LOCKED

Source: `.planning/intel/decisions.md`

All 23 sourced from the single LOCKED ADR. Coverage:
- PR sequencing & boundary decisions (DEC-001, DEC-004, DEC-019, DEC-020)
- Approach selection (DEC-002)
- Stack & deployment lock (DEC-003)
- Schema/entity decisions (DEC-005, DEC-007, DEC-008, DEC-012)
- Feature scope decisions (DEC-006, DEC-009, DEC-010, DEC-011)
- Architecture decisions (DEC-013, DEC-014, DEC-015, DEC-016, DEC-021)
- Sizing/quota decisions (DEC-017, DEC-018, DEC-023)
- Scope boundary (DEC-022 — NOT-in-scope list)

### Requirements — 22 extracted

Source: `.planning/intel/requirements.md`

Bucketed by PR per DEC-001 LOCKED sequence (`PR5 → PR0 → PR1 → PR2a → PR2b → PR3 → PR4`):

| PR | Count | Requirements |
|----|-------|--------------|
| PR5 | 1 | REQ-playwright-ci |
| PR0 | 1 | REQ-pr0-redesign |
| PR1 | 6 | REQ-data-safety-soft-delete, REQ-cestino-view, REQ-snapshot-history, REQ-undo-toast, REQ-salute-dati, REQ-importo-zero-validation |
| PR2a | 3 | REQ-pwa-manifest, REQ-service-worker, REQ-install-prompt-custom |
| PR2b | 6 | REQ-mutation-queue, REQ-schema-migration-per-entity, REQ-conflict-resolution-per-entity, REQ-inquilini-entity, REQ-tipi-utenza-dinamici, REQ-scadenze-custom |
| PR3 | 3 | REQ-notifiche-locali-utenze, REQ-foto-utenze-storage, REQ-pdf-ricevute, REQ-export-730 |
| PR4 | 2 | REQ-statistiche-annuali, REQ-ocr-bollette |

(REQ-salute-dati spans PR1 + PR2b extension; REQ-export-730 listed in PR3 bucket.)

### Constraints — 20

Source: `.planning/intel/constraints.md`

Breakdown by type:
- **nfr**: 12 (CON-001 single-file, CON-002 stack, CON-003 free-tier, CON-004 italian, CON-005 mobile-first, CON-006 family-tier, CON-011 iOS, CON-012 lazy-load, CON-016 query batching, CON-017 regression-lock, CON-018 critical-paths, CON-019 edge-cases, CON-020 estimation)
- **schema**: 1 (CON-007 Supabase per-entity schema)
- **protocol**: 3 (CON-008 mutation queue, CON-009 migration safety, CON-010 SW contract, CON-015 photo pipeline)
- **api-contract** (UI-layer): 2 (CON-013 OCR-as-suggestion, CON-014 global conflict UI)

LOCKED regression suite: 5 mandatory Playwright tests (CON-017), non-removable without superseding ADR.

### Context — 11 topics

Source: `.planning/intel/context.md`

Topics: project identity, user personas, problem statement, success criteria, 10× annotated direction, risk register (R1-R6), error & rescue catalog, observability stack, long-term trajectory, reviewer concerns, process pointers, design handoff reference, GSTACK review status.

---

## Conflicts

Source: `.planning/INGEST-CONFLICTS.md`

| Bucket | Count |
|--------|-------|
| BLOCKERS | 0 |
| WARNINGS | 0 |
| INFO     | 4 (all auto-resolved via precedence; ADR explicitly supersedes PRD design doc) |

---

## STATUS: READY

Safe to route to `gsd-roadmapper` for PROJECT.md / REQUIREMENTS.md / ROADMAP.md generation.

Notable downstream signals:
- PR sequence is LOCKED; roadmapper should NOT re-order without an explicit superseding ADR.
- 22 requirements map cleanly to 7 PRs.
- Family-tier sizing constraint (CON-006) governs all decision points — over-engineering is a regression.
- PR5 ships first; first work item is Playwright setup + 5 LOCKED regression tests (CON-017).
