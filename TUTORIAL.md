# Tutorial — Gestione Affitti & Utenze

Guida passo-passo per usare l'app. Nessuna installazione necessaria: apri il link e sei operativo.

**[Apri l'app](https://oldpz.github.io/gestione-affitti/)**

---

## Indice

1. [Primo avvio](#1-primo-avvio)
2. [Dashboard](#2-dashboard)
3. [Registrare un incasso](#3-registrare-un-incasso)
4. [Calendario mensile](#4-calendario-mensile)
5. [Scheda proprietà](#5-scheda-proprietà)
6. [Movimenti banca e giro fondi](#6-movimenti-banca-e-giro-fondi)
7. [Gestire le utenze](#7-gestire-le-utenze)
8. [Impostazioni: aggiungere proprietà e banche](#8-impostazioni-aggiungere-proprietà-e-banche)
9. [Salvataggio e sincronizzazione dati](#9-salvataggio-e-sincronizzazione-dati)
10. [Domande frequenti](#10-domande-frequenti)

---

## 1. Primo avvio

Quando apri l'app per la prima volta, viene caricato un set di **dati di esempio** con 9 proprietà (Via Guelfa, Via Dei Servi, Elba 508, ecc.) e 2 banche (BPM e BPER). Questo ti permette di esplorare subito tutte le funzionalità.

Per partire con i tuoi dati reali, vai su **Impostazioni** e modifica o elimina le proprietà e banche di esempio.

> In alto a destra vedrai l'indicatore **Salvato**: ogni modifica viene salvata automaticamente.

---

## 2. Dashboard

La Dashboard è la schermata principale. Mostra tutto quello che serve sapere per il mese corrente:

- **Card proprietà**: ogni immobile ha una card con importo affitto, scadenza e banca. L'icona a destra indica lo stato:
  - &#10004; verde = incassato
  - &#9203; giallo = atteso (la scadenza non è ancora passata)
  - &#9888; rosso = in ritardo (la scadenza è passata e non risulta incassato)

- **Totali in alto**: importo totale incassato e importo ancora da incassare nel mese.

- **Da girare per banca**: riepilogo degli importi incassati ma non ancora girati alla banca destinazione.

- **Utenze in scadenza**: elenco delle utenze con scadenza nei prossimi 30 giorni che non sono ancora pagate.

> Cliccando su una card proprietà si apre direttamente la sua scheda dettaglio.

---

## 3. Registrare un incasso

Ci sono due modi per segnare un affitto come incassato:

### Dal Calendario
1. Vai alla sezione **Calendario**
2. Trova la proprietà nel gruppo corretto (Giorno 1, Giorno 15, Fine mese)
3. Clicca il pulsante verde **Incassa oggi**
4. L'incasso viene registrato con la data odierna

### Dalla Dashboard
1. Clicca sulla card della proprietà nella Dashboard
2. Si apre la scheda proprietà con lo storico incassi
3. Da qui puoi verificare lo storico completo

> L'app genera automaticamente gli incassi attesi per il mese corrente. Dal giorno 20 genera anche quelli del mese successivo.

---

## 4. Calendario mensile

Il Calendario mostra tutti gli incassi del mese selezionato, raggruppati per data di scadenza:

- **Giorno 1** — proprietà con scadenza al primo del mese
- **Giorno 15** — proprietà con scadenza al quindici
- **Fine mese** — proprietà con scadenza a fine mese

Ogni riga mostra il nome della proprietà, l'importo e lo stato. Usa le frecce **&larr; &rarr;** per navigare tra i mesi.

Lo sfondo delle righe cambia colore:
- Verde chiaro = incassato
- Rosso chiaro = in ritardo
- Grigio = in attesa

---

## 5. Scheda proprietà

Dalla sezione **Proprietà** puoi vedere l'elenco di tutti gli immobili. Cliccando su uno si apre la scheda dettaglio con:

- **Informazioni generali**: tipo, importo affitto, scadenza, intestatario
- **Filtro anno**: seleziona l'anno per vedere lo storico
- **Storico incassi**: tabella con mese, data prevista, data incasso, importo, banca, stato giro
- **Storico utenze**: tabella con tipo, fornitore, periodo, scadenza, importo, stato
- **Totali annui**: somma incassi e somma utenze per l'anno selezionato

> Clicca **&larr; Tutte le proprietà** per tornare all'elenco.

---

## 6. Movimenti banca e giro fondi

La sezione **Banche** mostra i movimenti per ogni conto bancario:

1. Seleziona il **mese** con il selettore in alto
2. Per ogni banca vedi:
   - **Incassato**: totale degli affitti effettivamente incassati
   - **Da girare**: totale degli incassi non ancora girati

### Come girare un incasso

Quando un affitto viene incassato su una banca (es. BPM) ma deve essere trasferito su un'altra (es. BPER):

1. Trova l'incasso nella tabella della banca di origine
2. Nella colonna **Azioni**, seleziona dal menu la banca di destinazione (es. "BPER")
3. L'incasso viene segnato come girato con la data odierna

Il segno di spunta verde &#10003; conferma che il giro è stato completato.

---

## 7. Gestire le utenze

La sezione **Utenze** permette di tracciare bollette di acqua, luce e gas per ogni proprietà.

### Aggiungere una utenza

1. Clicca **+ Nuova utenza**
2. Compila: proprietà, tipo (acqua/luce/gas), fornitore, periodo, scadenza, importo, stato
3. Clicca **Salva**

### Filtrare le utenze

Usa i menu a tendina in alto per filtrare per:
- Proprietà specifica
- Tipo (acqua, luce, gas)
- Stato (da ricevere, ricevuta, pagata, rimborsata)
- Anno

Il **totale** in fondo alla tabella si aggiorna in base ai filtri attivi.

### Cambiare lo stato

Nella colonna **Azioni**, usa il menu "Cambia stato..." per aggiornare lo stato della bolletta. Gli stati disponibili sono:

| Stato | Significato |
|-------|-------------|
| Da ricevere | La bolletta non è ancora arrivata |
| Ricevuta | Arrivata, da pagare |
| Pagata | Pagata (viene registrata la data) |
| Rimborsata | L'inquilino ha rimborsato la spesa |

---

## 8. Impostazioni: aggiungere proprietà e banche

### Aggiungere una proprietà

1. Vai su **Impostazioni**
2. Clicca **+ Nuova** nella sezione Proprietà
3. Compila i campi:
   - **Nome**: indirizzo o nome identificativo
   - **Tipo**: appartamento o altro
   - **Scadenza affitto**: giorno 1, 15, o fine mese
   - **Importo mensile**: canone di affitto
   - **Banca incasso**: su quale conto arriva l'affitto
   - **Intestatario**: proprietario dell'immobile
   - **Banca destinazione**: dove girare eventualmente i fondi
4. Clicca **Salva**

> L'app genera automaticamente gli incassi attesi per la nuova proprietà.

### Modificare o eliminare

- **Modifica**: clicca "Modifica" nella riga della proprietà, cambia i dati, clicca "Salva"
- **Elimina**: clicca "Elimina" — verranno rimossi anche tutti gli incassi e le utenze collegati

### Aggiungere una banca

1. Nella sezione Banche, clicca **+ Nuova**
2. Inserisci nome e intestatario
3. Clicca **Salva**

---

## 9. Salvataggio e sincronizzazione dati

### Salvataggio automatico

Ogni modifica viene salvata automaticamente nel **localStorage** del browser. L'indicatore in alto a destra conferma lo stato:
- **Salvato** (verde) = tutto ok
- **Salvataggio...** (giallo) = in corso
- **Errore salvataggio** (rosso) = qualcosa è andato storto

### Su Chrome o Edge (desktop)

Puoi collegare un file `dati.json` su disco:
1. Clicca il pulsante **Apri dati.json** in alto a destra
2. Seleziona o crea un file `dati.json`
3. Da quel momento ogni modifica viene salvata sia in localStorage che nel file

> Se metti il file in una cartella iCloud Drive o Dropbox, i dati si sincronizzano automaticamente tra i tuoi dispositivi.

### Su Safari o iPad

Safari non supporta la File System Access API, quindi:
- I dati restano nel localStorage del browser
- Usa **Esporta JSON** per scaricare un backup
- Usa **Importa JSON** per caricare dati da un altro dispositivo

### Backup consigliato

Esporta periodicamente il file JSON come backup. Se cambi browser o cancelli i dati del sito, avrai sempre una copia.

---

## 10. Domande frequenti

**I dati sono al sicuro?**
I dati restano nel tuo browser (localStorage) o nel file JSON locale. Non vengono mai inviati a nessun server.

**Posso usare l'app offline?**
Si, dopo il primo caricamento l'app funziona anche senza connessione. Serve la connessione solo per il primo accesso (per caricare Tailwind CSS e Alpine.js dal CDN).

**Posso usarla su iPhone?**
Si, funziona su qualsiasi browser. Su Safari mobile usa Esporta/Importa JSON per i backup.

**Come resetto tutti i dati?**
Cancella i dati del sito dal browser (Impostazioni > Privacy > Dati siti web) oppure cancella il localStorage. Al prossimo avvio verranno ricreati i dati di esempio.

**Posso aggiungere altri tipi di utenze?**
Al momento sono disponibili acqua, luce e gas. Per aggiungere altri tipi serve una modifica al codice.
