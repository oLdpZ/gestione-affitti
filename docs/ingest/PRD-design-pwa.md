---
name: Gestione Affitti — PWA + Reliability redesign
type: design
project: gestione-affitti
status: APPROVED
mode: Builder (family-grade)
date: 2026-05-17
approach: B (PWA seria + feature core)
implementation_pr_count: 3
related: [[gestione-affitti]]
---

# Design: Gestione Affitti — PWA seria + reliability layer

Generato da /office-hours il 2026-05-17.
Repo: `C:\Users\old_p\Documents\progetto ap Stefano\progetto app Stefano` → `oldpz/gestione-affitti` (GitHub Pages).
Modalità: Builder (strumento serio per famiglia, 1-3 utenti fidati).

## Problem Statement

L'app è single-file Alpine + Supabase, deployata su GitHub Pages. Tuo fratello (utente primario) la usa **dal telefono in mobilità mentre riscuote affitti e controlla utenze**. Due problemi attuali:

1. **Affidabilità sotto la media**: ha già perso 2 appartamenti dal calendario per un bug silenzioso (importo=0 → generazione saltata senza messaggio). Il pattern di conflict resolution (last-writer-wins sul blob JSON intero) può perdere dati in scenari multi-device. Niente cestino, niente undo, niente snapshot.
2. **Workflow incompleto**: lui usa ancora WhatsApp per mandare ricevute, archivia bollette a mano in foto sul rullino, e segna scadenze utenze su un'agenda cartacea. La app non chiude il loop.

## What Makes This Cool

Una PWA "vera" che gira dal telefono, sostituisce 3 strumenti (WhatsApp ricevute + foto-rullino bollette + agenda scadenze) e non perde mai dati. Tap per riscuotere mentre sei davanti al portone dell'inquilino. Notifica push locale alle 9 di mattina: "ACEA Roma scade dopodomani". Genera ricevuta PDF in italiano e la condivide direttamente.

## Constraints

- **Single-file HTML preservato** — no build step, no migrazione a framework. Deploy resta `git push` su GitHub Pages.
- **Stack invariato**: Alpine + Tailwind CDN + Supabase. Aggiunge solo Supabase Storage (free, 1GB) + jsPDF da CDN.
- **Free tier compatibile**: tutto deve funzionare entro i limiti free di Supabase e GitHub Pages.
- **Italiano**: tutta UI/PDF/notifiche in italiano.
- **Mobile-first nella priorità**: ogni feature funziona col pollice su iPhone prima che con mouse su desktop.
- **1-3 utenti**: niente over-engineering per scaling. Niente CRDT.

## Premises (approvate)

1. Resta single-file Alpine + Supabase, no migrazione.
2. PWA = installabile + offline reale + sync al ritorno online (non solo SW di facciata).
3. Affidabilità dati PRIMA delle feature nuove.
4. Notifiche locali via Web Notifications API (no backend push).
5. Foto e PDF in Supabase Storage, non in Base64 nel blob principale.

## Approaches Considered

### Approach A — Cintura di sicurezza + PWA basica
Solo data safety + installabile. Ship in weekend. Niente offline writes né feature.

### Approach B — PWA seria + feature core ⭐ SELECTED
Tutto di A più service worker offline-first, sync per-entità, notifiche, foto, PDF.

### Approach C — Rifondazione architetturale
Dexie + Yjs CRDT + ES modules. Over-engineering per 1-3 utenti.

## Recommended Approach: B

Tre PR atomiche, ognuna valore indipendente per l'utente:

### PR1 — Data Safety Net (1 weekend)
**Goal**: bug come quello dei 2 appartamenti non possono più succedere silenziosamente. Niente è mai perso davvero.

- **Soft-delete su proprietà e incassi**: campo `deletedAt: ISOString | null`. Query escludono i deleted. `eliminaProprieta` e `eliminaIncasso` mettono `deletedAt = oggi` invece di splice.
- **Vista Cestino** in Impostazioni: tabella con nome, data eliminazione, bottone "Ripristina" e "Elimina definitivamente". Auto-purge dopo 30 giorni in `init()`.
- **Snapshot history**: ring buffer di 10 stati in `localStorage` (`gestione_affitti_snapshots`), ogni `salva()` ci pusha lo stato pre-modifica con timestamp. Vista "Ripristina snapshot" con timeline e diff.
- **Undo toast generico**: dopo delete/edit grosse, toast in basso "Annulla" per 5s. Click → ripristina pre-state.
- **Pagina "Salute dati"** in Impostazioni: lista orfani, importi a 0, conflitti sospetti, ultimo sync, dimensione blob. Niente più necessità di F12.
- **Validazione form**: importo=0 ora ha già un confirm soft (fix di oggi); estendere a banca incasso mancante, currency mismatch.

### PR2 — PWA Shell + Offline-First Sync (1 weekend)
**Goal**: tuo fratello apre la app dal telefono in parcheggio senza segnale, segna 3 incassi, esce dalla scala, l'app si syncha sola.

- **`manifest.json`**: name, icons (1024x1024 + 192 + 512), display:standalone, theme color, start_url, scope. Icona generata via favicon.io o equivalente.
- **`sw.js` versionato**: cache strategy Stale-While-Revalidate per HTML/CSS/JS app shell + CDN (Tailwind, Supabase, Alpine, jsPDF). Cache versioning per cleanup vecchie versioni al deploy.
- **Mutation queue in IndexedDB** (libreria `idb-keyval` da CDN, ~600 bytes): ogni `salva()` offline aggiunge un'operazione in coda con `{op, entity, id, payload, ts}`. SW listener `online` flusha la coda una operazione alla volta.
- **Migrazione schema Supabase**: da `dati_utente.blob_json` → tabelle separate `proprieta`, `incassi_affitti`, `utenze`, `banche` con RLS per `user_id` e `updated_at` per riga. Script migrazione one-shot per utenti esistenti che converte il blob in righe.
- **Conflict resolution per-entità**: confronto `updated_at` per riga, non più sul blob. Se due device modificano la stessa proprietà offline → toast "Conflitto su [nome]: scegli versione locale o remota".
- **Indicatore stato sync** già esiste; estenderlo a mostrare "N modifiche in coda" quando offline.

### PR3 — Feature Core (notifiche, foto, PDF) (1 weekend)
**Goal**: chiudere il loop. Tuo fratello smette di usare WhatsApp/agenda/rullino per le 3 cose che la app dovrebbe già fare.

- **Notifiche locali utenze**: scheduler in service worker (`registration.showNotification` triggered da `setTimeout` ricomputato all'install/login). Alle 9:00 mattina, "ACEA Roma scade fra 3 giorni (Appartamento Via Roma)". Click → apre app sulla scheda utenza. Permission prompt morbido alla prima utenza creata.
- **Foto utenze e ricevute**: input `<input type="file" accept="image/*" capture="environment">` → resize browser-side a max 1600px lato lungo (canvas + toBlob) → upload Supabase Storage in path `{user_id}/utenze/{utenza_id}/{uuid}.jpg`. Thumbnail nella scheda utenza, click → lightbox.
- **Ricevute PDF**: `jsPDF` da CDN. Template ricevuta italiana standard con intestazione (intestatario proprietà), beneficiario (inquilino, campo nuovo opzionale), causale ("Affitto mese di [Mese Anno]"), importo in cifre e lettere, data, città. Bottone "Genera ricevuta" su ogni incasso pagato → download PDF + opzione "Condividi" via Web Share API.
- **Install prompt custom**: dopo 3 sessioni in 7 giorni mostra banner "Aggiungi alla schermata Home" anziché lasciar fare al browser.

## Open Questions

1. **Inquilini come entità separata?** Per ricevute PDF serve un beneficiario. Oggi non c'è. Aggiungiamo una mini-anagrafica inquilini (nome, cf, telefono) → 1 per proprietà? PR3 o successivo?
2. **Backup automatico cifrato**: vogliamo anche un export auto giornaliero in Drive/Dropbox del tuo fratello? Out of scope per ora.
3. **Multi-account familiare**: tuo fratello + tu vedete gli stessi dati? Oggi sono account separati Supabase. Se sì, serve un concetto di "famiglia" con sharing. **Decisione**: out of scope, lasciare separato. Se servirà più tardi → si re-architetta.
4. **Icone PWA**: chi le disegna? Suggerisco generarle da emoji 🏠 + sfondo gradient via favicon.io.

## Success Criteria

- **Zero perdite dati silenziose**: ogni delete è recuperabile per 30gg. Ogni stato è ripristinabile dagli ultimi 10 snapshot.
- **Lighthouse PWA score ≥ 90** su mobile.
- **Offline scrittura funzionante**: test manuale = aereo mode → 3 incassi segnati → online → sync automatico verificato.
- **Conflitti per-entità**: test manuale = stessa proprietà modificata su 2 device offline → al sync si vede toast di conflitto, niente data loss.
- **Notifiche delivered**: test manuale = utenza con scadenza domani → notifica arriva nel momento atteso.
- **PDF ricevuta**: file valido, apribile, contenuti completi, formato A4 portrait.
- **Tuo fratello smette di usare**: WhatsApp per ricevute, foto rullino per bollette, agenda cartacea per scadenze. ← criterio reale di successo.

## Distribution

Esistente: GitHub Pages su push a `master`. Nessun cambiamento. PWA install dal browser → schermata home telefono.

## Dependencies

- Account Supabase con Storage abilitato (free tier OK fino a 1GB → ~10.000 bollette JPEG resized).
- `jsPDF` 2.x da CDN (140KB gzip).
- `idb-keyval` 6.x da CDN (~600 bytes).
- Niente backend custom, niente edge functions, niente push remote.

## The Assignment

Prima di scrivere codice di PR1: **passa 15 minuti con tuo fratello e osservalo usare la app dal suo telefono mentre fa il giro di un appartamento.** Non aiutarlo. Annota:
- Quanti tap servono per registrare un incasso?
- Quante volte tap-erra il bottone giusto?
- Cosa fa quando ha le mani occupate?
- Cosa apre prima di aprire l'app (camera? WhatsApp? L'agenda?)
- Cosa apre dopo l'incasso?

Questi 15 minuti cambieranno le priorità di PR3 più di qualsiasi best practice PWA letta online. La cosa più importante che ho imparato dai 10 minuti di debugging di oggi è che lui non si era accorto del bug — l'ha scoperto solo perché ti ha detto "non riesco a far ricomparire 2 appartamenti". Quanti altri silenziosi ne sta subendo?

## What I noticed about how you think

- Hai detto "voglio le best practice PWA" ma hai anche detto "famiglia, pochi utenti fidati". Quella seconda parte è la più importante e l'hai messa per seconda. Il rischio reale qui è over-engineering per impressionare te stesso piuttosto che servire tuo fratello.
- Quando ti ho proposto l'opzione C (rifondazione con CRDT) non hai tentennato — hai scelto B subito. Buon istinto: hai riconosciuto l'over-engineering per quello che era senza che dovessi argomentare a lungo.
- Hai imparato dalla sessione precedente: hai testato il fix prima di chiudere ("usa gstack ora"). Questa abitudine — verificare empiricamente prima di dichiarare done — è la differenza tra builder che spediscono bug e builder che spediscono software.
- L'ordine in cui hai accettato i miglioramenti durante il fix immediato (mostra le card gialle, dì cosa è saltato, confirma su importo 0, pulisci SW) ha mostrato che pensi prima all'esperienza utente concreta e poi alla pulizia tecnica. Tieni quella priorità durante PR1-3.

## Next Steps

1. Approvazione design (questo doc).
2. Osservazione di tuo fratello (Assignment).
3. PR1 (Data Safety Net) — iniziare lunedì. Eseguire con `/gsd-plan-phase` o `/plan-eng-review` per piano implementativo dettagliato.
4. Aggiornare la wiki di second brain dopo ogni PR shippata.
