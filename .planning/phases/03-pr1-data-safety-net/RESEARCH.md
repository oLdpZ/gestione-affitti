# Phase 3: PR1 — Data Safety Net + 3 Bugfix + Estrazione app.js — Research

**Researched:** 2026-05-18
**Domain:** Alpine.js state model, soft-delete pattern, snapshot ring buffer, error capture, vanilla JS extraction (no build step)
**Confidence:** HIGH (tutte le line-number e shape ancorate al codice reale di `index.html` 1939 righe)

## Summary

Il codice attuale di `index.html` (post-PR0, `master 745b854`) è già stato letto integralmente nella zona `<script>` 1207–1937. Le funzioni helper (`uid`, `migraDati`, `datiEsempio`, …) vivono come **global functions** dentro lo stesso `<script>` di `app()`. `sb` (Supabase client) è invece definito in un **altro** `<script>` precedente (righe 16–23). Questo vincola la strategia di estrazione: `app.js` deve essere caricato DOPO il blocco che istanzia `sb`, e DEVE essere `defer`, perché Alpine (anch'esso `defer`) valuta `x-data="app()"` al DOMContentLoaded.

Il dato `incassi` si chiama in realtà **`incassiAffitti`** (NON `incassi`) — la dicitura di CONTEXT.md va tradotta. Lo shape effettivo di `this.dati` è: `{ dataVersion: 2, proprieta: [], banche: [], incassiAffitti: [], utenze: [] }`. `banche` HA già il campo `currency` (default `'EUR'`) — quindi R-G in CONTEXT è risolto: la validazione currency-mismatch è fattibile in PR1.

**Primary recommendation:** Sequenziare in layer A→K dove A (estrazione `app.js`) è un **commit refactor puro** isolato (zero behavior delta, CI deve passare PRIMA di toccare logica), poi B (deletedAt init + helper `attivi()`), poi C-D-E-F-G-H-I-J. Tutti i call site `dati.proprieta`/`dati.incassiAffitti` confluiscono attraverso un helper unico `this.attivi(arr)` invece di toccare ~40 punti.

## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from CONTEXT.md)

- No build step, no npm install, no PostCSS, no bundler.
- `app.js` sibling di `index.html`, classic script (non module).
- Tutte le CDN deps restano pinnate.
- `deletedAt: ISOString | null` su **Proprietà + Incassi soltanto**.
- Filter at read time: ogni iterazione esclude `deletedAt != null` (no toggle globale).
- Elimina = set `deletedAt = new Date().toISOString()` + `salva()`.
- Auto-purge al boot: rimuove definitivamente items con `deletedAt < now() - 30gg`. Una volta per boot. Log su console.
- Cascading restore Proprietà → Incassi (clear `deletedAt`); Utenze non sono soft-delete in PR1, restano legate.
- Hard-delete da Cestino = splice + cascading hard-delete degli Incassi figli.
- Cestino in Impostazioni, `.glass-table`, colonne Nome/Tipo/Data eliminazione/Azioni, footer "Svuota cestino", empty state italic muted.
- Snapshot ring buffer 10, key `gestione_affitti_snapshots`, shape `Array<{ ts, dati }>`. Push al TOP della mutazione (pre-state). Trim FIFO.
- Restore snapshot = warning modal + overwrite completo.
- Timeline snapshot in Impostazioni con diff counts.
- Undo toast bottom, glass, 5s, stack model (latest replaces previous), Alpine state `undoToast` in `app()`.
- Salute dati in Impostazioni: counts (proprietà/incassi attivi+soft, orfani, importo=0), ultimo sync, dimensione blob, `navigator.storage.estimate()`, errori 50, "Invia diagnostica" WhatsApp.
- Placeholder "Disponibile dopo migrazione schema (PR2b)" per sync metrics.
- Error capture: `window.addEventListener('error', …)` + `unhandledrejection`. Ring 50. Mai re-throw.
- Validation: Importo=0 soft-confirm; banca-missing toast warn (non-bloccante); currency-mismatch toast warn.
- Bugfix 1 importaJSON: chiama `migraDati(this.dati)` dopo parse, prima di `generaIncassiAttesi`.
- Bugfix 2 generaIncassiAttesi: skip se `modificatoManualmente === true`.
- Bugfix 3 salva(): catch chain (auth-expired refresh+retry / network → modalitàOffline / RLS → toast errori / other → generic).
- Estrazione `<script>` 1265–1939 in `app.js`, sostituzione con `<script src="app.js" defer></script>`. `function app()` resta global.
- 5 nuovi test Playwright richiesti: cestino round-trip, hard delete, undo, snapshot, Salute dati counts.
- Branch `pr1-data-safety-net`, single PR squash merge, required check `test`.

### Claude's Discretion

- CSS snapshot timeline (glass-table OK).
- "Ripara orfani": SOLO read-only display in PR1 (no auto-repair).
- Numero WhatsApp diagnostica: costante in cima a `app.js` (`const SUPPORT_WHATSAPP = '...';`), valore da chiedere a Stefano in fase plan/execute o lasciare placeholder vuoto con UI disabilitata se vuoto.
- Format dump errori in WhatsApp: testo formattato `[ts] message` riga per riga, max 4000 char (limite URL whatsapp).
- Dismiss toast su click body / Escape: implementare (sì), nessun undo, solo chiusura.
- `data-testid` su righe cestino, undo toast, snapshot rows, Salute dati panel: **fortemente raccomandato**.

### Deferred Ideas (OUT OF SCOPE)

- Soft-delete su Banche/Utenze/Inquilini/Tipi-utenza.
- Mutation queue, sync status, conflict count (PR2b).
- Schema change, Inquilini, Tipi-utenza CRUD, custom scadenze (Phase 5).
- PWA shell, service worker (Phase 4).
- Field-level merge.
- Cloud backup automatico.

## Phase Requirements

| ID | Description (sintesi) | Research Support |
|----|-----------------------|------------------|
| REQ-SAFE-01 | Soft-delete su Proprietà + Incassi (deletedAt nullable) | §3 sotto: helper `attivi()`, init migration, eliminazione handlers patch |
| REQ-SAFE-02 | Cestino view + Ripristina + Elimina definitivamente (cascading) | §4 sotto: HTML skeleton + cascading rules |
| REQ-SAFE-03 | Snapshot ring buffer 10 + Ripristina snapshot UI | §5 sotto: pseudo-code push/restore + storage budget |
| REQ-SAFE-04 | Undo toast 5s + Annulla + stack model | §6 sotto: Alpine state shape + timer flow |
| REQ-SAFE-05 | Salute dati page (counts, sync, storage, errori, diagnostica) | §7 sotto: data flow per ogni metrica |
| REQ-SAFE-06 | Validation: importo=0 soft-confirm + banca-missing + currency-mismatch | §9 sotto (la base esiste già in `salvaProprieta`, va estesa a Incassi) |
| REQ-SAFE-07 | Error capture in `localStorage.errori[]` ring 50 | §8 sotto |
| DEC-020 Bugfix 1 | `importaJSON` chiama `migraDati` | §10 sotto, righe 1586–1590 |
| DEC-020 Bugfix 2 | `generaIncassiAttesi` rispetta `modificatoManualmente` | §10 sotto, righe 1593–1625 (campo NON ancora presente — va introdotto) |
| DEC-020 Bugfix 3 | `salva()` catch chain split | §10 sotto, righe 1535–1577 (in realtà su `salvaSubito`, NON su `salva`) |
| DEC-020 Estrazione | `<script>` 1265–1939 → `app.js` | §2 sotto, ordinamento defer e contratti globali |

## 1. Stato attuale del codice (post-PR0)

### File e dimensioni
- `index.html`: **1939 righe totali**. Inline `<script>` con la logica app: **righe 1207–1937**. Il blocco di interesse "logica applicativa" (helpers + `migraDati` + `app()`) parte effettivamente alla riga **1207** (header commento "LOGICA APPLICATIVA") e termina alla riga **1937** (`</script>`). CONTEXT cita "1265–1939" che è impreciso: l'apertura `<script>` è alla 1207, e helpers `uid`/`formatValuta`/`formatData`/`oggi`/`meseCorrente`/`dataPrevist`/`datiEsempio` vivono ai 1208–1262 PRIMA di `migraDati`. Vanno estratti TUTTI insieme.
- C'è anche un blocco `<script>` di config Supabase a **righe 16–23** (definisce `const sb`) e un blocco config Tailwind a **24–35**. Entrambi NON vanno estratti — restano in `index.html`.

### Touch points verificati (numeri di riga reali)

| Symbol | Riga | Note |
|--------|------|------|
| `function uid()` | 1209 | helper globale nello script |
| `function formatValuta(n, currency)` | 1212 | helper globale |
| `function formatData(d)` | 1219 | helper globale |
| `function oggi()` | 1226 | helper globale |
| `function meseCorrente()` | 1229 | helper globale |
| `function dataPrevist(mese, scadenza)` | 1235 | helper globale |
| `function datiEsempio()` | 1246 | helper globale, crea seed iniziale |
| `function migraDati(dati)` | 1265 | helper globale; **version-aware** (`dataVersion` field) |
| `function app()` | 1286 | Alpine root, **global** (referenziato da `x-data="app()"` riga 451) |
| `init()` | 1325 | dentro `app()` |
| `caricaDatiUtente()` | 1443 | chiama `migraDati` su 1469/1480/1503 |
| `salva()` | 1521 | debounced wrapper, scrive cache eager |
| `salvaSubito()` | 1536 | upsert Supabase; **questo** è il catch chain da splittare (CONTEXT scrive "salva()" ma la rete sta in `salvaSubito`) |
| `esportaJSON()` | 1579 | |
| `importaJSON(event)` | 1586 | **BUG 1**: parse → set → genera → salva, manca `migraDati` |
| `generaIncassiAttesi()` | 1593 | **BUG 2**: l'`existing` block (1603–1612) sovrascrive `importo`/`bancaId`/`dataPrevista` se `!esistente.dataIncasso`; **NON c'è check su `modificatoManualmente`** — campo da introdurre |
| `generaIncassiMeseVisualizzato()` | 1727 | pari pattern, **stesso bug 2** da considerare anche qui |
| `salvaIncassoModificato()` | 1756 | qui andrebbe settato `modificatoManualmente = true` per la bugfix 2 |
| `eliminaIncasso(id)` | 1767 | `confirm()` + splice + salva (DA SOFT-DELETE + UNDO) |
| `salvaProprieta()` | 1876 | **già fa** confirm su importo=0 (1879) e su currency mismatch banca (1888–1897) — pattern da replicare per Incassi |
| `eliminaProprieta(id)` | 1904 | `confirm()` + splice prop + splice incassi + splice utenze + salva (DA SOFT-DELETE PROP+INCASSI + UNDO, utenze restano legate) |
| `eliminaUtenza(id)` | 1864 | `confirm()` + splice + salva (UNDO only, NO soft-delete) |
| `eliminaBanca(id)` | 1923 | check uso + `confirm()` + splice + salva (UNDO only, NO soft-delete) |

### Shape `this.dati` (verificato, riga 1300)

```js
{ dataVersion: 2, proprieta: [], banche: [], incassiAffitti: [], utenze: [] }
```

**ATTENZIONE NOMENCLATURA**: l'array degli incassi si chiama **`incassiAffitti`**, NON `incassi`. CONTEXT.md usa "incassi" generico — tutto il codice nel piano e nei task DEVE usare `incassiAffitti`.

Shape entità (da `datiEsempio` + `salvaProprieta` + `aggiungiUtenza` + `generaIncassiAttesi`):

- **proprieta**: `{ id, nome, tipo, scadenzaAffitto, importoAffittoMensile, bancaIncasso, intestatario, bancaDestinazione, currency, note }`
- **banche**: `{ id, nome, intestatario, currency }` — **`currency` ESISTE GIÀ** (riga 1247–1248, riga 1913). R-G risolto.
- **incassiAffitti**: `{ id, proprietaId, mese, dataPrevista, dataIncasso, importo, bancaId, girato, dataGiro, bancaDestinazioneId, currency, note }` — **NO `modificatoManualmente`** oggi. Va aggiunto.
- **utenze**: `{ id, proprietaId, tipo, fornitore, periodoRiferimento, dataScadenza, importo, stato, currency, note }` (+ `dataPagamento` opzionale su `stato='pagata'`)

### Campi presenti / assenti

| Campo | Presente? | Note |
|-------|-----------|------|
| `banche[].currency` | SÌ | default 'EUR', settato in `creaBanca` (1913) + `migraDati` (1272) |
| `proprieta[].currency` | SÌ | default 'EUR' |
| `incassiAffitti[].currency` | SÌ | default 'EUR', settato in `generaIncassiAttesi` (1620) |
| `incassiAffitti[].modificatoManualmente` | **NO** | da introdurre (default `false`); set `true` in `salvaIncassoModificato` 1756 quando il body cambia importo/bancaId/dataPrevista |
| `proprieta[].deletedAt` | NO | da introdurre |
| `incassiAffitti[].deletedAt` | NO | da introdurre |
| `utenze[].deletedAt` | NO (e resta NO) | utenze NON sono soft-delete in PR1 |

### Validazione esistente

- **importo=0 su Proprietà**: ESISTE già a riga 1879–1882, `confirm()` browser native. PR1 deve estenderla (a) a Incassi nuovi/modificati, (b) ricodificarla come modale custom Alpine glass-style (CONTEXT REQ-SAFE-06 specifica "soft-confirm modal"). Il test REGRESSION-04 (login.spec.ts:26) intercetta `page.on('dialog')` — quando la sostituzione modale arriverà, quel test va aggiornato nello stesso commit.
- **currency-mismatch su Proprietà**: ESISTE già a riga 1884–1897 (`salvaProprieta` confronta `currency` di proprietà vs banca di incasso e banca destinazione). PR1 deve replicare per Incassi.
- **banca-missing**: NON esiste — `bancaId` può essere null e `nomeBanca(null)` ritorna stringa vuota silente. Va aggiunto warn.

### Schema migration esistente

- `migraDati` (1265) è version-aware: legge `dati.dataVersion`. Versione corrente = **2**. Salta tutto se `dataVersion >= 2`. Per PR1: o si bumpa a `dataVersion = 3` aggiungendo il backfill `deletedAt: null` su tutti gli items, oppure l'init scrive `deletedAt = null` opportunisticamente al primo read di ogni record (idempotente). **Raccomandazione**: bump a `dataVersion = 3` con backfill, è il pattern dell'app.

## 2. Estrazione `app.js` — strategia concreta

### Riga di partenza/fine (verificata)

Da `index.html`:
- `<script>` aperto a **riga 1207** (subito dopo commento "LOGICA APPLICATIVA")
- `</script>` chiuso a **riga 1937**
- Quindi il **body** della logica app sta tra riga 1208 e riga 1936 (incluse).

### Procedura di estrazione (commit atomico, zero behavior delta)

1. Creare file `app.js` nella root del repo (sibling di `index.html`).
2. Copiare il contenuto di `index.html` righe 1208–1936 in `app.js`, **rimuovendo** la prima riga (`<script>`) e l'ultima (`</script>`).
3. Sostituire in `index.html` le righe 1207–1937 con un singolo tag:
   ```html
   <script src="app.js" defer></script>
   ```
4. Verifica visiva: `wc -l index.html` deve risultare ~1209 righe (1939 - 729 + 1 = 1211 ± qualche commento), entro il vincolo DoD #8 "<1300 righe".
5. Verifica funzionale: `npm run test` (Playwright) deve passare INVARIATO. Se non passa, l'estrazione ha cambiato qualcosa — `git revert` e investigare.

### Ordine di caricamento (Alpine boot order — CRITICO)

Stato attuale (verificato righe 11–35):
```html
<script src="https://cdn.tailwindcss.com"></script>                              <!-- riga 11 sync -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>     <!-- riga 13 sync -->
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/.../cdn.min.js"></script>  <!-- riga 15 defer -->
<script> /* SUPABASE_URL, SUPABASE_ANON_KEY, sb = createClient(...) */ </script> <!-- 16–23 sync -->
<script> /* tailwind.config */ </script>                                          <!-- 24–35 sync -->
```

Stato post-extraction:
```html
<!-- 11, 13: invariati sync -->
<!-- 15: Alpine defer (resta) -->
<!-- 16–23: sync sb init (resta) -->
<!-- 24–35: sync tailwind config (resta) -->
<!-- al posto delle vecchie 1207–1937: -->
<script src="app.js" defer></script>
```

### Perché funziona (contratto Alpine)

- **`defer`** garantisce: (a) lo script viene eseguito DOPO il parsing HTML completo, (b) gli script `defer` mantengono l'ordine di apparizione nel documento, (c) tutti i `defer` finiscono PRIMA di `DOMContentLoaded`. Fonte: HTML spec, MDN script defer attribute. [CITED]
- Alpine inizializza al `DOMContentLoaded` (Alpine v3 docs). `x-data="app()"` viene risolto a quel punto. Poiché `app.js` (`defer`) è eseguito prima di `DOMContentLoaded`, `function app()` è in scope quando Alpine ne ha bisogno. [CITED Alpine docs]
- `sb` (globale, dichiarato in script sync 16–23) è disponibile PRIMA che inizino i `defer`, quindi disponibile dentro `app.js`. ✓
- Tailwind config e Tailwind CDN script: anche entrambi sync prima di `app.js`, quindi nessuna race.

### Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Helper privati (`uid`, `formatValuta`, ...) referenziati da Alpine inline negli HTML attributes (es. `x-text="formatValuta(...)"`) non funzionano se messi in scope diverso | Restano global functions in `app.js` (lo sono già nello script attuale). Alpine valuta nello scope `app()` + `window`. Funziona. |
| `app()` non disponibile quando Alpine cerca di valutarlo | `defer` + ordine garantiscono che `app.js` esegue prima di Alpine bootstrap. Se per qualche motivo Alpine si avviasse prima (race teorica improbabile), aggiungere `Alpine.start()` manuale dopo l'estrazione: nel codice attuale Alpine usa il CDN auto-start, quindi NON modificare nulla qui. |
| File-protocol (`file://`) bloccherebbe `defer` con CORS? | NON applicabile: l'app gira su GitHub Pages (HTTPS) e su Playwright (HTTP). Classico script, no CORS issue. |
| Browser cache di `index.html` non riprende il nuovo `<script src>` | GitHub Pages serve con cache-control corretto; un hard reload (Cmd-Shift-R) post-deploy elimina ogni dubbio. Aggiungere `?v=1` al src se in futuro serve cache-busting. |

### Raccomandazione operativa

**Estrazione = commit isolato, primo della PR.** Subito dopo, runnare Playwright in CI. Se verde, build delle feature on top. Se rosso, revert immediato — l'estrazione ha rotto qualcosa di Alpine wiring (refs/x-data scope). Solo allora si parte con il layer B.

## 3. Soft-delete model — implementation recipe

### Initialization

In `migraDati` (riga 1265 → da bumpare a `dataVersion = 3`), aggiungere blocco:

```js
if (dati.dataVersion < 3) {
  if (Array.isArray(dati.proprieta)) {
    for (const p of dati.proprieta) { if (!('deletedAt' in p)) p.deletedAt = null; }
  }
  if (Array.isArray(dati.incassiAffitti)) {
    for (const i of dati.incassiAffitti) {
      if (!('deletedAt' in i)) i.deletedAt = null;
      if (!('modificatoManualmente' in i)) i.modificatoManualmente = false; // bugfix 2 backfill
    }
  }
  dati.dataVersion = 3;
}
```

Idempotente: rieseguire = no-op.

### Setting deletedAt on create

Nei seguenti site, all'oggetto creato aggiungere `deletedAt: null`:
- `datiEsempio()` riga 1251–1260 (proprietà): aggiungere `deletedAt: null`
- `salvaProprieta()` riga 1901 (nuova proprietà): aggiungere `deletedAt: null` nello `editProprieta` template / `creaProprieta()` 1870
- `creaProprieta()` riga 1870–1873: aggiungere `deletedAt: null`
- `generaIncassiAttesi()` riga 1614–1621 (`incassiAffitti.push(...)`): aggiungere `deletedAt: null, modificatoManualmente: false`
- `generaIncassiMeseVisualizzato()` riga 1735–1742 (idem): aggiungere `deletedAt: null, modificatoManualmente: false`
- `salvaIncassoModificato()` riga 1756: preserve `deletedAt` dal modello esistente, set `modificatoManualmente: true` se i campi user-editabili sono cambiati

### Setting deletedAt on delete

Patch a `eliminaIncasso` (1767):
```js
eliminaIncasso(id) {
  const inc = this.dati.incassiAffitti.find(i => i.id === id);
  if (!inc) return;
  const preState = JSON.parse(JSON.stringify(inc)); // per undo toast
  inc.deletedAt = new Date().toISOString();
  this.salva();
  this.mostraUndoToast(`Incasso eliminato`, () => { inc.deletedAt = null; this.salva(); });
}
```

Patch a `eliminaProprieta` (1904):
```js
eliminaProprieta(id) {
  const p = this.dati.proprieta.find(x => x.id === id);
  if (!p) return;
  const ora = new Date().toISOString();
  const incassiToccati = this.dati.incassiAffitti.filter(i => i.proprietaId === id && !i.deletedAt);
  const preState = {
    proprieta: { ...p },
    incassiAffitti: incassiToccati.map(i => ({ id: i.id, deletedAt: i.deletedAt }))
  };
  p.deletedAt = ora;
  for (const i of incassiToccati) i.deletedAt = ora;
  // Utenze restano linkate, NO tombstone su utenze
  this.salva();
  this.mostraUndoToast(`Proprietà eliminata`, () => {
    p.deletedAt = null;
    for (const i of this.dati.incassiAffitti) {
      const ref = preState.incassiAffitti.find(x => x.id === i.id);
      if (ref) i.deletedAt = ref.deletedAt;
    }
    this.salva();
  });
}
```

### Read-time filter — helper centralizzato

Aggiungere a `app()`:
```js
attivi(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(x => !x.deletedAt);
}
```

**Site da migrare al filtro** (mappa esaustiva da grep nel codice):

| Riga | Funzione | Modifica |
|------|----------|----------|
| 1602 | `generaIncassiAttesi`: `for (const prop of this.dati.proprieta)` | → `this.attivi(this.dati.proprieta)` |
| 1603 | `incassiAffitti.find(i => ...)` | scope a `this.attivi(...)` |
| 1635 | `incassiMeseCorrente`: `this.dati.incassiAffitti.filter(...)` | wrap in `attivi` |
| 1650 | `statoAffittoMese`: `find` | wrap |
| 1659 | `totaleDaGirareBanca`: `filter` | wrap |
| 1667 | `totaleDaGirareVersoBanca`: `filter` + `proprieta.find` | wrap entrambi |
| 1680 | `utenzeInScadenza`: `this.dati.utenze.filter` | NO modifica (utenze no soft-delete), ma il `proprieta.find` interno SÌ |
| 1697 | `gruppiCalendario`: `filter` incassiAffitti | wrap |
| 1704 | `gruppiCalendario`: `proprieta.find` | wrap |
| 1709 | `gruppiCalendario`: `for (const prop of this.dati.proprieta)` | wrap |
| 1710 | `some` su incM | OK (incM già filtrato sopra se wrap fatto) |
| 1727–1734 | `generaIncassiMeseVisualizzato`: `for proprieta`, `some incassiAffitti` | wrap entrambi |
| 1758 | `salvaIncassoModificato`: `findIndex` | wrap (un incasso soft-deleted non deve essere modificabile) |
| 1777 | `storicoIncassiProprieta`: `filter` | wrap |
| 1788 | `storicoUtenzeProprieta`: `filter` utenze (no soft-delete utenze) | NO wrap utenze |
| 1801 | `incassiBancaMese`: `filter` | wrap |
| 1837 | `utenzeFiltrate`: `filter utenze` | NO wrap |
| 1854 | `aggiungiUtenza`: `proprieta.find` | wrap (non si può creare utenza su prop soft-deleted) |
| 1899 | `salvaProprieta`: `findIndex` | wrap |
| 1907–1908 | `eliminaProprieta` cascading | OBSOLETO dopo refactor (no più hard delete) |
| 1924–1925 | `eliminaBanca`: usage check | wrap (banca usata da incasso soft-deleted NON deve bloccare) |
| 1628–1631 | `nomeProprieta`, `getProprieta`, `nomeBanca` | **NO wrap**: questi sono lookup display, devono trovare anche items soft-deleted (es. Cestino visualizza il nome) |

**Decisione di design**: `nomeProprieta(id)` / `getProprieta(id)` / `nomeBanca(id)` NON filtrano. Servono al Cestino per mostrare il nome dell'item soft-deleted. Tutto il resto passa per `attivi()`.

### Auto-purge at init

In `init()` (riga 1325), subito dopo `this.utente = session.user; await this.caricaDatiUtente();`:

```js
this.purgeOldSoftDeleted();
```

Implementazione:
```js
purgeOldSoftDeleted() {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  let purged = 0;
  const before = this.dati.proprieta.length + this.dati.incassiAffitti.length;
  this.dati.proprieta = this.dati.proprieta.filter(p => !p.deletedAt || p.deletedAt > cutoff);
  this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => !i.deletedAt || i.deletedAt > cutoff);
  purged = before - this.dati.proprieta.length - this.dati.incassiAffitti.length;
  if (purged > 0) {
    console.info(`[purge] Auto-rimossi ${purged} elementi soft-deleted >30 giorni`);
    this.pushErrore({ message: `Auto-purge: ${purged} elementi rimossi (oltre 30gg)`, severity: 'info', ts: new Date().toISOString() });
    this.salva();
  }
}
```

## 4. Cestino UI — patterns da riusare

Vive come nuova sezione in Impostazioni. Riusa `.glass-card` e `.glass-table` esistenti (PR0).

### HTML skeleton (Alpine + Tailwind)

```html
<div class="glass-card mt-6" data-testid="cestino-section">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-lg font-semibold">Cestino</h3>
    <button class="btn-secondary text-sm"
            x-show="cestinoItems().length"
            @click="svuotaCestino()">Svuota cestino</button>
  </div>

  <template x-if="cestinoItems().length === 0">
    <p class="italic text-gray-500 dark:text-gray-400">Il cestino è vuoto.</p>
  </template>

  <table class="glass-table w-full" x-show="cestinoItems().length">
    <thead>
      <tr><th>Nome</th><th>Tipo</th><th>Eliminato</th><th>Azioni</th></tr>
    </thead>
    <tbody>
      <template x-for="item in cestinoItems()" :key="item.tipo + '-' + item.id">
        <tr :data-testid="'cestino-row-' + item.id">
          <td x-text="item.nome"></td>
          <td x-text="item.tipo"></td>
          <td x-text="relativeTime(item.deletedAt)" :title="item.deletedAt"></td>
          <td>
            <button class="btn-primary text-sm" @click="ripristina(item)" :data-testid="'cestino-restore-' + item.id">Ripristina</button>
            <button class="btn-danger text-sm" @click="eliminaDefinitivamente(item)" :data-testid="'cestino-hard-' + item.id">Elimina definitivamente</button>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</div>
```

### Metodi richiesti su `app()`

```js
cestinoItems() {
  const items = [];
  for (const p of this.dati.proprieta) {
    if (p.deletedAt) items.push({ tipo: 'Proprietà', id: p.id, nome: p.nome, deletedAt: p.deletedAt });
  }
  for (const i of this.dati.incassiAffitti) {
    if (i.deletedAt) {
      const prop = this.dati.proprieta.find(x => x.id === i.proprietaId);
      const nomeProp = prop ? prop.nome : '(senza proprietà)';
      items.push({ tipo: 'Incasso', id: i.id, nome: `${nomeProp} — ${i.mese}`, deletedAt: i.deletedAt });
    }
  }
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

ripristina(item) {
  if (item.tipo === 'Proprietà') {
    const p = this.dati.proprieta.find(x => x.id === item.id);
    if (!p) return;
    p.deletedAt = null;
    // Cascading: re-attiva gli incassi soft-deleted nello stesso istante
    for (const i of this.dati.incassiAffitti) {
      if (i.proprietaId === item.id && i.deletedAt === p.deletedAt /* same timestamp burst */) {
        i.deletedAt = null;
      }
    }
    // NOTA: utenze hanno proprietaId preservato, ricompaiono naturalmente.
  } else {
    const i = this.dati.incassiAffitti.find(x => x.id === item.id);
    if (i) i.deletedAt = null;
  }
  this.salva();
}

eliminaDefinitivamente(item) {
  if (!confirm(`Eliminare definitivamente "${item.nome}"? L'azione è irreversibile.`)) return;
  if (item.tipo === 'Proprietà') {
    // Cascading: hard-delete proprietà + tutti i suoi incassi
    this.dati.proprieta = this.dati.proprieta.filter(p => p.id !== item.id);
    this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => i.proprietaId !== item.id);
  } else {
    this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => i.id !== item.id);
  }
  this.salva();
}

svuotaCestino() {
  if (!confirm('Eliminare definitivamente tutti gli elementi nel cestino?')) return;
  const propIdsCancellati = this.dati.proprieta.filter(p => p.deletedAt).map(p => p.id);
  this.dati.proprieta = this.dati.proprieta.filter(p => !p.deletedAt);
  // Anche gli incassi delle proprietà che svuoti
  this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => !i.deletedAt && !propIdsCancellati.includes(i.proprietaId));
  this.salva();
}

relativeTime(iso) {
  const ms = Date.now() - Date.parse(iso);
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'pochi secondi fa';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minut${m === 1 ? 'o' : 'i'} fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} or${h === 1 ? 'a' : 'e'} fa`;
  const d = Math.floor(h / 24);
  return `${d} giorn${d === 1 ? 'o' : 'i'} fa`;
}
```

### Cascading restore — algoritmo formale

Quando si ripristina una **Proprietà**:
1. Set `p.deletedAt = null`.
2. Per ogni incasso `i` con `i.proprietaId === p.id` E `i.deletedAt === oldDeletedAt` (timestamp **uguale** a quello della proprietà), set `i.deletedAt = null`. Questo riprende SOLO gli incassi cancellati IN CASCATA, NON quelli cancellati individualmente prima.
   - **NOTA**: In `eliminaProprieta` (patchato), tutti gli incassi figli ricevono lo stesso ISOString che la proprietà. Quindi il match per timestamp identifica univocamente "questi sono stati uccisi insieme".
   - Caso edge: utente cancella incasso individualmente (T1), poi cancella la proprietà (T2). Incasso ha `deletedAt = T1`. Su restore proprietà, `T1 ≠ T2`, l'incasso resta nel cestino. L'utente può ripristinarlo manualmente. ✓ desiderato.
3. Utenze: nessun tombstone, restano legate via `proprietaId`. Compaiono automaticamente perché la proprietà è di nuovo attiva.

Quando si ripristina un **Incasso individuale**: solo `i.deletedAt = null`. Se la proprietà è anch'essa soft-deleted, l'incasso ricompare nel cestino dell'altra proprietà ma non sui dashboard (perché filtrato via `attivi` su `proprieta`). Caso degenere accettabile.

### Cascading hard-delete

`eliminaDefinitivamente` su Proprietà: rimuove la proprietà E tutti gli incassi con `proprietaId === id` (sia attivi che soft-deleted). Gli orfani sono cattivi.

### Empty state

Già nel template (`<p class="italic ...">Il cestino è vuoto.</p>`).

## 5. Snapshot ring buffer — recipe

### Storage

- Key: `gestione_affitti_snapshots`
- Shape: `[ { ts: ISOString, dati: <whole state> } ]`, max length 10.
- Budget: stimando il blob `dati` attualmente ~5–50KB per Stefano (≤10 proprietà, ≤200 incassi/anno). 10 snapshot × 50KB = 500KB. Quota localStorage media browser = 5–10MB. **Sotto quota.** Aggiungere try/catch + degrade su `QuotaExceededError`. [VERIFIED — MDN Web Storage API typical quotas]

### Push timing

Snapshot di **pre-state**, prima della mutazione. Implementazione: hook all'ingresso di ogni mutating action. **MA**: l'app ha già un wrapper centrale: `salva()` (riga 1521) che è chiamato dopo ogni mutation. La nostra opzione più semplice è snapshot dentro `salva()` MA usando un "lookback" — facciamo snapshot del PROSSIMO `salva()` solo dopo aver memorizzato lo stato AL boot e dopo ogni salva.

**Strategia pulita**:
- Tenere `this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati))` aggiornato al boot (in `caricaDatiUtente` 1492) e dopo ogni `salvaSubito` completato con successo (1568).
- All'ingresso di `salva()` (1521), prima di tutto:
  ```js
  if (this._lastSnapshotData) {
    this.pushSnapshot(this._lastSnapshotData);
  }
  ```
- Dentro `pushSnapshot`:
  ```js
  pushSnapshot(preState) {
    try {
      const raw = localStorage.getItem('gestione_affitti_snapshots');
      let arr = raw ? JSON.parse(raw) : [];
      arr.push({ ts: new Date().toISOString(), dati: preState });
      if (arr.length > 10) arr = arr.slice(-10);
      localStorage.setItem('gestione_affitti_snapshots', JSON.stringify(arr));
    } catch (e) {
      console.warn('Snapshot push fallito (quota?):', e);
      this.pushErrore({ message: 'Snapshot push fallito: ' + e.message, severity: 'warn' });
    }
  }
  ```
- Aggiornare `_lastSnapshotData` post-salvaSubito (1568):
  ```js
  this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));
  ```

### Restore flow

```js
snapshots() {
  try { return JSON.parse(localStorage.getItem('gestione_affitti_snapshots') || '[]'); }
  catch (e) { return []; }
}

snapshotDiff(snap) {
  return {
    proprieta: this.attivi(this.dati.proprieta).length - this.attivi(snap.dati.proprieta).length,
    incassiAffitti: this.attivi(this.dati.incassiAffitti).length - this.attivi(snap.dati.incassiAffitti).length,
    utenze: this.dati.utenze.length - snap.dati.utenze.length,
  };
}

ripristinaSnapshot(snap) {
  if (!confirm(`Ripristinare lo snapshot del ${formatData(snap.ts.slice(0,10))}? Lo stato attuale sarà sovrascritto, incluso il cestino.`)) return;
  this.dati = JSON.parse(JSON.stringify(snap.dati));
  this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));
  this.salva();
}
```

### UI timeline (Impostazioni → "Ripristina snapshot")

```html
<div class="glass-card mt-6" data-testid="snapshot-section">
  <h3 class="text-lg font-semibold mb-3">Ripristina snapshot</h3>
  <template x-if="snapshots().length === 0">
    <p class="italic text-gray-500">Nessuno snapshot ancora disponibile.</p>
  </template>
  <ul class="space-y-2">
    <template x-for="snap in [...snapshots()].reverse()" :key="snap.ts">
      <li class="flex items-center justify-between p-2 rounded bg-white/40 dark:bg-gray-800/40" :data-testid="'snapshot-row-' + snap.ts">
        <div>
          <div class="text-sm font-medium" x-text="relativeTime(snap.ts)"></div>
          <div class="text-xs text-gray-500" x-text="snap.ts"></div>
          <div class="text-xs mt-1" x-text="formatDiff(snapshotDiff(snap))"></div>
        </div>
        <button class="btn-secondary text-sm" @click="ripristinaSnapshot(snap)">Ripristina</button>
      </li>
    </template>
  </ul>
</div>
```

### Storage budget verification

10 × 50KB JSON = 500KB. localStorage tipico = 5–10MB per origin. Margine 10×. Stefano viaggia comodo per anni. [VERIFIED MDN]

## 6. Undo toast — recipe

### Stato Alpine in `app()`

```js
undoToast: { active: false, message: '', undoFn: null, timerId: null, expiresAt: 0 },
```

### Logica

```js
mostraUndoToast(message, undoFn) {
  // Stack model: se esiste già un toast attivo, dismiss senza undo
  if (this.undoToast.timerId) {
    clearTimeout(this.undoToast.timerId);
  }
  this.undoToast.active = true;
  this.undoToast.message = message;
  this.undoToast.undoFn = undoFn;
  this.undoToast.expiresAt = Date.now() + 5000;
  this.undoToast.timerId = setTimeout(() => {
    this.undoToast.active = false;
    this.undoToast.undoFn = null;
    this.undoToast.timerId = null;
  }, 5000);
},

eseguiUndo() {
  if (this.undoToast.timerId) clearTimeout(this.undoToast.timerId);
  if (typeof this.undoToast.undoFn === 'function') this.undoToast.undoFn();
  this.undoToast.active = false;
  this.undoToast.undoFn = null;
  this.undoToast.timerId = null;
},

dismissToast() {
  if (this.undoToast.timerId) clearTimeout(this.undoToast.timerId);
  this.undoToast.active = false;
  this.undoToast.undoFn = null;
  this.undoToast.timerId = null;
},
```

### HTML/CSS skeleton (bottom-fixed glass)

```html
<div x-show="undoToast.active"
     x-transition:enter="transition transform duration-200"
     x-transition:enter-start="translate-y-full opacity-0"
     x-transition:enter-end="translate-y-0 opacity-100"
     x-transition:leave="transition transform duration-150"
     x-transition:leave-start="translate-y-0 opacity-100"
     x-transition:leave-end="translate-y-full opacity-0"
     @keydown.escape.window="dismissToast()"
     class="fixed bottom-4 inset-x-0 mx-auto max-w-md glass-card flex items-center justify-between gap-4 p-3 z-50"
     data-testid="undo-toast">
  <span x-text="undoToast.message"></span>
  <button class="btn-primary text-sm" @click="eseguiUndo()" data-testid="undo-button">Annulla</button>
</div>
```

### Pre-state via closure

Pattern già mostrato in §3: ogni handler di delete cattura il pre-state in una closure passata come `undoFn`. Non serve uno stack di pre-states perché il modello è "stack model = singleton".

### Wiring sui delete

| Handler | Linea | undo restore strategy |
|---------|-------|------------------------|
| `eliminaIncasso` | 1767 | clear `deletedAt` |
| `eliminaProprieta` | 1904 | clear `deletedAt` su prop + incassi marcati nello stesso burst |
| `eliminaUtenza` | 1864 | re-push utenza dal deep clone catturato in closure (no soft-delete) |
| `eliminaBanca` | 1923 | re-push banca dal deep clone catturato in closure (no soft-delete) |

## 7. Salute dati page — data flow

### Counts (tutto da state in memoria, no nuove sorgenti)

| Metrica | Espressione |
|---------|-------------|
| Proprietà attive | `this.attivi(this.dati.proprieta).length` |
| Proprietà cestinate | `this.dati.proprieta.filter(p => p.deletedAt).length` |
| Incassi attivi | `this.attivi(this.dati.incassiAffitti).length` |
| Incassi cestinati | `this.dati.incassiAffitti.filter(i => i.deletedAt).length` |
| Incassi orfani | `this.attivi(this.dati.incassiAffitti).filter(i => !this.dati.proprieta.find(p => p.id === i.proprietaId)).length` |
| Incassi importo=0 | `this.attivi(this.dati.incassiAffitti).filter(i => !(i.importo > 0)).length` |
| Utenze importo=0 | `this.dati.utenze.filter(u => !(u.importo > 0)).length` |

### Sync state

- **Ultimo sync**: leggere `updated_at` dalla cache localStorage `gestione_affitti_cache` (scritta in `scriviCache`, riga 1543). Già presente! `JSON.parse(localStorage.getItem('gestione_affitti_cache') || '{}').updated_at`
- **Dimensione blob**: `Math.round(JSON.stringify(this.dati).length / 1024)` KB

### Storage usage

```js
async storagePct() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const est = await navigator.storage.estimate();
  if (!est.quota) return null;
  return Math.round((est.usage / est.quota) * 100);
}
```

Usare un getter `x-init` che imposta `this.storagePctValue = await ...` al caricamento di Impostazioni.

### Errori list

```js
errori() {
  try { return JSON.parse(localStorage.getItem('errori') || '[]'); }
  catch (e) { return []; }
}
```

UI: collapsed by default, click per espandere, lista timestamp+message+stack tronc.

### "Invia diagnostica"

```js
const SUPPORT_WHATSAPP = ''; // costante in cima ad app.js — Claude's discretion, da chiedere a Stefano

inviaDiagnostica() {
  if (!SUPPORT_WHATSAPP) { alert('Numero diagnostica non configurato.'); return; }
  const ultimi = this.errori().slice(-50);
  const body = ultimi.map(e => `[${e.ts}] ${e.message}${e.stack ? '\n' + e.stack.slice(0,200) : ''}`).join('\n\n');
  const text = `Diagnostica Gestione Affitti\nUtente: ${this.utente?.email || 'n/d'}\n\n${body}`.slice(0, 3500); // limite URL whatsapp
  const url = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
```

UI button disabilitato se `SUPPORT_WHATSAPP` vuoto, con title "Numero non configurato".

### Placeholder PR2b

```html
<div class="glass-card mt-6 opacity-60">
  <h4 class="font-medium">Sezione Sync</h4>
  <p class="italic text-sm text-gray-500">Coda mutazioni, ultimo flush, conflitti — disponibile dopo PR2b (migrazione schema).</p>
</div>
```

## 8. Error capture (`localStorage.errori[]`)

Registrare in `init()` (riga 1325), all'inizio prima di tutto il resto:

```js
window.addEventListener('error', (ev) => {
  this.pushErrore({
    ts: new Date().toISOString(),
    message: ev.message || 'unknown error',
    stack: ev.error?.stack?.slice(0, 1000) || null,
    url: ev.filename || null,
    line: ev.lineno || null,
    severity: 'error'
  });
});

window.addEventListener('unhandledrejection', (ev) => {
  this.pushErrore({
    ts: new Date().toISOString(),
    message: 'Promise rejection: ' + (ev.reason?.message || String(ev.reason)),
    stack: ev.reason?.stack?.slice(0, 1000) || null,
    severity: 'error'
  });
});
```

Implementazione `pushErrore`:
```js
pushErrore(entry) {
  try {
    const arr = JSON.parse(localStorage.getItem('errori') || '[]');
    arr.push(entry);
    while (arr.length > 50) arr.shift();
    localStorage.setItem('errori', JSON.stringify(arr));
  } catch (e) {
    console.warn('pushErrore fallito:', e);
  }
}
```

**Sicurezza**: nessun problema. Gli errori contengono solo dati lato client. Non includere mai dati `this.dati` (potrebbe contenere PII). Stack trace = JS stack, ok.

## 9. Validation

### Importo=0 su Incasso save

Site: `salvaIncassoModificato` (1756). Aggiungere PRIMA di `this.dati.incassiAffitti[idx] = ...`:

```js
if (!(this.incassoInModifica.importo > 0)) {
  if (!confirm('L\'importo è 0. Confermi?')) return;
}
```

Idealmente sostituire `confirm` con modal Alpine custom (vedi anche REGRESSION-04 test che intercetta `page.on('dialog')` — quel test andrà aggiornato nello stesso commit). Pattern: `mostraConfermaSoft = { active, message, onConfirm }` come fatto per undo toast.

### Banca-missing su Incasso save

Stesso site:
```js
if (!this.incassoInModifica.bancaId) {
  this.mostraToast('warn', 'Nessuna banca selezionata — l\'incasso non sarà conteggiato nei totali per banca.');
  // Non bloccante, continue.
}
```

Aggiungere un sistema toast generico (warn/info/success) accanto all'undo toast — può condividere lo stesso meccanismo a slot singolo o usare uno slot separato.

### Currency-mismatch su Incasso save

`banche` HA `currency`, quindi fattibile:

```js
const banca = this.dati.banche.find(b => b.id === this.incassoInModifica.bancaId);
if (banca && banca.currency !== this.incassoInModifica.currency) {
  this.mostraToast('warn', `La valuta dell'incasso (${this.incassoInModifica.currency}) non corrisponde alla banca (${banca.currency}).`);
}
```

Non bloccante. CONTEXT R-G era worried che `currency` non esistesse — **smentito dalla lettura del codice** (riga 1247, 1248, 1913).

### Estendere il pattern esistente di `salvaProprieta`

Il pattern di doppio confirm su `salvaProprieta` (1879+1894) è una buona base ma usa `confirm()` native. Mantenerlo per ora, ma se viene introdotto un soft-confirm modale per Incassi, idealmente rifattorizzare anche `salvaProprieta` per coerenza. **Raccomandazione**: Tutto in un solo helper `chiediConferma(message): Promise<boolean>` e tutti i siti lo usano.

## 10. 3 Bugfix — diff esatti

### Bug 1 — `importaJSON` (riga 1586–1590)

**Before**:
```js
async importaJSON(event) {
  const file = event.target.files[0]; if (!file) return;
  try { this.dati = JSON.parse(await file.text()); this.generaIncassiAttesi(); await this.salva();
  } catch(e) { alert('Errore nel file JSON: ' + e.message); }
},
```

**After**:
```js
async importaJSON(event) {
  const file = event.target.files[0]; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    this.dati = migraDati(parsed);         // ← BUGFIX 1
    this.generaIncassiAttesi();
    await this.salva();
  } catch(e) {
    alert('Errore nel file JSON: ' + e.message);
    this.pushErrore({ ts: new Date().toISOString(), message: 'importaJSON fail: ' + e.message, severity: 'error' });
  }
},
```

### Bug 2 — `generaIncassiAttesi` (righe 1601–1612)

**Before** (l'esistente block aggiorna senza guardia):
```js
const esistente = this.dati.incassiAffitti.find(i => i.proprietaId === prop.id && i.mese === mese);
if (esistente) {
  if (!esistente.dataIncasso) {
    esistente.importo = prop.importoAffittoMensile;
    esistente.bancaId = prop.bancaIncasso;
    esistente.dataPrevista = dataPrevist(mese, prop.scadenzaAffitto);
  }
  continue;
}
```

**After**:
```js
const esistente = this.dati.incassiAffitti.find(i => i.proprietaId === prop.id && i.mese === mese);
if (esistente) {
  if (!esistente.dataIncasso && !esistente.modificatoManualmente) {   // ← BUGFIX 2
    esistente.importo = prop.importoAffittoMensile;
    esistente.bancaId = prop.bancaIncasso;
    esistente.dataPrevista = dataPrevist(mese, prop.scadenzaAffitto);
  }
  continue;
}
```

Inoltre **`salvaIncassoModificato` (1756–1766)** deve settare il flag:

**Before**:
```js
salvaIncassoModificato() {
  if (!this.incassoInModifica) return;
  const idx = this.dati.incassiAffitti.findIndex(i => i.id === this.incassoInModifica.id);
  if (idx >= 0) {
    if (this.incassoInModifica.dataIncasso === '') this.incassoInModifica.dataIncasso = null;
    this.dati.incassiAffitti[idx] = { ...this.incassoInModifica };
    this.salva();
  }
  this.incassoInModifica = null;
},
```

**After**:
```js
salvaIncassoModificato() {
  if (!this.incassoInModifica) return;
  const idx = this.dati.incassiAffitti.findIndex(i => i.id === this.incassoInModifica.id);
  if (idx >= 0) {
    if (this.incassoInModifica.dataIncasso === '') this.incassoInModifica.dataIncasso = null;
    const orig = this.dati.incassiAffitti[idx];
    const modificato =
      orig.importo !== this.incassoInModifica.importo ||
      orig.bancaId !== this.incassoInModifica.bancaId ||
      orig.dataPrevista !== this.incassoInModifica.dataPrevista;
    this.dati.incassiAffitti[idx] = {
      ...this.incassoInModifica,
      modificatoManualmente: orig.modificatoManualmente || modificato,    // ← BUGFIX 2
    };
    this.salva();
  }
  this.incassoInModifica = null;
},
```

Backfill `modificatoManualmente: false` per record esistenti via `migraDati` v3 (vedi §3).

### Bug 3 — catch chain in `salvaSubito` (righe 1560–1576)

**Attenzione**: CONTEXT dice "`salva()` catch chain". Il codice mostra che il try/catch reale è in `salvaSubito` (1560–1576), non in `salva()` (1521–1533, no try). Il piano va corretto.

**Before**:
```js
try {
  const { error } = await sb.from('user_data').upsert({
    user_id: this.utente.id,
    data: this.dati,
    updated_at: ora
  });
  if (error) throw error;
  scriviCache();
  this.modalitaOffline = false;
  this.statoSalvataggio = 'salvato';
} catch(e) {
  console.error('Errore salvataggio:', e);
  scriviCache();
  this.modalitaOffline = true;
  this.statoSalvataggio = 'offline';
}
```

**After**:
```js
try {
  const { error } = await sb.from('user_data').upsert({
    user_id: this.utente.id,
    data: this.dati,
    updated_at: ora
  });
  if (error) throw error;
  scriviCache();
  this.modalitaOffline = false;
  this.statoSalvataggio = 'salvato';
  this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));  // per snapshot ring buffer
} catch(e) {
  console.error('Errore salvataggio:', e);
  scriviCache();
  this.pushErrore({ ts: new Date().toISOString(), message: 'salvaSubito: ' + (e.message || String(e)), stack: e.stack, severity: 'error' });

  // a) Auth-expired: tenta refresh + retry una volta
  const msg = (e.message || '').toLowerCase();
  const code = e.code || e.status;
  if (/jwt|token|expired|unauthor/i.test(msg) || code === 401) {
    try {
      const { data, error: refreshErr } = await sb.auth.refreshSession();
      if (!refreshErr && data?.session) {
        // Retry una sola volta
        const { error: retryErr } = await sb.from('user_data').upsert({
          user_id: this.utente.id, data: this.dati, updated_at: ora
        });
        if (!retryErr) {
          scriviCache();
          this.modalitaOffline = false;
          this.statoSalvataggio = 'salvato';
          return;
        }
      }
    } catch (_) {}
    this.statoSalvataggio = 'errore';
    this.mostraToast('error', 'Sessione scaduta — riaccedi.');
    return;
  }

  // b) RLS / permission denied (Postgres 42501, Supabase code 'PGRST301' o status 403)
  if (code === '42501' || code === 403 || /row.level.security|permission|forbidden/i.test(msg)) {
    this.statoSalvataggio = 'errore';
    this.mostraToast('error', 'Errore di permessi sul database.');
    return;
  }

  // c) Network: fetch failure / offline (TypeError di fetch, navigator.onLine false)
  if (e instanceof TypeError || !navigator.onLine || /network|fetch|failed to fetch/i.test(msg)) {
    this.modalitaOffline = true;
    this.statoSalvataggio = 'offline';
    this.mostraToast('warn', 'Offline — modifiche salvate solo localmente.');
    return;
  }

  // d) Other: generic
  this.modalitaOffline = true;
  this.statoSalvataggio = 'offline';
  this.mostraToast('error', 'Errore salvataggio: ' + (e.message || 'sconosciuto'));
}
```

[CITED Supabase JS v2 error shapes: `error.code`, `error.status` — supabase-js docs / postgres error codes ref]

## 11. Playwright regression strategy

### Esistenti

| Spec | LIVE/SKIP | Selettori che potrebbero rompersi |
|------|-----------|-----------------------------------|
| `login.spec.ts` CRITICAL-01 | LIVE | `[data-testid="status-dot"]`, `text=Appartamento Test Via Roma`, `getByRole('heading', level:1, name:'Dashboard')` — tutti immutati da PR1. |
| `login.spec.ts` REGRESSION-04 | LIVE | **Intercetta `page.on('dialog')`** per importo=0 confirm. PR1 sostituisce `confirm()` nativo con modal custom → il test va aggiornato a `expect(page.locator('[data-testid="soft-confirm-modal"]'))`. Same-commit fixture update. |
| `calendario.spec.ts` REGRESSION-01 | LIVE | `[data-testid="calendar-card"][data-status="sistema"]` — immutato. |
| `calendario.spec.ts` REGRESSION-02 | LIVE | `page.on('dialog')` su `alert()` di `generaIncassiMeseVisualizzato`. Se sostituiamo `alert` con modal/toast in PR1 (NON necessario — non in scope) → ok. Lasciare `alert()`. |
| `calendario.spec.ts` REGRESSION-05 | LIVE | `h3` filter "Incassi orfani". Immutato. |
| `calendario.spec.ts` CRITICAL-02 | LIVE | `[data-testid="calendar-card"][data-status]` immutati. |
| `calendario.spec.ts` CRITICAL-03 | LIVE | `[data-testid="prop-section"]`, `[data-testid="prop-form"]`, `input[x-model="editProprieta.nome"]`, `propSection.locator('td')` — immutati. **Rischio**: aggiungendo Cestino/Salute dati/Snapshot in Impostazioni, l'ordine dei figli cambia. `prop-section` resta scoping puntuale, dovrebbe tenere. |
| `cestino.spec.ts` | SKIP (TODO PR1) | DA UN-SKIPPARE in PR1 (REQ-SAFE-01+02). |
| `offline.spec.ts` | SKIP (TODO PR2b) | Resta skip. |
| `sw.spec.ts` REGRESSION-03 | LIVE | `swCount === 0`. Immutato. |

### Nuovi `data-testid` da introdurre (lista vincolante per il planner)

| testid | Componente |
|--------|-----------|
| `cestino-section` | wrapper Cestino |
| `cestino-row-<id>` | ogni riga |
| `cestino-restore-<id>` | bottone Ripristina |
| `cestino-hard-<id>` | bottone Elimina definitivamente |
| `cestino-empty` | empty state paragraph |
| `snapshot-section` | wrapper Snapshot |
| `snapshot-row-<ts>` | ogni riga snapshot |
| `snapshot-restore-<ts>` | bottone Ripristina |
| `salute-dati-section` | wrapper Salute dati |
| `salute-count-proprieta-attive` etc. | ogni count metric |
| `salute-storage-pct` | percentuale storage |
| `salute-errori-list` | lista errori |
| `salute-invia-diagnostica` | bottone WA |
| `undo-toast` | il toast |
| `undo-button` | il bottone Annulla |
| `soft-confirm-modal` | modale conferma soft |
| `soft-confirm-yes` / `soft-confirm-no` | i bottoni del modale |

### 5 nuovi test (con step concreti)

#### Test 1: Cestino round-trip (`tests/cestino.spec.ts` un-skip)

```ts
test('PR1-01: elimina proprieta + ripristina dal cestino', async ({ page, seedData }) => {
  await doLogin(page);
  await page.click('button:has-text("Impostazioni")');
  const propSection = page.locator('[data-testid="prop-section"]');
  // Elimina prop-test-001
  let confirmed = false;
  page.on('dialog', async d => { confirmed = true; await d.accept(); });
  await propSection.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' })
    .locator('button:has-text("Elimina")').click();
  await expect.poll(() => confirmed, { timeout: 5000 }).toBe(true);
  // Aspetta che la riga sparisca
  await expect(propSection.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' })).toHaveCount(0, { timeout: 5000 });
  // Vai al Cestino
  const cestino = page.locator('[data-testid="cestino-section"]');
  await expect(cestino).toBeVisible();
  await expect(cestino.locator('text=Appartamento Test Via Roma')).toBeVisible();
  // Ripristina
  await cestino.locator('button:has-text("Ripristina")').first().click();
  // Verifica riapparizione
  await expect(propSection.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' })).toBeVisible({ timeout: 5000 });
});
```

#### Test 2: Cestino hard delete

```ts
test('PR1-02: elimina definitivamente da cestino + cascading incassi', async ({ page, seedData }) => {
  await doLogin(page);
  // Pre-step: cancella la proprieta (soft)
  await page.click('button:has-text("Impostazioni")');
  page.on('dialog', async d => await d.accept());
  await page.locator('[data-testid="prop-section"] tr').filter({ hasText: 'Appartamento Test Via Roma' })
    .locator('button:has-text("Elimina")').click();
  // Vai al cestino, hard delete
  const cestino = page.locator('[data-testid="cestino-section"]');
  await cestino.locator('button:has-text("Elimina definitivamente")').first().click();
  // La riga sparisce dal cestino
  await expect(cestino.locator('text=Appartamento Test Via Roma')).toHaveCount(0, { timeout: 5000 });
  // Verifica via JS: dati.proprieta non contiene piu' prop-test-001 NE' suoi incassi
  const state = await page.evaluate(() => {
    const root = document.querySelector('[x-data]');
    return Alpine.$data(root).dati;
  });
  expect(state.proprieta.find((p:any) => p.id === 'prop-test-001')).toBeUndefined();
  expect(state.incassiAffitti.filter((i:any) => i.proprietaId === 'prop-test-001')).toHaveLength(0);
});
```

#### Test 3: Undo toast su elimina incasso

```ts
test('PR1-03: undo toast su elimina incasso ripristina entro 5s', async ({ page, seedData }) => {
  await doLogin(page);
  await page.click('button:has-text("Calendario")');
  // Trova primo incasso card e usa il menu Elimina (dipende dal markup PR1 — placeholder)
  // ... azione di elimina ...
  const toast = page.locator('[data-testid="undo-toast"]');
  await expect(toast).toBeVisible({ timeout: 2000 });
  await toast.locator('[data-testid="undo-button"]').click();
  await expect(toast).toBeHidden({ timeout: 1000 });
  // Verifica che l'incasso sia tornato
  // ...
});
```

#### Test 4: Snapshot timeline + restore

```ts
test('PR1-04: snapshot ring buffer registra mutazioni e ripristina', async ({ page, seedData }) => {
  await doLogin(page);
  // Esegui 2 mutazioni (modifica importo proprieta, segna incasso)
  // ...
  await page.click('button:has-text("Impostazioni")');
  const snapshot = page.locator('[data-testid="snapshot-section"]');
  await expect(snapshot.locator('[data-testid^="snapshot-row-"]')).toHaveCount(2, { timeout: 5000 });
  // Ripristina il primo (piu' vecchio)
  page.on('dialog', async d => await d.accept());
  await snapshot.locator('[data-testid^="snapshot-restore-"]').last().click();
  // Verifica state ripristinato
});
```

#### Test 5: Salute dati counts

```ts
test('PR1-05: Salute dati mostra counts corretti', async ({ page, seedData }) => {
  await doLogin(page);
  // Cancella una proprieta (soft)
  await page.click('button:has-text("Impostazioni")');
  page.on('dialog', async d => await d.accept());
  await page.locator('[data-testid="prop-section"] tr').first().locator('button:has-text("Elimina")').click();
  // Vai a Salute dati
  const salute = page.locator('[data-testid="salute-dati-section"]');
  await expect(salute).toBeVisible();
  await expect(salute.locator('[data-testid="salute-count-proprieta-attive"]')).toContainText('1');
  await expect(salute.locator('[data-testid="salute-count-proprieta-cestinate"]')).toContainText('1');
});
```

## 12. Task sequencing — layer raccomandati

| Layer | Cosa | Commit isolato? | Rationale |
|-------|------|-----------------|-----------|
| **A** | Estrazione `<script>` → `app.js`, sostituire con `<script src defer>` | **SÌ — primo commit della PR** | Refactor puro, zero behavior delta. Se CI rossa → revert immediato. |
| **B** | `migraDati` v3: backfill `deletedAt: null` su proprietà+incassi, `modificatoManualmente: false` su incassi. Helper `attivi(arr)`. Aggiornare tutti i ~20 call site al filtro. | SÌ | Pure data-layer. La UI continua a funzionare identica (gli items hanno tutti deletedAt=null, nessuno è filtrato out). |
| **C** | Patch `eliminaProprieta` + `eliminaIncasso` a soft-delete. `purgeOldSoftDeleted` in init. Cascading restore logic (ancora senza UI). | SÌ | Dopo C, l'utente non vede ancora il Cestino ma elimina = soft-delete e le cose spariscono "come prima" dalle viste. |
| **D** | Undo toast component + state + `mostraUndoToast`. Wiring su tutti i 4 elimina (Proprietà, Incasso, Utenza, Banca). | SÌ | Toast disponibile prima del Cestino. |
| **E** | Cestino section in Impostazioni (HTML + `cestinoItems()` + `ripristina()` + `eliminaDefinitivamente()` + `svuotaCestino()` + `relativeTime`). | SÌ | A questo punto soft-delete è completamente usable end-to-end. |
| **F** | Snapshot ring buffer: `pushSnapshot`, `_lastSnapshotData` hook in `caricaDatiUtente`+`salvaSubito`+`salva`, "Ripristina snapshot" UI in Impostazioni. | SÌ | Indipendente da Cestino. |
| **G** | Salute dati page: counts, `storagePct`, errori list, `pushErrore`, `window.addEventListener('error'/'unhandledrejection')`, "Invia diagnostica" WhatsApp. | SÌ | Layer di osservabilità. |
| **H** | Validation extension: importo=0 modal custom + banca-missing toast + currency-mismatch toast, anche su Incassi. Modal `soft-confirm-modal` riusabile. Rifattorizzare `salvaProprieta` per usare lo stesso modal. | SÌ | Aggiorna REGRESSION-04 fixture nello STESSO commit. |
| **I** | 3 bugfix: importaJSON+migraDati / generaIncassiAttesi+modificatoManualmente / salvaSubito catch chain. | SÌ — preferibilmente 3 commit separati per leggibilità del PR diff, ma 1 commit unico è accettabile. | Indipendenti dalla feature work. Possono ride dentro B (Bugfix 2 lega a backfill) ma raccomando standalone. |
| **J** | Nuovi 5 test Playwright + un-skip `cestino.spec.ts`. Fixture updates per REGRESSION-04 (modal selector). | SÌ | Ultimo prima del merge. |
| **K** | Smoke manuale iPhone viewport (drawer + nuove sezioni Impostazioni). Run finale Playwright. | n/a | Pre-merge gate. |

**Ordine**: A → B → C → D → E → F → G → H → I → J → K.

**Note specifiche**:
- **A è hard precondition** per tutto: nessun altro lavoro tocca lo script inline.
- **B prima di C**: il backfill di `deletedAt` rende il filtro `attivi()` un no-op finché C non setta `deletedAt = ISOString`. Se C avviene prima di B, gli oggetti vecchi NON hanno il campo e il filtro funziona comunque (`!undefined === true`), ma è più sicuro avere il campo esplicito.
- **D prima di E**: l'undo toast è chiamato dagli handler patchati in C. Se viene introdotto dopo E, va aggiunto un placeholder no-op in C.
- **Bugfix 2 (modificatoManualmente)** dipende dal backfill in B: il flag deve esistere su tutti i record prima che `generaIncassiAttesi` lo legga. Ordinare quindi I.2 dopo B.

## 13. Risks & unknowns

| Rischio | Sezione | Mitigazione |
|---------|---------|-------------|
| **R-A**: Snapshot vs Cestino interazione confonde utente | §5, §4 | Modal di conferma esplicito su restore snapshot ("sovrascriverà lo stato attuale, incluso il cestino"). Help text in Salute dati. |
| **R-B**: `app.js` estrazione rompe Alpine wiring | §2 | Commit isolato + CI gate immediato. Se rosso, revert. `defer` ordine già verificato sopra. |
| **R-C**: Past data loss non recuperabile | — | Solo release note. Indipendente da PR1. |
| **R-D**: Auto-purge 30 giorni sorprende | §3 | Console log + entry in `errori` (severity 'info') visibile in Salute dati. |
| **R-E**: localStorage quota | §5 | Try/catch su `pushSnapshot` + `pushErrore`. Degrade silenzioso. Stima budget 500KB << quota 5–10MB. |
| **R-F**: Playwright selector breakage in 13 specs | §11 | Same-commit fixture update (REGRESSION-04 modal). Nuovi `data-testid` ben isolati. |
| **R-G**: Currency field missing | — | **RISOLTO** dalla lettura del codice: `banche[].currency` esiste già. |
| **R-H** (nuovo): `_lastSnapshotData` non viene inizializzato su primo login → primo snapshot perso | §5 | Inizializzare in `caricaDatiUtente` sia nel ramo "dati esistenti" che nel ramo "primo accesso". |
| **R-I** (nuovo): REGRESSION-04 intercetta `confirm()` nativo per importo=0; se si sostituisce con modal Alpine, il test va aggiornato nello stesso commit | §9, §11 | Pianificato in layer H. |
| **R-J** (nuovo): `salvaProprieta` ha già il pattern di doppio `confirm()` su importo=0 e currency. Se PR1 NON tocca questi due, l'esperienza è inconsistente (Incassi → modale custom; Proprietà → confirm nativo). | §9 | Refactor entrambi in layer H usando lo stesso `chiediConferma` helper. |

## 14. Open questions for the planner

1. **Numero WhatsApp diagnostica**: stringa vuota nella costante `SUPPORT_WHATSAPP`, bottone disabilitato finché Stefano non lo fornisce. ✓ default proposto.
2. **Ripara orfani**: solo display read-only in PR1. ✓ default proposto.
3. **Modal soft-confirm shared component**: introdurre `soft-confirm-modal` Alpine state generico riusato per importo=0, currency-mismatch, eliminazioni definitive, restore snapshot, svuota cestino. Default: SÌ, un unico componente. Riduce duplicazione di markup glass-style.
4. **Sostituire il `confirm()` nativo di `eliminaUtenza` e `eliminaBanca`**: tecnicamente l'undo toast sostituisce la necessità di confirm su delete (l'utente ha 5s per annullare). Default proposto: **rimuovere** i `confirm()` su Utenza/Banca/Incasso/Proprietà; mantenere SOLO sui "Elimina definitivamente" del Cestino. Più moderno e coerente con i pattern macOS Sonoma. Se la planner-checker considera questo "troppo aggressivo", mantenere `confirm()` su delete proprietà solo e dropparli sugli altri.
5. **Bumping `dataVersion` a 3**: confermato come pattern dell'app. Nessuna alternativa proposta.
6. **Ordine commit del Bugfix 3 (`salvaSubito` catch)**: se il commit catch chain viene PRIMA di layer G (error capture), `pushErrore` non esiste ancora. Soluzione: layer G subito prima di I, oppure stub `pushErrore` introdotto in A/B come no-op e completato in G. Default: G prima di I.

## Project Constraints (from CLAUDE.md)

- All'inizio sessione, leggere `SESSIONE.md`, wiki `gestione-affitti.md`, log entries rilevanti. (Già fatto contestualmente al progetto.)
- "apri sessione" / "chiudi sessione" senza progetto = `gestione-affitti`.
- Chiusura sessione aggiorna anche wiki del second brain, non solo repo.

Nessuna di queste regole impatta direttamente il contenuto di RESEARCH/PLAN: sono routine di pre/post phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Soft-delete state model | Browser (Alpine state) | — | Single-page app, no backend logic |
| Cestino UI | Browser (Alpine + DOM) | — | View su state in memoria |
| Snapshot persistence | Browser (localStorage) | — | Ring buffer client-side |
| Undo toast | Browser (Alpine component) | — | Effimero |
| Salute dati metrics | Browser (computed getters) | navigator.storage API | Tutto derivato da state |
| Error capture | Browser (window listeners) | localStorage | No backend telemetry in PR1 |
| WhatsApp diagnostica | Browser (window.open URL) | wa.me redirect (esterno) | No backend |
| Validation modals | Browser (Alpine modale) | — | Soft-confirm pattern |
| Bugfix importaJSON | Browser (file API + migraDati) | — | Già browser-side |
| Bugfix generaIncassiAttesi | Browser (Alpine method) | — | |
| Bugfix salvaSubito catch | Browser → Supabase API | Supabase (errors interpretazione) | Catch chain decide come degradare |
| `app.js` extraction | Browser (file-level refactor) | — | Pure refactor, zero tier shift |

**Tutto rimane browser-tier.** Nessun tier shift in PR1. Supabase resta lo store remoto, ma PR1 NON tocca lo schema (è Phase 5/PR2b).

## Don't Hand-Roll

| Problema | NON costruire | USA invece | Perché |
|----------|--------------|-----------|--------|
| Snapshot deep clone | Custom clone con loop | `JSON.parse(JSON.stringify(...))` | I dati sono puro JSON (no Date, no Map, no circular refs). Idiomatico, testato, atomico. |
| Diff tra snapshot e current state | Diff-by-field library | Conteggi `length` delle 3-4 array | UI mostra counts ±N, non field-level diff (out of scope per PR1) |
| Relative time formatting | `moment.js` / `dayjs` | Helper `relativeTime(iso)` 6 righe | Niente nuove dipendenze. Pattern minimal. |
| Modale glass-style | Custom CSS framework | Riusare `.glass-card` + Alpine `x-show`+transitions | Already established by PR0 |
| Error stack truncation | Sanitizer library | `.slice(0, 1000)` | Bastevole per Salute dati |
| UUID per items | UUID v4 lib | `uid()` esistente (riga 1209) | Already in codebase |

## Common Pitfalls

### Pitfall 1: `incassi` vs `incassiAffitti`

**Cosa va storto**: CONTEXT.md usa "incassi", il codice ha `incassiAffitti`. Plan e task che fanno copy-paste da CONTEXT romperanno tutto.
**Mitigazione**: il piano usa SEMPRE `incassiAffitti`. Verificare con grep prima di scrivere ogni riga di codice.

### Pitfall 2: Helper functions globali "rubate" da Alpine inline

**Cosa va storto**: Mettere `function attivi()` dentro `app()` come metodo (ok) MA referenziarla in `x-text="attivi(...)"` inline funziona solo dentro lo scope `app()`. Se appare un `x-text="formatValuta(...)"` da un altro scope (es. un `x-data` annidato), `formatValuta` deve restare globale.
**Mitigazione**: `formatValuta`, `formatData`, `oggi`, `meseCorrente`, `dataPrevist`, `uid` restano global functions in `app.js`. Non spostarle in metodi di `app()`.

### Pitfall 3: `confirm()` nativo intercettato da Playwright

**Cosa va storto**: Sostituire il confirm con un modal Alpine custom rompe REGRESSION-04 (intercetta `page.on('dialog')`).
**Mitigazione**: stesso-commit fixture update. Test diventa `await expect(page.locator('[data-testid="soft-confirm-modal"]')).toBeVisible()`.

### Pitfall 4: `_lastSnapshotData` non inizializzato al primo login

**Cosa va storto**: Il primo `salva()` cerca di pushare snapshot pre-mutation ma `_lastSnapshotData` è `undefined` → snapshot perso o crash.
**Mitigazione**: inizializzarlo in entrambi i rami di `caricaDatiUtente` (riga ~1481, ~1492, ~1503).

### Pitfall 5: deep-clone object identity sui restore snapshot

**Cosa va storto**: `this.dati = snap.dati` (no clone) → mutazioni future al state mutano anche lo snapshot in localStorage al prossimo `localStorage.setItem('gestione_affitti_snapshots', JSON.stringify(arr))`.
**Mitigazione**: SEMPRE `JSON.parse(JSON.stringify(snap.dati))` su restore.

### Pitfall 6: localStorage quota silenziosa

**Cosa va storto**: 10 snapshot × utente con 5 anni di dati = potenziale 5MB. Quota hit → `QuotaExceededError` silente.
**Mitigazione**: try/catch su `pushSnapshot`, log via `pushErrore` (che ovviamente potrebbe fallire anch'esso, ma a quel punto è hopeless). Aggiungere alert UI in Salute dati se storage > 80%.

### Pitfall 7: Auto-purge mangia dati di test

**Cosa va storto**: I test seed dati con `deletedAt` impostato 31+ giorni fa? L'init li mangia. Se i test seed solo current state, ok.
**Mitigazione**: i test esistenti seed-dano da `MOCK_DATI` (fixtures.ts) che non ha mai `deletedAt`. L'auto-purge è no-op su test seed. OK.

## State of the Art

| Approccio vecchio | Approccio nuovo (PR1) | Quando cambia | Impatto |
|------------------|----------------------|---------------|---------|
| Hard delete `splice` | Soft-delete `deletedAt` | A questa PR | Recoverable via Cestino + Undo |
| Single try/catch in `salvaSubito` | Catch chain a 4 vie (auth/RLS/network/other) | Bug 3 | Auth-expired non degrada a offline; RLS visibile all'utente |
| Inline `<script>` 730 righe | `app.js` external + classic script | Layer A | Codebase ispezionabile, future-proof per source-map se mai serviranno |
| `migraDati` v2 | `migraDati` v3 con `deletedAt`+`modificatoManualmente` backfill | Layer B | Idempotente, retro-compatibile |
| `confirm()` nativo | Modale Alpine glass | Layer H | UX consistente con PR0 Sonoma skin |

## Sources

### Primary (HIGH confidence)
- `index.html` letto integralmente nella zona `<script>` (1207–1937) — line numbers ground-truth.
- `tests/*.spec.ts` letti integralmente — selettori e fixture pattern verificati.
- `.planning/phases/03-pr1-data-safety-net/CONTEXT.md` — decisioni lockate.
- MDN Web Storage API quotas: tipicamente 5–10MB per origin [VERIFIED comune in tutti i browser moderni].
- HTML spec `script defer`: ordered execution before DOMContentLoaded [CITED].
- Alpine.js v3 docs: `x-data` valuated at DOMContentLoaded, supports global `app()` function pattern [CITED].

### Secondary (MEDIUM confidence)
- Supabase JS v2 error shape (`error.code`, `error.status`) — based on supabase-js docs pattern, common values.
- PostgreSQL RLS error codes (42501 = insufficient_privilege) — Postgres docs.

### Tertiary (LOW confidence)
- localStorage exact quota varia per browser/OS — usato come stima conservativa.

## Assumptions Log

| # | Claim | Sezione | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase error code per JWT scaduto include "jwt"/"expired" o status 401 | §10 Bug3 | Catch falsa categoria → degrada a "other" → toast generico anziché refresh. **Mitigazione**: log via `pushErrore` permette di osservare e patchare. |
| A2 | Postgres error code 42501 viene propagato da supabase-js come `error.code === '42501'` | §10 Bug3 | Stessa di A1. Includere anche match testuale `permission|forbidden`. |
| A3 | `navigator.storage.estimate()` disponibile su Safari iOS recente | §7 | Sull'iPhone di Stefano: iOS 17+ ha l'API. Se manca: il getter ritorna null e l'UI mostra "n/d". Non bloccante. |
| A4 | localStorage `gestione_affitti_snapshots` non collide con altre chiavi | §5 | Prefisso `gestione_affitti_` già usato per `cache` e `dati` (deprecato). Pattern coerente. |
| A5 | Stefano non usa modalità privata/incognita (che ha localStorage limitato) | §5 | Se lo facesse: snapshot ring buffer non funziona, Cestino sì (resta nel `dati` blob su Supabase). Documentare in release notes. |
| A6 | Il numero WhatsApp diagnostica può essere lasciato vuoto in PR1 con bottone disabilitato | §7 | Sì: gestito gracefully. **DA CONFERMARE** con Stefano durante plan/execute. |
| A7 | Test PR1-03 (undo toast su elimina incasso) ha un markup di delete-button visibile sulle card calendario | §11 | Verificare quando si scrive il test che la card abbia un bottone Elimina accessibile. Se no, test passa via Impostazioni o storico proprietà. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (vedi `package.json`) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test tests/<file>.spec.ts` |
| Full suite command | `npm test` (alias di `playwright test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REQ-SAFE-01 + 02 | Soft-delete + Cestino round-trip | e2e | `npx playwright test tests/cestino.spec.ts` | ✓ (skip — da un-skippare) |
| REQ-SAFE-02 | Cestino hard delete cascading | e2e | `npx playwright test tests/cestino.spec.ts` (add test) | ❌ Wave 0 |
| REQ-SAFE-04 | Undo toast | e2e | `npx playwright test tests/undo.spec.ts` (new) | ❌ Wave 0 |
| REQ-SAFE-03 | Snapshot restore | e2e | `npx playwright test tests/snapshot.spec.ts` (new) | ❌ Wave 0 |
| REQ-SAFE-05 | Salute dati counts | e2e | `npx playwright test tests/salute-dati.spec.ts` (new) | ❌ Wave 0 |
| REQ-SAFE-06 (importo=0) | Modal custom sostituisce confirm | e2e | aggiornare `tests/login.spec.ts` REGRESSION-04 | ✓ esiste, da aggiornare |
| REQ-SAFE-07 (errori) | window.error → localStorage | e2e | manual + `page.evaluate(() => localStorage.getItem('errori'))` | (manual smoke OK in PR1; coverage automatica deferred) |
| Bugfix 1 (importaJSON) | migraDati chiamato | manual | upload JSON v1 → no crash | manual-only |
| Bugfix 2 (generaIncassiAttesi) | rispetta modificatoManualmente | unit-ish | inline test via page.evaluate | manual + JS asserts |
| Bugfix 3 (salvaSubito catch) | auth retry / RLS toast | manual + mock | difficile in Playwright senza network mock | manual-only |

### Sampling Rate
- **Per task commit**: `npx playwright test --grep "<test name>"` per il test toccato
- **Per layer merge**: `npm test` completo
- **Phase gate**: `npm test` verde + smoke manuale iPhone viewport

### Wave 0 Gaps
- [ ] `tests/cestino.spec.ts` — un-skippare + aggiungere test PR1-02
- [ ] `tests/undo.spec.ts` — nuovo file
- [ ] `tests/snapshot.spec.ts` — nuovo file
- [ ] `tests/salute-dati.spec.ts` — nuovo file
- [ ] aggiornare `tests/login.spec.ts` REGRESSION-04 per modal selector
- [ ] (opzionale) seedSupabase con `MOCK_DATI_WITH_SOFT_DELETED` per ramo "cestino non vuoto al boot"

## Metadata

**Confidence breakdown:**
- Stato attuale del codice: **HIGH** — letto integralmente, line numbers verificati con `Read`.
- Estrazione `app.js`: **HIGH** — spec defer + Alpine v3 pattern documentati.
- Soft-delete recipe: **HIGH** — site list esaustiva da grep, helper `attivi()` minimale.
- Cestino UI: **HIGH** — usa pattern PR0 già spediti.
- Snapshot ring buffer: **MEDIUM** — strategia `_lastSnapshotData` introduce stato accessorio; va verificata in implementazione che non si perda mai (A4 della checklist).
- Undo toast: **HIGH** — pattern Alpine standard.
- Salute dati: **HIGH** — tutto derivato da state in memoria.
- Error capture: **HIGH** — pattern browser standard.
- Validation: **HIGH** — già metà implementato in `salvaProprieta`, replicabile.
- Bugfix: **HIGH** — diff esatti verificati.
- Playwright strategy: **HIGH** — tutti i selettori esistenti verificati su file.
- Task sequencing: **HIGH** — dipendenze tra layer chiare.

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (~30gg, stack stabile, no API esterne cambiando)
