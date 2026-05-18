# Plan Check - Phase 3 PR1

**Verdict**: PASS-WITH-FLAGS
**Date**: 2026-05-18
**Plan**: 03-01-PLAN.md (29 task, 1215 righe)

## Goal-backward trace

| SC | Description | Delivering tasks | Verify tasks | Status |
|----|-------------|------------------|--------------|--------|
| SC1 | Cestino con Ripristina (proprieta + cascading incassi + utenze naturali) | T05 + T06 + T10 + T11 + T12 | T26 + T29 | COVERED |
| SC2 | Undo toast 5s dopo distruttiva | T09 + T10 + T13 + T14 | T27 + T29 | COVERED |
| SC3 | Salute dati (counts, sync, blob, storage, Invia diagnostica) | T18 + T19 + T20 | T28 + T29 | COVERED |
| SC4 | Importo=0 soft-confirm + banca + currency warnings | T21 + T22 + T24 | T25 + T29 | COVERED |
| SC5 | 3 bug fix + app.js extraction (no build) | T03 + T04 + T07 + T08 + T17 | T04 + T29 | COVERED |
| SC6 | Snapshot ring 10 + Ripristina snapshot | T15 + T16 | T27b + T29 | COVERED |

Tutti i 6 success criteria della ROADMAP Phase 3 hanno tasks di delivery + verifica. Nessun gap di copertura sui SC.

## Findings

### HIGH severity (must fix before execute)

Nessun BLOCKER identificato. Tutti i locked decisions di CONTEXT.md e RESEARCH sez.1 sono onorati:

- Nomenclatura ground-truth applicata: incassiAffitti (non incassi), salvaSubito (non salva per catch chain), migraDati v3, pushErrore.
- Single PR strategy LOCKED (branch pr1-data-safety-net, required check test, squash merge).
- No build step / classic script / function app() global preserved (T03).
- Soft-delete ONLY su Proprieta + IncassiAffitti (T05, T10); Utenze/Banche solo undo via deep-clone splice (T14) -- semantica corretta.
- Cestino Ripristina cascading via timestamp match i.deletedAt === stamp (T12, corner case esplicitato nel diff).
- Hard-delete cestino cascade incassi figli (T12, T26 CESTINO-02).
- Snapshot overwrite warning con confirm nativo (T16, R-A mitigato esplicitamente).
- Auto-purge 30gg in init + log console + entry errori severity:info (T23, R-D mitigato e surfaced in Salute dati).
- Layer A atomicita: T03 singolo commit isolato no-behavior-change, T04 gate verify obbligatorio, rollback path git revert T03 esplicito.
- Same-commit fixture update T22+T25 nello stesso PR; raccomandazione esplicita di squash in singolo commit (riga 982 del PLAN).
- Verification protocol sez.6 grep-misurabile: attivi() >= 18, confirm() <= 3, dataVersion=3, listener wired, refresh wired, iPhone smoke, CI gate.
- Out-of-scope discipline sez.8 esaustiva (12 voci NO: mutation queue, inquilini, tipi-utenza, scadenze custom, PWA, dark mode, command-K, ES modules).

### MEDIUM severity (can risk-accept with reason)

**M-1 -- Layer ordering: T17 dipende da T18 ma e elencato prima.**
T17 dichiara depends_on T09, T15, T18. Workflow sequenziale 1-Claude implica T18 va eseguito PRIMA di T17 (oppure stub pushErrore ad hoc come fatto per mostraUndoToast in T10). Il piano lo riconosce nella dipendenza ma l ordine numerico T17 prima di T18 puo confondere. Fix: swap T17 con T18 oppure prepend bold nota ESEGUIRE T18 PRIMA DI T17 su T17.

**M-2 -- Stub no-op pattern in 2 punti (T07 pushErrore, T10 mostraUndoToast) senza checklist di cleanup.**
Sostituiti rispettivamente in T18 e T13. Nessuna task di chiusura verifica esplicitamente che gli stub siano rimpiazzati. Fix: aggiungere a T29 check grep. Risk-accept perche T13/T18 DoD impongono comportamento osservabile (toast appare / errori list popolato), stub residui farebbero fallire il DoD naturalmente.

**M-3 -- T20 snippet HTML con dead code doppio :disabled.**
Righe 821-823 hanno un primo :disabled con espressione ridondante always-evaluate E poi x-bind:disabled coerente. Il primo e dead code che puo sopravvivere al copy-paste. Fix: pulire lasciando solo x-bind:disabled con un data field supportWhatsapp. Innocuo funzionalmente.

**M-4 -- Snapshot timing: pushSnapshot all entry di salva() (debounce wrapper).**
T15 invoca pushSnapshot all entry del wrapper debounce, quindi scatta a ogni call anche debounced, il ring di 10 si riempie troppo in fretta. CONTEXT LOCKED dice pre-mutation state del save che STA per avvenire. Fix: spostare pushSnapshot dentro salvaSubito come PRIMA azione (prima del network call), oppure debounce anche il push. Da verificare attivamente nell esecuzione di T15.

**M-5 -- clearTimeout cleanup undo timer su replace stack-model non esplicitato nei diff inline del PLAN.**
T13 riferisce a RESEARCH sez.6 per mostraUndoToast. Il toast generico T09 mostra esplicito clearTimeout su replace. Se RESEARCH sez.6 e coerente ok, altrimenti rischio leak timer in rapid-delete. Verifica in esecuzione.

**M-6 -- Stima 3.5-4.5h vs CONTEXT 2.5-3.5h.**
Planner ha allargato la stima rispetto a CONTEXT. Escalation rule a 5h e esplicita (T29). Risk-accept.

### LOW severity (nits)

**L-1** -- T01 titolo Aggiungere defer Supabase e fuorviante: il task verifica solo che Alpine abbia gia defer (atteso da PR0) e aggiunge un commento HTML sull ordine. Rename a Documentare ordine script pre-extraction.

**L-2** -- T22 segna salvaProprieta async ma non verifica call site @click salvaProprieta() Alpine. Alpine gestisce await nativamente, ok in pratica. Nit: verifica esplicita in smoke T29.

**L-3** -- T26 CESTINO-02 reload dopo hard-delete potrebbe essere flaky: il reload Playwright dopo salva() non garantisce che la PATCH Supabase sia stata persistita. Suggerire await page.waitForResponse sulla PATCH/PUT prima del reload.

**L-4** -- T29 manual smoke offline path ambiguo: con DevTools Offline, il token Supabase potrebbe gia essere expired implicando branch auth-expired invece che network. Suggerire ordering: 1) save normale, 2) disconnect, 3) modifica, ci si aspetta network branch.

**L-5** -- Logica filter incassi orfani in T19 non esplicitata: getter saluteDati() cita incassiOrfani ma non specifica la formula (incassi con proprietaId che punta a proprieta inesistente o soft-deleted). Da verificare in esecuzione.

**L-6** -- Lookup helpers nomeProprieta/getProprieta/nomeBanca NON wrapped in attivi() (T06): corretto per design (servono al cestino per mostrare nomi di soft-deleted), ma il PLAN non ha test esplicito per il rendering nome nel cestino -- T26 CESTINO-01 lo testa implicitamente via locator text.

## Strengths

1. Trace ROADMAP-task-test impeccabile (sezione sez.2 del PLAN): ogni SC ha delivering tasks E verifying tasks distinte.
2. Decisioni CONTEXT.md tutte presenti nei must_haves frontmatter (truths + artifacts + key_links), con regex/pattern grep verificabili.
3. Nomenclatura ground-truth applicata sistematicamente; sezione interfaces corregge esplicitamente 5 imprecisioni di CONTEXT (incassiAffitti, salvaSubito, range estrazione 1207-1937, currency gia presente su banche, function lines).
4. Layer A atomicita rispettata: T03 singolo commit no-behavior-change, T04 gate, rollback git revert T03 immediato esplicito.
5. Same-commit fixture update REGRESSION-04 coordinato (T22+T25) con raccomandazione di squash.
6. Cestino vs Snapshot UX warning (R-A) mitigato con confirm modal esplicito incluso il cestino.
7. Verification protocol concreto e grep-misurabile sez.6: counts esatti per attivi(), confirm(), dataVersion, listener, refresh.
8. Out-of-scope discipline esaustiva sez.8: 12 voci NO con riferimento decisioni (DEC-005, 007, 008, 016, 022, CON-001 + DEC-003).
9. Rollback plan sez.7 ragiona su localStorage post-revert: campi additive harmless, dataVersion v3 stays, errori/snapshots orphan keys = zero impact.
10. Stima onesta + escalation rule: planner ha allargato 2.5-3.5h a 3.5-4.5h e mette stop esplicito a 5h.

## Recommended next step

PROCEDERE all esecuzione. Il piano e dimensionalmente solido e copre 6/6 SC con delivery+verify tasks. I 6 finding MEDIUM sono risk-acceptable o auto-correttivi durante l esecuzione (DoD naturalmente li intercetta).

Pre-execute polish raccomandato (opzionale, 5 min):

1. Fix M-1: swap T17/T18 oppure prepend nota ESEGUIRE T18 PRIMA su T17.
2. Fix M-3: pulire snippet T20 dead code :disabled.
3. Fix M-4: spostare pushSnapshot da salva() wrapper a entry di salvaSubito per evitare ring overflow su debounce.

Se l esecutore parte ora senza polish, ce la fa lo stesso: i DoD task-livello sono difensivi (suite verde + grep counts + smoke manuale).
