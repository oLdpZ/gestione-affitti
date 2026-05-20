# RESEARCH: Phase 5 — PR2b Schema migration + per-entity sync

**Date:** 2026-05-20
**Confidence:** HIGH (con 4 OQ residue su scelte di implementazione marginali, vedi §11)
**Researcher:** gsd-phase-researcher

Tutte le decisioni di architettura sono LOCKED nel CONTEXT/CEO plan; questa research mappa il codice esistente, falsifica le opzioni "Claude's Discretion", e produce skeleton SQL/JS riusabili dal planner. Le 8 domande del prompt sono tutte coperte (§4 idb-keyval; §3 RPC; §5 toposort; §6 toast; §8 cache version; §7 migration rollback; §4 falsification; §9 Playwright; §1 line-map).

---

## §1 Codebase line-map

Punti di contatto in `app.js` (1386 righe baseline post-PR2a) e `index.html` (1437 righe), con il numero di linea esatto trovato via grep:

| Touchpoint | File | Linea | Cosa cambia in PR2b |
|---|---|---|---|
| `migraDati(dati)` v3 | `app.js` | 63–93 | NESSUNA modifica (resta per blob legacy durante dual-write). Nuovo path "blob → per-entità" è uno script separato (vedi §7) |
| `datiEsempio()` | `app.js` | 43–60 | Esteso con `tipi_utenza` seed (acqua/luce/gas), `inquilini: []`, `scadenzaGiorno` su ogni proprietà |
| Alpine state slots (`dati`, `_lastSnapshotData`, `_snapshotVersion`) | `app.js` | 110, 123, 130 | +6 slot: `mutationQueue`, `_mutationQueueVersion`, `conflictQueue` (FIFO), `_conflictVersion`, `usaNuovoSchema`, `lastPullAt`/`lastPushAt` |
| `init()` body | `app.js` | 148–273 | +2 blocchi: (a) load `mutationQueue` da idb-keyval al boot (b) seed `usaNuovoSchema` da localStorage, default `true` |
| `online` listener | `app.js` | 247–250 | Estendere: oltre a `caricaDatiUtente()` aggiungere `flushMutationQueue()` |
| `attivi(arr)` helper | `app.js` | 277 | NESSUNA modifica (riusato per inquilini/tipi_utenza per soft-delete) |
| `pushSnapshot` | `app.js` | 374–391 | NESSUNA modifica (ring buffer ancora il rescue path per la migrazione, vedi §7) |
| `salva()` debounce | `app.js` | 810–843 | **Branch on `usaNuovoSchema`**: se `true` → enqueue mutazioni per-entità + tentativo sync; se `false` → percorso blob esistente |
| `salvaSubito()` upsert | `app.js` | 846–945 | Diventa `salvaSubitoBlob()` (path legacy). Nuovo `pushEntity(op, entity, id, payload)` con catch chain a 4 branch identico (auth/rls/network/unknown); 409 va a `enqueueConflict()` |
| `caricaDatiUtente()` | `app.js` | 717–805 | Branch on `usaNuovoSchema`: se `true` → `sb.rpc('get_user_data')`; fallback automatico a blob path se RPC ritorna nullable o tabelle vuote (dual-write Phase 1) |
| `esportaJSON()` | `app.js` | 946–952 | NESSUNA modifica (riusato come emergency export dalla migration partial-fail modal) |
| `importaJSON(event)` | `app.js` | 953–969 | Esteso per importare snapshot per-entità (riconosce shape: con `tipi_utenza` array → nuovo schema; altrimenti blob legacy → migraDati v3) |
| `generaIncassiAttesi()` | `app.js` | 971–1014 | Esteso per usare `prop.scadenzaGiorno` invece di `prop.scadenzaAffitto` (rename + backward-compat read) |
| `gruppiCalendario()` | `app.js` | ~1080+ | Grouping by `scadenzaGiorno` invece di hardcoded 1/15/fine_mese |
| `resetFormUtenza()` | `app.js` | 1249–1256 | `tipo: 'acqua'` → `tipo_id: <primo seed>` (lookup da `dati.tipi_utenza[0].id`) |
| Form proprietà save (`salvaProprieta`) | `app.js` | ~1305–1330 | Aggiungere field `scadenzaGiorno` + push mutazione `update` per-entità |
| Form utenza save | `app.js` | ~1267–1280 | Dropdown da `dati.tipi_utenza`, push mutazione per-entità |
| Form banca save | `app.js` | ~1360–1365 | Push mutazione `insert`/`update` per-entità |
| Form incasso save | `app.js` | ~1140–1180 | Push mutazione `insert`/`update` per-entità |
| Salute dati page | `index.html` | ~1100+ (Impostazioni section) | +4 widget: mutation queue count, last pull/push, open conflicts, "Flush manuale" button |
| Root `<div x-data="app()">` | `index.html` | 470 | Conflict toast lives here (sibling di undo toast / install banner) |
| Form proprietà HTML | `index.html` | ~830+ | Aggiungere select `scadenzaGiorno` (1-31 + fine_mese) |
| Form utenza HTML dropdown | `index.html` | 1005, 1027 | Hardcoded `<option value="acqua">...` → `<template x-for="t in dati.tipi_utenza" :key="t.id">` |
| Impostazioni — sezioni nuove | `index.html` | dopo Salute dati | Sezione "Inquilini" (CRUD list) + sezione "Tipi utenza" (CRUD list) |
| `PRECACHE_URLS` | `sw.js` | 17–30 | Aggiungere `https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js` |
| `CACHE_NAME` | `sw.js` | 15 | Bump `v1` → `v2` (parte di §8) |
| Stale SW unregister | `app.js` | 181–199 | NESSUNA modifica |
| `tests/offline.spec.ts` | tests | 1–15 | `.skip` → **LIVE**: setOffline + segna incasso + queue count + setOffline(false) + assert green dot |

**Baseline target post-PR2b** (stima): `app.js` ~1700 (+ ~314 per mutation queue, conflict handling, dual-write, migration script, RPC path); `index.html` ~1560 (+ ~120 per Inquilini/Tipi utenza CRUD + conflict toast + Salute dati widgets); `sw.js` ~140 (+ 6 per precache idb-keyval + cache name bump).

---

## §2 Schema target (DDL)

DDL completo per il SQL editor Supabase. Eseguire una volta in produzione (idempotente via `IF NOT EXISTS`). Salvato in commit separato in `.planning/phases/05-pr2b-schema-migration-sync/schema.sql` durante execute.

```sql
-- ============================================================================
-- PR2b SCHEMA — gestione-affitti v4
-- Eseguire UNA volta. Ogni statement idempotente.
-- ============================================================================

-- 1. EXTENSION (uuid_generate_v4 alternativo: gen_random_uuid() built-in Postgres 13+)

-- 2. updated_at trigger function (riusato da tutte le tabelle)
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. tipi_utenza (root, no FK uscenti)
create table if not exists tipi_utenza (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, nome)
);
alter table tipi_utenza enable row level security;
create policy "tipi_utenza_owner" on tipi_utenza for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger tipi_utenza_updated before update on tipi_utenza for each row execute function set_updated_at();

-- 4. banche
create table if not exists banche (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  intestatario text,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table banche enable row level security;
create policy "banche_owner" on banche for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger banche_updated before update on banche for each row execute function set_updated_at();

-- 5. proprieta
create table if not exists proprieta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo text default 'appartamento',
  importo_affitto_mensile numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  banca_incasso_id uuid references banche(id) on delete set null,
  banca_destinazione_id uuid references banche(id) on delete set null,
  intestatario text,
  scadenza_giorno text not null default '1'
    check (scadenza_giorno = 'fine_mese' or (scadenza_giorno ~ '^[0-9]{1,2}$' and scadenza_giorno::int between 1 and 31)),
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table proprieta enable row level security;
create policy "proprieta_owner" on proprieta for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger proprieta_updated before update on proprieta for each row execute function set_updated_at();

-- 6. inquilini
create table if not exists inquilini (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proprieta_id uuid references proprieta(id) on delete set null,
  nome text not null,
  codice_fiscale text check (codice_fiscale is null or char_length(codice_fiscale) = 16),
  telefono text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table inquilini enable row level security;
create policy "inquilini_owner" on inquilini for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger inquilini_updated before update on inquilini for each row execute function set_updated_at();

-- 7. incassi_affitti
create table if not exists incassi_affitti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proprieta_id uuid not null references proprieta(id) on delete cascade,
  banca_id uuid references banche(id) on delete set null,
  banca_destinazione_id uuid references banche(id) on delete set null,
  mese text not null, -- 'YYYY-MM'
  anno int generated always as (substring(mese, 1, 4)::int) stored,
  importo numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  data_incasso date,
  modificato_manualmente boolean not null default false,
  girato boolean not null default false,
  data_giro date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table incassi_affitti enable row level security;
create policy "incassi_owner" on incassi_affitti for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger incassi_updated before update on incassi_affitti for each row execute function set_updated_at();

-- 8. utenze
create table if not exists utenze (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proprieta_id uuid not null references proprieta(id) on delete cascade,
  tipo_id uuid not null references tipi_utenza(id) on delete restrict,
  fornitore text,
  periodo_riferimento text,
  importo numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  data_scadenza date,
  data_ricezione date,
  data_pagamento date,
  stato text default 'da_ricevere'
    check (stato in ('da_ricevere','da_pagare','pagata','rimborsata_inquilino')),
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table utenze enable row level security;
create policy "utenze_owner" on utenze for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger utenze_updated before update on utenze for each row execute function set_updated_at();

-- 9. INDEXES (performance hint)
create index if not exists idx_proprieta_user on proprieta(user_id) where deleted_at is null;
create index if not exists idx_incassi_user_propmese on incassi_affitti(user_id, proprieta_id, mese);
create index if not exists idx_utenze_user_prop on utenze(user_id, proprieta_id) where deleted_at is null;
create index if not exists idx_inquilini_prop on inquilini(proprieta_id) where deleted_at is null;
```

**Note RLS**: `auth.users` cascade on delete è importante per GDPR/eliminazione account. `tipi_utenza` ha `on delete restrict` per `utenze.tipo_id` → forza pre-check applicativo (locked in CONTEXT).

---

## §3 `get_user_data()` RPC

```sql
create or replace function get_user_data()
returns json
language sql
security invoker  -- DELIBERATAMENTE invoker, non definer (vedi rationale)
set search_path = public
stable
as $$
  select json_build_object(
    'tipi_utenza',     coalesce((select json_agg(t.*) from tipi_utenza t where t.user_id = auth.uid()), '[]'::json),
    'banche',          coalesce((select json_agg(b.*) from banche b where b.user_id = auth.uid() and b.deleted_at is null), '[]'::json),
    'proprieta',       coalesce((select json_agg(p.*) from proprieta p where p.user_id = auth.uid() and p.deleted_at is null), '[]'::json),
    'inquilini',       coalesce((select json_agg(i.*) from inquilini i where i.user_id = auth.uid() and i.deleted_at is null), '[]'::json),
    'incassi_affitti', coalesce((select json_agg(ic.*) from incassi_affitti ic where ic.user_id = auth.uid() and ic.deleted_at is null), '[]'::json),
    'utenze',          coalesce((select json_agg(u.*) from utenze u where u.user_id = auth.uid() and u.deleted_at is null), '[]'::json),
    'cestino', json_build_object(
      'banche',    coalesce((select json_agg(b.*) from banche b where b.user_id = auth.uid() and b.deleted_at is not null), '[]'::json),
      'proprieta', coalesce((select json_agg(p.*) from proprieta p where p.user_id = auth.uid() and p.deleted_at is not null), '[]'::json),
      'inquilini', coalesce((select json_agg(i.*) from inquilini i where i.user_id = auth.uid() and i.deleted_at is not null), '[]'::json),
      'incassi_affitti', coalesce((select json_agg(ic.*) from incassi_affitti ic where ic.user_id = auth.uid() and ic.deleted_at is not null), '[]'::json),
      'utenze',    coalesce((select json_agg(u.*) from utenze u where u.user_id = auth.uid() and u.deleted_at is not null), '[]'::json)
    )
  );
$$;

grant execute on function get_user_data() to authenticated;
```

**Falsification SECURITY DEFINER vs INVOKER**:
- **SECURITY DEFINER** richiede `set search_path = ''` per evitare search_path attacks (Supabase docs raccomandano questo pattern solo se serve elevation oltre RLS). Qui non serve: l'RLS basato su `user_id = auth.uid()` fa già da gate, e con INVOKER ogni `select` rispetta automaticamente le policy che abbiamo definito. Più sicuro, meno surface area.
- Performance: invariata. La RPC è un singolo roundtrip che PostgREST mappa a `POST /rpc/get_user_data`. Postgres pianifica come una singola query con 6 sub-select + index hits.
- `stable` + `set search_path = public` per query planner optimization e safety.

**Performance target**: < 200ms p95 su Supabase free tier con 50 proprietà, 600 incassi, 200 utenze (volumi tipici single-family-tier 5yr). Indice principale: `idx_*_user`. Da verificare con `EXPLAIN ANALYZE` durante execute.

**Chiamata client**: `await sb.rpc('get_user_data')` → `{ data, error }`. `data` è il JSON costruito, già parsato dal client Supabase.

---

## §4 `idb-keyval` integration

### Versione e CDN

- **Latest stable**: `idb-keyval@6.2.2` (npm last published Q2 2025; uso production-tested in 911+ progetti).
- **CDN UMD** (esposto come global `idbKeyval`): `https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.js`
- **Size**: ~4 KB minified, ~1.5 KB gzipped. Adatto a precache (negligible footprint vs Tailwind ~80KB già precachato).
- **Browser support**: tutti i target del progetto (Chrome desktop+Android, Safari iOS 14+). IndexedDB API è universalmente supportata.

### Tag script in `index.html` (riga vicina ad altri CDN, ~17-21):

```html
<script src="https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.js" defer></script>
```

`defer` ordina dopo Supabase/Alpine (già defer). All'init di `app()` la global `idbKeyval` è disponibile.

### API surface usata (3 funzioni soltanto)

```js
// Lettura (al boot, in init)
const queue = await idbKeyval.get('mutationQueue') || [];

// Scrittura (dopo ogni enqueue / dequeue / clear)
await idbKeyval.set('mutationQueue', this.mutationQueue);

// Reset (raro: solo in /reset debug o post-migrazione successful)
await idbKeyval.del('mutationQueue');
```

`get`/`set`/`del` ritornano Promises. Sempre `await`.

### SW precache addition

In `sw.js` riga ~30:
```js
'https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.js',
```

E `CACHE_NAME` bump (vedi §8).

### iOS Safari standalone PWA — quirks noti (FALSIFICATION)

1. **iOS 13.x bug "IndexedDB wipes data after 7 days of no use"**: il bug ITP è stato risolto in iOS 14.4+ per app installate (manifest standalone). Target del progetto è iOS 16+ (display: standalone funziona). Non blocker.
2. **Private browsing mode**: IndexedDB è disabilitato (returns error). Mitigation: try/catch attorno a `idbKeyval.get` con fallback in-memory queue (perde su refresh ma non crasha). Documentare in §10.
3. **Concurrent tabs**: IndexedDB supporta multi-tab via `versionchange` events. `idb-keyval` non gestisce sync cross-tab automaticamente. Per il nostro use-case (single-user, mobile-first PWA standalone) il rischio race è basso: assumiamo "una sola finestra utente attiva". Mitigation light: al boot leggere queue + last-write-wins è OK; se 2 tab attivi scrivono in race, una vince e l'altra perde una entry (recoverable via snapshot ring di PR1).
4. **Quota**: idb-keyval scrive in IndexedDB; Safari iOS quota ~50MB iniziale (può chiedere persistent storage). Una mutation entry è ~200-500 byte JSON; 10000 entry = 5MB. Lontanissimo dal limite.

**Verdict**: drop-in safe, no fallback in-memory necessario (private browsing è edge case minore — login non funziona comunque senza localStorage).

---

## §5 Mutation queue design

### Entry shape (locked in CONTEXT linea 49)

```js
{
  op: 'insert' | 'update' | 'delete',
  entity: 'tipi_utenza' | 'banche' | 'proprieta' | 'inquilini' | 'incassi_affitti' | 'utenze',
  id: '<uuid>',                  // PK dell'entity
  payload: { ...fields },        // intero record per insert/update; { id } per delete (soft)
  ts: 1747800000000,             // Date.now() al momento dell'enqueue
  attempts: 0,                    // incrementato a ogni 5xx retry
  baseUpdatedAt: '<ISO>' | null  // per 409 detection: server confronta con suo updated_at
}
```

### Topological order — FALSIFICATION

Il graph FK è **statico e noto a compile-time**:
```
tipi_utenza → (nessun parent)
banche → (nessun parent)
proprieta → banche
inquilini → proprieta
incassi_affitti → proprieta, banche
utenze → proprieta, tipi_utenza
```

**Domanda**: serve davvero Kahn's algorithm runtime? **Risposta: NO.** L'ordine è fisso:

```js
const ENTITY_FLUSH_ORDER = ['tipi_utenza', 'banche', 'proprieta', 'inquilini', 'incassi_affitti', 'utenze'];

function sortQueue(queue) {
  return queue.slice().sort((a, b) => {
    const ai = ENTITY_FLUSH_ORDER.indexOf(a.entity);
    const bi = ENTITY_FLUSH_ORDER.indexOf(b.entity);
    if (ai !== bi) return ai - bi;
    return a.ts - b.ts; // FIFO entro stessa entity
  });
}
```

**8 righe invece di ~30**. Kahn's algorithm sarebbe over-engineering. Eccezione: se in futuro si aggiungesse una self-FK (es. `inquilini.padrone_id → inquilini.id`) servirebbe vero toposort — ma fino ad allora YAGNI. Decisione: hardcoded order, commento nel codice che spiega la falsificazione e il quando-reintrodurre Kahn.

### Flush algoritmo (skeleton ~50 LOC)

```js
async function flushMutationQueue() {
  if (!navigator.onLine) return;
  if (this._flushing) return;          // re-entrancy guard
  this._flushing = true;
  try {
    while (this.mutationQueue.length > 0) {
      const sorted = sortQueue(this.mutationQueue);
      const entry = sorted[0];
      try {
        await this.applyMutation(entry); // singolo network call
        // success: rimuovi dall'array originale (non sorted clone)
        const idx = this.mutationQueue.findIndex(e => e.ts === entry.ts && e.id === entry.id && e.entity === entry.entity);
        if (idx >= 0) this.mutationQueue.splice(idx, 1);
        this._mutationQueueVersion++;
        await idbKeyval.set('mutationQueue', this.mutationQueue);
        this.lastPushAt = new Date().toISOString();
      } catch (e) {
        const status = e?.status || e?.code;
        if (status === 409 || status === '409') {
          this.enqueueConflict(entry, e); // toast (§6); pop entry dalla queue
          const idx = this.mutationQueue.findIndex(/* same as above */);
          if (idx >= 0) this.mutationQueue.splice(idx, 1);
          this._mutationQueueVersion++;
          await idbKeyval.set('mutationQueue', this.mutationQueue);
          continue;
        }
        if (status === 401 || status === '401' || /jwt|token/i.test(e?.message || '')) {
          const { error: rErr } = await sb.auth.refreshSession();
          if (rErr) { this.mostraToast('warn', 'Sessione scaduta'); break; }
          continue; // retry same entry trasparente
        }
        if (status >= 500 || /5\d{2}/.test(String(status))) {
          entry.attempts = (entry.attempts || 0) + 1;
          if (entry.attempts >= 3) {
            this.pushErrore({ message: `queue: ${entry.entity} ${entry.id} max retries`, severity: 'error' });
            break; // smetti, lasciala in coda; "1 modifica in coda" indicator visible
          }
          await new Promise(r => setTimeout(r, [1000, 3000, 9000][entry.attempts - 1]));
          continue;
        }
        // network / altro: lascia in coda, esci silently
        this.pushErrore({ message: `queue: ${e?.message || 'unknown'}`, severity: 'warn' });
        break;
      }
    }
  } finally {
    this._flushing = false;
  }
}
```

### Wiring al boot e su `online`

- `init()`: dopo Supabase setup, prima del primo `caricaDatiUtente`, leggere queue da idb-keyval: `this.mutationQueue = (await idbKeyval.get('mutationQueue')) || []; this._mutationQueueVersion++;`
- Listener esistente in `app.js:247` (`window.addEventListener('online', ...)`) esteso con `await this.flushMutationQueue();` PRIMA di `caricaDatiUtente()`.
- Bottone manuale in Salute dati → chiama stesso `flushMutationQueue()`.

### Alpine reactivity per "N modifiche in coda" indicator

Pattern PR2a `_snapshotVersion` (vedi `wiki/concepts/alpine-reactive-trigger-for-external-source.md`):
```js
mutationQueueCount() {
  void this._mutationQueueVersion;
  return this.mutationQueue.length;
}
```
Indicator template:
```html
<div x-show="mutationQueueCount() > 0 && !navigator.onLine" class="toast-queue">
  <span x-text="mutationQueueCount() + ' modifiche in coda'"></span>
</div>
```

Nota: `!navigator.onLine` non è reattivo nativamente. Trick: aggiungere `_isOnline: navigator.onLine` slot in data + listener `online`/`offline` che bumpa lo slot. Documentare come learning post-PR2b se applicato.

---

## §6 Conflict toast UX

### Multi-conflict queue strategy

Decisione: **FIFO modal stack, una visibile alla volta** (no toast multipli sovrapposti che generano panic UX).

```js
// state
conflictQueue: [],       // [{ entity, id, localPayload, serverPayload, ts }, ...]
_conflictVersion: 0,

// enqueue (chiamato da flushMutationQueue su 409)
async enqueueConflict(entry, e) {
  // Fetch server state per mostrare diff
  const { data: serverRow } = await sb.from(entry.entity).select('*').eq('id', entry.id).maybeSingle();
  this.conflictQueue.push({
    entity: entry.entity,
    id: entry.id,
    localPayload: entry.payload,
    serverPayload: serverRow,
    nomeEntita: this.nomeUmano(entry.entity, entry.payload), // "Appartamento Via Roma"
    ts: Date.now(),
  });
  this._conflictVersion++;
},

conflittoCorrente() {
  void this._conflictVersion;
  return this.conflictQueue[0] || null;
},

async risolviConflitto(scelta) {
  const c = this.conflictQueue.shift();
  if (!c) return;
  if (scelta === 'mia') {
    // Force update senza updated_at check
    await sb.from(c.entity).update({ ...c.localPayload, updated_at: new Date().toISOString() }).eq('id', c.id);
    // Aggiorna stato locale (già coerente con localPayload)
  } else {
    // Discard local: applica serverPayload allo stato Alpine
    this.applyServerEntity(c.entity, c.serverPayload);
  }
  this._conflictVersion++;
  await this.flushMutationQueue(); // riprendi
}
```

### Template HTML (root di `<div x-data="app()">`, riga 470, sibling di undo toast)

```html
<div x-show="conflittoCorrente()" data-testid="conflict-toast"
     class="modal-overlay" x-transition>
  <div class="modal-card">
    <h3>⚠ Conflitto su <span x-text="conflittoCorrente()?.nomeEntita"></span></h3>
    <p>Hai modificato questa <span x-text="conflittoCorrente()?.entity"></span>
       mentre eri offline. Nel frattempo è stata modificata anche dal cloud.</p>
    <p>Quale versione vuoi tenere?</p>
    <div class="modal-actions">
      <button @click="risolviConflitto('mia')" data-testid="conflict-keep-local">Usa la mia versione</button>
      <button @click="risolviConflitto('cloud')" data-testid="conflict-keep-server">Usa versione cloud</button>
    </div>
  </div>
</div>
```

Copy italiano locked in CONTEXT linea 162-167. Non dismissible (no overlay click-to-close, no Esc) — utente DEVE scegliere; cumula in queue se più conflitti.

### `nomeUmano(entity, payload)` helper

Lookup table per entità → field che è il "nome utente-visibile":
- `proprieta.nome`, `banche.nome`, `inquilini.nome`, `tipi_utenza.nome`
- `incassi_affitti` → `"Incasso ${mese} su ${nome proprietà}"` (cross-lookup)
- `utenze` → `"${tipo} ${fornitore} ${data_scadenza}"`

---

## §7 Migration script

### Idempotency check

```js
async migraBlobAPerEntita() {
  if (!this.utente) return;
  // 1. Pre-check: ha blob? le tabelle nuove sono vuote?
  const { data: blobRow } = await sb.from('user_data').select('data').eq('user_id', this.utente.id).maybeSingle();
  if (!blobRow?.data || !blobRow.data.proprieta) return; // niente da migrare
  const { count: pCount } = await sb.from('proprieta').select('id', { count: 'exact', head: true });
  if (pCount > 0) return; // già migrato

  // 2. Backup emergency (snapshot ring di PR1 + download JSON)
  this.pushSnapshot(this._lastSnapshotData || this.dati);
  this.esportaJSON(); // triggera download backup-YYYYMMDD.json

  // 3. RPC atomica server-side (vedi sotto)
  const { error } = await sb.rpc('migrate_blob_to_entities', { blob: blobRow.data });
  if (error) {
    this.modalitaMigrazioneFallita = true; // mostra modal blocking
    this.pushErrore({ message: 'migration: ' + error.message, severity: 'error' });
    return;
  }
  // 4. Success: ricarica via RPC nuova
  await this.caricaDatiUtente();
}
```

### Transaction wrapper PL/pgSQL (skeleton)

```sql
create or replace function migrate_blob_to_entities(blob jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prop jsonb;
  inc jsonb;
  ut jsonb;
  banca jsonb;
  tipo_id_acqua uuid;
  tipo_id_luce uuid;
  tipo_id_gas uuid;
begin
  if uid is null then raise exception 'unauthenticated'; end if;

  -- Tipi utenza seed (idempotent)
  insert into tipi_utenza (user_id, nome) values (uid, 'acqua') on conflict (user_id, nome) do nothing returning id into tipo_id_acqua;
  if tipo_id_acqua is null then select id into tipo_id_acqua from tipi_utenza where user_id = uid and nome = 'acqua'; end if;
  insert into tipi_utenza (user_id, nome) values (uid, 'luce') on conflict (user_id, nome) do nothing returning id into tipo_id_luce;
  if tipo_id_luce is null then select id into tipo_id_luce from tipi_utenza where user_id = uid and nome = 'luce'; end if;
  insert into tipi_utenza (user_id, nome) values (uid, 'gas') on conflict (user_id, nome) do nothing returning id into tipo_id_gas;
  if tipo_id_gas is null then select id into tipo_id_gas from tipi_utenza where user_id = uid and nome = 'gas'; end if;

  -- Banche
  for banca in select * from jsonb_array_elements(coalesce(blob->'banche', '[]'::jsonb)) loop
    insert into banche (id, user_id, nome, intestatario, currency, deleted_at)
    values (
      (banca->>'id')::uuid, uid,
      banca->>'nome', banca->>'intestatario',
      coalesce(banca->>'currency', 'EUR'),
      (banca->>'deletedAt')::timestamptz
    )
    on conflict (id) do nothing;
  end loop;

  -- Proprieta
  for prop in select * from jsonb_array_elements(coalesce(blob->'proprieta', '[]'::jsonb)) loop
    insert into proprieta (id, user_id, nome, tipo, importo_affitto_mensile, currency, banca_incasso_id, banca_destinazione_id, intestatario, scadenza_giorno, note, deleted_at)
    values (
      (prop->>'id')::uuid, uid,
      prop->>'nome', coalesce(prop->>'tipo', 'appartamento'),
      coalesce((prop->>'importoAffittoMensile')::numeric, 0),
      coalesce(prop->>'currency', 'EUR'),
      nullif(prop->>'bancaIncasso', '')::uuid,
      nullif(prop->>'bancaDestinazione', '')::uuid,
      prop->>'intestatario',
      coalesce(prop->>'scadenzaAffitto', '1'),
      coalesce(prop->>'note', ''),
      (prop->>'deletedAt')::timestamptz
    )
    on conflict (id) do nothing;
  end loop;

  -- Incassi
  for inc in select * from jsonb_array_elements(coalesce(blob->'incassiAffitti', '[]'::jsonb)) loop
    insert into incassi_affitti (id, user_id, proprieta_id, banca_id, banca_destinazione_id, mese, importo, currency, data_incasso, modificato_manualmente, girato, data_giro, deleted_at)
    values (
      (inc->>'id')::uuid, uid,
      (inc->>'proprietaId')::uuid,
      nullif(inc->>'bancaId', '')::uuid,
      nullif(inc->>'bancaDestinazioneId', '')::uuid,
      inc->>'mese',
      coalesce((inc->>'importo')::numeric, 0),
      coalesce(inc->>'currency', 'EUR'),
      nullif(inc->>'dataIncasso', '')::date,
      coalesce((inc->>'modificatoManualmente')::boolean, false),
      coalesce((inc->>'girato')::boolean, false),
      nullif(inc->>'dataGiro', '')::date,
      (inc->>'deletedAt')::timestamptz
    )
    on conflict (id) do nothing;
  end loop;

  -- Utenze (mappa string 'tipo' → tipo_id)
  for ut in select * from jsonb_array_elements(coalesce(blob->'utenze', '[]'::jsonb)) loop
    insert into utenze (id, user_id, proprieta_id, tipo_id, fornitore, periodo_riferimento, importo, currency, data_scadenza, stato, note)
    values (
      coalesce(nullif(ut->>'id', '')::uuid, gen_random_uuid()), uid,
      (ut->>'proprietaId')::uuid,
      case ut->>'tipo'
        when 'acqua' then tipo_id_acqua
        when 'luce'  then tipo_id_luce
        when 'gas'   then tipo_id_gas
        else tipo_id_acqua  -- fallback safe; warning loggato applicativo
      end,
      ut->>'fornitore',
      ut->>'periodoRiferimento',
      coalesce((ut->>'importo')::numeric, 0),
      coalesce(ut->>'currency', 'EUR'),
      nullif(ut->>'dataScadenza', '')::date,
      coalesce(ut->>'stato', 'da_ricevere'),
      coalesce(ut->>'note', '')
    )
    on conflict (id) do nothing;
  end loop;

exception
  when others then
    -- PL/pgSQL: any exception causes implicit rollback of the function scope.
    -- Re-raise so client riceve l'errore e mostra modal "Migrazione fallita".
    raise;
end;
$$;

grant execute on function migrate_blob_to_entities(jsonb) to authenticated;
```

### Falsification — true transaction from browser?

**Domanda originale**: il client Supabase può triggherare una vera transazione da browser? **Risposta: NO direttamente**. PostgREST espone REST endpoint stateless: ogni request è una transazione singola. Non c'è BEGIN/COMMIT client-side.

**Soluzione adottata**: PL/pgSQL function. In Postgres una function `language plpgsql` (default) gira **dentro una singola transazione** automaticamente. Qualsiasi `raise exception` rollbacka tutto. Questo è la garanzia atomicità "all-or-nothing" richiesta da DEC-012/R1.

Falsificate:
- **Client-side compensating writes (option b)**: rifiutata. Richiede tracking di cosa è andato e cosa no, e in caso di network drop a metà rollback i compensating writes possono falliro lasciando stato inconsistente. Strictly inferiore alla function lato server.
- **Edge function (Deno)**: over-engineering. PL/pgSQL function ha already-built atomicity, niente cold-start, niente costo extra.

### Dual-write window mechanics (2 settimane, DEC-012)

- **Phase 1 deploy** (questo PR2b merge): app legge da entrambi schemi. `caricaDatiUtente`:
  ```js
  if (this.usaNuovoSchema) {
    const { data, error } = await sb.rpc('get_user_data');
    if (data && data.proprieta && data.proprieta.length > 0) {
      this.dati = this.adattaShape(data);   // converti snake_case → camelCase per backward-compat con index.html
      return;
    }
    // tabelle vuote → migra
    await this.migraBlobAPerEntita();
    // poi rileggi
    const r2 = await sb.rpc('get_user_data');
    if (r2.data) { this.dati = this.adattaShape(r2.data); return; }
  }
  // Fallback blob legacy (Phase 1/2: sicurezza)
  await this.caricaDatiUtenteBlob(); // = vecchio path
  ```
- **Write-through dual**: durante Phase 1, ogni mutazione scrive a entrambi i path:
  1. Aggiorna `this.dati` (in-memory)
  2. Enqueue mutazione per-entità (nuovo schema, via mutation queue)
  3. ALSO `salvaSubitoBlob()` per blob legacy (rete diretta, no queue) — questo è il safety net
  Da implementare come decorator/wrapper attorno a `salva()`.
- **Phase 3 (futuro, +2 settimane)**: nuovo deploy che rimuove blob fallback. Bumps cache version (§8). Comunicazione fratello: "fai un login il [data]" garantisce migration triggered + post-migration uso solo nuovo schema.

### Rollback flag

```js
// init
this.usaNuovoSchema = localStorage.getItem('usaNuovoSchema') !== 'false';
// console emergency: localStorage.setItem('usaNuovoSchema', 'false'); location.reload();
```

In Impostazioni → Salute dati, sezione "Avanzato": toggle "Usa schema sperimentale" (default ON) → flip lo flag e reload. Per debugging produzione.

---

## §8 SW cache version auto-bump

### Recommendation: **CONTENT-HASH-IN-FILENAME via build-step-free script** (manual run pre-deploy)

GH Pages serve direttamente repo files, niente build step. Ma posso committare un piccolo script `scripts/bump-sw-cache.sh` che:

1. Calcola SHA-256 short (8 char) di `index.html + app.js + sw.js + manifest.json` concatenati
2. Sostituisce `const CACHE_NAME = 'gestione-affitti-v...'` con il nuovo hash
3. Git stage del cambiamento in `sw.js`

User flow:
```bash
$ bash scripts/bump-sw-cache.sh    # prima di git commit della release
$ git add sw.js && git commit ...
```

Hook opzionale: `pre-commit` hook che lo esegue se rileva file in `PRECACHE_URLS` modificati (ma rende l'esperienza opaca; preferenza esplicito manual per ora).

```bash
#!/usr/bin/env bash
set -e
HASH=$(cat index.html app.js sw.js manifest.json | sha256sum | cut -c1-8)
sed -i.bak -E "s/(CACHE_NAME = 'gestione-affitti-)[^']+'/\1${HASH}'/" sw.js
rm sw.js.bak
echo "CACHE_NAME bumped to gestione-affitti-${HASH}"
```

**Rationale**:
- Deterministico: stesso input → stesso hash. Nessun bump spurio se non cambia niente.
- No dipendenze (sha256sum è ovunque, sed pure).
- 5 righe di shell. Trivially auditable.

### Falsified alternatives

1. **Manual integer bump (`v1 → v2 → v3`)** — pattern attuale post-PR2a. **Rifiutato**: human error prone (developer dimentica → utenti restano su SW vecchio per giorni; cache pollution finché Stale-While-Revalidate non rifresca). Documentato come fallback se l'hash script crea friction.
2. **Timestamp from server header (`Last-Modified`)** — **Rifiutato**: GH Pages serve `Last-Modified` ma SW non lo vede al deploy-time, deve fare fetch first. Bootstrap problem: il SW vecchio deve scaricare il SW nuovo per scoprire che è nuovo. Doesn't help cache invalidation in SW logic itself.
3. **Fetch `/version.txt` runtime** — **Rifiutato**: aggiunge un fetch ogni boot. Cache di /version.txt diventa il problema (paradosso ricorsivo). Non vale la complessità.
4. **Git SHA injection at deploy** — **Rifiutato per ora**: GH Pages workflow non ha step di build. Si potrebbe aggiungere `actions/checkout` + `git rev-parse HEAD` + `sed` in workflow, ma duplica la logica dello script locale. Pre-existing workflow è `playwright.yml`, non c'è un `deploy.yml` (deploy è automatic da master branch). Lasciato come future improvement: trasferire lo script al CI quando un deploy.yml viene aggiunto.

**Note CON-017 #3 (regression: stale SW unregister at boot)**: già implementato in PR2a (`app.js:181-199`). Funziona indipendentemente dal cache name — unregistra SW con `scriptURL !== sw.js corrente`. Continua a passare con il nuovo schema di naming hashato.

---

## §9 Test plan

### Nuovi spec files in `tests/`

1. **`tests/sync-offline.spec.ts`** (riusa `offline.spec.ts` esistente, lo unskippa)
   - **CRITICAL-05 LIVE** (CON-017): airplane mode → 3 write (inquilino + incasso che lo referenzia + utenza con tipo `acqua`) → assert `[data-testid="queue-indicator"]` mostra "3 modifiche in coda" → `context.setOffline(false)` → wait green status dot → reload → query Supabase via service key e verifica 3 record presenti con FK consistenti.
   - **CAVEAT Playwright `setOffline` + SW**: GitHub issue #2311 — `setOffline(true)` non interfere con SW già installato (cache continua a servire). Per testare DAVVERO il fallback offline, dobbiamo:
     - Visit live (cache populated), poi setOffline(true), poi navigate (browser fetch fails, SW serve cache).
     - Per il `online`/`offline` event listener: Playwright fires events su setOffline correttamente da v1.40+ (verificare in CI). Backup: trigger manualmente `await page.evaluate(() => window.dispatchEvent(new Event('online')))`.

2. **`tests/conflict.spec.ts`** (NEW)
   - Seed: stessa proprietà su user_id test, simula edit offline (push mutation in idb-keyval direttamente via `page.evaluate(() => idbKeyval.set('mutationQueue', [{...}]))`).
   - Stessa proprietà aggiornata server-side con `updated_at` futuro (via service key).
   - setOffline(false) → flush → assert `[data-testid="conflict-toast"]` visible con testo "Conflitto su Appartamento Test Via Roma".
   - Click `[data-testid="conflict-keep-server"]` → toast scompare, dati locali = server payload.
   - Re-run con `keep-local`: toast scompare, server ora = local payload (verifica via service key fetch).

3. **`tests/migration.spec.ts`** (NEW)
   - Seed: blob legacy in `user_data` (MOCK_DATI shape attuale), tabelle nuove vuote.
   - Login → assert post-login: tabelle nuove popolate (count via service key), blob ancora presente (Phase 1 dual-write), `download` JSON triggered (assert via `page.on('download')`).
   - Re-login (idempotency): assert no second migration (count tabelle invariato, no second download).
   - **Partial-fail**: seed blob con FK invalida (`proprietaId` orfano in incassi) → assert modal `[data-testid="migration-failed-modal"]` visible con bottone "Esporta JSON di emergenza" → click triggers download.

4. **`tests/inquilini.spec.ts`** (NEW)
   - CRUD: create → assert in dropdown PDF (placeholder per PR3); edit → assert updated; soft-delete → assert spostato in cestino; ripristina → assert visible di nuovo.

5. **`tests/tipi-utenza.spec.ts`** (NEW)
   - Aggiungi "rifiuti" da Impostazioni → assert appare immediatamente in dropdown form utenza (no reload) — verifica via Alpine reactivity.
   - Tenta hard-delete tipo con utenze associate → assert blocked + toast "Tipo utilizzato".

6. **`tests/scadenza.spec.ts`** (NEW)
   - Crea proprietà con `scadenzaGiorno: 17` → assert appare in calendario sotto gruppo "17" (non più hardcoded 1/15/fine_mese).

### Offline lifecycle helper in `fixtures.ts`

```ts
export async function goOffline(page: Page) {
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
}
export async function goOnline(page: Page) {
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}
```

### Queue inspection helper

Esporre debug global ONLY in test mode:
```js
// app.js init() sotto if (location.hostname === 'localhost' || window.__PLAYWRIGHT_TEST__)
window._mutationQueueDebug = () => this.mutationQueue;
window._conflictQueueDebug = () => this.conflictQueue;
```
Test usa: `await page.evaluate(() => window._mutationQueueDebug())`.

### Fixture update for new schema

`MOCK_DATI` in `fixtures.ts` deve essere esteso con `tipi_utenza`, `inquilini` (empty array OK), `scadenzaGiorno` su ogni proprietà. Il seed PostgREST direct insert non funziona per RLS (la service key del seed-trigger DB attualmente permette solo `user_data`); soluzione: estendere il trigger DB per consentire `INSERT/UPDATE/DELETE` su tutte le 6 tabelle nuove **solo per TEST_USER_ID**.

---

## §10 Risk register (delta from CEO plan)

| ID | Risk | Severity post-PR2a | Mitigation |
|---|---|---|---|
| R1 (CEO) | Migrazione schema rompe dati esistenti | HIGH | Mitigato by §7: PL/pgSQL atomicity + pre-migration snapshot ring + auto JSON download + dual-write 2w + rollback flag |
| R4 (CEO) | Mutation queue corrompe stato | MED | Mitigato by §5: FK-aware hardcoded order + 3× retry + persistent indicator + manual flush button |
| R-NEW-1 | iOS Safari standalone: IndexedDB in private mode crashes | LOW | try/catch attorno a `idbKeyval.get`; fallback in-memory queue (entries lost on reload but no crash). Private mode + PWA è already broken (no login persistence) |
| R-NEW-2 | Playwright `setOffline` non trigghera `online`/`offline` events in tutti gli scenari | MED | Manual dispatch via `page.evaluate(() => window.dispatchEvent(new Event('online')))`. Documentato nel test |
| R-NEW-3 | `get_user_data()` ritorna `null` per arrays vuoti (json_agg of zero rows) | LOW | `coalesce(..., '[]'::json)` su ogni sub-select — già nello skeleton §3 |
| R-NEW-4 | Multi-tab race: tab A scrive queue, tab B la legge stale | LOW | Locked in §4: single-user mobile PWA assumption; recoverable via snapshot ring se manifesta |
| R-NEW-5 | RPC `migrate_blob_to_entities` timeout su utenti con dati molto grandi | LOW (family-tier ~600 rows) | Postgres function ha statement timeout default 8s (`PGRST_STATEMENT_TIMEOUT`). 600 inserts in singola transazione: ~200ms. Lontano dal limite. Se manifesta, chunk in batch via cursor |
| R-NEW-6 | Cache hash bump dimenticato pre-deploy | MED | Mitigation: script + nota visibile in `sw.js` header + PR template checklist item. Future: pre-commit hook |
| R-NEW-7 | Alpine reactivity gap su `navigator.onLine` (non-reactive) | LOW | Pattern PR2a `_isOnline` counter slot + online/offline listeners che bumpano. Falsifiable: inspect a fronte di feedback "indicator non si nasconde quando torna online" |
| R-NEW-8 | Dual-write fa write doppia mentre offline → queue cresce | LOW | Mitigation: blob fallback write skip quando `!navigator.onLine` (resta solo enqueue per-entity); accettato |

PR2a learning applicati:
- **sw-precache-resilient** (`Promise.allSettled`): già il default in `sw.js`. idb-keyval CDN aggiunto sicuro.
- **alpine-reactive-trigger-for-external-source**: applicato a `mutationQueueCount()`, `conflittoCorrente()`, `_isOnline`.

---

## §11 Open Questions

- **OQ-1**: La conversione snake_case (Postgres) ↔ camelCase (JS attuale) si fa lato client (`adattaShape()`) o lato server (RPC ritorna già camelCase via `json_build_object('importoAffittoMensile', p.importo_affitto_mensile)`)? **Recommendation planner**: lato server nell'RPC — più ergonomico per il client che resta identico al blob shape. Trade-off: RPC più verbosa. Da decidere in planning.
- **OQ-2**: `scadenzaGiorno` (camelCase JS) vs `scadenza_giorno` (snake_case DDL) — naming uniforme richiesto. Plan deve fissare convention. Consigliato: client riceve `scadenzaGiorno` (RPC fa rename), DDL resta `scadenza_giorno`.
- **OQ-3**: Il `scriviCache` localStorage (blob, da PR1) viene preservato during Phase 1 dual-write per protezione offline? Recommendation: SÌ — è il safety net "se idb-keyval crasha, blob è il fallback ultimo". Da confermare in planning.
- **OQ-4**: Pre-commit hook per cache bump (§8) — aggiungerlo subito o solo se developer dimentica una volta? Recommendation: solo doc nella prima iterazione; hook se serve.

---

## §12 Estimated cost

Basato su precedenti PR1 (~6h focused) + PR2a (~2h30):

| Task | LOC ballpark | Stima |
|---|---|---|
| Schema DDL + RPC (file separato, eseguito via SQL editor) | ~250 SQL | 1h |
| `migrate_blob_to_entities` PL/pgSQL + test su test DB | ~120 SQL | 1h |
| `app.js`: state slots + idb-keyval load + mutation queue impl + sort + flush | ~150 JS | 2h |
| `app.js`: salva()/salvaSubito dual-write branch + adattaShape + caricaDatiUtente RPC path | ~120 JS | 1h30 |
| `app.js`: conflict toast logic + risolviConflitto + nomeUmano | ~60 JS | 45min |
| `app.js`: migraBlobAPerEntita orchestration + emergency export hook | ~50 JS | 30min |
| `index.html`: conflict toast template + queue indicator + Inquilini CRUD + Tipi utenza CRUD + scadenzaGiorno select + Salute dati widgets | ~150 HTML | 2h |
| `sw.js`: precache idb-keyval + CACHE_NAME bump | ~5 | 5min |
| `scripts/bump-sw-cache.sh` | ~10 sh | 15min |
| `tests/fixtures.ts`: estensioni MOCK_DATI + goOffline/goOnline helpers + per-entity seed | ~80 TS | 1h |
| `tests/sync-offline.spec.ts` (CRITICAL-05 LIVE) | ~60 TS | 1h |
| `tests/conflict.spec.ts` | ~80 TS | 1h |
| `tests/migration.spec.ts` (idempotency + partial-fail) | ~120 TS | 1h30 |
| `tests/inquilini.spec.ts` + `tipi-utenza.spec.ts` + `scadenza.spec.ts` | ~150 TS | 1h30 |
| Debug + iteration buffer (precedente PR1 deviation suggerisce +20%) | — | 2h |

**Total**: ~17h focused work. **Realistic calendar**: 2-3 sessioni Claude Code (8-10h actual coding) + 1 sessione dedicata a debug e Playwright iteration in CI (3-4h). Il CEO plan aveva stimato "1 sessione intera + 1 di bugfix" (~8h) — confermo è troppo ottimistico; budget 12-14h realistici.

---

## RESEARCH COMPLETE

Confidence HIGH: locked decisions chiare, line-map preciso, falsifications complete (toposort hardcoded, RPC INVOKER, hash-based cache bump, server-side atomicity via PL/pgSQL).
Surprises: (1) topological sort non serve runtime — order statico falsifica Kahn; (2) PL/pgSQL function dentro singola transazione = vera atomicità senza extra effort; (3) Playwright setOffline ha quirk noto coi service workers — mitigation via manual event dispatch.
4 OQ residui marginali (naming convention, dual-write cache, pre-commit hook).

Sources:
- [idb-keyval CDN by jsDelivr](https://www.jsdelivr.com/package/npm/idb-keyval)
- [idb-keyval - GitHub](https://github.com/jakearchibald/idb-keyval)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Mastering Transactions in Supabase SQL — dev.to](https://dev.to/damasosanoja/data-integrity-first-mastering-transactions-in-supabase-sql-for-reliable-applications-2dbb)
- [Playwright setOffline does not work with service workers — issue #2311](https://github.com/microsoft/playwright/issues/2311)
- [Testing PWAs offline with Playwright — dt.in.th](https://dt.in.th/PlaywrightOfflineFirstTest)
