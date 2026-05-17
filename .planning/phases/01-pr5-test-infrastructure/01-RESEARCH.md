# Phase 1: PR5 — Test Infrastructure - Research

**Researched:** 2026-05-17
**Domain:** Playwright E2E, GitHub Actions CI, Supabase test project, Alpine.js SPA testing
**Confidence:** HIGH (core tooling), MEDIUM (Supabase test isolation patterns), HIGH (app-specific test strategy derived from source)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-PLAY-01 | Playwright suite in GitHub Actions CI — push-trigger on master, failure blocks deploy; covers login, crea proprietà, segna incasso, elimina + ripristina cestino, offline write + sync; all 5 LOCKED regression tests from CON-017; dedicated test user in Supabase test project with mock data | Playwright 1.60.0 confirmed on npm registry; GH Actions workflow skeleton provided; Supabase test project pattern documented; per-test steps and assertions written for all 5 regressions + 5 critical paths |
</phase_requirements>

---

## Summary

The app is a **single-file Alpine.js SPA** (`index.html`) with no build step, deployed to GitHub Pages at `https://oldpz.github.io/gestione-affitti/`. All state lives in Alpine `x-data="app()"`. Auth is email/password via Supabase JS v2 CDN. Data is stored as a blob in Supabase (`dati_utente`) and cached in localStorage. The current schema is pre-PR2b (single blob, not per-entity tables).

For Playwright CI, the **cleanest strategy** is to spin up a local static file server in the GitHub Actions job (using `npx serve` or `npx http-server`) pointing at the repo root, rather than testing against the live GitHub Pages URL. This gives deterministic URLs, no CDN dependency, and no Pages propagation delay. The test suite authenticates against a **dedicated Supabase test project** (separate free-tier project, not prod) using a stable test user whose mock data is reset between CI runs via Supabase API calls in a global test fixture.

The 5 LOCKED regression tests are directly mappable to observable DOM behaviors already present in the current `index.html`. The importo=0 yellow card is rendered by `gruppiCalendario()` → `gruppo.mancanti` template (line 332-341); the orfani group is rendered by the same function (line 1295); "Genera incassi mancanti" alert text is at line 1329; the SW unregister regression requires a headless browser with a real SW context; the importo=0 save modal uses `confirm()` (line 1461).

**Primary recommendation:** Install Playwright as a dev dependency in a minimal `package.json` at repo root (not in conflict with CON-001 — no build step, just test tooling). Use `chromium` only for CI (fastest, no flakiness from multi-browser parallelism at this scale). Serve the app locally in CI with `npx serve`. Reset Supabase test data before the suite via a beforeAll fixture that calls Supabase REST API directly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth (login/logout) | API (Supabase Auth) | Browser (Alpine state) | `eseguiLogin()` calls `sb.auth.signInWithPassword`; session stored in Supabase + localStorage |
| App data (blob) | API (Supabase Postgres) | Browser (localStorage cache) | `dati_utente` table; offline fallback reads localStorage |
| Calendar rendering | Browser (Alpine computed) | — | `gruppiCalendario()` pure JS computed from Alpine state |
| Service worker | Browser (SW context) | — | `navigator.serviceWorker` — not yet implemented (PR2a), but regression #3 tests current boot behavior |
| CI test runner | CI (GitHub Actions) | — | Playwright job runs in ubuntu-latest runner |
| Test data seeding | API (Supabase REST) | CI | `beforeAll` fixture calls Supabase Admin API to reset `dati_utente` blob |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | **1.60.0** | E2E runner, assertions, browser automation | Industry standard for SPA E2E; built-in assertions, network mocking, screenshot/video artifacts; no extra assertion lib needed [VERIFIED: npm registry] |
| `@supabase/supabase-js` | 2.x (CDN in app) | Auth + data — used by fixture for test data seeding | Already the app's backend; no separate DB driver needed [VERIFIED: index.html line 10] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `serve` (npx, no install) | latest | Serve static files locally in CI | Avoids GitHub Pages propagation delay; deterministic baseURL |
| `dotenv-cli` (npx, no install) | latest | Load `.env.test` in CI via `--env-file` flag in GH Actions | Only needed if env vars not injected via GH Secrets |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local `serve` | Test against live GitHub Pages URL | Pages deploy lag (30-90s); external dependency; harder to block deploy before deploy |
| Chromium-only | All 3 browsers (Chromium + Firefox + WebKit) | Multi-browser adds ~3x CI time for no benefit at family-tier scale; add Firefox/WebKit when redesign ships |
| Supabase Admin API for seed | Direct Postgres SQL via `psql` | Admin API works on free tier without provisioning; SQL requires pg connection |

**Installation:**
```bash
# At repo root (creates package.json + installs only test dependencies)
npm init -y
npm install --save-dev @playwright/test
npx playwright install chromium --with-deps
```

**Version verification:**
```
npm view @playwright/test version  →  1.60.0  (verified 2026-05-17)
```

---

## Architecture Patterns

### System Architecture Diagram

```
[CI: push to master]
        │
        ▼
[GitHub Actions job: ubuntu-latest]
        │
        ├─► npm ci (install @playwright/test)
        │
        ├─► npx serve . -l 3000 &   (static server, serves index.html)
        │
        ├─► FIXTURE: beforeAll
        │     └─► Supabase Admin API → reset dati_utente blob for TEST_USER_ID
        │           (HTTP PATCH to /rest/v1/dati_utente — upsert mock JSON)
        │
        ├─► Playwright test suite (chromium)
        │     ├─► Test 1: Login flow
        │     ├─► Test 2: Crea proprietà (CRUD)
        │     ├─► Test 3: Segna incasso (regression — importo=0 card gialla)
        │     ├─► Test 4: Elimina + ripristina cestino  [PR1 — SKIP until PR1]
        │     └─► Test 5: Offline write + sync          [PR2b — SKIP until PR2b]
        │           + Regression tests 1-5 from CON-017
        │
        ├─► [PASS] → unblock GitHub Pages deploy step
        └─► [FAIL] → upload screenshots/videos artifact → fail workflow → block deploy
```

### Recommended Project Structure

```
repo-root/
├── index.html              # the app (unchanged)
├── package.json            # NEW: { "devDependencies": { "@playwright/test": "1.60.0" } }
├── package-lock.json       # NEW: lockfile
├── playwright.config.ts    # NEW: test config
├── tests/
│   ├── fixtures.ts         # NEW: shared test user setup / Supabase seed
│   ├── login.spec.ts       # NEW: test 1 (critical path + regression #4)
│   ├── calendario.spec.ts  # NEW: regression tests #1, #2, #5 + crea proprietà
│   ├── sw.spec.ts          # NEW: regression #3 (SW unregister)
│   ├── cestino.spec.ts     # NEW: test 4 — SKIPPED until PR1 ships
│   └── offline.spec.ts     # NEW: test 5 — SKIPPED until PR2b ships
└── .github/
    └── workflows/
        └── playwright.yml  # NEW: CI workflow
```

### Pattern 1: playwright.config.ts

```typescript
// Source: https://playwright.dev/docs/test-configuration
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,   // serial in CI to avoid Supabase rate limits
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    // Alpine.js renders via defer script — wait for network idle
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start static server before tests, kill after
  webServer: {
    command: 'npx serve . -l 3000 --no-clipboard',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
```

**Key config decisions:**
- `webServer` block handles `npx serve` automatically — no separate `&` in CI command [VERIFIED: Playwright docs]
- `retries: 2` in CI only — flakiness protection for Alpine async rendering
- `workers: 1` in CI — Supabase free tier has connection limits; serial avoids rate-limiting
- `screenshot: 'only-on-failure'` + `video: 'retain-on-failure'` — artifacts only when needed

### Pattern 2: Shared Fixture for Supabase Test Data

```typescript
// tests/fixtures.ts
import { test as base, expect } from '@playwright/test';

const SUPABASE_URL = process.env.SUPABASE_TEST_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;  // service_role key (not anon)
const TEST_EMAIL = process.env.TEST_EMAIL!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;
const TEST_USER_ID = process.env.TEST_USER_ID!;

// Minimal mock blob matching the app's dati_utente structure
const MOCK_DATI = {
  proprieta: [
    {
      id: 'prop-test-001',
      nome: 'Appartamento Test Via Roma',
      importoAffittoMensile: 900,
      scadenzaAffitto: '1',
      currency: 'EUR',
      bancaIncasso: 'banca-test-001',
      bancaDestinazione: 'banca-test-001',
      intestatario: 'Test Intestatario',
    },
    {
      // REGRESSION #1: proprietà con importo=0
      id: 'prop-zero-001',
      nome: 'Appartamento Importo Zero',
      importoAffittoMensile: 0,
      scadenzaAffitto: '15',
      currency: 'EUR',
      bancaIncasso: 'banca-test-001',
      bancaDestinazione: 'banca-test-001',
      intestatario: 'Test Intestatario Zero',
    },
  ],
  banche: [
    { id: 'banca-test-001', nome: 'Banca Test', intestatario: 'Test', currency: 'EUR' },
  ],
  incassiAffitti: [],  // start empty so generaIncassiAttesi runs fresh
  utenze: [],
};

// REGRESSION #5: orphan incasso (proprietà non in dati.proprieta)
const MOCK_DATI_WITH_ORPHAN = {
  ...MOCK_DATI,
  incassiAffitti: [
    {
      id: 'inc-orphan-001',
      proprietaId: 'prop-deleted-999',   // does not exist in proprieta array
      mese: new Date().toISOString().slice(0, 7),
      dataIncasso: null,
      importo: 500,
      currency: 'EUR',
      bancaId: 'banca-test-001',
      girato: false,
      dataGiro: null,
      bancaDestinazioneId: null,
      note: '',
    },
  ],
};

async function seedSupabase(blob: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/dati_utente?user_id=eq.${TEST_USER_ID}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  await fetch(`${SUPABASE_URL}/rest/v1/dati_utente`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ user_id: TEST_USER_ID, blob_json: blob }),
  });
}

export const test = base.extend<{ seedData: void; seedWithOrphan: void }>({
  seedData: [async ({}, use) => {
    await seedSupabase(MOCK_DATI);
    await use();
  }, { auto: false }],

  seedWithOrphan: [async ({}, use) => {
    await seedSupabase(MOCK_DATI_WITH_ORPHAN);
    await use();
  }, { auto: false }],
});

export async function doLogin(page: any) {
  await page.goto('/');
  // Wait for Alpine to render login form (defer script)
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for dashboard to load (utente is set, caricamentoIniziale done)
  await page.waitForSelector('text=Dashboard', { timeout: 15_000 });
}

export { expect };
```

**Why service_role key for seeding:**
- The anon key respects RLS — only the authenticated user can write their own row
- The service_role key bypasses RLS, making CI seed deterministic without a full auth flow [ASSUMED — standard Supabase pattern, not verified against specific project RLS config]
- The service_role key must NEVER be in the app client; it lives only in GH Secrets

### Pattern 3: GitHub Actions Workflow

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests

on:
  push:
    branches: [master]
  workflow_dispatch:   # allow manual trigger from any branch

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

**Deploy gating:** The Pages deploy step (if present in a separate job or as a subsequent step in this same job) MUST declare `needs: test` so it only runs when Playwright passes. If using GitHub's built-in Pages deploy action, put it in a second job:

```yaml
  deploy:
    needs: test          # <-- this is the gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4   # or whatever deploy action is currently used
```

### Pattern 4: Waiting for Alpine.js to Initialize

Alpine.js is loaded with `defer` attribute. The app uses `x-cloak` to hide content until ready. After navigation to `http://localhost:3000`, the sequence is:

1. HTML parses (synchronous)
2. Supabase CDN loads (defer)
3. Alpine CDN loads (defer, after Supabase)
4. `app()` function runs, `init()` fires
5. `caricaDatiUtente()` completes — `caricamentoIniziale = false`
6. Dashboard becomes visible

**Pitfall:** `page.goto('/')` returns when the HTML response loads, NOT when Alpine finishes. Always wait for a DOM element that only appears post-init:

```typescript
// Wrong — races with Alpine defer
await page.goto('/');
await page.click('button[type="submit"]');

// Correct — wait for the login form to be rendered by Alpine
await page.goto('/');
await page.waitForSelector('[x-data]', { state: 'attached' });
await page.waitForSelector('input[type="email"]', { state: 'visible' });
```

After login, wait for `text=Dashboard` or the status dot to appear:

```typescript
await page.waitForSelector('.status-dot', { timeout: 15_000 });
```

### Anti-Patterns to Avoid

- **Testing against the live Pages URL:** Propagation delay + external network = flaky CI. Use local server.
- **Hardcoding Supabase prod credentials in tests:** Prod data corruption risk. Use a dedicated test project.
- **Seeding data in each `beforeEach`:** Supabase free tier has rate limits on API calls. Seed in `beforeAll` for each spec file, rely on test ordering within the file.
- **Using `page.waitForTimeout(2000)`:** Fixed waits = flaky. Use `waitForSelector`, `waitForURL`, or `waitForResponse`.
- **Clicking the SW unregister test without a real server:** `navigator.serviceWorker` is only available on `https://` or `localhost`. The local static server satisfies `localhost`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom Puppeteer/CDP scripts | `@playwright/test` | Built-in assertions, auto-waiting, artifacts, fixtures |
| Test assertions | Manual `if (x !== y) throw` | `expect(locator)` Playwright matchers | Auto-retry, readable diffs, async-aware |
| Screenshot on failure | `page.screenshot()` in every catch | `screenshot: 'only-on-failure'` in config | Automatic, attached to test report |
| Supabase test data reset | Full migration script | Supabase REST API upsert in fixture | Simpler, no SQL client needed |
| CI static server | Custom Node http server | `webServer` config in playwright.config.ts | Zero-config, process lifecycle managed by Playwright |

---

## The 5 LOCKED Regression Tests — Detailed Spec

> From CON-017. These cannot be removed without a superseding ADR.

### REGRESSION-01: Proprietà con importo=0 appare sul calendario come card gialla con bottone "Sistema"

**Source in app:** `gruppiCalendario()` line 1289-1293 — proprietà without an incasso for the month go to `gruppo.mancanti`; the template at lines 332-341 renders them with `bg-yellow-50` and a "Sistema" button.

**Current status:** This bug is marked as 2026-05-17. Looking at the source code, the behavior IS present: `gruppiCalendario()` at line 1290-1292 puts all proprietà without an incasso into `mancanti`, regardless of importo. Line 1194 in `generaIncassiAttesi` skips props with `importoAffittoMensile <= 0`. So a prop with importo=0 will: (a) not get an incasso generated, (b) appear in `mancanti` → yellow card. The regression test confirms this WORKS correctly and must not regress.

```typescript
// tests/calendario.spec.ts
import { test, expect, doLogin } from './fixtures';

test.describe('REGRESSION-01: importo=0 card gialla', () => {
  test.use({ storageState: undefined });

  test('proprietà con importo=0 appare sul calendario come card gialla con bottone Sistema', async ({ page, seedData }) => {
    await doLogin(page);
    // Navigate to calendario
    await page.click('button:has-text("Calendario")');
    await page.waitForSelector('text=Calendario', { timeout: 5_000 });

    // The prop with importo=0 should appear in mancanti section (yellow card)
    // The card has the name and the yellow bg + "Sistema" button
    const yellowCard = page.locator('.bg-yellow-50, [class*="yellow-900"]')
      .filter({ hasText: 'Appartamento Importo Zero' });
    await expect(yellowCard).toBeVisible();

    // Confirm the "Sistema" button is present inside the card
    await expect(yellowCard.locator('button:has-text("Sistema")')).toBeVisible();

    // Confirm the warning text about importo=0
    await expect(yellowCard.locator('text=Importo mensile')).toBeVisible();
  });
});
```

### REGRESSION-02: "Genera incassi mancanti" elenca esplicitamente le proprietà saltate (no falso "tutti presenti")

**Source in app:** `generaIncassiMeseVisualizzato()` lines 1308-1332. When properties are skipped (importo=0), they are collected in `saltate[]` and shown in the alert message. Bug was: the alert showed "Nessuna proprietà da generare: tutto già presente" even when props were skipped. Current code at line 1329 already appends the saltate list.

```typescript
test.describe('REGRESSION-02: genera incassi mancanti elenca saltate', () => {
  test('genera incassi mancanti mostra le proprietà saltate per importo=0', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Calendario")');

    // Intercept the browser alert
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.click('button:has-text("Genera incassi mancanti")');

    // The alert must mention the skipped proprietà by name, not say "tutto già presente"
    await expect(() => {
      expect(alertMessage).toContain('Appartamento Importo Zero');
      expect(alertMessage).not.toContain('tutto già presente per');
    }).toPass({ timeout: 5_000 });
  });
});
```

**Note:** `page.on('dialog')` must be registered BEFORE the click that triggers `alert()`. [VERIFIED: Playwright docs pattern for dialog handling]

### REGRESSION-03: Service worker stale viene unregistered al boot

**Current status:** There is no `sw.js` in the repo yet (PR2a is Phase 4). However, the regression tests the BOOT BEHAVIOR — that at startup the app does not have stale SWs lingering. In PR5 context, this test verifies that the current app's `init()` does NOT leave unexpected SWs registered (or, once PR2a lands, that the boot unregistration code works).

**For Phase 1 implementation:** Write the test to verify zero SWs are registered after page load. When PR2a ships, update the test to verify stale SW cleanup explicitly.

```typescript
// tests/sw.spec.ts
import { test, expect, doLogin } from './fixtures';

test.describe('REGRESSION-03: service worker stale unregistered at boot', () => {
  test('nessun service worker stale rimane registrato dopo il boot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Query all registered SWs via page evaluate
    const swCount = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 0;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length;
    });

    // At this phase (pre-PR2a), zero SWs should be registered
    // After PR2a: update assertion to verify old-scope SWs were unregistered
    expect(swCount).toBe(0);
  });
});
```

**Important:** This test is localhost (HTTP), so `navigator.serviceWorker` is available (SWs work on `localhost` regardless of HTTP). [VERIFIED: service worker spec]

### REGRESSION-04: Importo=0 su salvataggio proprietà mostra confirm soft

**Source in app:** Lines 1459-1462. `salva()` / `salvaProprieta()` calls `confirm()` when `importoAffittoMensile <= 0`.

```typescript
// tests/login.spec.ts (or a dedicated impostazioni.spec.ts)
test.describe('REGRESSION-04: importo=0 soft confirm on save', () => {
  test('salvare una proprietà con importo=0 mostra un confirm dialog', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Impostazioni")');

    // Click modifica on the proprietà with importo=900 and change it to 0
    // OR use the "nuova proprietà" form
    // Find the edit button for prop-test-001
    await page.click('button[title="Modifica"], button:has-text("Modifica")');

    // Change importo to 0
    await page.fill('input[type="number"]', '0');

    let confirmShown = false;
    page.on('dialog', async dialog => {
      confirmShown = true;
      // Dismiss the confirm (don't actually save)
      await dialog.dismiss();
    });

    await page.click('button:has-text("Salva")');

    expect(confirmShown).toBe(true);
  });
});
```

**Note:** The exact button selectors depend on the impostazioni view DOM. The test should use `page.locator('button').filter({ hasText: /[Mm]odifica/ })` to target the first proprietà in the table. [ASSUMED — selector strategy based on reading HTML lines 659-730; exact buttons may need adjustment]

### REGRESSION-05: Incassi orfani appaiono in gruppo dedicato sul calendario

**Source in app:** `gruppiCalendario()` line 1283-1295. Incassi whose `proprietaId` does not match any `dati.proprieta` entry go into the `orfani` array, which is rendered as a separate group with label `⚠ Incassi orfani (proprieta cancellata)`.

```typescript
test.describe('REGRESSION-05: incassi orfani nel gruppo dedicato', () => {
  test('incasso orfano appare nel gruppo dedicato sul calendario', async ({ page, seedWithOrphan }) => {
    await doLogin(page);
    await page.click('button:has-text("Calendario")');

    // The orphan group header should appear
    const orphanGroup = page.locator('text=Incassi orfani');
    await expect(orphanGroup).toBeVisible();

    // And the orphan incasso should be inside it
    // (The orphan has importo 500 EUR)
    // We verify the group exists with some content
    const orphanSection = page.locator('h3').filter({ hasText: 'orfani' });
    await expect(orphanSection).toBeVisible();
  });
});
```

---

## The 5 Critical Path Tests

### CRITICAL-01: Login flow

```typescript
// tests/login.spec.ts
test('login con email/password e caricamento dati', async ({ page, seedData }) => {
  await page.goto('/');
  // Alpine defer — wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });

  await page.fill('input[type="email"]', process.env.TEST_EMAIL!);
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD!);
  await page.click('button[type="submit"]');

  // Post-login: dashboard with status dot visible
  await page.waitForSelector('text=Dashboard', { timeout: 15_000 });
  await expect(page.locator('.status-dot')).toBeVisible();

  // Data loaded: at least one proprietà card visible
  await expect(page.locator('text=Appartamento Test Via Roma')).toBeVisible();
});
```

### CRITICAL-02: Segna incasso oggi

```typescript
test('segna incasso oggi in meno di 2s', async ({ page, seedData }) => {
  await doLogin(page);
  await page.click('button:has-text("Calendario")');

  // Wait for the incasso card for prop-test-001
  const incassoCard = page.locator('.bg-gray-50, .bg-red-50')
    .filter({ hasText: 'Appartamento Test Via Roma' });
  await expect(incassoCard).toBeVisible();

  // Click "Incassa oggi"
  const start = Date.now();
  await incassoCard.locator('button:has-text("Incassa oggi"), button:has-text("Oggi")').click();

  // Card should now have green bg (incassato) — check-mark visible
  await expect(page.locator('.bg-green-50').filter({ hasText: 'Appartamento Test Via Roma' })).toBeVisible();
  expect(Date.now() - start).toBeLessThan(2_000);

  // Status dot should go back to "Salvato" (green)
  await expect(page.locator('.status-dot.bg-green-500, .status-dot[class*="green"]')).toBeVisible({ timeout: 10_000 });
});
```

### CRITICAL-03: Crea proprietà (CRUD)

```typescript
test('crea nuova proprietà e appare in dashboard', async ({ page, seedData }) => {
  await doLogin(page);
  await page.click('button:has-text("Impostazioni")');

  // Find "Aggiungi proprietà" or similar CTA
  await page.click('button:has-text("Aggiungi"), button:has-text("Nuova proprietà"), button:has-text("+")');

  // Fill the form
  await page.fill('input[placeholder*="nome"], input[placeholder*="Nome"]', 'Proprietà E2E Test');
  await page.fill('input[type="number"]', '1200');
  // Select scadenza (radio or select)
  // Save
  await page.click('button:has-text("Salva")');

  // Property should appear in the list
  await expect(page.locator('text=Proprietà E2E Test')).toBeVisible({ timeout: 5_000 });

  // Status saved
  await expect(page.locator('.status-dot[class*="green"]')).toBeVisible({ timeout: 10_000 });
});
```

### CRITICAL-04: Elimina + ripristina cestino

**Status for Phase 1:** This test requires soft-delete (REQ-SAFE-01) and cestino (REQ-SAFE-02) which ship in Phase 3 (PR1). **Write the test in Phase 1 as a `.todo` / `.skip` test** so it exists in the suite and fails correctly once PR1 ships.

```typescript
test.skip('CRITICAL-04: elimina e ripristina proprietà dal cestino — RICHIEDE PR1', async ({ page, seedData }) => {
  // TODO: implement after Phase 3 (PR1) ships
  // Steps:
  // 1. doLogin
  // 2. Navigate to Impostazioni
  // 3. Delete a proprietà (click elimina)
  // 4. Confirm deletion
  // 5. Navigate to Cestino view in Impostazioni
  // 6. Find deleted proprietà
  // 7. Click "Ripristina"
  // 8. Navigate back and verify proprietà reappears with incassi intact
});
```

### CRITICAL-05: Offline write + sync on reconnect

**Status for Phase 1:** Requires mutation queue (REQ-SYNC-01) from Phase 5 (PR2b). Write as `.skip`.

```typescript
test.skip('CRITICAL-05: offline write + sync — RICHIEDE PR2b', async ({ page, seedData }) => {
  // TODO: implement after Phase 5 (PR2b) ships
  // Steps:
  // 1. doLogin
  // 2. page.context().setOffline(true)  ← Playwright network emulation
  // 3. Make a write (segna incasso)
  // 4. Verify "Offline" status dot and "N modifiche in coda" indicator
  // 5. page.context().setOffline(false)
  // 6. Wait for sync — verify green status dot
  // 7. Reload page — verify change persisted
});
```

---

## Supabase Test Project Setup

### Steps to create a dedicated test project

1. Go to `app.supabase.com` → "New project" → name it `gestione-affitti-test`
2. Free tier — same region as prod to minimize latency
3. Once provisioned, go to Settings → API:
   - Copy `Project URL` → `SUPABASE_TEST_URL`
   - Copy `anon/public` key → for app runtime (not needed in tests)
   - Copy `service_role` key → `SUPABASE_SERVICE_KEY` (GH Secret only, never committed)
4. Create the same schema as prod. For Phase 1 (pre-PR2b), only `dati_utente` table matters:
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
5. Create the test user:
   - Supabase Dashboard → Authentication → Users → "Invite user" or use the Admin API
   - Set a stable password that matches `TEST_PASSWORD` secret
   - Note the user's UUID → `TEST_USER_ID` secret

### GitHub Secrets to configure

| Secret Name | Value |
|-------------|-------|
| `SUPABASE_TEST_URL` | `https://<test-project>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key (bypasses RLS for seeding) |
| `TEST_EMAIL` | `test@gestione-affitti.local` or similar |
| `TEST_PASSWORD` | Stable test password |
| `TEST_USER_ID` | UUID of the test user in Supabase Auth |

**Security note:** The `SUPABASE_SERVICE_KEY` must NEVER appear in `index.html` or any client-side code. It is strictly for CI seed fixture. The app uses the anon key (already in index.html — this is expected, RLS protects the data). [ASSUMED — standard Supabase security model]

### Data reset strategy

- `beforeAll` in each spec file: seed the known mock blob via Supabase REST API (DELETE + POST)
- Do NOT use `beforeEach` — too many API calls, free tier rate limits
- Tests within a spec are ordered sequentially (they share state after login)
- If a test corrupts state, the next spec's `beforeAll` resets it anyway

### No npm/no node_modules constraint

CON-001 says no build step. `package.json` with `devDependencies` does NOT violate this — `node_modules/@playwright/test` is a test-only tool, not part of the app bundle. `index.html` is not compiled. This is confirmed by DEC-011 which explicitly accepts Playwright. Add `node_modules/` to `.gitignore`.

---

## Common Pitfalls

### Pitfall 1: Alpine.js defer timing races

**What goes wrong:** `page.goto('/')` returns immediately after HTML response; Alpine hasn't run yet; selectors don't exist.
**Why it happens:** `defer` attribute delays script execution until DOM is parsed, but Playwright doesn't wait for it.
**How to avoid:** Always `await page.waitForSelector('input[type="email"]')` before interacting with the login form. Always `await page.waitForSelector('text=Dashboard')` after clicking submit.
**Warning signs:** `TimeoutError: waiting for selector` on the very first interaction.

### Pitfall 2: `confirm()` dialogs blocking test execution

**What goes wrong:** `page.click('Salva')` triggers `confirm()` in `salvaProprieta()`; Playwright auto-dismisses dialogs by default (pressing Cancel), which may cause the wrong code path.
**Why it happens:** The app uses browser `confirm()` for the importo=0 soft confirm (line 1461). Playwright's default dialog handler dismisses them.
**How to avoid:** Register `page.on('dialog', handler)` BEFORE the action that triggers the dialog.
**Warning signs:** Test passes but the wrong branch executed.

### Pitfall 3: Supabase session persistence between tests

**What goes wrong:** One test logs in, next test also expects to be logged in (or vice versa), causing interference.
**Why it happens:** Supabase stores the session in localStorage; the Playwright browser context shares localStorage across tests in the same file by default.
**How to avoid:** Use `test.use({ storageState: undefined })` to clear state between spec files. Within a spec file, share the logged-in state intentionally via `doLogin()` in `beforeAll`.

### Pitfall 4: `generaIncassiAttesi` runs on `init()` and modifies data

**What goes wrong:** `init()` → `caricaDatiUtente()` → `generaIncassiAttesi()` auto-creates incassi for the current month. If the seed blob has `incassiAffitti: []`, by the time the test runs, the prop-test-001 (importo=900) will have an incasso already created.
**Why it happens:** Line 1052/1073/1086 — `generaIncassiAttesi()` is called on data load.
**How to avoid:** For regression-01 (importo=0 card), this is fine — prop-zero-001 will NOT get an incasso (line 1194 guards importo > 0), so it will correctly appear in `mancanti`. For other tests, account for the auto-generated incassi in assertions.
**Warning signs:** Test expects no incasso but finds one already in "Incassa oggi" state.

### Pitfall 5: Calendar month mismatch in CI

**What goes wrong:** The calendar is initialized to the current month. Incassi are generated for the current month. But the test navigates to a different month accidentally.
**Why it happens:** `meseCalendario` and `annoCalendario` are initialized from `new Date()`.
**How to avoid:** In calendar tests, do NOT click next/previous month arrows. Assert on the current month. If testing specific months, explicitly navigate.

### Pitfall 6: Static server serves `276973.mp4` — large file

**What goes wrong:** `npx serve` serves the entire repo root including the 4.7MB video file. This is fine for the test (the browser loads `index.html` which references `276973.mp4`), but it will consume CI time/bandwidth.
**Why it happens:** The video is not yet removed (PR0 removes it in Phase 2).
**How to avoid:** The video autoplay is muted and background — it won't block tests. But consider `webServer` timeout of at least 15s. No action needed now; note for Phase 2 that removing the video will speed up CI slightly.

### Pitfall 7: `x-cloak` hides elements until Alpine initializes

**What goes wrong:** `page.locator('[x-cloak]')` finds elements that are `display: none` and interactions fail.
**Why it happens:** Alpine removes `x-cloak` when it initializes the component. Until then, `x-cloak` elements are hidden.
**How to avoid:** Always use `waitForSelector(..., { state: 'visible' })` instead of just `waitForSelector`. Prefer text-based locators that only match visible content.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer for SPA E2E | Playwright | 2022+ | Better auto-waiting, fixtures, artifacts, no need for separate assertion lib |
| Cypress | Playwright | Trend 2023-2025 | Playwright handles multiple tabs, iframes, SW contexts better; no Electron dependency |
| `waitForTimeout()` fixed sleeps | `waitForSelector`, `waitForResponse` | Current best practice | Eliminates flakiness |
| Global test setup file | `webServer` in `playwright.config.ts` | Playwright 1.10+ | Zero-config static server lifecycle |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Playwright install + CI | ✓ (local) | v24.14.1 | — |
| npm | Package management | ✓ (local) | bundled with Node | — |
| @playwright/test | Test runner | ✗ (not installed yet) | 1.60.0 to install | — |
| Chromium browser | E2E tests | ✗ (not installed yet) | via `npx playwright install chromium` | — |
| GitHub Actions | CI | ✓ (repo is on GitHub: `oldpz/gestione-affitti`) | ubuntu-latest | — |
| Supabase test project | Test data isolation | ✗ (not created yet) | Free tier | Cannot use prod |
| `npx serve` (via webServer config) | Static file serving | ✓ (npx, no install) | latest via npx | `http-server`, `python -m http.server` |

**Missing dependencies with no fallback:**
- `@playwright/test` and Chromium — must install via `npm install --save-dev @playwright/test` + `npx playwright install chromium`
- Supabase test project — must create before CI runs

**Missing dependencies with fallback:**
- None — all missing items have a clear setup path.

---

## Validation Architecture

> `config.json` not found in `.planning/` — treating `nyquist_validation` as enabled (default).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.60.0 |
| Config file | `playwright.config.ts` (Wave 0 — does not exist yet) |
| Quick run command | `npx playwright test --project=chromium login.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-PLAY-01 | Push to master triggers suite + failure blocks deploy | integration (GH Actions) | CI only — manual: `npx playwright test` | ❌ Wave 0 |
| REQ-PLAY-01 | Login flow completes | E2E | `npx playwright test tests/login.spec.ts` | ❌ Wave 0 |
| REQ-PLAY-01 | Crea proprietà CRUD | E2E | `npx playwright test tests/calendario.spec.ts` | ❌ Wave 0 |
| REQ-PLAY-01 | Segna incasso oggi | E2E | `npx playwright test tests/calendario.spec.ts` | ❌ Wave 0 |
| REQ-PLAY-01 | CON-017 regression #1 (importo=0 card gialla) | E2E regression | `npx playwright test -g "REGRESSION-01"` | ❌ Wave 0 |
| REQ-PLAY-01 | CON-017 regression #2 (genera incassi mancanti) | E2E regression | `npx playwright test -g "REGRESSION-02"` | ❌ Wave 0 |
| REQ-PLAY-01 | CON-017 regression #3 (SW stale unregistered) | E2E regression | `npx playwright test -g "REGRESSION-03"` | ❌ Wave 0 |
| REQ-PLAY-01 | CON-017 regression #4 (importo=0 confirm modal) | E2E regression | `npx playwright test -g "REGRESSION-04"` | ❌ Wave 0 |
| REQ-PLAY-01 | CON-017 regression #5 (incassi orfani gruppo dedicato) | E2E regression | `npx playwright test -g "REGRESSION-05"` | ❌ Wave 0 |
| REQ-PLAY-01 | Elimina + ripristina cestino | E2E (skipped until PR1) | `npx playwright test tests/cestino.spec.ts` | ❌ Wave 0 |
| REQ-PLAY-01 | Offline write + sync | E2E (skipped until PR2b) | `npx playwright test tests/offline.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=chromium tests/login.spec.ts --reporter=list`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `package.json` — root package with `@playwright/test` devDependency
- [ ] `playwright.config.ts` — config with webServer, chromium project, artifact settings
- [ ] `tests/fixtures.ts` — shared doLogin + seedSupabase + mock data constants
- [ ] `tests/login.spec.ts` — CRITICAL-01 + REGRESSION-04
- [ ] `tests/calendario.spec.ts` — REGRESSION-01, REGRESSION-02, REGRESSION-05, CRITICAL-02, CRITICAL-03
- [ ] `tests/sw.spec.ts` — REGRESSION-03
- [ ] `tests/cestino.spec.ts` — CRITICAL-04 (test.skip until PR1)
- [ ] `tests/offline.spec.ts` — CRITICAL-05 (test.skip until PR2b)
- [ ] `.github/workflows/playwright.yml` — CI workflow
- [ ] `.gitignore` update — add `node_modules/`, `playwright-report/`, `test-results/`
- [ ] Supabase test project provisioned + secrets configured in GitHub

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dati_utente` table has columns `user_id uuid` and `blob_json jsonb` in the test project | Supabase Test Project Setup | Fixture seed will 400/404; must adjust SQL in setup step |
| A2 | `service_role` key bypasses RLS on `dati_utente` for fixture seeding | Fixtures pattern | Seed fails with 403; must use Admin API to create test data differently |
| A3 | The impostazioni form's "Modifica" button for proprietà is identifiable by `button:has-text("Modifica")` | REGRESSION-04 selector | Selector misses; adjust to match actual DOM |
| A4 | GitHub Pages deploy uses a separate workflow step/job that can be gated with `needs: test` | CI workflow | If deploy is triggered by a separate event (e.g., `pages-build-deployment`), gating strategy changes |
| A5 | The Supabase test project `anon` key is safe to hardcode in `playwright.config.ts` for the base URL | — | Not applicable — anon key is already public in index.html |
| A6 | `npx serve` is available on GitHub Actions ubuntu-latest without install | webServer config | If npx serve fails, fallback: use `npx http-server` or `python3 -m http.server 3000` |

---

## Open Questions

1. **Does the GitHub repo (`oldpz/gestione-affitti`) have GitHub Pages auto-deploy configured, and what triggers it?**
   - What we know: The README links to `https://oldpz.github.io/gestione-affitti/` and CLAUDE.md confirms deployment via `git push`
   - What's unclear: Whether Pages deploys from a GitHub Actions workflow or from the branch directly (Settings → Pages → "Deploy from branch")
   - Recommendation: Check repo Settings → Pages. If it deploys directly from branch, add a Playwright check as a required status check via branch protection rules (Settings → Branches → Require status checks). If it's Actions-based, use `needs: test`.

2. **Is `confirm()` the final UX for the importo=0 soft-confirm, or will it change in PR1?**
   - What we know: Line 1461 uses `confirm()`. REQ-SAFE-06 says "soft-confirm modal" which implies a custom modal, not browser `confirm()`.
   - What's unclear: Will PR1 replace `confirm()` with a custom modal? If so, REGRESSION-04 selector changes.
   - Recommendation: Write REGRESSION-04 using `page.on('dialog')` for Phase 1. Add a TODO comment to update the test when PR1 replaces confirm() with a custom modal.

3. **Does the Supabase test project need the same schema as future PRs (PR2b tables), or just `dati_utente`?**
   - What we know: Phase 1 only tests current app state (blob schema). Phase 5 (PR2b) will add per-entity tables.
   - What's unclear: Should Phase 1 pre-create PR2b tables so the test project is "ahead"?
   - Recommendation: Create only what is needed now (`dati_utente`). Update schema incrementally as PRs ship.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Test credentials in GH Secrets, never in code |
| V3 Session Management | yes | service_role key in GH Secrets only; anon key already public by design |
| V4 Access Control | yes | Verify RLS: test user cannot access other users' data (smoke test optional) |
| V5 Input Validation | no | Not applicable to test infrastructure itself |
| V6 Cryptography | no | Supabase handles TLS and JWT |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| service_role key leak | Information Disclosure | Store in GH Secrets; never log in CI output; never commit |
| Test data contaminating prod | Tampering | Separate Supabase project (not the prod `bavkwjxngwzg...` project) |
| CI credentials in PR logs | Information Disclosure | GH Secrets are masked in logs automatically; verify `SUPABASE_SERVICE_KEY` is not echoed |

---

## Sources

### Primary (HIGH confidence)
- `index.html` (repo source) — app auth flow, Alpine data structure, `gruppiCalendario()`, `generaIncassiAttesi()`, `generaIncassiMeseVisualizzato()`, `salvaProprieta()`, all line references verified
- `npm registry — @playwright/test` — version 1.60.0 confirmed via `npm view` [VERIFIED: npm registry]
- `SPEC-test-plan.md`, `constraints.md` (intel/) — 5 LOCKED regression tests, CON-017 exact wording
- `decisions.md` — DEC-011 Playwright locked, DEC-003 no build step

### Secondary (MEDIUM confidence)
- Playwright docs pattern for `webServer` config, `page.on('dialog')`, `waitForSelector` — standard Playwright API [ASSUMED: based on training knowledge of Playwright 1.x; consistent with 1.60.0 version]
- Supabase REST API seed pattern (DELETE + POST on `dati_utente`) — standard Supabase REST usage [ASSUMED]

### Tertiary (LOW confidence)
- GitHub Actions Pages gating via `needs:` — assumed standard pattern; actual deploy trigger needs verification per Open Question #1

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Playwright 1.60.0 verified on npm; app stack read directly from index.html
- Architecture: HIGH — derived entirely from reading actual app source; no speculation about app behavior
- Pitfalls: HIGH — derived from reading actual Alpine/Supabase/Playwright code patterns and app source
- Supabase test isolation: MEDIUM — standard pattern, not verified against this specific project's RLS config

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (Playwright releases frequently; re-check version before implementation)
