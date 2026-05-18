// tests/login.spec.ts — CRITICAL-01 + REGRESSION-04 (LIVE).
// TODO(PR1): quando REQ-SAFE-06 sostituira' il browser confirm() con un
// modal custom, REGRESSION-04 dovra' asserire sul modal DOM invece che
// su page.on('dialog'), e doLogin/seedData restano invariati.

import { test, expect, doLogin, TEST_CREDENTIALS } from './fixtures';

test.describe('login', () => {
  test('CRITICAL-01: login + data load', async ({ page, seedData }) => {
    await page.goto('/');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD!);
    await page.click('button[type="submit"]');

    // 'Dashboard' compare in 3 punti (2 button nav + 1 h2). Heading per evitare strict.
    await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible({
      timeout: 15_000,
    });
    // Status dot esiste due volte (desktop + sm:hidden mobile). first() per non strict.
    await expect(page.locator('[data-testid="status-dot"]').first()).toBeVisible();
    await expect(page.locator('text=Appartamento Test Via Roma').first()).toBeVisible();
  });

  test('REGRESSION-04: importo=0 al salvataggio mostra confirm soft (CON-017 #4)', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Impostazioni")');

    // Scope alla sezione Proprieta: data-testid="prop-section" (PR0 redesign).
    const propSection = page.locator('[data-testid="prop-section"]');

    // Riga proprieta -> bottone Modifica (apre form sopra la tabella).
    await propSection
      .locator('tr')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .locator('button:has-text("Modifica")')
      .click();

    // Form panel: data-testid="prop-form" (PR0 redesign).
    const propForm = propSection.locator('[data-testid="prop-form"]');
    await expect(propForm).toBeVisible();

    // Pitfall 2: register dialog handler PRIMA di Salva.
    let confirmShown = false;
    page.on('dialog', async (d) => {
      confirmShown = true;
      await d.dismiss();
    });

    await propForm.locator('input[type="number"]').fill('0');
    await propForm.locator('button:has-text("Salva")').click();

    await expect.poll(() => confirmShown, { timeout: 5_000 }).toBe(true);
  });
});
