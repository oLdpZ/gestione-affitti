// tests/snapshot.spec.ts — PR1 SNAP-01: ring buffer registra ogni save, restore ripristina lo stato.
// REQ-SAFE-04 (snapshot ring 10 pre-mutation).

import { test, expect, doLogin } from './fixtures';

test.describe('SNAPSHOT timeline', () => {
  test('SNAP-01: due save -> snapshot-section mostra >=2 entry -> ripristina', async ({ page, seedData }) => {
    await doLogin(page);

    // 1. bank-section vive DENTRO Impostazioni (la view "Banche" e' separata e
    //    serve i Movimenti banca, non il CRUD). Naviga a Impostazioni prima.
    await page.click('button:has-text("Impostazioni")');
    const bankSection = page.locator('[data-testid="bank-section"]');
    await expect(bankSection).toBeVisible();

    const bankRow = bankSection.locator('tbody tr').filter({ hasText: 'Banca Test' });
    await expect(bankRow).toHaveCount(1);

    // Edit 1: rename Banca Test -> Banca Test Edit 1.
    await bankRow.locator('button:has-text("Modifica")').click();
    const nameInput = bankSection.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Banca Test Edit 1');
    await bankSection.locator('button:has-text("Salva")').click();
    await expect(bankSection.locator('tbody tr').filter({ hasText: 'Banca Test Edit 1' })).toHaveCount(1, { timeout: 5_000 });

    // Edit 2: rename ancora -> Banca Test Edit 2.
    await bankSection.locator('tbody tr').filter({ hasText: 'Banca Test Edit 1' }).locator('button:has-text("Modifica")').click();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Banca Test Edit 2');
    await bankSection.locator('button:has-text("Salva")').click();
    await expect(bankSection.locator('tbody tr').filter({ hasText: 'Banca Test Edit 2' })).toHaveCount(1, { timeout: 5_000 });

    // 2. snapshot-section vive nella stessa view Impostazioni — gia visibile.
    const snapSection = page.locator('[data-testid="snapshot-section"]');
    await expect(snapSection).toBeVisible();
    const rows = snapSection.locator('[data-testid^="snapshot-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // 3. Click Ripristina sull'ultima entry (la piu vecchia visibile dato che
    //    snapshots() ritorna newest-first). Accetta il confirm() overwrite.
    page.once('dialog', (d) => d.accept());
    await rows.last().locator('button:has-text("Ripristina")').click();

    // 4. "Edit 2" sovrascritto: non c'e piu nella tabella banche di Impostazioni.
    await expect(bankSection.locator('tbody tr').filter({ hasText: 'Banca Test Edit 2' })).toHaveCount(0, { timeout: 5_000 });
  });
});
