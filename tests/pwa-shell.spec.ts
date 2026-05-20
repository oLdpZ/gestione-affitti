// tests/pwa-shell.spec.ts — PR2a (REQ-PWA-01, REQ-PWA-02, REQ-PWA-03).
// NOTE: Playwright Chromium headless non triggera beforeinstallprompt in modo
// affidabile (richiede installability + engagement heuristics non simulabili).
// Quindi testiamo: manifest link presente, SW attivo, banner DOM controllato
// via state localStorage iniettato — NON il prompt nativo.

import { test, expect } from './fixtures';

test('PWA-01: manifest link e theme-color presenti', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.json/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0071e3');
});

test('PWA-02: service worker registrato e controlla la pagina', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Attendi che il SW prenda controllo (clients.claim sull'activate)
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    null,
    { timeout: 10_000 },
  );
  const url = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  expect(url).toMatch(/sw\.js$/);
});

test('PWA-03a: install banner NON appare al primo accesso (< 3 sessioni)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="install-banner"]')).not.toBeVisible();
});

test('PWA-03b: install banner appare dopo 3 sessioni in 7 giorni (state injection)', async ({ page }) => {
  await page.goto('/');
  // Inietta 3 timestamp recenti nel session log + un flag che simula
  // beforeinstallprompt catturato (per il branch non-iOS).
  await page.evaluate(() => {
    const now = Date.now();
    const log = [
      new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ];
    localStorage.setItem('gestione_affitti_session_log', JSON.stringify(log));
    // Pulizia di eventuali flag che bloccherebbero il banner.
    localStorage.removeItem('gestione_affitti_installed');
    localStorage.removeItem('gestione_affitti_install_dismissed_until');
  });
  await page.reload();
  // Inietta deferredInstallPrompt fake direttamente sull'Alpine instance.
  // beforeinstallprompt non firea in Chromium headless senza heuristics
  // di installability che non possiamo simulare; iniezione manuale e' lo
  // standard Playwright per testare la branch non-iOS.
  await page.evaluate(() => {
    const root = document.querySelector('[x-data]') as unknown as { _x_dataStack?: Array<Record<string, unknown>> };
    const scope = root?._x_dataStack?.[0];
    if (scope) {
      scope._deferredInstallPrompt = { prompt: () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
      (scope.maybeShowInstallBanner as () => void)?.call(scope);
    }
  });
  await expect(page.locator('[data-testid="install-banner"]')).toBeVisible({ timeout: 2_000 });
  await expect(page.locator('[data-testid="install-banner"]')).toContainText('Aggiungi alla schermata Home');
});

test('PWA-03c: dismissing il banner setta install_dismissed_until ~14d', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('gestione_affitti_session_log', JSON.stringify([
      new Date(now - 5 * 86400000).toISOString(),
      new Date(now - 3 * 86400000).toISOString(),
      new Date(now - 1 * 86400000).toISOString(),
    ]));
    localStorage.removeItem('gestione_affitti_installed');
    localStorage.removeItem('gestione_affitti_install_dismissed_until');
  });
  await page.reload();
  await page.evaluate(() => {
    const root = document.querySelector('[x-data]') as unknown as { _x_dataStack?: Array<Record<string, unknown>> };
    const scope = root?._x_dataStack?.[0];
    if (scope) {
      scope._deferredInstallPrompt = { prompt: () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
      (scope.maybeShowInstallBanner as () => void)?.call(scope);
    }
  });
  await expect(page.locator('[data-testid="install-banner"]')).toBeVisible({ timeout: 2_000 });
  await page.locator('[data-testid="install-dismiss"]').click();
  await expect(page.locator('[data-testid="install-banner"]')).not.toBeVisible();
  const until = await page.evaluate(() => localStorage.getItem('gestione_affitti_install_dismissed_until'));
  expect(until).toBeTruthy();
  expect(new Date(until!).getTime()).toBeGreaterThan(Date.now() + 13 * 86400000); // ~14 giorni
});
