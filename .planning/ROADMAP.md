# ROADMAP: gestione-affitti

7 phases mapped 1:1 to the LOCKED PR sequence (DEC-001): **PR5 → PR0 → PR1 → PR2a → PR2b → PR3 → PR4**.

This ordering is locked by ADR-ceo-plan.md and cannot be reordered without a superseding ADR.

---

## Phases

- [ ] **Phase 1: PR5 — Test infrastructure** — Playwright suite + 5 LOCKED regression tests live in CI before any feature work
- [ ] **Phase 2: PR0 — Apple/Sonoma redesign** — Glass + mesh UI, responsive sidebar→drawer, fonts, design tokens
- [ ] **Phase 3: PR1 — Data safety net + 3 bugfix + app.js extraction** — Soft-delete, cestino, snapshot, undo, salute dati, validation, bugfix bundle
- [ ] **Phase 4: PR2a — PWA shell** — manifest.json, versioned service worker, custom install prompt
- [ ] **Phase 5: PR2b — Schema migration + per-entity sync** — Blob → per-entity tables, mutation queue, conflict UI, inquilini/tipi_utenza/scadenze
- [ ] **Phase 6: PR3 — Notifiche + foto + PDF + export 730** — Local notifications, Storage photo pipeline, jsPDF receipts, 730 export
- [ ] **Phase 7: PR4 — Statistiche annuali + OCR bollette** — Chart.js stats page, Tesseract.js OCR-as-suggestion

## Phase Details

### Phase 1: PR5 — Test infrastructure
**Goal**: Playwright safety net live in GitHub Actions CI so every subsequent PR ships behind a green build.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-PLAY-01
**Success Criteria** (what must be TRUE):
  1. Push to master triggers Playwright suite in GitHub Actions; a failing test blocks deploy
  2. All 5 LOCKED regression tests (CON-017) run on every push and pass against current master
  3. Suite covers the 5 critical paths: login, crea proprietà, segna incasso, elimina + ripristina cestino, offline write + sync
  4. Dedicated test user with mock data exists in a Supabase test project and is used by CI
**Plans**: TBD

### Phase 2: PR0 — Apple/Sonoma redesign + responsive
**Goal**: Full UI redesign per design handoff `sbPqzZsV396NsMp4jSK5eQ` so all subsequent PR build on the new skin (no rework).
**Depends on**: Phase 1
**Requirements**: REQ-UI-01
**Success Criteria** (what must be TRUE):
  1. Every view is restyled with glass surfaces, mesh USA astratto (pure CSS), Inter Tight + Inter + JetBrains Mono via Google Fonts
  2. Login screen is restyled with glass + mesh; the ~4.7MB video MP4 is removed from the bundle
  3. Sidebar collapses to a drawer overlay below 900px viewport; thumb-first usability verified on iPhone
  4. Design tokens from the handoff `:root` are applied; `.design-ref/` directory exists and is gitignored
  5. All 5 LOCKED Playwright tests still pass post-redesign (no regression)
**Plans**: TBD
**UI hint**: yes

### Phase 3: PR1 — Data Safety Net + 3 bugfix + estrazione app.js
**Goal**: Eliminate silent data loss (the original trust breach) by making every destructive action recoverable, before the schema migration runs.
**Depends on**: Phase 2
**Requirements**: REQ-SAFE-01, REQ-SAFE-02, REQ-SAFE-03, REQ-SAFE-04, REQ-SAFE-05, REQ-SAFE-06, REQ-SAFE-07
**Success Criteria** (what must be TRUE):
  1. User can delete a proprietà or incasso, see it in Cestino in Impostazioni, click "Ripristina", and the entity returns with all related incassi and utenze intact
  2. After any destructive action, an undo toast appears for 5s; clicking "Annulla" restores the pre-state
  3. Salute dati page in Impostazioni shows count orfani, count importi=0, conflitti sospetti, ultimo sync, dimensione blob, storage usage; "Invia diagnostica" opens WhatsApp with last 50 errors
  4. Saving a proprietà with importo=0 surfaces a soft-confirm modal; banca missing and currency mismatch surface warnings
  5. The 3 pre-existing bugs are fixed (importaJSON calls migraDati; generaIncassiAttesi respects modificatoManualmente; salva() has specific catch chain) and the `<script>` block is extracted to `app.js` with no build step introduced
  6. Up to 10 pre-save snapshots are kept in localStorage; user can restore any of them from "Ripristina snapshot"
**Plans**: TBD
**UI hint**: yes

### Phase 4: PR2a — PWA shell (manifest, SW)
**Goal**: App installs to home screen and works offline as a shell, isolated from the schema migration to keep failure modes independent (DEC-004).
**Depends on**: Phase 3
**Requirements**: REQ-PWA-01, REQ-PWA-02, REQ-PWA-03
**Success Criteria** (what must be TRUE):
  1. User on Chrome desktop or Android can "Aggiungi a Home" and the app launches standalone with proper icon and theme color
  2. Versioned `sw.js` (separate file) serves the app shell and pinned CDN assets with Stale-While-Revalidate; cache cleanup runs at `activate`; `skipWaiting()` runs on update
  3. Stale service workers from previous sessions are unregistered at boot (CON-017 regression #3 still passes)
  4. After 3 sessions in 7 days, a dismissable Italian install banner ("Aggiungi alla schermata Home") appears; once dismissed it doesn't reappear for N days
  5. Lighthouse PWA score ≥ 90 on mobile
**Plans**: TBD
**UI hint**: yes

### Phase 5: PR2b — Schema migration + sync per-entità
**Goal**: Move from `dati_utente.blob_json` to per-entity Supabase tables with offline-capable per-row sync, zero data loss, rollback flag available.
**Depends on**: Phase 4 (PWA shell), Phase 3 (data safety net is the migration's rescue path)
**Requirements**: REQ-SCHEMA-01, REQ-SYNC-01, REQ-SYNC-02, REQ-DATA-01, REQ-DATA-02, REQ-DATA-03
**Success Criteria** (what must be TRUE):
  1. Per-entity tables (proprieta, incassi_affitti, utenze, banche, inquilini, tipi_utenza) exist in Supabase with RLS on user_id and per-row updated_at; initial load is a single `get_user_data()` RPC
  2. Existing users transparently migrate at next login (idempotent one-shot script): blob is read, new tables populated, dual-write window runs for 2 weeks before blob fallback is removed; `localStorage.usaNuovoSchema = false` rolls back per instance
  3. Airplane mode → user makes 3 writes (including an inquilino + incasso that references it) → online → mutation queue flushes in FK-aware topological order; data is consistent on the server
  4. Same proprietà edited on 2 offline devices then synced surfaces a global toast "Conflitto su [nome]" with binary choose locale | remoto; no field-level merge, no silent loss
  5. User can manage inquilini (CRUD), tipi_utenza (CRUD in Impostazioni — adding "rifiuti" appears immediately in utenza dropdown), and `scadenzaGiorno` (1-31 or fine_mese) per proprietà reflected in the calendar
  6. Schema partial-fail surfaces "Migrazione fallita, scarica backup" modal with emergency JSON export; on the next attempt the script remains idempotent
**Plans**: TBD

### Phase 6: PR3 — Notifiche + foto + PDF + export 730
**Goal**: Close the workflow loop — the brother stops using WhatsApp for receipts, phone gallery for bill photos, and paper agenda for due dates.
**Depends on**: Phase 5 (inquilini entity required for PDF beneficiario; per-entity schema required for foto link)
**Requirements**: REQ-FEAT-01, REQ-FEAT-02, REQ-FEAT-03, REQ-FEAT-04
**Success Criteria** (what must be TRUE):
  1. User receives a local notification at 09:00 ("ACEA Roma scade fra 3 giorni (Appartamento Via Roma)"); click opens the app on the utenza card. On iOS Safari, a banner first instructs "Aggiungi a Home". Permission denied → feature hidden after one banner
  2. User can capture or pick a bolletta/ricevuta photo; it is resized to 1600px (~150KB JPEG, EXIF rotation preserved) and uploaded to `gestione-affitti/{user_id}/utenze/{utenza_id}/{uuid}.jpg`; thumbnail in scheda utenza opens a lightbox. 80% storage warning banner is shown; camera denied falls back to plain file input
  3. From any incasso pagato, user clicks "Genera ricevuta" and downloads an A4 PDF in Italian with intestatario (proprietà), beneficiario (inquilino), causale ("Affitto mese di [Mese Anno]"), importo cifre + lettere, data, città; "Condividi" uses Web Share API. jsPDF is lazy-loaded
  4. User can export an annual CSV and PDF per property, formatted for 730 quadro RB (totale incassi, totale utenze pagate, periodo) — ready to paste to commercialista
**Plans**: TBD
**UI hint**: yes

### Phase 7: PR4 — Statistiche annuali + OCR bollette
**Goal**: Ship the two delight features that reduce manual data entry and surface yield insights, both lazy-loaded so they don't bloat the shell.
**Depends on**: Phase 6
**Requirements**: REQ-FEAT-05, REQ-FEAT-06
**Success Criteria** (what must be TRUE):
  1. Statistiche page shows: line chart incassi/mese × anno, bar chart utenze/proprietà, donut yield (incassi − utenze)/incassi per proprietà; empty state with no charts is shown when there is zero data
  2. Chart.js is lazy-loaded only on first navigation to the stats page; it is NOT in the initial app shell
  3. From "Scatta foto bolletta" the user captures a photo; Tesseract.js (lazy-loaded) extracts importo and scadenza via regex; values are presented as **pre-filled, editable suggestions** in the utenza form — never auto-saved
  4. OCR failure (illegible, foreign language) surfaces toast "OCR non riuscito, compila a mano" and leaves the form open with empty fields, fully editable
  5. Pre-shipping gate: OCR validated on 10 real bollette from the end-user before the phase closes
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PR5 Test infrastructure | 0/0 | Active | - |
| 2. PR0 Redesign | 0/0 | Not started | - |
| 3. PR1 Data safety + bugfix + app.js | 0/0 | Not started | - |
| 4. PR2a PWA shell | 0/0 | Not started | - |
| 5. PR2b Schema migration + sync | 0/0 | Not started | - |
| 6. PR3 Notifiche + foto + PDF + 730 | 0/0 | Not started | - |
| 7. PR4 Statistiche + OCR | 0/0 | Not started | - |

## Coverage

- 24 requirements mapped, zero orphans
- 1:1 mapping to LOCKED PR sequence (DEC-001) preserved
- All 23 LOCKED decisions from intel/decisions.md flow into phase success criteria
- 5 LOCKED regression tests (CON-017) gate every phase from Phase 1 onward
