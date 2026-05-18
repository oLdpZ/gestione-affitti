// tests/undo.spec.ts — PR1 UNDO-01: delete incasso -> click Annulla -> incasso torna.
// REQ-SAFE-03 (undo toast).

import { test, expect, doLogin } from './fixtures';

test.describe('UNDO toast (5s, stack model)', () => {
  test('UNDO-01: delete incasso -> undo toast visible -> Annulla -> incasso ricompare', async ({ page, seedData }) => {
    await doLogin(page);

    // Nel Calendario gli incassi del mese sono renderizzati come calendar-card,
    // ciascuno con un button title="Elimina" che invoca eliminaIncasso(inc.id).
    await page.click('button:has-text("Calendario")');
    const card = page
      .locator('[data-testid="calendar-card"]')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .first();
    await expect(card).toBeVisible();

    await card.locator('button[title="Elimina"]').click();

    // Undo toast appare entro 1.5s con il testo "Incasso eliminato".
    const toast = page.locator('[data-testid="undo-toast"]');
    await expect(toast).toBeVisible({ timeout: 1_500 });
    await expect(toast).toContainText('Incasso eliminato');

    // Card sparisce dal calendario (eliminaIncasso ha settato deletedAt).
    await expect(
      page.locator('[data-testid="calendar-card"]').filter({ hasText: 'Appartamento Test Via Roma' }),
    ).toHaveCount(0);

    // Click Annulla -> toast scompare e card ricompare.
    await page.locator('[data-testid="undo-button"]').click();
    await expect(toast).not.toBeVisible({ timeout: 1_000 });
    await expect(
      page.locator('[data-testid="calendar-card"]').filter({ hasText: 'Appartamento Test Via Roma' }).first(),
    ).toBeVisible({ timeout: 2_000 });
  });
});
