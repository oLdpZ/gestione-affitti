# PROJECT: gestione-affitti

## Core value

Family-tier rental property management PWA that closes the loop on the three things its primary user (the owner's brother) currently does outside the app: receipts (WhatsApp), utility bill photos (phone gallery), and due-date tracking (paper agenda). Zero silent data loss; every delete recoverable for 30 days; offline writes that sync reliably; Italian UI/PDF/notifications.

## Primary user

The owner's brother. Operates from a phone, in motion, while collecting rents and reading utility bills. Limited patience for friction. Already lost 2 apartments from the calendar to a silent `importo=0` bug; trust must be rebuilt by the data-safety net.

Secondary user: the owner, primarily as maintainer. Total user count target: 1-3 trusted family-tier users.

## Stack & deployment

- Alpine.js + Tailwind CDN + Supabase (Auth + Postgres + Storage)
- Single-file `index.html`; `<script>` extracted to `app.js` in PR1 (still no build step)
- Allowed CDN additions: jsPDF, Chart.js, Tesseract.js, idb-keyval, Google Fonts (Inter Tight, Inter, JetBrains Mono)
- Deploy: `git push` to GitHub Pages master → https://oldpz.github.io/gestione-affitti/
- Repo: https://github.com/oLdpZ/gestione-affitti (master @ 5cf701f at synthesis)

## Success metric (developer-facing)

7 PR delivered in the LOCKED order **PR5 → PR0 → PR1 → PR2a → PR2b → PR3 → PR4** with:
- Zero regression on the 5 LOCKED Playwright tests (CON-017)
- Zero data loss across the PR2b schema migration
- Lighthouse PWA score ≥ 90 on mobile after PR2a
- Offline write → sync verified end-to-end after PR2b

## Success metric (user-facing)

The brother stops using WhatsApp for receipts, phone gallery for bill photos, and paper agenda for due dates.

## Out of scope (DEC-022)

Explicitly deferred, not to be re-introduced without a superseding ADR:
- Multi-account familiare con sharing
- Backup automatico cifrato Drive/Dropbox (export manuale resta)
- Invio email automatico ricevute (richiede backend custom)
- WhatsApp Business API integration (12-month delight)
- Suggerimenti aumento affitto basati su OMI (12-month delight)
- Migrazione a moduli ES6 (viola single-file)

## Locked decisions

<decisions>

### DEC-001 — PR sequence locked
PR5 → PR0 → PR1 → PR2a → PR2b → PR3 → PR4. Playwright safety net first; redesign before bug-fix/data-safety so all subsequent PR build on the new skin; data safety BEFORE schema migration because cestino + snapshot are the migration's safety net.

### DEC-002 — Approach B (real PWA + feature core)
Installable PWA with offline writes and per-entity sync. Reject Approach A (data safety only) and Approach C (CRDT/Dexie/ES modules rifondazione).

### DEC-003 — Stack lock
Alpine + Tailwind CDN + Supabase, single-file HTML, no build step, no npm, no bundler, no framework swap. ES6 module migration explicitly rejected.

### DEC-004 — PR2 split into PR2a + PR2b
PR2a = PWA shell (manifest + SW). PR2b = schema migration + per-entity sync. Two independent failure modes; failing one must not gate the other.

### DEC-005 — Inquilini as first-class entity
Table `inquilini (nome, codice_fiscale, telefono, email opz, proprieta_id)`. Required for valid PDF receipts.

### DEC-006 — Export CSV/PDF 730 for commercialista
Annual summary per property formatted for quadro RB 730.

### DEC-007 — tipi_utenza user-scoped dynamic table
Table `tipi_utenza (id, user_id, nome)`. CRUD in Impostazioni. Removes hardcoded enum.

### DEC-008 — scadenzaGiorno custom per proprietà
Field `scadenzaGiorno: 1-31 | 'fine_mese'` on proprietà. Calendar groups by day.

### DEC-009 — OCR via Tesseract.js, lazy-loaded, manual fallback always
OCR output is a pre-filled suggestion, NEVER auto-saved. Manual form always available.

### DEC-010 — Statistiche annuali via Chart.js CDN, lazy-loaded
Line incassi/mese × anno, bar utenze/proprietà, donut yield. Empty state when zero data.

### DEC-011 — Playwright E2E in GitHub Actions CI
Push-trigger on master, fail blocks deploy. Manual on feature branches initially.

### DEC-012 — Schema migration: dual-write window with rollback flag
Three-phase rollout (read-both → one-shot idempotent migration at login → blob removal after 2 weeks). Rollback: `localStorage.usaNuovoSchema = false`.

### DEC-013 — Mutation queue FK-aware topological ordering
Topologically sort queue by FK dependencies before flush (inquilini before incassi). Naive insertion-order flush would 409 on FK violations.

### DEC-014 — iOS Safari mitigation
Background Sync API when available; fallback to boot-time missed-notifications check. Document "Aggiungi a Home" requirement in TUTORIAL.md.

### DEC-015 — Bundle lazy-loading
Tesseract / Chart.js / jsPDF NOT in app shell; loaded only on first invocation. idb-keyval (~600 bytes) allowed in shell.

### DEC-016 — Conflict resolution: per-entity binary choose
On 409 (updated_at mismatch) toast offers locale | remoto. No field-level CRDT-style merge.

### DEC-017 — Foto resize 1600px max long edge
~150KB JPEG, ~7000 photos in 1GB free tier. Warning at 80% storage usage.

### DEC-018 — Dual-write window: 2 weeks (not 4)
Before removing blob fallback, contingent on monitoring confirming stability.

### DEC-019 — PR0 Apple/Sonoma redesign
Alpine + Tailwind CDN + semantic CSS, mesh USA astratto (CSS, no video MP4), Inter Tight + Inter + JetBrains Mono, sidebar → drawer < 900px, design tokens from handoff `sbPqzZsV396NsMp4jSK5eQ`, `.design-ref/` gitignored.

### DEC-020 — PR1 absorbs 3 bugfixes + extraction to app.js
1. `importaJSON` must call `migraDati`; 2. `generaIncassiAttesi` respects `modificatoManualmente`; 3. `salva()` has specific catch chain; 4. Extract `<script>` block into separate `app.js`.

### DEC-021 — Query batching: single get_user_data() RPC
One RPC at login replaces 5 separate SELECTs.

### DEC-022 — NOT in scope
See "Out of scope" section above.

### DEC-023 — Family-tier 1-3 users
All architectural decisions optimize for 1-3 users. No CRDT, no horizontal scaling, no enterprise observability. Free-tier compatibility is a hard constraint.

</decisions>

## Constraints (non-negotiable)

- **CON-001** Single-file HTML preserved (app.js extraction OK, still no build)
- **CON-002** Stack lock — pinned CDN versions, no npm
- **CON-003** Free-tier compatibility (Supabase 1GB + GitHub Pages quotas)
- **CON-004** Italian UI / PDF / notifications
- **CON-005** Mobile-first, thumb-first on iPhone before desktop
- **CON-006** Family-tier sizing (1-3 users)
- **CON-007** Supabase per-entity schema with RLS on user_id and updated_at per row
- **CON-008** Mutation queue protocol (idb-keyval, topological sort, retry/backoff, 409 binary choose)
- **CON-009** Schema migration safety (idempotent, transaction, rollback modal with emergency JSON export)
- **CON-010** Service worker contract (separate sw.js, SWR, versioned cache, skipWaiting, unregister stale)
- **CON-011** iOS Safari constraints (Background Sync + boot check, "Aggiungi a Home" banner)
- **CON-012** Lazy-load jsPDF / Chart.js / Tesseract.js
- **CON-013** OCR is suggestion never auto-commit
- **CON-014** Conflict toast is global (root `<div x-data="app()">`)
- **CON-015** Photo pipeline (1600px, ~150KB, EXIF rotation, quota fallback)
- **CON-016** Single get_user_data() RPC at login
- **CON-017** REGRESSION-LOCK — 5 mandatory Playwright tests, non-removable without superseding ADR
- **CON-018** Critical paths P0 (login, mark incasso <2s, importo=0 visible, offline sync, cestino restore)
- **CON-019** Edge cases catalog (debounce double-tap, beforeunload, 100-char names, empty state, etc.)
- **CON-020** Plan 5-6 realistic sessions (original 3-4 was optimistic)

## Risk register

- **R1** Schema migration breaks data — Med/High → DEC-012
- **R2** SW cache stale after deploy — High/Med → CON-010
- **R3** OCR Italian impreciso — Med/Med → DEC-009, CON-013, real-world validation gate before PR4 closes
- **R4** Mutation queue corrupts state in conflict — Low/High → E2E multi-device tests, manual flush
- **R5** Bundle bloat from jsPDF + Chart.js + Tesseract — Med/Low → CON-012
- **R6** Storage free tier fills up — Low/Med → DEC-017, 80% warning
