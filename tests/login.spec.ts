// tests/login.spec.ts — CRITICAL-01 + REGRESSION-04 (LIVE).
// PR1: REQ-SAFE-06 ha sostituito il browser confirm() per importo=0 con
// il soft-confirm modal Alpine (data-testid="soft-confirm-modal").
// REGRESSION-04 asserisce ora sul modal DOM invece che su page.on('dialog').

import { test, expect, doLogin, TEST_CREDENTIALS } from './fixtures';

test.describe('login', () => {
  test('CRITICAL-01: login + data load', async ({ page, seedData }) => {
    await page.goto('/');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD!);
    await page.click('button[type="submit"]');

    // 'Dashboard' compare in 3 punti (2 button nav + h1 dash-h1 + legacy h2).
    // PR0: scope to level 1 to target the new <h1 class="dash-h1">Dashboard</h1>.
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible({
      timeout: 15_000,
    });
    // Status dot esiste due volte (desktop + sm:hidden mobile). first() per non strict.
    await expect(page.locator('[data-testid="status-dot"]').first()).toBeVisible();
    await expect(page.locator('text=Appartamento Test Via Roma').first()).toBeVisible();
  });

  test('REGRESSION-04: importo=0 al salvataggio mostra soft-confirm modal (CON-017 #4)', async ({ page, seedData }) => {
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

    await propForm.locator('input[inputmode="decimal"]').fill('0');
    await propForm.locator('button:has-text("Salva")').click();

    // PR1: il modal custom rimpiazza il browser confirm(). Asserisce visibilita
    // + che cliccando Annulla il save sia abortito (modal scompare e form resta).
    const modal = page.locator('[data-testid="soft-confirm-modal"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="soft-confirm-cancel"]').click();
    await expect(modal).not.toBeVisible();
    // Save abortito: form ancora aperto.
    await expect(propForm).toBeVisible();
  });
});
