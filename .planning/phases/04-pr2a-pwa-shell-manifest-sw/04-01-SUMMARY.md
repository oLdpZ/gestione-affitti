---
phase: 04-pr2a-pwa-shell-manifest-sw
plan: 01
status: ready-for-merge
branch: pr2a-pwa-shell
pr: 6
ci: green (run 26176555263, 1m41s)
lighthouse_pwa: 100/100 (Lighthouse 10 mobile preset)
---

# Phase 4 / PR2a — Summary

## Tasks executed (commit map)

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | T-CI paths-ignore | `71a911b` | `.github/workflows/playwright.yml` |
| 2 | T-ICN 5 icons | `e422fb9` | `icons/*.png` |
| 3 | T-MAN manifest | `8605ef4` | `manifest.json` |
| 4 | T-HEAD html head | `af45496` | `index.html` |
| 5 | T-SW sw.js | `f644855` | `sw.js` |
| 6 | T-SWREG + T-SWSPEC | `d2b9fd8` | `app.js`, `tests/sw.spec.ts` |
| 6b | resilient precache | `0c729ce` | `sw.js` |
| 7 | T-UNDO01 | `dc303ef` | `app.js`, `tests/undo.spec.ts` |
| 8 | T-SNAP01 option A | `981662e` | `app.js`, `tests/snapshot.spec.ts` |
| 8b | SNAP-01 debug (squashed) | `e42569d` | `app.js` |
| 8c | SNAP-01 reactive counter | `1fc526f` | `app.js` |
| 9 | T-INST-STATE | `b493018` | `app.js` |
| 10 | T-INST-UI | `39f075b` | `index.html` |
| 11 | T-PWA spec | `b60602d` | `tests/pwa-shell.spec.ts` |

Total: **14 commits** (plan estimated 11; +3 from in-CI deviations documented below). Squash-merge collapses to 1.

## Plan deviations

| Deviation | Root cause | Fix |
|-----------|------------|-----|
| `cache.addAll` -> `Promise.allSettled` | CI runner Chromium occasionally fails CDN fetch -> entire install rejects -> activate never fires -> `clients.claim` never runs -> `controller===null` -> REGRESSION-03 timeout | Resilient per-URL `fetch + cache.put`. Same-origin app shell still precaches; CDN URLs SWR-cache on first hit if precache misses. |
| SNAP-01 option A insufficient | Plan option A re-primed `_lastSnapshotData` defensively, but the **real** bug was Alpine reactivity: `snapshots()` reads only `localStorage`, no reactive prop -> Alpine tracks zero deps -> `<template x-for="snap in snapshots()">` never re-evaluates after first mount. CI debug logs showed `pushSnapshot` correctly wrote 2 snapshots (1278+2562 chars in localStorage), but UI stayed at "Nessuno snapshot disponibile". | Added `_snapshotVersion: 0` slot. `pushSnapshot` increments after `setItem`; `snapshots()` reads `void this._snapshotVersion` to create the reactive dep. Defensive priming (option A) kept as complementary safety net. |
| `this.attivi` count: plan said 19 -> 16 (-3); actual 20 -> 17 (-3) | Counting baseline differed by 1 (existing call site the plan missed). | Documented; semantic invariant ("reduced by 3 from `gruppiCalendario`") preserved. |
| `app.js` line count: plan estimated +95, actual +123 (1263 -> 1386) | `_snapshotVersion` slot, defensive priming comment, install state slots (3 + 4 helpers ~60), iPadOS detection block, listeners block. | Within budget; CI green; no regressions. |

## Final line counts

```
1437 index.html   (1391 baseline + 46 net: head meta + banner DOM)
1386 app.js       (1263 baseline + 123 net: SW register + install state/helpers + 2 carry-over fixes + _snapshotVersion)
 134 sw.js        (new)
   5 icons/       (192, 512, 512-maskable, 1024, apple-touch-180; total ~832 KB — 1024 dominates emoji-rasterized)
  20 manifest.json
  93 tests/pwa-shell.spec.ts
```

## Verification protocol results

```
[CI run 26176555263]
20 test runs, 0 fail (1 retry on CESTINO-02 baseline flake, passed on retry):
✓ 5 LOCKED regression (CON-017 #1–#5)
✓ 2 CRITICAL calendario
✓ 2 CESTINO (1 retry — pre-existing flake)
✓ 2 login (CRITICAL-01, REGRESSION-04)
✓ 5 pwa-shell (PWA-01/02/03a/03b/03c) — NEW
✓ SD-01 salute-dati
✓ SNAP-01 — un-skipped
✓ REGRESSION-03 sw — evolved
✓ UNDO-01 — un-skipped

[Lighthouse 10 mobile preset]
PWA score: 100/100
- PASS installable-manifest
- PASS service-worker
- PASS splash-screen
- PASS themed-omnibox
- PASS content-width
- PASS viewport
- PASS maskable-icon
(3 manual audits cross-browser/page-transitions/each-page-has-url — always manual)

[Performance: 79 mobile; non-blocking — target ROADMAP era PWA category]

[Smoke checklist]
✓ SW controller scriptURL = sw.js (clients.claim() works)
✓ Manifest link href = manifest.json
✓ Theme color meta = #0071e3
✓ Install banner hidden at first access (< 3 sessions)
✓ Cache 'gestione-affitti-v1' populated after install
✓ Session log records 1 entry on boot, 30 min dedup verified by helper logic
```

## Lighthouse report artifact

Saved at `.planning/phases/04-pr2a-pwa-shell-manifest-sw/lighthouse-pwa-score.json` (Lighthouse 10 JSON, ~38 KB).

## Patterns established (riusabili PR2b / PR3)

1. **SW versioning workflow**: bump `CACHE_NAME` (`gestione-affitti-v1` -> `v2`) at every deploy that changes a file in `PRECACHE_URLS`. Manual; comment in `sw.js` documents the policy.
2. **Resilient precache pattern**: `Promise.allSettled` + per-URL fetch + `cache.put` (NOT `addAll`) for any future SW that includes external CDN URLs. CDN occasional failures don't break SW activation.
3. **Install prompt UX**: 3 sessions / 7d rolling, 30 min gap dedup, 14d dismiss persistence. localStorage keys `gestione_affitti_session_log` / `_install_dismissed_until` / `_installed`. Branch iOS Safari vs Chrome/Android via UA + iPadOS heuristic.
4. **Alpine reactive trigger for non-reactive sources**: when a getter reads from non-reactive source (localStorage, IndexedDB, time, random), bump a counter on write and `void this._counterName` in the getter to create the dep. Generalizable to any future feature that reads outside Alpine state.
5. **Same-commit fixture update**: when changing implementation that's asserted by LOCKED regression, bundle test assertion update in the SAME commit. PR1 lesson #4 confirmed.

## Risk register actual outcomes

| ID | Risk | Outcome |
|----|------|---------|
| R-SW (CON-017 #3) | Test fails if assertion not evolved with impl | Mitigated via same-commit pattern. ✓ |
| R-CACHE | SW cache stale blocks login | `clients.claim` + SWR fresh on next navigate; manual `CACHE_NAME` bump policy in `sw.js` header. ✓ |
| R-SUPABASE | SW caches Supabase API | `NETWORK_ONLY_HOSTS` ['supabase.co', 'supabase.in', 'fonts.googleapis.com']. Login + CESTINO + LOCKED tests green confirm. ✓ |
| R-LH-PERF | load-fast-enough < 10s on simulated 3G | Lighthouse 10 PWA score 100 without needing the audit. PR2a target met. CDN preload kept but generates benign CORS warning (Tailwind has no CORS headers + preload `crossorigin` attribute conflict). |
| R-UNDO-LATENT | Other 14 `this.attivi()` call sites may have same reactivity gap | Smoke didn't reveal other gaps; if appears in PR2b, fix dedicated. ✓ |
| R-SNAP-LATENT | Option A masks real cause | Real cause WAS different (Alpine reactivity, not race). Documented; option A retained as defensive layer. |
| R-IOS | iPadOS desktop-mode evades detection | Extended detection (UA + `maxTouchPoints>1 && platform==='MacIntel'`). ✓ |
| R-LOCKED-1/2/5 | SW serves stale app.js | First deploy SW, no pre-existing cache. CI verified green for all LOCKED. ✓ |

## Lessons learned

1. **Plan confidence MEDIUM means budget for debugging**: SNAP-01 plan said MEDIUM confidence. The fix needed empirical CI iteration to discover the Alpine reactivity issue. Initial defensive priming alone was insufficient.
2. **Lighthouse 12 deprecated PWA category**: targets stated as "PWA score ≥ X" need version pinning. We used `lighthouse@10` for the ROADMAP target. Going forward, pin Lighthouse 10 in CI for any PWA-score verification, or migrate to per-audit assertions in Lighthouse 12+.
3. **`<link rel="preload" crossorigin>` requires CORS support on origin**: Tailwind CDN has no CORS headers -> preload + crossorigin causes "preload not used" + CORS error. Either drop `crossorigin` (different cache key, preload may not fire from the real `<script>`) or drop preload entirely. Kept for now; benign noise.
4. **Console-debug-then-fix is a valid CI debugging tool**: when local Playwright not runnable (env vars), instrumenting code with `console.info` and downloading the trace artifact (`gh run download`) extracts the runtime state needed to fix. Cleaned up the debug commit before merging (still visible in history; squash-merge collapses).
5. **Promise.allSettled > cache.addAll for SW precache when CDN involved**: a single CDN flake breaks the entire SW install. allSettled is the production-ready pattern.

## Out of scope confirmed (NOT in PR2a)

- ❌ Push notifications scheduler in SW (PR3)
- ❌ Offline mutation queue + idb-keyval (PR2b)
- ❌ Background Sync API (PR2b)
- ❌ Auto-update toast "Ricarica per nuova versione" (PR3 — OQ-4)
- ❌ Per-entity schema migration (Phase 5)
- ❌ Cache version auto-bump from SHA (PR2b possible)
- ❌ New global CSS rules (banner reuses PR0 exclusively)
- ❌ ES modules / build step (CON-001)

## Next steps (PR2b kickoff hint)

- PR2b focus: **Per-entity sync + offline queue + schema migration**. Builds on the SW shell shipped here.
- Pre-PR2b TODO:
  - Spend 15 min observing the brother use the app (PRD Assignment, open from STATE.md)
  - Decide cache version auto-bump strategy (SHA-based vs version-string-based)
  - Plan idb-keyval addition or whether plain IDB API is enough

## Branch + merge state

- Branch: `pr2a-pwa-shell`
- PR: https://github.com/oLdpZ/gestione-affitti/pull/6 (ready for review)
- CI: green (run 26176555263, 1m41s)
- Squash-merge: **awaiting user approval** — not auto-merged.
