---
type: test-plan
project: gestione-affitti
generated_by: /plan-eng-review
date: 2026-05-17
consumed_by: /qa, /qa-only, Playwright suite PR5
---

# Test Plan — Gestione Affitti PWA Rebuild

## Affected Pages/Routes
- `/` (login/signup) — flow di accesso, persistenza sessione
- `/` (dashboard, post-login) — card proprietà, totali, indicatore stato sync
- `/` calendario view — generazione incassi, card gialle proprietà importo=0 (REGRESSION), card orfani
- `/` proprietà view — CRUD, undo toast, modal modifica
- `/` impostazioni — cestino, snapshot history, salute dati, gestione tipi utenza, inquilini

## Critical Paths (must always work)
1. **Login email/password + carica dati esistenti** — senza questo niente funziona.
2. **Segna incasso oggi** — flow primario di tuo fratello, deve essere tap-to-complete in <2s.
3. **REGRESSION — proprietà importo=0 visibile sul calendario** — la card gialla "Sistema" appare. Bug del 2026-05-17.
4. **Offline write + ritorno online + sync** (PR2b+) — mutation queue flush correttamente.
5. **Cestino: elimina + ripristina + dato torna identico** (PR1).

## Key Interactions to Verify

### PR1 (Data Safety Net)
- Elimina proprietà → controlla cestino → ripristina → la proprietà riappare con tutti gli incassi e utenze
- Elimina incasso → toast "Annulla" appare → click entro 5s → incasso torna
- Modifica importo proprietà → snapshot history mostra valore precedente → ripristina → torna al valore vecchio
- Importa JSON v1 (senza currency) → migraDati esegue → tutti i record hanno currency='EUR'
- Modifica manualmente importo di incasso non incassato → refresh pagina → importo NON viene sovrascritto da proprietà.importoAffittoMensile
- Pagina "Salute dati": mostra count orfani, importi 0, ultimo sync, storage usage

### PR2a (PWA installabile)
- Aggiungi a Home (manifest) funziona su Chrome desktop + Android
- Cache app shell: spegni network → reload → app si apre con ultimo stato
- Install prompt custom appare dopo 3 sessioni in 7 giorni, non prima
- SW vecchio (residuo da sessioni precedenti) viene unregistered al boot

### PR2b (Sync per-entità)
- Crea inquilino offline → crea incasso che lo referenzia offline → torna online → entrambi sync nell'ordine giusto (FK-aware)
- Modifica stessa proprietà su 2 device offline → torna online su entrambi → toast conflitto appare
- Migrazione schema blob → tabelle: utente esistente fa login → migrazione eseguita transparently → tutti i dati intatti
- Rollback: feature flag `usaNuovoSchema=false` in localStorage → app legge da blob legacy
- Tipi utenza dinamici: aggiungi "rifiuti", "condominio" → appare nel dropdown utenza → CRUD funziona
- Scadenze custom: imposta scadenza giorno 5 → calendario mostra correttamente

### PR3 (Notifiche + foto + PDF + Export 730)
- Crea utenza con scadenza domani → al mattino successivo arriva notifica
- iOS: app deve essere "Aggiunta a Home" altrimenti notifiche silently disabled (verifica banner istruzioni)
- Scatta foto bolletta → upload Supabase Storage → thumbnail nella scheda utenza → click → lightbox
- Foto troppo grande (>5MB raw): resize a 1600px lato lungo prima dell'upload, <200KB
- Storage Supabase pieno (simulato): fallback localStorage base64 + modal "Storage pieno"
- Genera PDF ricevuta: campo beneficiario popolato da inquilino, importo in cifre+lettere, formato A4
- Export 730: CSV annuo per proprietà con colonne standard (totale incassi, totale utenze pagate, periodo)

### PR4 (Statistiche + OCR)
- Pagina statistiche: line chart incassi/mese, bar utenze/proprietà, donut yield
- Statistiche con 0 dati: mostra empty state, non chart vuoti
- OCR bolletta: foto leggibile → importo e scadenza pre-compilati nel form, user può correggere
- OCR fallisce (foto illeggibile): toast "OCR non riuscito" + form vuoto comunque editabile
- Tesseract.js lazy-load: prima volta lento (~3s), volte successive cached

### PR5 (Playwright CI)
- GitHub Actions trigger su push master
- Suite copre tutti i critical paths di PR1-4
- Test fallisce → blocca deploy
- Test fixture: utente di test con dati mock in Supabase test project

## Edge Cases (paranoia)

- **Doppio tap su "Incassa oggi"** → no doppio incasso (debounce o disabilita button dopo click)
- **Navigate-away durante salvataggio** → beforeunload blocca uscita se stato='salvataggio' (già esistente, verificare ancora funziona post-refactor)
- **Nome proprietà 100 caratteri** → UI non si rompe, troncamento con tooltip
- **0 proprietà**: empty state grafico in dashboard, calendario vuoto con CTA "Aggiungi prima proprietà"
- **Connection drop a metà mutation queue flush** → coda resta, retry al prossimo online
- **Permessi notifiche negati**: banner una sola volta, poi nascondi feature
- **Permessi camera negati**: fallback a `input type="file"` standard senza capture
- **Foto in landscape**: ruota a portrait prima dell'upload? Mantieni rotazione EXIF
- **OCR su bolletta in lingua diversa** (es. straniera): graceful degradation, no crash
- **CDN Tailwind/Supabase/Alpine/jsPDF down** → SW cache li serve da locale
- **Supabase down**: la app continua in offline mode, mutation queue persiste

## Regression Tests (IRON RULE)

Questi DEVONO essere nella suite, niente AskUserQuestion:

1. **Proprietà con importoAffittoMensile=0 appare sul calendario come card gialla con bottone "Sistema"** (bug 2026-05-17)
2. **Genera incassi mancanti elenca esplicitamente proprietà saltate** (bug 2026-05-17 alert "tutti presenti" falso)
3. **Service worker stale viene unregistered al boot** (bug osservato in DevTools 2026-05-17)
4. **Validazione importo=0 in salvataggio proprietà mostra confirm soft** (fix 2026-05-17)
5. **Incassi orfani (proprietà cancellata) appaiono in gruppo dedicato sul calendario** (fix 2026-05-17)
