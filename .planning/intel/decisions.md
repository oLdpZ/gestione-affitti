# Decisions

Synthesized from ADRs in the ingest set. Decisions marked LOCKED cannot be auto-overridden.

---

## DEC-001 — PR sequence: PR5 → PR0 → PR1 → PR2a → PR2b → PR3 → PR4

- source: docs/ingest/ADR-ceo-plan.md
- status: LOCKED (Accepted, CEO + Eng review cleared)
- scope: implementation ordering, gestione-affitti
- decision: Ship in this order. PR5 (Playwright + 3 regression tests) goes first so PR1+ have a safety net. PR0 (Apple/Sonoma redesign) lands second so all subsequent PRs build on the new skin. PR1 (data safety) before PR2a (PWA shell) before PR2b (schema migration) — cestino/snapshot must work before schema migration runs, because they are the migration's safety net.
- rationale: Reverses the original "PR1 senza tests" gap and de-risks the schema migration by ensuring the safety net is verified in production first.

## DEC-002 — Approach B selected (PWA seria + feature core)

- source: docs/ingest/ADR-ceo-plan.md (confirms PRD-design-pwa selection)
- status: LOCKED (Accepted)
- scope: overall architectural approach
- decision: Build a real PWA (installable + offline writes + per-entity sync), not a facade. Reject Approach A (data safety only) and Approach C (CRDT/Dexie/ES modules rifondazione).
- rationale: Family-tier 1-3 users justifies more than A but does not justify C's over-engineering.

## DEC-003 — Stack lock: Alpine + Tailwind CDN + Supabase, single-file HTML, no build step

- source: docs/ingest/ADR-ceo-plan.md
- status: LOCKED (Accepted)
- scope: tech stack, all PRs
- decision: Preserve single-file `index.html`. No migration to ES modules, no bundler, no framework swap. Allowed additions: jsPDF, Chart.js, Tesseract.js, idb-keyval, all via CDN, all lazy-loaded except idb-keyval.
- rationale: Deploy stays `git push` to GitHub Pages. Family-tier maintenance constraint. ES6 module migration explicitly rejected in NOT-in-scope.

## DEC-004 — Split PR2 into PR2a (PWA shell) + PR2b (schema migration)

- source: docs/ingest/ADR-ceo-plan.md (cherry-pick #1)
- status: LOCKED (Accepted)
- scope: PR boundaries
- decision: De-risk by isolating schema migration from service worker rollout.
- rationale: Two independent failure modes; failing one shouldn't gate the other.

## DEC-005 — Inquilini as first-class entity

- source: docs/ingest/ADR-ceo-plan.md (cherry-pick #2)
- status: LOCKED (Accepted)
- scope: PR2b
- decision: New table `inquilini (nome, codice_fiscale, telefono, email opz, proprieta_id)`. Required for valid PDF receipts (beneficiary).
- rationale: Resolves PRD-design-pwa Open Question #1.

## DEC-006 — Export CSV/PDF 730 for commercialista

- source: docs/ingest/ADR-ceo-plan.md (cherry-pick #3)
- status: LOCKED (Accepted)
- scope: PR3
- decision: Annual summary per property formatted for 730 quadro RB.
- rationale: High real-world value (1×/year ritual).

## DEC-007 — Tipi utenza as user-scoped dynamic table

- source: docs/ingest/ADR-ceo-plan.md (cherry-pick #4)
- status: LOCKED (Accepted)
- scope: PR2b
- decision: Table `tipi_utenza (user_id, nome)`. CRUD form in Impostazioni. Removes hardcoded enum.

## DEC-008 — Scadenze custom per proprietà

- source: docs/ingest/ADR-ceo-plan.md (cherry-pick #5)
- status: LOCKED (Accepted)
- scope: PR2b
- decision: Field `scadenzaGiorno: 1-31 | 'fine_mese'` on proprietà. Calendar groups intelligently by day.

## DEC-009 — OCR bollette via Tesseract.js, lazy-loaded, with manual fallback

- source: docs/ingest/ADR-ceo-plan.md (cherry-pick #6)
- status: LOCKED (Accepted)
- scope: PR4
- decision: Tesseract.js lazy-loaded on first "Scatta foto bolletta" click. Regex extracts importo (`\d+[,.]\d{2}\s*€?`) and scadenza (`\d{2}/\d{2}/\d{4}`). Always presents as pre-filled suggestions, never auto-saves. Manual form is always available as fallback.
- rationale: OCR Italian reliability uncertain (R3). Manual fallback de-risks user trust.

## DEC-010 — Statistiche annuali via Chart.js CDN, lazy-loaded

- source: docs/ingest/ADR-ceo-plan.md (cherry-pick #7)
- status: LOCKED (Accepted)
- scope: PR4
- decision: Line chart incassi/mese × anno, bar chart utenze/proprietà, donut yield (incassi − utenze)/incassi. Empty state when 0 data.

## DEC-011 — Playwright E2E in GitHub Actions CI

- source: docs/ingest/ADR-ceo-plan.md (cherry-pick #8)
- status: LOCKED (Accepted)
- scope: PR5
- decision: Playwright suite covers login, crea proprietà, segna incasso, elimina + ripristina cestino, offline write + sync. Push-trigger on master, fail blocks deploy. Manual on feature branches initially.

## DEC-012 — Schema migration: dual-write window with rollback flag

- source: docs/ingest/ADR-ceo-plan.md (PR2b deployment & rollout section)
- status: LOCKED (Accepted)
- scope: PR2b
- decision: Three-phase rollout:
  - Phase 1: deploy code that reads from BOTH legacy blob and per-entity tables
  - Phase 2: trigger one-shot idempotent migration at next user login (only if `dati_utente.blob_json` non-null AND new tables empty)
  - Phase 3: after 2 weeks of verified stability, remove blob fallback
  - Rollback: `localStorage.usaNuovoSchema = false` per-instance feature flag
- rationale: Resolves PR1 critical gap (no rollback plan for PR2b).

## DEC-013 — Mutation queue: FK-aware topological ordering

- source: docs/ingest/ADR-ceo-plan.md (Eng Review additions)
- status: LOCKED (Accepted)
- scope: PR2b
- decision: Before flushing the IndexedDB mutation queue, topologically sort by FK dependencies. Inquilini before Incassi that reference them. Implementation must traverse the queue and emit a flush order; do not flush in insertion order naively.
- rationale: Naive insertion-order flush would 409 on FK violations.

## DEC-014 — iOS Safari SW mitigation: Background Sync + boot-time missed-notifications check

- source: docs/ingest/ADR-ceo-plan.md (Eng Review additions)
- status: LOCKED (Accepted)
- scope: PR2a, PR3
- decision: Use Background Sync API when available; fallback to "check missed notifications at app open." Document in TUTORIAL.md that iOS notifications require "Aggiungi a Home."
- rationale: Safari (2026) supports Notifications API only for home-screen-installed PWAs.

## DEC-015 — Bundle lazy-loading: Tesseract / Chart.js / jsPDF NOT in app shell

- source: docs/ingest/ADR-ceo-plan.md (Performance additions, R5)
- status: LOCKED (Accepted)
- scope: PR3, PR4
- decision: All three libs loaded on first click of their feature, not in initial app shell. idb-keyval (~600 bytes) is allowed in shell.

## DEC-016 — Conflict resolution: per-entity, binary choose (local | remote), not field-level

- source: docs/ingest/ADR-ceo-plan.md (rejected eng concerns: field-level merge)
- status: LOCKED (Accepted, rejected eng review concern)
- scope: PR2b
- decision: On 409 (updated_at mismatch), toast offers "locale | remoto" choice. No field-level CRDT-style merge.
- rationale: Family-tier; binary choice is OK. Revisitable if cases arise.

## DEC-017 — Foto resize compromise: 1600px max long edge

- source: docs/ingest/ADR-ceo-plan.md (rejected eng concerns: foto 1200px)
- status: LOCKED (Accepted)
- scope: PR3
- decision: 1600px max long edge, ~150KB per JPEG. Allows ~7000 photos in 1GB free tier. Avviso at 80% storage usage.

## DEC-018 — Dual-write window: 2 weeks, not 4

- source: docs/ingest/ADR-ceo-plan.md (rejected eng concerns: 4-week dual-write)
- status: LOCKED (Accepted)
- scope: PR2b Phase 3
- decision: 2-week dual-write window before removing blob fallback, contingent on monitoring confirming stability.

## DEC-019 — Apple/Sonoma redesign as PR0

- source: docs/ingest/ADR-ceo-plan.md (PR0 decisions)
- status: LOCKED (Accepted)
- scope: PR0
- decision:
  - Stack: Alpine + Tailwind CDN + custom semantic CSS (no build step)
  - Mobile responsive: sidebar collapses to drawer overlay <900px
  - Remove video MP4 (~4.7MB), replace with abstract CSS mesh USA
  - Restyle login with glass + mesh
  - Design tokens from `:root` of handoff (sbPqzZsV396NsMp4jSK5eQ)
  - Typography: Inter Tight (display) + Inter (body) + JetBrains Mono (numerals) via Google Fonts
  - Reference design saved in `.design-ref/` (gitignored)

## DEC-020 — PR1 absorbs 3 pre-existing bugfixes + extraction of `<script>` to `app.js`

- source: docs/ingest/ADR-ceo-plan.md (code quality bugfixes)
- status: LOCKED (Accepted)
- scope: PR1
- decision:
  1. `importaJSON` must call `migraDati` (line 1169)
  2. `generaIncassiAttesi` must respect `modificatoManualmente` flag
  3. `salva()` must have specific catch chain (auth expired → refresh; network → offline mode; RLS → toast)
  4. Extract `<script>` block into separate `app.js` file (preserves no-build-step)

## DEC-021 — Query batching: single `get_user_data()` RPC at login

- source: docs/ingest/ADR-ceo-plan.md (Performance additions)
- status: LOCKED (Accepted)
- scope: PR2b
- decision: One RPC (or `.or()` query) at login replaces 5 separate SELECTs.

## DEC-022 — NOT in scope (explicit deferrals)

- source: docs/ingest/ADR-ceo-plan.md (NOT in scope section)
- status: LOCKED (Accepted)
- scope: project boundary
- decision: Explicitly deferred — NOT in TODOS, NOT to be added without re-review:
  - Multi-account familiare con sharing
  - Backup automatico cifrato Drive/Dropbox (Export manuale resta)
  - Invio email automatico ricevute (requires custom backend)
  - WhatsApp Business API integration (12-month delight)
  - Suggerimenti aumento affitto basati su OMI (12-month delight)
  - Migrazione a moduli ES6 (violates single-file constraint)

## DEC-023 — Family-tier target: 1-3 trusted users

- source: docs/ingest/ADR-ceo-plan.md, docs/ingest/PRD-design-pwa.md
- status: LOCKED (Accepted)
- scope: project sizing
- decision: All architectural decisions optimize for 1-3 users. No CRDT, no horizontal scaling, no over-engineering. Free-tier compatibility (Supabase + GitHub Pages) is a hard constraint.
