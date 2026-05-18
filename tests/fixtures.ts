// tests/fixtures.ts — Phase 1 / PR5 (REQ-PLAY-01).
// doLogin + Supabase seed helpers + mock data shared by tutti gli spec.
//
// Schema reale Supabase: tabella `user_data`, colonna jsonb `data`.
// La service_role key e' guardata da un trigger DB che permette
// modifiche SOLO al TEST_USER_ID (0c37fe92-c63d-4e80-9d9a-abc4c01c6290).
// Vedi .planning/phases/01-pr5-test-infrastructure/01-SUPABASE-TEST-SETUP.md.

import { test as base, expect } from '@playwright/test';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing env var ${name}. Esporta le 5 var (SUPABASE_TEST_URL, ` +
      `SUPABASE_SERVICE_KEY, TEST_EMAIL, TEST_PASSWORD, TEST_USER_ID) ` +
      `prima di lanciare la suite. Vedi 01-SUPABASE-TEST-SETUP.md.`,
    );
  }
  return v;
}

const SUPABASE_URL = requireEnv('SUPABASE_TEST_URL');
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY');
const TEST_EMAIL = requireEnv('TEST_EMAIL');
const TEST_PASSWORD = requireEnv('TEST_PASSWORD');
const TEST_USER_ID = requireEnv('TEST_USER_ID');

const currentMonth = () => new Date().toISOString().slice(0, 7);

export const MOCK_DATI = {
  proprieta: [
    {
      id: 'prop-test-001',
      nome: 'Appartamento Test Via Roma',
      importoAffittoMensile: 900,
      scadenzaAffitto: '1',
      currency: 'EUR',
      bancaIncasso: 'banca-test-001',
      bancaDestinazione: 'banca-test-001',
      intestatario: 'Test Intestatario',
    },
    {
      id: 'prop-zero-001',
      nome: 'Appartamento Importo Zero',
      importoAffittoMensile: 0,
      scadenzaAffitto: '15',
      currency: 'EUR',
      bancaIncasso: 'banca-test-001',
      bancaDestinazione: 'banca-test-001',
      intestatario: 'Test Intestatario Zero',
    },
  ],
  banche: [
    {
      id: 'banca-test-001',
      nome: 'Banca Test',
      intestatario: 'Test',
      currency: 'EUR',
    },
  ],
  incassiAffitti: [] as Array<Record<string, unknown>>,
  utenze: [] as Array<Record<string, unknown>>,
};

export const MOCK_DATI_WITH_ORPHAN = {
  ...MOCK_DATI,
  incassiAffitti: [
    {
      id: 'inc-orphan-001',
      proprietaId: 'prop-deleted-999',
      mese: currentMonth(),
      importo: 500,
      data: new Date().toISOString().slice(0, 10),
      banca: 'banca-test-001',
      intestatario: 'Test Intestatario',
      currency: 'EUR',
    },
  ],
};

const seedHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

export async function seedSupabase(blob: object): Promise<void> {
  // UPSERT via PostgREST: INSERT ... ON CONFLICT (user_id) DO UPDATE SET data = excluded.data.
  // Sostituisce DELETE+POST (la DELETE in alcune combinazioni RLS/trigger non
  // ripuliva la riga in tempo, causando 409 al POST successivo). L'UPSERT sul
  // PK user_id e' atomico e idempotente — il blob 'data' viene sostituito
  // integralmente perche' merge-duplicates opera a livello colonna, non a
  // livello key JSONB.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
    method: 'POST',
    headers: {
      ...seedHeaders,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ user_id: TEST_USER_ID, data: blob }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase seed UPSERT failed ${res.status}: ${body}`);
  }
}

export async function doLogin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // Heading h2 "Dashboard — <mese>" e' unico (i 2 button nav contengono pure
  // 'Dashboard' ma sono <button>, qui filtriamo per ruolo heading).
  await page.getByRole('heading', { level: 1, name: 'Dashboard' }).waitFor({ timeout: 15_000 });
}

type Fixtures = {
  seedData: void;
  seedWithOrphan: void;
};

export const test = base.extend<Fixtures>({
  seedData: [
    async ({}, use) => {
      await seedSupabase(MOCK_DATI);
      await use();
    },
    { auto: false },
  ],
  seedWithOrphan: [
    async ({}, use) => {
      await seedSupabase(MOCK_DATI_WITH_ORPHAN);
      await use();
    },
    { auto: false },
  ],
});

export { expect };
export const TEST_CREDENTIALS = { email: TEST_EMAIL };
