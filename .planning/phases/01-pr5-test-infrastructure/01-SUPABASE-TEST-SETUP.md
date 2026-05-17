# Supabase test project + GitHub Secrets — setup manuale

Phase 1 / PR5 — REQ-PLAY-01.
Questo documento descrive i passi che **devi eseguire fuori dal repo** (dashboard Supabase + GitHub Settings) per abilitare la suite Playwright in CI. Claude non puo' farli al posto tuo: la creazione del progetto Supabase e l'inserimento dei GitHub Secrets richiedono credenziali interattive su dashboard web.

---

## 1. Perche' un progetto Supabase separato

- **No corruzione prod.** I test fanno `DELETE` + `POST` sulla tabella `dati_utente` di un utente di test. Eseguirli sul progetto di produzione cancellerebbe i tuoi dati reali ad ogni run CI.
- **Isolamento RLS.** La service_role key bypassa Row Level Security: se la usassimo contro prod e accidentalmente entrasse in un workflow `pull_request`, una PR da fork potrebbe leggere/cancellare qualsiasi riga. Avere un progetto separato limita il blast radius.
- **Cost.** Il free tier copre ampiamente: 1 progetto in piu', uso saltuario, nessun costo.

---

## 2. Step di provisioning

### 2.1 Crea il progetto Supabase

1. Vai su https://app.supabase.com -> **New project**
2. **Name:** `gestione-affitti-test`
3. **Region:** stessa di prod (per parita' di latenza nei test)
4. **Password:** scegline una forte e salvala nel password manager (la useremo solo se serve `psql` diretto)
5. Attendi il provisioning (~2 min)

### 2.2 Recupera URL e service_role key

1. Apri il progetto -> **Settings** -> **API**
2. Copia il **Project URL** (formato `https://xxx.supabase.co`) — diventera' `SUPABASE_TEST_URL`
3. Copia la **service_role** key dalla sezione "Project API keys" — diventera' `SUPABASE_SERVICE_KEY`

> **ATTENZIONE:** la `service_role` key **bypassa RLS**. Non incollarla mai in `index.html`, non echo-arla in CI, non committarla in `.env.test`. Vive solo in GitHub Secrets e nella tua shell locale (export temporaneo).

### 2.3 Applica lo schema

Settings -> **SQL Editor** -> New query -> incolla **verbatim**:

```sql
create table if not exists dati_utente (
  user_id uuid primary key references auth.users(id),
  blob_json jsonb,
  updated_at timestamptz default now()
);
alter table dati_utente enable row level security;
create policy "Users can access own data" on dati_utente
  for all using (auth.uid() = user_id);
```

Clicca **Run**. Verifica nel Table Editor che `dati_utente` esista con colonne `user_id`, `blob_json`, `updated_at`.

### 2.4 Crea l'utente di test

1. **Authentication** -> **Users** -> **Invite user** (oppure "Add user" se preferisci settare la password direttamente)
2. Email: `test@gestione-affitti.local` (raccomandata — TLD non instradabile, niente spam) — oppure un'email throwaway tua
3. Password: scegline una stabile e salvala (sara' `TEST_PASSWORD`)
4. Una volta creato l'utente, clicca sulla riga e **copia il suo UUID** — sara' `TEST_USER_ID`

---

## 3. GitHub Secrets

Vai su **GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret** e aggiungi i 5 secret seguenti:

| Secret | Valore (da dove) |
|--------|------------------|
| `SUPABASE_TEST_URL` | Project URL dal punto 2.2 |
| `SUPABASE_SERVICE_KEY` | service_role key dal punto 2.2 |
| `TEST_EMAIL` | email dell'utente invitato (es. `test@gestione-affitti.local`) |
| `TEST_PASSWORD` | password scelta al punto 2.4 |
| `TEST_USER_ID` | UUID dell'utente dal punto 2.4 |

Non usare `Environment secrets` (Settings -> Environments) — il workflow non e' agganciato a un environment named, quindi quei secret non sarebbero accessibili.

---

## 4. GitHub Pages deploy gating

Devi scegliere una delle due strategie in base a come e' configurato il deploy del sito attualmente.

### 4.1 Determina la modalita' di deploy

1. **Settings -> Pages**
2. Guarda **"Build and deployment" -> Source**:
   - Se dice **"Deploy from a branch"** -> sei in modalita' **`deploy-from-branch`**
   - Se dice **"GitHub Actions"** -> sei in modalita' **`github-actions`**

Annota questa scelta: dovrai comunicarla a Claude (`DEPLOY_MODE=...`) per sbloccare Task 9.

### 4.2 Se DEPLOY_MODE=deploy-from-branch

Il deploy parte automaticamente quando `master` cambia. Per bloccarlo se i test falliscono devi usare **branch protection** + **required status check**.

1. **Settings -> Branches -> Branch protection rules -> Add rule**
2. **Branch name pattern:** `master`
3. Spunta **"Require status checks to pass before merging"**
4. Nel campo di ricerca "Status checks that are required" cerca **`Playwright Tests`** e aggiungilo

> Nota: il check `Playwright Tests` compare nel selettore **solo dopo che il workflow e' girato almeno una volta**. Se non lo trovi: pusha prima il commit del Task 9 (con la branch protection rule ancora vuota), aspetta che `Playwright Tests` giri una volta, poi torna qui e aggiungi il required check.

### 4.3 Se DEPLOY_MODE=github-actions

In Task 9 il workflow generato includera' automaticamente un job `deploy` con `needs: test` — niente da configurare a mano oltre ai 5 secret.

---

## 5. Smoke test (PRIMA di proseguire con Task 4)

Da terminale (PowerShell o bash) — sostituisci i placeholder con i valori veri:

```bash
export SUPABASE_TEST_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."

curl -s -X GET "$SUPABASE_TEST_URL/rest/v1/dati_utente?limit=1" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

- **Atteso:** `[]` (array vuoto) o una risposta 200 qualsiasi.
- **401:** service_role key sbagliata o copiata male.
- **404:** schema non applicato (torna a 2.3).

---

## 6. Verification checklist

Spunta tutto prima di scrivere il messaggio di resume a Claude:

- [ ] Progetto Supabase `gestione-affitti-test` creato
- [ ] Schema `dati_utente` + RLS policy applicati
- [ ] Utente di test invitato con email/password stabili, UUID annotato
- [ ] 5 GitHub Secrets aggiunti (`SUPABASE_TEST_URL`, `SUPABASE_SERVICE_KEY`, `TEST_EMAIL`, `TEST_PASSWORD`, `TEST_USER_ID`)
- [ ] GitHub Pages deploy gating configurato (`deploy-from-branch` con branch protection rule **oppure** `github-actions` mode confermato)
- [ ] Smoke test `curl` ha restituito 200 (non 401, non 404)

Messaggio di resume a Claude:

```
approved DEPLOY_MODE=github-actions
```
oppure
```
approved DEPLOY_MODE=deploy-from-branch
```
