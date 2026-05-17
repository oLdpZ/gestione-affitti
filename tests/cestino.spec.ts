import { test, expect, doLogin } from './fixtures';

test.describe('CRITICAL-04: elimina e ripristina dal cestino', () => {
  test.skip('elimina proprieta + ripristina dal cestino restituisce dati identici — RICHIEDE PR1 (REQ-SAFE-01, REQ-SAFE-02)', async ({ page }) => {
    // TODO(PR1): unblock this test when REQ-SAFE-01 (soft-delete) + REQ-SAFE-02 (cestino view) ship.
    // Steps:
    // 1. await doLogin(page)
    // 2. Impostazioni -> delete prop-test-001 (click elimina, confirm)
    // 3. Impostazioni -> Cestino -> find prop-test-001, click Ripristina
    // 4. Navigate back, verify prop-test-001 reappears with all related incassi + utenze
    // 5. Snapshot the dati blob before delete and after restore; deep-equal must hold.
  });
});
