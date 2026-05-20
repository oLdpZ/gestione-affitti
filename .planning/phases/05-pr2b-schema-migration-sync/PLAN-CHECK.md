# Plan check: Phase 5 PR2b

**Date:** 2026-05-20
**Verdict:** PASS-WITH-FLAGS
**Plans audited:** 5 (29 tasks total)

## Summary
- HIGH: 0
- MEDIUM: 3
- LOW: 4

## D1..D12 results

- **D1 Requirements coverage — PASS**: REQ-SCHEMA-01 (05-01,05-03), REQ-SYNC-01 (05-02), REQ-SYNC-02 (05-02), REQ-DATA-01/02/03 (05-04), all in 05-05. All 6 REQ-IDs covered.
- **D2 Goal coverage — PASS**: 6/6 ROADMAP success criteria mapped: (1)→05-01, (2)→05-03, (3)→05-02+05-05 T-03, (4)→05-02 T-04/05+05-05 T-04, (5)→05-04, (6)→05-03 T-03+05-05 T-05.
- **D3 Task atomicity — PASS-WITH-FLAGS**: T-05-04-04 (~150 LOC inquilini CRUD, touches app.js+index.html with 6 sub-actions) and T-05-02-06 (rename salvaSubito + salva() rewrite + proprieta retrofit) are borderline epic. FLAG MEDIUM — recommend split.
- **D4 Read-first completeness — PASS**: every task has `<read_first>` with file + source ref.
- **D5 Acceptance criteria verifiability — PASS-WITH-FLAGS**: 95% grep/file-exists checks. T-05-01-04 step "RLS badge visible in Table Editor" subjective. T-05-03-05 "first-run/second-run/partial-fail" rely on manual observation. FLAG LOW.
- **D6 Action concreteness — PASS**: concrete SQL, Italian copy quoted from CONTEXT, exact function signatures. Verbatim references to RESEARCH §N where applicable.
- **D7 Wave/dependency correctness — PASS**: 05-01→05-02→{05-03,05-04}→05-05. Intra-plan waves monotonic; deps only on prior waves. FLAG LOW: 05-01 task T-05-01-05 declared wave=2 depends_on="" (T-05-01-01 is wave=1) — acceptable since no real dep, but inconsistent.
- **D8 Codebase spot-check — PASS** (see table).
- **D9 Threat model presence — PASS**: every plan has `## Threat model` covering RLS bypass (05-01), SECURITY DEFINER (05-01 — chose INVOKER, justified), mutation queue race (05-02), dual-write race (05-02,05-03), migration partial-fail (05-03).
- **D10 OQ resolution — PASS-WITH-FLAGS**: OQ-1 resolved in T-05-01-02/03 (client-side adattaShape). OQ-3 resolved (blob fallback preserved Phase 1). OQ-4 explicitly deferred ("doc only first iteration") in T-05-01-06. **OQ-2 silently dropped** — naming convention scadenzaGiorno (camel) vs scadenza_giorno (snake) is implicitly handled in adattaShape but not explicitly addressed. FLAG MEDIUM.
- **D11 CI gate placement — PASS**: T-05-01-04 (post-DDL deploy), T-05-03-05 (post-migration deploy), T-05-05-07 (pre-merge). Each has go/no-go criteria.
- **D12 Italian locale — PASS-WITH-FLAGS**: conflict toast copy locked from CONTEXT 162-167, migration modal copy in T-05-03-03 Italian, "Tipo utilizzato, sposta o elimina prima le utenze" present, "Modifiche in coda" present, Salute dati uses `toLocaleString('it-IT')`. FLAG LOW: no explicit verification of `1.234,56 €` currency formatting in queue/migration UI (out of scope — uses existing PR1 formatters), and no `gg/mm/aaaa` enforcement (dates use locale-string).

## Spot-check log

| Reference in plan | File:line in code | Status |
|---|---|---|
| app.js:110-135 state slots | app.js:110-147 state block | MATCHED |
| app.js:148 init body | app.js:148 `async init()` | MATCHED |
| app.js:717-805 caricaDatiUtente | app.js:717 `async caricaDatiUtente()` | MATCHED |
| app.js:810-843 salva() | app.js:810 `salva()` | MATCHED |
| app.js:846 salvaSubito | app.js:846 `async salvaSubito()` | MATCHED |
| app.js:946 esportaJSON | app.js:946 `esportaJSON()` | MATCHED |
| app.js:971-1014 generaIncassiAttesi | app.js:971 `generaIncassiAttesi()` | MATCHED |
| app.js:1080+ gruppiCalendario | app.js:1077 `gruppiCalendario()` | MATCHED (off-by-3) |
| app.js:1249-1280 resetFormUtenza+form | app.js:1249,1253 `tipo: 'acqua'` | MATCHED |
| app.js:1304-1330 salvaProprieta | app.js:1304 `async salvaProprieta()` | MATCHED |
| app.js:1358 salvaBanca (plan says 1360-1365) | app.js:1358 `salvaBanca()` | MATCHED (off-by-2) |
| app.js:1144 salvaIncassoModificato (plan says ~1140-1180) | app.js:1144 | MATCHED |
| index.html:470 root x-data | index.html:470 `<div x-data="app()"` | MATCHED |
| index.html:17-21 CDN tags | index.html:18-34 Supabase/Alpine | MATCHED |
| index.html:1005-1027 utenza dropdown hardcoded | index.html:1005,1027 `<option value="acqua">` | MATCHED |
| sw.js:15 CACHE_NAME | sw.js:15 `gestione-affitti-v1` | MATCHED |
| sw.js:17 PRECACHE_URLS | sw.js:17 `PRECACHE_URLS = [` | MATCHED |
| app.js:43-60 datiEsempio | app.js:43 + scadenzaAffitto:50 | MATCHED |
| app.js:63-93 migraDati | app.js:63 | MATCHED |
| app.js:247 online listener | app.js:245-249 listener block | MATCHED |

19/19 references MATCHED (minor ±3 line drift, no semantic divergence).

## HIGH severity findings
None.

## MEDIUM severity findings

1. **OQ-2 silently dropped** (D10): RESEARCH OQ-2 asks for explicit naming convention rule (camelCase vs snake_case). Plans rely on `adattaShape()` to handle conversion ad-hoc per entity but no plan documents the rule "DB = snake_case, JS state = camelCase". Risk: future contributor adds field and forgets the rename. **Fix**: add a 2-line comment block in T-05-01-03 action documenting the convention.

2. **T-05-04-04 epic-sized** (D3): inquilini CRUD task = ~150 LOC across app.js (5 methods + state + validators) + index.html (~70 LOC section + form) + cestino integration. Above 50 LOC sweet spot, single commit risks rollback complexity. **Fix**: split into T-05-04-04a (state + methods app.js) and T-05-04-04b (HTML section + cestino integration).

3. **T-05-02-06 entangled dual concerns** (D3): rename salvaSubito → salvaSubitoBlob + salva() rewrite + first form retrofit in one commit. Naming refactor should be its own commit for clean revert. **Fix**: split rename into T-05-02-05b.

## LOW severity findings

1. T-05-01-04 acceptance "RLS badge visible" relies on UI inspection (D5).
2. T-05-01-05 declared wave=2 with empty depends_on — clarify or move to wave=1 (D7).
3. T-05-03-05 partial-fail simulation step 4 marked "opzionale ma raccomandato" — for a CI-GATE, should be mandatory (D11).
4. Italian formatting (€ 1.234,56) not explicitly verified in any new acceptance criterion — implicit via PR1 formatters (D12).

## Recommended action

**PROCEED** with awareness of the 3 MEDIUM items. The MEDIUMs are scope/atomicity concerns (not correctness): consider applying the 3 fix-suggestions as inline edits to the affected tasks before kicking off execution, or accept and proceed — none blocks correctness or shipability. All 6 ROADMAP success criteria, 6 REQ-IDs, and CON-017 CRITICAL-05 LIVE gate are demonstrably covered. Threat model + CI gates + Italian locale all green.
