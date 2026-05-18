# Phase 4: PR2a — PWA shell (manifest, SW) — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** PRD Express Path — derived from `.planning/ROADMAP.md` Phase 4 entry, `.planning/REQUIREMENTS.md` REQ-PWA-01..03, `.planning/PROJECT.md` DEC-002/DEC-004/CON-010/CON-011/CON-017, `wiki/projects/gestione-affitti-ceo-plan-20260517.md`, and `wiki/projects/gestione-affitti-RESUME.md` (PR1 carry-over)

<domain>
## Phase Boundary

PR2a delivers the **installable PWA shell**: an `index.html` that registers a versioned `sw.js`, ships a `manifest.json`, unregisters stale service workers from prior sessions at boot, and shows a custom Italian "Aggiungi alla schermata Home" banner after 3 sessions in 7 days.

**In scope:**
- `manifest.json` (name, icons 192/512/1024, theme color, start_url, scope, display=standalone)
- `sw.js` separate file (NOT inline), versioned cache name, Stale-While-Revalidate for app shell + pinned CDN, cache cleanup at `activate`, `skipWaiting()` on update
- Stale-SW unregistration at boot (preserves CON-017 regression test #3 invariant)
- Custom install prompt: dismissable banner, 3-sessions-in-7-days threshold, "doesn't reappear for N days" after dismiss
- 2 carry-over fixes from PR1 (Phase 3): `UNDO-01` skip + `SNAP-01` skip — see <specifics>
- Lighthouse PWA score ≥ 90 on mobile (success criterion #5 from ROADMAP)

**Out of scope (deferred to PR2b / Phase 5):**
- Per-entity sync, mutation queue (idb-keyval), conflict UI — those are PR2b. DEC-004 splits PWA shell from schema migration explicitly so the two failure modes stay independent.
- Push notifications scheduler (PR3)
- Offline write queue (PR2b)
- Photo pipeline / PDF / OCR (PR3/PR4)

</domain>

<decisions>
## Implementation Decisions

### Locked architecture (DEC-002, DEC-003, DEC-004)
- **DEC-002** Approach B: real PWA + feature core. PR2a is the PWA-shell half of that approach.
- **DEC-003** Stack lock: Alpine + Tailwind CDN + CSS custom, no build step, single-file `index.html`.
- **DEC-004** PR2 split into PR2a + PR2b. PR2a = PWA shell. PR2b = schema migration + per-entity sync. **Independent failure modes**: a SW bug must not block schema work, and a schema bug must not block install.

### Service worker contract (CON-010)
- Separate `sw.js` file at site root (NOT inlined in `index.html`).
- Stale-While-Revalidate strategy for app shell (`/`, `/index.html`, `/app.js`) and pinned CDN dependencies (Tailwind, `@supabase/supabase-js@2`, `alpinejs@3`).
- Versioned cache name (e.g. `gestione-affitti-v{N}`); on `activate`, delete caches whose name does not match the current version.
- `self.skipWaiting()` on `install` so updates activate without forcing the user to close all tabs.
- `clients.claim()` on `activate` so the new SW takes control of open tabs immediately.
- Stale SW from prior sessions unregistered at boot (CON-017 regression #3 — `unregister-stale-sw` must stay green).
- `<script>` already extracted to `app.js` in PR1 (Phase 3 commit `c91959c`); shell list MUST include both `index.html` and `app.js`.

### Manifest (REQ-PWA-01)
- `name`: "Gestione Affitti"
- `short_name`: "Affitti"
- `icons`: 192/512/1024 PNG (generated via favicon.io from 🏠 emoji + gradient per CEO plan §"PR2a — PWA installabile")
- `display`: `standalone`
- `theme_color`: matches design token `--bg-primary` from Apple/Sonoma redesign (PR0)
- `background_color`: matches Apple/Sonoma redesign neutral background
- `start_url`: `./` (relative — GitHub Pages serves from `/gestione-affitti/`)
- `scope`: `./`
- `lang`: `it`

### Install prompt (REQ-PWA-03)
- Trigger: user has opened the app at least 3 times in a rolling 7-day window AND has not already installed AND has not dismissed within last N days.
- Wording (Italian, locked): **"Aggiungi alla schermata Home"** primary; secondary CTA "Più tardi".
- Dismiss: persists in `localStorage.gestione_affitti_install_dismissed_until = <ISO date>`; banner does NOT reappear before that date. N value to be decided by planner (recommendation: 14 days).
- iOS Safari: `beforeinstallprompt` is unavailable on iOS; show the same banner with iOS-specific instructions ("Tocca Condividi → Aggiungi a Home") per CON-011.
- Chrome desktop + Android Chrome: use `beforeinstallprompt` event captured at app load; banner click calls `event.prompt()`.

### Carry-over fixes from PR1 (mandatory inclusion in this phase)
Per `wiki/projects/gestione-affitti-RESUME.md`, two Playwright tests were skipped at the end of PR1 and MUST be re-enabled in PR2a:

1. **`UNDO-01` skip** — Alpine reactivity through `attivi()` helper indirection. `cestinoItems` (calls `attivi()` directly) works; `gruppiCalendario` (also gated by `attivi()`) does not re-render after undo. Hypothesis: indirection breaks Alpine's proxy dependency tracking. Falsifiable in ~10 minutes; fix is likely a direct `.filter()` call inside `gruppiCalendario` getter or a manual `$nextTick` trigger.
2. **`SNAP-01` skip** — Snapshot ring buffer trace shows 0 `localStorage.setItem` writes despite 2 saves. `_lastSnapshotData` priming does not land in the Alpine proxy. Investigate timing between `init()` (sync) and `caricaDatiUtente` (async); the priming likely runs before reactive state is set up.

Both fixes ship in the PR2a branch, alongside the PWA shell, since PR2a is the next branch that touches `app.js` anyway and re-enabling those tests can't wait until Phase 5.

### Branch + CI (process locked)
- Branch: `pr2a-pwa-shell`
- Workflow: branch + PR + squash-merge to master (matches PR0/PR1 pattern).
- Required check: `test` (job name, not workflow name — that landmine was found and fixed in PR0).
- **Correction (2026-05-18, post-research):** `.github/workflows/playwright.yml` does **NOT** actually have a `paths-ignore` clause (verified by reading the file). The RESUME.md claim was aspirational, not factual. Planning-only commits currently trigger CI; tests pass because the changes don't touch code. Planner: consider adding `paths-ignore: ['.planning/**', 'docs/**', '**.md']` as an optional task in PR2a to save CI minutes, or leave it for a follow-up.

### Claude's Discretion
- Exact icon palette and gradient (favicon.io params).
- `N` days for "don't reappear after dismiss" — recommendation 14, planner to confirm.
- Cache version bump strategy (semver-ish e.g. `v1`, `v2`, or commit-sha derived) — planner picks.
- Banner visual treatment: must use existing `.glass-card` + `.btn-primary` classes from PR0 design system (NO new global CSS), but exact placement (bottom-sheet vs top-banner vs toast) is open.
- Where to register the SW in `app.js` (likely inside `init()` after auth init).
- Whether to include `serviceworker.js` legacy filename redirect — discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-wide locked decisions
- `.planning/PROJECT.md` — LOCKED decisions (DEC-002 Approach B, DEC-003 stack, DEC-004 PR2 split), constraints CON-010 (SW contract), CON-011 (iOS), CON-012 (lazy-load), CON-017 (regression-lock), CON-018 (critical paths).
- `.planning/REQUIREMENTS.md` § "PR2a — PWA shell" (REQ-PWA-01, REQ-PWA-02, REQ-PWA-03).
- `.planning/ROADMAP.md` § "Phase 4: PR2a — PWA shell (manifest, SW)" — 5 success criteria.

### Intel layer (already synthesized)
- `.planning/intel/decisions.md` § DEC-002, DEC-003, DEC-004.
- `.planning/intel/constraints.md` § CON-010 (SW contract), CON-011 (iOS Safari), CON-017 (regression-lock), CON-018 (critical paths).
- `.planning/intel/requirements.md` § REQ-PWA-01..03.

### Source-of-truth design docs
- `wiki/projects/gestione-affitti-ceo-plan-20260517.md` § "PR2a — PWA installabile" (manifest spec, SW spec, install prompt spec, risk R2).
- `wiki/projects/gestione-affitti-design-pwa-20260517.md` § Approach B PWA rationale.
- `wiki/projects/gestione-affitti-RESUME.md` — PR1 carry-over (UNDO-01, SNAP-01) MUST be fixed in this phase.

### PR0/PR1 outputs (precedent + design system)
- `index.html` post-PR0 — Apple/Sonoma design tokens in `<style>`, `.glass-card`, `.btn-primary` classes the install banner must reuse.
- `app.js` post-PR1 — extracted application logic; SW registration goes here.
- `.planning/phases/02-pr0-apple-sonoma-redesign/02-01-SUMMARY.md` — design token reference + lessons learned.
- `.planning/phases/03-pr1-data-safety-net/03-01-SUMMARY.md` — PR1 closure summary (includes UNDO-01/SNAP-01 skip reasoning).

### CI / branch protection
- `.github/workflows/playwright.yml` — paths-ignore rules, job name = `test` (the required check).
- GitHub ruleset `master-protect` — required check `test`; no direct push of code to master.

### Test inventory (locked)
- `.planning/intel/constraints.md` § CON-017 — 5 LOCKED Playwright regressions; PWA work MUST NOT regress test #3 (stale-SW unregister) or any other.
- Playwright `tests/` directory — 8 LIVE tests + 2 SKIP (UNDO-01, SNAP-01) at end of PR1.

</canonical_refs>

<specifics>
## Specific Ideas

### Success criteria (verbatim from ROADMAP Phase 4)
1. User on Chrome desktop or Android can "Aggiungi a Home" and the app launches standalone with proper icon and theme color.
2. Versioned `sw.js` (separate file) serves the app shell and pinned CDN assets with Stale-While-Revalidate; cache cleanup runs at `activate`; `skipWaiting()` runs on update.
3. Stale service workers from previous sessions are unregistered at boot (CON-017 regression #3 still passes).
4. After 3 sessions in 7 days, a dismissable Italian install banner ("Aggiungi alla schermata Home") appears; once dismissed it doesn't reappear for N days.
5. Lighthouse PWA score ≥ 90 on mobile.

### Files expected to change
- `index.html` — `<link rel="manifest">`, `<meta name="theme-color">`, Apple-touch-icon meta, register-SW call site (probably moves to `app.js`).
- `app.js` — SW registration code, install-prompt event capture, session counter increment, banner show/dismiss logic, `UNDO-01` fix (`gruppiCalendario` reactivity), `SNAP-01` fix (snapshot priming timing).
- `sw.js` — new file, ~150 lines (install/activate/fetch handlers, SWR strategy, versioned cache, cleanup).
- `manifest.json` — new file.
- `icons/` — new directory with 192/512/1024 PNGs (apple-touch-icon 180px too).
- `tests/` — un-skip `UNDO-01` and `SNAP-01` Playwright specs; add at least 1 new Playwright spec for PWA install criteria (or document a manual Lighthouse check if Playwright can't assert install eligibility).

### Risk reminders from CEO plan + eng review
- **R2** SW cache stale after deploy — mitigated by versioned cache + cleanup + `skipWaiting`. Test: deploy v1, install, deploy v2 with cache name bump, verify next reload serves v2.
- iOS Safari `beforeinstallprompt` does NOT fire — banner must show iOS-specific copy.
- Service Worker scope on GitHub Pages: site is served from `https://oldpz.github.io/gestione-affitti/`; SW scope MUST be `./` (relative) to avoid scope errors. Register with `{ scope: './' }`.

### Pre-flight notes for executor (likely landmines)
- `sw.js` MUST be served from the same path as `index.html` for scope to cover the app. On GitHub Pages this is `/gestione-affitti/sw.js`. Test locally with `npx serve` not `file://`.
- Chrome's install criteria require: HTTPS (GH Pages: yes), manifest with required fields, SW with fetch handler. Lighthouse will fail if any missing.
- Existing `paths-ignore` in `playwright.yml` does NOT exclude `sw.js`, `manifest.json`, or icons — so PWA-touching commits WILL trigger CI. Good.
- Squash-merge to master is the locked flow; the executor must NOT direct-push code to master.

### Estimation guard
Per CON-020, original 3-4 session estimates are typically optimistic. Anchor planner stim at 4-5h realistic, with explicit time-cap per task (25 min cap that worked well in PR0).

</specifics>

<deferred>
## Deferred Ideas

- **Push notifications scheduler in SW** — deferred to PR3 (REQ-FEAT-01). PR2a's SW is fetch-only.
- **Offline mutation queue + idb-keyval** — deferred to PR2b / Phase 5. PR2a's SW does NOT queue writes.
- **Background Sync API** — deferred to PR2b; PR2a uses only the boot-time "check on app open" fallback path from CON-011.
- **Per-entity schema migration** — Phase 5.
- **iOS Safari "real" PWA notification path** — Phase 5/6; PR2a only ships the "Aggiungi a Home" banner that CON-011 calls out as prerequisite.
- **Dark mode toggle** — explicitly out of scope project-wide (PROJECT.md "Out of scope").

</deferred>

---

*Phase: 04-pr2a-pwa-shell-manifest-sw*
*Context gathered: 2026-05-18 via PRD Express Path*
