# Gestione Affitti & Utenze

Web app single-page in italiano per la gestione affitti immobili e utenze.

**[Apri l'app](https://oldpz.github.io/gestione-affitti/)**

## Funzionalita

- **Dashboard** — panoramica mensile con stato incassi per proprietà, totali e utenze in scadenza
- **Calendario** — incassi raggruppati per scadenza (1, 15, fine mese) con check rapido
- **Proprietà** — scheda dettaglio con storico incassi e utenze, totali annui
- **Movimenti Banca** — incassi per banca, giro fondi tra conti
- **Utenze** — tabella filtrabile per proprietà, tipo e stato
- **Impostazioni** — anagrafica proprietà e banche

## Caratteristiche tecniche

- Singolo file `index.html`, nessuna build necessaria
- Alpine.js + Tailwind CSS via CDN
- Autenticazione e sync cloud via Supabase (email/password)
- Offline-first: cache locale automatica, sync al ritorno della connessione
- Multi-valuta per proprietà e banca (Euro, Dollaro USA — totali separati, niente conversione)
- Salvataggio automatico ad ogni modifica
- Tema chiaro/scuro automatico
- Formato italiano per EUR (1.234,56 €), formato en-US per USD ($1,234.56), date gg/mm/aaaa
- Responsive: ottimizzato per mobile, tablet e desktop

## Utilizzo

Apri [https://oldpz.github.io/gestione-affitti/](https://oldpz.github.io/gestione-affitti/) da qualsiasi browser.

Registrati con email/password: i dati vengono sincronizzati sul tuo account Supabase e conservati anche in una cache locale del browser. Se la connessione cade, l'app continua a funzionare in modalità offline e sincronizza al ritorno della rete.

## Tutorial

Guida completa passo-passo con istruzioni per ogni sezione dell'app:

**[Leggi il tutorial](TUTORIAL.md)**

Contenuti: primo avvio, registrare incassi, calendario, scheda proprietà, giro fondi tra banche, gestione utenze, impostazioni, salvataggio e sincronizzazione dati, FAQ.

## Test suite (Playwright, da PR5)

La suite Playwright protegge le 5 regressioni LOCKED (CON-017) + 5 critical paths definiti in `.planning/intel/constraints.md`. Tre test girano LIVE oggi (login, crea proprieta, segna incasso + tutte e 5 le regression); due (cestino, offline sync) sono `test.skip` finche non arrivano rispettivamente PR1 e PR2b.

### Esecuzione locale

Prerequisiti una tantum:
- Node 20+
- 5 variabili d'ambiente per il progetto Supabase di test — vedi `.planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md`

```bash
npm ci
npx playwright install chromium --with-deps

# Esporta le 5 variabili (in una shell o in .env.test caricato da te)
export SUPABASE_TEST_URL=...
export SUPABASE_SERVICE_KEY=...   # service_role, MAI committato
export TEST_EMAIL=...
export TEST_PASSWORD=...
export TEST_USER_ID=...

# Suite completa
npm test

# Singolo file
npx playwright test tests/login.spec.ts

# Headed (vedi il browser)
npm run test:headed

# Report HTML dopo un fallimento
npx playwright show-report
```

Playwright avvia automaticamente `npx serve . -l 3000` come static server (vedi `playwright.config.ts`); non serve avviarlo a mano.

### Contratto CI gating

- Trigger: ogni `git push` su `master` (oltre a `workflow_dispatch` manuale)
- Job: `test` su `ubuntu-latest`, timeout 15 min, chromium-only, retry x2 in CI, workers=1
- Esito ROSSO -> il deploy GitHub Pages viene bloccato (Pages e' "Deploy from a branch"; il gate e' una branch protection rule su `master` con required status check `Playwright Tests` — vedi setup doc)
- Esito VERDE -> deploy procede
- Su fallimento gli artefatti `playwright-report/` e `test-results/` (screenshot + video + trace) sono caricati come artifact del workflow (retention 7 giorni)

### Le 5 regression test LOCKED (CON-017 — non rimovibili senza ADR superseding)

1. REGRESSION-01 — Proprieta con `importoAffittoMensile=0` appare sul calendario come card gialla "Sistema" (`tests/calendario.spec.ts`)
2. REGRESSION-02 — "Genera incassi mancanti" elenca esplicitamente le proprieta saltate (`tests/calendario.spec.ts`)
3. REGRESSION-03 — Service worker stale unregistered al boot (`tests/sw.spec.ts`)
4. REGRESSION-04 — Importo=0 al salvataggio mostra confirm soft (`tests/login.spec.ts`)
5. REGRESSION-05 — Incassi orfani appaiono nel gruppo dedicato sul calendario (`tests/calendario.spec.ts`)
