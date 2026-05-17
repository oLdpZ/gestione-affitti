---
status: ACTIVE
type: ceo-plan
project: gestione-affitti
mode: SELECTIVE_EXPANSION
date: 2026-05-17
supersedes_design: gestione-affitti-design-pwa-20260517.md
---

# CEO Plan: Gestione Affitti — PWA + Reliability + Delight

Generato da /plan-ceo-review il 2026-05-17.
Branch: master | Mode: SELECTIVE EXPANSION
Repo: oldpz/gestione-affitti

## Vision

### 10x Check (non scelto, ma annotato)
Un'app che tuo fratello apre **solo per delegare** — OCR la bolletta da sé, notifiche proattive, ricevute auto-inviate via WhatsApp Business API agli inquilini, dashboard che propone "alza l'affitto di Via Roma del 3% basato su trend di mercato OMI". Non costruiamo questa, ma la teniamo come direzione 12-mesi.

### Direzione confermata
Family-tier, 1-3 utenti, single-file HTML preservato. Approach B di office-hours, con 8 cherry-pick accettati in CEO review.

## Scope Decisions

| # | Proposta | Effort | Decisione | Reasoning |
|---|----------|--------|-----------|-----------|
| 1 | Split PR2 in PR2a + PR2b | 0 extra | ACCEPTED | De-risk: migrazione schema isolata da SW |
| 2 | Inquilini come entità | S (CC ~15min) | ACCEPTED | Necessario per PDF ricevuta valida |
| 3 | Export CSV/PDF 730 | M (CC ~30min) | ACCEPTED | Alto valore reale (1×/anno) |
| 4 | Tipi utenza dinamici | S (CC ~10min) | ACCEPTED | Rimuove limite noto |
| 5 | Scadenze custom | S (CC ~20min) | ACCEPTED | Rimuove limite noto |
| 6 | OCR bollette Tesseract.js | M (CC ~1h) | ACCEPTED | Wow factor mobile |
| 7 | Statistiche annuali Chart.js | M (CC ~30min) | ACCEPTED | Trasforma app in strumento decisionale |
| 8 | Playwright E2E in CI | M (CC ~30min) | ACCEPTED | Previene regressioni come quella di oggi |

**Totale stimato**: ~4-5 weekend di lavoro umano supervisionato → con CC ~3-4 sessioni focalizzate.

## Accepted Scope (aggiornato dal design doc)

### PR1 — Data Safety Net
Invariato dal design doc. Soft-delete + cestino + snapshot ring buffer + undo toast + pagina Salute dati + validazione importo=0 (già parzialmente fatta oggi).

### PR2a — PWA installabile
- `manifest.json` con icons, theme, standalone display
- `sw.js` versionato con Stale-While-Revalidate per app shell + CDN
- Install prompt custom dopo 3 sessioni in 7 giorni
- Pulizia SW vecchi (già fatto in init oggi)

### PR2b — Schema migration + sync per-entità
Batched DB changes (tutto tocca lo stesso schema, fare una migrazione sola):
- Tabelle Supabase separate: `proprieta`, `incassi_affitti`, `utenze`, `banche`, `inquilini`, `tipi_utenza`
- RLS per `user_id` su ogni tabella, `updated_at` per riga
- Mutation queue in IndexedDB (`idb-keyval` CDN)
- Service worker `online` listener flusha la coda
- Conflict resolution per-entità con toast UI
- **Inquilini come entità** (nome, codice fiscale, telefono, email opz., proprieta_id)
- **Tipi utenza dinamici** (tabella `tipi_utenza` user-scoped, form CRUD in Impostazioni)
- **Scadenze custom** (campo `scadenzaGiorno: 1-31 | 'fine_mese'` su proprietà; calendario raggruppa intelligentemente per giorno)
- Script migrazione one-shot per utenti esistenti (blob → righe)

### PR3 — Feature core
- Notifiche locali utenze (scheduler in SW)
- Foto utenze/ricevute Supabase Storage (resize browser-side, thumbnail in scheda)
- Ricevute PDF jsPDF con inquilino come beneficiario (richiede PR2b)
- **Export CSV/PDF commercialista** (riassunto annuo per proprietà, totale incassi, totale utenze pagate, formato pronto per quadro RB del 730)

### PR4 — Delight
- **Statistiche annuali**: Chart.js da CDN, line chart incassi/mese × anno, bar chart utenze/proprietà, donut yield (incassi - utenze) / incassi per proprietà
- **OCR bollette**: Tesseract.js lazy-loaded al primo click "Scatta foto bolletta", estrae importo + scadenza con regex `\d+[,.]\d{2}\s*€?` e `\d{2}/\d{2}/\d{4}`, autocompila form utenza (utente conferma/corregge). Fallback: se OCR fallisce, normale form manuale.

### PR5 — Test infrastructure (parallelo)
- GitHub Actions con Playwright
- Suite minima: login, crea proprietà, segna incasso, elimina + ripristina dal cestino, offline write + sync
- Push-trigger su master, fail blocca deploy

## Deferred to TODOS.md

Nessuno. Tutti gli 8 cherry-pick sono in scope.

## NOT in scope (esplicitamente deferiti, non in TODOS)

- Multi-account familiare con sharing (out of scope, decisione office-hours)
- Backup automatico cifrato Drive/Dropbox (out of scope, manuale via Export resta)
- Invio email automatico ricevute (richiede backend custom)
- WhatsApp Business API integration (delight 12-mesi)
- Suggerimenti aumento affitto basati su OMI (delight 12-mesi)
- Migrazione a moduli ES6 (ricorrente nei TODOS, ma vincolo "single-file preserve")

## Risk Register

| # | Rischio | Likelihood | Impact | Mitigazione |
|---|---------|------------|--------|-------------|
| R1 | Migrazione schema rompe dati esistenti | Med | High | Script idempotente + backup automatico pre-migrazione + rollout dietro feature flag in localStorage |
| R2 | Service worker cache stale dopo deploy | High | Med | Versioning SW + cleanup vecchie cache al `activate` + `skipWaiting()` |
| R3 | OCR italiano impreciso → utente diffida | Med | Med | Sempre fallback manuale; UI presenta valori OCR come "suggerimenti" pre-compilati, non auto-salvati |
| R4 | Mutation queue corrompe stato (conflitti) | Low | High | Test E2E coprono scenari multi-device; UI mostra coda + permette flush manuale |
| R5 | jsPDF + Chart.js + Tesseract.js gonfiano bundle iniziale | Med | Low | Tutti lazy-loaded on-demand, non in app shell |
| R6 | Supabase Storage free tier (1GB) si riempie | Low | Med | Resize aggressivo foto a 1600px max, ~150KB per JPEG. ~7000 foto possibili. Avviso a 80% utilizzo |

## Architecture Concerns (Section 1, compressed)

```
                    NUOVO SCHEMA SUPABASE (PR2b)
   ┌─────────────────────────────────────────────────────────────┐
   │  auth.users (Supabase)                                       │
   │      │                                                       │
   │      ├──> proprieta (id, user_id, nome, importo, ...)        │
   │      │       │                                               │
   │      │       ├──> incassi_affitti (proprieta_id, mese, ...)  │
   │      │       │                                               │
   │      │       ├──> utenze (proprieta_id, tipo_id, ...)        │
   │      │       │       │                                       │
   │      │       │       └──> tipi_utenza (user_id, nome)        │
   │      │       │                                               │
   │      │       └──> inquilini (proprieta_id, nome, cf, tel)    │
   │      │                                                       │
   │      └──> banche (id, user_id, nome, currency)               │
   │                                                              │
   │  Storage: gestione-affitti/{user_id}/utenze/{id}/{uuid}.jpg  │
   └─────────────────────────────────────────────────────────────┘

   OFFLINE WRITE FLOW (PR2b)
   User action → Alpine state mutate → push to IDB queue
                                            │
                                  navigator.onLine?
                                  ┌─────┴─────┐
                                 YES         NO
                                  │           │
                          Supabase RPC    queue persists
                                  │           │
                          updated_at      online event →
                          remote sync ←── flush queue 1-by-1
                                              │
                                       conflict?
                                       ┌──┴──┐
                                      NO    YES → toast "Conflitto su X"
                                                  pick local | remote | merge
```

**Coupling concerns**:
- Service worker tocca tutto (registration, mutation queue, notification scheduler). Mitigazione: tutto in `sw.js` separato, niente sparso in `index.html`.
- Conflict resolution UI deve essere globale (accessibile da qualsiasi vista). Mitigazione: toast in `<div x-data="app()">` root.

**Single points of failure**:
- Supabase è il SPOF di sempre. Mitigazione: offline write + snapshot localStorage + export JSON manuale (esistente) restano i fallback.

## Error & Rescue (Section 2, compressed — top failures)

| Codepath | Failure | Rescued? | Rescue | User sees |
|----------|---------|----------|--------|-----------|
| Mutation queue flush | Network 500 | Y | Retry 3× con backoff esponenziale, poi resta in coda | Toast "1 modifica in coda, riprovo fra 30s" |
| Mutation queue flush | Conflict (409 updated_at mismatch) | Y | Fetch remoto, presenta UI choose | Toast con 3 bottoni |
| Mutation queue flush | Auth expired | Y | Refresh session via Supabase, retry | Trasparente |
| Schema migration (one-shot) | Partial fail mid-migration | Y | Transaction Supabase + rollback + retoast errore con export JSON di emergenza | Modal blocking "Migrazione fallita, scarica backup" |
| OCR Tesseract | Image too dark / illegible | Y | Result vuoto → form manuale aperto comunque | Toast "OCR non riuscito, compila a mano" |
| SW notification scheduler | Permission denied | Y | Disable feature, show banner once | Banner "Abilita notifiche per scadenze" |
| Supabase Storage upload | Quota exceeded | Y | Try compression riduce 60%, retry; se still fail → save base64 in localStorage fallback | Modal "Storage pieno, foto salvata localmente" |
| PDF generation | jsPDF CDN unreachable | Y | Lazy retry once, then alert | Toast "Errore generazione PDF, riprova" |

**Critical gap nel design doc originale**: nessuna gestione esplicita di **schema migration partial failure** (R1). Aggiunto qui come blocker per PR2b.

## Deployment & Rollout (Section 9, compressed)

```
PR1 → push master → GitHub Pages deploy → ~2min → live
   ZERO RISK (additive only, no schema change)

PR2a → push master → deploy
   LOW RISK (SW + manifest are additive; old browsers ignore SW)
   Rollback: revert commit, vecchio SW unregister al next visit

PR2b → MIGRATION HEAVY
   Phase 1: deploy code che supporta DOPPIO schema (legge da entrambi)
   Phase 2: trigger migrazione one-shot per utente al prossimo login
            (script idempotente, esegue solo se dati_utente.blob_json non-null
             e tabelle separate vuote)
   Phase 3: dopo 2 settimane di stabilità verificata, rimuove fallback blob
   Rollback: feature flag in localStorage `usaNuovoSchema=false` per istanza singola

PR3, PR4 → additive features dietro UI nuova, low risk

PR5 → Playwright CI: bloccante solo su master, manuale su feature branch all'inizio
```

**Critical gap**: il design doc originale non aveva piano di rollback per PR2b. Aggiunto sopra.

## Observability (Section 8, compressed)

Family-tier non giustifica Datadog. Ma il minimo che serve:
- **Pagina "Salute dati"** già nel design (PR1) estesa con: stato mutation queue (count, ultimo flush, errori ultimi 7gg), stato sync (last_pull, last_push, conflitti aperti), storage usage.
- **Console structured logs** in `sw.js` (visibili in DevTools mobile via remote debugging quando serve).
- **`window.addEventListener('error')`** → push in `localStorage.errori[]` (ultimi 50), visibile in Salute dati. Tuo fratello può inviarteli con un bottone "Invia diagnostica" che apre WhatsApp con dump in clipboard.

## Long-Term Trajectory (Section 10)

**Reversibilità**: 3/5. PR2b è il punto di non ritorno per lo schema. Tutto il resto è additive e revertibile.

**Tech debt introdotto**:
- Service worker = nuovo file da mantenere allineato a deploy
- Doppio schema durante rollout di PR2b (temporaneo, ~2 settimane)
- 4 librerie CDN nuove (jsPDF, Chart.js, Tesseract.js, idb-keyval) — sono pinning a versione, ma SPOF se i CDN cadono. Mitigazione: cache aggressiva in SW.

**Path dependency**: dopo PR2b, qualsiasi feature nuova che tocca dati DEVE usare lo schema per-entità. Non si torna indietro.

**Knowledge concentration**: tutto in tua testa + design doc + CEO plan. Sufficiente per family-tier. Se tuo fratello dovesse mai mantenerlo senza di te (caso ipotetico), il single-file commentato è leggibile.

## Eng Review Additions (2026-05-17)

Output di `/plan-eng-review`. 8 issues accettati, 4 rejected.

### Sequenza PR aggiornata (PR5 + PR0 in testa)

```
PR5 — Playwright setup + 3 test regression critici (PRIMA di tutto)
PR0 — Apple/Sonoma redesign completo (design handoff "sbPqzZsV396NsMp4jSK5eQ")
       Tutte le viste, mesh USA astratto, glass surfaces, Inter Tight, responsive mobile,
       restyle login, rimozione video 276973.mp4
PR1 — Data Safety Net (esteso con 3 bugfix pre-esistenti) su nuovo skin
PR2a — PWA shell
PR2b — Schema migration + sync per-entità (con FK-aware queue + iOS SW mitig)
PR3 — Feature core con bundle splitting lazy-load
PR4 — Delight
```

### PR0 — Apple redesign decisioni

- **Stack**: Alpine + Tailwind CDN + CSS custom semantico (no build step preservato)
- **Mobile responsive**: SÌ — sidebar collassa in drawer overlay sotto 900px
- **Video MP4**: RIMOSSO (~4.7MB), sostituito da mesh CSS USA astratto
- **Login**: restilizzato con glass+mesh stile coerente
- **Design tokens**: tutti da `:root` del handoff (palette, radius, shadow, blur, font)
- **Tipografia**: Inter Tight (display) + Inter (body) + JetBrains Mono (numerali speciali) via Google Fonts
- **Reference design** salvato in `.design-ref/` del repo (gitignored)

### Architettura — additions

- **iOS Safari SW lifecycle**: Background Sync API quando disponibile + fallback "check missed notifications on app open" al boot. Documentare in TUTORIAL.md: notifiche iOS richiedono "Aggiungi a Home".
- **Mutation queue FK-aware ordering**: topological sort della queue prima del flush. Se Inquilino dipende da nulla, Incasso dipende da Inquilino → flush inquilini prima.

### Code quality — bugfix da aggiungere a PR1

1. **`importaJSON` chiama `migraDati`** (riga 1169) — 1 riga
2. **`generaIncassiAttesi` rispetta `modificatoManualmente`** (riga 1170) — flag su incasso, set quando utente modifica via modal
3. **`salva()` catena catch specifica** (riga 1151) — distinguere auth expired (refresh session) vs network (modalitaOffline) vs RLS (error toast)
4. **Estrazione `<script>` in `app.js` separato** — preserva no-build-step, migliora navigabilità per i prossimi 2000 LOC

### Performance — additions

- **Bundle splitting lazy-load**: Tesseract/Chart.js/jsPDF importati on-demand al primo click delle feature relative, non in app shell.
- **Query batching Supabase**: una singola RPC `get_user_data()` (o `.or()` query) al login invece di 5 SELECT separati.

### Coverage diagram (target post-PR1)

15 paths PR1, 0/15 testati oggi. Target PR5: 100% dei critical paths + 5 regression test obbligatori (vedi `gestione-affitti-test-plan-20260517.md`).

### Critical gaps risolti

- **PR1 senza tests** → fixato invertendo PR5 in testa.
- **Schema migration partial fail** → fixato con dual-write window e flag fallback.
- **Bug regression silenzioso** (importo=0 hidden) → catturato da test obbligatorio in PR5.

### Eng review concerns rejected (da rivisitare se i casi si presentano)

- Field-level merge per conflict resolution (per ora binary choose è OK per family-tier)
- 4 settimane di dual-write (timeline accettata: 2 settimane se monitoring funziona)
- Foto compression a 1200px (1600px è il compromesso accettabile)
- IndexedDB write debounce (premature, da rivisitare se vedi lag mobile)

## Reviewer Concerns

1. **OCR Tesseract.js può deludere su bollette italiane reali** (R3). Mitigazione esistente è il fallback manuale, ma se OCR funziona <50% delle volte la feature diventa fastidiosa. **Test reale prima di shipping PR4**: prova OCR su 10 bollette diverse di tuo fratello prima di chiudere PR4.

2. **Stimato 3-4 sessioni CC è ottimistico**. PR2b da solo è probabile che richieda 1 sessione intera + 1 di bugfix. Pianificare 5-6 sessioni totali realistiche.

3. **Notifiche locali su iOS Safari sono limitate** (a oggi 2026, Safari supporta Notifications API solo per PWA installate dal home screen). Documentare in `TUTORIAL.md` che notifiche richiedono "Aggiungi a Home" su iPhone.

## Next Steps

1. Implementare **PR1** subito (zero rischio, valore alto). Posso partire ora.
2. Dopo PR1 shippato e verificato in produzione 1-2 giorni: passare a **PR2a**.
3. PR2b solo dopo PR2a stabile e PR1 ha confermato che cestino/snapshot funzionano (sono il safety net per la migrazione).
4. PR3-4-5 in ordine, eventualmente parallelizzando PR5 ad altre.

## Lake Score

8/8 cherry-pick accettati in CEO review. 6/8 issues accettati in Eng review. Lake validato.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (PLAN) | 8 proposals, 8 accepted, 0 deferred |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 8 issues, 0 critical gaps (all resolved) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not run |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | not run (single-dev family tool) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not applicable (no API/SDK) |

- **UNRESOLVED:** 0
- **VERDICT:** CEO + ENG CLEARED — ready to implement, start with PR5 (Playwright setup).
