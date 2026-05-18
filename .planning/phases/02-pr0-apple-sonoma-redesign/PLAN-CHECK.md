# Plan Check — Phase 2 PR0

**Verdict**: PASS-WITH-FLAGS
**Date**: 2026-05-18
**Reviewer**: gsd-plan-checker (Opus 4.7, 1M context)
**Plan reviewed**: `.planning/phases/02-pr0-apple-sonoma-redesign/02-01-PLAN.md` (1518 righe, 15 task T00-T14)

## Goal-backward trace

| SC# | Description | Delivering tasks | Verify tasks | Status |
|-----|-------------|------------------|--------------|--------|
| SC1 | Tutte le viste restilate (glass + mesh + 3 webfont Google Fonts) | T01 (fonts+tokens), T02 (mesh+glass+typography), T04 (window shell), T06-T11 (6 viste), T12 (Login) | T13 (grep --surface, radial-gradient, fonts.googleapis), T14 (smoke visivo manuale) | COVERED |
| SC2 | Login restilato + MP4 rimosso | T02 (git rm 276973.mp4 + rimozione video + .usa-flag-bg* CSS), T12 (login glass+mesh) | T12 (git ls-files grep mp4 vuoto), T13 (grep usa-flag-bg=0, 276973=0) | COVERED |
| SC3 | Sidebar -> drawer <900px, thumb-first iPhone | T04 (sidebar desktop >=900px), T05 (drawer Alpine + scroll-lock + ESC + media query) | T14 checkpoint manuale (390x844: hamburger/backdrop/ESC/scroll-lock/nav-tap-close, 6 voci raggiungibili) | COVERED |
| SC4 | Design tokens + .design-ref/ gitignored | T01 (:root letterale da RESEARCH §1 + .gitignore + copia bundle) | T01+T13 (git check-ignore .design-ref/ exit 0; grep --surface) | COVERED |
| SC5 | 5 LOCKED + 3 CRITICAL Playwright passano post-redesign | T03 (audit contracts), T07 (data-testid calendar-card/status-dot/orfani + selectors update STESSO commit), T11 (data-testid prop-section/prop-form + login.spec.ts update STESSO commit), T12 (Login preserva type=email/password/submit) | T13 (npx playwright test exit 0), T14 (CI verde) | COVERED |

Tutti e 5 i success criteria mappano a task di delivery + task di verify. Coverage 5/5.

## Findings

### HIGH severity (must fix before execute)

Nessuna. Il plan rispetta tutti i vincoli CONTEXT.md LOCKED:
- Single-file `index.html` preservato (no extract a style.css)
- No build step introdotto (Tailwind CDN + CSS inline only)
- Light theme only (T01 rimuove `darkMode: media`)
- Niente data-model change, niente Alpine state shape change, niente localStorage / Supabase touch (confermato in `success_criteria` punto 8)
- Out-of-scope discipline esemplare: la sezione 8 elenca esplicitamente 18 voci che PR0 NON tocca (cestino, snapshot, undo, PWA, schema, inquilini, tipi_utenza, dark-mode, ⌘K wiring, mini-calendar, modalizzazione form, preload font, ecc.)

### MEDIUM severity (can risk-accept with reason)

**M1 — classi Tailwind `dark:*` lasciate inerti nel diff** (RESEARCH R6 / sezione 8 plan). Il plan esplicitamente NON strippa le classi `dark:*`, motivando "no-op innocue". Razionale valido (light-only via rimozione di `darkMode` rende `dark:` non triggerabile), ma lascia decine di classi morte che inquinano il diff. Risk-accepted se utente conferma; follow-up in PR1 (gia pinned nel summary template del plan).

**M2 — `mobileMenuOpen` lasciato nello state Alpine accanto al nuovo `drawerOpen`** (T05 step 1). Plan dice "rename completo facoltativo". Lascia property dead in `app()`. Cosmetico, nessun impatto runtime. Razionale: riduce blast-radius del refactor. Risk-accepted, follow-up in PR1.

**M3 — T13 verify usa `grep -c` come boolean concatenato** con `&&`. Semantica corretta solo se almeno 1 match (exit 0). Il chaining funziona, ma e denso e difficile da debuggare se un singolo grep manca. Suggerisco T13 spezzato in assertion separate con messaggi `FAIL_xx` espliciti. Non blocking — readability.

**M4 — T07 selector ordering risk** (riga 826 del plan). Plan dice: "selettore `div.mb-8` con h3 Proprieta -> `[data-testid=prop-section]` (data-testid aggiunto in T11; per ora se Impostazioni non e ancora restilata, mantenere il selettore vecchio finche T11 non e shippato)". Questo significa che T07 fa update PARZIALE dei selettori e completa lupdate in T11. La nota e esplicita ma e fonte di confusione operativa. Raccomandazione pre-flight: **T07 NON tocca i selettori `propSection`/`propForm`; T11 fa il rename atomico**. Non-blocking.

**M5 — T00 Lighthouse baseline e opzionale e non committato.** Se lexecutor salta T00, T14 marca Lighthouse "non confrontato". OK come informational, ma Definition of Done punto 9 (CONTEXT.md §specifics) dice "no regression vs baseline pre-PR0". Se baseline manca, il punto 9 non e verificabile. Plan lo marca esplicitamente "informazionale non blocking" — coerente — ma confermare con utente prima di skippare T00.

### LOW severity (nits)

**L1 — Commit count discrepancy.** Loutput summary template dice "~12 commit atomici", il plan ha 14 task (T00-T14) di cui 11 con commit (T00, T03, T13, T14 senza commit). Conteggio reale: **11 commit**. Cosmetico.

**L2 — RESEARCH §11 Q5 reference**: il principio "spec Playwright updates IN THE SAME COMMIT as the view restyle" e onorato sia in T07 (calendario.spec.ts) sia in T11 (login.spec.ts + calendario.spec.ts final) — coerente con CONTEXT.md.

**L3 — `.gitignore` BEFORE `.design-ref/` copy** (RESEARCH R8): T01 step 2 fa gitignore, step 3 fa la copia. Ordine corretto. Done-when riga 284 verifica `git check-ignore`. Doppiamente verificato in T13. Solid.

**L4 — Task atomicity (stima dichiarata vs reale)**: somma T00-T14 = 5+20+25+5+25+15+15+20+12+8+10+18+12+5+10 = **205 min (~3h25m)**. CONTEXT.md §specifics dice "~1.5-2h focused implementation"; plan §4 intro stima 1h45m-2h15m. **Discrepanza tra stima dichiarata e somma effettiva.** Loverrun di ~1-1.5h plausibile per single-file Alpine + restyle 7 viste + test updates. Non blocking, ma flaggare all executor: aspettarsi 2.5-3.5h reali, non 2h.

**L5 — Wave parallelization (§5)**: "Single executor sequenziale". Corretto per single-file `index.html` (merge conflicts inevitabili). Nessun fix.

**L6 — T03 audit verify-only (5 min)**: utile come safety net pre-restyle, ma valore aggiunto marginale vs T13. Risk-accepted.

**L7 — Out-of-scope discipline (§8)** cita esplicitamente: cestino, snapshot, undo (PR1), PWA (PR2a), schema migration + inquilini + tipi_utenza (PR2b), notifiche/foto/PDF/730 (PR3), Chart.js + OCR (PR4), dark mode (esplicitamente fuori), ⌘K wiring, mini-calendar, modalizzazione form, preload font, multi-account. **Esemplare** — nessun scope creep rilevato nei 15 task.

## Strengths

1. **Goal-backward mapping esplicito** in §2 ("Success criteria mapping") — tabella 1:1 tra SC ROADMAP e task delivery+verify. Raro vedere planner fare questo proattivamente.
2. **Test-and-restyle in stesso commit** (T07 e T11) onorano RESEARCH §11 Q5 + CONTEXT.md regression safety. Selettori migrati a `data-testid` semantici evitano breakage da class change.
3. **.gitignore PRIMA della copia bundle** (T01 step 2 → step 3) esplicito con verifica in done-when.
4. **CSS letterale da RESEARCH §1+§2+§3+§4** (token, mesh, glass, typography) — plan dice "copy-paste letterale, NO modifiche valori".
5. **Threat model con STRIDE register** 8 voci, tutte `accept` o `mitigate` con piano concreto. Eccede aspettative per un restyle CSS.
6. **Rollback plan esplicito** (§7): single PR, no migration, no state touch → `gh pr revert` completamente reversibile.
7. **Risk register collegato a escalation rules** (§9 + threat model T-02-04..08) — non solo identifica rischi ma dice all executor cosa fare se si materializzano.
8. **Verification protocol automatizzato** (§6 + T13): 9 grep assertion + Playwright suite + smoke manuale + CI gate.
9. **Preservazione invarianti Playwright esplicita** (T03 audit + `<interfaces>` block): tag `<h3>`, struttura `<table><tbody><tr><td>`, testi letterali bottoni, attributi `type=email/password/submit/number`, `x-show`/`x-model` directives.
10. **CONTEXT.md decisions compliance**: tutte le decisioni LOCKED onorate (no build step, single-file, light only, no data model, mesh USA astratta non figurativa, 6 orbs cap, single breakpoint 900px, glass tokens semantici, `.design-ref/` gitignored, MP4 rimosso, 5 LOCKED tests verdi, ⌘K visivo non wirato, drawer behaviors).

## Recommended next step

**Procedere allexecute con questi flag espliciti per lexecutor:**

1. **Stima tempo reale 2.5-3.5h** (non 1.5-2h). Plan task aggregato = 205 min. Confermare con utente se vuole spezzare in 2 sessioni.
2. **M4 chiarimento pre-flight**: in T07, NON toccare i selettori `propSection`/`propForm` di `calendario.spec.ts` (Impostazioni non e ancora restilata). Toccare SOLO `.bg-yellow-50/green-50/red-50/gray-50` + `.status-dot.bg-green-500`. Lasciare propSection/propForm a T11 atomico.
3. **M5 Lighthouse baseline**: chiedere all utente prima di T00 se vuole baseline (5 min DevTools) o se accetta DoD punto 9 come "informational, non-confrontato".
4. **L1 commit count**: aggiornare summary template a "~11 commit atomici" invece di "~12".
5. **Push intermedio raccomandato post-T05** (non nel plan): triggera CI early — se T01-T05 rompono qualcosa, si scopre prima di restyle 7 viste. Plan attualmente fa un solo push in T14.

**Verdict finale: PASS-WITH-FLAGS.** Plan eccezionalmente solido per single-file Alpine redesign. Le 5 MEDIUM e 7 LOW sono raffinature, non blocker. Tutti e 5 i success criteria ROADMAP hanno delivering tasks + verify tasks. Tutte le LOCKED decisions di CONTEXT.md sono onorate. Out-of-scope discipline esemplare. Test-and-restyle in stesso commit correttamente pianificato.

**Go-ahead per `/gsd-execute-phase 2`.**
