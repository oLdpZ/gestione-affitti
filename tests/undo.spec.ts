// tests/undo.spec.ts — PR1 UNDO-01: delete incasso -> click Annulla -> incasso torna.
// REQ-SAFE-03 (undo toast).

import { test, expect, doLogin } from './fixtures';

test.describe('UNDO toast (5s, stack model)', () => {
  test('UNDO-01: delete incasso -> undo toast visible -> Annulla -> incasso ricompare', async ({ page, seedData }) => {
    await doLogin(page);

    // 1. Genera l'incasso del mese (calendario, button "+ Genera incassi mancanti" applica il template prop-test-001).
    // MOCK_DATI parte con incassiAffitti: [] ma generaIncassiAttesi gira a load.
    // Apri il Calendario e individua l'incasso di Appartamento Test Via Roma.
    await page.click('button:has-text("Calendario")');
    const calendarCard = page
      .locator('[data-testid="calendar-card"]')
      .filter({ hasText: 'Appartamento Test Via Roma' });
    await expect(calendarCard.first()).toBeVisible();

    // 2. Apri il modal di modifica dell'incasso e usa il bottone elimina (X) dalla lista.
    // Piu robusto: vai alla Dashboard, l'incasso del mese e' nella tabella.
    await page.click('button:has-text("Dashboard")');
    const row = page
      .locator('tr')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .first();
    await expect(row).toBeVisible();
    const deleteBtn = row.locator('button[title="Elimina"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // 3. Undo toast appare entro 500ms.
    const toast = page.locator('[data-testid="undo-toast"]');
    await expect(toast).toBeVisible({ timeout: 1_500 });
    await expect(toast).toContainText('eliminato');

    // 4. Click Annulla -> toast scompare.
    await page.locator('[data-testid="undo-button"]').click();
    await expect(toast).not.toBeVisible({ timeout: 1_000 });

    // 5. La riga incasso e' tornata.
    await expect(row).toBeVisible();
  });
});
