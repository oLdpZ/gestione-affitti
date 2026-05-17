// REGRESSION-03 (CON-017 #3) — Service worker stale unregistered at boot.
// Phase 1 (pre-PR2a): l'app non ha ancora un SW; l'invariante e' swCount === 0.
// Il test protegge contro registrazioni accidentali di SW prima di PR2a.
//
// TODO(PR2a): quando sw.js spedisce, evolvere il test:
//   1. Pre-registra un SW stale con scope/version diverso via page.evaluate
//   2. Reload pagina
//   3. Asserisci che lo stale e' sparito e resta solo il SW versionato corrente
// Reference: REQ-PWA-02 + CON-010 (boot unregisters stale SWs).

import { test, expect } from './fixtures';

test('REGRESSION-03: service worker boot invariant (no stale SW)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const swCount = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 0;
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length;
  });

  expect(swCount).toBe(0);
});
