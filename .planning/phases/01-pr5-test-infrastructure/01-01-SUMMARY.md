---
phase: 01-pr5-test-infrastructure
plan: 01
summary_of: 01-PLAN.md
date: 2026-05-18
status: completed
---

# 01-PR5 Test Infrastructure — execution summary

## Outcome

Suite Playwright + workflow GitHub Actions + branch protection gating attivi.
Push su master triggera `Playwright Tests`; suite rossa blocca il deploy di GitHub Pages.

- **8 LIVE tests pass** contro `index.html` corrente:
  - CRITICAL-01 (login)
  - CRITICAL-02 (segna incasso oggi <2s)
  - CRITICAL-03 (crea nuova proprieta)
  - REGRESSION-01 (card gialla importo=0, CON-017 #1)
  - REGRESSION-02 (genera incassi mancanti elenca saltate, CON-017 #2)
  - REGRESSION-03 (service worker boot invariant, CON-017 #3)
  - REGRESSION-04 (importo=0 confirm soft, CON-017 #4)
  - REGRESSION-05 (incassi orfani nel gruppo dedicato, CON-017 #5)
- **2 SKIPPED tests** scaffoldati con TODO PR-pinned:
  - CRITICAL-04 (cestino) -> richiede PR1 (REQ-SAFE-01/02)
  - CRITICAL-05 (offline sync) -> richiede PR2b (REQ-SYNC-01)
- **CI run #26006537661** — 1m01s, success — primo green su master con la suite completa.

## Variance vs piano originale

### A — Supabase provisioning: prod-condiviso + trigger DB invece di progetto separato

| | Piano | Realta' |
|---|---|---|
| Progetto | `gestione-affitti-test` (free tier separato) | Prod condiviso (`bavkwjxngwzggahdwcjr`) |
| Isolamento | A livello progetto (URL/keys distinti) | A livello DB (trigger BEFORE INSERT/UPDATE/DELETE su `user_data`) |
| TEST_USER_ID | da invitare nel test project | `0c37fe92-c63d-4e80-9d9a-abc4c01c6290` (fisso, hard-coded nel trigger) |

Threat model T-01-02 mitigato in modo equivalente: il trigger solleva eccezione
`GUARD: service_role puo modificare SOLO il TEST_USER_ID` per qualsiasi user_id
diverso, quindi il blast radius della service_role e' bloccato a livello DB.
La service_role resta sensibile in lettura (puo' leggere altre tabelle/utenti)
quindi vale comunque la disciplina "mai in index.html, mai in CI log, mai in
.env.test".

### B — Schema rename

Piano (e RESEARCH) usavano `dati_utente.blob_json`. Lo schema reale e'
**`user_data.data`**. Tutti i riferimenti aggiornati in `01-PLAN.md`,
`01-SUPABASE-TEST-SETUP.md`, `tests/fixtures.ts`. Vedi commit `6e9a0fc`.

### C — Seed semantics

Piano (e RESEARCH Pattern 2) prevedeva DELETE+POST sequenziale. In pratica
la combinazione RLS+trigger lasciava finestre dove la DELETE non ripuliva
in tempo, causando 409 al POST successivo. Sostituito con **UPSERT** via
`Prefer: resolution=merge-duplicates` — atomico, idempotente, single round trip.
Vedi commit `d44b890`.

## GH Secrets configurati (nomi only)

- `SUPABASE_TEST_URL`
- `SUPABASE_SERVICE_KEY`
- `TEST_EMAIL`
- `TEST_PASSWORD`
- `TEST_USER_ID`

## Deploy gating chosen

**DEPLOY_MODE = `deploy-from-branch`** — Pages pubblica da `master`/root.
Il gate "test rosso blocca deploy" e' applicato via **branch protection
ruleset** su `master` con required status check `Playwright Tests`.

Sequenza setup: rule preconfigurata -> push bloccato perche' il check non
esisteva -> rule temporaneamente disattivata -> push -> workflow girato
-> rule riattivata con check ora registrato. Documentato in
`01-SUPABASE-TEST-SETUP.md §3`.

## Selector adjustments durante Checkpoint 11 (vs RESEARCH §A3)

Sei iterazioni di fix selettori contro markup reale (`index.html`), tutti
committati atomicamente con commit `fix(pr5):` prefix:

| Test | Issue | Fix |
|---|---|---|
| REGRESSION-01 | seed 409 cascata | UPSERT in `seedSupabase` (commit `d44b890`) |
| REGRESSION-02 | OK al primo retry post-UPSERT | nessuna modifica selettore |
| REGRESSION-03 | OK | nessuna modifica |
| REGRESSION-04 | filter `bg-white hasText "Importo mensile"` matchava ancestor con form banche dentro | scope a `propSection.locator('[x-show="mostraFormProprieta"]')` (commit `2c24d99`) |
| REGRESSION-05 | dipendeva da seed pulito; selettore h3 OK | nessuna modifica (sbloccato da UPSERT) |
| CRITICAL-01 | `text=Dashboard` matchava 3 elementi (2 button nav + 1 h2) | `getByRole('heading', { name: /Dashboard/ })` (commit `d44b890`) |
| CRITICAL-02 | `.status-dot.bg-green-500` matchava desktop+mobile sm:hidden | `.first()` (commit `d44b890`) |
| CRITICAL-03 | bottone reale e' `+ Nuova` (non `Aggiungi/Nuova proprieta`); poi `editBanca.nome` collisione; poi `text=Proprieta E2E Test` matchava h3 nascosta su dashboard | scope a `propSection`, input via `[x-model="editProprieta.nome"]`, asserzione su `propSection.locator('td')` (commit `d44b890` + `2c24d99` + `e9a8658`) |

## CON-001 invariant

`git diff index.html` empty pre-phase vs post-phase: `index.html` byte-identical
(verificato a fine Task 1 e a fine Task 10). Niente build step introdotto;
@playwright/test e tutto il tooling test in `devDependencies` only.

## Follow-up pinned per PR successivi

| PR target | What to change | Where |
|---|---|---|
| PR1 (REQ-SAFE-01/02 soft-delete + cestino) | Sostituisci `test.skip` con `test` in `tests/cestino.spec.ts` e implementa gli step elencati nel TODO. | `tests/cestino.spec.ts` |
| PR1 (REQ-SAFE-06 custom modal) | Sostituisci `page.on('dialog')` con asserzione sul DOM del modal custom in REGRESSION-04. | `tests/login.spec.ts` (TODO in cima) |
| PR2a (REQ-PWA-02 + CON-010) | Evolvi REGRESSION-03 da "swCount === 0" a "pre-registra stale SW -> reload -> assert solo SW corrente". | `tests/sw.spec.ts` (TODO in cima) |
| PR2b (REQ-SYNC-01 mutation queue) | Sostituisci `test.skip` con `test` in `tests/offline.spec.ts` e implementa gli step elencati nel TODO. | `tests/offline.spec.ts` |

## Commit timeline (16 commits, oldest first)

```
09f7888 chore: add CLAUDE.md + ignore .gstack workspace
4a815cc chore(pr5): add @playwright/test devDep + gitignore test artifacts
cd36cfb feat(pr5): add playwright.config.ts with webServer + chromium project
aef5065 docs(pr5): document Supabase test project + GH Secrets manual setup
6e9a0fc docs(pr5): fix schema rename (user_data.data) + record provisioning variance
5fc3b7b feat(pr5): add tests/fixtures.ts with doLogin + Supabase seed fixtures
cb3b4bd test(pr5): add login + REGRESSION-04 (importo=0 confirm) Playwright specs
1116dd6 test(pr5): add calendario regressions 01/02/05 + critical paths 02/03
99bfb84 test(pr5): add REGRESSION-03 service worker boot invariant
d265036 test(pr5): scaffold CRITICAL-04 (cestino) + CRITICAL-05 (offline) as test.skip pending PR1 / PR2b
3ba9eaf ci(pr5): add Playwright workflow + deploy gate (push to master, fail blocks deploy)
85754e5 docs(pr5): document Playwright suite + CI gating contract in README
d44b890 fix(pr5): Checkpoint 11 selector + seed fixes
2c24d99 fix(pr5): REGRESSION-04 + CRITICAL-03 scope form via [x-show] attribute
e9a8658 fix(pr5): CRITICAL-03 verify nome in Impostazioni table, not dashboard h3
```
