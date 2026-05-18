# Phase 2: PR0 — Apple/Sonoma Redesign + Responsive — Context

**Gathered:** 2026-05-18
**Status:** Ready for research
**Source:** PRD Express Path (`wiki/projects/gestione-affitti-ceo-plan-20260517.md` + design handoff bundle `sbPqzZsV396NsMp4jSK5eQ`)

<domain>
## Phase Boundary

Full UI redesign of `index.html` (single-file Alpine + Tailwind CDN app) per the Apple/Sonoma design handoff. Every view (Dashboard, Calendario, Proprietà, Banche, Utenze, Impostazioni, Login) is restyled with glass surfaces over an abstract USA-palette CSS mesh background. Sidebar collapses to a drawer overlay below 900px viewport. The ~4.7MB video MP4 is removed from the bundle. Design tokens, typography, and component patterns come from the handoff `:root`.

**In scope:**
- Visual restyle of every existing view + login screen
- Responsive sidebar→drawer transformation (<900px)
- Removal of `276973.mp4` and any other video assets, replaced by CSS mesh
- Adoption of Inter Tight / Inter / JetBrains Mono via Google Fonts
- Design tokens (`:root` CSS custom properties) from handoff
- `.design-ref/` directory in repo with handoff bundle as visual reference (gitignored)
- Preserve no-build-step constraint (Alpine + Tailwind CDN + CSS custom only)
- All 5 LOCKED Playwright regression tests must still pass post-redesign

**Out of scope (deferred to later phases):**
- New entities (inquilini, tipi_utenza dinamici) — Phase 5 (PR2b)
- Cestino, snapshot, undo toast UI — Phase 3 (PR1)
- PWA manifest + service worker — Phase 4 (PR2a)
- Dark mode (explicitly out per CEO plan)
- ⌘K command palette (visually present in handoff but NOT wired — defer)
- Edit/Delete buttons in Impostazioni for entities not yet existing (handoff has placeholders)
- Any data-model change, any Supabase change

</domain>

<decisions>
## Implementation Decisions

### Stack & Build (LOCKED)
- **No build step**: Alpine.js + Tailwind CDN + CSS custom semantico only. NO PostCSS, NO Vite, NO bundler. Source of truth: DEC-001, DEC-019.
- **Single-file `index.html`** preserved. CSS custom may live inline in `<style>` block or in `style.css` if extraction is cleaner — Claude's discretion.
- **No new runtime dependencies** beyond Google Fonts CSS.

### Visual Identity (LOCKED from handoff `sbPqzZsV396NsMp4jSK5eQ`)
- **Aesthetic**: macOS Sonoma / iPadOS — frosted glass surfaces, traffic lights (decorative) top-left of window shell, generous corner radius, system-blue accent.
- **Background mesh**: USA-flag-inspired but **abstract**, NOT figurative. 6 soft orbs in flag palette (2 navy/blue, 2 red, 2 cream) under `filter: blur(45px) saturate(125%)`. Plus a subtle SVG grain in `mix-blend-mode: overlay`. No stripes, no stars, no literal flag pattern.
- **Glass surfaces**: `background: rgba(255,255,255,0.35)`, `backdrop-filter: blur(60px) saturate(200%)`, white inset highlight `inset 0 1px 0 rgba(255,255,255,0.7)`, semi-translucent border.
- **Theme**: Light only (no dark mode in PR0).

### Typography (LOCKED)
- **Display**: Inter Tight (negative letter-spacing for large headings)
- **Body**: Inter
- **Numerals (tabular)**: JetBrains Mono — for importi, dates, counts
- **Loading**: Google Fonts via `<link>` (CSS, no JS). `font-display: swap`.

### Layout & Components (LOCKED structurally; visual details = Claude's discretion)
- **Window shell**: glass surface with traffic-lights row top-left, contains sidebar + main pane.
- **Sidebar** (desktop ≥900px): persistent left rail with app logo "Affitti v2.0", sections `PANORAMICA` (Dashboard, Calendario), `GESTIONE` (Proprietà, Banche, Utenze), `ACCOUNT` (Impostazioni). Active item shown as filled blue pill.
- **Sidebar** (mobile <900px): hidden by default, opens as overlay drawer (slide-in from left with backdrop). Hamburger trigger in topbar. Tap-outside-to-close. Body scroll lock while open.
- **Topbar of main pane**: page title (Inter Tight, large) + subtitle, optional search input with `⌘K` hint (visual only — wiring deferred), optional primary action button (e.g. "Esporta").
- **Cards / tables / modals**: all glass-surfaced with inset white highlight. Border-radius generous (handoff `:root` token).
- **Login screen**: glass card centered over full-viewport mesh. Same typography. Remove the `276973.mp4` video element entirely.

### Responsive Breakpoints (LOCKED)
- **Single breakpoint at 900px** for sidebar collapse. Below 900px: drawer mode. Above: persistent sidebar.
- All other responsive adjustments (font scaling, padding, card grid columns) at Claude's discretion via Tailwind utilities.
- **Thumb-first verification target**: iPhone (390×844 reference) — primary actions reachable in bottom half.

### Design Tokens — Claude's Discretion (extract from handoff `:root`)
The planner/executor must extract these values from the handoff HTML's `:root` block and apply consistently:
- Palette: surface tints, accent blue, text color ramp, mesh orb colors
- Radius scale (likely 8 / 12 / 16 / 24 / 32 px)
- Shadow scale (subtle + medium + elevated)
- Blur intensities (surface vs background)
- Spacing scale

Token names should be CSS custom properties on `:root`. Use semantic names (`--surface-glass`, `--accent-primary`, `--radius-lg`) not raw values scattered through Tailwind classes. Tailwind utilities may reference them via `arbitrary values` syntax `bg-[var(--surface-glass)]`.

### Asset Cleanup (LOCKED)
- **Remove**: `276973.mp4` (4.7MB), any other video files referenced from `index.html` or `login.html` equivalents.
- **Add**: `.design-ref/` directory in repo containing a copy of the handoff bundle for visual reference during implementation. **Must be in `.gitignore`** — do not commit the bundle.
- **Verify**: `git ls-files` shows no `*.mp4` after the phase commits.

### Regression Safety (LOCKED)
- All 5 LOCKED Playwright regression tests (from Phase 1 / CON-017) must pass against the redesigned `index.html` before the phase closes. The planner must include a verification task that runs the suite locally and in CI.
- The 8 LIVE tests currently passing on master must remain green.
- Branch-and-PR flow required (per Phase 1 outcome): no direct push to master for code changes; the redesign ships as a single PR (PR0).

### Mobile Drawer — Behavior Notes (Claude's discretion on implementation, locked on UX)
- Trigger: hamburger icon in topbar, visible only <900px (CSS-only or Alpine `x-show`).
- Animation: slide-in from left, 200–250ms ease-out. Backdrop fades in.
- Dismiss: tap backdrop, tap a nav item, swipe-left (nice-to-have), `Escape` key.
- Body scroll lock while open.
- Focus trap: nice-to-have, not blocking.

### What is INTENTIONALLY skipped in PR0
- ⌘K search wiring (visual placeholder only)
- Impostazioni Edit/Delete row actions for entities (Cestino, tipi_utenza CRUD — those land in their own phases)
- Any change to Alpine state shape, any change to localStorage keys, any change to Supabase calls
- Animation polish beyond the drawer transition (microinteractions can land later)

### Claude's Discretion (NOT locked)
- Whether CSS lives inline in `<style>` or extracted to `style.css`
- Whether Alpine logic for the drawer toggle uses a new `x-data` scope or extends the existing `app()` component
- Exact pixel values for shadows / spacing (extract from handoff)
- How to organize CSS custom properties (single `:root` block vs grouped by concern)
- Order of view restyle (which view first) — researcher should propose

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before producing artifacts.**

### Phase requirement and scope source
- `.planning/REQUIREMENTS.md` — REQ-UI-01 (Phase 2 requirement definition)
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 numbered TRUE statements)
- `.planning/intel/decisions.md` — DEC-019 (Apple/Sonoma redesign as PR0, locked)
- `.planning/intel/decisions.md` — DEC-001 (LOCKED PR sequence: PR5 → PR0 → PR1 → ...)
- `.planning/intel/constraints.md` — single-file index.html, no build step, family-tier

### Strategy & design context
- `wiki/projects/gestione-affitti-ceo-plan-20260517.md` — Source of truth for PR0 decisions (sections: "PR0 — Apple redesign decisioni", "Architettura — additions", "Performance — additions")
- `wiki/projects/gestione-affitti-design-pwa-20260517.md` — Vision and approach context
- `wiki/projects/gestione-affitti.md` — Stack, architecture, known limits

### Design handoff bundle (READ DIRECTLY)
- `wiki/projects/gestione-affitti-design-handoff/README.md` — Coding-agent instructions from Claude Design
- `wiki/projects/gestione-affitti-design-handoff/chats/chat1.md` — Full iteration transcript: shows user intent ("look super premium stile apple.com → macOS/iPadOS glass → bandiera USA astratta"), final mesh recipe, locked palette
- `wiki/projects/gestione-affitti-design-handoff/project/design_handoff_apple_redesign/Gestione Affitti.html` — **PRIMARY DESIGN FILE**. Read top to bottom. Extract `:root` design tokens, glass surface CSS, mesh background CSS, typography, component patterns.
- `wiki/projects/gestione-affitti-design-handoff/project/design_handoff_apple_redesign/js/` — Component prototypes (`app.jsx`, `data.js`, `icons.jsx`, `ui.jsx`, `views.jsx`) — visual reference for component composition, NOT to be copied as React (target is Alpine).
- `wiki/projects/gestione-affitti-design-handoff/project/screenshots/01-dashboard.png` + `02-dashboard-hq.png` — Reference screenshots for Dashboard view.

### Test infrastructure (Phase 1 outputs — must remain green)
- `.planning/phases/01-pr5-test-infrastructure/01-01-SUMMARY.md` — Phase 1 closure summary
- `tests/` (or wherever Playwright suite lives in the repo) — 5 LOCKED regression tests + 8 LIVE tests
- `.github/workflows/playwright.yml` — CI gate; `paths-ignore: .planning/**, docs/**, **.md` (planning/doc changes skip CI)

### Repo state references
- `index.html` — Current app source. Single file. Contains Alpine `app()` component, inline `<style>`, login screen embedded.
- `276973.mp4` — Asset to remove.
- `.gitignore` — Add `.design-ref/` entry.

</canonical_refs>

<specifics>
## Phase Specifics

**Effort estimate**: ~1.5–2h of focused implementation (RESUME doc). Planner should size tasks accordingly.

**PR strategy**: Single PR named "PR0 — Apple/Sonoma redesign + responsive" against `master`. Required check: `Playwright Tests` (green required for merge per `master-protect` ruleset).

**Risk notes**:
- **R-A**: Heavy `backdrop-filter` + multiple blurred orbs can tank perf on low-end Android. Mitigation: cap mesh to ≤6 orbs, use `will-change: transform` sparingly, test on real device or DevTools 4× CPU throttle.
- **R-B**: Google Fonts FOUT. Mitigation: `font-display: swap` and a serviceable system-font fallback stack.
- **R-C**: Existing Alpine `x-data` event wiring may break if classes/structure change. Mitigation: planner must keep all `@click` handlers, `x-model`, `x-show` directives, and DOM hooks (`data-testid`?) intact. Visual classes can change freely.
- **R-D**: Playwright selectors that match by visual text are robust; selectors that match by class/structure may break. Test suite must pass — fix selectors as part of PR0 if they break, with explicit justification.

**Definition of Done**:
1. Every view restyled per handoff (Dashboard, Calendario, Proprietà, Banche, Utenze, Impostazioni, Login)
2. Mesh background visible behind all glass surfaces
3. Inter Tight + Inter + JetBrains Mono loaded from Google Fonts and applied
4. Sidebar collapses to drawer overlay <900px, persistent ≥900px
5. `276973.mp4` removed from repo (`git ls-files | grep mp4` empty)
6. `.design-ref/` exists and is in `.gitignore`
7. All 5 LOCKED Playwright tests pass locally and in CI
8. All 8 LIVE tests still pass
9. Lighthouse mobile score: no regression vs pre-PR0 baseline (informational, not blocking)
10. PR0 merged to master via green CI

</specifics>
