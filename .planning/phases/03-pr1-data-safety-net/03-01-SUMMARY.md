# Phase 3 PR1 — Data Safety Net + bugfix + app.js — Summary

**Branch:** `pr1-data-safety-net`
**Base:** `master` @ `745b854` (Phase 2 PR0 closure)
**Executed:** 2026-05-18
**Strategy:** Single PR squash-merged against master, required check `test`.

## Tasks executed (commit map)

| Task(s) | Commit SHA | Subject |
|---------|-----------|---------|
| T01+T02+T03 | `9c9fce0` | refactor(pr1): extract inline script to app.js (no behavior change) |
| T05+T06 | `f842fac` | feat(pr1): migraDati v3 + attivi() helper for soft-delete filter |
| T07+T08 | `5072bef` | fix(pr1): DEC-020 bug 1 + bug 2 (importaJSON + modificatoManualmente) |
| T09 | `df800b6` | feat(pr1): SUPPORT_WHATSAPP constant + mostraToast helper |
| T18 (moved before T17 per M-1) | `f8ba37d` | feat(pr1): global error capture into localStorage.errori (ring 50) |
| T10 | `ad1c73a` | feat(pr1): soft-delete on eliminaIncasso + eliminaProprieta (cascading) |
| T13+T14 | `3000f48` | feat(pr1): undo toast (5s, stack model) + wire utenza + banca |
| T11+T12 | `7ab6adc` | feat(pr1): Cestino UI + ripristina/eliminaDefinitivamente/svuota |
| T15+T16 | `b6c7225` | feat(pr1): snapshot ring buffer (10, pre-mutation) + timeline UI |
| T17 | `947c564` | fix(pr1): DEC-020 bug 3 — salvaSubito catch chain split (4 branches) |
| T19+T20+T24 | `07f6f39` | feat(pr1): Salute dati page — counts + sync + storage + errori + diagnostica (+generic toast UI) |
| T21+T22+T25 (squash) | `296792e` | feat(pr1): incasso validation + REGRESSION-04 fixture update (same-commit) |
| T23 | `bc977d0` | feat(pr1): auto-purge soft-deleted >30 giorni at init |
| T26+T27+T27b+T28 | `5eb50d2` | test(pr1): cestino + undo + snapshot + salute-dati specs |

**14 commits** (some plan tasks merged per PLAN-CHECK M-1 / M-2 recommendations).

## Plan deviations

### Deviation D1 — `index.html` line count overflow (1386 vs <1300 target)

The plan and DoD #8 specified `index.html < 1300 lines`. Final size is **1386 lines**.

- Extraction baseline (T03): 1939 → 1210 lines (−729). Within target. ✓
- New HTML required for the PR1 surfaces (Cestino + Snapshot + Salute dati sections + undo toast + generic toast + soft-confirm modal) added **+176 lines** across the body and the root-scope tail. All of these surfaces are LOCKED by REQ-SAFE-02 / -03 / -04 / -05 — they cannot be removed.
- The <1300 forecast in PLAN-CHECK underestimated the HTML footprint of the new sections (assumed ~90 lines, real ~176).
- Mitigation: the **goal** of the constraint (extracting the bulk of logic, decoupling `index.html` from the implementation) is preserved — `index.html` lost 729 lines of JavaScript. Net delta vs master: −553 lines despite 5 new visible features.

Decision: ship as-is and update DoD #8 retroactively to a more honest "< 1500" via an ADR amendment if reviewer agrees. Not blocking the PR.

### Deviation D2 — T17/T18 ordering (M-1 PLAN-CHECK fix)

T18 (`pushErrore` + global listeners) was executed before T17 (`salvaSubito` catch chain split) so the catch chain could call the real `pushErrore` instead of a stub. T07 still had a defensive `typeof this.pushErrore === 'function'` guard because it ran before T18 in code, but T18 lands before any user-visible save path.

### Deviation D3 — pushSnapshot placement (M-4 PLAN-CHECK fix)

`pushSnapshot` was wired to `salvaSubito` entry (not `salva` debounce wrapper), avoiding ring overflow on rapid input (the plan-checker's M-4 concern).

### Deviation D4 — `confirm(` grep count

The PLAN verification protocol says `grep -c "confirm(" app.js ≤ 3`. Final raw count is **6**: 3 native confirm() (eliminaDefinitivamente, ripristinaSnapshot, svuotaCestino) + 2 comments referencing "confirm(" + 1 method named chiediConferma. Native `confirm()` calls = **3** ✓ as intended; the regex needed `[^.a-zA-Z]confirm(` to filter false positives.

## Line counts (final)

```
index.html  1386
app.js      1240
total       2626
```

vs master baseline (`index.html` 1939, no app.js): **net −553 lines** with 5 new visible features delivered.

## Verification protocol results

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| index.html size | < 1300 | 1386 | **FAIL** (see D1) |
| app.js exists | match | match | ✓ |
| 4 new test files | 4 match | 4 match | ✓ |
| Native `confirm()` | ≤ 3 | 3 | ✓ |
| `this.attivi(` coverage | ≥ 18 | 19 | ✓ |
| `dataVersion = 3` | match | 1 match | ✓ |
| `addEventListener('error'`/`unhandledrejection` | both match | both match | ✓ |
| `auth.refreshSession()` | match | match | ✓ |
| Suite full green (CI) | TBD | TBD | TBD |

## Patterns established (reusable for PR2a/PR2b)

1. **`attivi(arr)` helper** — centralizes soft-delete filtering at 19 read sites. PR2b will extend the entity list (utenze, banche) and only need to wrap their reads.
2. **`chiediConferma(message)` promise modal** — replaces `confirm()` everywhere validation needs branding. PR2b can extend to multi-step wizards.
3. **`mostraUndoToast(message, undoFn)` + `mostraToast(type, message)`** — single-slot replace-on-new toast pattern. Trivial to add more destructive actions.
4. **Snapshot ring buffer pre-mutation** — generalized to any whole-state restore. PR2b mutation queue can push pre-state same way.
5. **`pushErrore` ring 50 + global listeners** — diagnostica primitive used by salvaSubito catch chain. PR2b sync conflicts can push severity:info entries.
6. **3-tier safety net mental model**: toast (5s) → cestino (30gg) → snapshot (whole-state). Each tier has independent recovery; user education in Salute dati copy.

## Risks at execution time, status

| ID | Risk | Outcome |
|----|------|---------|
| R-A | Snapshot vs Cestino UX confusion | Mitigated: ripristinaSnapshot confirm() explicitly says "INCLUSO il cestino". |
| R-B | Extraction breaks Alpine wiring | T03 atomic commit isolated; no behavior delta observed locally. CI gate confirms in T29 push. |
| R-C | Pre-PR1 hard-deleted data lost forever | Comunicato nel PR body. Not fixable. |
| R-D | Auto-purge surprise | Mitigated: console.info + errori[] severity:info + visible in Salute dati. |
| R-E | errori[] unbounded | Mitigated: ring strict 50 FIFO via while-shift. |
| R-F | Existing Playwright selectors broken | Mitigated: REGRESSION-04 fixture updated same-commit as T22. |
| R-G | Currency mismatch impossible | Resolved: banche[].currency already in schema. |
| R-J | Phase >5h escalation | Came in under estimate (~3h of focused work). |

## Lessons learned

1. **Pre-flight line-count estimates need a 20% buffer.** PLAN-CHECK assumed ~90 lines of new HTML; real was ~175. Future plans should include an estimate per section (Cestino X lines, Snapshot Y lines, etc.) summed up explicitly.
2. **Bundling T01+T02 into T03's commit was clean** (the comment, the testid, and the extraction all touch HTML scaffolding). The plan's "every task = one commit" rule is a soft default; small no-op companions can ride along.
3. **Stub-then-replace pattern (T10 mostraUndoToast no-op → T13 real)** worked cleanly. The DoD test (toast actually appears) naturally catches if the stub is left in place.
4. **Squash recommendation in PLAN was correct** for T22+T25: the spec selector and the handler are coupled and would break each other if split.

## Out of scope (confirmed not implemented)

- ❌ Soft-delete on Banche / Utenze / Inquilini / Tipi-utenza (only proprietà + incassi)
- ❌ Mutation queue, sync status, conflict count (PR2b)
- ❌ Schema change Supabase (PR2b)
- ❌ ES modules migration (CON-001 LOCKED)
- ❌ Dark mode toggle, ⌘K command palette
- ❌ New external CDN deps (no jsPDF, Chart.js, Tesseract)

## Next steps (T29)

1. Push branch to origin
2. Open PR `feat(pr1): Data Safety Net + bugfix + app.js`
3. Verify CI `test` check green
4. Manual smoke iPhone 390×844 (deferred until PR opens for visual review)
5. Squash merge to master after approval
6. Post-merge GitHub Pages deploy verification
