// tests/snapshot.spec.ts — PR1 SNAP-01: ring buffer registra ogni save, restore ripristina lo stato.
// REQ-SAFE-04 (snapshot ring 10 pre-mutation).

import { test, expect, doLogin } from './fixtures';

test.describe('SNAPSHOT timeline', () => {
  test('SNAP-01: due save -> snapshot-section mostra 2 entry -> ripristina', async ({ page, seedData }) => {
    await doLogin(page);

    // 1. Trigger un primo save dalla dashboard (un soft-delete + undo basterebbe; usiamo
    //    un cambio nome banca che e' atomico e tracciabile).
    await page.click('button:has-text("Banche")');
    const bankRow = page.locator('tr').filter({ hasText: 'Banca Test' }).first();
    await bankRow.locator('button:has-text("Modifica")').click();
    const bankForm = page.locator('[data-testid="bank-form"], form').filter({ has: page.locator('input[type="text"]') }).first();
    await bankForm.locator('input[type="text"]').first().fill('Banca Test Edit 1');
    await bankForm.locator('button:has-text("Salva")').click();

    // 2. Trigger un secondo save.
    await page.locator('tr').filter({ hasText: 'Banca Test Edit 1' }).first().locator('button:has-text("Modifica")').click();
    await bankForm.locator('input[type="text"]').first().fill('Banca Test Edit 2');
    await bankForm.locator('button:has-text("Salva")').click();

    // 3. Vai a Impostazioni e verifica che snapshot-section esiste con almeno 2 entry.
    await page.click('button:has-text("Impostazioni")');
    const snapSection = page.locator('[data-testid="snapshot-section"]');
    await expect(snapSection).toBeVisible();
    const rows = snapSection.locator('[data-testid^="snapshot-row-"]');
    // Almeno 2 (puo essere di piu se il load ha generato altri save: ring di 10 max).
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // 4. Click Ripristina sulla penultima entry (la piu vecchia visibile in ordine reverse).
    page.once('dialog', (d) => d.accept());
    const lastRow = rows.last();
    await lastRow.locator('button:has-text("Ripristina")').click();

    // 5. Vai a Banche, l'edit piu recente e' stato sovrascritto.
    await page.click('button:has-text("Banche")');
    await expect(page.locator('text=Banca Test Edit 2')).toHaveCount(0, { timeout: 5_000 });
  });
});
