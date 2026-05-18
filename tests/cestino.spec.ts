// tests/cestino.spec.ts — PR1 CESTINO round-trip + hard-delete cascading.
// REQ-SAFE-01 (soft-delete) + REQ-SAFE-02 (cestino view) + REQ-SAFE-05 (cascading).

import { test, expect, doLogin } from './fixtures';

test.describe('CRITICAL-04: cestino soft-delete + ripristina', () => {
  test('CESTINO-01 round-trip: elimina proprieta -> ripristina dal cestino', async ({ page, seedData }) => {
    await doLogin(page);

    // 1. Vai a Impostazioni, elimina prop-test-001 dalla sezione Proprieta.
    await page.click('button:has-text("Impostazioni")');
    const propSection = page.locator('[data-testid="prop-section"]');
    await propSection
      .locator('tr')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .locator('button:has-text("Elimina")')
      .click();

    // 2. Proprieta scompare dalla tabella attive.
    await expect(
      propSection.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' }),
    ).toHaveCount(0, { timeout: 5_000 });

    // 3. La proprieta compare nel Cestino con una riga + bottone Ripristina.
    const cestino = page.locator('[data-testid="cestino-section"]');
    await expect(cestino).toBeVisible();
    const cestinoRow = cestino.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' });
    await expect(cestinoRow).toHaveCount(1);

    // 4. Click Ripristina -> ricompare nelle proprieta attive.
    await cestinoRow.locator('button:has-text("Ripristina")').click();
    await expect(
      propSection.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' }),
    ).toHaveCount(1, { timeout: 5_000 });
    // E sparisce dal cestino.
    await expect(
      cestino.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' }),
    ).toHaveCount(0);
  });

  test('CESTINO-02 hard-delete cascading: Elimina definitivamente rimuove anche gli incassi figli', async ({ page, seedData }) => {
    await doLogin(page);

    // 1. Soft-delete della proprieta (genera anche cascading sui suoi incassi).
    await page.click('button:has-text("Impostazioni")');
    const propSection = page.locator('[data-testid="prop-section"]');
    await propSection
      .locator('tr')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .locator('button:has-text("Elimina")')
      .click();

    // 2. Nel cestino click Elimina definitivamente -> accetta confirm nativo.
    const cestino = page.locator('[data-testid="cestino-section"]');
    const cestinoRow = cestino.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' });
    page.once('dialog', (d) => d.accept());
    await cestinoRow.locator('button:has-text("Elimina definitivamente")').click();

    // 3. La riga sparisce dal cestino.
    await expect(
      cestino.locator('tr').filter({ hasText: 'Appartamento Test Via Roma' }),
    ).toHaveCount(0, { timeout: 5_000 });

    // 4. Reload: niente trace della proprieta ne dei suoi incassi.
    await page.reload();
    await page.waitForSelector('input[type="email"], button:has-text("Impostazioni")');
    await expect(page.locator('text=Appartamento Test Via Roma').first()).toHaveCount(0);
  });
});
