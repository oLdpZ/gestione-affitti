---
phase: 01-pr5-test-infrastructure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - .gitignore
  - playwright.config.ts
  - tests/fixtures.ts
  - tests/login.spec.ts
  - tests/calendario.spec.ts
  - tests/sw.spec.ts
  - tests/cestino.spec.ts
  - tests/offline.spec.ts
  - .github/workflows/playwright.yml
  - README.md
  - .planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md
autonomous: false
requirements:
  - REQ-PLAY-01
user_setup:
  - service: supabase-test-project
    why: "Dedicated Supabase test project for CI seed/reset, isolated from prod"
    env_vars:
      - name: SUPABASE_TEST_URL
        source: "Supabase Dashboard -> gestione-affitti-test -> Settings -> API -> Project URL"
      - name: SUPABASE_SERVICE_KEY
        source: "Supabase Dashboard -> gestione-affitti-test -> Settings -> API -> service_role key (NEVER in client code)"
      - name: TEST_EMAIL
        source: "User-chosen test email (e.g., test@gestione-affitti.local)"
      - name: TEST_PASSWORD
        source: "User-chosen stable password"
      - name: TEST_USER_ID
        source: "Supabase Dashboard -> Authentication -> Users -> UUID of test user"
    dashboard_config:
      - task: "Create new Supabase free-tier project named gestione-affitti-test"
        location: "https://app.supabase.com -> New project"
      - task: "Run schema SQL to create dati_utente table + RLS policy (SQL provided in 01-SUPABASE-TEST-SETUP.md)"
        location: "Supabase Dashboard -> SQL Editor"
      - task: "Create test user with stable email/password"
        location: "Supabase Dashboard -> Authentication -> Users -> Invite user"
      - task: "Add 5 GitHub Secrets to repo (SUPABASE_TEST_URL, SUPABASE_SERVICE_KEY, TEST_EMAIL, TEST_PASSWORD, TEST_USER_ID)"
        location: "GitHub repo -> Settings -> Secrets and variables -> Actions"
      - task: "Verify GitHub Pages deploy mechanism (branch deploy vs Actions) and apply gating via branch protection or needs: test"
        location: "GitHub repo -> Settings -> Pages and Settings -> Branches"

must_haves:
  truths:
    - "Pushing to master triggers the Playwright workflow in GitHub Actions"
    - "A failing Playwright test makes the workflow red and blocks the GitHub Pages deploy"
    - "All 5 LOCKED regression tests (CON-017 #1-#5) exist as discrete test cases in tests/*.spec.ts"
    - "All 5 LOCKED regression tests (CON-017 REGRESSION-01 through REGRESSION-05) are LIVE (not skipped) and pass against current index.html on every push to master"
    - "The 3 critical paths runnable today (login, crea proprieta, segna incasso) execute LIVE and pass against current index.html on every push"
    - "The 2 critical paths gated on later PRs (cestino, offline sync) exist as test.skip with explicit TODO referencing the PR that unblocks them"
    - "The Playwright suite runs against a local static server (npx serve) in CI, not against the live GitHub Pages URL"
    - "A dedicated Supabase test project (separate from prod) holds the test user + mock blob; CI seeds it via service_role key from GH Secrets before each spec"
    - "node_modules, playwright-report, test-results are gitignored; index.html bundle is unchanged (no build step introduced)"
    - "README documents how to run the suite locally and the CI gating contract"
  artifacts:
    - path: "package.json"
      provides: "Dev-only test tooling manifest"
      contains: "@playwright/test"
    - path: ".gitignore"
      provides: "Excludes node_modules, playwright-report, test-results, .env.test"
      contains: "node_modules"
    - path: "playwright.config.ts"
      provides: "Playwright config with webServer (npx serve), chromium project, retries=2 in CI, workers=1 in CI, screenshot/video on failure"
      contains: "webServer"
    - path: "tests/fixtures.ts"
      provides: "doLogin helper, seedSupabase via service_role, MOCK_DATI + MOCK_DATI_WITH_ORPHAN constants"
      exports: ["test", "expect", "doLogin"]
    - path: "tests/login.spec.ts"
      provides: "CRITICAL-01 login + REGRESSION-04 (importo=0 confirm modal)"
      min_lines: 40
    - path: "tests/calendario.spec.ts"
      provides: "REGRESSION-01 (card gialla importo=0), REGRESSION-02 (genera incassi mancanti elenca saltate), REGRESSION-05 (incassi orfani gruppo dedicato), CRITICAL-02 (segna incasso oggi), CRITICAL-03 (crea proprieta)"
      min_lines: 100
    - path: "tests/sw.spec.ts"
      provides: "REGRESSION-03 (service worker stale unregistered at boot)"
      min_lines: 20
    - path: "tests/cestino.spec.ts"
      provides: "CRITICAL-04 scaffolded as test.skip with TODO referencing PR1"
      contains: "test.skip"
    - path: "tests/offline.spec.ts"
      provides: "CRITICAL-05 scaffolded as test.skip with TODO referencing PR2b"
      contains: "test.skip"
    - path: ".github/workflows/playwright.yml"
      provides: "CI workflow: push to master + workflow_dispatch -> install -> test -> upload artifacts on fail -> gate deploy"
      contains: "on:\n  push:\n    branches: [master]"
    - path: ".planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md"
      provides: "Step-by-step manual setup doc for the user (create project, SQL schema, test user, GitHub Secrets, Pages gating)"
      min_lines: 40
    - path: "README.md"
      provides: "Section: 'Test suite' explaining local run + CI gating contract"
      contains: "playwright"
  key_links:
    - from: "playwright.config.ts"
      to: "tests/*.spec.ts"
      via: "testDir: './tests'"
      pattern: "testDir.*tests"
    - from: "playwright.config.ts"
      to: "http://localhost:3000 (static server)"
      via: "webServer: { command: 'npx serve . -l 3000 --no-clipboard' }"
      pattern: "webServer"
    - from: "tests/fixtures.ts"
      to: "Supabase test project /rest/v1/dati_utente"
      via: "fetch with SUPABASE_SERVICE_KEY from env"
      pattern: "SUPABASE_SERVICE_KEY"
    - from: "tests/*.spec.ts"
      to: "tests/fixtures.ts"
      via: "import { test, expect, doLogin } from './fixtures'"
      pattern: "from './fixtures'"
    - from: ".github/workflows/playwright.yml"
      to: "GitHub Pages deploy"
      via: "needs: test on deploy job OR branch protection required check"
      pattern: "needs:\\s*test|required.*status"
    - from: ".github/workflows/playwright.yml"
      to: "GH Secrets (SUPABASE_TEST_URL, SUPABASE_SERVICE_KEY, TEST_EMAIL, TEST_PASSWORD, TEST_USER_ID)"
      via: "env: with ${{ secrets.* }}"
      pattern: "secrets\\.SUPABASE"
---

<objective>
Stand up the Playwright safety net in GitHub Actions CI before any feature work begins (Phase 1, PR5, first in the LOCKED DEC-001 sequence). After this phase: every push to master runs the suite; a red suite blocks the GitHub Pages deploy; 3 critical paths plus 5 LOCKED regression tests (CON-017) run LIVE against a local static-served `index.html` using a dedicated Supabase test project; 2 paths (cestino, offline sync) are scaffolded as `test.skip` with explicit TODOs pinned to the PR that unblocks them.

Purpose: PR1 onwards is a series of destructive, schema-touching changes (soft-delete, schema migration, mutation queue). Without this safety net first, regressions ship silently. DEC-011 + DEC-001 lock this as gate #1.

Output:
- `package.json` (dev-only Playwright) + `playwright.config.ts` with `webServer` + chromium project
- `tests/fixtures.ts` + 5 spec files (3 LIVE, 2 `test.skip`)
- `.github/workflows/playwright.yml` push-trigger + deploy gate
- Manual setup doc for Supabase test project + GH Secrets
- README section documenting the contract
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/intel/constraints.md
@.planning/intel/decisions.md
@.planning/phases/01-pr5-test-infrastructure/01-RESEARCH.md
@docs/ingest/SPEC-test-plan.md
@index.html

<interfaces>
<!-- Key DOM landmarks, function locations, and Alpine state shape the executor will assert against. Extracted from index.html. Executor should use these directly. -->

Auth + boot (index.html):
- `eseguiLogin()` calls `sb.auth.signInWithPassword({ email, password })`
- Login form: `input[type="email"]`, `input[type="password"]`, `button[type="submit"]`
- Alpine root: `<div x-data="app()">`; `defer` scripts; `x-cloak` hides until init
- Post-login landmark: text "Dashboard" + `.status-dot`

Calendar (`gruppiCalendario()`, lines ~1283-1295 of index.html):
- Group `mancanti` rendered with `bg-yellow-50` + "Sistema" button (lines 332-341)
- Group `orfani` rendered with header text "Incassi orfani (proprieta cancellata)"
- `generaIncassiMeseVisualizzato()` lines 1308-1332 — alert() with skipped list

Save (importo=0):
- `salvaProprieta()` line ~1461 — calls browser `confirm()` when `importoAffittoMensile <= 0`
- Test must register `page.on('dialog', ...)` BEFORE the click that triggers confirm()

Supabase test project schema (Phase 1 only — pre-PR2b):
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

Mock blob shape (from RESEARCH.md fixtures):
```typescript
{
  proprieta: [
    { id: 'prop-test-001', nome: 'Appartamento Test Via Roma', importoAffittoMensile: 900, scadenzaAffitto: '1', currency: 'EUR', bancaIncasso: 'banca-test-001', bancaDestinazione: 'banca-test-001', intestatario: 'Test Intestatario' },
    { id: 'prop-zero-001', nome: 'Appartamento Importo Zero', importoAffittoMensile: 0, scadenzaAffitto: '15', currency: 'EUR', bancaIncasso: 'banca-test-001', bancaDestinazione: 'banca-test-001', intestatario: 'Test Intestatario Zero' }
  ],
  banche: [{ id: 'banca-test-001', nome: 'Banca Test', intestatario: 'Test', currency: 'EUR' }],
  incassiAffitti: [],
  utenze: []
}
// MOCK_DATI_WITH_ORPHAN spreads above + incassiAffitti: [{ id:'inc-orphan-001', proprietaId:'prop-deleted-999', mese: <current>, importo: 500, ... }]
```

Supabase REST seed (service_role bypasses RLS):
- DELETE `${SUPABASE_TEST_URL}/rest/v1/dati_utente?user_id=eq.${TEST_USER_ID}`
- POST `${SUPABASE_TEST_URL}/rest/v1/dati_utente` body `{ user_id, blob_json }`
- Headers: `apikey: SERVICE_KEY`, `Authorization: Bearer SERVICE_KEY`, `Content-Type: application/json`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: npm init + Playwright devDep + .gitignore (per D-011, D-003, CON-001)</name>
  <files>package.json, package-lock.json, .gitignore</files>
  <action>
At repo root:
1. Run `npm init -y`. Edit the resulting `package.json` so it contains ONLY: name `gestione-affitti`, version `0.1.0`, private `true`, scripts `{ "test": "playwright test", "test:headed": "playwright test --headed", "test:ui": "playwright test --ui" }`. Remove `main`, remove `description`, do NOT add `dependencies` (test tooling must be devDep only — per CON-001 + DEC-003: app stays no-build, devDeps live outside the bundle since `index.html` does not import from `node_modules`).
2. Run `npm install --save-dev @playwright/test@1.60.0` (pinned per RESEARCH; do not use ^). This creates `package-lock.json` — commit it.
3. Run `npx playwright install chromium --with-deps`. Chromium-only (RESEARCH §Alternatives Considered — multi-browser adds 3x CI time without benefit at family-tier scale).
4. Update `.gitignore` to add (append if missing): `node_modules/`, `playwright-report/`, `test-results/`, `.env.test`, `playwright/.cache/`. Keep all existing entries.
5. Verify `index.html` is unchanged — `git diff index.html` must be empty. CON-001 invariant.

Commit: `chore(pr5): add @playwright/test devDep + gitignore test artifacts`
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json');if(!p.devDependencies||!p.devDependencies['@playwright/test'])process.exit(1);if(p.dependencies&&Object.keys(p.dependencies).length>0)process.exit(2);console.log('OK')"</automated>
    <automated>grep -v '^#' .gitignore | grep -q '^node_modules/$' && grep -v '^#' .gitignore | grep -q '^playwright-report/$' && grep -v '^#' .gitignore | grep -q '^test-results/$' && echo OK</automated>
    <automated>git diff --exit-code index.html</automated>
  </verify>
  <done>
`package.json` exists with `@playwright/test` as devDependency only, no runtime `dependencies`. `package-lock.json` exists. `.gitignore` excludes test artifacts and `node_modules/`. Chromium installed locally. `index.html` byte-identical to pre-task (CON-001 preserved).
  </done>
</task>

<task type="auto">
  <name>Task 2: playwright.config.ts with webServer + chromium + CI tuning (per D-011, RESEARCH Pattern 1)</name>
  <files>playwright.config.ts</files>
  <action>
Create `playwright.config.ts` at repo root matching RESEARCH.md Pattern 1 exactly:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx serve . -l 3000 --no-clipboard',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
```

Rationale (encoded as comments at top of file):
- `workers: 1` in CI — Supabase free-tier API rate limits during fixture seed (RESEARCH Pitfall 3 area)
- `retries: 2` in CI — Alpine.js `defer` race protection (RESEARCH Pitfall 1)
- `screenshot/video: only-on-failure` — keep artifact size small
- `webServer.timeout: 15_000` — index.html still references the 4.7MB MP4 until PR0 ships (RESEARCH Pitfall 6)
- chromium-only — see Task 1 rationale

Commit: `feat(pr5): add playwright.config.ts with webServer + chromium project`
  </action>
  <verify>
    <automated>npx playwright test --list 2>&1 | grep -qi 'chromium\|no tests' && echo OK</automated>
    <automated>node -e "const c=require('./playwright.config.ts');" 2>&1 | head -5 || node --experimental-vm-modules -e "console.log('config-syntax-ok')" 2>&1 | tail -1</automated>
    <automated>grep -q "webServer" playwright.config.ts && grep -q "testDir: './tests'" playwright.config.ts && grep -q "chromium" playwright.config.ts && echo OK</automated>
  </verify>
  <done>
`playwright.config.ts` exists. `npx playwright test --list` runs without "no config" or syntax errors (it may report "no tests found" — that is OK at this task; tests come in Task 4+). `webServer`, `testDir`, `chromium`, `retries`, `workers`, `screenshot`, `video` all present.
  </done>
</task>

<task type="auto">
  <name>Task 3: Supabase test project setup doc + manual checkpoint (per A1, A2, REQ-PLAY-01 'dedicated test project')</name>
  <files>.planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md</files>
  <action>
Create `01-SUPABASE-TEST-SETUP.md` in the phase dir documenting the manual steps the user must perform OUTSIDE this repo (RESEARCH §Supabase Test Project Setup). Required sections:

1. **Why a separate test project** — RESEARCH §Anti-Patterns: prod corruption risk + RLS isolation.
2. **Steps**:
   - Create new Supabase free-tier project named `gestione-affitti-test` at https://app.supabase.com (same region as prod for latency parity)
   - Open Settings -> API; copy `Project URL` and `service_role` key (the latter is GH-Secret-only — never paste into index.html, never log)
   - In SQL Editor run (verbatim):
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
   - Authentication -> Users -> Invite a test user with a stable email (e.g., `test@gestione-affitti.local`) and stable password. Note the user's UUID.
3. **GitHub Secrets to add** (repo -> Settings -> Secrets and variables -> Actions -> New repository secret), table:
   | Secret | Value source |
   |--------|--------------|
   | `SUPABASE_TEST_URL` | Project URL from step above |
   | `SUPABASE_SERVICE_KEY` | service_role key |
   | `TEST_EMAIL` | invited user email |
   | `TEST_PASSWORD` | the chosen password |
   | `TEST_USER_ID` | UUID of the invited user |
4. **GitHub Pages deploy gating** — answers RESEARCH Open Question #1:
   - Go to repo Settings -> Pages and note whether deploy is "Deploy from branch" or "GitHub Actions"
   - If "Deploy from branch": go to Settings -> Branches -> Add branch protection rule for `master` -> tick "Require status checks to pass before merging" -> add `Playwright Tests` once it has run at least once
   - If "GitHub Actions": ensure the deploy workflow has `needs: test` on its deploy job (the workflow in Task 10 uses this pattern by default)
5. **Verification checklist** at end (manual): `[ ] project created`, `[ ] schema applied`, `[ ] test user invited`, `[ ] 5 secrets added`, `[ ] Pages gate configured`.

Commit: `docs(pr5): document Supabase test project + GH Secrets manual setup`

Then create a CHECKPOINT in the same task action: stop and surface this doc to the user as part of `<checkpoint:human-action>` (defined explicitly as Task 3b below — split for clarity).
  </action>
  <verify>
    <automated>test -f .planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md && grep -q "SUPABASE_SERVICE_KEY" .planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md && grep -q "create table if not exists dati_utente" .planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md && grep -q "TEST_USER_ID" .planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md && echo OK</automated>
  </verify>
  <done>
Doc exists at the phase dir, all 5 secrets named, SQL block included verbatim, deploy gating both branches documented, manual verification checklist present.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3b: CHECKPOINT — user creates Supabase test project + adds GH Secrets + chooses deploy gate mode</name>
  <what-built>Task 3 produced `.planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md` with explicit steps. Claude cannot perform these because Supabase project provisioning + GitHub repo Secrets are dashboard-only actions with no CLI/API alternative that does not require already-authenticated credentials we do not have.</what-built>
  <how-to-verify>
1. Open `.planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md` and follow the steps end-to-end.
2. Confirm all 5 boxes in the verification checklist at the bottom are checked:
   - [ ] gestione-affitti-test Supabase project created
   - [ ] dati_utente schema + RLS policy applied
   - [ ] Test user invited with stable email/password (UUID noted)
   - [ ] 5 GitHub Secrets added (SUPABASE_TEST_URL, SUPABASE_SERVICE_KEY, TEST_EMAIL, TEST_PASSWORD, TEST_USER_ID)
   - [ ] GitHub Pages deploy gating configured per the doc (branch protection OR `needs: test` strategy noted)
3. As a smoke test from your terminal (replace placeholders with the just-created values; this proves the service_role key works against the new project):
   ```bash
   curl -s -X GET "$SUPABASE_TEST_URL/rest/v1/dati_utente?limit=1" \
     -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
   ```
   Expected: `[]` (or any 200 response, not 401/404). If 401: service_role key wrong. If 404: schema not applied.
4. **REPORT BACK the deploy mode chosen** (this drives Task 9's verify branch): either `DEPLOY_MODE=github-actions` or `DEPLOY_MODE=deploy-from-branch`. The executor records this and uses it in Task 9.
</how-to-verify>
  <resume-signal>Type `approved DEPLOY_MODE=github-actions` OR `approved DEPLOY_MODE=deploy-from-branch` once all 5 checklist items are done and the curl smoke test returned a 200, OR describe what went wrong.</resume-signal>
</task>

<task type="auto">
  <name>Task 4: tests/fixtures.ts — doLogin + seedSupabase + mock data (per RESEARCH Pattern 2, A2)</name>
  <files>tests/fixtures.ts</files>
  <action>
Create `tests/fixtures.ts` matching RESEARCH.md Pattern 2 exactly. Specifically it MUST:

1. Read env: `SUPABASE_TEST_URL`, `SUPABASE_SERVICE_KEY`, `TEST_EMAIL`, `TEST_PASSWORD`, `TEST_USER_ID`. Throw with a clear error message if any is missing (helps local debugging).
2. Export two `MOCK_DATI` constants:
   - `MOCK_DATI` — 2 proprieta (`prop-test-001` importo=900, `prop-zero-001` importo=0 — covers REGRESSION-01), 1 banca, empty `incassiAffitti` and `utenze`. Use the exact shape from RESEARCH Pattern 2 §MOCK_DATI.
   - `MOCK_DATI_WITH_ORPHAN` — spreads MOCK_DATI plus one `incassiAffitti` entry with `proprietaId: 'prop-deleted-999'` (does not exist in proprieta array), `mese: new Date().toISOString().slice(0,7)`, `importo: 500`, all other fields valid (covers REGRESSION-05).
3. Implement `seedSupabase(blob: object)` exactly per RESEARCH: DELETE `${SUPABASE_URL}/rest/v1/dati_utente?user_id=eq.${TEST_USER_ID}` then POST `${SUPABASE_URL}/rest/v1/dati_utente` body `{ user_id: TEST_USER_ID, blob_json: blob }`. Both requests use service_role key in `apikey` + `Authorization: Bearer` headers + `Content-Type: application/json` + POST adds `Prefer: return=minimal`. Check response.ok and throw with body on failure.
4. Export Playwright `test` extended with two fixtures: `seedData` (calls seedSupabase(MOCK_DATI)) and `seedWithOrphan` (calls seedSupabase(MOCK_DATI_WITH_ORPHAN)). Both `{ auto: false }` so specs opt in by adding them to args.
5. Export `doLogin(page)` helper: `page.goto('/')`, `waitForSelector('input[type="email"]')`, fill email + password, click `button[type="submit"]`, `waitForSelector('text=Dashboard', { timeout: 15_000 })`. Counter to RESEARCH Pitfall 1 (Alpine defer race).
6. Re-export `expect` from `@playwright/test`.

Do NOT log secrets anywhere. No console.log of headers or body keys.

Commit: `feat(pr5): add tests/fixtures.ts with doLogin + Supabase seed fixtures`
  </action>
  <verify>
    <automated>npx tsc --noEmit --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck tests/fixtures.ts 2>&1 | grep -v "Cannot find module '@playwright/test'" | grep -E "error TS" ; test ${PIPESTATUS[2]:-${PIPESTATUS[1]}} -ne 0 && echo OK_NO_ERRORS</automated>
    <automated>grep -q "MOCK_DATI_WITH_ORPHAN" tests/fixtures.ts && grep -q "prop-zero-001" tests/fixtures.ts && grep -q "prop-deleted-999" tests/fixtures.ts && grep -q "doLogin" tests/fixtures.ts && grep -q "SUPABASE_SERVICE_KEY" tests/fixtures.ts && echo OK</automated>
    <automated>grep -E "console\\.(log|warn|error).*(KEY|PASSWORD|SERVICE)" tests/fixtures.ts ; test ${PIPESTATUS[0]} -ne 0 && echo OK_NO_SECRET_LOGS</automated>
  </verify>
  <done>
`tests/fixtures.ts` exports `test`, `expect`, `doLogin`, `MOCK_DATI`, `MOCK_DATI_WITH_ORPHAN`. TypeScript compiles. No secret logging. Env-missing throws clear errors.
  </done>
</task>

<task type="auto">
  <name>Task 5: tests/login.spec.ts — CRITICAL-01 + REGRESSION-04 (LIVE)</name>
  <files>tests/login.spec.ts</files>
  <action>
Create `tests/login.spec.ts` with two LIVE tests:

**CRITICAL-01: login + data load** (per RESEARCH §CRITICAL-01):
- Use `seedData` fixture
- `page.goto('/')`, wait for `input[type="email"]`
- Fill TEST_EMAIL / TEST_PASSWORD, click submit
- Assert `text=Dashboard` visible within 15s
- Assert `.status-dot` visible
- Assert `text=Appartamento Test Via Roma` visible (proves blob loaded)

**REGRESSION-04: importo=0 soft confirm on save** (per CON-017 #4, RESEARCH §REGRESSION-04, Pitfall 2):
- Use `seedData` fixture
- `doLogin(page)`, navigate to Impostazioni: `page.click('button:has-text("Impostazioni")')`
- Open the edit form for prop-test-001 (selector strategy: locate the row containing "Appartamento Test Via Roma" then click its modifica button — try `page.locator('tr,div').filter({ hasText: 'Appartamento Test Via Roma' }).locator('button').filter({ hasText: /[Mm]odifica/ }).first().click()`; if A3 assumption fails the test fails clearly and the executor fixes the selector to match actual DOM)
- Wait for an importo input to appear, then `page.fill('input[type="number"]', '0')` (target the importo field specifically: prefer `input[type="number"][...attribute matching importo]` if discoverable, else the visible importo input within the form)
- **CRITICAL ORDER (Pitfall 2):** register `let confirmShown = false; page.on('dialog', async d => { confirmShown = true; await d.dismiss(); })` BEFORE clicking Salva
- Click `button:has-text("Salva")`
- Assert `confirmShown === true` (use `await expect.poll(() => confirmShown).toBe(true)` to avoid race)

Add a TODO comment at top of REGRESSION-04: `// TODO(PR1): when REQ-SAFE-06 replaces browser confirm() with a custom modal, update this test to assert on the modal DOM instead of page.on('dialog')`.

Commit: `test(pr5): add login + REGRESSION-04 (importo=0 confirm) Playwright specs`
  </action>
  <verify>
    <automated>npx playwright test tests/login.spec.ts --list 2>&1 | grep -E "CRITICAL-01|REGRESSION-04" | wc -l | grep -q "^\\s*2\\s*$" && echo OK</automated>
    <automated>grep -q "page.on('dialog'" tests/login.spec.ts && grep -q "TODO(PR1)" tests/login.spec.ts && echo OK</automated>
    <automated>echo "LIVE_RUN: requires GH Secrets + Supabase test project (checkpoint 3b). Locally export the 5 env vars then: npx playwright test tests/login.spec.ts"</automated>
  </verify>
  <done>
Two test cases listed by Playwright. `page.on('dialog')` registered before the Salva click. TODO comment present pinning the test to PR1. Test passes locally when env vars are set (developer-verified via checkpoint 13).
  </done>
</task>

<task type="auto">
  <name>Task 6: tests/calendario.spec.ts — REGRESSION-01, -02, -05 + CRITICAL-02, -03 (LIVE)</name>
  <files>tests/calendario.spec.ts</files>
  <action>
Create `tests/calendario.spec.ts` with five LIVE tests. Each `test.describe` block starts with `doLogin(page)` and `page.click('button:has-text("Calendario")')`. Implementations per RESEARCH §regressions:

**REGRESSION-01 (CON-017 #1) — card gialla importo=0:**
- Fixture: `seedData`
- After navigating to calendario, locate `page.locator('.bg-yellow-50, [class*="yellow-900"]').filter({ hasText: 'Appartamento Importo Zero' })` and assert visible
- Inside that card assert `button:has-text("Sistema")` visible AND `text=Importo mensile` visible

**REGRESSION-02 (CON-017 #2) — genera incassi mancanti elenca saltate:**
- Fixture: `seedData`
- Register `let alertMessage = ''; page.on('dialog', async d => { alertMessage = d.message(); await d.accept(); })` BEFORE the click (Pitfall 2)
- Click `button:has-text("Genera incassi mancanti")`
- Use `expect.poll(() => alertMessage).toContain('Appartamento Importo Zero')` AND `expect.poll(() => alertMessage).not.toContain('tutto già presente per')`

**REGRESSION-05 (CON-017 #5) — incassi orfani gruppo dedicato:**
- Fixture: `seedWithOrphan` (NOTE: do not also use `seedData` — they conflict)
- Assert `page.locator('h3').filter({ hasText: 'orfani' })` visible
- Assert at least one element containing "500" within that group (the orphan importo)

**CRITICAL-02 — segna incasso oggi <2s:**
- Fixture: `seedData`
- Locate `page.locator('.bg-gray-50, .bg-red-50').filter({ hasText: 'Appartamento Test Via Roma' })` — note Pitfall 4: `generaIncassiAttesi` may have already created the incasso during init, which is the expected starting state for this test
- Record `start = Date.now()`, click `button:has-text("Incassa oggi"), button:has-text("Oggi")` within the card
- Assert `.bg-green-50` filtered by "Appartamento Test Via Roma" visible
- Assert `Date.now() - start < 2_000`
- Assert green status dot reappears within 10s (`.status-dot[class*="green"], .status-dot.bg-green-500`)

**CRITICAL-03 — crea nuova proprieta:**
- Fixture: `seedData`
- Navigate to Impostazioni, then click the Aggiungi/Nuova proprietà button SCOPED to the Proprietà section (drop the bare "+" alternative — it may hit the wrong button elsewhere on the page):
  `await page.locator('section:has-text("Proprietà"), div:has-text("Proprietà")').locator('button').filter({ hasText: /Aggiungi|Nuova proprietà/ }).first().click()`
- Fill nome `Proprietà E2E Test`, importo `1200`
- Click Salva
- Assert `text=Proprietà E2E Test` visible within 5s
- Assert green status dot within 10s

For Pitfall 5 (calendar month mismatch): do NOT click next/previous month arrows in any of these tests. Assert only on current month state.

Commit: `test(pr5): add calendario regressions 01/02/05 + critical paths 02/03`
  </action>
  <verify>
    <automated>npx playwright test tests/calendario.spec.ts --list 2>&1 | grep -E "REGRESSION-01|REGRESSION-02|REGRESSION-05|CRITICAL-02|CRITICAL-03" | wc -l | grep -q "^\\s*5\\s*$" && echo OK</automated>
    <automated>grep -c "page.on('dialog'" tests/calendario.spec.ts | grep -qE "^[1-9]" && echo OK_DIALOG_HANDLERS</automated>
    <automated>grep -q "seedWithOrphan" tests/calendario.spec.ts && grep -q "Appartamento Importo Zero" tests/calendario.spec.ts && echo OK</automated>
    <automated>grep -q 'section:has-text("Proprietà")' tests/calendario.spec.ts && echo OK_SCOPED_ADD_BUTTON</automated>
  </verify>
  <done>
Five tests listed. Dialog handlers registered before triggering clicks. REGRESSION-05 uses seedWithOrphan; the other four use seedData. CRITICAL-03 add-proprietà click is scoped to the Proprietà section (no bare "+" fallback). No month-navigation clicks.
  </done>
</task>

<task type="auto">
  <name>Task 7: tests/sw.spec.ts — REGRESSION-03 (LIVE, with PR2a-evolution comment)</name>
  <files>tests/sw.spec.ts</files>
  <action>
Create `tests/sw.spec.ts` with a single LIVE test for CON-017 #3 (RESEARCH §REGRESSION-03).

Test body:
- `page.goto('/')`
- `page.waitForLoadState('networkidle')`
- `const swCount = await page.evaluate(async () => { if (!('serviceWorker' in navigator)) return 0; const regs = await navigator.serviceWorker.getRegistrations(); return regs.length; })`
- Assert `swCount === 0` (current pre-PR2a state — no SW shipped yet, so zero registrations is the correct invariant; the test thus protects against accidentally registering a SW before PR2a)

Add at top of file:
```typescript
// REGRESSION-03 (CON-017 #3) — Service worker stale unregistered at boot
// Phase 1 (pre-PR2a): app has no SW; assertion is swCount === 0.
// TODO(PR2a): when sw.js ships, evolve this test:
//   1. Pre-register a stale SW with a different scope/version via page.evaluate
//   2. Reload the page
//   3. Assert the stale SW is gone and only the current versioned SW remains
// Reference: REQ-PWA-02 + CON-010 (boot unregisters stale SWs).
```

`navigator.serviceWorker` is available on localhost over HTTP — no HTTPS needed (RESEARCH §REGRESSION-03 confirmation).

Commit: `test(pr5): add REGRESSION-03 service worker boot invariant`
  </action>
  <verify>
    <automated>npx playwright test tests/sw.spec.ts --list 2>&1 | grep -qi "REGRESSION-03" && echo OK</automated>
    <automated>grep -q "TODO(PR2a)" tests/sw.spec.ts && grep -q "getRegistrations" tests/sw.spec.ts && echo OK</automated>
  </verify>
  <done>
One test listed. Assertion is `swCount === 0`. Evolution TODO present and references PR2a + REQ-PWA-02.
  </done>
</task>

<task type="auto">
  <name>Task 8: tests/cestino.spec.ts + tests/offline.spec.ts — CRITICAL-04 / CRITICAL-05 scaffolded as test.skip (per RESEARCH; PR1 / PR2b dependencies)</name>
  <files>tests/cestino.spec.ts, tests/offline.spec.ts</files>
  <action>
Create both files as `test.skip` scaffolds matching RESEARCH §CRITICAL-04 and §CRITICAL-05 exactly, so the suite reports them as "skipped" rather than failing for missing features, and so the unblocking PR has a clear failing test waiting.

**tests/cestino.spec.ts:**
```typescript
import { test, expect, doLogin } from './fixtures';

test.describe('CRITICAL-04: elimina e ripristina dal cestino', () => {
  test.skip('elimina proprieta + ripristina dal cestino restituisce dati identici — RICHIEDE PR1 (REQ-SAFE-01, REQ-SAFE-02)', async ({ page }) => {
    // TODO(PR1): unblock this test when REQ-SAFE-01 (soft-delete) + REQ-SAFE-02 (cestino view) ship.
    // Steps:
    // 1. await doLogin(page)
    // 2. Impostazioni -> delete prop-test-001 (click elimina, confirm)
    // 3. Impostazioni -> Cestino -> find prop-test-001, click Ripristina
    // 4. Navigate back, verify prop-test-001 reappears with all related incassi + utenze
    // 5. Snapshot the dati blob before delete and after restore; deep-equal must hold.
  });
});
```

**tests/offline.spec.ts:**
```typescript
import { test, expect, doLogin } from './fixtures';

test.describe('CRITICAL-05: offline write + sync on reconnect', () => {
  test.skip('offline write + return online + sync — RICHIEDE PR2b (REQ-SYNC-01)', async ({ page, context }) => {
    // TODO(PR2b): unblock this test when REQ-SYNC-01 (mutation queue via idb-keyval) ships.
    // Steps:
    // 1. await doLogin(page)
    // 2. await context.setOffline(true)
    // 3. Make a write (segna incasso)
    // 4. Assert "Offline" status dot + "N modifiche in coda" indicator visible
    // 5. await context.setOffline(false)
    // 6. Wait for green status dot (sync complete)
    // 7. page.reload() — assert the change persisted on the server (RPC returns expected state)
  });
});
```

Both files import the same `test`/`expect`/`doLogin` as the LIVE specs so swapping `test.skip` -> `test` is a one-character edit in the unblocking PR.

Commit: `test(pr5): scaffold CRITICAL-04 (cestino) + CRITICAL-05 (offline) as test.skip pending PR1 / PR2b`
  </action>
  <verify>
    <automated>npx playwright test tests/cestino.spec.ts tests/offline.spec.ts --list 2>&1 | grep -c "skip\|CRITICAL-0[45]" | grep -qE "^[2-9]" && echo OK</automated>
    <automated>grep -q "test.skip" tests/cestino.spec.ts && grep -q "RICHIEDE PR1" tests/cestino.spec.ts && grep -q "REQ-SAFE-01" tests/cestino.spec.ts && echo OK</automated>
    <automated>grep -q "test.skip" tests/offline.spec.ts && grep -q "RICHIEDE PR2b" tests/offline.spec.ts && grep -q "REQ-SYNC-01" tests/offline.spec.ts && grep -q "setOffline" tests/offline.spec.ts && echo OK</automated>
  </verify>
  <done>
Both files exist. Both contain `test.skip`. Both TODOs reference the unblocking REQ ID. Playwright reports them as skipped, not failing.
  </done>
</task>

<task type="auto">
  <name>Task 9: .github/workflows/playwright.yml — CI workflow with deploy gate (per RESEARCH Pattern 3, REQ-PLAY-01)</name>
  <files>.github/workflows/playwright.yml</files>
  <action>
**Pre-step (only if DEPLOY_MODE=deploy-from-branch was chosen at Task 3b):** Walk the user through enabling the GitHub branch protection rule BEFORE the verify runs. Surface this as an inline mini-checkpoint:

> Go to GitHub repo -> Settings -> Branches -> Branch protection rules -> Add rule for `master` ->
> tick "Require status checks to pass before merging" -> in "Status checks that are required" search
> for and add `Playwright Tests` (the workflow must have run at least once for it to appear in the
> picker; if not present yet, push this commit first, wait for the workflow to run, then come back
> and add the required check). Confirm with `git -c` or screenshot that the rule is active before
> moving on.

(If DEPLOY_MODE=github-actions, skip this pre-step — gating is via `needs: test` in the YAML itself.)

Create `.github/workflows/playwright.yml` matching RESEARCH §Pattern 3 with the deploy gate:

```yaml
name: Playwright Tests

on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps
      - name: Run Playwright tests
        env:
          BASE_URL: 'http://localhost:3000'
          SUPABASE_TEST_URL: ${{ secrets.SUPABASE_TEST_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
          TEST_USER_ID: ${{ secrets.TEST_USER_ID }}
        run: npx playwright test
      - name: Upload test artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ github.run_id }}
          path: |
            playwright-report/
            test-results/
          retention-days: 7
```

Then conditionally append a deploy gate based on the checkpoint 3b answer:

- **If DEPLOY_MODE=deploy-from-branch:** do NOT add a deploy job to this workflow. Gating is via branch protection (configured in the pre-step above). Add a comment at the bottom of the YAML:
  ```yaml
  # Deploy gating: this repo uses "Deploy from branch" for GitHub Pages.
  # The deploy is blocked at branch-protection level — see
  # .planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md
  # step "GitHub Pages deploy gating" for the required-status-check configuration.
  ```
- **If DEPLOY_MODE=github-actions:** append a second job:
  ```yaml
    deploy:
      needs: test
      runs-on: ubuntu-latest
      permissions:
        pages: write
        id-token: write
      environment:
        name: github-pages
        url: ${{ steps.deployment.outputs.page_url }}
      steps:
        - uses: actions/checkout@v4
        - uses: actions/configure-pages@v4
        - uses: actions/upload-pages-artifact@v3
          with:
            path: '.'
        - id: deployment
          uses: actions/deploy-pages@v4
  ```

If checkpoint 3b answer is ambiguous, STOP and ask the user explicitly — do not guess.

Commit: `ci(pr5): add Playwright workflow + deploy gate (push to master, fail blocks deploy)`
  </action>
  <verify>
    <automated>test -f .github/workflows/playwright.yml && echo OK</automated>
    <automated>grep -q "on:" .github/workflows/playwright.yml && grep -q "branches: \\[master\\]" .github/workflows/playwright.yml && grep -q "secrets.SUPABASE_SERVICE_KEY" .github/workflows/playwright.yml && grep -q "if: failure" .github/workflows/playwright.yml && grep -q "upload-artifact" .github/workflows/playwright.yml && echo OK</automated>
    <!-- Deploy gate verify is branched by the DEPLOY_MODE recorded at Task 3b. Run EXACTLY ONE of the two automated checks below. -->
    <!-- BRANCH A: DEPLOY_MODE=github-actions -->
    <automated>if [ "$DEPLOY_MODE" = "github-actions" ]; then grep -E "^[[:space:]]*needs:[[:space:]]*test" .github/workflows/playwright.yml && echo OK_NEEDS_TEST_WIRED || (echo "FAIL: needs: test missing on deploy job"; exit 1); fi</automated>
    <!-- BRANCH B: DEPLOY_MODE=deploy-from-branch — assert real branch protection exists on the remote -->
    <automated>if [ "$DEPLOY_MODE" = "deploy-from-branch" ]; then OWNER_REPO=$(git config --get remote.origin.url | sed -E 's#.*github.com[:/]+([^/]+/[^/.]+)(\.git)?#\1#'); gh api "repos/$OWNER_REPO/branches/master/protection/required_status_checks" --jq '.contexts[]' 2>/dev/null | grep -qx "Playwright Tests" && echo OK_BRANCH_PROTECTION_SET || (echo "FAIL: branch protection required_status_check 'Playwright Tests' not set on master (404 from gh api means no protection at all — configure it via the pre-step before re-running this verify)"; exit 1); fi</automated>
    <automated>npx --yes js-yaml .github/workflows/playwright.yml > /dev/null 2>&1 && echo YAML_VALID || node -e "const fs=require('fs');const y=fs.readFileSync('.github/workflows/playwright.yml','utf8');if(!y.includes('jobs:'))process.exit(1);console.log('YAML_BASIC_OK')"</automated>
  </verify>
  <done>
Workflow file exists. Triggers on push to master + manual dispatch. All 5 secrets passed as env. Artifacts uploaded on failure. Deploy gate is REAL (not a comment):
- If DEPLOY_MODE=github-actions: `needs: test` is present on a real deploy job in the YAML (grep proves the wiring).
- If DEPLOY_MODE=deploy-from-branch: `gh api .../branches/master/protection/required_status_checks` lists `Playwright Tests` as a required context (gh api proves the gate exists on the remote). A 404 from gh api FAILS the task — silent pass not allowed.
The pre-step walked the user through enabling branch protection BEFORE this verify ran (deploy-from-branch path only).
  </done>
</task>

<task type="auto">
  <name>Task 10: README — test suite usage + CI gating contract section</name>
  <files>README.md</files>
  <action>
Read existing `README.md`. Append (do not replace existing content) a new section near the end (before any "License" section, or at the very end if none):

```markdown
## Test suite (Playwright, da PR5)

La suite Playwright protegge le 5 regressioni LOCKED (CON-017) + 5 critical paths definiti in `.planning/intel/constraints.md`. Tre test girano LIVE oggi (login, crea proprieta, segna incasso + tutte e 5 le regression); due (cestino, offline sync) sono `test.skip` finche non arrivano rispettivamente PR1 e PR2b.

### Esecuzione locale

Prerequisiti una tantum:
- Node 20+
- Aver creato il progetto Supabase di test e ottenuto le 5 variabili — vedi `.planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md`

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
- Esito ROSSO -> il deploy GitHub Pages viene bloccato (via `needs: test` se Pages e' Actions-based, oppure via required status check sulla branch protection di `master` se Pages e' "Deploy from branch" — vedi setup doc)
- Esito VERDE -> deploy procede
- Su fallimento gli artefatti `playwright-report/` e `test-results/` (screenshot + video + trace) sono caricati come artifact del workflow (retention 7 giorni)

### Le 5 regression test LOCKED (CON-017 — non rimovibili senza ADR superseding)

1. REGRESSION-01 — Proprieta con `importoAffittoMensile=0` appare sul calendario come card gialla "Sistema" (`tests/calendario.spec.ts`)
2. REGRESSION-02 — "Genera incassi mancanti" elenca esplicitamente le proprieta saltate (`tests/calendario.spec.ts`)
3. REGRESSION-03 — Service worker stale unregistered al boot (`tests/sw.spec.ts`)
4. REGRESSION-04 — Importo=0 al salvataggio mostra confirm soft (`tests/login.spec.ts`)
5. REGRESSION-05 — Incassi orfani appaiono nel gruppo dedicato sul calendario (`tests/calendario.spec.ts`)
```

If the README already has a "Test" section, replace it with the section above (avoid duplication).

Commit: `docs(pr5): document Playwright suite + CI gating contract in README`
  </action>
  <verify>
    <automated>grep -q "## Test suite" README.md && grep -q "playwright" README.md && grep -q "CON-017" README.md && grep -q "needs: test\\|required status check\\|branch protection" README.md && echo OK</automated>
    <automated>grep -c "REGRESSION-0" README.md | grep -qE "^[5-9]|^[1-9][0-9]" && echo OK_ALL_REGRESSIONS_LISTED</automated>
  </verify>
  <done>
README has a "Test suite" section that documents local run + CI gating + lists all 5 LOCKED regressions by ID with their file location. Italian per CON-004 (user-facing strings).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 11: CHECKPOINT — verify suite locally + verify CI gate on a test branch</name>
  <what-built>The full Playwright + CI safety net (Tasks 1-10): config, fixtures, 5 spec files (3 LIVE, 2 skipped), GH Actions workflow, README docs, Supabase test project setup doc.</what-built>
  <how-to-verify>
**A — Local suite (proves the test code works against current `index.html`):**

1. Make sure the 5 env vars from checkpoint 3b are exported in your shell.
2. Run:
   ```bash
   npm ci
   npx playwright install chromium --with-deps
   npm test
   ```
3. Expected: `8 passed, 2 skipped, 0 failed`.

   The 8 LIVE tests (must all PASS):
   - CRITICAL-01 (login) — `tests/login.spec.ts`
   - REGRESSION-04 (importo=0 confirm) — `tests/login.spec.ts`
   - REGRESSION-01 (card gialla importo=0) — `tests/calendario.spec.ts`
   - REGRESSION-02 (genera incassi mancanti elenca saltate) — `tests/calendario.spec.ts`
   - REGRESSION-05 (incassi orfani) — `tests/calendario.spec.ts`
   - CRITICAL-02 (segna incasso oggi) — `tests/calendario.spec.ts`
   - CRITICAL-03 (crea proprietà) — `tests/calendario.spec.ts`
   - REGRESSION-03 (service worker boot) — `tests/sw.spec.ts`

   The 2 SKIPPED tests:
   - CRITICAL-04 (cestino) — `tests/cestino.spec.ts`
   - CRITICAL-05 (offline sync) — `tests/offline.spec.ts`
4. If any LIVE test fails: read the error in `playwright-report/`. The most common failure modes (per RESEARCH Pitfalls):
   - Selector miss on REGRESSION-04 modifica button (Pitfall A3) — adjust selector to match real DOM
   - Alpine defer race — add an extra waitForSelector
   - Supabase seed 401/403 — service_role key wrong, recheck checkpoint 3b smoke test
   - Surface specific failures back; planner will revise the offending task.

**B — CI gate (proves a red suite blocks deploy):**

1. Create a branch: `git checkout -b test/ci-gate-verify`
2. Make a deliberately failing change in one test (e.g., in `tests/login.spec.ts` change the expected post-login text from `'Dashboard'` to `'XX-NONEXISTENT-XX'`)
3. Open a PR to master OR push to master directly if branch protection allows
4. Confirm in the GitHub Actions tab:
   - The `Playwright Tests` workflow ran
   - It is RED
   - The failure artifact `playwright-report-*.zip` is downloadable
   - The Pages deploy did NOT run (or shows as blocked)
5. Revert the deliberate failure, push again, confirm the workflow is GREEN and Pages deploys.
6. Delete the test branch.

**C — Confirm the LOCKED regression contract:**

Run: `npx playwright test --list 2>&1 | grep -E "REGRESSION-0[1-5]"` and confirm 5 lines of output (one per LOCKED regression).

Report back with:
- [ ] Local: 8 passed, 2 skipped, 0 failed (or list which failed)
- [ ] CI: red run blocked the deploy AND artifact was uploaded
- [ ] CI: green run unblocked the deploy
- [ ] All 5 REGRESSION-0X tests listed
  </how-to-verify>
  <resume-signal>Type `approved` once all 4 checkboxes pass, OR list which step failed and paste the relevant error excerpt so the planner can issue a revision.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CI runner -> Supabase test project | service_role key crosses the boundary via GH Secrets; bypasses RLS for fixture seed |
| index.html browser context -> Supabase test project | anon key in client; respects RLS; same model as prod |
| Test code repo (public) -> CI secrets | secrets must never appear in logs, code, screenshots, or test artifacts |
| Local developer machine -> Supabase test project | developer also holds the 5 env vars locally; `.env.test` gitignored |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Information Disclosure | SUPABASE_SERVICE_KEY in CI logs | mitigate | GH Actions masks secrets in stdout automatically; Task 4 forbids any console.log of headers/keys (grep gate); `.env.test` in .gitignore (Task 1); doc Task 3 calls out "service_role key MAY NEVER appear in index.html or be echoed in CI output" |
| T-01-02 | Tampering | Test data contaminating prod Supabase project | mitigate | Dedicated `gestione-affitti-test` Supabase project (separate URL, separate keys); fixture uses `SUPABASE_TEST_URL` env, never the prod URL; checkpoint 3b smoke test confirms isolation before any test runs |
| T-01-03 | Spoofing | A PR from a fork triggers the workflow and exfiltrates GH Secrets | mitigate | Workflow trigger is `push` to `master` only, NOT `pull_request`. Forks cannot push to master. `workflow_dispatch` is repo-collaborator-only by default. Documented in Task 9 |
| T-01-04 | Denial of Service | Supabase free-tier rate limit on seed fixtures | mitigate | `workers: 1` in playwright.config.ts (Task 2); `beforeAll` per spec file, not `beforeEach` (RESEARCH §Anti-Patterns); 8 LIVE tests at 1 seed call per fixture activation = well under free-tier limits |
| T-01-05 | Information Disclosure | Test user real email used as TEST_EMAIL collects spam | accept | Doc Task 3 recommends `test@gestione-affitti.local` (non-routable .local TLD); user can use any throwaway. Low impact, no PII |
| T-01-06 | Tampering | Test artifacts (screenshots, video, trace) leak test user credentials into public CI logs | mitigate | TEST_PASSWORD is filled into form via `page.fill` — Playwright auto-masks password inputs in screenshots; video/trace captures the keystrokes but artifacts are only uploaded on failure (`if: failure()`) AND retention is 7 days AND artifact downloads require repo-collaborator access. Disposition: mitigated to acceptable level given family-tier and test-project isolation (T-01-02 means even leaked creds only access test data) |
| T-01-07 | Elevation of Privilege | Malicious workflow edit on master adds a step that exfiltrates secrets | accept | Family-tier 1-3 trusted users (DEC-023); no untrusted contributors. Branch protection (configured in Task 3 setup doc) provides defense in depth. Not worth more controls at this scale |
| T-01-08 | Repudiation | Cannot prove which user pushed a failing test masking a real regression | accept | GH commit signature already records actor; family-tier (CON-006) — no further audit needed |
</threat_model>

<verification>
This phase succeeds when all four ROADMAP Phase 1 success criteria are demonstrably true.

**SC-1: Push to master triggers Playwright suite in GitHub Actions; failing test blocks deploy**
- Verified by checkpoint 11 step B (deliberate-failure branch test + recovery)
- Frontmatter `key_links` ties `playwright.yml` -> Pages deploy via `needs: test` OR branch-protection required check
- Task 9 verify branches by DEPLOY_MODE: either `grep needs: test` (github-actions) OR `gh api .../required_status_checks` lists `Playwright Tests` (deploy-from-branch). 404 from gh api is a FAIL, not a silent pass.

**SC-2: All 5 LOCKED regression tests (CON-017) run on every push and pass against current master**
- 5 tests exist: REGRESSION-01, -02, -05 in `tests/calendario.spec.ts`; REGRESSION-03 in `tests/sw.spec.ts`; REGRESSION-04 in `tests/login.spec.ts`
- All 5 are LIVE (not skipped)
- `npx playwright test --list | grep -cE "REGRESSION-0[1-5]"` returns 5
- Checkpoint 11 step C explicitly confirms this count
- All 5 PASS against current index.html (verified in checkpoint 11 step A)

**SC-3: Suite covers the 5 critical paths (login, crea proprieta, segna incasso, elimina + ripristina cestino, offline write + sync)**
- CRITICAL-01 (login) LIVE in `tests/login.spec.ts`
- CRITICAL-02 (segna incasso) LIVE in `tests/calendario.spec.ts`
- CRITICAL-03 (crea proprieta) LIVE in `tests/calendario.spec.ts`
- CRITICAL-04 (cestino) scaffolded as `test.skip` with PR1 TODO (REQ-SAFE-01/02) — coverage exists as a skipped test that will activate
- CRITICAL-05 (offline sync) scaffolded as `test.skip` with PR2b TODO (REQ-SYNC-01) — coverage exists as a skipped test that will activate
- Per RESEARCH §CRITICAL-04/05 + CON-017 critical-paths gating model: "covers" includes scaffolded skipped tests that the unblocking PR converts to LIVE in a one-character edit

**SC-4: Dedicated test user with mock data exists in a Supabase test project and is used by CI**
- Manual: checkpoint 3b verifies test project + test user provisioned + 5 GH Secrets set
- Code: `tests/fixtures.ts` reads all 5 env vars + seeds `dati_utente.blob_json` for TEST_USER_ID via service_role
- CI: `.github/workflows/playwright.yml` injects all 5 secrets into the test job env
- End-to-end: checkpoint 11 step A confirms the green local run, which only works if the seed succeeded

Additional invariants:
- CON-001 preserved: `git diff index.html` empty after Task 1 (verified) and no other task touches index.html
- CON-002 preserved: Playwright lives in devDeps; the app bundle in index.html is unchanged
- DEC-011 satisfied: Playwright suite in GitHub Actions CI; manual + automated triggers; deploy gating documented
</verification>

<success_criteria>
- [ ] 8 LIVE tests pass against current `index.html` (CRITICAL-01, REGRESSION-04, REGRESSION-01, REGRESSION-02, REGRESSION-05, REGRESSION-03, CRITICAL-02, CRITICAL-03)
- [ ] 2 tests show as `skipped` (CRITICAL-04, CRITICAL-05) with explicit PR-pinned TODOs
- [ ] `npx playwright test --list | grep -cE "REGRESSION-0[1-5]"` returns exactly 5
- [ ] Push to master triggers `Playwright Tests` workflow
- [ ] Red workflow run blocks the GitHub Pages deploy (verified on a test branch with deliberate failure)
- [ ] Green workflow run unblocks the deploy
- [ ] On failure, `playwright-report/` and `test-results/` are uploaded as workflow artifact (retention 7d)
- [ ] `index.html` byte-identical to pre-phase (`git diff` empty)
- [ ] `node_modules/`, `playwright-report/`, `test-results/`, `.env.test` all gitignored
- [ ] `SUPABASE_SERVICE_KEY` appears in zero locations other than: GH Secrets, `tests/fixtures.ts` (env read only), `.github/workflows/playwright.yml` (env injection only). Grep gate: `grep -rn "service_role\\|SERVICE_KEY" --exclude-dir=node_modules --exclude-dir=.git . | grep -v "^Binary"` returns only the three expected files + the setup doc.
- [ ] README "Test suite" section exists and documents local run + CI gating contract in Italian (CON-004)
- [ ] All 5 GH Secrets configured (verified via checkpoint 3b smoke test)
- [ ] Supabase test project provisioned with `dati_utente` table + RLS policy + test user (verified via checkpoint 3b)
</success_criteria>

<output>
After completion, create `.planning/phases/01-pr5-test-infrastructure/01-01-SUMMARY.md` recording:
- Final test count: 8 LIVE + 2 skipped
- The 5 GH Secrets that were set (names only, never values)
- Which deploy-gate path was chosen (branch-protection vs needs: test) per checkpoint 3b answer
- Any selector adjustments made during checkpoint 11 vs. RESEARCH §A3 prediction
- Open follow-ups for PR1 (convert CRITICAL-04 + REGRESSION-04 custom modal) and PR2a (evolve REGRESSION-03 stale-SW assertion) and PR2b (convert CRITICAL-05)
- Confirmation that `index.html` is byte-identical pre/post phase (CON-001 invariant)
</output>
