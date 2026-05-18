# Phase 3: PR1 — Data Safety Net + 3 Bugfix + Estrazione app.js — Context

**Gathered:** 2026-05-18
**Status:** Ready for research
**Source:** PRD Express Path (REQUIREMENTS REQ-SAFE-01..07 + `wiki/projects/gestione-affitti-ceo-plan-20260517.md` § PR1 + intel/decisions DEC-020)

<domain>
## Phase Boundary

Eliminate **silent data loss** — the original trust breach — by making every destructive action recoverable BEFORE the schema migration runs (Phase 5). Three recovery layers stacked:

1. **Soft-delete + Cestino** (per-entity tombstone, persistent, manual recovery)
2. **Snapshot ring buffer** (whole-state ring of 10, automatic, full-state recovery)
3. **Undo toast** (5-second window for immediate revert after destructive action)

Plus: hardening of save path with explicit catch chain, validation guardrails on save, page Salute dati to surface anomalies, three pre-existing bugs fixed, and extraction of inline `<script>` to `app.js` (preserving the no-build-step constraint).

**This is the first phase that touches app logic, not just visuals.** Operates on the Apple/Sonoma redesigned skin shipped in Phase 2 PR0.

**In scope:**
- `deletedAt: ISOString | null` on Proprietà + Incassi entities
- Auto-purge of `deletedAt` items >30 days at `init()`
- Cestino view in Impostazioni (Ripristina, Elimina definitivamente)
- Cascading restore: Proprietà → its Incassi + Utenze
- Snapshot ring buffer of 10 in `localStorage.gestione_affitti_snapshots`
- "Ripristina snapshot" view (timeline + diff + restore)
- Undo toast (5s, "Annulla", restores pre-state)
- Salute dati page in Impostazioni (counts, ultimo sync, dimensione blob, storage usage, errori)
- "Invia diagnostica" → WhatsApp link with last 50 errors from `localStorage.errori[]`
- `window.addEventListener('error')` capture into `localStorage.errori[]` (ring of 50)
- Importo=0 soft-confirm modal on save (extend existing partial impl)
- Banca missing warning on incasso save
- Currency mismatch warning
- Bugfix 1: `importaJSON` calls `migraDati`
- Bugfix 2: `generaIncassiAttesi` respects `modificatoManualmente` flag
- Bugfix 3: `salva()` catch chain — auth-expired → refresh session; network → modalitàOffline; RLS → toast
- Extract `<script>` block to `app.js` (no build step, just `<script src="app.js">`)
- New Playwright regression tests for cestino + snapshot + undo + Salute dati paths

**Out of scope (deferred):**
- Soft-delete on Banche, Utenze, Inquilini, Tipi-utenza (incassi+proprietà only per REQ-SAFE-01; utenze restoration is cascaded from proprietà restore, not individually soft-deletable in PR1)
- Mutation queue, sync status, conflict count (Phase 5 PR2b — Salute dati extends then)
- Schema change (Phase 5)
- Inquilini entity (Phase 5)
- Tipi-utenza CRUD (Phase 5)
- Custom scadenze giorno (Phase 5)
- PWA shell, service worker (Phase 4)
- Field-level merge (rejected in CEO review)
- Cloud backup automatico (out per CEO plan)

</domain>

<decisions>
## Implementation Decisions

### Stack & Build (LOCKED)
- No build step. No npm install. No PostCSS. No bundler.
- `app.js` is a sibling of `index.html`. Plain ES module or classic script (Claude's discretion — recommend classic script for simplest interop with Alpine inline directives that reference `app()`).
- All existing CDN deps remain pinned to current versions (Alpine, Tailwind, Supabase). No new runtime deps.

### Soft-delete model (LOCKED)
- **Entities with `deletedAt: ISOString | null`**: Proprietà, Incassi. **Only these two.**
- **Filter at read time**: every iteration / filter / aggregation in the app excludes `deletedAt != null` rows. There is NO global "show deleted" toggle in the main views — only Cestino shows them.
- **Elimina action** = set `deletedAt = new Date().toISOString()` and call `salva()`.
- **Auto-purge** runs at `init()` boot: walks all soft-deleted items, hard-removes any with `deletedAt < now() - 30 days`. Runs once per boot. Log to console for observability.
- **Cascading restore**: when a Proprietà is restored from Cestino, also clear `deletedAt` on its child Incassi. Utenze are linked but per REQ-SAFE-01 NOT individually soft-deletable in PR1 — they stay linked to the proprietà (their `proprietaId` is preserved, so on restore they reappear naturally since they don't have a tombstone).
- **Hard-delete from Cestino** = array splice + `salva()`. Cascading: hard-deleting a Proprietà also hard-deletes all its Incassi (orphans are bad).

### Cestino view (LOCKED structurally; visual = handoff glass-table pattern)
- Lives in Impostazioni as a new section "Cestino" using the existing `.glass-table` styling.
- Columns: Nome / Tipo (Proprietà | Incasso) / Data eliminazione (relative: "3 giorni fa") / Azioni.
- Action buttons per row: "Ripristina" (primary), "Elimina definitivamente" (danger, with confirm modal).
- "Svuota cestino" footer action (clears all >0 days old; not >30 days, because >30 is auto-purged).
- Empty state: italic muted text "Il cestino è vuoto".

### Snapshot ring buffer (LOCKED)
- localStorage key: `gestione_affitti_snapshots`
- Shape: `Array<{ ts: ISOString, dati: <whole state object> }>` of length ≤10.
- Push: every successful `salva()` pushes a snapshot of the **pre-mutation** state. The snapshot captured is the state BEFORE the current save completes, not after. Implementation: take the snapshot at the top of the mutation flow, before mutating, persist on success.
- Ring trim: when length >10, shift oldest.
- **Coordination with cestino**: snapshot is whole-state. Restoring a snapshot **overwrites** current state entirely (including current cestino). Trash items in current state may disappear; trash items in snapshot may reappear. UI must warn the user: "Ripristinare lo snapshot del [data] sovrascriverà lo stato attuale. Continuare?"
- "Ripristina snapshot" page in Impostazioni: timeline (most recent first), each row shows ts (relative + absolute), counts diff vs current (proprietà ±N, incassi ±N, utenze ±N), "Ripristina" action with confirm modal.

### Undo toast (LOCKED behavior)
- Bottom-screen toast, slides in from bottom, glass-style consistent with PR0.
- Shown 5 seconds after each destructive action (delete proprietà, delete incasso, delete utenza, delete banca, mass operations).
- Action: button "Annulla".
- Coordination with multiple rapid destructive actions: **stack model** — each new toast replaces the previous one (only the latest action is undoable via toast; older ones are recoverable via Cestino / Snapshot). Document this trade-off in CONTEXT — simpler than queue, and the safety net is still complete (Cestino+Snapshot).
- Click "Annulla" within 5s → restore pre-state, dismiss toast.
- Auto-dismiss after 5s (no further action possible).
- Click toast body / Escape: optional dismiss without undo (Claude's discretion).
- Implementation: Alpine state `undoToast: { active: bool, message: string, preState: object, expiresAt: ts }` in root `app()` component. Single timer, cleared on replacement or undo.

### Salute dati page (LOCKED for PR1 fields)
- New section in Impostazioni "Salute dati".
- **Counts**:
  - Proprietà attive / soft-deleted
  - Incassi attivi / soft-deleted
  - Incassi orfani (proprietaId points to non-existent proprietà) — count + "Ripara orfani" button (Claude's discretion: either deletes orphans or assigns them to a "Senza proprietà" placeholder). Recommendation: button just shows them grouped (read-only) for PR1; auto-repair is risky.
  - Incassi importo=0 — count + jump-link to filter view
  - Utenze importo=0
- **Sync state**: `ultimo sync` (from existing Supabase sync timestamp), `dimensione blob` (JSON.stringify(dati).length / 1024 KB).
- **Storage usage**: `navigator.storage.estimate()` → percentuale used.
- **Errori**: last 50 from `localStorage.errori[]`, expandable list (collapsed by default), "Invia diagnostica" button.
- **"Invia diagnostica"**: opens `https://wa.me/<numero>?text=<encoded last 50 errors>` in new tab. Phone number = Claude's discretion (probably user's own brother number — researcher to confirm there's a config slot).
- **PR2b extensions are NOT in PR1**: mutation queue count, last flush, etc. The page has clear "Sezione Sync" placeholder text that says "Disponibile dopo migrazione schema (PR2b)".

### Error capture (LOCKED)
- `window.addEventListener('error', handler)` and `window.addEventListener('unhandledrejection', handler)` registered at `init()`.
- Handler pushes `{ ts, message, stack?, url?, line? }` to `localStorage.errori[]` (ring of 50, FIFO).
- Errors are never thrown back; just logged and stored.

### Validation (LOCKED)
- **Importo=0 on Incasso save**: soft-confirm modal "L'importo è 0. Confermi?" with Conferma/Annulla. Default Annulla. Existing partial impl in `salva()` should be reviewed and aligned.
- **Banca missing on Incasso save**: warning toast "Nessuna banca selezionata — l'incasso non sarà conteggiato nei totali per banca." Non-blocking.
- **Currency mismatch**: when adding incasso to proprietà whose banca is in a different currency than the incasso amount input — warning toast. Non-blocking.

### 3 Bugfix (LOCKED — DEC-020)
1. **`importaJSON`**: after parsing JSON, must call `this.migraDati(this.dati)` before `await this.salva()`. Current line ~1588 in index.html missing the migration step → imports from old schemas crash silently.
2. **`generaIncassiAttesi`**: must skip incassi that have `modificatoManualmente === true`. Currently overwrites user-edited amounts on every run.
3. **`salva()` catch chain**: separate handlers for (a) Supabase auth-expired → call `supabase.auth.refreshSession()` and retry once; (b) network error → set `modalitàOffline = true`, show toast, persist to localStorage cache only; (c) RLS error → toast "Errore di permessi" + log to errori[]; (d) other → generic error toast + log.

### app.js extraction (LOCKED — DEC-020)
- Move the entire `<script>` block (currently 1265–1939 in index.html, ~675 lines) into `app.js` at repo root.
- Replace inline block with `<script src="app.js" defer></script>` (defer to match current execution order with Alpine).
- All function/variable scoping preserved. `function app()` stays a global so Alpine `x-data="app()"` keeps working.
- `migraDati` and other helpers move alongside.
- `index.html` shrinks from ~1939 to ~1265 lines.
- **No module syntax** — classic script. (Module would require CORS for file:// and complicate Alpine integration.)

### Playwright regression additions (LOCKED set)
The phase MUST add at least these new tests to the existing suite:
1. **Cestino round-trip**: delete proprietà → appears in Cestino → click Ripristina → reappears in main view with related incassi.
2. **Cestino hard delete**: delete proprietà → Elimina definitivamente → confirm → no longer in Cestino, related incassi also gone.
3. **Undo toast**: delete incasso → toast appears → click Annulla → incasso reappears within 5s.
4. **Snapshot timeline**: make 2 saves → snapshot count = 2 → restore second-to-last → state matches expected.
5. **Salute dati counts**: create 3 proprietà, delete 1, expect counts "2 attive / 1 nel cestino".
6. The 5 LOCKED regression tests (Phase 1 CON-017) still pass.
7. The 8 LIVE tests still pass.

### Branch + PR strategy (LOCKED — confirmed from Phase 2 outcome)
- Branch: `pr1-data-safety-net` from master.
- Single PR titled "feat(pr1): Data Safety Net + bugfix + app.js".
- Required check: `test` (NOT `Playwright Tests` — that mismatch was fixed in Phase 2 ruleset update).
- Squash merge with full body Co-Authored-By.

### Claude's Discretion (NOT locked)
- Exact CSS for snapshot timeline diff visualization (use glass-table or custom?)
- Whether undo toast supports queue mode (LOCKED as stack model above)
- Whether "Ripara orfani" auto-repairs or just shows
- WhatsApp number for "Invia diagnostica" — likely a config in `app.js` constants
- Format of error dump in WhatsApp message (formatted text vs JSON)
- Order of task execution within layers
- Whether to add a Cypress-style "data-testid" for cestino rows (recommended)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before producing artifacts.**

### Phase requirements and decisions
- `.planning/REQUIREMENTS.md` § REQ-SAFE-01..07 (REQUIREMENTS.md:29-67)
- `.planning/ROADMAP.md` § Phase 3 (PR1) — 6 numbered success criteria (lines 46-58)
- `.planning/intel/decisions.md` DEC-020 (PR1 bugfix + extraction)
- `.planning/intel/decisions.md` DEC-001 (LOCKED PR sequence)
- `.planning/intel/constraints.md` — no build, single-file (now to be split: index.html + app.js), family-tier
- `wiki/projects/gestione-affitti-ceo-plan-20260517.md` § "PR1 — Data Safety Net" (line 41–43) + § "Code quality — bugfix da aggiungere a PR1" (lines 240–246) + § Risk Register R1

### Code reference (post-PR0 state)
- `index.html` — 1939 lines after PR0. Inline `<script>` lives at 1265–1939. Functions of interest:
  - `function migraDati(dati)` at 1265 — schema migration helper, used by both load and (after bugfix 1) `importaJSON`
  - `function app()` at 1286 — Alpine root component, contains all state + methods
  - `generaIncassiAttesi()` at 1593 — needs `modificatoManualmente` flag check (bugfix 2)
  - `importaJSON(event)` at 1586 — needs `migraDati()` call (bugfix 1)
  - `eliminaIncasso(id)` at 1767, `eliminaUtenza(id)` at 1864, `eliminaProprieta(id)` at 1904, `eliminaBanca(id)` at 1923 — destructive actions to be converted to soft-delete (incasso + proprietà) or to fire undo toast (utenza + banca, no soft-delete in PR1 but still undo-able for 5s)
  - `async salva()` — catch chain needs splitting (bugfix 3)

### Test infrastructure (must remain green)
- `tests/` — Playwright suite. Specifically `tests/calendario.spec.ts`, `tests/login.spec.ts`, `tests/fixtures.ts` already updated in PR0.
- `.github/workflows/playwright.yml` — CI gate, required check `test`.
- `playwright.config.ts` — base config.
- Phase 1 closure: `.planning/phases/01-pr5-test-infrastructure/01-01-SUMMARY.md`

### UI patterns from PR0 (reuse, do not reinvent)
- `.glass-card` / `.glass-table` / `.btn-primary` classes defined in `index.html` `<style>` block
- Toast pattern: there is no global toast component yet — PR1 introduces it. Use glass surface + bottom-fixed positioning.
- Modal pattern: existing `mostraForm*` Alpine state pattern for inline forms; soft-confirm modals should use this same pattern (avoid a new modal abstraction).

### Repo state references
- `master` HEAD: `745b854 feat(pr0): Apple Sonoma redesign — Phase 2 PR0` (Phase 2 closure)
- Branch protection: ruleset `master-protect` Active, required check `test`
- Deploy: GitHub Pages auto on push to master

</canonical_refs>

<specifics>
## Phase Specifics

**Effort estimate**: ~2.5–3.5h of focused implementation. This is the largest phase so far (touches state model + 4-5 new UI screens + bugfix + extraction). Plan-checker may revise up; treat 4h as the realistic ceiling. If the executor approaches 5h, **escalate to user** rather than push through.

**PR strategy**: Single PR named "feat(pr1): Data Safety Net + bugfix + app.js" against `master`. Required check: `test` (Playwright). Squash merge.

**Risk register**:
- **R-A**: Snapshot ring buffer + cestino interaction creates user confusion. Mitigation: explicit warning modal on snapshot restore; document the relationship in Salute dati help text.
- **R-B**: `app.js` extraction breaks Alpine wiring if `defer` / load order is wrong. Mitigation: keep `function app()` global; verify Alpine `x-data="app()"` resolves at DOMContentLoaded by manual smoke before commit. Plan must include a smoke task.
- **R-C**: Soft-delete migration of existing user data: Stefano's brother already has data in production with HARD-deleted entities (gone forever). PR1 only protects from this point forward — past data loss is not recoverable. Mitigation: communicate in release notes; add a one-time migration that initializes `deletedAt: null` on all existing rows (idempotent).
- **R-D**: Auto-purge after 30 days could surprise the user. Mitigation: log to console on purge; surface in Salute dati ("N elementi auto-rimossi nell'ultimo boot — sopra il limite di 30 giorni").
- **R-E**: `localStorage.errori[]` could grow unbounded if a buggy state spams errors. Mitigation: ring of exactly 50, FIFO. Document the cap.
- **R-F**: Playwright selector breakage in existing 13 specs (5 LOCKED + 8 LIVE). Mitigation: same-commit fixture update strategy proven in PR0 — use it again.
- **R-G**: Currency mismatch warning requires knowing each banca's currency. Mitigation: check if `banche` already has `currency` field; if not, this validation is impossible in PR1 → degrade gracefully to "Banca selezionata, importo confermato?" generic warn. Researcher to confirm.

**Definition of Done** (10 items, ordered):
1. Soft-delete works on Proprietà + Incassi; reads filter `deletedAt != null`; auto-purge runs at boot
2. Cestino view in Impostazioni shows soft-deleted items; Ripristina restores (cascading); Elimina definitivamente hard-deletes (cascading)
3. Snapshot ring buffer of 10 captures pre-`salva()` state; Ripristina snapshot timeline view works; restore overwrites with confirm modal
4. Undo toast appears 5s after every destructive action; "Annulla" restores; stack model (latest only)
5. Salute dati page shows all locked counts + sync + storage + errori; "Invia diagnostica" opens WhatsApp; PR2b sections show placeholder
6. Importo=0 soft-confirm, banca-missing warn, currency-mismatch warn implemented
7. 3 bugfix applied and verified by manual test (import old JSON, edit incasso with modificatoManualmente, force-expire auth)
8. `<script>` block extracted to `app.js`; `index.html` < 1300 lines; Alpine wiring intact
9. 5 new Playwright tests added (cestino round-trip, hard-delete, undo, snapshot restore, Salute dati counts); 5 LOCKED + 8 LIVE still pass; CI green
10. PR1 merged to master via green CI; deploy live; manual smoke on iPhone viewport confirms drawer + new views work post-PR1

</specifics>
