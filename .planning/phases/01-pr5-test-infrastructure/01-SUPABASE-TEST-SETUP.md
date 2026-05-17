# Supabase test setup + GitHub Secrets — stato consolidato

Phase 1 / PR5 — REQ-PLAY-01.

> **Variance vs piano originale.** Il piano (01-PLAN.md) richiede un progetto Supabase separato. La realta' provisionata e' diversa: **progetto prod condiviso** (`bavkwjxngwzggahdwcjr`) con **trigger DB BEFORE INSERT/UPDATE/DELETE** che limita la `service_role` key al solo `TEST_USER_ID=0c37fe92-c63d-4e80-9d9a-abc4c01c6290`. L'isolamento avviene a livello DB invece che a livello progetto. Threat model T-01-02 mitigato in modo equivalente — il blast radius della service_role e' bloccato dal trigger, non dalla separazione di progetto.

---

## 1. Schema reale (verbatim, NON modificare)

```
Table:  user_data
Cols:   user_id (uuid, PK, references auth.users(id))
        data    (jsonb)
        updated_at (timestamptz)

RLS:    enabled
Policy: "Users can access own data" — for all using (auth.uid() = user_id)
Trigger: GUARD BEFORE INSERT/UPDATE/DELETE
         Solleva eccezione "GUARD: service_role puo modificare SOLO il TEST_USER_ID"
         se user_id != 0c37fe92-c63d-4e80-9d9a-abc4c01c6290
```

**ATTENZIONE — naming critico:**
- Tabella: **`user_data`** (NON `dati_utente`)
- Colonna jsonb: **`data`** (NON `blob_json`)

Tutti i seed REST e le fixture Playwright devono usare questi nomi.

---

## 2. Stato provisioning

- [x] Progetto Supabase prod `bavkwjxngwzggahdwcjr` gia' attivo (condiviso)
- [x] Tabella `user_data` con schema + RLS gia' applicata
- [x] Trigger guard installato e testato (INSERT con user_id != TEST_USER_ID -> eccezione)
- [x] Utente di test creato, `TEST_USER_ID = 0c37fe92-c63d-4e80-9d9a-abc4c01c6290`
- [x] 5 GitHub Secrets configurati:
  - `SUPABASE_TEST_URL` -> `https://bavkwjxngwzggahdwcjr.supabase.co`
  - `SUPABASE_SERVICE_KEY` -> service_role (guardata dal trigger)
  - `TEST_EMAIL`
  - `TEST_PASSWORD`
  - `TEST_USER_ID = 0c37fe92-c63d-4e80-9d9a-abc4c01c6290`

> La `service_role` key e' protetta dal trigger DB ma resta comunque sensibile (puo' leggere altre tabelle, bypassa RLS in lettura). Non va mai in `index.html`, mai in CI log, mai in `.env.test` committato.

---

## 3. GitHub Pages deploy gating — `deploy-from-branch`

Pages e' configurato come **"Deploy from a branch"** (`master`/root). Il deploy parte automaticamente quando `master` cambia. Il gate "test rosso blocca deploy" si applica via **branch protection + required status check**.

### Stato attuale

- [ ] Branch protection rule su `master` con `Playwright Tests` come required status check **NON ancora configurata**.

### Procedura (DA FARE dopo Task 9, PRIMA del Checkpoint 11)

1. Task 9 genera `.github/workflows/playwright.yml` e fa il primo push su master.
2. Aspettare che il workflow `Playwright Tests` giri **almeno una volta** (anche se rosso va bene).
3. Andare in **GitHub repo -> Settings -> Branches -> Branch protection rules -> Add rule** (oppure "Rules" -> "Rulesets" nelle UI piu' recenti).
4. Branch name pattern: `master`.
5. Spuntare **"Require status checks to pass before merging"**.
6. Nel selettore cercare e aggiungere **`Playwright Tests`** (ora visibile perche' il workflow ha girato).
7. Salvare.
8. (Opzionale ma raccomandato) spuntare anche "Do not allow bypassing the above settings".

Verifica dopo l'aggiunta (da locale):

```bash
OWNER_REPO=$(git config --get remote.origin.url | sed -E 's#.*github.com[:/]+([^/]+/[^/.]+)(\.git)?#\1#')
gh api "repos/$OWNER_REPO/branches/master/protection/required_status_checks" --jq '.contexts[]'
```

Deve restituire una riga `Playwright Tests`. Se 404 -> rule non attiva.

---

## 4. Smoke test consigliato

Da terminale, una volta esportate le 5 env vars:

```bash
curl -s -X GET "$SUPABASE_TEST_URL/rest/v1/user_data?user_id=eq.$TEST_USER_ID&select=user_id" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

Attesi: `[]` (utente non ancora seedato) o `[{"user_id":"0c37fe92-..."}]`. 401 -> key sbagliata. 404 -> URL sbagliato.

Verifica trigger (dovrebbe fallire):

```bash
curl -s -X POST "$SUPABASE_TEST_URL/rest/v1/user_data" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","data":{}}'
```

Atteso: errore con messaggio contenente "GUARD: service_role puo modificare SOLO il TEST_USER_ID" -> trigger attivo.

---

## 5. Checklist finale prima di Checkpoint 11

- [x] Schema reale documentato (`user_data` + colonna `data`)
- [x] 5 GitHub Secrets configurati
- [x] Trigger guard attivo (testato)
- [ ] Branch protection rule `Playwright Tests` aggiunta DOPO il primo run del workflow (Task 9)
