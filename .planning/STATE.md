# STATE: gestione-affitti

## Project Reference

- **Project**: gestione-affitti — family-tier rental management PWA
- **Repo**: https://github.com/oLdpZ/gestione-affitti (master @ 5cf701f)
- **Deploy**: https://oldpz.github.io/gestione-affitti/
- **Local path**: `C:\Users\old_p\Documents\progetto ap Stefano\progetto app Stefano`
- **Primary user**: il fratello dell'utente (single-user app, IT locale)
- **Core value**: Zero silent data loss + close the workflow loop (no more WhatsApp / phone gallery / paper agenda)
- **Current focus**: Phase 1 — PR5 Playwright safety net before any feature work

## Current Position

- **Active phase**: Phase 1 — PR5 Test infrastructure
- **Active plan**: TBD (next: `/gsd-plan-phase 1`)
- **Status**: Roadmap approved, planning the first phase
- **Progress**: [█░░░░░░] 0/7 phases complete

## Performance Metrics

- Requirements: 24 mapped / 24 total (100% coverage)
- LOCKED decisions: 23 (all preserved as PROJECT.md `<decisions>` blocks)
- LOCKED regression tests: 5 (CON-017, gating from Phase 1 onward)
- Realistic session estimate: 5-6 sessions (CON-020)

## Accumulated Context

### Locked decisions (do NOT auto-override)
PR sequence DEC-001, Approach B DEC-002, Stack DEC-003, PR2 split DEC-004, Inquilini entity DEC-005, 730 export DEC-006, tipi_utenza dinamici DEC-007, scadenzaGiorno DEC-008, OCR suggestion-only DEC-009, Chart.js DEC-010, Playwright CI DEC-011, dual-write migration DEC-012, FK-topo flush DEC-013, iOS Background Sync DEC-014, lazy-load DEC-015, binary conflict choose DEC-016, foto 1600px DEC-017, 2-week dual-write DEC-018, PR0 design DEC-019, PR1 bugfix bundle DEC-020, RPC batching DEC-021, NOT-in-scope DEC-022, family-tier DEC-023.

### Open todos (carry forward)
- Spend 15 minutes observing the brother use the app in motion BEFORE writing PR1 code (PRD Assignment). PR3 priorities may shift after observation.
- Generate PWA icons (1024 + 512 + 192) via favicon.io from emoji 🏠 + gradient before Phase 4 closes
- Pre-Phase-7 gate: collect 10 real bollette from end-user for OCR validation
- TUTORIAL.md must document "Aggiungi a Home" requirement for iOS notifications (DEC-014, CON-011)
- After every shipped PR: update wiki second-brain (process pointer)

### Blockers
None.

### Risks under watch
- R1 schema migration (Phase 5) — Med/High — DEC-012 mitigation in place
- R2 SW cache stale (Phase 4) — High/Med — CON-010 mitigation
- R3 OCR Italian reliability (Phase 7) — Med/Med — manual fallback + 10-bolletta validation gate
- R5 Bundle bloat — Med/Low — CON-012 lazy-load enforced
- R6 Storage 1GB fill — Low/Med — 1600px resize + 80% warning

## Session Continuity

- **Last action**: Roadmap created from intel synthesis (2026-05-17)
- **Next action**: `/gsd-plan-phase 1` to plan Phase 1 (PR5 Test infrastructure)
- **Files just written**:
  - `.planning/PROJECT.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/ROADMAP.md`
  - `.planning/STATE.md`
- **Files referenced (do not re-derive)**:
  - `.planning/intel/SYNTHESIS.md`
  - `.planning/intel/decisions.md` (23 LOCKED)
  - `.planning/intel/requirements.md` (22 source reqs)
  - `.planning/intel/constraints.md` (20 constraints)
  - `.planning/intel/context.md` (11 topics)
- **Linked external context**: `wiki/projects/gestione-affitti-RESUME.md` (per user memory)
