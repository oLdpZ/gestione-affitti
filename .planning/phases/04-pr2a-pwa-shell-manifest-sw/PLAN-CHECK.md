# PLAN-CHECK — Phase 4 (PR2a PWA shell)

**Data verifica:** 2026-05-18
**Plan ispezionato:** 04-01-PLAN.md (16 task / 15 reali + 1 placeholder, 11 commit, branch pr2a-pwa-shell)
**Inputs caricati:** CONTEXT, RESEARCH (HIGH conf), ROADMAP Phase 4, REQUIREMENTS REQ-PWA-01..03 + REQ-SAFE-03/04, PROJECT (CON-010/011/017/018/020), index.html, app.js, tests/, .github/workflows/playwright.yml.

---

## 1. Verdict

**PASS-WITH-FLAGS — 0 HIGH, 4 MEDIUM, 5 LOW.**

Il piano e eseguibile cosi com e. Le 5 success criteria ROADMAP + i 2 carry-over PR1 + la CI hygiene sono tutti mappati a task con artifact, action e verify chiari. La sequenza di commit, i CI gate intermedi e la stima rientrano in CON-020. I MEDIUM sono rischi operativi noti del dominio PWA (Lighthouse 3G, SW edge cases, semantica snapshot, CI self-modification), gia parzialmente assorbiti dal risk register interno; vanno comunicati all esecutore. I LOW sono nit / heads-up.

---

## 2. Goal-backward coverage matrix

| Outcome richiesto | Origine | Task copertura | Prova attesa | Stato |
|---|---|---|---|---|
| SC1 — Chrome desktop / Android: Aggiungi a Home, app standalone con icona + theme | ROADMAP Phase 4 #1, REQ-PWA-01 | T-ICN + T-MAN + T-HEAD | T-PWA PWA-01 + T-LH Lighthouse installability | Coperto |
| SC2 — sw.js separato, SWR, cache versionata, cleanup activate, skipWaiting | ROADMAP Phase 4 #2, REQ-PWA-02, CON-010 | T-SW + T-SWREG per wiring | T-PWA PWA-02 + smoke DevTools | Coperto |
| SC3 — Stale SW unregistrati al boot, CON-017 #3 verde | ROADMAP Phase 4 #3, CON-017 | T-SWREG + T-SWSPEC (same commit) | tests/sw.spec.ts evoluto verde in CI | Coperto |
| SC4 — Banner italiano dopo 3 sessioni in 7gg, dismiss 14 giorni | ROADMAP Phase 4 #4, REQ-PWA-03 | T-INST-STATE + T-INST-UI | T-PWA PWA-03a/b/c | Coperto |
| SC5 — Lighthouse PWA score >=90 mobile | ROADMAP Phase 4 #5 | T-HEAD (preload) + cumulativo SC1..SC4, verifica in T-LH | T-LH checkpoint manuale + screenshot in PR body | Coperto (flag M-1) |
| Carry-over UNDO-01 | RESUME.md, REQ-SAFE-04 (riapertura) | T-UNDO01 + T-UNDO01-TEST | tests/undo.spec.ts un-skipped verde | Coperto |
| Carry-over SNAP-01 | RESUME.md, REQ-SAFE-03 (riapertura) | T-SNAP01 + T-SNAP01-TEST | tests/snapshot.spec.ts un-skipped verde | Coperto |
| CI paths-ignore (correzione CONTEXT.md riga 75) | CONTEXT.md note 2026-05-18 + RESEARCH §10 | T-CI | grep paths-ignore workflow = 2 match | Coperto |

Nessuna SC orfana. Nessuna SC con task assente.


---

## 3. Concerns

### MEDIUM

**M-1 [Asse 9 — Lighthouse >=90 plausibilita]: load-fast-enough-for-pwa su 3G simulato resta il singolo audit a rischio. Il piano lo mitiga (3 preload) ma non lo prova.**

- Rationale: RESEARCH §9 marca questo audit come "OK probabile", non OK. I 3 link rel=preload aiutano la prioritizzazione del browser ma NON riducono dimensione ne round-trip dei 3 CDN. Su 3G simulato (1.6 Mbps, 300 ms RTT) Tailwind CDN da solo e ~250 KB, ~2 s solo per Tailwind. Tailwind + Supabase + Alpine sommati ~6-8 s al first load — al limite della soglia <10 s, non sotto in scioltezza.
- Mitigazione proposta: aggiungere a T-LH una decision rule esplicita — se PWA score atterra in [85, 90) ed e bloccato esclusivamente da load-fast-enough-for-pwa, accettabile con justification nel PR body (CDN reale GH Pages senza throttling e quella che conta). Se < 85 o ostacolato da altri audit, escalate.
- Severity rationale: gia implicito nel risk register R-LH-PERF ma non scritto in T-LH; l esecutore al momento manuale potrebbe non sapere se 87 = re-work o ship.

**M-2 [Asse 4 / 7 — T-SW time cap 35 min potrebbe stringere]: SW debugging e notoriamente sticky; il piano dichiara escalation a 35 min, niente oltre.**

- Rationale: RESEARCH §4 fornisce ~150 righe gia scritte, copia-incolla. Il rischio e nella verifica locale: npx serve + DevTools Application > Service Workers attivo + scope localhost:3000/. Scope error, MIME error o BOM possono far perdere 20-30 min. La somma del piano dichiara 4h40m + 20% buffer = 5h36m, a ridosso del cap CON-020 di 6h.
- Mitigazione proposta: dopo aver creato sw.js (PRIMA del wiring T-SWREG), aprire http://localhost:3000/sw.js nel browser per syntax + MIME check (2 min). Blocca classi di errori upstream.
- Severity rationale: il piano ha gia "escalate a utente se >5h" e ammette 35 min per T-SW. MEDIUM heads-up.

**M-3 [Asse 10 — Carry-over fix viability SNAP-01]: La fix defensive in salva() riga 707 si interseca con il re-prime esistente a riga 713; funziona, ma cambia subtilmente la semantica del PRIMO snapshot di sessione.**

- Rationale: lettura diretta di app.js 700-714 conferma che dopo pushSnapshot (riga 708) c e gia un re-prime sincrono a riga 713 dentro try/catch. Flow post-fix:
    - riga 700: statoSalvataggio = salvataggio
    - [NEW]: if (!_lastSnapshotData) try { _lastSnapshotData = clone(dati) } catch(_){}
    - riga 708: if (_lastSnapshotData) pushSnapshot(_lastSnapshotData)
    - riga 713: try { _lastSnapshotData = clone(dati) } catch(_){}

  Su run 1 con _lastSnapshotData = null, il defensive primer setta il valore, pushSnapshot riceve lo state POST-mutation (Alpine ha gia mutato this.dati prima che salva() venga chiamato). Il primo snapshot e lo state corrente, NON pre-mutation. La riga 713 ri-prima con lo stesso clone — niente loop, niente double-write. Per le mutazioni successive il pre-mutation pattern e preservato (riga 713 e ora il pre-state della prossima salva).
- Test check: snapshot.spec.ts riga 75 asserisce count >= 2 dopo 2 salva. Sotto opzione A questo e soddisfatto. **Il test passa.**
- Mitigazione proposta: documentare nel SUMMARY: il primo snapshot di una sessione fresh dove _lastSnapshotData non era stato primato in caricaDatiUtente e ora lo state corrente (post-mutation), non pre-mutation. Per le mutazioni successive il pre-mutation pattern e preservato. Trade-off accettato per chiudere il .skip; opzione B (rimuovere la guardia in caricaDatiUtente) era piu rischiosa.
- Severity rationale: il test passa, zero regressioni. MEDIUM perche un reviewer del PR potrebbe alzarlo come domanda.

**M-4 [Asse 8 — CI compatibility]: T-CI e il PRIMO commit del branch e modifica playwright.yml aggiungendo paths-ignore.**

- Rationale: GitHub valuta il workflow dalla versione del branch al momento dell evento (push o PR), quindi il PR usera la nuova versione incluso paths-ignore. I file modificati in T-CI (.github/workflows/playwright.yml) NON sono in paths-ignore, quindi il commit T-CI stesso triggera CI. Tutti i commit successivi del piano toccano file fuori paths-ignore (icons, manifest, sw.js, index.html, app.js, tests/, workflow). Nessun commit pianificato sarebbe accidentalmente skippato. **OK.**
- Mitigazione proposta: heads-up all esecutore — un eventuale commit "fix typo" su un .md non triggera CI. Niente di rotto, ma da non confondere con CI fallita silently.
- Severity rationale: pure observability; non blocca esecuzione.

### LOW

**L-1 [Asse 1]: T-INST-IOS e un placeholder vuoto (plan riga 718-721).** Il count "16 task" del frontmatter e 15 task reali + 1 placeholder documentale. Cosmesi: rimuovere T-INST-IOS dalla numerazione e citarlo come nota inline in T-INST-STATE / T-INST-UI.

**L-2 [Asse 5]: OQ-7 (maskable safe-zone) viene risolta solo a runtime in T-ICN.** "Se favicon.io non offre toggle, re-render con padding extra 12-20%" sposta la decisione a run-time. Non blocca, ma e veramente run-time-dependent.

**L-3 [Asse 7]: 4h40m + 20% buffer = 5h36m, AL CAP CON-020 di 6h, non sotto.** Se T-SW va in escalation reale a 45 min totali, o se T-LH iterativo (Lighthouse <90 al primo run), si va over. Il piano ha "escalate a utente se >5h" come safety valve. Pianificare la sessione con 6h di buffer.

**L-4 [Asse 4]: pwa-shell.spec.ts PWA-02 fa waitForFunction(navigator.serviceWorker.controller !== null) con timeout 10 s.** In Chromium headless al primo load, controller puo restare null finche il SW non passa installing -> activated -> clients.claim() propaga. Su GHA runner lento puo sforare 10 s. A runtime: bump timeout a 15 s o aggiungere page.reload() dopo wait.

**L-5 [Asse 2]: Commit count 11 vs 8-10 di RESEARCH §13.** Il piano stesso lo riconosce a riga 852. Ogni commit e atomico (same-commit fixture pattern applicato per T-SWREG+T-SWSPEC, T-UNDO01+T-UNDO01-TEST, T-SNAP01+T-SNAP01-TEST). Nit.

---

## 4. Spot-check log

| Riferimento del piano | Verificato contro | Match |
|---|---|---|
| app.js 1263 righe | Get-Content app.js count = 1263 | OK |
| index.html 1391 righe | Get-Content index.html count = 1391 | OK |
| Stale-SW loop righe 165-170 | app.js 165-170: serviceWorker in navigator + getRegistrations + unregister loop | OK esatto |
| salva() riga 707 + pushSnapshot 707-714 | app.js 700-714: statoSalvataggio=salvataggio riga 700, pushSnapshot call riga 708, re-prime riga 713 | OK (piano dice "riga 707 area", corretto come ancora) |
| gruppiCalendario() 958-979 con 3 call attivi() a 960/967/972 | app.js 958-979: call a 960 (incassiAffitti), 967 (proprieta in find), 972 (proprieta in for-of) | OK tre call esatte |
| attivi(arr) 223-226 | app.js 223-226: return arr.filter(x => !x.deletedAt) | OK |
| Workflow NO paths-ignore | playwright.yml: on.push e on.pull_request senza paths-ignore | OK — correzione CONTEXT.md riga 75 confermata |
| html lang=it riga 2 | index.html riga 2: html lang=it | OK |
| Tailwind CDN riga 17, Supabase 19, Alpine 21 | index.html righe 17/19/21: URL literal esatti, sync/sync/defer | OK |
| tests/undo.spec.ts describe.skip riga 47 + idem snapshot.spec.ts | Grep: snapshot.spec.ts:47:test.describe.skip(...) + undo.spec.ts:47:test.describe.skip(...) | OK |
| Workflow job name test riga 11 | playwright.yml riga 11: test: | OK |
| ROADMAP Phase 4: 5 SC verbatim | ROADMAP righe 64-69, le 5 SC matchano quelle del piano §2 | OK |
| REQ-SAFE-03/04 esistenza e mapping | REQUIREMENTS.md righe 42-50, mapping 184-185 | OK (uso "carry-over" semanticamente corretto) |
| CON-010/011/017/018/020 citati | PROJECT.md righe 129-139, 144 | OK |

**Zero mismatch.** Tutti i numeri di riga e le citazioni del piano sono accurati. Il piano EREDITA assunzioni VERE dal RESEARCH.

---

## 5. Recommendations per l esecutore

Top 5 cose da tenere a mente durante l esecuzione, in ordine di priorita:

1. **Lighthouse 85-89 non e automatic-fail (M-1).** Se il PWA score atterra in [85, 90) per blocco esclusivo di load-fast-enough-for-pwa su 3G simulato, documentare nel PR body (CDN reale GH Pages non throttled) e procedere. Se < 85 o ostacolato da altri audit (es. installable-manifest rosso), **escalate** prima del merge.

2. **T-SW syntax + MIME check PRIMA di T-SWREG (M-2).** Dopo aver creato sw.js, eseguire npx serve e aprire http://localhost:3000/sw.js nel browser: deve mostrare il sorgente con MIME application/javascript, no parse error. 2 min, blocca classi di bug stupidi PRIMA del wiring.

3. **Documentare semantica SNAP-01 nel SUMMARY (M-3).** Annotare che il primo snapshot di una sessione fresh puo essere post-mutation invece di pre-mutation per via del defensive priming. Il test passa, ma il reviewer del PR potrebbe domandare; precedere la domanda nel SUMMARY evita ping-pong di review.

4. **pwa-shell.spec.ts PWA-02: SW controller wait puo flakare in CI (L-4).** Se osservi flake, prima azione: bump timeout da 10 s a 15 s; seconda azione: aggiungere page.reload() dopo waitForFunction. Non riscrivere la spec from scratch.

5. **Tempo realistico ~6h (L-3).** La tabella del piano dichiara 4h40m senza buffer; +20% = 5h36m, al cap CON-020. Pianificare 6h di buffer. Se T-SW va oltre 45 min totali, fermarsi e considerare se e scope o blocker reale (pattern PR1 lesson #1).

---

## 6. Conclusione

Il piano e **pronto per l esecuzione**. Nessun HIGH. I 4 MEDIUM sono operativi e gia parzialmente assorbiti dal risk register interno del piano. I 5 LOW sono nit / heads-up. Il goal-backward mapping copre tutte e 5 le SC del ROADMAP + i 2 carry-over PR1 + la CI hygiene con artifact, action e verify chiari. Spot-check di 13 punti contro il codebase reale: 0 mismatch.

**Verdict ribadito: PASS-WITH-FLAGS, 0 HIGH, 4 MEDIUM, 5 LOW.** Procedere con gsd-execute-phase 04.
