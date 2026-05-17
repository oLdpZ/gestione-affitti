# Requirements

Synthesized from PRD-design-pwa.md. Each requirement is scoped to a PR per the LOCKED PR sequence in DEC-001.

Note: The ADR supersedes the original PRD design doc (`supersedes_design: gestione-affitti-design-pwa-20260517.md`). Where the PRD and ADR overlap, ADR decisions govern; the PRD provides goals, user-facing acceptance criteria, and personas.

---

## REQ-data-safety-soft-delete

- source: docs/ingest/PRD-design-pwa.md (PR1)
- pr-bucket: PR1
- description: Proprietà and incassi must be soft-deleted (never hard-deleted on user action).
- acceptance:
  - `deletedAt: ISOString | null` field on both entities
  - All read queries exclude rows where `deletedAt` is non-null
  - `eliminaProprieta` and `eliminaIncasso` set `deletedAt = now()` instead of array splice
  - Auto-purge after 30 days runs in `init()`

## REQ-cestino-view

- source: docs/ingest/PRD-design-pwa.md (PR1)
- pr-bucket: PR1
- description: Cestino UI in Impostazioni.
- acceptance:
  - Table shows nome, data eliminazione
  - "Ripristina" button restores row (clears `deletedAt`)
  - "Elimina definitivamente" hard-deletes
  - Test: elimina → cestino → ripristina → entity reappears with all related incassi and utenze intact

## REQ-snapshot-history

- source: docs/ingest/PRD-design-pwa.md (PR1)
- pr-bucket: PR1
- description: Ring buffer of 10 pre-save states in localStorage.
- acceptance:
  - Key: `gestione_affitti_snapshots`
  - Each `salva()` pushes current state with timestamp before applying mutation
  - "Ripristina snapshot" view shows timeline + diff
  - Restore action overwrites current state

## REQ-undo-toast

- source: docs/ingest/PRD-design-pwa.md (PR1)
- pr-bucket: PR1
- description: Generic undo toast after delete/large edit.
- acceptance:
  - Toast appears bottom-screen for 5s after destructive action
  - Click "Annulla" within window restores pre-state
  - Test: elimina incasso → toast → click within 5s → incasso returns

## REQ-salute-dati

- source: docs/ingest/PRD-design-pwa.md (PR1), extended in ADR observability
- pr-bucket: PR1 (extended in PR2b)
- description: "Salute dati" page in Impostazioni.
- acceptance:
  - Shows: count orfani, count importi=0, conflitti sospetti, ultimo sync, dimensione blob, storage usage
  - PR2b extension: mutation queue count, last flush, errors in last 7 days, last_pull/last_push, open conflicts
  - "Invia diagnostica" button opens WhatsApp with last 50 errors from `localStorage.errori[]`

## REQ-importo-zero-validation

- source: docs/ingest/PRD-design-pwa.md (PR1) + docs/ingest/SPEC-test-plan.md regression #4
- pr-bucket: PR1
- description: Form validation surfaces silent data issues.
- acceptance:
  - Importo=0 on save shows soft confirm modal (already partially done 2026-05-17)
  - Banca incasso missing → warn
  - Currency mismatch → warn

## REQ-pwa-manifest

- source: docs/ingest/PRD-design-pwa.md (PR2a → PR2a per ADR)
- pr-bucket: PR2a
- description: `manifest.json` with full PWA metadata.
- acceptance:
  - name, icons (1024×1024 + 512 + 192)
  - display: standalone, theme color, start_url, scope
  - Icons generated via favicon.io from emoji 🏠 + gradient (resolves PRD open question #4)
  - "Aggiungi a Home" works on Chrome desktop + Android

## REQ-service-worker

- source: docs/ingest/PRD-design-pwa.md (PR2a)
- pr-bucket: PR2a
- description: Versioned service worker with Stale-While-Revalidate.
- acceptance:
  - `sw.js` separate file (not inline)
  - SWR for HTML/CSS/JS app shell + CDN (Tailwind, Supabase, Alpine, jsPDF, idb-keyval)
  - Cache versioning + cleanup of old caches at `activate`
  - `skipWaiting()` on update
  - Old SWs from prior sessions unregistered at boot (regression #3 in SPEC)

## REQ-install-prompt-custom

- source: docs/ingest/PRD-design-pwa.md (PR2a)
- pr-bucket: PR2a
- description: Custom install banner.
- acceptance:
  - Appears only after 3 sessions in 7 days
  - Wording: "Aggiungi alla schermata Home"
  - Dismissable, doesn't reappear for N days

## REQ-mutation-queue

- source: docs/ingest/PRD-design-pwa.md (PR2 → PR2b per ADR DEC-004) + ADR DEC-013
- pr-bucket: PR2b
- description: Offline write queue persisted in IndexedDB.
- acceptance:
  - Uses `idb-keyval` from CDN (~600 bytes)
  - Each offline `salva()` pushes `{op, entity, id, payload, ts}` to queue
  - SW `online` listener flushes queue one operation at a time
  - **FK-aware topological sort** before flush (DEC-013)
  - Retry 3× with exponential backoff on 500
  - On 409: present per-entity conflict UI (DEC-016)
  - On auth-expired: refresh Supabase session, retry transparently
  - UI indicator: "N modifiche in coda" when offline

## REQ-schema-migration-per-entity

- source: docs/ingest/PRD-design-pwa.md (PR2) + ADR DEC-012
- pr-bucket: PR2b
- description: Migrate from `dati_utente.blob_json` to per-entity tables.
- acceptance:
  - New tables: `proprieta`, `incassi_affitti`, `utenze`, `banche`, `inquilini`, `tipi_utenza`
  - RLS by `user_id` on every table
  - `updated_at` per row
  - One-shot migration script: idempotent, runs only if blob non-null AND new tables empty
  - Dual-write Phase 1 → migration Phase 2 → blob-removal Phase 3 (per DEC-012)
  - Rollback flag `localStorage.usaNuovoSchema = false`
  - Schema partial-fail: Supabase transaction + rollback + modal "Migrazione fallita, scarica backup" with emergency JSON export

## REQ-conflict-resolution-per-entity

- source: docs/ingest/PRD-design-pwa.md (PR2) + DEC-016
- pr-bucket: PR2b
- description: Conflict resolution moves from blob to per-row updated_at.
- acceptance:
  - On 409 mismatch: fetch remote, show toast "Conflitto su [entity name]"
  - Binary choose: locale | remoto (no field-level merge per DEC-016)
  - Toast is globally accessible (root `<div x-data="app()">`)

## REQ-inquilini-entity

- source: docs/ingest/PRD-design-pwa.md (open Q1 — resolved by ADR DEC-005)
- pr-bucket: PR2b
- description: Inquilini as first-class entity.
- acceptance:
  - Fields: nome, codice_fiscale, telefono, email (opzionale), proprieta_id
  - CRUD form in Impostazioni or proprietà view
  - Required by REQ-pdf-ricevute (beneficiary)

## REQ-tipi-utenza-dinamici

- source: ADR DEC-007
- pr-bucket: PR2b
- description: User-scoped tipi utenza table replacing hardcoded enum.
- acceptance:
  - Table `tipi_utenza (id, user_id, nome)`
  - CRUD form in Impostazioni
  - Utenza form dropdown populated from this table
  - Adding "rifiuti", "condominio" appears in dropdown immediately

## REQ-scadenze-custom

- source: ADR DEC-008
- pr-bucket: PR2b
- description: Custom utenza scadenza day per proprietà.
- acceptance:
  - Field `scadenzaGiorno: 1-31 | 'fine_mese'` on proprietà
  - Calendar groups by scadenza day
  - Test: imposta giorno 5 → calendar shows correctly

## REQ-notifiche-locali-utenze

- source: docs/ingest/PRD-design-pwa.md (PR3)
- pr-bucket: PR3
- description: Local notifications for utenza scadenza.
- acceptance:
  - SW scheduler via `registration.showNotification` triggered by `setTimeout` recomputed at install/login
  - Fires at 09:00 local time: "ACEA Roma scade fra 3 giorni (Appartamento Via Roma)"
  - Click → app opens on utenza card
  - Soft permission prompt at first utenza creation
  - iOS: requires "Aggiungi a Home" (DEC-014); banner explains otherwise
  - Permission denied: banner once, then feature hidden

## REQ-foto-utenze-storage

- source: docs/ingest/PRD-design-pwa.md (PR3) + DEC-017
- pr-bucket: PR3
- description: Photo capture and upload for utenze/ricevute.
- acceptance:
  - `<input type="file" accept="image/*" capture="environment">`
  - Browser-side resize to 1600px max long edge (DEC-017), canvas + toBlob, ~150KB JPEG
  - Upload path: `gestione-affitti/{user_id}/utenze/{utenza_id}/{uuid}.jpg`
  - Thumbnail in scheda utenza; click → lightbox
  - Quota exceeded: compress more, retry; if still fails → base64 in localStorage + modal "Storage pieno"
  - Avviso banner at 80% storage usage
  - Permessi camera denied: fallback to standard file input without capture

## REQ-pdf-ricevute

- source: docs/ingest/PRD-design-pwa.md (PR3)
- pr-bucket: PR3
- description: PDF receipt generation per incasso pagato.
- acceptance:
  - jsPDF from CDN, lazy-loaded
  - A4 portrait
  - Fields: intestatario (proprietà), beneficiario (inquilino from REQ-inquilini), causale ("Affitto mese di [Mese Anno]"), importo cifre + lettere, data, città
  - Bottone "Genera ricevuta" per incasso pagato → download
  - "Condividi" via Web Share API
  - jsPDF CDN unreachable: lazy retry once, then toast

## REQ-export-730

- source: ADR DEC-006
- pr-bucket: PR3
- description: Annual export for commercialista (quadro RB 730).
- acceptance:
  - CSV and PDF formats
  - Per-property annual summary
  - Columns: totale incassi, totale utenze pagate, periodo
  - Format ready for direct paste into quadro RB

## REQ-statistiche-annuali

- source: ADR DEC-010
- pr-bucket: PR4
- description: Charts page using Chart.js (lazy-loaded).
- acceptance:
  - Line chart: incassi/mese × anno
  - Bar chart: utenze/proprietà
  - Donut: yield = (incassi − utenze) / incassi per proprietà
  - Empty state when 0 data (no empty charts)
  - Chart.js lazy-loaded on first navigation to stats page

## REQ-ocr-bollette

- source: ADR DEC-009
- pr-bucket: PR4
- description: OCR auto-fill of utenza form from bolletta photo.
- acceptance:
  - Tesseract.js lazy-loaded on first "Scatta foto bolletta" click
  - Regex importo: `\d+[,.]\d{2}\s*€?`
  - Regex scadenza: `\d{2}/\d{2}/\d{4}`
  - Values shown as **pre-filled suggestions**, NOT auto-saved
  - Failure (illegible, foreign language): toast "OCR non riuscito, compila a mano" + form remains editable
  - Pre-shipping gate: validate on 10 real bollette from end-user before closing PR4

## REQ-playwright-ci

- source: ADR DEC-011 + SPEC-test-plan
- pr-bucket: PR5 (ships FIRST per DEC-001)
- description: Playwright suite in GitHub Actions.
- acceptance:
  - Push-trigger on master, fail blocks deploy
  - Manual on feature branches initially
  - Minimal suite: login, crea proprietà, segna incasso, elimina + ripristina cestino, offline write + sync
  - All 5 LOCKED regression tests from SPEC included (see constraints.md REGRESSION-LOCK)
  - Test fixture: dedicated test user in Supabase test project with mock data

## REQ-pr0-redesign

- source: ADR DEC-019
- pr-bucket: PR0
- description: Apple/Sonoma full UI redesign.
- acceptance:
  - All views restyled per design handoff `sbPqzZsV396NsMp4jSK5eQ`
  - Glass surfaces, mesh USA astratto (CSS, not video)
  - Video MP4 (~4.7MB) removed
  - Login restyled with glass+mesh
  - Inter Tight + Inter + JetBrains Mono via Google Fonts
  - Sidebar → drawer overlay below 900px viewport
  - Design tokens from `:root` of handoff
  - `.design-ref/` directory exists and is gitignored
