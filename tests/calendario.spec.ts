// tests/calendario.spec.ts — REGRESSION-01, -02, -05 + CRITICAL-02, -03 (LIVE).
// Pitfall 5: nessun click sulle frecce mese — asserzioni solo sul mese corrente.

import { test, expect, doLogin } from './fixtures';

test.describe('calendario', () => {
  test('REGRESSION-01: card gialla per proprieta con importo=0 (CON-017 #1)', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Calendario")');

    const card = page
      .locator('.bg-yellow-50, [class*="yellow-900"]')
      .filter({ hasText: 'Appartamento Importo Zero' });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Sistema")')).toBeVisible();
    await expect(card.locator('text=Importo mensile')).toBeVisible();
  });

  test('REGRESSION-02: genera incassi mancanti elenca le saltate (CON-017 #2)', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Calendario")');

    // Dialog handler PRIMA del click (Pitfall 2).
    let alertMessage = '';
    page.on('dialog', async (d) => {
      alertMessage = d.message();
      await d.accept();
    });

    await page.click('button:has-text("Genera incassi mancanti")');

    await expect.poll(() => alertMessage, { timeout: 5_000 }).toContain('Appartamento Importo Zero');
    expect(alertMessage).not.toContain('tutto già presente per');
  });

  test('REGRESSION-05: incassi orfani nel gruppo dedicato (CON-017 #5)', async ({ page, seedWithOrphan }) => {
    await doLogin(page);
    await page.click('button:has-text("Calendario")');

    const orfaniGroup = page.locator('h3').filter({ hasText: 'orfani' });
    await expect(orfaniGroup).toBeVisible();

    // L'importo 500 deve apparire nel blocco orfani — risaliamo al container piu' vicino.
    const orfaniContainer = orfaniGroup.locator('..').locator('..');
    await expect(orfaniContainer.locator('text=500')).toBeVisible();
  });

  test('CRITICAL-02: segna incasso oggi in <2s', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Calendario")');

    // Pitfall 4: generaIncassiAttesi puo' aver gia' creato l'incasso a init.
    // La card iniziale puo' essere grigia (atteso) o rossa (scaduto); cerchiamo
    // quella della proprieta target.
    const card = page
      .locator('.bg-gray-50, .bg-red-50')
      .filter({ hasText: 'Appartamento Test Via Roma' });
    await expect(card).toBeVisible();

    const start = Date.now();
    await card
      .locator('button')
      .filter({ hasText: /Incassa oggi|^Oggi$/ })
      .first()
      .click();

    await expect(
      page.locator('.bg-green-50').filter({ hasText: 'Appartamento Test Via Roma' }),
    ).toBeVisible({ timeout: 5_000 });

    expect(Date.now() - start).toBeLessThan(2_000);

    await expect(
      page.locator('.status-dot[class*="green"], .status-dot.bg-green-500'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('CRITICAL-03: crea nuova proprieta', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Impostazioni")');

    // Scoping alla sezione Proprieta — niente bare "+" fallback (rischio click sbagliato).
    await page
      .locator('section:has-text("Proprietà"), div:has-text("Proprietà")')
      .locator('button')
      .filter({ hasText: /Aggiungi|Nuova proprietà/ })
      .first()
      .click();

    await page.locator('input[type="text"]').first().fill('Proprietà E2E Test');
    await page.locator('input[type="number"]').first().fill('1200');

    await page.click('button:has-text("Salva")');

    await expect(page.locator('text=Proprietà E2E Test')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('.status-dot[class*="green"], .status-dot.bg-green-500'),
    ).toBeVisible({ timeout: 10_000 });
  });
});
