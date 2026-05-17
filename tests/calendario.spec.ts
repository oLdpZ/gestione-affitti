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
    await expect(card.first()).toBeVisible();
    await expect(card.first().locator('button:has-text("Sistema")')).toBeVisible();
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

    // index.html:1295 — label gruppo: '⚠ Incassi orfani (proprieta cancellata)'
    // L'h3 e' il selettore di intestazione del gruppo (vedi index.html:311).
    const orfaniHeader = page
      .locator('h3')
      .filter({ hasText: /[Ii]ncassi orfani/ });
    await expect(orfaniHeader).toBeVisible({ timeout: 10_000 });

    // L'importo 500 deve apparire dentro il blocco del gruppo orfani.
    const orfaniBlock = orfaniHeader.locator('..');
    await expect(orfaniBlock.locator('text=500').first()).toBeVisible();
  });

  test('CRITICAL-02: segna incasso oggi in <2s', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Calendario")');

    // Pitfall 4: generaIncassiAttesi puo' aver gia' creato l'incasso a init.
    const card = page
      .locator('.bg-gray-50, .bg-red-50')
      .filter({ hasText: 'Appartamento Test Via Roma' });
    await expect(card.first()).toBeVisible();

    const start = Date.now();
    await card
      .first()
      .locator('button')
      .filter({ hasText: /Incassa oggi|^Oggi$/ })
      .first()
      .click();

    await expect(
      page.locator('.bg-green-50').filter({ hasText: 'Appartamento Test Via Roma' }).first(),
    ).toBeVisible({ timeout: 5_000 });

    expect(Date.now() - start).toBeLessThan(2_000);

    // Status dot esiste 2x (desktop + sm:hidden mobile) — first() per evitare strict mode.
    await expect(
      page.locator('.status-dot.bg-green-500, .status-dot[class*="green-500"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('CRITICAL-03: crea nuova proprieta', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Impostazioni")');

    // Scope alla sezione Proprieta (stesso pattern di REGRESSION-04).
    const propSection = page
      .locator('div.mb-8')
      .filter({ has: page.locator('h3', { hasText: /^Proprieta$/ }) });
    await propSection.locator('button:has-text("+ Nuova")').click();

    // Form panel: attributo Alpine univoco.
    const propForm = propSection.locator('[x-show="mostraFormProprieta"]');
    await expect(propForm).toBeVisible();

    // Nome: x-model="editProprieta.nome" — unico input[type="text"] nel form
    // proprieta che binda editProprieta.nome.
    await propForm
      .locator('input[x-model="editProprieta.nome"]')
      .fill('Proprieta E2E Test');
    await propForm.locator('input[type="number"]').fill('1200');

    await propForm.locator('button:has-text("Salva")').click();

    // Dopo il Salva la nuova proprieta compare nella tabella dentro propSection
    // (in td x-text="p.nome"). L'h3 con lo stesso testo sta sulla dashboard
    // che e' nascosta — scoping a propSection evita il false-match nascosto.
    await expect(
      propSection.locator('td').filter({ hasText: 'Proprieta E2E Test' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('.status-dot.bg-green-500, .status-dot[class*="green-500"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
