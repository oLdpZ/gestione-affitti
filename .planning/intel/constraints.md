# Constraints

Synthesized from SPEC-test-plan.md and constraint sections of PRD/ADR. Constraints are non-negotiable unless a future ADR explicitly supersedes one.

---

## CON-001 — Single-file HTML preserved (NFR, hard constraint)

- source: docs/ingest/PRD-design-pwa.md (Constraints), docs/ingest/ADR-ceo-plan.md (Stack lock)
- type: nfr
- statement: `index.html` remains the single HTML file. No build step, no bundler, no framework swap. Deploy stays `git push` to GitHub Pages. The `<script>` block MAY be extracted to a separate `app.js` (DEC-020); this still satisfies "no build."

## CON-002 — Stack lock (NFR)

- source: docs/ingest/PRD-design-pwa.md, docs/ingest/ADR-ceo-plan.md
- type: nfr
- statement: Alpine.js + Tailwind CDN + Supabase + Supabase Storage. Allowed CDN additions: jsPDF, Chart.js, Tesseract.js, idb-keyval, Google Fonts (Inter Tight, Inter, JetBrains Mono). Pinned versions in HTML. No npm, no node_modules.

## CON-003 — Free-tier compatibility (NFR)

- source: docs/ingest/PRD-design-pwa.md
- type: nfr
- statement: All features must fit within Supabase free tier (1GB Storage + free Postgres limits) and GitHub Pages quotas. Foto resize to 1600px (~150KB JPEG) is the math floor that keeps ~7000 photos under 1GB.

## CON-004 — Italian UI/PDF/Notifications (NFR)

- source: docs/ingest/PRD-design-pwa.md
- type: nfr
- statement: All user-facing strings, PDF templates, notification copy in Italian. Code/comments in mixed it/en is OK.

## CON-005 — Mobile-first priority (NFR)

- source: docs/ingest/PRD-design-pwa.md
- type: nfr
- statement: Every feature works thumb-first on iPhone before desktop. Sidebar collapses to drawer below 900px (DEC-019).

## CON-006 — Family-tier sizing (NFR)

- source: docs/ingest/PRD-design-pwa.md, docs/ingest/ADR-ceo-plan.md
- type: nfr
- statement: 1-3 trusted users. No CRDT, no horizontal scaling, no multi-tenant abstractions, no enterprise observability (Datadog etc.). Salute dati page + console structured logs + localStorage error ring is the full telemetry stack.

## CON-007 — Supabase schema contract (PR2b)

- source: docs/ingest/ADR-ceo-plan.md (Architecture diagram)
- type: schema
- statement: Per-entity tables in Supabase:
  ```
  auth.users
    └─> proprieta (id, user_id, nome, importo, scadenzaGiorno, deletedAt, updated_at, ...)
    │     ├─> incassi_affitti (proprieta_id, mese, modificatoManualmente, deletedAt, updated_at, ...)
    │     ├─> utenze (proprieta_id, tipo_id, scadenza, deletedAt, updated_at, ...)
    │     │     └─> tipi_utenza (id, user_id, nome)
    │     └─> inquilini (proprieta_id, nome, codice_fiscale, telefono, email)
    └─> banche (id, user_id, nome, currency)
  Storage: gestione-affitti/{user_id}/utenze/{utenza_id}/{uuid}.jpg
  ```
  Every table has RLS on `user_id` and `updated_at`.

## CON-008 — Mutation queue protocol (PR2b)

- source: docs/ingest/ADR-ceo-plan.md
- type: protocol
- statement:
  - Persistence: `idb-keyval` IndexedDB key `mutationQueue`
  - Entry shape: `{op: 'insert'|'update'|'delete', entity: string, id: string, payload: object, ts: ISOString}`
  - Flush trigger: SW `online` event listener
  - Order: topological sort by FK dependencies (DEC-013), then by `ts`
  - Retry on 500: 3× exponential backoff
  - On 409 (updated_at mismatch): fetch remote, present binary choose toast
  - On auth-expired: refresh session via Supabase, retry transparently
  - On RLS error: toast user
  - UI: "N modifiche in coda" indicator while queue non-empty

## CON-009 — Schema migration safety (PR2b)

- source: docs/ingest/ADR-ceo-plan.md
- type: protocol
- statement: Three-phase rollout per DEC-012. Migration script MUST be idempotent. Wrap in Supabase transaction. On partial fail: rollback + modal "Migrazione fallita, scarica backup" with emergency JSON export of the legacy blob. Feature flag `localStorage.usaNuovoSchema = false` provides per-instance rollback.

## CON-010 — Service worker contract

- source: docs/ingest/ADR-ceo-plan.md
- type: protocol
- statement:
  - Separate file `sw.js`, not inline
  - All SW concerns live in `sw.js`: registration, mutation queue flush, notification scheduler
  - Cache strategy: Stale-While-Revalidate for app shell + listed CDNs
  - Versioned cache name; cleanup old caches at `activate`
  - `skipWaiting()` on update
  - Boot: unregister any stale SW from previous sessions (regression #3)

## CON-011 — iOS Safari constraints

- source: docs/ingest/ADR-ceo-plan.md (Reviewer Concerns, Eng Review additions)
- type: nfr
- statement: iOS Safari supports Notifications API only for PWAs installed from home screen. Implementation MUST:
  - Use Background Sync API when available
  - Fall back to "check missed notifications on app open" at boot
  - Show banner instructing "Aggiungi a Home" before notification permission flow on iOS
  - Document constraint in TUTORIAL.md

## CON-012 — Bundle lazy-loading

- source: docs/ingest/ADR-ceo-plan.md (Performance additions)
- type: nfr
- statement: jsPDF, Chart.js, Tesseract.js MUST NOT be in the initial app shell. Loaded only on first invocation of their feature. idb-keyval (~600 bytes) is allowed in shell.

## CON-013 — OCR is suggestion, never auto-commit

- source: docs/ingest/ADR-ceo-plan.md (R3 mitigation)
- type: api-contract (UI-layer)
- statement: OCR output is presented as pre-filled form values for user confirmation. Never auto-saves. Form must always be editable. Failure modes show toast + leave form open with empty fields.

## CON-014 — Conflict UI is global

- source: docs/ingest/ADR-ceo-plan.md (Coupling concerns)
- type: api-contract (UI-layer)
- statement: Conflict toast lives in root `<div x-data="app()">` and is reachable from any view. No per-view re-implementation.

## CON-015 — Photo upload pipeline

- source: docs/ingest/ADR-ceo-plan.md, docs/ingest/PRD-design-pwa.md
- type: protocol
- statement:
  - Max long edge: 1600px (DEC-017)
  - Target file size: ~150KB JPEG
  - EXIF rotation preserved
  - Path template: `gestione-affitti/{user_id}/utenze/{utenza_id}/{uuid}.jpg`
  - Quota-exceeded fallback: re-compress at higher ratio, retry; if still fails → base64 localStorage + modal

## CON-016 — Performance: query batching

- source: docs/ingest/ADR-ceo-plan.md (Performance additions)
- type: nfr
- statement: Initial data load at login is a single Supabase RPC `get_user_data()` (or `.or()` query), not 5 separate SELECTs.

## CON-017 — REGRESSION-LOCK (5 mandatory tests in PR5)

- source: docs/ingest/SPEC-test-plan.md (IRON RULE section)
- type: nfr
- statement: The following five regression tests are LOCKED into the Playwright suite. They cannot be removed without an explicit superseding ADR. No AskUserQuestion permitted in their behavior:
  1. Proprietà with `importoAffittoMensile=0` appears on the calendar as a yellow "Sistema" card with action button (bug 2026-05-17)
  2. "Genera incassi mancanti" lists skipped proprietà explicitly (no false "tutti presenti" alert) (bug 2026-05-17)
  3. Stale service workers from previous sessions are unregistered at boot (bug 2026-05-17)
  4. Importo=0 on proprietà save triggers soft-confirm modal (fix 2026-05-17)
  5. Orphan incassi (proprietà cancellata) appear in dedicated group on calendar (fix 2026-05-17)

## CON-018 — Critical paths (must always work)

- source: docs/ingest/SPEC-test-plan.md
- type: nfr
- statement: These flows are P0 and gate every release:
  1. Login email/password + load existing data
  2. Mark incasso today — must be tap-to-complete in <2s
  3. REGRESSION: importo=0 proprietà visible on calendar (CON-017 #1)
  4. Offline write + return online + sync (PR2b+)
  5. Cestino: elimina + ripristina yields identical data (PR1)

## CON-019 — Edge cases catalog

- source: docs/ingest/SPEC-test-plan.md (Edge Cases section)
- type: nfr
- statement: Implementation MUST handle:
  - Doppio tap su "Incassa oggi" → debounce or disable button after click
  - Navigate-away during save → beforeunload blocks if stato='salvataggio'
  - Nome proprietà 100 chars → truncate with tooltip, no UI break
  - 0 proprietà → empty state with CTA "Aggiungi prima proprietà"
  - Connection drop mid-flush → queue persists, retry on next online
  - Notifications permission denied → banner once, then hide feature
  - Camera permission denied → fallback to plain `<input type="file">`
  - Foto landscape → preserve EXIF rotation
  - OCR foreign-language → graceful degradation, no crash
  - CDN down (Tailwind/Supabase/Alpine/jsPDF) → SW cache serves
  - Supabase down → app continues offline, queue persists

## CON-020 — Estimation reality check

- source: docs/ingest/ADR-ceo-plan.md (Reviewer Concerns #2)
- type: nfr (planning)
- statement: Original estimate of 3-4 CC sessions is optimistic. Plan for 5-6 realistic sessions. PR2b alone likely needs 1 full session + 1 of bugfix.
