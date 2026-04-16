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
- Offline-first: funziona senza server
- Persistenza dati via File System Access API (Chrome/Edge) o localStorage + export/import JSON (Safari)
- Salvataggio automatico ad ogni modifica
- Tema chiaro/scuro automatico
- Formato italiano: valuta (1.234,56 €), date (gg/mm/aaaa)
- Responsive: ottimizzato per Mac e iPad

## Utilizzo

Apri [https://oldpz.github.io/gestione-affitti/](https://oldpz.github.io/gestione-affitti/) da qualsiasi browser.

I dati sono salvati nel localStorage del browser. Per sincronizzare tra dispositivi usa i pulsanti **Esporta JSON** / **Importa JSON**, oppure su Chrome/Edge il pulsante **Apri dati.json** per leggere/scrivere su iCloud Drive o Dropbox.

## Tutorial

Guida completa passo-passo con istruzioni per ogni sezione dell'app:

**[Leggi il tutorial](TUTORIAL.md)**

Contenuti: primo avvio, registrare incassi, calendario, scheda proprietà, giro fondi tra banche, gestione utenze, impostazioni, salvataggio e sincronizzazione dati, FAQ.
