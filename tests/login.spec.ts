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

    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.status-dot')).toBeVisible();
    await expect(page.locator('text=Appartamento Test Via Roma')).toBeVisible();
  });

  test('REGRESSION-04: importo=0 al salvataggio mostra confirm soft (CON-017 #4)', async ({ page, seedData }) => {
    await doLogin(page);

    await page.click('button:has-text("Impostazioni")');

    // Apri il form di modifica della prop-test-001
    await page
      .locator('tr,div')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .locator('button')
      .filter({ hasText: /[Mm]odifica/ })
      .first()
      .click();

    // Imposta importo a 0 — Pitfall 2: register dialog handler PRIMA del click su Salva
    let confirmShown = false;
    page.on('dialog', async (d) => {
      confirmShown = true;
      await d.dismiss();
    });

    await page.locator('input[type="number"]').first().fill('0');
    await page.click('button:has-text("Salva")');

    await expect.poll(() => confirmShown, { timeout: 5_000 }).toBe(true);
  });
});
