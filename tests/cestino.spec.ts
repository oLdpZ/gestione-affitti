// tests/cestino.spec.ts — PR1 CESTINO round-trip + hard-delete cascading.
// REQ-SAFE-01 (soft-delete) + REQ-SAFE-02 (cestino view) + REQ-SAFE-05 (cascading).
//
// Selector note: cascading soft-delete fa apparire DUE righe nel cestino (la
// proprieta + il suo incasso, etichettato "<mese> - <nomeProprieta>"). Entrambe
// contengono il testo del nome proprieta. I filter() chained su tipo
// disambiguano fra la riga Proprieta e la riga Incasso.

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

    // 2. Riga sparisce dalla tabella attive.
    await expect(propRow).toHaveCount(0, { timeout: 5_000 });

    // 3. La proprieta compare nel Cestino. Filtro doppio per disambiguare dalla
    //    riga Incasso cascadata che ha la stessa stringa nome.
    const cestino = page.locator('[data-testid="cestino-section"]');
    await expect(cestino).toBeVisible();
    const cestinoPropRow = cestino
      .locator('tbody tr')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .filter({ hasText: 'Proprieta' });
    await expect(cestinoPropRow).toHaveCount(1);

    // 4. Click Ripristina sulla riga proprieta -> ricompare nelle proprieta attive.
    await cestinoPropRow.locator('button:has-text("Ripristina")').click();
    await expect(propRow).toHaveCount(1, { timeout: 5_000 });
    await expect(cestinoPropRow).toHaveCount(0);
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

    // 2. Nel cestino click Elimina definitivamente sulla riga PROPRIETA
    //    (non sull'incasso cascadato che ha la stessa stringa).
    const cestino = page.locator('[data-testid="cestino-section"]');
    const cestinoPropRow = cestino
      .locator('tbody tr')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .filter({ hasText: 'Proprieta' });
    await expect(cestinoPropRow).toHaveCount(1);
    page.once('dialog', (d) => d.accept());
    await cestinoPropRow.locator('button:has-text("Elimina definitivamente")').click();

    // 3. Tutte le righe relative a "Appartamento Test Via Roma" spariscono
    //    dal cestino (cascading hard-delete sugli incassi figli).
    const tutteLeRigheNelCestino = cestino
      .locator('tbody tr')
      .filter({ hasText: 'Appartamento Test Via Roma' });
    await expect(tutteLeRigheNelCestino).toHaveCount(0, { timeout: 5_000 });

    // 4. Reload: niente trace della proprieta nelle tabelle attive ne nel cestino.
    await page.reload();
    await page.click('button:has-text("Impostazioni")');
    await expect(propSection.locator('tbody tr').filter({ hasText: 'Appartamento Test Via Roma' })).toHaveCount(0);
    await expect(cestino.locator('tbody tr').filter({ hasText: 'Appartamento Test Via Roma' })).toHaveCount(0);
  });
});
