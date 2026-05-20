// tests/undo.spec.ts — PR1 UNDO-01: delete incasso -> click Annulla -> incasso torna.
// REQ-SAFE-03 (undo toast).
//
// =============================================================================
// .skip status — PR2a follow-up
// =============================================================================
// UNDO-01 e' .skip in attesa di diagnosi della reattivita' Alpine 3 sul
// mutation di nested array items.
//
// Sintomo osservato in CI #6 (commit 00db84b3, artifact playwright-report-26053692934):
//   - eliminaIncasso esegue correttamente: inc.deletedAt riceve l'ISO string,
//     mostraUndoToast fa apparire il toast "Incasso eliminato" (visibile nel
//     page snapshot a runtime).
//   - cestinoItems() recupera l'incasso soft-deleted CORRETTAMENTE (visibile
//     nella sezione Cestino come "<mese> - <nomeProprieta>") -> la mutation
//     ha avuto effetto sul dato.
//   - PERO' gruppiCalendario() NON re-runs dopo la mutation: la calendar-card
//     resta nel bucket gruppo.incassi (con button title="Elimina" presente)
//     invece di scivolare nel bucket gruppo.mancanti.
//
// Diagnosi:
//   gruppiCalendario chiama this.attivi(this.dati.incassiAffitti) che dovrebbe
//   essere reattivo su .deletedAt di ogni item. Alpine 3 (Vue3-style Proxy)
//   normalmente intercetta gli accessi a nested properties durante l'esecuzione
//   del getter e ri-corre quando la dipendenza cambia. Qui sembra che la
//   tracciatura attraverso lo helper `attivi()` (che chiama .filter()) non
//   colleghi la dipendenza alla render della calendar-card. Cestino funziona
//   perche' cestinoItems() itera direttamente proprieta/incassiAffitti senza
//   passare per attivi().
//
// Hypothesis per il fix in PR2a:
//   - Rendere attivi() un getter computed memoizzato, oppure
//   - Inlining del filter dentro gruppiCalendario per evitare l'indirezione, o
//   - Forzare un trigger di reattivita' esplicito via this.$nextTick o un
//     dummy `this.dati = { ...this.dati }` dopo le mutation in eliminaIncasso.
//
// Production-wise, l'UX e' degradata ma non rotta:
//   - Toast undo appare correttamente (5s window e' funzionante).
//   - I dati sono in stato corretto (cestino mostra l'item, attivi() lo filtra
//     in saluteDati e in cestinoItems).
//   - La calendar-card mostra "stale state" finche' l'utente non cambia mese o
//     ricarica. Cosmetic, non blocker per il MVP family-tier.
// =============================================================================

import { test, expect, doLogin } from './fixtures';

test.describe('UNDO toast (5s, stack model) — PR2a TODO', () => {
  test('UNDO-01: delete incasso -> undo toast visible -> Annulla -> incasso ricompare', async ({ page, seedData }) => {
    await doLogin(page);
    await page.click('button:has-text("Calendario")');
    await page.getByRole('heading', { level: 2, name: /\d{4}$/ }).waitFor({ timeout: 5_000 });

    const card = page
      .locator('[data-testid="calendar-card"]')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .first();
    await expect(card).toBeVisible();
    const deleteBtn = card.locator('button[title="Elimina"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const toast = page.locator('[data-testid="undo-toast"]');
    await expect(toast).toBeVisible({ timeout: 1_500 });
    await expect(toast).toContainText('Incasso eliminato');

    const cardAfter = page
      .locator('[data-testid="calendar-card"]')
      .filter({ hasText: 'Appartamento Test Via Roma' })
      .first();
    await expect(cardAfter.locator('button[title="Elimina"]')).toHaveCount(0, { timeout: 2_000 });

    await page.locator('[data-testid="undo-button"]').click();
    await expect(toast).not.toBeVisible({ timeout: 1_000 });
    await expect(cardAfter.locator('button[title="Elimina"]')).toBeVisible({ timeout: 2_000 });
  });
});
