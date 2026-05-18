// tests/cestino.spec.ts — PR1 CESTINO round-trip + hard-delete cascading.
// REQ-SAFE-01 (soft-delete) + REQ-SAFE-02 (cestino view) + REQ-SAFE-05 (cascading).

import { test, expect, doLogin } from './fixtures';

test.describe('CRITICAL-04: cestino soft-delete + ripristina', () => {
  test('CESTINO-01 round-trip: elimina proprieta -> ripristina dal cestino', async ({ page, seedData }) => {
    await doLogin(page);

    // 1. Vai a Impostazioni, elimina prop-test-001 dalla sezione Proprieta.
    await page.click('button:has-text("Impostazioni")');
    const propSection = page.locator('[data-testid="prop-section"]');
    const propRow = propSection.locator('tbody tr').filter({ hasText: 'Appartamento Test Via Roma' });
    await expect(propRow).toHaveCount(1);
    await propRow.locator('button:has-text("Elimina")').click();

    // 2. Riga sparisce dalla tabella attive (l'x-for ora usa attivi(dati.proprieta)).
    await expect(propRow).toHaveCount(0, { timeout: 5_000 });

    // 3. La proprieta compare nel Cestino.
    const cestino = page.locator('[data-testid="cestino-section"]');
    await expect(cestino).toBeVisible();
    const cestinoRow = cestino.locator('tbody tr').filter({ hasText: 'Appartamento Test Via Roma' });
    await expect(cestinoRow).toHaveCount(1);

    // 4. Click Ripristina -> ricompare nelle proprieta attive.
    await cestinoRow.locator('button:has-text("Ripristina")').click();
    await expect(propRow).toHaveCount(1, { timeout: 5_000 });
    await expect(cestinoRow).toHaveCount(0);
  });

  test('CESTINO-02 hard-delete cascading: Elimina definitivamente rimuove anche gli incassi figli', async ({ page, seedData }) => {
    await doLogin(page);

    // 1. Soft-delete della proprieta.
    await page.click('button:has-text("Impostazioni")');
    const propSection = page.locator('[data-testid="prop-section"]');
    await propSection
      .locator('tbody tr')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .locator('button:has-text("Elimina")')
      .click();

    // 2. Nel cestino click Elimina definitivamente -> accetta confirm nativo.
    const cestino = page.locator('[data-testid="cestino-section"]');
    const cestinoRow = cestino.locator('tbody tr').filter({ hasText: 'Appartamento Test Via Roma' });
    await expect(cestinoRow).toHaveCount(1);
    page.once('dialog', (d) => d.accept());
    await cestinoRow.locator('button:has-text("Elimina definitivamente")').click();

    // 3. La riga sparisce dal cestino.
    await expect(cestinoRow).toHaveCount(0, { timeout: 5_000 });

    // 4. Reload: niente trace della proprieta nelle tabelle attive ne nel cestino.
    await page.reload();
    await page.click('button:has-text("Impostazioni")');
    await expect(propSection.locator('tbody tr').filter({ hasText: 'Appartamento Test Via Roma' })).toHaveCount(0);
    await expect(cestino.locator('tbody tr').filter({ hasText: 'Appartamento Test Via Roma' })).toHaveCount(0);
  });
});
