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

<pre_execute_decisions>
## Pre-Execute Decisions (locked 2026-05-20, post PLAN-CHECK)

PLAN-CHECK del 20/05 ha segnalato 3 MEDIUM. Decisioni risolutive prima di execute:

### DEC-OQ-2: naming convention boundary (snake_case ↔ camelCase) — LOCKED

**Problema**: SQL Postgres conventions vogliono `snake_case` (es. `scadenza_giorno`, `data_pagamento`, `codice_fiscale`). Il codice JS esistente in `app.js` usa `camelCase` (`scadenzaGiorno`, `dataPagamento`, `codiceFiscale`). RPC `get_user_data()` ritorna JSON con keys snake_case di default.

**Decisione**:
1. **SQL canonical**: tutte le colonne nelle tabelle nuove usano `snake_case`. Esempi: `scadenza_giorno`, `data_pagamento`, `data_incasso`, `data_ricezione`, `data_scadenza`, `codice_fiscale`, `modificato_manualmente`, `proprieta_id`, `tipo_id`, `banca_id`, `deleted_at`, `updated_at`, `created_at`, `user_id`.
2. **JS canonical**: in-memory state e UI bindings usano `camelCase`. Esempi: `scadenzaGiorno`, `dataPagamento`, `codiceFiscale`, `modificatoManualmente`, `proprietaId`, `tipoId`, `bancaId`, `deletedAt`, `updatedAt`, `createdAt`, `userId`.
3. **Boundary helper `adattaShape()`** in `app.js`: due funzioni pure inverse:
   - `snakeToCamel(row)`: applicato sulle response del RPC e su ogni read da Supabase. Trasforma ogni key ricorsivamente.
   - `camelToSnake(obj)`: applicato a ogni payload prima di `.insert()` / `.update()` / `.upsert()` Supabase. Trasforma ogni key ricorsivamente.
4. **Implementazione**: ~30 LOC totali, vanilla JS, no dipendenze. Pattern:
   ```js
   const snakeToCamel = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
   const camelToSnake = (k) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
   function adattaShape(obj, conv) {
     if (Array.isArray(obj)) return obj.map(x => adattaShape(x, conv));
     if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
       return Object.fromEntries(Object.entries(obj).map(([k, v]) => [conv(k), adattaShape(v, conv)]));
     }
     return obj;
   }
   const fromDb = (row) => adattaShape(row, snakeToCamel);
   const toDb = (obj) => adattaShape(obj, camelToSnake);
   ```
5. **Edge case**: gli ID UUID sono già senza separatori, no transform.
6. **Entry point**: aggiungere `fromDb`/`toDb` come prime utility nel file `app.js` subito dopo `import` (o dopo `supabase` init). Tutte le RPC/query nuove devono usarle. Le RPC/query vecchie sul blob NON sono toccate (continuano a esistere durante dual-write).

**Plan impact**:
- 05-01 T-05-01-03 (dual-read adapter): DEVE usare `fromDb` sulla response RPC
- 05-01 task NEW da inserire pre-T-05-01-03: **T-05-01-02b — Aggiungere helper `adattaShape` + `fromDb`/`toDb` in app.js** (~30 LOC, wave 1, depends_on T-05-01-02)
- 05-02 mutation queue: payload memorizzato in IDB è in formato camelCase (JS-native). Conversione a snake_case avviene SOLO al momento del flush via `toDb()`.
- Tutti i piani: ogni task che tocca SQL DDL usa snake_case; ogni task che tocca state JS usa camelCase; ogni task che attraversa il boundary referenzia esplicitamente `fromDb` o `toDb`.

### DEC-EPIC-SPLIT-1: T-05-02-06 `salva()` refactor — split locked

**Problema**: T-05-02-06 originale (~150 LOC) refactor della funzione `salva()` per integrare la mutation queue è epic-sized. Single commit difficile da revisionare; rollback grezzo.

**Split in 3 sub-task** (tutti wave 2, sequenziali, depends_on T-05-02-05):
- **T-05-02-06a — Isolare logica salvataggio blob in `salvaBlobLegacy()`** (~40 LOC): estrarre il corpo attuale di `salva()` in nuova funzione. `salva()` diventa wrapper che chiama `salvaBlobLegacy()` immutato. Test: comportamento identico al precedente.
- **T-05-02-06b — Aggiungere router dual-write `salvaPerEntita()`** (~60 LOC): nuova funzione che per ogni dirty-entity push nella mutation queue + tenta flush online. Riusa `toDb()` (DEC-OQ-2) al boundary. Wrapper `salva()` ora chiama PRIMA `salvaPerEntita()` POI `salvaBlobLegacy()` (dual-write Phase 1). Test: entrambe le vie scrivono coerentemente.
- **T-05-02-06c — Aggiungere feature flag `localStorage.usaNuovoSchema`** (~30 LOC): se `false`, skip `salvaPerEntita()`. Se `true` (default post-rollout Phase 2), `salvaBlobLegacy()` resta attivo solo durante dual-write window (2 weeks). Test: toggle del flag riproduce vecchio comportamento.

### DEC-EPIC-SPLIT-2: T-05-04-04 Inquilini CRUD — split locked

**Problema**: T-05-04-04 originale (~150 LOC) implementazione completa CRUD inquilini in Impostazioni è epic-sized.

**Split in 3 sub-task** (tutti wave 3, sequenziali, depends_on T-05-04-03):
- **T-05-04-04a — Inquilini model + state Alpine + read list view** (~50 LOC): aggiungi `inquilini: []` allo state Alpine, popola da RPC, sezione Impostazioni "Inquilini" con tabella (nome, codice fiscale, telefono, proprietà). No form.
- **T-05-04-04b — Form add/edit inquilino + validation italiana** (~60 LOC): modal con campi nome (required), codice_fiscale (regex 16 char alfanumeric maiuscolo), telefono (opzionale), email (opzionale, regex), select proprietà. Submit chiama `salvaPerEntita()` con nuovo inquilino. Errori validation italiani inline.
- **T-05-04-04c — Inquilini soft-delete + cestino integration** (~40 LOC): bottone "Elimina" su ogni riga, set `deletedAt`. Estendere cestino esistente (PR1) con sezione "Inquilini eliminati" + ripristino. Hard-delete bloccato se ci sono incassi referencing inquilino (FK constraint Supabase).

**Risultato**: 4 task originali in 05-04-PLAN.md diventano 6 (5 + 2 sub-task extra = 7 totali). Estimate revisionato: 4.5h → 5h.

</pre_execute_decisions>

---

*Phase: 05-pr2b-schema-migration-sync*
*Context gathered: 2026-05-20 via PRD Express Path (CEO plan 17/05 + REQUIREMENTS.md + ROADMAP.md)*
