# REQUIREMENTS

22 v1 requirements synthesized from intel/requirements.md. Each maps to exactly one phase per the LOCKED PR sequence (DEC-001).

---

## PR5 — Test infrastructure

### REQ-PLAY-01 — Playwright suite in GitHub Actions CI
- Source: ADR DEC-011 + SPEC-test-plan
- Push-trigger on master; failure blocks deploy
- Manual on feature branches initially
- Suite covers: login, crea proprietà, segna incasso, elimina + ripristina cestino, offline write + sync
- All 5 LOCKED regression tests included (CON-017)
- Dedicated test user in Supabase test project with mock data

## PR0 — Redesign

### REQ-UI-01 — Apple/Sonoma full UI redesign
- Source: ADR DEC-019
- All views restyled per design handoff `sbPqzZsV396NsMp4jSK5eQ`
- Glass surfaces, mesh USA astratto (CSS, not video)
- Video MP4 (~4.7MB) removed; login restyled with glass + mesh
- Inter Tight (display) + Inter (body) + JetBrains Mono (numerals) via Google Fonts
- Sidebar → drawer overlay below 900px viewport
- Design tokens from `:root` of handoff
- `.design-ref/` directory exists and is gitignored

## PR1 — Data safety net + bugfix + extraction

### REQ-SAFE-01 — Soft-delete proprietà & incassi
- `deletedAt: ISOString | null` on both entities
- All read queries exclude `deletedAt != null`
- Elimina actions set `deletedAt = now()` instead of array splice
- Auto-purge after 30 days in `init()`

### REQ-SAFE-02 — Cestino view in Impostazioni
- Table: nome, data eliminazione
- "Ripristina" clears `deletedAt`; "Elimina definitivamente" hard-deletes
- Restored proprietà brings back all related incassi and utenze

### REQ-SAFE-03 — Snapshot history (ring buffer of 10)
- localStorage key `gestione_affitti_snapshots`
- Each `salva()` pushes current state with timestamp pre-mutation
- "Ripristina snapshot" view shows timeline + diff
- Restore overwrites current state

### REQ-SAFE-04 — Undo toast after destructive action
- Toast bottom-screen for 5s after delete/large edit
- Click "Annulla" within 5s restores pre-state

### REQ-SAFE-05 — Salute dati page in Impostazioni
- Counts: orfani, importi=0, conflitti sospetti
- Shows: ultimo sync, dimensione blob, storage usage
- (PR2b extension: mutation queue count, last flush, errors last 7 days, last_pull/last_push, open conflicts)
- "Invia diagnostica" opens WhatsApp with last 50 errors from `localStorage.errori[]`

### REQ-SAFE-06 — Importo=0 + banca + currency validation
- Importo=0 on save → soft-confirm modal (already partially done)
- Banca incasso missing → warn
- Currency mismatch → warn

### REQ-SAFE-07 — 3 bugfixes + extract script to app.js (DEC-020)
- `importaJSON` calls `migraDati`
- `generaIncassiAttesi` respects `modificatoManualmente`
- `salva()` has specific catch chain (auth expired → refresh; network → offline; RLS → toast)
- `<script>` block extracted into separate `app.js`

## PR2a — PWA shell

### REQ-PWA-01 — manifest.json
- name, icons (1024 + 512 + 192), display standalone, theme color, start_url, scope
- Icons generated via favicon.io from emoji 🏠 + gradient
- "Aggiungi a Home" works on Chrome desktop + Android

### REQ-PWA-02 — Versioned service worker
- Separate `sw.js` (not inline)
- Stale-While-Revalidate for HTML/CSS/JS app shell + CDN (Tailwind, Supabase, Alpine, jsPDF, idb-keyval)
- Versioned cache name, cleanup at `activate`, `skipWaiting()` on update
- Stale SW from prior sessions unregistered at boot (regression #3, CON-017)

### REQ-PWA-03 — Custom install prompt
- Banner appears only after 3 sessions in 7 days
- Wording: "Aggiungi alla schermata Home"
- Dismissable; doesn't reappear for N days

## PR2b — Schema migration + per-entity sync

### REQ-SCHEMA-01 — Migrate blob → per-entity Supabase tables
- New tables: `proprieta`, `incassi_affitti`, `utenze`, `banche`, `inquilini`, `tipi_utenza`
- RLS by user_id on every table; `updated_at` per row
- Idempotent one-shot migration (runs only if blob non-null AND new tables empty)
- Dual-write Phase 1 → migration Phase 2 → blob removal Phase 3 (DEC-012)
- Rollback flag `localStorage.usaNuovoSchema = false`
- Partial fail → Supabase transaction rollback + modal "Migrazione fallita, scarica backup" with emergency JSON export
- Single `get_user_data()` RPC at login (CON-016)

### REQ-SYNC-01 — Mutation queue (FK-aware) via idb-keyval
- IndexedDB key `mutationQueue`, entry `{op, entity, id, payload, ts}`
- SW `online` listener flushes one op at a time
- FK-aware topological sort before flush (DEC-013)
- Retry 3× exponential backoff on 500
- 409 → per-entity conflict UI; auth-expired → refresh + retry transparently
- "N modifiche in coda" indicator while offline

### REQ-SYNC-02 — Per-entity conflict resolution (binary choose)
- On 409 (updated_at mismatch): fetch remote, toast "Conflitto su [entity name]"
- Binary choice: locale | remoto (no field-level merge)
- Toast lives in root `<div x-data="app()">`, reachable from any view

### REQ-DATA-01 — Inquilini as first-class entity (DEC-005)
- Fields: nome, codice_fiscale, telefono, email opzionale, proprieta_id
- CRUD form in Impostazioni or proprietà view
- Required by REQ-FEAT-03 PDF ricevute (beneficiary field)

### REQ-DATA-02 — Tipi utenza dinamici (DEC-007)
- Table `tipi_utenza (id, user_id, nome)`
- CRUD in Impostazioni
- Utenza form dropdown populated from this table

### REQ-DATA-03 — Scadenze custom per proprietà (DEC-008)
- Field `scadenzaGiorno: 1-31 | 'fine_mese'` on proprietà
- Calendar groups by scadenza day

## PR3 — Notifications + photos + PDF + 730 export

### REQ-FEAT-01 — Notifiche locali utenze
- SW scheduler via `registration.showNotification`, recomputed at install/login
- Fires 09:00 local time: "ACEA Roma scade fra 3 giorni (Appartamento Via Roma)"
- Click → app opens on utenza card
- Soft permission prompt at first utenza creation
- iOS: banner "Aggiungi a Home" required (DEC-014)
- Permission denied: banner once, then feature hidden

### REQ-FEAT-02 — Foto utenze in Supabase Storage
- `<input type="file" accept="image/*" capture="environment">`
- Browser resize to 1600px max long edge (DEC-017), ~150KB JPEG, canvas + toBlob
- Upload path `gestione-affitti/{user_id}/utenze/{utenza_id}/{uuid}.jpg`
- Thumbnail in scheda utenza → lightbox on click
- Quota exceeded: re-compress retry; if still fails → base64 localStorage + modal "Storage pieno"
- 80% storage warning banner
- Camera denied → fallback to plain `<input type="file">`

### REQ-FEAT-03 — PDF ricevute via jsPDF
- jsPDF CDN, lazy-loaded
- A4 portrait
- Fields: intestatario (proprietà), beneficiario (inquilino), causale, importo cifre + lettere, data, città
- "Genera ricevuta" per incasso pagato → download
- "Condividi" via Web Share API
- jsPDF CDN unreachable: lazy retry once, then toast

### REQ-FEAT-04 — Export CSV/PDF 730 quadro RB (DEC-006)
- CSV and PDF formats
- Per-property annual summary
- Columns: totale incassi, totale utenze pagate, periodo
- Format ready for direct paste into quadro RB

## PR4 — Statistics + OCR

### REQ-FEAT-05 — Statistiche annuali via Chart.js (DEC-010)
- Line chart incassi/mese × anno
- Bar chart utenze/proprietà
- Donut yield = (incassi − utenze) / incassi per proprietà
- Empty state when zero data (no empty charts)
- Chart.js lazy-loaded on first navigation to stats page

### REQ-FEAT-06 — OCR bollette via Tesseract.js (DEC-009)
- Tesseract.js lazy-loaded on first "Scatta foto bolletta" click
- Regex importo `\d+[,.]\d{2}\s*€?`, scadenza `\d{2}/\d{2}/\d{4}`
- Values as pre-filled suggestions, NEVER auto-saved
- Failure (illegible / foreign language): toast "OCR non riuscito, compila a mano" + form remains editable
- Pre-shipping gate: validate on 10 real bollette before closing PR4

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-PLAY-01 | Phase 1 (PR5) | Pending |
| REQ-UI-01 | Phase 2 (PR0) | Pending |
| REQ-SAFE-01 | Phase 3 (PR1) | Pending |
| REQ-SAFE-02 | Phase 3 (PR1) | Pending |
| REQ-SAFE-03 | Phase 3 (PR1) | Pending |
| REQ-SAFE-04 | Phase 3 (PR1) | Pending |
| REQ-SAFE-05 | Phase 3 (PR1) | Pending |
| REQ-SAFE-06 | Phase 3 (PR1) | Pending |
| REQ-SAFE-07 | Phase 3 (PR1) | Pending |
| REQ-PWA-01 | Phase 4 (PR2a) | Pending |
| REQ-PWA-02 | Phase 4 (PR2a) | Pending |
| REQ-PWA-03 | Phase 4 (PR2a) | Pending |
| REQ-SCHEMA-01 | Phase 5 (PR2b) | Pending |
| REQ-SYNC-01 | Phase 5 (PR2b) | Pending |
| REQ-SYNC-02 | Phase 5 (PR2b) | Pending |
| REQ-DATA-01 | Phase 5 (PR2b) | Pending |
| REQ-DATA-02 | Phase 5 (PR2b) | Pending |
| REQ-DATA-03 | Phase 5 (PR2b) | Pending |
| REQ-FEAT-01 | Phase 6 (PR3) | Pending |
| REQ-FEAT-02 | Phase 6 (PR3) | Pending |
| REQ-FEAT-03 | Phase 6 (PR3) | Pending |
| REQ-FEAT-04 | Phase 6 (PR3) | Pending |
| REQ-FEAT-05 | Phase 7 (PR4) | Pending |
| REQ-FEAT-06 | Phase 7 (PR4) | Pending |

Coverage: 24/24 mapped (22 from intel + REQ-SAFE-07 covering bugfix + extraction bundle from DEC-020, split for traceability). Zero orphans.
