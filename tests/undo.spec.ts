// tests/undo.spec.ts — PR1 UNDO-01: delete incasso -> click Annulla -> incasso torna.
// REQ-SAFE-03 (undo toast).
//
// Nota: dopo eliminaIncasso, la calendar-card della proprieta NON scompare —
// gruppiCalendario sposta la proprieta nel bucket "mancanti" (data-status=
// "sistema") visto che non c'e' piu un incasso attivo per quel mese. Il vero
// indicatore "incasso esiste" sulla card e' la presenza del button title=
// "Elimina" (renderizzato solo per gruppo.incassi, non per gruppo.mancanti).

import { test, expect, doLogin } from './fixtures';

test.describe('UNDO toast (5s, stack model)', () => {
  test('UNDO-01: delete incasso -> undo toast visible -> Annulla -> incasso ricompare', async ({ page, seedData }) => {
    await doLogin(page);

    await page.click('button:has-text("Calendario")');
    await page.getByRole('heading', { level: 2, name: /\d{4}$/ }).waitFor({ timeout: 5_000 });

    const card = page
      .locator('[data-testid="calendar-card"]')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .first();
    await expect(card).toBeVisible();
    // Stato iniziale: card e' nel bucket incassi (ha il button Elimina).
    const deleteBtn = card.locator('button[title="Elimina"]');
    await expect(deleteBtn).toBeVisible();

    await deleteBtn.click();

    // Undo toast appare entro 1.5s con il testo "Incasso eliminato".
    const toast = page.locator('[data-testid="undo-toast"]');
    await expect(toast).toBeVisible({ timeout: 1_500 });
    await expect(toast).toContainText('Incasso eliminato');

    // Card per la proprieta resta visibile (ora come "mancanti": nessun
    // button[title="Elimina"], ma ha il button "Sistema"). Asseriamo sulla
    // SCOMPARSA del button Elimina, non sulla scomparsa della card.
    const cardAfter = page
      .locator('[data-testid="calendar-card"]')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .first();
    await expect(cardAfter.locator('button[title="Elimina"]')).toHaveCount(0, { timeout: 2_000 });

    // Click Annulla -> toast scompare e l'incasso ricompare (button Elimina torna).
    await page.locator('[data-testid="undo-button"]').click();
    await expect(toast).not.toBeVisible({ timeout: 1_000 });
    await expect(cardAfter.locator('button[title="Elimina"]')).toBeVisible({ timeout: 2_000 });
  });
});
