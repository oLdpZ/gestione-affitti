# Context

Project background, personas, problem statement, success criteria, and notes that inform planning but are not themselves decisions, requirements, or constraints.

---

## Topic: Project identity

- source: docs/ingest/PRD-design-pwa.md, docs/ingest/ADR-ceo-plan.md
- Project: `gestione-affitti`
- Repo: `oldpz/gestione-affitti`, local path `C:\Users\old_p\Documents\progetto ap Stefano\progetto app Stefano`
- Branch: master (deploys to GitHub Pages on push)
- Mode: Builder (family-grade), SELECTIVE_EXPANSION
- Date of synthesis input: 2026-05-17

## Topic: User personas

- source: docs/ingest/PRD-design-pwa.md
- Primary user: the owner's brother. Uses the app from his phone, in motion, while collecting rents and checking utility bills. Has limited patience for friction. Already lost 2 apartments from the calendar to a silent bug (importo=0).
- Secondary user: the owner himself, primarily as maintainer.
- Total user count target: 1-3 trusted family-tier users.

## Topic: Problem statement

- source: docs/ingest/PRD-design-pwa.md
- Two structural problems with the current app:
  1. **Affidabilità sotto la media** — last-writer-wins on a JSON blob; silent failures; no cestino, no undo, no snapshot. The user lost 2 properties from his calendar to a `importo=0` bug and only discovered it by accident.
  2. **Workflow incompleto** — the user still relies on WhatsApp for receipts, phone gallery for utility bill photos, and a paper agenda for due-date tracking. The app does not close the loop on the three things it should already do.

## Topic: Success criteria (PRD-level)

- source: docs/ingest/PRD-design-pwa.md
- Zero silent data loss; every delete recoverable for 30 days; every state restorable from last 10 snapshots
- Lighthouse PWA score ≥ 90 on mobile
- Offline write works: airplane mode → 3 incassi → online → automatic sync verified
- Per-entity conflicts: same proprietà on 2 offline devices → conflict toast on sync → no data loss
- Notifications delivered at the expected moment
- PDF receipt: valid, openable, A4 portrait, complete fields
- **Real success criterion**: the brother stops using WhatsApp for receipts, phone gallery for bills, paper agenda for due dates

## Topic: 10× direction (annotated, NOT in scope)

- source: docs/ingest/ADR-ceo-plan.md (Vision)
- A future direction (12-month horizon, explicitly out of current scope):
  - OCR bollette taken solo by the brother
  - Proactive notifications
  - Auto-send receipts via WhatsApp Business API
  - Market-trend rent-raise suggestions based on OMI data
- Recorded so future planning sessions know which doors stay open.

## Topic: Risk register

- source: docs/ingest/ADR-ceo-plan.md (Risk Register section)
- R1 — Schema migration breaks existing data. Likelihood Med / Impact High. Mitigation: idempotent script, pre-migration backup, localStorage feature flag rollback. → DEC-012
- R2 — Service worker cache stale after deploy. Likelihood High / Impact Med. Mitigation: SW versioning, `activate` cleanup, `skipWaiting()`. → CON-010
- R3 — OCR italiano impreciso, user mistrust. Likelihood Med / Impact Med. Mitigation: manual fallback always, OCR is suggestion only. → DEC-009, CON-013, REQ-ocr-bollette pre-ship validation gate
- R4 — Mutation queue corrupts state in conflict scenarios. Likelihood Low / Impact High. Mitigation: E2E multi-device tests; UI shows queue + manual flush button.
- R5 — jsPDF + Chart.js + Tesseract.js bloat the bundle. Likelihood Med / Impact Low. Mitigation: lazy-load all three. → CON-012
- R6 — Supabase Storage free tier fills up. Likelihood Low / Impact Med. Mitigation: aggressive resize 1600px ~150KB; warning at 80%. → CON-015, DEC-017

## Topic: Error & rescue catalog

- source: docs/ingest/ADR-ceo-plan.md (Section 2)
- Codepath / Failure / Rescue / User-visible:
  - Mutation queue flush, Network 500 → retry 3× backoff, stay in queue, toast "1 modifica in coda, riprovo fra 30s"
  - Mutation queue flush, 409 conflict → fetch remote, choose-UI, toast 3 buttons
  - Mutation queue flush, auth expired → refresh session via Supabase, retry transparently
  - Schema migration partial fail → Supabase transaction + rollback + emergency JSON export modal
  - OCR illegible → empty result, manual form still opens, toast "OCR non riuscito"
  - Notification permission denied → disable feature, banner once
  - Storage upload quota exceeded → re-compress, retry, fallback base64 + modal "Storage pieno"
  - PDF gen, jsPDF CDN unreachable → lazy retry once, then toast

## Topic: Observability stack (family-tier appropriate)

- source: docs/ingest/ADR-ceo-plan.md (Section 8)
- Pagina "Salute dati" extended with mutation queue state, sync state, storage usage
- Console structured logs in `sw.js`, viewable via remote debugging
- `window.addEventListener('error')` pushes to `localStorage.errori[]` (last 50)
- "Invia diagnostica" button opens WhatsApp with clipboard dump

## Topic: Long-term trajectory notes

- source: docs/ingest/ADR-ceo-plan.md (Section 10)
- Reversibility: 3/5. PR2b is the point of no return for schema. Everything else is additive and revertible.
- Tech debt introduced: separate sw.js to maintain; dual-schema during 2-week rollout window; 4 new CDN libraries (jsPDF, Chart.js, Tesseract.js, idb-keyval) pinned but SPOF if CDNs drop (mitigated by aggressive SW cache).
- Path dependency: post-PR2b, every new data-touching feature MUST use per-entity schema. No going back.
- Knowledge concentration: project state lives in owner's head + design doc + CEO plan. Single-file commented code is the maintenance documentation.

## Topic: Reviewer concerns to revisit

- source: docs/ingest/ADR-ceo-plan.md (Reviewer Concerns, Rejected eng concerns)
- OCR <50% success rate would make feature annoying → real-world validation gate before PR4 closes
- 3-4 sessions estimate likely optimistic; plan 5-6 → CON-020
- iOS Safari notifications require "Aggiungi a Home" → document in TUTORIAL.md
- Rejected eng concerns (revisit if symptoms appear): field-level merge for conflicts; 4-week dual-write; 1200px photo compression; IndexedDB write debounce.

## Topic: Process pointers

- source: docs/ingest/ADR-ceo-plan.md (Next Steps), docs/ingest/PRD-design-pwa.md (Assignment, Next Steps)
- "Assignment" from PRD: spend 15 minutes observing the brother use the app in motion BEFORE writing PR1 code. Watch taps, tap-misses, hand occupation, before/after app context. PR3 priorities will shift based on observation.
- Implementation entry point: PR5 (Playwright + 3 regression tests) ships first per DEC-001.
- Wiki of "second brain" should be updated after each shipped PR.

## Topic: Design handoff reference

- source: docs/ingest/ADR-ceo-plan.md (PR0 decisions)
- Handoff ID: `sbPqzZsV396NsMp4jSK5eQ`
- Stored in `.design-ref/` of repo (gitignored)
- Drives PR0 design tokens, palette, typography, mesh background

## Topic: GSTACK review status

- source: docs/ingest/ADR-ceo-plan.md (GSTACK REVIEW REPORT)
- CEO Review: CLEAR (PLAN). 8/8 cherry-picks accepted.
- Eng Review: CLEAR (PLAN). 8/8 issues accepted, 0 critical gaps remaining.
- Design Review: not run
- Codex Review: not run (single-dev family tool)
- DX Review: not applicable (no API/SDK surface)
- Verdict: CEO + ENG CLEARED — ready to implement, start with PR5.
