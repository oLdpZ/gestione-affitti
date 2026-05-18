// tests/snapshot.spec.ts — PR1 SNAP-01: ring buffer registra ogni save, restore ripristina lo stato.
// REQ-SAFE-04 (snapshot ring 10 pre-mutation).

import { test, expect, doLogin } from './fixtures';

test.describe('SNAPSHOT timeline', () => {
  test('SNAP-01: due save -> snapshot-section mostra >=2 entry -> ripristina', async ({ page, seedData }) => {
    await doLogin(page);

    // 1. Vai a Banche e fai due edit consecutivi sulla "Banca Test" del seed.
    await page.click('button:has-text("Banche")');
    const bankSection = page.locator('[data-testid="bank-section"]');
    const bankRow = bankSection.locator('tbody tr').filter({ hasText: 'Banca Test' });
    await expect(bankRow).toHaveCount(1);

    // Edit 1: cambia il nome.
    await bankRow.locator('button:has-text("Modifica")').click();
    const nameInput = bankSection.locator('input[type="text"]').first();
    await nameInput.fill('Banca Test Edit 1');
    await bankSection.locator('button:has-text("Salva")').click();
    // Attendi che la modifica sia visibile.
    await expect(bankSection.locator('tbody tr').filter({ hasText: 'Banca Test Edit 1' })).toHaveCount(1);

    // Edit 2: cambia di nuovo il nome.
    await bankSection.locator('tbody tr').filter({ hasText: 'Banca Test Edit 1' }).locator('button:has-text("Modifica")').click();
    await nameInput.fill('Banca Test Edit 2');
    await bankSection.locator('button:has-text("Salva")').click();
    await expect(bankSection.locator('tbody tr').filter({ hasText: 'Banca Test Edit 2' })).toHaveCount(1);

    // 2. Vai a Impostazioni e verifica snapshot-section con >=2 entry.
    await page.click('button:has-text("Impostazioni")');
    const snapSection = page.locator('[data-testid="snapshot-section"]');
    await expect(snapSection).toBeVisible();
    const rows = snapSection.locator('[data-testid^="snapshot-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // 3. Click Ripristina sull'ultima entry (la piu vecchia visibile dal momento
    //    che snapshots() reverses newest-first). Accetta il confirm() overwrite.
    page.once('dialog', (d) => d.accept());
    await rows.last().locator('button:has-text("Ripristina")').click();

    // 4. Torna a Banche: l'edit piu recente "Edit 2" non c'e piu (sovrascritto).
    await page.click('button:has-text("Banche")');
    await expect(bankSection.locator('tbody tr').filter({ hasText: 'Banca Test Edit 2' })).toHaveCount(0, { timeout: 5_000 });
  });
});
