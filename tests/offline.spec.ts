import { test, expect, doLogin } from './fixtures';

test.describe('CRITICAL-05: offline write + sync on reconnect', () => {
  test.skip('offline write + return online + sync — RICHIEDE PR2b (REQ-SYNC-01)', async ({ page, context }) => {
    // TODO(PR2b): unblock this test when REQ-SYNC-01 (mutation queue via idb-keyval) ships.
    // Steps:
    // 1. await doLogin(page)
    // 2. await context.setOffline(true)
    // 3. Make a write (segna incasso)
    // 4. Assert "Offline" status dot + "N modifiche in coda" indicator visible
    // 5. await context.setOffline(false)
    // 6. Wait for green status dot (sync complete)
    // 7. page.reload() — assert the change persisted on the server (RPC returns expected state)
  });
});
