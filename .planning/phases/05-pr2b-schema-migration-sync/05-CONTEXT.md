# Phase 5: PR2b — Schema migration + per-entity sync — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Source:** PRD Express Path — `wiki/projects/gestione-affitti-ceo-plan-20260517.md` (LOCKED CEO plan SELECTIVE EXPANSION) + ROADMAP.md Phase 5 success criteria + REQUIREMENTS.md REQ-SCHEMA-01/REQ-SYNC-01-02/REQ-DATA-01-03

<domain>
## Phase Boundary

Move persistence from `dati_utente.blob_json` (single JSON blob, last-writer-wins su intero blob) a tabelle Supabase per-entità con offline-capable per-row sync, **zero data loss**, **rollback flag disponibile**. Introduce 3 nuove entità (`inquilini`, `tipi_utenza`, `scadenzaGiorno`). Conflict resolution per-entità binary (locale|remoto). Mutation queue FK-aware in IndexedDB.

**Cosa NON è in scope:**
- Field-level merge per conflict resolution (binary choose è OK per family-tier — eng-review REJECTED 17/05)
- 4-week dual-write timeline (2 settimane accettate)
- IndexedDB write debounce (premature)
- Migrazione a moduli ES6 (vincolo "single-file preserve")
- Notifiche locali, foto, PDF, OCR, stats (PR3/PR4)

</domain>

<decisions>
## Implementation Decisions

### Schema target (LOCKED via DEC-005, DEC-007, DEC-008, DEC-012, CON-016)

- Tabelle Supabase nuove: `proprieta`, `incassi_affitti`, `utenze`, `banche`, `inquilini`, `tipi_utenza`
- Ogni tabella ha: `id` (uuid), `user_id` (fk auth.users), `updated_at` (timestamptz, per-row), `created_at`
- RLS policy per ogni tabella: `user_id = auth.uid()` su SELECT/INSERT/UPDATE/DELETE
- Foreign keys: `incassi_affitti.proprieta_id`, `utenze.proprieta_id`, `utenze.tipo_id` → `tipi_utenza.id`, `inquilini.proprieta_id`
- Currency mantenuto su `proprieta` e `banche` (dataVersion v2 esistente)
- `scadenzaGiorno` su `proprieta`: integer 1-31 OR string `'fine_mese'` (CHECK constraint)
- **Initial load via single RPC `get_user_data()`** (CON-016) che ritorna JSON con tutte le entità in una sola roundtrip — NO 5+ SELECT separati al login

### Migrazione blob → per-entità (LOCKED via DEC-012, R1 mitigation)

- **Script one-shot idempotente** in `app.js`: triggera SOLO se `dati_utente.blob_json IS NOT NULL` AND tabelle nuove vuote per `user_id`
- **Transazione Supabase**: tutto-o-niente. Se partial fail → rollback automatico + modal blocking "Migrazione fallita, scarica backup" con bottone "Esporta JSON di emergenza" (riusa `esportaJSON` esistente)
- **Backup automatico pre-migrazione**: snapshot in localStorage (riusa snapshot ring buffer di PR1) E download JSON auto-triggered prima di eseguire la migrazione
- **Dual-write window di 2 settimane** (DEC-012 Phase 1 → Phase 2 → Phase 3):
  - Phase 1: deploy code che legge da entrambi (preferenza nuovo schema, fallback blob)
  - Phase 2: al next login per ogni utente, migration triggered
  - Phase 3: dopo 2 settimane di stabilità verificata, remove blob fallback in nuovo deploy
- **Rollback flag**: `localStorage.usaNuovoSchema = false` per istanza singola — l'app riusa il blob path

### Mutation queue FK-aware (LOCKED via DEC-013, R4 mitigation)

- **Storage**: IndexedDB via `idb-keyval` CDN (pinned version, aggiunto a SW precache di PR2a)
- **Key**: `mutationQueue` (array)
- **Entry shape**: `{ op: 'insert'|'update'|'delete', entity: string, id: string, payload: object, ts: number, attempts: number }`
- **Flush trigger**: `window.addEventListener('online')` + manual button in Salute dati
- **FK-aware topological sort PRIMA del flush**: ordine = `tipi_utenza → banche → proprieta → inquilini → incassi_affitti → utenze` (no cycles). Implementa Kahn's algorithm su graph statico
- **Retry policy**: 3× con backoff esponenziale (1s, 3s, 9s) su HTTP 5xx. Dopo 3 fail resta in coda con `attempts: 3` → utente vede "1 modifica in coda" indicator
- **HTTP 409 (updated_at mismatch)** → conflict toast (vedi sotto), NON retry
- **HTTP 401 (auth expired)** → `supabase.auth.refreshSession()`, retry **trasparente** (no toast)
- **Toast persistente "N modifiche in coda"** in alto a destra mentre `mutationQueue.length > 0 AND !navigator.onLine`

### Conflict resolution per-entità (LOCKED via DEC-013, REQ-SYNC-02)

- **Trigger**: HTTP 409 su flush (server `updated_at` > queued `updated_at`)
- **UI**: toast non-dismissible in root `<div x-data="app()">` (globale, accessibile da qualsiasi view)
- **Copy**: "Conflitto su [nome entità]" (es. "Conflitto su Appartamento Via Roma")
- **Choices**: 2 bottoni **"Usa la mia versione"** | **"Usa versione cloud"** — binary, NO 3-way merge, NO field-level
- **Effetto "Usa mia"**: force update con server `updated_at` (skip mismatch check)
- **Effetto "Usa cloud"**: discard local change, refetch entity
- **Salute dati estesa**: count conflitti aperti (REQ-SAFE-05 extension)

### Nuove entità UX (LOCKED via DEC-005, DEC-007, DEC-008)

- **Inquilini CRUD** in Impostazioni (nuova sezione) E/O in scheda proprietà (link "Aggiungi inquilino"). Campi: nome (required), codice_fiscale (validazione formato 16 char), telefono, email (opzionale, validazione regex), proprieta_id (select). Soft-delete + cestino esteso (REQ-SAFE-01-02)
- **Tipi utenza dinamici** in Impostazioni: CRUD list (default seed: `acqua`, `luce`, `gas` — migrati dal codice). Aggiunta "rifiuti" diventa subito disponibile in dropdown utenze. Hard-delete bloccato se ci sono utenze con quel `tipo_id` (RLS-level FK constraint o pre-check)
- **scadenzaGiorno** in form proprietà: select 1-31 oppure "Fine mese". Default backward-compat: 1 (per match generaIncassiAttesi attuale). Il calendario raggruppa le card per scadenzaGiorno (no più solo 1/15/fine_mese hardcoded)

### Salute dati estensione (REQ-SAFE-05 extension)

Pagina Salute dati di PR1 estesa con:
- Mutation queue: count entries, ultimo flush successo, errori ultimi 7 giorni
- Sync status: `last_pull_at`, `last_push_at`, count conflitti aperti
- Storage usage: dimensione IndexedDB (`idb-keyval` totale)
- Bottone "Flush manuale coda" (chiama stesso path di `online` listener)

### Test coverage (LOCKED via PR5 / CON-017)

- **CRITICAL-05 (offline write + sync)** è `.skip` da PR5 — Phase 5 DEVE renderlo LIVE
- Nuovo test E2E: airplane mode → 3 write (inquilino + incasso che lo referenzia + utenza) → online → queue flushes in ordine topologico FK → server consistent
- Nuovo test E2E: conflict trigger → toast → "Usa cloud" → state aggiornato; rerun con "Usa mia" → server aggiornato
- Nuovo test E2E: migration script idempotente (run 2× → second run no-op)
- Nuovo test E2E: migration partial-fail → modal "Migrazione fallita" + emergency JSON download triggered

### Claude's Discretion

- **Implementazione `get_user_data()` RPC**: Postgres function vs view vs `.or()` query — Claude sceglie. Goal: una roundtrip.
- **`idb-keyval` version pinning**: Claude sceglie ultima stable.
- **CHECK constraint vs Postgres ENUM** per `scadenzaGiorno`: Claude sceglie (preferenza CHECK + text per flessibilità futura).
- **Lazy-load `idb-keyval`** o include in SW precache? Default: precache (è piccolo, e serve subito al boot per leggere queue residuale).
- **Topological sort implementation**: Claude sceglie (Kahn's algorithm in app.js, ~30 LOC).
- **Layout Inquilini CRUD**: Claude sceglie tra "sezione dedicata Impostazioni" vs "embedded in scheda proprietà". Preferenza: entrambe (Impostazioni = global CRUD, proprietà = quick link).
- **Conflict toast styling**: usa pattern toast esistente (PR1 undo toast), con varianti color per gravità.
- **Cache version auto-bump strategy** del SW al deploy (TODO aperto pre-PR2b dalla wiki): Claude propone uno schema durante research.
- **`tipi_utenza` seed strategy**: insert al primo login (idempotent) o seed via RPC.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked decisions (sources of truth)
- `wiki/projects/gestione-affitti-ceo-plan-20260517.md` — CEO plan SELECTIVE EXPANSION, sezione PR2b (linee 50-60, 102-145, 161-186), Risk Register R1+R4, Critical gaps risolti, Eng review additions (FK-aware, iOS SW)
- `.planning/intel/decisions.md` — DEC-005 (inquilini entità), DEC-007 (tipi utenza dinamici), DEC-008 (scadenze custom), DEC-012 (dual-write 2 weeks + rollback flag), DEC-013 (FK-aware queue + binary conflict)
- `.planning/intel/constraints.md` — CON-016 (single RPC at login), CON-017 (5 LOCKED regression tests gate)
- `.planning/REQUIREMENTS.md` — REQ-SCHEMA-01, REQ-SYNC-01, REQ-SYNC-02, REQ-DATA-01, REQ-DATA-02, REQ-DATA-03
- `.planning/ROADMAP.md` — Phase 5 success criteria (6 must-haves)

### Phase predecessor artifacts
- `.planning/phases/03-pr1-data-safety-net/03-01-SUMMARY.md` — Cestino, snapshot ring, undo toast, Salute dati (estesa qui), app.js extraction (queue logic vive qui)
- `.planning/phases/04-pr2a-pwa-shell-manifest-sw/04-01-SUMMARY.md` — `sw.js` lifecycle, precache list (aggiungere `idb-keyval`), Stale-While-Revalidate (cache version bump per Phase 3 blob removal)
- `wiki/concepts/alpine-reactive-trigger-for-external-source.md` — pattern counter-bumping per getter che leggono da fonte esterna (riusabile per `mutationQueue()` getter)
- `wiki/concepts/sw-precache-resilient.md` — `Promise.allSettled` per precache CDN (riusabile per `idb-keyval`)

### Codebase entry points (read before modificare)
- `app.js` — `salva()`, `caricaDatiUtente()`, `migraDati()` (versionamento dataVersion), `importaJSON`, `esportaJSON`, snapshot ring (PR1)
- `index.html` — root `<div x-data="app()">` (host del conflict toast), form proprietà (aggiunge `scadenzaGiorno`), form utenza (dropdown da tipi_utenza), Impostazioni (Cestino, Salute dati, nuove sezioni Inquilini + Tipi utenza)
- `sw.js` — precache list (aggiungere `idb-keyval`), `online` event handler (trigger queue flush)
- `playwright/tests/` — pattern per nuovi E2E (offline, conflict, migration)

### External docs
- Supabase RPC: `https://supabase.com/docs/guides/database/functions`
- Supabase RLS: `https://supabase.com/docs/guides/auth/row-level-security`
- idb-keyval: `https://github.com/jakearchibald/idb-keyval`
- Topological sort (Kahn): standard algorithm

</canonical_refs>

<specifics>
## Specific Ideas

### Architettura Supabase (dal CEO plan diagramma)

```
auth.users
  └─ proprieta (id, user_id, nome, importo, currency, banca_id, scadenzaGiorno, updated_at, created_at, deleted_at)
      ├─ incassi_affitti (id, user_id, proprieta_id, mese, anno, importo, currency, data_incasso, modificatoManualmente, updated_at, created_at, deleted_at)
      ├─ utenze (id, user_id, proprieta_id, tipo_id, importo, stato, data_ricezione, data_scadenza, data_pagamento, updated_at, created_at, deleted_at)
      │   └─ tipi_utenza (id, user_id, nome, updated_at, created_at)
      └─ inquilini (id, user_id, proprieta_id, nome, codice_fiscale, telefono, email, updated_at, created_at, deleted_at)
banche (id, user_id, nome, currency, updated_at, created_at, deleted_at)
```

Soft-delete (`deleted_at`) preservato da PR1.

### Topological order (statico, basta hardcoded)
`['tipi_utenza', 'banche', 'proprieta', 'inquilini', 'incassi_affitti', 'utenze']`

### Conflict toast wireframe (Italian copy locked)
```
┌─────────────────────────────────────────────┐
│  ⚠  Conflitto su Appartamento Via Roma     │
│                                             │
│  Hai modificato questa proprietà mentre era │
│  offline. Nel frattempo è stata modificata  │
│  anche dal cloud.                           │
│                                             │
│  Quale versione vuoi tenere?                │
│  [ Usa la mia versione ]  [ Usa versione   │
│                              cloud ]        │
└─────────────────────────────────────────────┘
```

### `get_user_data()` RPC shape (proposed)
```sql
create or replace function get_user_data()
returns json language sql security definer as $$
  select json_build_object(
    'proprieta', (select coalesce(json_agg(p), '[]'::json) from proprieta p where user_id = auth.uid() and deleted_at is null),
    'incassi_affitti', (...),
    'utenze', (...),
    'banche', (...),
    'inquilini', (...),
    'tipi_utenza', (...)
  );
$$;
```

### Default tipi_utenza seed (idempotent on first migration)
`acqua`, `luce`, `gas` — esattamente i 3 attuali hardcoded

</specifics>

<deferred>
## Deferred Ideas

### Esplicitamente fuori scope Phase 5
- Field-level merge conflict resolution (eng-review REJECTED 17/05 — riconsiderare se family-tier cresce)
- 4-week dual-write timeline (2 settimane accettate; estendere solo se telemetria mostra utenti non migrati dopo 2w)
- IndexedDB write debounce (premature; rivisitare se vedi lag mobile post-rollout)
- Backup automatico cifrato Drive/Dropbox (out of scope progetto)

### Pre-PR2b TODO dalla wiki (NON bloccanti, da fare durante o prima di execute)
- 15 min observation del fratello che usa l'app PWA installata (per ri-prioritizzare PR3, può accadere in parallelo a planning)
- Decisione cache version auto-bump strategy del SW (CLAUDE'S DISCRETION sopra — research deve proporre)

### Da rivisitare post-PR2b
- Removal definitivo blob fallback (Phase 3 di DEC-012) — dopo 2 settimane di stabilità
- Telemetria utenti non-ancora-migrati (semplice flag in Salute dati admin)

</deferred>

---

*Phase: 05-pr2b-schema-migration-sync*
*Context gathered: 2026-05-20 via PRD Express Path (CEO plan 17/05 + REQUIREMENTS.md + ROADMAP.md)*
