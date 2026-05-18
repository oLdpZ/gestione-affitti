# Phase 2: PR0 — Apple/Sonoma Redesign + Responsive — Research

**Researched:** 2026-05-18
**Domain:** UI restyle (single-file Alpine + Tailwind CDN + CSS custom)
**Confidence:** HIGH (token estratti 1:1 dal file di handoff; pattern verificati nel codice di riferimento; selettori Playwright letti dal sorgente)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Stack & Build**: nessun build step. Alpine.js + Tailwind CDN + CSS custom semantico. NO PostCSS, NO Vite, NO bundler. Source of truth DEC-001 + DEC-019.
- **Single-file `index.html`** preservato. CSS custom puo' restare inline in `<style>` o essere estratto in `style.css` (a discrezione di Claude).
- **Nessuna nuova runtime dependency** oltre Google Fonts CSS.
- **Visual identity LOCKED** dal handoff bundle `sbPqzZsV396NsMp4jSK5eQ`:
  - Mesh USA **astratta** (6 orbs, no stripes, no stars), `blur(45px) saturate(125%)`.
  - Glass: `rgba(255,255,255,0.35)` + `backdrop-filter: blur(60px) saturate(200%)` + inset highlight bianco.
  - Tema **light only** (no dark mode in PR0).
- **Typography LOCKED**: Inter Tight (display) + Inter (body) + JetBrains Mono (numerali). Google Fonts via `<link>`, `font-display: swap`.
- **Layout LOCKED**: window shell con traffic lights decorativi, sidebar 232px desktop ≥900px, drawer overlay <900px con hamburger + backdrop + body scroll lock + ESC + tap-outside.
- **Breakpoint singolo** a 900px per sidebar collapse.
- **Login screen** restilizzato glass+mesh; il video `276973.mp4` **rimosso** dal repo. `.design-ref/` directory in `.gitignore`.
- **Regression LOCKED**: tutti i 5 test LOCKED Playwright (CON-017) + gli 8 LIVE devono passare; ramo + PR0 contro master, no push diretto, `Playwright Tests` check verde obbligatorio per il merge.
- **Out of scope** in PR0: ⌘K wiring (solo placeholder visuale), Cestino/snapshot/undo (Phase 3), PWA (Phase 4), nuove entita (Phase 5), dark mode, qualsiasi cambio di Alpine state shape, Supabase, localStorage keys.

### Claude's Discretion
- CSS inline vs `style.css` esterno (file singolo `index.html` resta vincolo).
- Logica drawer toggle: nuovo `x-data` scope vs estensione di `app()` Alpine root.
- Valori pixel esatti per shadow/spacing oltre quelli in `:root`.
- Organizzazione delle custom properties (singolo `:root` vs grouped by concern).
- Ordine di restyle delle viste.

### Deferred Ideas (OUT OF SCOPE)
- Multi-account familiare / sharing.
- Backup automatico cifrato cloud.
- ⌘K command palette **wiring** (visivo si, logica no).
- Edit/Delete righe per entita non ancora esistenti in Impostazioni.
- Dark mode.
- Cambi al data model, Supabase, Alpine state shape, localStorage keys.
- Microinteractions oltre la transizione drawer.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-UI-01 | Apple/Sonoma full UI redesign su tutte le viste; glass + mesh CSS USA astratto; video 4.7MB rimosso; Inter Tight + Inter + JetBrains Mono via Google Fonts; sidebar→drawer <900px; design tokens da `:root` handoff; `.design-ref/` gitignored. | Section 1 (token estratti), 2 (ricetta mesh), 3 (glass), 4 (fonts), 5 (component mapping), 6 (drawer responsivo), 7 (asset cleanup) |
</phase_requirements>

## Summary

Il design handoff e' un prototipo HTML/React+Babel in `wiki/projects/gestione-affitti-design-handoff/project/design_handoff_apple_redesign/Gestione Affitti.html`. Tutti i design token vivono in un singolo blocco `:root` (righe 14-71) gia' completo: 4 surface, 4 border/divider, 4 livelli di testo, palette accent + 5 status colors iOS, 6 radius, 5 shadow + window, 3 font stacks. Mesh, glass surface, focus ring, scrollbar, animazioni sono gia' definite in CSS puro nello stesso file — sono **pronti da copia-incollare** nel `index.html` target. Il prototipo React di `js/*.jsx` serve solo come riferimento visivo per la composizione dei componenti; il target rimane Alpine.

L'app reale ha **2 grosse sorgenti di rischio**: (1) la suite Playwright fa heavy match per classi Tailwind (`bg-yellow-50`, `bg-green-50`, `bg-red-50`, `bg-gray-50`), per `[x-show="mostraFormProprieta"]`, per `.status-dot`, e per `h3:"Proprieta"`. Cambiando le classi tutte queste asserzioni cadono. (2) Il `backdrop-filter` con `blur(60px) saturate(200%)` su Safari iOS richiede prefisso `-webkit-` e ha costo perf significativo su iPhone vecchi.

**Primary recommendation:** approccio in 7 layer (token → mesh+glass → window shell desktop → drawer responsivo → restyle delle 6 viste partendo da Dashboard → login restyle + rimozione video → regression Playwright + smoke iPhone). Aggiungere `data-testid` strategici (`data-testid="status-dot"`, `data-testid="prop-section"`, `data-testid="prop-form"`, `data-testid="orfani-group"`) durante il restyle e aggiornare i selettori Playwright contestualmente, in modo che la suite resti verde a ogni commit intermedio.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design tokens (`:root` custom props) | Browser / Client (CSS) | — | Pure CSS variables, no build step. |
| Mesh background + grain | Browser / Client (CSS) | — | `body::before` + `body::after` con radial-gradient e SVG data-URI inline. |
| Glass surfaces (`backdrop-filter`) | Browser / Client (CSS) | — | Visual-only, supporto via `@supports`. |
| Sidebar↔drawer responsive | Browser / Client (CSS + Alpine x-data) | — | Breakpoint CSS + boolean Alpine per visibility. |
| Body scroll lock drawer aperto | Browser / Client (Alpine) | — | Toggle classe `.no-scroll` su `<body>` quando drawer aperto. |
| Typography (Google Fonts) | Browser / Client (CDN) | — | `<link>` Google Fonts CSS, font-display swap. |
| Playwright regression suite | CI / Test (Playwright Chromium) | — | Phase 1 ha gia' shippato CI; PR0 deve restare verde. |

## Standard Stack

### Core (gia' presenti in `index.html` — da preservare)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Alpine.js | 3.x.x (CDN) | Reattivita state-driven senza build | LOCKED (DEC-003). x-data, x-show, x-model intatti. |
| Tailwind CSS CDN | 3.x (cdn.tailwindcss.com) | Utility classes | LOCKED (DEC-003). Convive con CSS custom. |
| @supabase/supabase-js | 2.x | Auth + sync | Fuori scope PR0, intatto. |

### Additions in PR0

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Google Fonts CSS | n/a (CDN) | Inter Tight + Inter + JetBrains Mono | `<link>` in `<head>`, `display=swap`. [VERIFIED: handoff `Gestione Affitti.html` line 10] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS custom in `<style>` inline | File esterno `style.css` referenziato da `<link>` | Riduce dimensione `index.html` ma aggiunge 1 round trip iniziale. Su GitHub Pages e con file < 50KB inline e' irrilevante. **Raccomandazione: mantenere inline** per non aggravare il single-file vincolo CON-001. |
| Google Fonts CSS | Self-host woff2 in repo | Self-host evita third-party request e FOUT piu' controllato, ma viola "no nuovi asset" e aumenta repo size. **Raccomandazione: Google Fonts come deciso in CONTEXT.md.** |
| Tailwind 3 CDN | Tailwind v4 CDN | v4 cambia API config (CSS-first); il `tailwind.config = {...}` inline alle righe 22-32 di `index.html` non funzionerebbe. **Restare su v3.** [VERIFIED: codebase grep] |

**Installation:** nessuna installazione. Solo aggiungere `<link>` Google Fonts in `<head>`.

**Version verification:** Tailwind/Alpine/Supabase sono pinnati via CDN; nessun cambio versione in PR0.

## Architecture Patterns

### System Architecture Diagram

```
┌─ index.html (singolo file) ────────────────────────────────────────┐
│                                                                    │
│  <head>                                                            │
│    Tailwind CDN  ──► Alpine CDN  ──► Supabase CDN                  │
│    Google Fonts CSS (preconnect + display=swap)                    │
│    <style> :root tokens + mesh + glass + drawer CSS </style>       │
│                                                                    │
│  <body class="bg-base">                                            │
│    ::before  → 6 radial-gradient orbs USA + blur(45px)             │
│    ::after   → SVG grain noise (mix-blend overlay)                 │
│                                                                    │
│    <div x-data="app()" class="window-shell">                       │
│      ├─ Login screen (x-show="!utente")  ──► glass card + mesh     │
│      ├─ Loading screen (x-show="caricamentoIniziale")              │
│      └─ App principal (x-if="utente")                              │
│         │                                                          │
│         ├─ <aside class="sidebar">  desktop ≥900px persistent      │
│         │     [traffic lights] [logo] [nav 3 sezioni] [user card]  │
│         │                                                          │
│         └─ <main>                                                  │
│              ├─ <header class="topbar"> [hamburger <900px] [title] │
│              │     [search ⌘K visual] [Esporta]                    │
│              └─ <div class="page-body" overflow:auto>              │
│                    x-show="vistaCorrente === 'dashboard'"  → ...   │
│                    x-show="vistaCorrente === 'calendario'" → ...   │
│                    x-show="vistaCorrente === 'proprieta'"  → ...   │
│                    x-show="vistaCorrente === 'banche'"     → ...   │
│                    x-show="vistaCorrente === 'utenze'"     → ...   │
│                    x-show="vistaCorrente === 'impostazioni'"→ ...  │
│                                                                    │
│    Drawer overlay (x-show="drawerOpen" <900px):                    │
│      backdrop (tap-to-close) + sidebar slide-in 200-250ms          │
└────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
index.html              # singolo file, restilato
  <head>
    Google Fonts <link>
    <style>             # CSS custom: :root + mesh + glass + responsive
                        # Suggerimento: NON estrarre in style.css (vincolo single-file)
  <body>
    <div x-data="app()" x-data-extra="{ drawerOpen: false }">
      ...
.design-ref/            # copia handoff bundle (gitignored)
  Gestione Affitti.html
  js/*.jsx
  screenshots/*.png
.gitignore              # + ".design-ref/"
276973.mp4              # → DA RIMUOVERE
```

### Pattern 1: Design tokens come CSS custom properties

**What:** singolo blocco `:root` con tutte le custom property. Tailwind utilities possono fare reference via arbitrary values (`bg-[var(--surface)]`), ma le superfici glass conviene scriverle come classi semantiche CSS (`.glass-card`, `.btn-primary`) perche' Tailwind non esprime `backdrop-filter + box-shadow inset + border` in modo pulito.

**When to use:** sempre. Eviti magic numbers sparsi nel DOM, e consenti theming futuro (dark mode in una phase futura) senza riscrivere markup.

**Example:**
```css
/* Source: handoff Gestione Affitti.html righe 14-71 [VERIFIED] */
:root {
  --surface: rgba(255, 255, 255, 0.55);
  --accent: #0071e3;
  --r-md: 12px;
  --shadow-md: 0 6px 24px -8px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.04);
  /* ... */
}

.glass-card {
  background: var(--surface);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 0.5px solid rgba(255,255,255,0.7);
  border-radius: var(--r-md);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), var(--shadow-md);
}
```

### Pattern 2: Drawer responsive con Alpine + CSS

**What:** boolean `drawerOpen` nell'Alpine root, CSS `@media (max-width: 899px)` per mostrare hamburger + posizionare la sidebar come overlay con `transform: translateX(-100%)` → `translateX(0)`.

**When to use:** per il collasso sidebar <900px.

**Example:**
```html
<!-- Source: pattern derivato; Alpine docs verified -->
<button @click="drawerOpen = true" class="hamburger lg-hidden">☰</button>
<div x-show="drawerOpen" @click="drawerOpen = false" class="drawer-backdrop"></div>
<aside :class="{ 'drawer-open': drawerOpen }" class="sidebar">...</aside>
```
```css
@media (max-width: 899px) {
  .sidebar { position: fixed; inset: 0 auto 0 0; width: 280px;
             transform: translateX(-100%); transition: transform 220ms cubic-bezier(.2,.8,.2,1); }
  .sidebar.drawer-open { transform: translateX(0); }
  .drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.18);
                     backdrop-filter: blur(6px); z-index: 40; }
}
@media (min-width: 900px) {
  .hamburger { display: none; }
}
body.drawer-locked { overflow: hidden; }  /* applicata via x-effect quando drawerOpen */
```

### Anti-Patterns to Avoid

- **Non sostituire** `backdrop-filter` con `opacity` puro: il vetro perde l'effetto Sonoma. Usa `@supports` fallback con `background: rgba(255,255,255,0.85)` solido.
- **Non animare** le 6 orbs della mesh: il blur(45px) animato e' killer perf su mobile.
- **Non infilare** la mesh in un `<div>` separato: l'handoff la mette su `body::before` con `z-index: 0`, e `#root { z-index: 1 }`. Manteniamo lo stesso pattern per evitare stacking context bugs.
- **Non rimuovere** `font-feature-settings: 'cv11', 'ss01', 'ss03'` su body: e' parte dell'identita' Inter Apple-style.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Effetto vetro Apple | CSS finto con gradient/opacity | `backdrop-filter: blur(...) saturate(...)` (handoff token) | Sonoma look richiede campionamento del background; gradient finto non lo replica. |
| Grain noise pattern | PNG noise scaricato | SVG `<feTurbulence>` inline data-URI (riga 122 handoff) | Zero asset, scala perfetta, riga di CSS. |
| Mesh background | `<video>` o immagine | 6 `radial-gradient` su `body::before` | -4.7MB di bundle, animabile via custom props se mai servisse. |
| Focus rings | `outline: 2px blue` generico | `:focus-visible { outline: 3px solid var(--accent-ring) }` (handoff) | Apple-style, accessibile, gia' definito in `:root`. |
| Drawer slide animation | JS-driven (alpine `x-transition`) | CSS `transform + transition` 220ms cubic-bezier(.2,.8,.2,1) | Smoother su mobile, GPU-accelerato, no flash di JS. |
| Tabular numerics | Custom font-family per importi | `font-variant-numeric: tabular-nums` (helper `.tnum`) | Gia' definito nel handoff CSS, supportato in Inter. |
| Hamburger icon | Libreria icone | SVG inline 24×24 stroke 1.6 (pattern di `js/icons.jsx`) | Coerente con resto delle icone del prototipo. |

**Key insight:** ogni effetto visivo Apple richiesto e' **gia' scritto** nel file di handoff. Il rischio non e' scrivere CSS sbagliato — e' deviare dal handoff. Trattare il blocco `<style>` del handoff come **fonte di verita' assoluta** e copiarlo 1:1 nel `index.html`, poi aggiungere solo la parte di drawer responsive (che il handoff non copre).

## Runtime State Inventory

Phase di puro restyle CSS/HTML. Nessun rename/refactor di nomi runtime.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verificato: nessuna stringa nel DB Supabase referenzia classi CSS o nomi di view. | nessuna |
| Live service config | None — verificato: nessun webhook, dashboard esterno, o config UI dipende da PR0. | nessuna |
| OS-registered state | None — l'app gira solo nel browser. Service worker non ancora registrato (gate PR2a). | nessuna |
| Secrets/env vars | `SUPABASE_TEST_URL`, `SUPABASE_SERVICE_KEY`, `TEST_EMAIL`, `TEST_PASSWORD`, `TEST_USER_ID` esistono in `.env.test` (Phase 1). PR0 **non li tocca**. | nessuna |
| Build artifacts | `node_modules/` (Playwright), `playwright-report/`, `test-results/`. Tutti gia' in `.gitignore`. PR0 non genera artefatti nuovi. Da rimuovere fisicamente: `276973.mp4` (file binario tracciato da git). | `git rm 276973.mp4` come parte del task asset cleanup. |

## 1. Design tokens estratti (LOCKED extraction)

> Estratti 1:1 da `wiki/projects/gestione-affitti-design-handoff/project/design_handoff_apple_redesign/Gestione Affitti.html` righe 14-71. Tutti `[VERIFIED: handoff Gestione Affitti.html]`.

### Color — surface

| Token | Value | Semantic name | Uso |
|-------|-------|---------------|-----|
| `--bg-base` | `#f5f5f7` | base background sotto mesh | `body { background: var(--bg-base) }` |
| `--surface` | `rgba(255, 255, 255, 0.55)` | glass primario | card, table |
| `--surface-solid` | `#ffffff` | solido | raro, fallback |
| `--surface-elevated` | `rgba(255, 255, 255, 0.7)` | glass elevato | modal |
| `--sidebar-bg` | `rgba(246, 246, 248, 0.4)` | sidebar | aside |
| `--topbar-bg` | `rgba(248, 248, 250, 0.5)` | topbar | header |

### Color — strokes & dividers

| Token | Value | Uso |
|-------|-------|-----|
| `--border` | `rgba(0, 0, 0, 0.08)` | border standard |
| `--border-strong` | `rgba(0, 0, 0, 0.12)` | pulsanti, evidenza |
| `--divider` | `rgba(0, 0, 0, 0.06)` | divisori tabella |

### Color — text

| Token | Value | Uso |
|-------|-------|-----|
| `--text-primary` | `#1d1d1f` | testo principale |
| `--text-secondary` | `#6e6e73` | label, subtitle |
| `--text-tertiary` | `#86868b` | tenue |
| `--text-quaternary` | `#aeaeb2` | placeholder |

### Color — accent (Apple blue)

| Token | Value | Uso |
|-------|-------|-----|
| `--accent` | `#0071e3` | CTA primarie, sidebar attiva |
| `--accent-hover` | `#0077ed` | hover |
| `--accent-soft` | `rgba(0, 113, 227, 0.08)` | badge blu bg |
| `--accent-ring` | `rgba(0, 113, 227, 0.4)` | focus ring 3px |

### Color — status (iOS system)

| Token | Value | Uso |
|-------|-------|-----|
| `--green` / `--green-soft` | `#34c759` / `rgba(52,199,89,0.12)` | incassato / pagato |
| `--amber` / `--amber-soft` | `#ff9f0a` / `rgba(255,159,10,0.14)` | atteso / warning |
| `--red` / `--red-soft` | `#ff3b30` / `rgba(255,59,48,0.12)` | ritardo / errore |
| `--purple` / `--purple-soft` | `#af52de` / `rgba(175,82,222,0.12)` | riservato |
| `--teal` / `--teal-soft` | `#5ac8fa` / `rgba(90,200,250,0.14)` | acqua (utenze) |

### Color — special palette (README handoff, non in `:root`)

- Acqua `#5ac8fa` · Gas `#ff9f0a` · Luce `#ffcc00`
- Avatar utente: gradiente `#ff9f0a → #ff3b30`
- Logo app: gradiente `#0071e3 → #5e9eff`

**Proposta semantica per produzione:** aggiungere a `:root`:
```css
--utenza-acqua: #5ac8fa;
--utenza-gas:   #ff9f0a;
--utenza-luce:  #ffcc00;
--gradient-logo: linear-gradient(135deg, #0071e3, #5e9eff);
--gradient-avatar: linear-gradient(135deg, #ff9f0a, #ff3b30);
```

### Radius

| Token | Value | Uso |
|-------|-------|-----|
| `--r-xs` | `6px` | sidebar item |
| `--r-sm` | `8px` | mini-calendar cell |
| `--r-md` | `12px` | card, table |
| `--r-lg` | `16px` | modal, window shell |
| `--r-xl` | `22px` | riservato |
| `--r-pill` | `999px` | badge, pill button |

Pulsanti standard: `border-radius: 7px` (non-pill) — letterale dal handoff README. **Claude's discretion**: aggiungere `--r-button: 7px` per coerenza.

### Shadow

| Token | Value |
|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)` |
| `--shadow-md` | `0 6px 24px -8px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.04)` |
| `--shadow-lg` | `0 20px 50px -20px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.05)` |
| `--shadow-window` | `0 30px 80px -30px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.08)` |

**Highlight interno glass** (non un token formale ma pattern ricorrente): `inset 0 1px 0 rgba(255,255,255,0.7)`.

### Blur — backdrop intensities (handoff README sezione "Blur / backdrop")

| Elemento | Backdrop |
|----------|----------|
| Window shell | `blur(60px) saturate(200%)`, bg `rgba(255,255,255,0.35)` |
| Sidebar | `blur(30px) saturate(200%)`, gradient bg `rgba(255,255,255,0.45→0.25)` |
| Topbar | `blur(30px) saturate(200%)`, gradient bg `rgba(255,255,255,0.5→0.2)` |
| Card / Table | `blur(20px) saturate(180%)`, bg `rgba(255,255,255,0.55)` |
| Modal | `blur(50px) saturate(200%)`, bg `rgba(255,255,255,0.75)` |
| Modal backdrop | `blur(6px)`, bg `rgba(0,0,0,0.18)` |

**Proposta semantica:**
```css
--blur-card: blur(20px) saturate(180%);
--blur-shell: blur(60px) saturate(200%);
--blur-chrome: blur(30px) saturate(200%); /* sidebar + topbar */
--blur-modal: blur(50px) saturate(200%);
--blur-backdrop: blur(6px);
```

### Spacing

Scala 4px-based: `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40`.
- Padding card compatte: 14-16px; hero 22px.
- Gap grid: 12-14px.
- Padding page-body: 24px vert · 28px horiz.

**Non presenti in `:root` del handoff** — Claude's discretion. **Proposta:** rimanere su Tailwind utility (`p-4`, `gap-3`) per spacing, non promuovere a custom property (eviti bloat).

### Typography stack

```css
--font-display: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
--font-text:    'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
```

Type scale (handoff README "Type scale principale"):

| Element | Size | Weight | Letter-spacing |
|---------|------|--------|----------------|
| Hero h1 dashboard | 36px | 600 | -0.03em |
| View title h1 | 28px | 600 | -0.025em |
| Topbar title | 20px | 600 | -0.02em |
| Section h2 | 17px | 600 | -0.015em |
| Section h3 uppercase | 13px | 600 | +0.04em |
| Body/table | 12.5-13px | 400-500 | — |
| Label form | 11.5px | 500 | — (color secondary) |
| Microcopy | 11px | 400 | — (color tertiary) |
| Eyebrow uppercase | 10.5-12px | 600 | +0.04-0.06em |

### Flagged missing — Claude's discretion proposta default

- **Z-index scale**: handoff non lo definisce esplicitamente (usa `#root z-index:1`). Proposta default: `--z-base: 0` · `--z-content: 1` · `--z-sidebar: 30` · `--z-topbar: 31` · `--z-drawer-backdrop: 40` · `--z-drawer: 41` · `--z-modal-backdrop: 50` · `--z-modal: 51` · `--z-toast: 60`.
- **Transition durations**: handoff usa valori inline (`0.28s cubic-bezier(0.2,0.8,0.2,1)`, `0.15s`, `0.4s`). Proposta: `--ease-out-apple: cubic-bezier(0.2, 0.8, 0.2, 1)` · `--dur-fast: 120ms` · `--dur-md: 220ms` · `--dur-slow: 400ms`.
- **Drawer-specific tokens**: non nel handoff (era flagged come "open question" alla fine del README handoff). Proposta: `--drawer-width: 280px`, `--drawer-duration: 220ms`.

## 2. Mesh background — ricetta finale

Letterale dal handoff `Gestione Affitti.html` righe 92-125 (versione "piu astratta" scelta dall'utente in `chats/chat1.md`):

```css
/* Mesh USA astratta — 6 orbs + grain. Source: handoff righe 92-125 [VERIFIED] */
body::before {
  content: '';
  position: fixed;
  inset: -15%;
  background:
    /* Navy orb — upper-left ("cantone") */
    radial-gradient(closest-side at 12% 18%, #1e3a8a 0%, rgba(30,58,138,0.55) 40%, transparent 75%),
    /* Secondary blue — mid-left, softer */
    radial-gradient(closest-side at 28% 70%, #3b6ad6 0%, rgba(59,106,214,0.4) 40%, transparent 75%),
    /* Big red orb — right */
    radial-gradient(closest-side at 88% 35%, #d62828 0%, rgba(214,40,40,0.55) 40%, transparent 75%),
    /* Warm red glow — bottom-right */
    radial-gradient(closest-side at 75% 95%, #c92626 0%, rgba(201,38,38,0.45) 40%, transparent 75%),
    /* Cream highlight — center-top */
    radial-gradient(closest-side at 50% 8%, #fdf6e8 0%, rgba(253,246,232,0.6) 50%, transparent 80%),
    /* Cream/pink wash — center */
    radial-gradient(closest-side at 55% 55%, #fce8dc 0%, rgba(252,232,220,0.5) 50%, transparent 80%);
  filter: blur(45px) saturate(125%);
  opacity: 0.9;
  pointer-events: none;
  z-index: 0;
}

/* Grain noise — SVG inline data-URI in mix-blend overlay */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.30;
  mix-blend-mode: overlay;
}

#root { position: relative; z-index: 1; height: 100vh; }
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: var(--bg-base); }
```

**Nota chat1.md (decisione finale dell'utente):**
> "piu astratta" → 6 orbs morbidi (2 blu + 2 rossi + 2 cream), blur 45px, saturate 125%, NO stripes, NO stars.

## 3. Glass surface — pattern unico

Pattern canonico (sintesi dal `.vibrancy` handoff + README handoff sezione "Blur / backdrop"):

```css
/* Glass surface canonica per card / table / modal. Source: handoff righe 181-185 + README */
.glass-surface {
  background: var(--surface);                           /* rgba(255,255,255,0.55) */
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 0.5px solid rgba(255,255,255,0.7);            /* highlight bordo */
  border-radius: var(--r-md);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),                /* inset highlight bianco — il dettaglio chiave */
    var(--shadow-md);
}

/* Varianti */
.glass-shell      { background: rgba(255,255,255,0.35); backdrop-filter: var(--blur-shell);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), var(--shadow-window); }
.glass-sidebar    { background: linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.25));
                    backdrop-filter: var(--blur-chrome); }
.glass-topbar     { background: linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2));
                    backdrop-filter: var(--blur-chrome);
                    border-bottom: 0.5px solid rgba(255,255,255,0.4); }
.glass-modal      { background: rgba(255,255,255,0.75); backdrop-filter: var(--blur-modal); }
.glass-modal-bg   { background: rgba(0,0,0,0.18); backdrop-filter: var(--blur-backdrop); }

/* Fallback: dove backdrop-filter non e' supportato (Firefox vecchio, some Android WebView) */
@supports not (backdrop-filter: blur(60px)) {
  .glass-surface, .glass-shell, .glass-sidebar, .glass-topbar, .glass-modal {
    background: rgba(255,255,255,0.92);
  }
}
```

**Browser support:** `backdrop-filter` con `-webkit-` prefix copre Safari 9+, iOS Safari 9+, Chrome 76+, Edge 79+, Firefox 103+ [CITED: caniuse.com/css-backdrop-filter — ASSUMED current as of 2026]. Il prefisso `-webkit-` e' obbligatorio per iOS Safari (target principale per CON-005 mobile-first).

## 4. Typography — caricamento Google Fonts

Letterale dal handoff `Gestione Affitti.html` righe 8-10 [VERIFIED]:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Weights effettivamente caricati** (per evitare bloat):
- Inter: 400, 500, 600, 700
- Inter Tight: 500, 600, 700, 800
- JetBrains Mono: 400, 500

`display=swap` garantisce no-FOIT (fallback system font subito, swap quando webfont arriva).

**CSS font-family stacks** con system fallbacks (gia' definiti in `:root`):
```css
--font-display: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
--font-text:    'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
```

**Body base** (riga 75-90 handoff):
```css
html, body {
  font-family: var(--font-text);
  font-size: 14px;
  line-height: 1.45;
  letter-spacing: -0.005em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: 'cv11', 'ss01', 'ss03';
}
h1, h2, h3, h4, h5 {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0;
}
.tnum { font-variant-numeric: tabular-nums; }
```

## 5. Component mapping (handoff React → target Alpine)

### Dashboard

| Handoff React (visivo) | Esistente in `index.html` | Cambia |
|------------------------|---------------------------|--------|
| Hero "Buongiorno, Mario" + eyebrow mese + sub | `<h2>` "Dashboard — <mese>" (riga 212) | Restyle: eyebrow `MAGGIO 2026`, h1 36px Inter Tight, sub con count incassi |
| Row 4 KPI Cards (Incassato/Da incassare/Ritardo/Proprieta attive) | Non presente | **Nuovo**: 4 `.kpi-card` glass con icona accent-soft + big number 24-28px + progress bar 4px |
| Segmented control Tutte/Incassate/Attese/Ritardo | Non presente | **Nuovo**: `.segment` track rgba(0,0,0,0.06) + active bianco |
| Grid Property Cards | Non presente come grid (lista in altre viste) | **Nuovo**: grid responsive di card con status pill + importo 22px + "Incassa oggi" |
| 2 colonne in basso: "Utenze in scadenza" + "Da girare per banca" | "Utenze in scadenza" gia' presente (riga 270-...) | Restyle in glass card |

### Calendario

| Handoff | Esistente | Cambia |
|---------|-----------|--------|
| Header con title + arrow nav + "Oggi" | `<h2 x-text="nomiMesi[meseCalendario] + ' ' + annoCalendario">` + 2 button arrow (righe 300-302) | Restyle: arrow → IconButton ghost glass; aggiungere bottone "Oggi" che reset al mese corrente |
| Mini-calendar 7 cols 64px cell | Non presente | **Nuovo opzionale**: il handoff ce l'ha, ma e' nice-to-have. Considerare se aggiungere o mantenere solo i gruppi attuali. **Raccomandazione: tenere solo i gruppi attuali in PR0, mini-calendar in phase future.** |
| 3 colonne Inizio/Meta/Fine mese con card-incasso border-left | `gruppiCalendario()` raggruppa per data e renderizza con bg `bg-green-50/bg-red-50/bg-gray-50/bg-yellow-50` (riga 309-) | Restyle classi → `.calendar-card` con `border-left: 3px solid var(--green|red|amber|...)`. **Mantenere data-testid o classi marker per Playwright (vedi sezione 8).** |
| Pill "Incassa oggi" / "Sistema" | Bottoni `Incassa oggi` (riga 324) + `Sistema` (riga 339) | Restyle classi → `.btn-primary` (incassa) / `.btn-warning` (sistema). Mantenere il TEXT esatto. |
| Gruppo "Incassi orfani" | h3 con `⚠ Incassi orfani (proprieta cancellata)` | Restyle h3 in `.section-eyebrow` uppercase amber. **Mantenere il regex match `/Incassi orfani/i` per Playwright.** |

### Proprieta

| Handoff | Esistente | Cambia |
|---------|-----------|--------|
| Lista: grid Property Card con banner pastello (9 colori unici) | `vistaCorrente === 'proprieta'` (riga 403-...) lista in tabella | **Restyle major**: trasformare lista in grid di card con banner gradient diverso per indice |
| Dettaglio: hero 2 colonne (info + summary anno) + filtro anno + Storico Incassi + Storico Utenze | Dettaglio gia' presente con tabelle | Restyle tabelle in glass + restyle hero |

### Banche

| Handoff | Esistente | Cambia |
|---------|-----------|--------|
| Bank tabs card 200×95px | Non come "tab card", ma navigazione presente | **Restyle**: card-tab con icona quadrata gradient, nome, intestatario, totale |
| Segment ultimi 6 mesi + table movimenti | Tabella movimenti gia' presente (riga 526) | Restyle tabella in `.glass-table` |

### Utenze

| Handoff | Esistente | Cambia |
|---------|-----------|--------|
| Header h1 + "+ Nuova utenza" | h2 "Utenze" (riga 561) | Restyle h1 28px |
| 3 stats card Luce/Gas/Acqua | Non presente | **Nuovo**: 3 stat card con totali + count "da pagare" |
| Filtri 4 select | 4 select gia' presenti (righe 564-578) | Restyle select con chevron custom |
| Table | Gia' presente (riga 618) | Restyle in glass |
| Modal "Nuova utenza" | Form inline (riga 581-...) | Restyle (form puo' restare inline o diventare modal — discrezione) |

### Impostazioni

| Handoff | Esistente | Cambia |
|---------|-----------|--------|
| h1 "Impostazioni" + sub | `<h2>` "Impostazioni" (riga 660) | Restyle h1 |
| Sezione Proprieta: header + Button "+ Nuova" + Table 8 colonne | Sezione `div.mb-8 > h3 "Proprieta"` + form `[x-show="mostraFormProprieta"]` + tabella (riga 665-) | Restyle. **PRESERVARE**: `div.mb-8`, `h3:"Proprieta"`, `[x-show="mostraFormProprieta"]`, `input[x-model="editProprieta.nome"]`, `input[type="number"]`, `button:"Salva"`, `button:"+ Nuova"`, `button:"Modifica"` (richiesti dai test). Suggerimento: aggiungere `data-testid` per future-proofing. |
| Sezione Banche | Sezione gia' presente (riga 735) | Restyle |
| Sezione Backup dati card | Esiste come bottoni (riga 196: "Esporta backup JSON") | **Nuovo opzionale**: portare in card dedicata con icona download. Discrezione. |

### Login

| Handoff (open questions handoff README) | Esistente | Cambia |
|-----------------------------------------|-----------|--------|
| Card centrale max-width ~440px, glass + mesh, logo, Field Email/Password, Button "Accedi" | Login screen righe 85-127. `<div class="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl ring-1">` + form con email/password/submit | **Restyle major**: rimuovere classi Tailwind dark-mode, applicare `.glass-modal`, logo gradient `#0071e3 → #5e9eff`, input styling handoff, Button primary apple blue. **PRESERVARE**: `input[type="email"]`, `input[type="password"]`, `button[type="submit"]` (Playwright `doLogin` li usa). Toggle login/signup mantenuto. |
| **Video MP4 background da RIMUOVERE** | `<div class="usa-flag-bg"><video src="276973.mp4">` righe 76-80 + CSS righe 43-66 | **RIMUOVERE**: il `<div class="usa-flag-bg">`, il `<video>`, le regole CSS `.usa-flag-bg*` (righe 43-66), e la regola `body > *:not(.usa-flag-bg)` (riga 66). Sostituire con mesh CSS su `body::before` + `body::after`. |

## 6. Responsive sidebar → drawer

### Strategia

- **Breakpoint singolo a 900px** (CON-005, DEC-019).
- **Stato drawer**: `drawerOpen: false`.
- **Posizione consigliata dello stato**: **estendere `app()` Alpine root** (non un nuovo `x-data`). Ragionamento:
  - Esiste gia' `mobileMenuOpen` in `app()` (riga 148) → mantenere coerenza.
  - Il drawer ha bisogno di reagire ai cambi di `vistaCorrente` (chiudere on nav-tap) → variabile gia' in `app()`.
  - Body scroll lock via `x-effect="document.body.classList.toggle('drawer-locked', drawerOpen)"` accede a `document` ma vive nello stesso scope.
  - Aggiungere semplicemente un property `drawerOpen: false` accanto a `mobileMenuOpen` (e idealmente migrare `mobileMenuOpen → drawerOpen` in PR0, ma e' refactor di nome — Claude's discretion).
- **Animazione**: 220ms cubic-bezier(0.2, 0.8, 0.2, 1). `transform: translateX(-100%) → translateX(0)`.
- **Dismiss triggers**:
  - Tap backdrop: `<div @click="drawerOpen=false" class="drawer-backdrop">`.
  - Tap nav item: ogni `@click` di voce nav setta `drawerOpen=false`.
  - ESC: `@keydown.escape.window="drawerOpen=false"`.
  - Swipe-left (nice-to-have): rinviare a phase future.
- **Body scroll lock**: `body.drawer-locked { overflow: hidden; }` via `x-effect` o `x-init` watcher.
- **Hamburger trigger**: gia' presente (riga 148, `mobileMenuOpen`). Riusare ma applicato a `drawerOpen`. Visibile solo `<900px` via classe Tailwind `lg:hidden` (default Tailwind `lg = 1024px` — NON e' il nostro 900px). **Importante**: usare classe custom `.below-900 { display: ... }` con media query custom, perche' il default breakpoint Tailwind 1024 non matcha il vincolo 900px del progetto. Oppure overridare config Tailwind inline (riga 22-32) aggiungendo `screens: { lg: '900px' }`.

### Esempio implementazione

```html
<div x-data="app()" @keydown.escape.window="drawerOpen = false" x-init="$watch('drawerOpen', v => document.body.classList.toggle('drawer-locked', v))">
  <!-- topbar -->
  <header class="topbar glass-topbar">
    <button @click="drawerOpen = true" class="hamburger" aria-label="Apri menu">☰</button>
    <!-- ... -->
  </header>

  <!-- drawer backdrop -->
  <div x-show="drawerOpen" x-transition.opacity @click="drawerOpen = false" class="drawer-backdrop"></div>

  <!-- sidebar/drawer -->
  <aside :class="{ 'drawer-open': drawerOpen }" class="sidebar glass-sidebar">
    <template x-for="v in viste" :key="v.id">
      <button @click="vistaCorrente = v.id; drawerOpen = false" :class="vistaCorrente === v.id ? 'nav-item-active' : ''" x-text="v.label"></button>
    </template>
  </aside>
</div>
```

```css
.sidebar { width: 232px; }
.hamburger { display: none; }

@media (max-width: 899px) {
  .sidebar {
    position: fixed; top: 0; bottom: 0; left: 0;
    width: 280px;
    transform: translateX(-100%);
    transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 41;
  }
  .sidebar.drawer-open { transform: translateX(0); }
  .drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.18);
                     backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index: 40; }
  .hamburger { display: inline-flex; }
}

body.drawer-locked { overflow: hidden; touch-action: none; }
```

## 7. Asset cleanup

### Da rimuovere

| File / risorsa | Dove referenziato | Azione |
|----------------|-------------------|--------|
| `276973.mp4` (root, 4.7MB) | `index.html` riga 78 `<source src="276973.mp4">` | `git rm 276973.mp4`. **Verifica:** `git ls-files \| grep mp4` deve essere vuoto. [VERIFIED: `ls` mostra il file in root] |
| `<div class="usa-flag-bg">` | `index.html` righe 76-80 | Rimuovere HTML. |
| CSS `.usa-flag-bg*` | `index.html` righe 43-66 (4 regole) | Rimuovere CSS. |
| Regola `body > *:not(.usa-flag-bg) { position: relative; z-index: 1 }` | riga 66 | Sostituire con `#root { position: relative; z-index: 1 }`. |
| Tailwind config `darkMode: 'media'` | righe 22-32 | Rimuovere `darkMode: 'media'` (light only in PR0). |
| Classi `dark:` Tailwind nei template | sparso (centinaia di occorrenze) | Visto che light-only e' LOCKED, **lasciarle inerti** (innocue senza darkMode attivo) o stripparle gradualmente — discrezione. **Raccomandazione**: non stripparle in PR0 per non gonfiare il diff; rimangono come no-op. |

### Da aggiungere

| File / risorsa | Posizione | Note |
|----------------|-----------|------|
| `.design-ref/` | repo root | Copia del bundle handoff. **Deve essere in `.gitignore`**. |
| `.gitignore` entry `.design-ref/` | `.gitignore` | Aggiungere riga `.design-ref/`. Verifico stato corrente: `.gitignore` ha `.claude/`, `.gstack/`, `node_modules/`, `playwright-report/`, `test-results/`, `.env.test`, `playwright/.cache/` — manca `.design-ref/`. [VERIFIED: cat .gitignore] |
| Google Fonts `<link>` | `index.html` `<head>` | 3 link (preconnect + preconnect crossorigin + stylesheet). |

### Da preservare

- `package.json`, `package-lock.json` (Playwright config).
- `playwright.config.ts`, `tests/*.spec.ts`, `tests/fixtures.ts`.
- `node_modules/`, `playwright-report/`, `test-results/` (gia' gitignored).
- `README.md`, `TUTORIAL.md`, `docs/`.

## 8. Playwright regression risk

Letto: `tests/login.spec.ts`, `tests/calendario.spec.ts`, `tests/cestino.spec.ts`, `tests/offline.spec.ts`, `tests/sw.spec.ts`, `tests/fixtures.ts`.

`cestino.spec.ts` (CRITICAL-04) e `offline.spec.ts` (CRITICAL-05) sono **`test.skip`** in Phase 1 — non gating per PR0. `sw.spec.ts` (REGRESSION-03) verifica solo `swCount === 0` — invariante non visivo, immune al redesign.

I rischi reali sono in `login.spec.ts` (2 test LIVE) e `calendario.spec.ts` (5 test LIVE).

### Selettori at-risk e strategia di mitigazione

| Selettore | File:linea | Tipo | Strategia |
|-----------|-----------|------|-----------|
| `input[type="email"]` / `input[type="password"]` / `button[type="submit"]` | login.spec.ts:11-14, fixtures.ts:111-114 | Attributo HTML | **SICURO** se manteniamo questi attributi nel form login restilato. Da preservare. |
| `page.getByRole('heading', { name: /Dashboard/ })` | login.spec.ts:17, fixtures.ts:117 | ARIA role + text | **SICURO** se h1/h2 "Dashboard" resta un heading reale (anche se cambia tag h2→h1 il role resta `heading`). |
| `.status-dot` | login.spec.ts:21, calendario.spec.ts:77, 110 | Class | **A RISCHIO**: se restyliamo lo status dot col nuovo design, la classe `.status-dot` deve restare (basta aggiungerne altre). **Strategia: PRESERVARE la classe `.status-dot`** sull'elemento (anche se aggiungiamo `.sync-indicator-dot` o simili). |
| `.status-dot.bg-green-500` / `.status-dot[class*="green-500"]` | calendario.spec.ts:77, 110 | Class compound | **A RISCHIO ALTO**: se sostituiamo Tailwind `bg-green-500` con var(--green), il selettore non matcha. **Strategia**: mantenere la binding Tailwind `:class="{ 'bg-green-500': statoSalvataggio==='salvato', ... }"` accanto al nuovo stile, OPPURE aggiungere `data-testid="status-dot"` e `data-status="salvato\|salvataggio\|offline\|errore"` e aggiornare i selettori del test in un commit dedicato. **Raccomandazione: l'opzione data-testid e' piu' robusta a lungo termine.** |
| `.bg-yellow-50, [class*="yellow-900"]` filter `Appartamento Importo Zero` | calendario.spec.ts:11 | Class compound | **A RISCHIO ALTO**: se sostituiamo `bg-yellow-50` con `.glass-card-warning`, il selettore non matcha. **Strategia**: aggiungere `data-testid="calendar-card-warning"` o conservare `bg-yellow-50` come classe marker. **Raccomandazione: usare `data-testid`** e aggiornare il test contestualmente. |
| `button:has-text("Sistema")` | calendario.spec.ts:15 | Text | **SICURO**: il testo "Sistema" deve restare letterale. |
| `button:has-text("Genera incassi mancanti")` | calendario.spec.ts:30 | Text | **SICURO**: testo letterale. |
| `h3` filter `/[Ii]ncassi orfani/` | calendario.spec.ts:43 | Tag + text regex | **A RISCHIO MEDIO**: se cambiamo h3→`<div class="eyebrow">`, l'h3 non matcha. **Strategia**: mantenere `<h3>` per il titolo del gruppo orfani, anche se restilato come uppercase eyebrow. |
| `.bg-gray-50, .bg-red-50` filter `Appartamento Test Via Roma` | calendario.spec.ts:55 | Class compound | **A RISCHIO ALTO**: stessa storia delle card calendario. **Strategia**: `data-testid="calendar-card"` + `data-status="attesa\|ritardo\|incassato\|sistema"` e migrazione selettori. |
| `button` filter `/Incassa oggi\|^Oggi$/` | calendario.spec.ts:65 | Text regex | **SICURO**: i due testi "Incassa oggi" / "Oggi" restano (sono i label visibili). |
| `.bg-green-50` filter `Appartamento Test Via Roma` | calendario.spec.ts:69 | Class compound | **A RISCHIO ALTO**: stesso problema. `data-testid` + `data-status` consigliato. |
| `div.mb-8` filter `h3:"Proprieta"` | login.spec.ts:31, calendario.spec.ts:86 | Tag + class + child | **A RISCHIO**: `mb-8` e' una classe Tailwind di spacing molto generica. **Strategia**: aggiungere `data-testid="prop-section"` al div sezione Proprieta in Impostazioni. |
| `[x-show="mostraFormProprieta"]` | login.spec.ts:43, calendario.spec.ts:94 | Alpine attribute | **SICURO** se preserviamo `x-show="mostraFormProprieta"` sul form panel. Da preservare. |
| `input[x-model="editProprieta.nome"]` | calendario.spec.ts:97 | Alpine attribute | **SICURO** se preserviamo `x-model="editProprieta.nome"`. |
| `input[type="number"]` (dentro propForm) | login.spec.ts:51, calendario.spec.ts:100 | Attribute scoped | **SICURO**. |
| `button:has-text("Salva")` / `button:has-text("Modifica")` / `button:has-text("+ Nuova")` | sparso | Text | **SICURO**: testi letterali da preservare. |
| `td` filter `'Proprieta E2E Test'` (in propSection) | calendario.spec.ts:107 | Tag scoped | **SICURO** se la tabella resta `<table><tbody><tr><td>`. Se il restyle trasforma la tabella in cards (non e' richiesto), il test rompe. **Raccomandazione: mantenere la tabella in Impostazioni come `<table>`.** |

### Riepilogo strategia

1. **Preservare integralmente**:
   - Tutti gli attributi HTML standard (`type="email"`, `type="password"`, `type="submit"`, `type="number"`).
   - Tutti gli attributi Alpine (`x-data`, `x-show`, `x-model`, `x-if`, `@click`).
   - Tutti i **TEXT** dei bottoni e dei heading che i test matchano per testo (`Dashboard`, `Impostazioni`, `Calendario`, `Proprieta`, `Incassi orfani`, `Sistema`, `Incassa oggi`, `Oggi`, `Genera incassi mancanti`, `Salva`, `Modifica`, `+ Nuova`).
   - La classe `.status-dot` sull'indicatore di salvataggio (anche se aggiungiamo altre classi).
   - Il tag `<h3>` per il header del gruppo "Incassi orfani" e per "Proprieta" in Impostazioni.
   - La struttura `<table><tbody><tr><td>` in Impostazioni → Proprieta.

2. **Aggiungere durante il restyle**:
   - `data-testid="status-dot"` + `data-status="<stato>"` sull'indicatore (e aggiornare 3 selettori in calendario.spec.ts + login.spec.ts).
   - `data-testid="calendar-card"` + `data-status="attesa\|ritardo\|incassato\|sistema"` su ogni card del calendario (e aggiornare REGRESSION-01 + CRITICAL-02).
   - `data-testid="prop-section"` sulla sezione Proprieta in Impostazioni (e aggiornare CRITICAL-03 + REGRESSION-04).
   - `data-testid="prop-form"` sul form panel (alternative a `[x-show="mostraFormProprieta"]`).
   - `data-testid="orfani-group"` sull'header del gruppo orfani.

3. **Aggiornare i test in un commit dedicato** dentro la PR0 stessa, **non** in un PR separato (per atomicita': la PR0 ship completa o niente). Aggiungere un task "Update Playwright selectors" come penultima task della phase, prima del verify-work finale.

4. **Anti-pattern**: NON cambiare i testi visibili dei bottoni (es. "Incassa oggi" → "Incassa") — rompe i test e perde context UX.

## 9. Implementation sequencing — recommended task order

Approccio "Standard" (layered), ottimizzato per CI verde a ogni commit. Stima totale 1.5-2h (per CEO plan).

### Layer A — Setup (commit 1, ~15 min)

1. **A1**: Aggiungere `.design-ref/` a `.gitignore`.
2. **A2**: Creare `.design-ref/` localmente con copia del bundle handoff (gitignored, non committato).
3. **A3**: Aggiungere `<link>` Google Fonts (3 link: 2 preconnect + 1 stylesheet) in `<head>` di `index.html`.
4. **A4**: Inserire blocco `:root` con tutti i token estratti (Section 1).
5. **A5**: Rimuovere `darkMode: 'media'` da Tailwind config inline.
6. **A6**: Aggiungere override breakpoint Tailwind `screens: { lg: '900px' }` (oppure usare media query custom — discrezione).

**Verifica:** `git status` mostra solo modifiche a `index.html` + `.gitignore`. Playwright deve restare verde (nessun selettore cambiato).

### Layer B — Foundation CSS (commit 2, ~20 min)

1. **B1**: Sostituire le regole `.usa-flag-bg*` con il blocco mesh `body::before` + `body::after` (Section 2).
2. **B2**: Rimuovere `<div class="usa-flag-bg"><video src="276973.mp4">` dall'HTML.
3. **B3**: `git rm 276973.mp4`.
4. **B4**: Aggiungere `#root { position: relative; z-index: 1 }` (sostituisce la vecchia regola `body > *:not(.usa-flag-bg)`).
5. **B5**: Aggiungere typography base (font-family, font-smoothing, font-feature-settings, h1-h5 styles).
6. **B6**: Aggiungere classi glass semantiche (`.glass-card`, `.glass-shell`, `.glass-sidebar`, `.glass-topbar`, `.glass-modal`, `.glass-modal-bg`) con `@supports` fallback.
7. **B7**: Aggiungere classi utility (`.tnum`, `.section-eyebrow`, `.kpi-card`, `.segment`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`).

**Verifica:** visualmente il background mesh deve essere visibile in login. Playwright deve restare verde (nessun selettore cambiato — solo classi visive sostituite/aggiunte, ma testi/attributi intatti).

### Layer C — Window shell + sidebar desktop (commit 3, ~15 min)

1. **C1**: Wrappare l'app in `<div class="window-shell glass-shell">` con 3 traffic lights decorativi top-left.
2. **C2**: Restilare `<header>` esistente come `.topbar.glass-topbar` con search pill ⌘K (visuale only) + bottone Esporta.
3. **C3**: Trasformare la `<nav>` desktop nella nuova `<aside class="sidebar glass-sidebar">` con sezioni eyebrow PANORAMICA / GESTIONE / ACCOUNT.
4. **C4**: User card in fondo sidebar con avatar gradient + status dot. **PRESERVARE la classe `.status-dot` e l'attributo `:class` con `bg-green-500` etc.**

**Verifica:** desktop ≥900px mostra sidebar persistent. Playwright deve restare verde.

### Layer D — Responsive drawer (commit 4, ~15 min)

1. **D1**: Aggiungere `drawerOpen: false` in `app()`. Migrare `mobileMenuOpen` → `drawerOpen` (rename consistency).
2. **D2**: Aggiungere CSS `@media (max-width: 899px)` con transform + transition.
3. **D3**: Aggiungere `<div class="drawer-backdrop">` con `@click` + `x-show`.
4. **D4**: Aggiungere `@keydown.escape.window` + body scroll lock via `x-init $watch`.
5. **D5**: Hamburger in topbar visibile solo `<900px`.

**Verifica:** in DevTools viewport iPhone (390px) la sidebar si chiude e l'hamburger appare; tap apre drawer; ESC chiude; tap-outside chiude; nav-tap chiude. Playwright deve restare verde.

### Layer E — Per-view restyle (commits 5-10, ~45-60 min)

Ordine consigliato (dashboard come showcase, poi viste piu' usate, infine impostazioni che ha gia' i test piu' delicati):

1. **E1 Dashboard**: hero + 4 KPI cards + segment + grid Property Cards + 2 colonne bottom. **NB**: la vista Dashboard attuale e' minima (riga 210-296); molti elementi handoff sono nuovi. **Raccomandazione**: aggiungere solo gli elementi che hanno dato gia' in state — 4 KPI cards puoi calcolarle da `proprieta`, `incassi`, `utenze` esistenti senza nuovo state.
2. **E2 Calendario**: restyle gruppi con card border-left status, restyle h3 gruppo orfani come eyebrow uppercase amber, bottoni in `.btn-primary/.btn-warning`. **Aggiungere `data-testid` come da Section 8 e aggiornare i 3 test calendario contestualmente.**
3. **E3 Proprieta**: lista → grid card con banner pastello; dettaglio → 2-col hero + storico in `.glass-table`.
4. **E4 Banche**: bank tabs + table movimenti glass.
5. **E5 Utenze**: 3 stat card + filtri styled + table glass.
6. **E6 Impostazioni**: restyle sezioni preservando struttura DOM dei test. **Aggiungere `data-testid="prop-section"`, `data-testid="prop-form"` e aggiornare login.spec.ts + calendario.spec.ts contestualmente.**

**Verifica dopo ogni commit:** `npx playwright test` locale deve passare. Push e attendere CI verde prima del commit successivo.

### Layer F — Login + asset cleanup (commit 11, ~15 min)

1. **F1**: Restilare il login screen come `.glass-modal` centrale max-width 440px su mesh.
2. **F2**: Logo gradient `#0071e3 → #5e9eff`.
3. **F3**: Input/Button styling handoff.
4. **F4**: **PRESERVARE** `input[type="email"]`, `input[type="password"]`, `button[type="submit"]`.
5. **F5**: Verifica finale: `git ls-files | grep mp4` deve essere vuoto.

### Layer G — Regression + smoke (commit 12, ~15 min)

1. **G1**: `npx playwright test` locale tutta verde.
2. **G2**: Smoke test manuale su DevTools iPhone 390×844: login → drawer → 6 viste → logout.
3. **G3**: Lighthouse mobile sul deploy preview (informazionale, non blocking).
4. **G4**: Apertura PR0 contro master con descrizione che linka CONTEXT.md.

## 10. Risks & unknowns

### R1 — Performance backdrop-filter su mobile (HIGH risk)

**Cosa:** 6 radial-gradient con `blur(45px) saturate(125%)` + 5+ superfici `backdrop-filter: blur(20-60px) saturate(180-200%)` impilate. Su iPhone 8/SE o Android low-end (Snapdragon 6xx) puo' scendere a 30fps.

**Mitigazioni:**
- Cap fisso a 6 orbs (handoff e' gia' a 6, non aumentare).
- Non animare le orbs.
- Considerare `transform: translateZ(0)` su `body::before` per forzare layer compositing (verificare se aiuta — puo' anche peggiorare).
- Test su DevTools 4× CPU throttle + GPU normale e su un device reale prima del merge.
- Fallback `@supports not (backdrop-filter: blur(60px))` gia' previsto in Section 3.
- **Lighthouse mobile**: la roadmap non lo definisce blocking, ma il CEO plan dice "no regression vs baseline pre-PR0". **Open question**: definire baseline pre-PR0 misurata su master corrente (cattura prima di iniziare).

### R2 — FOUT durante caricamento Google Fonts (LOW risk)

**Cosa:** prima del download dei 3 webfont, il system fallback (Apple SF Pro / Segoe UI / Roboto) e' visibile. `font-display: swap` previene FOIT ma non FOUT.

**Mitigazioni:**
- Fallback stack scelto bene (gia' `'-apple-system, BlinkMacSystemFont, ...'` nel handoff): su iOS/macOS si avvicina molto a Inter.
- Preconnect a `fonts.googleapis.com` e `fonts.gstatic.com` (gia' incluso nei `<link>`).
- Considerare preload del weight 600 di Inter Tight (display): `<link rel="preload" href="..." as="font" type="font/woff2" crossorigin>`. **Open question per planner**: usare preload o no? Aggiunge 1 round trip ma evita lo swap visibile sui titoli grandi. Discrezione.

### R3 — Selector breakage in Playwright (HIGH risk se non mitigato)

Coperto in Section 8. Strategia: `data-testid` + aggiornamento test contestuale.

### R4 — iOS Safari quirks (MEDIUM risk)

**Cosa:**
- `backdrop-filter` richiede `-webkit-backdrop-filter` prefisso (gia' previsto).
- `100vh` su iOS Safari include la barra URL → l'app fullscreen puo' avere uno scroll inatteso. `html, body { height: 100% }` (come nel handoff) e `overflow: hidden` mitigano.
- `position: fixed` con backdrop-filter dentro puo' avere bug di rendering su iOS < 15.
- Drag-to-refresh su iOS puo' interferire col drawer swipe (rinviato a phase future).

**Mitigazioni:**
- Testare su Safari iOS reale (iPhone) prima del merge — non solo DevTools.
- Usare `100dvh` (dynamic viewport height) dove disponibile + fallback `100vh`. [VERIFIED: caniuse.com/viewport-unit-variants]. Considerare per page-body container.
- Verificare che `overflow: hidden` su body non blocchi lo scroll dentro `.page-body`.

### R5 — Tailwind breakpoint mismatch (MEDIUM risk)

Tailwind default `lg = 1024px` non matcha il vincolo `900px` del progetto. Se usiamo `lg:hidden` per nascondere l'hamburger, l'hamburger sparira' a 1024px non a 900px. **Mitigazione**: o overridare `screens: { lg: '900px' }` nel config inline Tailwind, o usare media query CSS custom invece di utility Tailwind. **Raccomandazione**: media query CSS custom su `.hamburger { display: none } @media (max-width: 899px) { .hamburger { display: inline-flex } }` — piu' esplicito.

### R6 — Tailwind `dark:` classes inerti (LOW risk)

L'attuale `index.html` ha centinaia di `dark:bg-gray-800` etc. Senza `darkMode: 'media'`, queste sono no-op. Non rompono nulla ma gonfiano il markup. **Raccomandazione**: lasciarle, stripping in una phase futura (Pulizia Tailwind) o mai. Non blocking.

### R7 — Single-file `index.html` size (LOW risk)

L'aggiunta del blocco `<style>` con tutti i token + mesh + glass + drawer puo' aggiungere ~6-10KB al file. Attualmente `index.html` e' 1520 righe (~60KB). Resta dentro budget. Nessun problema.

### R8 — `.design-ref/` accidentalmente committato (LOW risk)

Se l'esecutore copia il bundle in `.design-ref/` PRIMA di aggiornare `.gitignore`, git lo tracciera'. **Mitigazione**: ordine task A1 (gitignore) → A2 (copia). Verifica con `git status` dopo A2 che `.design-ref/` non appaia tra gli untracked tracked.

### R9 — Linkability del logo (LOW risk)

L'utente attuale ha "Affitti v2.0" / "Gestione Affitti" come `<h1>`. Il handoff lo posiziona nella sidebar come logo block con sub "v 2.0". Cambio cosmetico. **Open question**: il numero versione deve aggiornarsi a "v 2.0" o restare "v 1.0" (footer riga 781)? Discrezione planner.

## 11. Open questions for the planner

> Tutto LOCKED in CONTEXT.md e' fuori discussione. Le seguenti sono aree Claude's discretion o gap del handoff che il planner deve risolvere con un default proposto qui.

1. **Z-index scale**: il handoff non ha tokens espliciti. **Proposta default**:
   ```css
   --z-base: 0; --z-content: 1; --z-sidebar: 30; --z-topbar: 31;
   --z-drawer-backdrop: 40; --z-drawer: 41;
   --z-modal-backdrop: 50; --z-modal: 51; --z-toast: 60;
   ```

2. **Transition durations**: il handoff usa valori inline. **Proposta default**:
   ```css
   --ease-out-apple: cubic-bezier(0.2, 0.8, 0.2, 1);
   --dur-fast: 120ms; --dur-md: 220ms; --dur-slow: 400ms;
   ```

3. **Drawer width**: `280px` (allineato a iOS native drawer). Alternative: 232px (= sidebar desktop). **Proposta**: 280px per pollice-friendly.

4. **Estensione `app()` vs nuovo `x-data`** per `drawerOpen`: gia' raccomandato in Section 6 — **estendere `app()`**, rinominando `mobileMenuOpen → drawerOpen`.

5. **CSS inline vs `style.css` esterno**: **raccomandazione: inline** per coerenza con vincolo single-file CON-001. L'estrazione e' Claude's discretion ma aggiunge complessita' deployment senza beneficio chiaro.

6. **Mini-calendar in Calendario**: handoff lo include ma e' lavoro aggiuntivo significativo. **Raccomandazione: SKIP in PR0**, mantenere solo i gruppi attuali (Inizio/Meta/Fine mese piu' orfani) restilati. Mini-calendar diventa una nice-to-have per phase future.

7. **KPI cards in Dashboard**: handoff ne ha 4 con icone e progress bar. State data: i numeri sono calcolabili da `proprieta + incassiAffitti + currentMonth`. **Raccomandazione: INCLUDERE** — sono visivamente impattanti e usano solo state esistente.

8. **Property Card grid con 9 banner pastello unici**: handoff dice "9 colori diversi nel ciclo". **Proposta**: array `--banner-1..--banner-9` di gradient pastello in `:root`, pick `proprieta.id.length % 9` o `index % 9`.

9. **Lighthouse baseline**: il CEO plan dice "no regression vs pre-PR0 baseline". **Open question**: chi cattura la baseline e quando? **Proposta**: aggiungere micro-task pre-Layer-A "cattura Lighthouse baseline su master attuale, salva PNG/JSON in `.planning/phases/02-pr0-apple-sonoma-redesign/lighthouse-baseline.json`".

10. **Update `<title>`** da "Gestione Affitti &amp; Utenze" a "Gestione Affitti"? Handoff usa il piu' corto. **Proposta**: mantenere il titolo attuale per stabilita SEO/bookmark.

11. **Footer "v1.0" → "v2.0"**: il handoff lo cita come "v 2.0" nella sidebar logo. **Proposta**: aggiornare a v2.0 ovunque (sidebar + footer).

12. **Stripping classi `dark:` Tailwind**: ~150+ occorrenze. **Raccomandazione: NON stripping in PR0** (no-op innocuo, riduce churn diff). Phase futura dedicata.

13. **Modal vs inline form per "Nuova utenza" / "Nuova proprieta"**: handoff usa modal. Attuale usa form inline. **Proposta**: in PR0 mantenere inline (meno cambio di selettore Playwright, less work). Modalizzazione in phase futura.

14. **Preload font weights critici (Inter Tight 600)**: vedere R2. **Proposta default**: skip preload in PR0 (overkill per family-tier), fare in caso di reclami visivi.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | Playwright | ✓ | (gia' funziona da Phase 1) | — |
| `@playwright/test` | Phase 1 suite | ✓ | (gia' installato) | — |
| Chromium browser | Playwright tests | ✓ | — | — |
| Internet | Google Fonts + Tailwind CDN + Alpine CDN + Supabase CDN | ✓ richiesto runtime | — | Fonts: fallback system; CDN locked Phase 4 SW |
| GitHub Actions runner | CI gate | ✓ (Phase 1 attivo) | — | — |
| Git | versioning | ✓ | — | — |

**Missing dependencies with no fallback:** nessuna.

**Missing dependencies with fallback:** nessuna critica per PR0.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (gia' presente da Phase 1) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test tests/login.spec.ts tests/calendario.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REQ-UI-01 | Login redesign non rompe `doLogin` | smoke (Playwright) | `npx playwright test tests/login.spec.ts` | ✅ |
| REQ-UI-01 | Card calendario importo=0 rimane riconoscibile (REGRESSION-01) | regression | `npx playwright test tests/calendario.spec.ts -g REGRESSION-01` | ✅ |
| REQ-UI-01 | Alert "Genera incassi mancanti" funziona (REGRESSION-02) | regression | `npx playwright test -g REGRESSION-02` | ✅ |
| REQ-UI-01 | Service worker count = 0 (REGRESSION-03) | regression | `npx playwright test tests/sw.spec.ts` | ✅ |
| REQ-UI-01 | Importo=0 trigger soft-confirm (REGRESSION-04) | regression | `npx playwright test -g REGRESSION-04` | ✅ |
| REQ-UI-01 | Incassi orfani in gruppo dedicato (REGRESSION-05) | regression | `npx playwright test -g REGRESSION-05` | ✅ |
| REQ-UI-01 | CRITICAL-01..03 (login, segna incasso, crea proprieta) | critical | `npx playwright test -g CRITICAL` | ✅ |
| REQ-UI-01 | Drawer si apre/chiude <900px | manual-only | (smoke iPhone 390×844 in DevTools) | ❌ — manual, non automatizzabile in PR0 (richiederebbe Playwright viewport iPhone + drawer test specifico) |
| REQ-UI-01 | Mesh visibile su tutte le viste | manual-only | (smoke visivo) | ❌ — manual |
| REQ-UI-01 | Font Inter Tight applicato a heading | manual-only o computed-style check | opzionale `page.evaluate(() => getComputedStyle(h1).fontFamily)` | ❌ — non in PR0 |

### Sampling Rate

- **Per task commit:** `npx playwright test tests/login.spec.ts tests/calendario.spec.ts tests/sw.spec.ts` (gli unici LIVE; cestino + offline sono skip).
- **Per wave merge:** `npx playwright test` (tutta la suite).
- **Phase gate:** Full suite green su CI prima del merge PR0 → master.

### Wave 0 Gaps

- [ ] **(Opzionale, raccomandato per robustezza future)** `tests/responsive.spec.ts` — test drawer toggle su viewport iPhone. Lasciato OUT of PR0 per non gonfiare lo scope; documentato come follow-up in Section 11.
- [ ] **Selector update** dentro `tests/login.spec.ts` + `tests/calendario.spec.ts` per i `data-testid` aggiunti durante il restyle (Section 8). **Non e' un "gap" ma un task esplicito** nel Layer E del sequencing.

Nessun gap framework (Playwright gia' shippato Phase 1).

## Sources

### Primary (HIGH confidence)

- `wiki/projects/gestione-affitti-design-handoff/project/design_handoff_apple_redesign/Gestione Affitti.html` — design tokens, mesh, glass, fonts. [VERIFIED letto interamente]
- `wiki/projects/gestione-affitti-design-handoff/project/design_handoff_apple_redesign/README.md` — type scale, blur table, component patterns, porting notes. [VERIFIED letto interamente]
- `wiki/projects/gestione-affitti-design-handoff/chats/chat1.md` — decisioni iterative dell'utente ("piu astratta", glass Sonoma). [VERIFIED letto interamente]
- `.planning/phases/02-pr0-apple-sonoma-redesign/CONTEXT.md` — locked decisions per PR0. [VERIFIED letto interamente]
- `.planning/intel/decisions.md` — DEC-019, DEC-001. [VERIFIED letto interamente]
- `.planning/intel/constraints.md` — CON-001, CON-002, CON-005, CON-017. [VERIFIED letto interamente]
- `.planning/REQUIREMENTS.md` — REQ-UI-01. [VERIFIED letto interamente]
- `.planning/ROADMAP.md` — Phase 2 success criteria. [VERIFIED letto interamente]
- `index.html` repo root — struttura corrente, video, classi Tailwind, Alpine bindings. [VERIFIED letto righe 1-200 + grep esteso]
- `tests/*.spec.ts` + `tests/fixtures.ts` — selettori Playwright attuali. [VERIFIED tutti letti]
- `.gitignore` repo root. [VERIFIED letto]

### Secondary (MEDIUM confidence)

- Tailwind CSS v3 CDN behavior (config inline). [VERIFIED via index.html riga 22-32]
- Alpine.js 3.x reactive directives (`x-show`, `x-data`, `@click`, `x-init`, `$watch`). [CITED: alpinejs.dev]

### Tertiary (LOW confidence / ASSUMED)

- `caniuse.com/css-backdrop-filter` current support data. [ASSUMED: training data, generally stable but flag for verification se appare un bug Safari-specific].
- `caniuse.com/viewport-unit-variants` per `100dvh` support. [ASSUMED].
- Performance impact di multipli `backdrop-filter` impilati su mobile low-end. [ASSUMED — needs real-device test, R1].

## Metadata

**Confidence breakdown:**

- Design tokens estratti: **HIGH** — letti 1:1 dal file di handoff verificato.
- Mesh + glass recipes: **HIGH** — letterali dal handoff.
- Typography Google Fonts: **HIGH** — letterale handoff riga 10.
- Component mapping: **HIGH** — incrociato handoff + grep su index.html.
- Drawer responsive: **MEDIUM** — pattern derivato, non letterale dal handoff (che esplicitamente non copre responsive); decisioni di implementazione razionali ma non testate su questo repo.
- Asset cleanup: **HIGH** — verificato con ls + grep + cat .gitignore.
- Playwright risk: **HIGH** — letti tutti i .spec.ts e fixtures.ts, mappati selettori 1:1.
- Sequencing: **MEDIUM** — proposto razionalmente, l'ordine ottimale puo' variare a discrezione del planner.

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 giorni; il handoff e' stable, ma se Tailwind CDN cambia major o Alpine si aggiorna invalidare prima)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `caniuse` data per backdrop-filter e' current | Section 3 (glass) | Basso — il fallback `@supports` copre il caso |
| A2 | Performance backdrop-filter "tank" su Android low-end | Section 10 R1 | Medio — se in realta' va bene, mitigazioni superflue ma non dannose |
| A3 | iOS Safari 100vh include URL bar (richiede 100dvh) | Section 10 R4 | Basso — fallback gia' previsto |
| A4 | I 9 banner pastello sono diversi gradient (handoff dice "9 colori nel ciclo" ma non li elenca) | Section 11 Q8 | Basso — Claude's discretion, planner sceglie palette |
| A5 | Tailwind v3 CDN config inline supporta `screens` override | Section 6 + 10 R5 | Basso — il fallback (media query CSS custom) e' robusto |
| A6 | Estendere `app()` Alpine e' piu' pulito di un nuovo `x-data` | Section 6 | Basso — discrezione, entrambe le opzioni funzionano |
