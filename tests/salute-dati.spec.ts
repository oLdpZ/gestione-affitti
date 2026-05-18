// tests/salute-dati.spec.ts — PR1 SD-01: salute dati counts.
// REQ-SAFE-05 (salute dati page).

import { test, expect, doLogin } from './fixtures';

test.describe('SALUTE DATI page', () => {
  test('SD-01: counts attive + cestinate dopo soft-delete', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Impostazioni")');

    // 1. Stato iniziale: MOCK_DATI ha 2 proprieta (prop-test-001 + prop-zero-001).
    const sdSection = page.locator('[data-testid="salute-dati-section"]');
    await expect(sdSection).toBeVisible();
    await expect(page.locator('[data-testid="sd-prop-attive"]')).toHaveText('2');
    await expect(page.locator('[data-testid="sd-prop-cestinate"]')).toHaveText('0');

    // 2. Soft-delete di 1 proprieta dalla sezione Proprieta.
    const propSection = page.locator('[data-testid="prop-section"]');
    await propSection
      .locator('tr')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .locator('button:has-text("Elimina")')
      .click();

    // 3. Counts aggiornati: 1 attiva, 1 cestinata.
    await expect(page.locator('[data-testid="sd-prop-attive"]')).toHaveText('1', { timeout: 5_000 });
    await expect(page.locator('[data-testid="sd-prop-cestinate"]')).toHaveText('1');

    // 4. Dimensione blob > 0 KB.
    const blobKB = await page.locator('[data-testid="sd-blob-kb"]').textContent();
    expect(Number(blobKB)).toBeGreaterThan(0);

    // 5. Bottone diagnostica disabilitato (SUPPORT_WHATSAPP vuoto).
    await expect(page.locator('[data-testid="diagnostica-whatsapp"]')).toBeDisabled();
  });
});
