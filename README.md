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
