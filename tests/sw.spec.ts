// REGRESSION-03 (CON-017 #3) — Service worker stale filter at boot.
// Phase 4 (PR2a) ha introdotto sw.js: l'invariante evolve da "swCount === 0"
// a "esattamente 1 SW registrato AND scriptURL matcha sw.js corrente".
// Il loop in app.js (~riga 165) unregistra SOLO i SW con scriptURL != sw.js
// e poi registra sw.js scope './'. Il test protegge contro:
//   - registrazioni multiple (regressioni del filter loop)
//   - SW residui da versioni precedenti che sopravvivono al boot
// Reference: REQ-PWA-02 + CON-010.

import { test, expect } from './fixtures';

test('REGRESSION-03: stale SWs unregistered at boot, current SW survives', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Attendi che il SW corrente prenda controllo (clients.claim()).
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    null,
    { timeout: 10_000 },
  );

  const scriptUrls = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.map((r) => {
      const active = r.active || r.installing || r.waiting;
      return active && active.scriptURL ? active.scriptURL : null;
    });
  });

  expect(scriptUrls.length).toBe(1);
  expect(scriptUrls[0]).toMatch(/sw\.js$/);
});
