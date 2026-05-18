# Phase 4: PR2a — PWA shell (manifest, SW) — Research

**Researched:** 2026-05-18
**Domain:** Progressive Web App shell (manifest + service worker + install prompt) + 2 reattività carry-over da PR1
**Confidence:** **HIGH**

> Confidence justification: scope chiuso e ben definito da CONTEXT.md; tutta la sorgente è leggibile localmente (1263 righe di `app.js`, 1391 di `index.html`); ho letto i due test `.skip` e ho lo stato esatto dei call-site di priming snapshot e di `attivi()`; il workflow CI è ispezionato. Unico punto MEDIUM: la natura esatta della rottura `UNDO-01` è una falsificazione su tre ipotesi rankate ma non ancora isolata — il fix proposto è il minimo prudente (inlining del filter + `$nextTick`).

---

## 1. Confidence statement

**HIGH** su: manifest recipe, sw.js skeleton SWR, registrazione SW, stale-SW unregister diff, banner UX, Lighthouse audits, CI compat, icon generation, risk map.

**MEDIUM-HIGH** su: `UNDO-01` root cause (3 ipotesi ranked; minimal fix copre tutte e tre); `SNAP-01` root cause (sintomo CI dice "0 setItem" ma la lettura del codice mostra priming sia sul happy path sia nel `finally` — il fix proposto è defensivo, "re-prime dopo che Alpine ha visto la mutazione").

**Gap noti:** non posso eseguire Lighthouse io stesso; non posso verificare a runtime se `beforeinstallprompt` viene effettivamente intercettato sotto Chromium headless di Playwright (la letteratura dice di no — la spec del test riflette questa realtà).

---

## 2. Codebase map (esatto)

`app.js` (1263 righe totali):

| Simbolo | Riga | Note |
|---|---|---|
| `_lastSnapshotData` (slot Alpine init a null) | **123** | Vive dentro `function app()` return object |
| `async init()` apertura | **137** | Sync per quanto riguarda Alpine; gli `await` interni non bloccano la chiamata `x-data="app()"` |
| `localStorage.removeItem('gestione_affitti_dati')` cleanup chiave obsoleta | **162** | Buon vicino dove infilare la registrazione SW |
| **Stale-SW unregister all-at-boot** (CON-017 #3) | **165–170** | Loop `getRegistrations()` + `unregister()` su TUTTI |
| Prima chiamata a `caricaDatiUtente()` (auth attiva) | **175** | `await`-ata: torna prima che `init()` finisca |
| Auth state-change `caricaDatiUtente` | **184** | Stesso `await` pattern |
| Listener `online` → `caricaDatiUtente` | **195** | Path #3 verso il priming |
| `attivi(arr)` definizione | **223–226** | `arr.filter(x => !x.deletedAt)` — ogni call ritorna **nuovo array reference** |
| `cestinoItems()` getter | **230–245** | **NON usa `attivi()`** — itera direttamente `this.dati.proprieta`/`incassiAffitti` e legge `.deletedAt` inline |
| `pushSnapshot(preState)` (early-return su `!preState`) | **320–333** | `localStorage.setItem('gestione_affitti_snapshots', …)` riga **328** |
| `snapshots()` getter | **334–340** | Legge da `localStorage` direttamente |
| **Restore snapshot** (`ripristinaSnapshot`) — re-prime di `_lastSnapshotData` | **437** | Già pattern corretto: re-prime dopo mutazione |
| Priming `_lastSnapshotData` dentro `caricaDatiUtente` (cache-locale-vince) | **633** | Happy path A |
| Priming `_lastSnapshotData` dentro `caricaDatiUtente` (DB normale) | **657** | Happy path B |
| `finally` fallback di priming | **683–691** | Solo se `!_primingDone && !this._lastSnapshotData` |
| `salva()` legge `this._lastSnapshotData` e chiama `pushSnapshot` | **707–714** | Riga 713: re-prime sincrono dopo push |
| Commento "non aggiornare `_lastSnapshotData` qui post-await" in `salvaSubito` | **766–769** | Vincolo di non-toccare il priming in async path |
| `gruppiCalendario()` getter | **958–979** | Tre call a `this.attivi(...)` dentro lo stesso getter (righe 960, 967, 972) |

`index.html` (1391 righe totali):

| Simbolo | Riga | Note |
|---|---|---|
| `<html lang="it">` | **2** | Manifest `lang: "it"` matcha |
| Tailwind CDN sync (pinned) | **17** | URL da pre-cachare nel SW (vedi sez. 4) |
| Supabase JS CDN sync (pinned `@2`) | **19** | URL da pre-cachare |
| Alpine.js CDN defer (`alpinejs@3.x.x`) | **21** | URL da pre-cachare |
| Tokens `:root` apertura | **43** | `--bg-base: #f5f5f7` = candidato `background_color` |
| `--accent: #0071e3` (Apple blue) | **64** | Candidato `theme_color` |
| `.glass-card` definizione (insieme a `.glass-surface`) | **195–202** | Riusabile per il banner install |
| `.btn-primary` definizione | **241–247** | Riusabile per CTA "Aggiungi" |
| `@supports not (backdrop-filter)` fallback per glass | **234–238** | Funziona automaticamente per il banner |

`tests/`:

| File | Stato | Riga `describe.skip` |
|---|---|---|
| `undo.spec.ts` | `.skip` (1 test) | 47 |
| `snapshot.spec.ts` | `.skip` (1 test) | 47 |
| `sw.spec.ts` | LIVE, asserisce `swCount === 0` | 13 |
| `login.spec.ts`, `cestino.spec.ts`, `calendario.spec.ts`, `offline.spec.ts`, `salute-dati.spec.ts` | LIVE | — |

`.github/workflows/playwright.yml`:

- Job name: `test` (riga 11) — questa è la check richiesta da branch protection.
- **`paths-ignore` NON PRESENTE**. Qualsiasi commit (anche `.planning/**` e `**.md`) triggera la CI. Vuol dire che il pattern CON-018 "planning commits skip CI" descritto in CONTEXT.md NON è implementato nel workflow. Aggiunta di `sw.js`, `manifest.json`, `icons/*` → la CI gira comunque. **Implicazione:** il planner deve assumere CI verde su ogni commit, non c'è skip da workflow. (CONTEXT.md riga 75 dice il contrario — vedi sez. 14 Open Questions.)

---

## 3. Manifest recipe (literal JSON)

File: `manifest.json` a root del repo.

```json
{
  "name": "Gestione Affitti",
  "short_name": "Affitti",
  "description": "Gestione affitti e utenze per piccoli proprietari",
  "lang": "it",
  "dir": "ltr",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#0071e3",
  "background_color": "#f5f5f7",
  "categories": ["finance", "productivity"],
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "icons/icon-1024.png",
      "sizes": "1024x1024",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

**Valori derivati dai token PR0:**
- `theme_color: #0071e3` ← `--accent` (riga 64, Apple blue del design system).
- `background_color: #f5f5f7` ← `--bg-base` (riga 45, neutral Sonoma background).
- `lang: it` ← matcha `<html lang="it">`.
- `start_url: "./"` + `scope: "./"` ← **OBBLIGATORI relativi** per GitHub Pages subpath `/gestione-affitti/`. Path assoluti `/` rompono lo scope (SW non controllerebbe la pagina).

**`<head>` additions in `index.html`** (subito dopo `<title>`, prima del Tailwind CDN):

```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#0071e3">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Affitti">
<link rel="apple-touch-icon" href="icons/apple-touch-icon-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="icons/icon-512.png">
```

**Note maskable icon:** Chrome/Android usano `purpose: "maskable"` per non clippare l'emoji 🏠 dentro la sagoma Android. Generata con safe-zone interna ≥ 80% (favicon.io ha un toggle).

---

## 4. Service worker recipe (`sw.js`, ~150 righe)

File: `sw.js` a root del repo (serve `/gestione-affitti/sw.js` su GH Pages → scope auto = `/gestione-affitti/`).

```js
// sw.js — PR2a (REQ-PWA-02). Versioned cache, Stale-While-Revalidate per
// app shell + CDN pinnati. NON cacha le chiamate Supabase API (devono
// sempre andare in rete: dati live + auth).
//
// Strategia:
//   - install: pre-cache esplicito dell'app shell + CDN pinnati; skipWaiting()
//   - activate: elimina ogni cache con nome != CACHE_NAME; clients.claim()
//   - fetch:   navigation → SWR con fallback offline su index.html
//              app shell + CDN pinnati → SWR
//              Supabase / fonts.googleapis / altro → network passthrough
//
// Bump CACHE_NAME a ogni deploy che cambia file in PRECACHE_URLS.
// Naming: 'gestione-affitti-v<N>' (N intero monotono crescente).

const CACHE_NAME = 'gestione-affitti-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './icons/apple-touch-icon-180.png',
  // CDN pinnati (esattamente come in index.html righe 17/19/21)
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
];

// URL pattern che NON devono mai essere cachati (devono sempre andare in rete).
// Supabase REST/auth + Google Fonts CSS dinamico (le woff2 sì sono cachabili
// ma il foglio CSS può cambiare; per semplicità in PR2a lasciamo passthrough).
const NETWORK_ONLY_HOSTS = [
  'supabase.co',
  'supabase.in',
  'fonts.googleapis.com', // foglio dinamico
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Stale-While-Revalidate: serve subito dalla cache (se c'è), in parallelo
// fetch dal network e aggiorna la cache per la prossima nav.
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Solo 200 OK + same-origin/CORS opaque "ok" possono essere cachati
          // safely. Skip non-200 (304, 5xx) per non avvelenare la cache.
          if (response && response.status === 200) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => cached); // offline: torna il cached anche se è null
      // Range requests (video) non sono safe per SWR: passthrough
      if (request.headers.get('range')) return fetch(request);
      return cached || networkFetch;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo GET viene cachato. POST/PATCH/DELETE → passthrough.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-only: Supabase API/auth, font dinamico
  if (NETWORK_ONLY_HOSTS.some((h) => url.hostname.endsWith(h))) {
    return; // non chiamare event.respondWith → default browser fetch
  }

  // Navigation request (HTML page load): SWR con fallback a index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidate(req).catch(() =>
        caches.match('./index.html').then((r) => r || fetch(req))
      )
    );
    return;
  }

  // App shell + CDN pinnati: SWR
  const isAppShell = url.origin === self.location.origin;
  const isPinnedCdn = PRECACHE_URLS.some((u) => u === req.url || req.url.startsWith(u));
  if (isAppShell || isPinnedCdn) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Default: passthrough (fonts.gstatic woff2 etc.)
  // Nessun event.respondWith → browser fa la fetch standard.
});
```

**Decisioni motivate:**
- **Cache name `gestione-affitti-v1`** + nota in alto a ogni deploy: bump manuale a `v2`, `v3`. Più semplice di SHA-derived per PR2a. (Planner può proporre commit-hook che bumpa automaticamente in PR2b.)
- **`skipWaiting()` + `clients.claim()`** entrambi attivati. UX implicazione: la tab aperta NON ricarica automaticamente; al prossimo `navigate` o `fetch` la nuova versione del SW serve i contenuti aggiornati. PR2a accetta questa UX. **NIENTE toast "ricarica per aggiornare"** in PR2a (deferred PR3).
- **Range requests bypass**: anche se il file MP4 è stato rimosso in PR0, il guard è economico e blocca classi note di bug SWR.
- **Identify CDN cleanly**: ho scelto **lookup esplicito su `PRECACHE_URLS`** (riga `isPinnedCdn`) piuttosto che matchare per hostname `cdn.jsdelivr.net` o `cdn.tailwindcss.com` — così se in futuro arrivasse una libreria diversa dallo stesso CDN, NON la cachiamo accidentalmente. Esplicito > implicito.
- **Supabase API esclusa via hostname suffix** `supabase.co` / `supabase.in` (free tier può ridirigere).
- **`Cache-Control` header**: nessun override; il browser rispetta gli header esistenti su precache. Su GH Pages i file sono serviti con `Cache-Control: max-age=600` di default; SWR via SW dribbla questo. Confidence: HIGH.

---

## 5. SW registration + stale-SW unregister diff (`app.js`)

Stato attuale (righe 165–170):

```js
if ('serviceWorker' in navigator) {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  } catch (e) {}
}
```

Questo loop **unregistra TUTTO**, incluso il SW corrente. Per PR2a serve evolverlo in "unregistra solo quelli con scriptURL diversa da quella corrente, poi registra il SW corrente":

```js
if ('serviceWorker' in navigator) {
  try {
    // URL del SW corrente. Suffisso ?v=N opzionale per forzare re-fetch
    // del file sw.js stesso quando bumpiamo cache version.
    const SW_URL = 'sw.js';
    const SW_ABS = new URL(SW_URL, location.href).href;

    // Stale-SW unregister (CON-017 #3): rimuove tutte le registrazioni
    // di SW con scriptURL diverso (es. iterazioni di sviluppo, file rinominati,
    // scope diversi). Lascia in vita solo il SW corrente se già presente.
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const active = r.active || r.installing || r.waiting;
      const url = active && active.scriptURL ? active.scriptURL : '';
      if (url !== SW_ABS) {
        await r.unregister();
      }
    }

    // Registra il SW corrente con scope esplicito relativo (GH Pages subpath).
    navigator.serviceWorker.register(SW_URL, { scope: './' }).catch((e) => {
      console.warn('SW register failed:', e);
    });
  } catch (e) {
    console.warn('SW boot error:', e);
  }
}
```

**Note:**
- La `register()` è fire-and-forget (no `await`) per non rallentare il boot. Se fallisce, l'app continua a funzionare senza PWA — degradation graceful.
- `scope: './'` è **mandatorio** su GH Pages subpath. Default è la directory dello script `sw.js`, che su GH Pages è `/gestione-affitti/` → stesso risultato; passo esplicito per chiarezza.
- **`sw.spec.ts` (REGRESSION-03) DEVE essere evoluta**: il TODO in commento alle righe 5–9 di `sw.spec.ts` è la specifica esatta. Vedi sez. 10.

---

## 6. Install prompt design

### State shape (dentro `function app()` return object)

```js
// PWA install prompt state
installPromptVisible: false,
_deferredInstallPrompt: null,  // evento beforeinstallprompt (Chrome/Android)
_isIosSafari: false,

// localStorage keys
//   gestione_affitti_session_log     = JSON.stringify(string[])  ISO timestamps (rolling 7d)
//   gestione_affitti_install_dismissed_until = ISO date string (banner non riappare prima)
//   gestione_affitti_installed       = "1" se appinstalled fired
```

### Flusso (dentro `init()`, dopo la SW register)

```js
// 1. Detect iOS (Safari NON espone beforeinstallprompt)
const ua = navigator.userAgent;
const isIos = /iPhone|iPad|iPod/.test(ua);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                  || navigator.standalone === true;
this._isIosSafari = isIos && !isStandalone;

// 2. Cattura beforeinstallprompt (Chrome desktop + Android Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  this._deferredInstallPrompt = e;
  this.maybeShowInstallBanner();
});

// 3. appinstalled: chiudi banner e ricorda
window.addEventListener('appinstalled', () => {
  this.installPromptVisible = false;
  this._deferredInstallPrompt = null;
  try { localStorage.setItem('gestione_affitti_installed', '1'); } catch (_) {}
});

// 4. Conta questa sessione e valuta banner
this.recordSession();
this.maybeShowInstallBanner();
```

### Helpers

```js
recordSession() {
  try {
    const raw = localStorage.getItem('gestione_affitti_session_log');
    const arr = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Conta come "nuova sessione" se l'ultima entry è > 30 min fa
    // (riapertura tab vs reload rapido non duplicano).
    const last = arr.length ? new Date(arr[arr.length - 1]).getTime() : 0;
    const sessionGapMs = 30 * 60 * 1000;
    if (now.getTime() - last > sessionGapMs) arr.push(now.toISOString());
    // Prune > 7d
    const pruned = arr.filter((iso) => iso >= cutoff);
    localStorage.setItem('gestione_affitti_session_log', JSON.stringify(pruned));
  } catch (_) {}
},

maybeShowInstallBanner() {
  try {
    if (localStorage.getItem('gestione_affitti_installed') === '1') return;
    const dismissedUntil = localStorage.getItem('gestione_affitti_install_dismissed_until');
    if (dismissedUntil && new Date().toISOString() < dismissedUntil) return;
    const raw = localStorage.getItem('gestione_affitti_session_log');
    const arr = raw ? JSON.parse(raw) : [];
    if (arr.length < 3) return;
    // Chrome/Android: serve avere l'evento catturato
    if (!this._isIosSafari && !this._deferredInstallPrompt) return;
    this.installPromptVisible = true;
  } catch (_) {}
},

async installApp() {
  if (this._isIosSafari) return; // banner mostra istruzioni iOS, niente prompt nativo
  if (!this._deferredInstallPrompt) return;
  try {
    this._deferredInstallPrompt.prompt();
    await this._deferredInstallPrompt.userChoice;
  } catch (_) {}
  this._deferredInstallPrompt = null;
  this.installPromptVisible = false;
},

dismissInstallPrompt() {
  try {
    const N_DAYS = 14;  // recommendation
    const until = new Date(Date.now() + N_DAYS * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('gestione_affitti_install_dismissed_until', until);
  } catch (_) {}
  this.installPromptVisible = false;
},
```

### Banner HTML (in `index.html`, dentro `<div x-data="app()">` a root, sopra il primo modal)

```html
<!-- Install prompt banner (PR2a REQ-PWA-03) -->
<div
  x-show="installPromptVisible"
  x-cloak
  data-testid="install-banner"
  class="glass-card"
  style="position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: var(--z-toast);
         padding: 16px; display: flex; gap: 12px; align-items: center; max-width: 520px; margin: 0 auto;"
>
  <div style="flex: 1;">
    <div style="font-weight: 600; margin-bottom: 4px;">Aggiungi alla schermata Home</div>
    <div x-show="!_isIosSafari" style="font-size: 13px; color: var(--text-secondary);">
      Installa l'app per accedere piu rapidamente, anche offline.
    </div>
    <div x-show="_isIosSafari" style="font-size: 13px; color: var(--text-secondary);">
      Tocca <strong>Condividi</strong> &rarr; <strong>Aggiungi a Home</strong>.
    </div>
  </div>
  <button
    x-show="!_isIosSafari"
    class="btn-primary"
    data-testid="install-confirm"
    @click="installApp()"
  >Aggiungi</button>
  <button
    class="btn-secondary"
    data-testid="install-dismiss"
    @click="dismissInstallPrompt()"
  >Piu tardi</button>
</div>
```

**Riuso design system PR0:** zero nuove regole CSS globali. Solo `.glass-card` + `.btn-primary` + `.btn-secondary` (già definiti — `.btn-secondary` riga 248) + inline `style` per posizionamento fisso. Confidence: HIGH.

**N value:** 14 giorni (raccomandato). Aderente a pattern Chrome che de-priorita banner re-shown frequenti.

---

## 7. UNDO-01 — falsificazione + minimal fix diff

### Sintomo
`cestinoItems()` (riga 230, NON usa `attivi()`) re-renderizza dopo `eliminaIncasso`. `gruppiCalendario()` (riga 958, USA `attivi()` 3 volte) NON re-renderizza.

### Ipotesi rankate

**H1 (likely) — Reactivity tracking attraverso il helper:** Alpine 3 (Vue3-style Proxy) traccia getter access. Quando `gruppiCalendario` chiama `this.attivi(this.dati.incassiAffitti)`, Alpine traccia l'accesso a `this.attivi` (un function reference che non cambia) e a `this.dati.incassiAffitti` (l'array). Quando `inc.deletedAt` viene mutato, **Alpine traccia la mutazione su `inc.deletedAt`** ma `gruppiCalendario` ha letto solo `this.dati.incassiAffitti` (l'array reference, non gli item) prima di passarlo a `attivi()` come parametro. Dentro `attivi()`, il `.filter()` itera gli item e legge `x.deletedAt` — ma quegli accessi avvengono **dentro la closure di `attivi()`**, e Alpine attribuisce la dipendenza al `getter` che sta correndo. Questo dovrebbe funzionare in teoria, MA può rompersi se Alpine ha bug di tracking attraverso funzioni method-chained (`.filter()` callback).

Falsificazione rapida: aprire DevTools, mettere breakpoint dentro `attivi()` durante un delete; verificare se il proxy access path passa per Alpine. Risultato atteso se H1 è vera: il proxy si vede 1 volta sola al primo getter, non al re-trigger.

**H2 (medium) — Bucket reuse:** `gruppiCalendario` crea oggetti `g1/g15/gfine` **dentro il getter**, e ad ogni run torna un nuovo array `[g1, g15, gfine]`. Alpine dovrebbe vedere il cambio di reference. MA i `key` di Alpine per le calendar-card sono `inc.id` — l'item che è stato cancellato ESISTE ancora in `this.dati.incassiAffitti` con `.deletedAt` valorizzato; il bucket lo include come prop "mancante" invece che come incasso. Se Alpine non re-runna il getter, ovviamente non vede questo movimento.

**H3 (low) — Async timing:** `eliminaIncasso` chiama `this.salva()`. Il `salva()` è sincrono finché non parte il debouncer. La mutation `inc.deletedAt = ISO` accade **prima** di `salva()`. La reactivity dovrebbe scattare subito. Non vedo timing issue plausibile.

### Conclusione

H1 è la più probabile. Sintomatico che `cestinoItems` (che fa `for (const p of props)` direttamente, **leggendo `.deletedAt` nel getter corrente**) funzioni, mentre `gruppiCalendario` (che lo legge dentro `attivi()`'s `.filter()` callback) non funzioni.

### Minimal fix (1 riga effettiva — uniforma al pattern che funziona)

Inlining del filter in `gruppiCalendario` (riga 960, 967, 972). Mostrato come diff applicato:

```diff
 gruppiCalendario() {
   const mese = this.annoCalendario + '-' + String(this.meseCalendario + 1).padStart(2, '0');
-  const incM = this.attivi(this.dati.incassiAffitti).filter(i => i.mese === mese);
+  const incM = (this.dati.incassiAffitti || []).filter(i => !i.deletedAt && i.mese === mese);
   const g1 = { label: 'Giorno 1', incassi: [], mancanti: [] };
   const g15 = { label: 'Giorno 15', incassi: [], mancanti: [] };
   const gfine = { label: 'Fine mese', incassi: [], mancanti: [] };
   const bucket = (s) => s === '1' ? g1 : (s === '15' ? g15 : gfine);
   const orfani = [];
   for (const inc of incM) {
-    const prop = this.attivi(this.dati.proprieta).find(p => p.id === inc.proprietaId);
+    const prop = (this.dati.proprieta || []).find(p => !p.deletedAt && p.id === inc.proprietaId);
     if (!prop) { orfani.push(inc); continue; }
     bucket(prop.scadenzaAffitto).incassi.push(inc);
   }
-  for (const prop of this.attivi(this.dati.proprieta)) {
+  for (const prop of (this.dati.proprieta || []).filter(p => !p.deletedAt)) {
     const ha = incM.some(i => i.proprietaId === prop.id);
     if (!ha) bucket(prop.scadenzaAffitto).mancanti.push(prop);
   }
   const gruppi = [g1, g15, gfine];
   if (orfani.length > 0) gruppi.push({ label: '⚠ Incassi orfani (proprieta cancellata)', incassi: orfani, mancanti: [] });
   return gruppi;
 },
```

**Perché vince:** ora `gruppiCalendario` LEGGE `.deletedAt` direttamente dentro il proprio getter — esattamente lo stesso pattern di `cestinoItems` (che è verde). Tre `.filter`/`.find` ma tutti contengono il predicate `!x.deletedAt` inline → Alpine traccia ogni `inc.deletedAt` come dipendenza del getter corrente.

**`attivi()` resta** per gli altri 14 call site (`incassiMeseCorrente`, `gruppiCalendario` no più, ecc.). Non rimuoviamo il helper — la regressione potrebbe riapparire altrove. Bug isolato a questo getter.

### Test assertion che prova il fix

`undo.spec.ts` riga 70 (già scritta, è il fail attuale):
```ts
await expect(cardAfter.locator('button[title="Elimina"]')).toHaveCount(0, { timeout: 2_000 });
```
Dopo il fix questa diventa verde perché la card scivola dal bucket `incassi` al bucket `mancanti` (che non rende il bottone Elimina). Un-skip togliendo `.skip` da riga 47.

**Confidence sul fix:** MEDIUM-HIGH. Se H1 è falsa, il fix copre comunque anche H2 (perché il bucket reuse era cosmesi del re-run; se il getter non si ri-trigga, niente lo salva → l'inlining forza il re-trigger ricostruendo la dipendenza).

---

## 8. SNAP-01 — falsificazione + minimal fix diff

### Sintomo (da CI #6 commit `00db84b3`)
2 salvataggi eseguiti, 19 fetch a `user_data`, MA `localStorage.setItem('gestione_affitti_snapshots', …)` (riga 328) **mai eseguito**. Nessun `pushErrore`. Quindi `pushSnapshot` ha fatto early-return su `!preState` → `preState` era `null`/`undefined`.

### Ipotesi rankate

**H1 (most likely) — Priming proxy-write timing:** Il sintomo dice "0 setItem". Ma leggendo il codice attuale (riga 657 e 689):
- Riga 657: `this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));` SUL HAPPY PATH, prima del `statoSalvataggio = 'salvato'`.
- Riga 683–691: `finally` block che ri-tenta priming se `!_primingDone`.
- `salva()` (riga 707): `if (this._lastSnapshotData) { this.pushSnapshot(this._lastSnapshotData); }`.

Per ottenere 0 setItem, `this._lastSnapshotData` deve essere `null` al momento della LETTURA in `salva()`. Possibilità:
1. **Test seed:** in `snapshot.spec.ts`, il test seed via Supabase service-key inietta dati DOPO il primo boot di `init()`. Sequenza: `init()` parte → `caricaDatiUtente()` carica dati esistenti del test user → `_lastSnapshotData` viene primed. Poi `await page.click('button:has-text("Impostazioni"))` → mutation `editBanca` → `salva()` → dovrebbe vedere `_lastSnapshotData` set.
2. **MA**: se il test seed (in `fixtures.ts`) sovrascrive `user_data` DOPO il login ma PRIMA del primo `caricaDatiUtente`, e poi succede una `onAuthStateChange` SIGNED_IN che ritrigga `caricaDatiUtente`, **due chiamate concorrenti** a `caricaDatiUtente` possono avere race. La PRIMA legge dati, prima della seed → priming = dati vecchi. La SECONDA legge dati seedati ma il `finally` `if (!_primingDone && !this._lastSnapshotData)` ha la guardia `!this._lastSnapshotData` quindi NON ripriming (è già set dal primo run).

**Outcome H1**: `_lastSnapshotData` è SET ma a un oggetto JSON-stringificato che è "uguale" allo state corrente — ma `pushSnapshot` non confronta, scrive comunque. Quindi questo non spiega "0 setItem".

**H1-bis (PIÙ probabile)**: `_lastSnapshotData` è `null` perché `caricaDatiUtente` ha catchato un error path che NON arriva al priming + il `finally` ha la guardia `!this._lastSnapshotData` che resta vera. Sequenza: error path che taglia prima del set di `this.dati` → `this.dati` resta `{ dataVersion: 2, proprieta: [], ... }` (initial). Il `finally` ENTRA, fa `this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati))` su un oggetto vuoto → `_lastSnapshotData = '{"dataVersion":2,...}'`. Questo NON è `null` quindi `pushSnapshot` farebbe `setItem`. **Quindi non spiega 0 setItem.**

**H2 (truthy)** — Proxy unwrap: `this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati))` su un Alpine proxy. `JSON.stringify` su un Proxy chiama i traps, ritorna stringa. `JSON.parse` ritorna oggetto plain. Assegnato a `this._lastSnapshotData` su Alpine proxy → diventa reattivo. Poi `salva()` legge `this._lastSnapshotData` → torna l'oggetto plain. Non spiega null.

**H3 (likely vera causa)** — **`caricamentoIniziale` race:** `caricaDatiUtente` viene chiamato da 3 path (init + onAuthStateChange + online listener). I test fanno login con il **page.click** → questo triggera `accediConEmail` che chiama `await this.caricaDatiUtente()` (riga ~555). Una **seconda** chiamata viene dal `onAuthStateChange` listener. Le due `caricaDatiUtente` in flight in parallelo:
   - Run A entra, legge dati (vecchi), assegna `this.dati = migrati`, **arriva alla riga 657 → priming OK** → continua → `salvaSubito` (per migration) → assegna `_lastSnapshotData` di nuovo riga 713 dentro `salva()`. Wait no — `salvaSubito` da `caricaDatiUtente` salta `salva()`.
   - Run B entra, fa lo stesso, **MA NEL FRATTEMPO** il test ha già chiamato `salva()` (no: il test click di mutation viene dopo). 

Ricomincio. Soluzione difensiva semplice che chiude tutti i path:

### Minimal fix (defensive: rendi `pushSnapshot` resiliente + ri-prime dentro `salva()`)

**Opzione A (minimo, 2 righe in `salva()`):**

```diff
 salva() {
   if (!this.utente) return;
   this.statoSalvataggio = 'salvataggio';
+  // Defensive priming: se per qualunque race (multipli caricaDatiUtente, eventi
+  // onAuthStateChange concorrenti, fallback finally non eseguito) _lastSnapshotData
+  // e' null al momento della prima salva(), usa lo stato CORRENTE come pre-state.
+  // Garantisce >=1 setItem per ogni salva() utente-iniziata.
+  if (!this._lastSnapshotData) {
+    try { this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati)); } catch (_) {}
+  }
   if (this._lastSnapshotData) {
     this.pushSnapshot(this._lastSnapshotData);
   }
```

**Perché vince:**
- Chiude H1, H1-bis, H3 in un colpo: indipendentemente da cosa accada in `caricaDatiUtente`, la PRIMA `salva()` ha sempre un `preState`. Se è uguale allo state post-mutation (race con la seed), lo snapshot rappresenta lo stato VISTO DALL'UTENTE al momento dell'azione → semanticamente corretto.
- Non rimuove il priming esistente (rimane il pattern proven per restore, per le successive `salva()` consecutive, per il pattern documentato di "snapshot pre-mutation" nel commento riga 701–706).
- 2 righe effettive (la `try/catch`).

**Opzione B (più chirurgica)**: rimuovere la guardia `!this._lastSnapshotData` dal `finally` riga 687 in `caricaDatiUtente`:
```diff
- if (!_primingDone && !this._lastSnapshotData) {
+ if (!_primingDone) {
```
Forza re-prime in tutti i path post-`caricaDatiUtente`. Più chirurgico ma richiede di capire perché la guardia esisteva (commento riga 685 dice "idempotente: gia' impostato dai rami felici, ri-eseguito solo se il catch e' caduto senza primare") — quindi rimuovere la guardia è leggermente più rischioso che aggiungere la opzione A.

**Raccomandazione planner: opzione A.** Inviolabile, additive only, copre la classe.

### Test assertion che prova il fix

`snapshot.spec.ts` riga 75:
```ts
const count = await rows.count();
expect(count).toBeGreaterThanOrEqual(2);
```
Dopo opzione A, dopo 2 salva con mutation, `pushSnapshot` viene chiamata 2 volte, scrive 2 entry nell'array, `snapshots()` getter le restituisce in reverse → 2 row nel `[data-testid="snapshot-section"]`. Un-skip togliendo `.skip` da riga 47.

**Confidence sul fix:** MEDIUM. Il fix è defensive — copre il sintomo indipendentemente da quale ipotesi sia vera. Se vogliamo HIGH dobbiamo eseguire una run di Playwright con il fix applicato (out-of-band per il researcher).

---

## 9. Lighthouse PWA audit checklist

Lighthouse 11/12 (current as of 2026-05) ha **deprecato la categoria PWA come score numerico** e l'ha sostituita con un set di "Installability" checks + audit standalone. Il target ROADMAP "≥ 90" si applica al PWA category score così come visualizzato da Lighthouse legacy (ancora presente in `lighthouse-cli --preset=pwa` e nel Chrome DevTools "PWA" tab fino a CDM 119).

Audit list e copertura del piano:

| Audit Lighthouse PWA | Soddisfatto da | Stato |
|---|---|---|
| **installable-manifest** (manifest válido, name, icons ≥192, start_url, display) | Sez. 3 manifest recipe | OK |
| **service-worker** (SW registrato con scope coprente l'URL) | Sez. 5 register `{ scope: './' }` | OK |
| **splash-screen** (manifest ha name + background_color + icon ≥512) | Sez. 3 (background_color + icon-512) | OK |
| **themed-omnibox** (`theme-color` meta + manifest match) | `<meta name="theme-color" content="#0071e3">` + manifest `theme_color` matchato | OK |
| **content-width** (no horizontal scroll mobile) | `html, body { overflow-x: hidden; }` riga 133 + viewport meta esistente | OK |
| **viewport** (`<meta name="viewport" width=device-width>`) | Già presente riga 5 | OK |
| **apple-touch-icon** (180×180) | Sez. 3 `<link rel="apple-touch-icon">` | OK |
| **maskable-icon** (`purpose: "maskable"` icon ≥192) | Sez. 3 icon-512-maskable | OK |
| **offline-start-url** (la start_url risponde 200 quando offline) | SW fetch handler: `navigate` → SWR con fallback `index.html` cached | OK |
| **redirects-http** (HTTPS only) | GH Pages serve solo HTTPS | OK |
| **load-fast-enough-for-pwa** (TTI <10s su 3G simulato) | Tailwind CDN + Supabase CDN + Alpine CDN su 3G ≈ 6–8s. Marginale; SWR cache della seconda visita = <2s | OK probabile |

**Gap potenziali da watchare:**
- `load-fast-enough-for-pwa` su connessione throttled 3G è il singolo audit a rischio. Mitigazione: i CDN sono pinnati a 3 file totali, e dopo first install il SW li serve da cache. Lighthouse PWA score include questo audit ma è uno tra ~10, quindi se gli altri 9 sono verdi, ≥90 è raggiungibile anche con questo arancione.
- `pwa-cross-browser` e `pwa-each-page-has-url` sono **manuali** (Lighthouse non li auto-assegna). Documentare in PLAN-CHECK.

**Confidence:** HIGH che il piano raggiunga ≥90. Test reale: `npx lighthouse https://oldpz.github.io/gestione-affitti/ --preset=desktop --view` post-deploy.

---

## 10. CI compatibility + nuovo Playwright spec

### `paths-ignore`
**Stato reale**: `playwright.yml` (controllato) NON ha `paths-ignore`. Tutti i commit triggerano la CI. Aggiungere `sw.js`, `manifest.json`, `icons/*.png` → CI gira normalmente. Nessuna modifica al workflow richiesta.

> Nota disallineamento: CONTEXT.md riga 75 afferma "`paths-ignore` in `playwright.yml` still excludes `.planning/**`, `docs/**`, `**.md`". Reale: non c'è. Vedi sez. 14 Open Questions.

### Required check
Job name `test` (riga 11). Branch protection master-protect richiede check `test`. PR2a deve emerging green su `test` per merge.

### Evoluzione `sw.spec.ts` (REGRESSION-03)

Stato attuale: asserisce `swCount === 0`. Dopo PR2a il count sarà `1`. La spec deve evolvere mantenendo l'invariante "stale SW unregistrati":

```ts
// tests/sw.spec.ts (post-PR2a)
import { test, expect } from './fixtures';

test('REGRESSION-03: stale SWs unregistered at boot, current SW survives', async ({ page }) => {
  // Pre-registra uno "stale" SW con scriptURL diverso (es. da una vecchia versione)
  await page.goto('/');
  await page.evaluate(async () => {
    // Simula un SW vecchio scritto con un path diverso. NOTA: non possiamo
    // registrare un SW falso; testiamo che dopo reload solo sw.js (corrente)
    // resta. Per testare lo "stale unregister" puro, basta verificare il loop:
  });
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.map(r => (r.active || r.installing || r.waiting)?.scriptURL || null);
  });

  expect(result.length).toBe(1);
  expect(result[0]).toMatch(/sw\.js$/);
});
```

### Nuovo spec `tests/pwa-shell.spec.ts`

```ts
// tests/pwa-shell.spec.ts — PR2a (REQ-PWA-01, REQ-PWA-02, REQ-PWA-03).
// NOTE: Playwright Chromium headless non triggera beforeinstallprompt in modo
// affidabile (richiede installability + engagement heuristics non simulabili).
// Quindi testiamo: manifest link presente, SW attivo, banner DOM controllato
// via state localStorage iniettato — NON il prompt nativo.

import { test, expect } from './fixtures';

test('PWA-01: manifest link e theme-color presenti', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.json/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0071e3');
});

test('PWA-02: service worker registrato e controlla la pagina', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Attendi che il SW prenda controllo (clients.claim sull'activate)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10_000 });
  const url = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  expect(url).toMatch(/sw\.js$/);
});

test('PWA-03a: install banner NON appare al primo accesso (< 3 sessioni)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="install-banner"]')).not.toBeVisible();
});

test('PWA-03b: install banner appare dopo 3 sessioni in 7 giorni (state injection)', async ({ page }) => {
  await page.goto('/');
  // Inietta 3 timestamp recenti nel session log + un flag che simula
  // beforeinstallprompt catturato (per il branch non-iOS).
  await page.evaluate(() => {
    const now = Date.now();
    const log = [
      new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ];
    localStorage.setItem('gestione_affitti_session_log', JSON.stringify(log));
  });
  await page.reload();
  // Inietta deferredInstallPrompt fake direttamente sull'Alpine instance
  await page.evaluate(() => {
    const root = document.querySelector('[x-data]') as any;
    if (root && root._x_dataStack?.[0]) {
      root._x_dataStack[0]._deferredInstallPrompt = { prompt: () => {}, userChoice: Promise.resolve() };
      root._x_dataStack[0].maybeShowInstallBanner();
    }
  });
  await expect(page.locator('[data-testid="install-banner"]')).toBeVisible({ timeout: 2_000 });
  await expect(page.locator('[data-testid="install-banner"]')).toContainText('Aggiungi alla schermata Home');
});

test('PWA-03c: dismissing il banner setta install_dismissed_until', async ({ page }) => {
  await page.goto('/');
  // setup come 03b...
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('gestione_affitti_session_log', JSON.stringify([
      new Date(now - 5*86400000).toISOString(),
      new Date(now - 3*86400000).toISOString(),
      new Date(now - 1*86400000).toISOString(),
    ]));
  });
  await page.reload();
  await page.evaluate(() => {
    const root = document.querySelector('[x-data]') as any;
    if (root && root._x_dataStack?.[0]) {
      root._x_dataStack[0]._deferredInstallPrompt = { prompt: () => {}, userChoice: Promise.resolve() };
      root._x_dataStack[0].maybeShowInstallBanner();
    }
  });
  await page.locator('[data-testid="install-dismiss"]').click();
  await expect(page.locator('[data-testid="install-banner"]')).not.toBeVisible();
  const until = await page.evaluate(() => localStorage.getItem('gestione_affitti_install_dismissed_until'));
  expect(until).toBeTruthy();
  expect(new Date(until!).getTime()).toBeGreaterThan(Date.now() + 13 * 86400000); // ~14 giorni
});
```

**Caveats Playwright/Chromium:**
- `beforeinstallprompt` non firea sotto Chromium headless senza engagement heuristics — l'iniezione manuale del fake event via Alpine instance è il workaround standard.
- Service worker registration funziona in Chromium headless (HTTPS o `localhost`/`127.0.0.1`).
- `localhost:3000` con `npx serve` è treated come "secure context" → SW si registra.

---

## 11. Icon generation

### favicon.io params (workflow PR2a)

Parametri scelti per match con design system (Apple/Sonoma blue gradient + emoji 🏠):

| Param | Valore |
|---|---|
| Tipo generator | "Emoji to favicon" → `https://favicon.io/emoji-favicons/house` |
| Emoji | 🏠 (`U+1F3E0`) |
| Variant | "Apple emoji style" se disponibile (fallback: default platform emoji) |
| Background shape | Rounded square (Sonoma-style) |
| Background gradient | `linear-gradient(135deg, #0071e3, #5e9eff)` — matcha `--gradient-logo` (index.html riga 80) |
| Padding | 12% safe-zone (per maskable compliance) |

### Sizes table

| File | Size | Purpose | Note |
|---|---|---|---|
| `icons/icon-192.png` | 192×192 | manifest `any` | Min size for Android home screen |
| `icons/icon-512.png` | 512×512 | manifest `any` | Min size for splash screen |
| `icons/icon-512-maskable.png` | 512×512 | manifest `maskable` | Stessa grafica, safe-zone 80% (zoom-out) |
| `icons/icon-1024.png` | 1024×1024 | manifest `any` (high-DPI) | Future-proofing |
| `icons/apple-touch-icon-180.png` | 180×180 | `<link rel="apple-touch-icon">` | **NO transparency** — iOS aggiunge sfondo nero altrimenti |
| `icons/favicon.ico` | 16/32/48 | `<link rel="icon">` (fallback) | Opzionale, già presente probabilmente |

### Fallback se favicon.io down

Script HTML standalone con `<canvas>` da eseguire in browser:

```html
<!DOCTYPE html><html><body><canvas id="c" width="1024" height="1024"></canvas><script>
const c = document.getElementById('c'), ctx = c.getContext('2d');
const grad = ctx.createLinearGradient(0,0,1024,1024);
grad.addColorStop(0, '#0071e3'); grad.addColorStop(1, '#5e9eff');
ctx.fillStyle = grad;
ctx.beginPath();
const r = 200; ctx.roundRect(0, 0, 1024, 1024, r); ctx.fill();
ctx.font = '600px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
ctx.fillText('🏠', 512, 540);
// download
const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'icon-1024.png'; a.click();
</script></body></html>
```

Poi resize a 512/192/180 con qualsiasi tool (ImageMagick, Photoshop, anche un altro `<canvas>` con `drawImage`).

---

## 12. Risk map vs CON-017 5 LOCKED Playwright tests

| LOCKED test | File | Come PR2a potrebbe romperlo | Mitigazione |
|---|---|---|---|
| **#1 Login** | `login.spec.ts` | SW serve `index.html` cached da una versione precedente al login flow PR0 → form login con DOM vecchio | Bump `CACHE_NAME` a `v1` (siamo a primo deploy SW; nessuna cache precedente). Per re-deploy: bump a `v2`. `clients.claim()` + SWR background fetch dà nuova versione al prossimo navigate. Test in CI gira contro `localhost:3000` (server fresco) → niente cache reale. **Rischio reale: basso.** |
| **#2 Mark incasso (segnaIncassatoOggi)** | `calendario.spec.ts` | Stesso pattern: SW cached `app.js` precedente. PR2a NON tocca la logica di `segnaIncassatoOggi`. | Stessa mitigazione. **Rischio: basso.** |
| **#3 Stale-SW unregister at boot** | `sw.spec.ts` | Diretto target! Sez. 5 cambia il loop di unregister. La spec attuale `swCount === 0` fallirebbe dopo PR2a (count diventa 1). | **Evolvere `sw.spec.ts`** come sez. 10: asserire `count === 1` AND `scriptURL` match `/sw\.js$/`. Già pianificato. **Rischio: gestito.** |
| **#4 Offline sync** | `offline.spec.ts` | SW intercetta richieste Supabase e le serve da cache stale → modalità offline non scatta correttamente | sw.js sez. 4 ha **`NETWORK_ONLY_HOSTS` con `supabase.co/in`** → Supabase API non passa mai per cache. **Rischio: gestito by design.** Verifica esplicita: leggere il test e assertarsi che usi una URL Supabase (sì, lo fa). |
| **#5 Cestino restore** | `cestino.spec.ts` | Stesso pattern di #1/#2 (cache `app.js`). UNDO-01 fix tocca `gruppiCalendario`, non `cestinoItems` → cestino restore unaffected. | Mitigazione di cache + verifica targeted del fix UNDO-01 non tocca cestino path. **Rischio: basso.** |

### Smoke-test-locally checklist (per executor pre-merge)

```
□ npm run test                    # full Playwright suite verde (incluso UNDO-01, SNAP-01 un-skipped)
□ Aprire localhost:3000 in Chrome
  □ DevTools > Application > Service Workers: "sw.js" registered + activated
  □ DevTools > Application > Manifest: nessun error, icons preview OK
  □ DevTools > Lighthouse > PWA category: score ≥ 90
□ Chiudere tab, rilanciare offline (DevTools > Network > Offline)
  □ Reload: app shell carica da cache (no white page)
  □ Login form visibile, ma submit fallisce gracefully (modalitaOffline)
□ DevTools > Application > Local Storage:
  □ "gestione_affitti_session_log" presente con 1 entry dopo primo load
  □ Dopo 3 reload (a >30 min OR mock manualmente): banner appare
  □ Click "Piu tardi": "gestione_affitti_install_dismissed_until" = ISO ~14d future
□ Lighthouse mobile preset: score PWA ≥ 90
```

---

## 13. Estimation hint

Anchor CON-020: 4–5h realistici, 25min/task cap.

### Task count proposto (planner finale potrà ridurre/espandere)

| # | Task | Min | Note |
|---|---|---|---|
| T01 | Generate icons (favicon.io workflow → 5 file in `icons/`) | 20 | I/O lavoro manuale + commit |
| T02 | Add `manifest.json` (sez. 3) | 10 | File nuovo, contenuto già scritto |
| T03 | Add `<link rel="manifest">` + meta tags in `index.html` head | 10 | 7 righe in `<head>` |
| T04 | Add `sw.js` (sez. 4) | 25 | ~150 righe, copia-incolla dal recipe + adatta |
| T05 | Modify `app.js init()` stale-SW unregister loop → match-by-scriptURL + register `sw.js` (sez. 5) | 20 | Sostituzione righe 165–170, ~25 righe |
| T06 | Add Alpine state + helpers per install prompt (`recordSession`, `maybeShowInstallBanner`, `installApp`, `dismissInstallPrompt`, listener `beforeinstallprompt` + `appinstalled`) | 25 | ~60 righe in `app.js` |
| T07 | Add install banner HTML in `index.html` (sez. 6) | 15 | ~20 righe, riusa `.glass-card`/`.btn-primary` |
| T08 | **UNDO-01 fix**: inline filter in `gruppiCalendario` (sez. 7 diff) | 10 | 3 righe modificate |
| T09 | Un-skip `tests/undo.spec.ts` (togli `.skip` riga 47) | 5 | 1 char |
| T10 | **SNAP-01 fix**: defensive priming in `salva()` (sez. 8 diff opzione A) | 10 | 3 righe aggiunte |
| T11 | Un-skip `tests/snapshot.spec.ts` (togli `.skip` riga 47) | 5 | 1 char |
| T12 | Evolvere `tests/sw.spec.ts` (sez. 10) | 15 | ~10 righe modificate |
| T13 | Add `tests/pwa-shell.spec.ts` (sez. 10, 4 test cases) | 30 | ~80 righe nuove |
| T14 | Local smoke + Lighthouse run + screenshot evidence | 20 | Manual gate |
| T15 | PR create + squash-merge | 10 | Process |
| **Tot** | | **~230 min ≈ 3h50m** | Realisticamente **4–5h** con 20% buffer (Lessons PR1 #1) |

### Numero atomi di commit suggerito

8–10 commit atomici (1–2 task per commit logico):
1. `feat(pr2a): icons (5 file)` (T01)
2. `feat(pr2a): manifest.json + head links` (T02+T03)
3. `feat(pr2a): sw.js stale-while-revalidate` (T04)
4. `feat(pr2a): register SW + stale-SW filter` (T05) — evolvere anche `sw.spec.ts` (T12) qui stesso, vedi PR1 lesson #2 "small no-op companions can ride along".
5. `feat(pr2a): install prompt state + helpers` (T06)
6. `feat(pr2a): install banner UI` (T07)
7. `fix(pr2a,UNDO-01): inline filter in gruppiCalendario` (T08+T09)
8. `fix(pr2a,SNAP-01): defensive priming in salva()` (T10+T11)
9. `test(pr2a): pwa-shell spec` (T13)

---

## 14. Open questions per il planner

1. **`paths-ignore` reale vs documentato** — CONTEXT.md riga 75 dice "`paths-ignore` excludes `.planning/**`, `docs/**`, `**.md`". Il workflow attuale NON lo fa. Domanda: **vogliamo introdurre `paths-ignore` in PR2a** per allineare al pattern documentato, o lasciare il workflow as-is e correggere CONTEXT.md? Se introdurre, aggiungere come T0 prima dei task PWA.

2. **N-day dismiss** — raccomandato 14 giorni. CONTEXT.md lascia decisione al planner. Confermare 14 o scegliere 7/30.

3. **Cache version scheme** — `v1`, `v2`, … manuale. In alternativa: derivare da `package.json` version o da commit SHA breve. Per PR2a propongo **manuale** (più semplice, 1 char da cambiare). PR2b può introdurre auto-bump.

4. **SW auto-update UX in tab aperta** — al momento `skipWaiting + clients.claim` attiva il nuovo SW ma la tab corrente ha il vecchio HTML/JS in memoria. PR2a accetta questa UX (utente vede nuovo codice al prossimo navigate/reload). Nessun toast "Ricarica per aggiornare" in PR2a. Confermare deferral a PR3.

5. **Session definition** — "3 sessioni in 7 giorni" — definito come "load con gap > 30 min dal precedente". Confermare gap (30 min ragionevole; 15 min troppo restrittivo, 60 min troppo permissivo per uso giornaliero).

6. **iOS detection robustezza** — `/iPhone|iPad|iPod/.test(ua)` non cattura iPadOS 13+ che si maschera come Mac. Trade-off: aggiungere check `navigator.maxTouchPoints > 1 && navigator.platform === 'MacIntel'`. PR2a può ignorare (uso target = iPhone famiglia). Confermare scope.

7. **Maskable icon design** — favicon.io produce icona con safe-zone? Verificare in fase T01 e, se no, generare separatamente (ImageMagick `convert -extent 110%`).

8. **Lighthouse audit "load-fast-enough-for-pwa"** — su 3G simulato i 3 CDN (Tailwind, Supabase, Alpine) potrebbero scarseggiare TTI <10s al **first** load. Mitigazione possibile: aggiungere `<link rel="preload">` per i 3 script. Decisione planner: includere in PR2a o deferred.

---

## Sources

### Primary (HIGH confidence)
- Lettura diretta repository: `index.html`, `app.js`, `tests/*.spec.ts`, `.github/workflows/playwright.yml`, `playwright.config.ts`.
- `.planning/phases/04-pr2a-pwa-shell-manifest-sw/04-CONTEXT.md` (canonical scope).
- Inline commenti `tests/undo.spec.ts` righe 5–43 e `tests/snapshot.spec.ts` righe 5–43 (diagnostiche di PR1).
- W3C Web App Manifest spec (campi `theme_color`, `display`, `scope`, `start_url`, `purpose: maskable`).
- MDN Service Worker API (`install`, `activate`, `clients.claim`, `skipWaiting`, `Cache.match`).

### Secondary (MEDIUM confidence)
- Pattern Stale-While-Revalidate da Workbox docs (replicato manualmente, no Workbox dependency).
- iOS PWA limitations (`beforeinstallprompt` non disponibile, `navigator.standalone`).
- Lighthouse PWA audit list (Chrome DevTools 12x).

### Tertiary (LOW — flagged)
- `UNDO-01` H1 (proxy tracking through helper) — basato su modello mentale Alpine 3 + Vue 3 proxy; non verificato a runtime in questa sessione. Il fix proposto è defensivo e copre H1+H2 entrambe.
- `SNAP-01` H3 (race tra multipli `caricaDatiUtente`) — speculazione su ordine eventi auth; fix opzione A è defensivo e non dipende dall'ipotesi.

---

## Metadata

**Confidence breakdown:**
- Manifest recipe: HIGH (valori derivati direttamente dai token PR0 letti)
- SW recipe: HIGH (SWR pattern noto, edge case Range/Supabase indirizzati)
- Stale-SW unregister diff: HIGH (codice attuale letto, diff scritto contro le righe 165–170)
- Install prompt: HIGH (state shape + HTML + helpers tutti scritti)
- UNDO-01 fix: MEDIUM-HIGH (3 ipotesi rankate, fix copre tutte e tre)
- SNAP-01 fix: MEDIUM (defensive fix bypassa diagnosis incompleta)
- Lighthouse: HIGH per la maggior parte degli audit, MEDIUM per `load-fast-enough-for-pwa`
- CI compat: HIGH (workflow letto direttamente)
- Risk map: HIGH

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stack PWA è stabile; Lighthouse audit set può evolvere ma le metriche sono backward-compat)
