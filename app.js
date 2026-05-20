// Numero WhatsApp per "Invia diagnostica" — vuoto = bottone disabilitato.
// Configurato dall'utente; non commitare mai un numero reale qui.
const SUPPORT_WHATSAPP = '';

/** Genera un ID univoco breve */
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }

/** Formatta importo nella valuta indicata (EUR default, USD supportato) */
function formatValuta(n, currency = 'EUR') {
  if (n == null || isNaN(n)) return currency === 'USD' ? '$0.00' : '0,00 \u20AC';
  const locale = currency === 'USD' ? 'en-US' : 'it-IT';
  return n.toLocaleString(locale, { style: 'currency', currency });
}

/** Formatta data ISO in gg/mm/aaaa */
function formatData(d) {
  if (!d) return '\u2014';
  const [y, m, g] = d.split('-');
  return g + '/' + m + '/' + y;
}

/** Data odierna ISO */
function oggi() { return new Date().toISOString().split('T')[0]; }

/** Mese corrente YYYY-MM */
function meseCorrente() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** Calcola data prevista per incasso */
function dataPrevist(mese, scadenza) {
  const [y, m] = mese.split('-').map(Number);
  if (scadenza === 'fine_mese') {
    const ultimo = new Date(y, m, 0).getDate();
    return y + '-' + String(m).padStart(2, '0') + '-' + String(ultimo).padStart(2, '0');
  }
  const g = parseInt(scadenza) || 1;
  return y + '-' + String(m).padStart(2, '0') + '-' + String(g).padStart(2, '0');
}

/** Dati di esempio iniziali */
function datiEsempio() {
  const bBPM = { id: uid(), nome: 'BPM', intestatario: 'Stefano Desio', currency: 'EUR' };
  const bBPER = { id: uid(), nome: 'BPER', intestatario: 'Gina Desio', currency: 'EUR' };
  const nomi = ['Via Guelfa','Via Dei Servi','Elba 508','Elba 626','Follonica Bicocchi','Franklin 214','Sweetzer 201','Ghibellina 101','Larrabee 116'];
  const importi = [800,900,750,650,1000,1200,1100,850,950];
  const proprieta = nomi.map((nome, i) => ({
    id: uid(), nome, tipo: 'appartamento',
    scadenzaAffitto: i % 3 === 0 ? '1' : (i % 3 === 1 ? '15' : 'fine_mese'),
    importoAffittoMensile: importi[i],
    bancaIncasso: i % 2 === 0 ? bBPM.id : bBPER.id,
    intestatario: i % 2 === 0 ? 'Stefano Desio' : 'Gina Desio',
    bancaDestinazione: i % 2 === 0 ? bBPER.id : bBPM.id,
    currency: 'EUR',
    deletedAt: null,
    note: ''
  }));
  return { dataVersion: 3, proprieta, banche: [bBPM, bBPER], incassiAffitti: [], utenze: [] };
}

/** Migrazione schema dati: idempotente, applica cambiamenti incrementali per versione. */
function migraDati(dati) {
  if (!dati || typeof dati !== 'object') return dati;
  if (!dati.dataVersion || dati.dataVersion < 2) {
    if (Array.isArray(dati.proprieta)) {
      for (const p of dati.proprieta) { if (!p.currency) p.currency = 'EUR'; }
    }
    if (Array.isArray(dati.banche)) {
      for (const b of dati.banche) { if (!b.currency) b.currency = 'EUR'; }
    }
    if (Array.isArray(dati.incassiAffitti)) {
      for (const i of dati.incassiAffitti) { if (!i.currency) i.currency = 'EUR'; }
    }
    if (Array.isArray(dati.utenze)) {
      for (const u of dati.utenze) { if (!u.currency) u.currency = 'EUR'; }
    }
    dati.dataVersion = 2;
  }
  if (!dati.dataVersion || dati.dataVersion < 3) {
    if (Array.isArray(dati.proprieta)) {
      for (const p of dati.proprieta) { if (!('deletedAt' in p)) p.deletedAt = null; }
    }
    if (Array.isArray(dati.incassiAffitti)) {
      for (const i of dati.incassiAffitti) {
        if (!('deletedAt' in i)) i.deletedAt = null;
        if (!('modificatoManualmente' in i)) i.modificatoManualmente = false;
      }
    }
    dati.dataVersion = 3;
  }
  return dati;
}

// ---------- Componente Alpine principale ----------
function app() {
  return {
    viste: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'calendario', label: 'Calendario' },
      { id: 'proprieta', label: 'Propriet\u00E0' },
      { id: 'banche', label: 'Banche' },
      { id: 'utenze', label: 'Utenze' },
      { id: 'impostazioni', label: 'Impostazioni' }
    ],
    vistaCorrente: 'dashboard',
    mobileMenuOpen: false,
    drawerOpen: false,
    nomiMesi: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
    dati: { dataVersion: 2, proprieta: [], banche: [], incassiAffitti: [], utenze: [] },
    statoSalvataggio: 'salvato',
    modalitaOffline: false,
    // --- Stato autenticazione ---
    utente: null,
    caricamentoIniziale: true,
    modalitaAuth: 'login',
    authEmail: '',
    authPassword: '',
    authError: '',
    authInfo: '',
    authLoading: false,
    debounceTimer: null,
    _lastSnapshotData: null,
    // Counter reattivo per Alpine: ogni pushSnapshot lo incrementa, snapshots()
    // lo legge (void this._snapshotVersion) -> Alpine sa di dover ri-eseguire
    // il template x-for quando localStorage cambia. Senza questo, snapshots()
    // legge solo localStorage e Alpine non traccia alcun dep -> il template
    // resta sullo stato iniziale "Nessuno snapshot disponibile" anche dopo
    // pushSnapshot effettivo (SNAP-01 root cause, scoperto via CI debug PR2a).
    _snapshotVersion: 0,
    // PR2b dual-write flag + sync timestamps (DEC-012, plan 05-01)
    usaNuovoSchema: true,
    lastPullAt: null,
    lastPushAt: null,
    _isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    // PWA install prompt (PR2a REQ-PWA-03)
    installPromptVisible: false,
    _deferredInstallPrompt: null,
    _isIosSafari: false,
    storagePctValue: null,
    proprietaSelezionata: null,
    annoProprieta: new Date().getFullYear(),
    meseCalendario: new Date().getMonth(),
    annoCalendario: new Date().getFullYear(),
    meseBanca: meseCorrente(),
    incassoInModifica: null,
    filtroUtenzeProprieta: '', filtroUtenzeTipo: '', filtroUtenzeStato: '',
    filtroUtenzeAnno: new Date().getFullYear(),
    mostraFormUtenza: false, nuovaUtenza: {},
    mostraFormProprieta: false, editProprieta: {},
    mostraFormBanca: false, editBanca: {},

    async init() {
      // Error capture globale: registrato per primo cosi cattura anche errori
      // sollevati durante il setup di Supabase/Alpine.
      window.addEventListener('error', (ev) => {
        this.pushErrore({
          ts: new Date().toISOString(),
          message: (ev && ev.message) || 'error',
          stack: ev && ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 1000) : null,
          url: ev && ev.filename ? ev.filename : null,
          line: ev && ev.lineno ? ev.lineno : null,
          severity: 'error',
        });
      });
      window.addEventListener('unhandledrejection', (ev) => {
        const reason = ev && ev.reason;
        const msg = reason && reason.message ? reason.message : String(reason || 'unhandledrejection');
        this.pushErrore({
          ts: new Date().toISOString(),
          message: msg,
          stack: reason && reason.stack ? String(reason.stack).slice(0, 1000) : null,
          severity: 'error',
        });
      });

      // Pulizia: rimuove chiave localStorage obsoleta e service worker stale da versioni precedenti
      try { localStorage.removeItem('gestione_affitti_dati'); } catch (e) {}
      // Fire-and-forget: aggiorna la percentuale di storage usato dal browser.
      this.aggiornaStoragePct();
      // PWA shell (PR2a REQ-PWA-02 + CON-010 + CON-017 #3):
      // unregistra SOLO i SW con scriptURL != sw.js corrente (es. registrazioni
      // da versioni precedenti dell'app), poi registra sw.js scope './'.
      // Filter-by-scriptURL preserva il SW attuale; il vecchio "unregister all"
      // disinstallava anche se stesso ad ogni boot.
      if ('serviceWorker' in navigator) {
        try {
          const SW_URL = 'sw.js';
          const SW_ABS = new URL(SW_URL, location.href).href;
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) {
            const active = r.active || r.installing || r.waiting;
            const url = active && active.scriptURL ? active.scriptURL : '';
            if (url !== SW_ABS) {
              await r.unregister();
            }
          }
          // fire-and-forget: non rallentare il boot
          navigator.serviceWorker.register(SW_URL, { scope: './' }).catch((e) => {
            console.warn('SW register failed:', e);
          });
        } catch (e) {
          console.warn('SW boot error:', e);
        }
      }

      // PR2b dual-write rollback flag (DEC-012, plan 05-01)
      try {
        this.usaNuovoSchema = localStorage.getItem('usaNuovoSchema') !== 'false';
      } catch (_) { this.usaNuovoSchema = true; }
      // PR2b _isOnline reactive (R-NEW-7 mitigation, plan 05-01)
      window.addEventListener('online',  () => { this._isOnline = true; });
      window.addEventListener('offline', () => { this._isOnline = false; });

      // PWA install prompt detection (PR2a REQ-PWA-03)
      // iOS Safari NON espone beforeinstallprompt; iPadOS 13+ si maschera come
      // MacIntel quindi il check UA da solo non basta (OQ-6 del plan).
      const ua = navigator.userAgent;
      const isIosUA = /iPhone|iPad|iPod/.test(ua);
      const isIpadOS = navigator.maxTouchPoints > 1 && navigator.platform === 'MacIntel';
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                        || navigator.standalone === true;
      this._isIosSafari = (isIosUA || isIpadOS) && !isStandalone;

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this._deferredInstallPrompt = e;
        this.maybeShowInstallBanner();
      });
      window.addEventListener('appinstalled', () => {
        this.installPromptVisible = false;
        this._deferredInstallPrompt = null;
        try { localStorage.setItem('gestione_affitti_installed', '1'); } catch (_) {}
      });
      this.recordSession();
      this.maybeShowInstallBanner();

      // Verifica se esiste una sessione attiva
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        this.utente = session.user;
        await this.caricaDatiUtente();
        this.purgeOldSoftDeleted();
      }
      this.caricamentoIniziale = false;

      // Ascolta cambiamenti di auth (login in altra tab, logout, refresh token)
      sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          this.utente = session.user;
          await this.caricaDatiUtente();
        } else if (event === 'SIGNED_OUT') {
          this.utente = null;
          this.dati = { dataVersion: 2, proprieta: [], banche: [], incassiAffitti: [], utenze: [] };
        }
      });

      // Listener connettivita: quando torna online rilanciamo caricaDatiUtente
      // che, grazie al confronto updated_at, ri-pushera la cache se piu recente.
      window.addEventListener('online', () => {
        if (this.utente && this.modalitaOffline) {
          this.caricaDatiUtente();
        }
      });
      window.addEventListener('offline', () => {
        this.modalitaOffline = true;
      });

      // Flush salvataggio pendente prima di chiudere la scheda: evita perdita dati
      // se l'utente refresha mentre il debounce di salva() e ancora in attesa.
      window.addEventListener('beforeunload', (e) => {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
          // Cache eager gia scritta in salva(): qui tentiamo il push rete in modo
          // best-effort. Se fallisce non blocchiamo la chiusura: al prossimo load
          // il conflict resolution ripushera la cache piu recente.
          try { this.salvaSubito(); } catch(_) {}
          if (this.statoSalvataggio === 'salvataggio') {
            e.preventDefault();
            e.returnValue = '';
          }
        }
      });
    },

    /** Filtra un array escludendo gli elementi soft-deleted (deletedAt valorizzato).
     *  Centralizza il filtro per i read site: tutti gli iteratori/find/filter su
     *  proprieta + incassiAffitti devono passare per qui. */
    attivi(arr) {
      if (!Array.isArray(arr)) return [];
      return arr.filter(x => !x.deletedAt);
    },

    // --- Cestino ---
    /** Lista unificata di item soft-deleted (proprieta + incassi) per il Cestino. */
    cestinoItems() {
      const out = [];
      const props = Array.isArray(this.dati.proprieta) ? this.dati.proprieta : [];
      const incs = Array.isArray(this.dati.incassiAffitti) ? this.dati.incassiAffitti : [];
      for (const p of props) {
        if (p.deletedAt) out.push({ id: p.id, tipo: 'Proprieta', nome: p.nome || '(senza nome)', deletedAt: p.deletedAt });
      }
      for (const i of incs) {
        if (i.deletedAt) {
          const propNome = this.nomeProprieta(i.proprietaId);
          const label = (i.mese || '') + ' - ' + propNome;
          out.push({ id: i.id, tipo: 'Incasso', nome: label, deletedAt: i.deletedAt });
        }
      }
      return out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    },
    relativeTime(iso) {
      if (!iso) return '';
      const diff = Date.now() - new Date(iso).getTime();
      const m = Math.floor(diff / 60000);
      if (m < 1) return 'pochi secondi fa';
      if (m < 60) return m + (m === 1 ? ' minuto fa' : ' minuti fa');
      const h = Math.floor(m / 60);
      if (h < 24) return h + (h === 1 ? ' ora fa' : ' ore fa');
      const g = Math.floor(h / 24);
      return g + (g === 1 ? ' giorno fa' : ' giorni fa');
    },
    ripristina(item) {
      if (item.tipo === 'Proprieta') {
        const p = this.dati.proprieta.find(x => x.id === item.id);
        if (!p) return;
        const stamp = p.deletedAt;
        p.deletedAt = null;
        // Cascading: ripristina solo gli incassi cancellati nello STESSO burst
        // (timestamp identico). Incassi cancellati separatamente restano in cestino.
        for (const i of this.dati.incassiAffitti) {
          if (i.proprietaId === item.id && i.deletedAt === stamp) i.deletedAt = null;
        }
      } else {
        const i = this.dati.incassiAffitti.find(x => x.id === item.id);
        if (i) i.deletedAt = null;
      }
      this.salva();
    },
    eliminaDefinitivamente(item) {
      if (!confirm('Eliminare definitivamente "' + (item.nome || '') + '"? L\'azione non e reversibile.')) return;
      if (item.tipo === 'Proprieta') {
        // Cascading hard-delete sugli incassi figli (anche quelli soft-deleted
        // separatamente). Orfani sono peggio della perdita.
        this.dati.proprieta = this.dati.proprieta.filter(p => p.id !== item.id);
        this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => i.proprietaId !== item.id);
      } else {
        this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => i.id !== item.id);
      }
      this.salva();
    },
    /** Hard-rimuove i soft-deleted con deletedAt < now-30gg.
     *  Idempotente: una seconda chiamata immediata non rimuove nulla.
     *  Log su console + entry in errori[] severity:info per visibilita. */
    purgeOldSoftDeleted() {
      try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        let purged = 0;
        if (Array.isArray(this.dati.proprieta)) {
          const propsToPurge = this.dati.proprieta.filter(p => p.deletedAt && p.deletedAt < cutoff).map(p => p.id);
          if (propsToPurge.length > 0) {
            this.dati.proprieta = this.dati.proprieta.filter(p => !propsToPurge.includes(p.id));
            // Cascading hard-delete sugli incassi figli (anche non-30gg, perche la proprieta non c'e piu).
            if (Array.isArray(this.dati.incassiAffitti)) {
              this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => !propsToPurge.includes(i.proprietaId));
            }
            purged += propsToPurge.length;
          }
        }
        if (Array.isArray(this.dati.incassiAffitti)) {
          const before = this.dati.incassiAffitti.length;
          this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => !(i.deletedAt && i.deletedAt < cutoff));
          purged += before - this.dati.incassiAffitti.length;
        }
        if (purged > 0) {
          console.info('[purge] Auto-rimossi ' + purged + ' elementi soft-deleted >30 giorni');
          this.pushErrore({ message: 'auto-purge: rimossi ' + purged + ' elementi soft-deleted >30gg', severity: 'info' });
          this.salva();
        }
      } catch (e) {
        this.pushErrore({ message: 'purgeOldSoftDeleted: ' + (e && e.message), severity: 'warn' });
      }
    },

    // --- Snapshot ring buffer (10 stati pre-mutation) ---
    pushSnapshot(preState) {
      if (!preState) return;
      try {
        const raw = localStorage.getItem('gestione_affitti_snapshots');
        const arr = raw ? JSON.parse(raw) : [];
        const lista = Array.isArray(arr) ? arr : [];
        lista.push({ ts: new Date().toISOString(), dati: preState });
        while (lista.length > 10) lista.shift();
        localStorage.setItem('gestione_affitti_snapshots', JSON.stringify(lista));
        // Notifica Alpine: bump del version counter forza re-eval di snapshots()
        // nei template (x-for, x-if). Senza questo, la UI ignora le scritture
        // a localStorage.
        this._snapshotVersion = (this._snapshotVersion || 0) + 1;
      } catch (e) {
        // QuotaExceededError o JSON troppo grande: log non-fatale.
        this.pushErrore({ message: 'pushSnapshot: ' + (e && e.message), severity: 'warn' });
      }
    },
    snapshots() {
      // Touch reactive counter so Alpine ri-runs questo getter al bump in pushSnapshot.
      void this._snapshotVersion;
      try {
        const raw = localStorage.getItem('gestione_affitti_snapshots');
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.slice().reverse() : [];
      } catch (_) { return []; }
    },
    snapshotDiff(snap) {
      const safeLen = (arr) => Array.isArray(arr) ? arr.filter(x => !x.deletedAt).length : 0;
      const curr = {
        proprieta: safeLen(this.dati.proprieta),
        incassiAffitti: safeLen(this.dati.incassiAffitti),
        utenze: safeLen(this.dati.utenze),
      };
      const past = snap && snap.dati ? {
        proprieta: safeLen(snap.dati.proprieta),
        incassiAffitti: safeLen(snap.dati.incassiAffitti),
        utenze: safeLen(snap.dati.utenze),
      } : { proprieta: 0, incassiAffitti: 0, utenze: 0 };
      return {
        proprieta: past.proprieta - curr.proprieta,
        incassiAffitti: past.incassiAffitti - curr.incassiAffitti,
        utenze: past.utenze - curr.utenze,
      };
    },
    formatDiff(d) {
      const parts = [];
      for (const k of ['proprieta', 'incassiAffitti', 'utenze']) {
        const v = d[k] || 0;
        const sign = v > 0 ? '+' : '';
        const lbl = k === 'incassiAffitti' ? 'Incassi' : (k === 'proprieta' ? 'Proprieta' : 'Utenze');
        parts.push(lbl + ' ' + sign + v);
      }
      return parts.join(', ');
    },
    // --- Salute dati ---
    saluteDati() {
      const props = Array.isArray(this.dati.proprieta) ? this.dati.proprieta : [];
      const incs = Array.isArray(this.dati.incassiAffitti) ? this.dati.incassiAffitti : [];
      const utz = Array.isArray(this.dati.utenze) ? this.dati.utenze : [];
      const propAttiveIds = new Set(props.filter(p => !p.deletedAt).map(p => p.id));
      const incassiAttivi = incs.filter(i => !i.deletedAt);
      let ultimoSync = null;
      try {
        const raw = localStorage.getItem('gestione_affitti_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.updated_at) {
            ultimoSync = new Date(parsed.updated_at).toLocaleString('it-IT');
          }
        }
      } catch (_) {}
      let dimensioneBlobKB = 0;
      try {
        dimensioneBlobKB = Math.round((JSON.stringify(this.dati).length / 1024) * 10) / 10;
      } catch (_) {}
      return {
        proprietaAttive: props.filter(p => !p.deletedAt).length,
        proprietaCestinate: props.filter(p => p.deletedAt).length,
        incassiAttivi: incassiAttivi.length,
        incassiCestinati: incs.filter(i => i.deletedAt).length,
        incassiOrfani: incassiAttivi.filter(i => !propAttiveIds.has(i.proprietaId)).length,
        incassiZero: incassiAttivi.filter(i => !(i.importo > 0)).length,
        utenzeZero: utz.filter(u => !(u.importo > 0)).length,
        ultimoSync,
        dimensioneBlobKB,
      };
    },
    async aggiornaStoragePct() {
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          if (est && est.quota) {
            this.storagePctValue = Math.round(((est.usage || 0) / est.quota) * 100);
            return;
          }
        }
        this.storagePctValue = null;
      } catch (_) {
        this.storagePctValue = null;
      }
    },
    errori() {
      try {
        const raw = localStorage.getItem('errori');
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (_) { return []; }
    },
    inviaDiagnostica() {
      if (!this.supportWhatsapp) return;
      const ultimi = this.errori().slice(-50);
      const lines = ultimi.map(e => '[' + (e.ts || '') + '] ' + (e.message || ''));
      let body = 'Diagnostica gestione-affitti\n\n' + lines.join('\n');
      if (body.length > 3500) body = body.slice(-3500);
      const url = 'https://wa.me/' + encodeURIComponent(this.supportWhatsapp) + '?text=' + encodeURIComponent(body);
      window.open(url, '_blank', 'noopener,noreferrer');
    },

    ripristinaSnapshot(snap) {
      if (!snap || !snap.dati) return;
      if (!confirm('Ripristinare lo snapshot del ' + new Date(snap.ts).toLocaleString('it-IT') + '?\n\nLo stato attuale sara sovrascritto, INCLUSO il cestino.')) return;
      this.dati = migraDati(JSON.parse(JSON.stringify(snap.dati)));
      this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));
      this.salva();
    },

    svuotaCestino() {
      const items = this.cestinoItems();
      if (items.length === 0) return;
      if (!confirm('Svuotare il cestino? ' + items.length + ' elementi saranno eliminati definitivamente.')) return;
      // Identifica le proprieta cestinate per fare cascading hard-delete dei loro incassi.
      const propIdsCestinate = this.dati.proprieta.filter(p => p.deletedAt).map(p => p.id);
      this.dati.proprieta = this.dati.proprieta.filter(p => !p.deletedAt);
      this.dati.incassiAffitti = this.dati.incassiAffitti.filter(i => !i.deletedAt && !propIdsCestinate.includes(i.proprietaId));
      this.salva();
    },

    // --- Soft-confirm modal Alpine (rimpiazza confirm() per importo=0) ---
    softConfirm: { active: false, message: '', onConfirm: null, onCancel: null },
    chiediConferma(message) {
      return new Promise((resolve) => {
        this.softConfirm.active = true;
        this.softConfirm.message = message;
        this.softConfirm.onConfirm = () => {
          this.softConfirm.active = false;
          this.softConfirm.onConfirm = null;
          this.softConfirm.onCancel = null;
          resolve(true);
        };
        this.softConfirm.onCancel = () => {
          this.softConfirm.active = false;
          this.softConfirm.onConfirm = null;
          this.softConfirm.onCancel = null;
          resolve(false);
        };
      });
    },

    // --- Toast generico (warn/info/success/error) — slot singolo, replace-on-new ---
    toast: { active: false, type: 'info', message: '', timerId: null },
    mostraToast(type, message, durata = 4000) {
      if (this.toast.timerId) clearTimeout(this.toast.timerId);
      this.toast.active = true;
      this.toast.type = type;
      this.toast.message = message;
      this.toast.timerId = setTimeout(() => {
        this.toast.active = false;
        this.toast.timerId = null;
      }, durata);
    },
    dismissGenericToast() {
      if (this.toast.timerId) clearTimeout(this.toast.timerId);
      this.toast.active = false;
      this.toast.timerId = null;
    },

    supportWhatsapp: SUPPORT_WHATSAPP,

    // --- Undo toast (5s, stack model: il nuovo rimpiazza il precedente) ---
    undoToast: { active: false, message: '', undoFn: null, timerId: null, expiresAt: 0 },
    mostraUndoToast(message, undoFn) {
      if (this.undoToast.timerId) clearTimeout(this.undoToast.timerId);
      this.undoToast.active = true;
      this.undoToast.message = message;
      this.undoToast.undoFn = typeof undoFn === 'function' ? undoFn : null;
      this.undoToast.expiresAt = Date.now() + 5000;
      this.undoToast.timerId = setTimeout(() => {
        this.undoToast.active = false;
        this.undoToast.undoFn = null;
        this.undoToast.timerId = null;
      }, 5000);
    },
    eseguiUndo() {
      const fn = this.undoToast.undoFn;
      if (this.undoToast.timerId) clearTimeout(this.undoToast.timerId);
      this.undoToast.active = false;
      this.undoToast.undoFn = null;
      this.undoToast.timerId = null;
      if (fn) try { fn(); } catch (e) { this.pushErrore({ message: 'undo: ' + (e && e.message), severity: 'error' }); }
    },
    dismissToast() {
      if (this.undoToast.timerId) clearTimeout(this.undoToast.timerId);
      this.undoToast.active = false;
      this.undoToast.undoFn = null;
      this.undoToast.timerId = null;
    },

    // --- PWA install prompt helpers (PR2a REQ-PWA-03) ---
    // localStorage keys:
    //   gestione_affitti_session_log              ISO[] (rolling 7d)
    //   gestione_affitti_install_dismissed_until  ISO date (banner hidden until)
    //   gestione_affitti_installed                "1" se appinstalled fired
    recordSession() {
      try {
        const raw = localStorage.getItem('gestione_affitti_session_log');
        const arr = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(arr) ? arr : [];
        const now = new Date();
        const cutoffIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const SESSION_GAP_MS = 30 * 60 * 1000;
        const last = list.length ? new Date(list[list.length - 1]).getTime() : 0;
        if (now.getTime() - last > SESSION_GAP_MS) list.push(now.toISOString());
        const pruned = list.filter((iso) => iso >= cutoffIso);
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
        if (!Array.isArray(arr) || arr.length < 3) return;
        // Chrome/Android: serve beforeinstallprompt catturato.
        // iOS Safari: nessun evento ma mostriamo comunque le istruzioni Condividi.
        if (!this._isIosSafari && !this._deferredInstallPrompt) return;
        this.installPromptVisible = true;
      } catch (_) {}
    },
    async installApp() {
      if (this._isIosSafari) return; // iOS: il banner mostra solo istruzioni
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
        const INSTALL_DISMISS_DAYS = 14;
        const until = new Date(Date.now() + INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem('gestione_affitti_install_dismissed_until', until);
      } catch (_) {}
      this.installPromptVisible = false;
    },

    /** Aggiunge un'entry al ring buffer FIFO di 50 errori in localStorage.errori.
     *  Mai re-throwa: solo log + storage. Filtra implicitamente i campi: niente PII. */
    pushErrore(entry) {
      try {
        const raw = localStorage.getItem('errori');
        const arr = raw ? JSON.parse(raw) : [];
        const lista = Array.isArray(arr) ? arr : [];
        lista.push({
          ts: entry && entry.ts ? entry.ts : new Date().toISOString(),
          message: entry && entry.message ? String(entry.message).slice(0, 500) : '',
          stack: entry && entry.stack ? String(entry.stack).slice(0, 1000) : null,
          url: entry && entry.url ? String(entry.url).slice(0, 300) : null,
          line: entry && typeof entry.line === 'number' ? entry.line : null,
          severity: entry && entry.severity ? entry.severity : 'error',
        });
        while (lista.length > 50) lista.shift();
        localStorage.setItem('errori', JSON.stringify(lista));
      } catch (_) {
        // Quota piena o storage non disponibile: silenzioso (non vogliamo loop di errori).
      }
    },

    // --- Autenticazione ---
    async eseguiLogin() {
      this.authLoading = true; this.authError = ''; this.authInfo = '';
      try {
        const { data, error } = await sb.auth.signInWithPassword({
          email: this.authEmail.trim(),
          password: this.authPassword
        });
        if (error) throw error;
        this.utente = data.user;
        this.authPassword = '';
        await this.caricaDatiUtente();
      } catch(e) {
        this.authError = this.traduciErroreAuth(e.message);
      } finally {
        this.authLoading = false;
      }
    },

    async eseguiSignup() {
      this.authLoading = true; this.authError = ''; this.authInfo = '';
      try {
        const { data, error } = await sb.auth.signUp({
          email: this.authEmail.trim(),
          password: this.authPassword
        });
        if (error) throw error;
        // Se Supabase richiede conferma email, session e null
        if (!data.session) {
          this.authInfo = 'Ti abbiamo inviato una email di conferma. Clicca il link per attivare l\'account, poi torna qui per accedere.';
          this.modalitaAuth = 'login';
        } else {
          // Altrimenti login automatico
          this.utente = data.user;
          this.authPassword = '';
          await this.caricaDatiUtente();
        }
      } catch(e) {
        this.authError = this.traduciErroreAuth(e.message);
      } finally {
        this.authLoading = false;
      }
    },

    async eseguiLogout() {
      await sb.auth.signOut();
      this.utente = null;
      this.dati = { proprieta: [], banche: [], incassiAffitti: [], utenze: [] };
      this.authEmail = ''; this.authPassword = '';
    },

    traduciErroreAuth(msg) {
      if (/invalid login credentials/i.test(msg)) return 'Email o password errati.';
      if (/email not confirmed/i.test(msg)) return 'Email non ancora confermata. Controlla la tua casella.';
      if (/user already registered/i.test(msg)) return 'Esiste gia un account con questa email. Prova ad accedere.';
      if (/password should be at least/i.test(msg)) return 'La password deve essere di almeno 6 caratteri.';
      if (/invalid.*email/i.test(msg)) return 'Email non valida.';
      return msg;
    },

    // --- PR2b: hybrid snake↔camel helpers (DEC-OQ-2, plan 05-01 T-05-01-03) ---
    // Layer 1: generic recursive (gestisce ~95% dei campi che seguono pure snake↔camel)
    _snakeToCamel(k) { return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); },
    _camelToSnake(k) { return k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()); },
    adattaShape(obj, conv) {
      if (Array.isArray(obj)) return obj.map(x => this.adattaShape(x, conv));
      if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [conv(k), this.adattaShape(v, conv)])
        );
      }
      return obj;
    },
    fromDb(row) { return this.adattaShape(row, this._snakeToCamel); },
    toDb(obj)   { return this.adattaShape(obj, this._camelToSnake); },
    // Layer 2: per-entity overrides (legacy quirks: proprieta usa bancaIncasso/
    // bancaDestinazione senza Id suffix per UUID FK; schema PR2b ha _id).
    fromDbProprieta(p) {
      if (!p) return p;
      const c = this.fromDb(p);
      c.bancaIncasso = c.bancaIncassoId != null ? c.bancaIncassoId : null;
      c.bancaDestinazione = c.bancaDestinazioneId != null ? c.bancaDestinazioneId : null;
      delete c.bancaIncassoId;
      delete c.bancaDestinazioneId;
      return c;
    },
    toDbProprieta(prop) {
      if (!prop) return prop;
      const { bancaIncasso, bancaDestinazione, ...rest } = prop;
      const snake = this.toDb(rest);
      snake.banca_incasso_id = bancaIncasso || null;
      snake.banca_destinazione_id = bancaDestinazione || null;
      return snake;
    },

    // --- Persistenza su Supabase ---
    async caricaDatiUtente() {
      if (!this.utente) return;
      // PR2b dual-read (DEC-012 Phase 1): prova RPC nuovo schema; se vuoto/errore
      // → fallback al blob legacy. La migrazione blob→entità arriva in plan 05-03.
      if (this.usaNuovoSchema) {
        try {
          const { data, error } = await sb.rpc('get_user_data');
          if (!error && data && Array.isArray(data.proprieta) && data.proprieta.length > 0) {
            this.dati = {
              dataVersion: 3,
              tipiUtenza:     (data.tipi_utenza     || []).map(t => this.fromDb(t)),
              banche:         (data.banche          || []).map(b => this.fromDb(b)),
              proprieta:      (data.proprieta       || []).map(p => this.fromDbProprieta(p)),
              inquilini:      (data.inquilini       || []).map(i => this.fromDb(i)),
              incassiAffitti: (data.incassi_affitti || []).map(i => this.fromDb(i)),
              utenze:         (data.utenze          || []).map(u => this.fromDb(u)),
              cestino: data.cestino || { banche: [], proprieta: [], inquilini: [], incassi_affitti: [], utenze: [] },
            };
            this.lastPullAt = new Date().toISOString();
            this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));
            this.statoSalvataggio = 'salvato';
            this.modalitaOffline = false;
            return;
          }
          // RPC ok ma tabelle vuote → fall through al blob path (Phase 1 dual-read)
        } catch (e) {
          this.pushErrore({
            ts: new Date().toISOString(),
            message: 'rpc get_user_data: ' + (e && e.message ? e.message : 'unknown'),
            severity: 'warn',
          });
          // fall through al blob path
        }
      }

      // ===== LEGACY BLOB PATH (Phase 1 fallback, preservato integro) =====
      this.statoSalvataggio = 'salvataggio';
      let _primingDone = false;
      try {
        const { data, error } = await sb.from('user_data')
          .select('data, updated_at').eq('user_id', this.utente.id).maybeSingle();
        if (error) throw error;

        // Conflict resolution: se la cache locale e piu recente del remoto, ri-pusha.
        let cacheLocale = null;
        try {
          const raw = localStorage.getItem('gestione_affitti_cache');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.user_id === this.utente.id && parsed.data && parsed.updated_at) {
              cacheLocale = parsed;
            }
          }
        } catch(cacheErr) {
          console.warn('Cache locale illeggibile:', cacheErr);
        }

        const remotoUpdatedAt = data && data.updated_at ? data.updated_at : null;
        const cacheEPiuRecente = cacheLocale && (!remotoUpdatedAt || cacheLocale.updated_at > remotoUpdatedAt);

        if (cacheEPiuRecente) {
          // Cache locale vince: ripushiamo su Supabase senza sovrascriverla.
          this.dati = migraDati(cacheLocale.data);
          this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));
          _primingDone = true;
          this.modalitaOffline = false;
          this.generaIncassiAttesi();
          this.resetFormUtenza();
          await this.salvaSubito();
          return;
        }

        if (data && data.data && data.data.proprieta) {
          // Dati esistenti trovati nel DB: applica migrazione se necessario
          const versionePrima = data.data.dataVersion || 0;
          const migrati = migraDati(data.data);
          this.dati = migrati;
          this.modalitaOffline = false;
          if ((migrati.dataVersion || 0) !== versionePrima) {
            await this.salvaSubito();
          }
        } else {
          // Primo accesso: inizializza con dati di esempio e salva
          this.dati = datiEsempio();
          this.modalitaOffline = false;
          await this.salvaSubito();
        }
        this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));
        _primingDone = true;
        this.generaIncassiAttesi();
        this.resetFormUtenza();
        this.statoSalvataggio = 'salvato';
      } catch(e) {
        console.error('Errore caricamento dati:', e);
        // Fallback offline: tenta lettura da cache localStorage
        try {
          const raw = localStorage.getItem('gestione_affitti_cache');
          if (raw) {
            const cache = JSON.parse(raw);
            if (cache && cache.user_id === this.utente.id && cache.data) {
              this.dati = migraDati(cache.data);
              this.modalitaOffline = true;
              this.generaIncassiAttesi();
              this.resetFormUtenza();
              this.statoSalvataggio = 'errore';
              return;
            }
          }
        } catch(cacheErr) {
          console.error('Errore lettura cache offline:', cacheErr);
        }
        this.statoSalvataggio = 'errore';
      } finally {
        // Boot/login priming per snapshot ring: garantisce che la PRIMA salva()
        // successiva abbia un riferimento pre-mutation valido (vedi salva()
        // commento). Idempotente: gia' impostato dai rami felici, ri-eseguito
        // solo se il catch e' caduto senza primare.
        if (!_primingDone && !this._lastSnapshotData) {
          try {
            this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));
          } catch (_) {}
        }
      }
    },

    /** Salvataggio con debounce (300ms) per evitare richieste eccessive.
     *  La cache locale viene scritta SUBITO (non aspetta il debounce) per
     *  proteggere dai refresh mentre il timer e pending. */
    salva() {
      if (!this.utente) return;
      this.statoSalvataggio = 'salvataggio';
      // Snapshot pre-mutation: ogni chiamata a salva() corrisponde a UN'azione
      // utente discreta (eliminaIncasso, salvaBanca, segnaIncassatoOggi, ...).
      // Pushiamo qui (non in salvaSubito) perche' il debounce di 300ms coalescerebbe
      // due azioni rapide consecutive in un solo salvaSubito → perderemmo lo
      // snapshot intermedio (R-J: M-4 originale era directionally right ma
      // posizionarlo nel debounced runner perde stati osservabili dall'utente).
      // SNAP-01 fix (PR2a): defensive re-prime di _lastSnapshotData se ancora
      // null al momento della prima salva() (race tra caricaDatiUtente paths o
      // finally guard non eseguito). Garantisce >=1 setItem('gestione_affitti_snapshots')
      // per ogni utente loggato — chiude il test snapshot.spec un-skipped.
      if (!this._lastSnapshotData) {
        try { this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati)); } catch (_) {}
      }
      if (this._lastSnapshotData) {
        this.pushSnapshot(this._lastSnapshotData);
      }
      // Aggiorna il riferimento "ultimo stato osservato" alla mutazione appena
      // applicata: sara' il pre-state della prossima salva().
      try {
        this._lastSnapshotData = JSON.parse(JSON.stringify(this.dati));
      } catch (_) {}
      try {
        localStorage.setItem('gestione_affitti_cache', JSON.stringify({
          data: this.dati,
          updated_at: new Date().toISOString(),
          user_id: this.utente.id
        }));
      } catch(e) { console.warn('Cache eager fallita:', e); }
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.salvaSubito(), 300);
    },

    /** Salvataggio immediato su Supabase (upsert) */
    async salvaSubito() {
      if (!this.utente) return;
      const ora = new Date().toISOString();
      // Aggiorna sempre la cache locale PRIMA dell'upsert: cosi se la rete
      // cade a meta operazione le modifiche non vanno perse.
      const scriviCache = () => {
        try {
          localStorage.setItem('gestione_affitti_cache', JSON.stringify({
            data: this.dati,
            updated_at: ora,
            user_id: this.utente.id
          }));
        } catch(cacheErr) {
          console.warn('Impossibile aggiornare cache locale:', cacheErr);
        }
      };

      if (this.modalitaOffline) {
        // Gia offline: scrivi solo cache, non tentare la rete.
        scriviCache();
        this.statoSalvataggio = 'offline';
        return;
      }

      // Bug 3 (DEC-020): catch chain a 4 branch invece di un unico mute-all.
      // Ogni branch produce: cache persistente (no data loss) + classificazione
      // visibile all'utente + entry in localStorage.errori per diagnostica.
      const tentativoUpsert = async () => {
        const { error } = await sb.from('user_data').upsert({
          user_id: this.utente.id,
          data: this.dati,
          updated_at: ora,
        });
        if (error) throw error;
      };

      try {
        await tentativoUpsert();
        scriviCache();
        // _lastSnapshotData NON viene aggiornato qui: la salva() chiamante
        // l'ha gia' aggiornato sincronicamente. Aggiornarlo di nuovo qui
        // post-await sovrascriverebbe lo stato di una mutazione utente che
        // potrebbe essere arrivata nei 300ms+network successivi.
        this.modalitaOffline = false;
        this.statoSalvataggio = 'salvato';
      } catch (e) {
        const msg = (e && e.message) || '';
        const code = (e && (e.code || e.status)) || '';
        const isAuthExpired = /jwt expired|invalid jwt|token.*expired/i.test(msg) || code === 401 || code === '401';
        const isRls = /pgrst301|42501|new row violates row-level security|row-level security/i.test(msg) || code === 403 || code === '403';
        const isNetwork = !navigator.onLine || /failed to fetch|network|networkerror/i.test(msg) || (e && e.name === 'TypeError');

        if (isAuthExpired) {
          // Branch A: sessione scaduta → refresh + retry una volta.
          try {
            const { error: refreshErr } = await sb.auth.refreshSession();
            if (refreshErr) throw refreshErr;
            await tentativoUpsert();
            scriviCache();
            this.modalitaOffline = false;
            this.statoSalvataggio = 'salvato';
            return;
          } catch (retryErr) {
            scriviCache();
            this.statoSalvataggio = 'errore';
            this.mostraToast('warn', 'Sessione scaduta. Esegui di nuovo il login per sincronizzare.');
            this.pushErrore({ message: 'auth-expired: ' + ((retryErr && retryErr.message) || msg), severity: 'error' });
            return;
          }
        }

        if (isRls) {
          // Branch B: errore di permessi (RLS) → non riproponibile, log + toast.
          scriviCache();
          this.statoSalvataggio = 'errore';
          this.mostraToast('error', 'Errore di permessi durante il salvataggio.');
          this.pushErrore({ message: 'rls: ' + msg, severity: 'error' });
          return;
        }

        if (isNetwork) {
          // Branch C: rete giu → modalita offline, cache vale come source.
          scriviCache();
          this.modalitaOffline = true;
          this.statoSalvataggio = 'offline';
          this.mostraToast('warn', 'Connessione assente — modifiche salvate localmente.');
          this.pushErrore({ message: 'network: ' + msg, severity: 'warn' });
          return;
        }

        // Branch D: generico → cache + toast + log.
        console.error('Errore salvataggio:', e);
        scriviCache();
        this.modalitaOffline = true;
        this.statoSalvataggio = 'offline';
        this.mostraToast('error', 'Errore inatteso durante il salvataggio.');
        this.pushErrore({ message: 'save: ' + msg, severity: 'error' });
      }
    },

    esportaJSON() {
      const blob = new Blob([JSON.stringify(this.dati, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'dati.json'; a.click();
      URL.revokeObjectURL(a.href);
    },

    async importaJSON(event) {
      const file = event.target.files[0]; if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        // Bug 1 (DEC-020): import deve passare per migraDati altrimenti i JSON
        // esportati con schemi v1/v2 mancano dei campi v3 (deletedAt, modificatoManualmente).
        this.dati = migraDati(parsed);
        this.generaIncassiAttesi();
        await this.salva();
      } catch(e) {
        alert('Errore nel file JSON: ' + e.message);
        if (typeof this.pushErrore === 'function') {
          this.pushErrore({ ts: new Date().toISOString(), message: 'importaJSON: ' + (e && e.message), severity: 'error' });
        }
      }
    },

    // --- Generazione automatica incassi ---
    generaIncassiAttesi() {
      const adesso = new Date();
      const mesi = [meseCorrente()];
      if (adesso.getDate() >= 20) {
        let mm = adesso.getMonth() + 2, yy = adesso.getFullYear();
        if (mm > 12) { mm = 1; yy++; }
        mesi.push(yy + '-' + String(mm).padStart(2, '0'));
      }
      for (const mese of mesi) {
        for (const prop of this.attivi(this.dati.proprieta)) {
          const esistente = this.attivi(this.dati.incassiAffitti).find(i => i.proprietaId === prop.id && i.mese === mese);
          if (esistente) {
            // Aggiorna incassi non ancora incassati con i nuovi dati della proprieta
            // Bug 2 (DEC-020): rispettare modificatoManualmente, altrimenti l'edit
            // utente viene sovrascritto a ogni ri-run di generaIncassiAttesi.
            if (!esistente.dataIncasso && !esistente.modificatoManualmente) {
              esistente.importo = prop.importoAffittoMensile;
              esistente.bancaId = prop.bancaIncasso;
              esistente.dataPrevista = dataPrevist(mese, prop.scadenzaAffitto);
            }
            continue;
          }
          if (prop.importoAffittoMensile > 0) {
            this.dati.incassiAffitti.push({
              id: uid(), proprietaId: prop.id, mese,
              dataPrevista: dataPrevist(mese, prop.scadenzaAffitto),
              dataIncasso: null, importo: prop.importoAffittoMensile,
              bancaId: prop.bancaIncasso, girato: false,
              dataGiro: null, bancaDestinazioneId: null,
              currency: prop.currency || 'EUR',
              deletedAt: null, modificatoManualmente: false,
              note: ''
            });
          }
        }
      }
    },

    // --- Lookup ---
    nomeProprieta(id) { const p = this.dati.proprieta.find(x => x.id === id); return p ? p.nome : '\u2014'; },
    getProprieta(id) { return this.dati.proprieta.find(x => x.id === id) || {}; },
    nomeBanca(id) { const b = this.dati.banche.find(x => x.id === id); return b ? b.nome : ''; },
    labelScadenza(s) { return s === 'fine_mese' ? 'Fine mese' : 'Giorno ' + s; },
    nomeMeseCorrente() { const d = new Date(); return this.nomiMesi[d.getMonth()] + ' ' + d.getFullYear(); },

    // --- Dashboard ---
    incassiMeseCorrente() { const mc = meseCorrente(); return this.attivi(this.dati.incassiAffitti).filter(i => i.mese === mc); },
    totaleIncassatoMese() {
      return this.incassiMeseCorrente().filter(i => i.dataIncasso).reduce((acc, i) => {
        const cur = i.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (i.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },
    totaleDaIncassareMese() {
      return this.incassiMeseCorrente().filter(i => !i.dataIncasso).reduce((acc, i) => {
        const cur = i.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (i.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },
    statoAffittoMese(propId) {
      const inc = this.attivi(this.dati.incassiAffitti).find(i => i.proprietaId === propId && i.mese === meseCorrente());
      if (!inc) return '<span class="text-gray-400">\u2014</span>';
      if (inc.dataIncasso) return '<span class="text-green-600" title="Incassato">\u2705</span>';
      if (this.isRitardo(inc)) return '<span class="text-red-500" title="In ritardo">\u26A0\uFE0F</span>';
      return '<span class="text-yellow-500" title="Atteso">\u23F3</span>';
    },
    isRitardo(inc) { return !inc.dataIncasso && inc.dataPrevista < oggi(); },
    totaleDaGirareBanca(bancaId) {
      return this.attivi(this.dati.incassiAffitti).filter(i => i.bancaId === bancaId && i.dataIncasso && !i.girato).reduce((acc, i) => {
        const cur = i.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (i.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },
    totaleDaGirareVersoBanca(bancaDestId) {
      // Somma incassi non girati la cui proprietà ha come bancaDestinazione questa banca
      return this.attivi(this.dati.incassiAffitti).filter(i => {
        if (!i.dataIncasso || i.girato) return false;
        const prop = this.attivi(this.dati.proprieta).find(p => p.id === i.proprietaId);
        return prop && prop.bancaDestinazione === bancaDestId;
      }).reduce((acc, i) => {
        const cur = i.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (i.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },
    utenzeInScadenza() {
      const lim = new Date(); lim.setDate(lim.getDate() + 30);
      const limISO = lim.toISOString().split('T')[0], oggiISO = oggi();
      return this.dati.utenze
        .filter(u => u.dataScadenza && u.dataScadenza >= oggiISO && u.dataScadenza <= limISO && u.stato !== 'pagata' && u.stato !== 'rimborsata_inquilino')
        .sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza));
    },
    badgeStatoUtenza(stato) {
      const m = {
        'da_ricevere': '<span class="px-1.5 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-600">Da ricevere</span>',
        'ricevuta': '<span class="px-1.5 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">Ricevuta</span>',
        'pagata': '<span class="px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">Pagata</span>',
        'rimborsata_inquilino': '<span class="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">Rimborsata</span>'
      };
      return m[stato] || stato;
    },

    // --- Calendario ---
    gruppiCalendario() {
      const mese = this.annoCalendario + '-' + String(this.meseCalendario + 1).padStart(2, '0');
      // UNDO-01 fix (PR2a): inline filter su this.dati.* invece di passare per
      // this.attivi(). Alpine perde reactivity attraverso il wrapper helper:
      // l'undo di un soft-delete non aggiornava le card finche' non si cambiava
      // mese. L'inline access ripristina il tracking.
      const incM = (this.dati.incassiAffitti || []).filter(i => !i.deletedAt && i.mese === mese);
      const g1 = { label: 'Giorno 1', incassi: [], mancanti: [] };
      const g15 = { label: 'Giorno 15', incassi: [], mancanti: [] };
      const gfine = { label: 'Fine mese', incassi: [], mancanti: [] };
      const bucket = (s) => s === '1' ? g1 : (s === '15' ? g15 : gfine);
      const orfani = [];
      for (const inc of incM) {
        const prop = (this.dati.proprieta || []).find(p => !p.deletedAt && p.id === inc.proprietaId);
        if (!prop) { orfani.push(inc); continue; }
        bucket(prop.scadenzaAffitto).incassi.push(inc);
      }
      // Proprietà esistenti senza incasso per il mese (di solito perché importo mensile = 0)
      for (const prop of (this.dati.proprieta || []).filter(p => !p.deletedAt)) {
        const ha = incM.some(i => i.proprietaId === prop.id);
        if (!ha) bucket(prop.scadenzaAffitto).mancanti.push(prop);
      }
      const gruppi = [g1, g15, gfine];
      if (orfani.length > 0) gruppi.push({ label: '⚠ Incassi orfani (proprieta cancellata)', incassi: orfani, mancanti: [] });
      return gruppi;
    },
    segnaIncassatoOggi(inc) { inc.dataIncasso = oggi(); this.salva(); },

    /** Apre il modal di modifica incasso con data precompilata a oggi ma editabile.
     *  Utile per popolare lo storico: l'utente digita la data reale dell'incasso. */
    incassaConData(inc) {
      this.incassoInModifica = { ...inc, dataIncasso: inc.dataIncasso || oggi() };
    },

    // Genera incassi mancanti per il mese attualmente visualizzato nel calendario
    // (utile per mesi passati o futuri non ancora auto-generati)
    generaIncassiMeseVisualizzato() {
      const mese = this.annoCalendario + '-' + String(this.meseCalendario + 1).padStart(2, '0');
      let creati = 0;
      const saltate = [];
      for (const prop of this.attivi(this.dati.proprieta)) {
        const esiste = this.attivi(this.dati.incassiAffitti).some(i => i.proprietaId === prop.id && i.mese === mese);
        if (esiste) continue;
        if (!(prop.importoAffittoMensile > 0)) { saltate.push(prop.nome); continue; }
        this.dati.incassiAffitti.push({
          id: uid(), proprietaId: prop.id, mese,
          dataPrevista: dataPrevist(mese, prop.scadenzaAffitto),
          dataIncasso: null, importo: prop.importoAffittoMensile,
          bancaId: prop.bancaIncasso, girato: false,
          dataGiro: null, bancaDestinazioneId: null,
          currency: prop.currency || 'EUR',
          deletedAt: null, modificatoManualmente: false,
          note: ''
        });
        creati++;
      }
      let msg = '';
      if (creati > 0) { msg += 'Creati ' + creati + ' incassi per ' + mese + '.'; this.salva(); }
      if (saltate.length > 0) {
        msg += (msg ? '\n\n' : '') + '⚠ ' + saltate.length + ' proprieta saltate (importo mensile = 0):\n• ' + saltate.join('\n• ') + '\n\nImposta un importo > 0 per generare gli incassi.';
      }
      if (!msg) msg = 'Nessuna proprieta da generare: tutto gia presente per ' + mese + '.';
      alert(msg);
    },

    // Modifica incasso esistente tramite modal
    apriFormIncasso(inc) { this.incassoInModifica = { ...inc }; },
    async salvaIncassoModificato() {
      if (!this.incassoInModifica) return;
      // Importo=0 soft-confirm (rimpiazza l'antico confirm() nativo).
      if (!(this.incassoInModifica.importo > 0)) {
        const ok = await this.chiediConferma('L\'importo dell\'incasso e 0. Confermi il salvataggio?');
        if (!ok) return;
      }
      // Banca-missing warn non bloccante.
      if (!this.incassoInModifica.bancaId) {
        this.mostraToast('warn', 'Nessuna banca selezionata: l\'incasso non sara conteggiato nei totali per banca.');
      }
      // Currency-mismatch warn non bloccante (banche[].currency esiste gia, R-G risolto).
      const banca = this.dati.banche.find(b => b.id === this.incassoInModifica.bancaId);
      if (banca && this.incassoInModifica.currency && (banca.currency || 'EUR') !== this.incassoInModifica.currency) {
        this.mostraToast('warn', 'Valuta incasso (' + this.incassoInModifica.currency + ') diversa dalla banca (' + (banca.currency || 'EUR') + ').');
      }
      // Cerca solo fra gli incassi attivi: un incasso soft-deleted non deve essere modificabile.
      const idx = this.dati.incassiAffitti.findIndex(i => i.id === this.incassoInModifica.id && !i.deletedAt);
      if (idx >= 0) {
        // Se dataIncasso e stringa vuota, convertila in null
        if (this.incassoInModifica.dataIncasso === '') this.incassoInModifica.dataIncasso = null;
        // Bug 2 (DEC-020): marca come modificato manualmente se cambiano importo/banca/dataPrevista,
        // cosi generaIncassiAttesi non sovrascrivera l'edit al prossimo run.
        const orig = this.dati.incassiAffitti[idx];
        const cambiato =
          orig.importo !== this.incassoInModifica.importo ||
          orig.bancaId !== this.incassoInModifica.bancaId ||
          orig.dataPrevista !== this.incassoInModifica.dataPrevista;
        this.dati.incassiAffitti[idx] = {
          ...this.incassoInModifica,
          modificatoManualmente: orig.modificatoManualmente || cambiato,
        };
        this.salva();
      }
      this.incassoInModifica = null;
    },
    eliminaIncasso(id) {
      const inc = this.dati.incassiAffitti.find(i => i.id === id);
      if (!inc) return;
      const oldDeletedAt = inc.deletedAt;
      inc.deletedAt = new Date().toISOString();
      this.salva();
      this.mostraUndoToast('Incasso eliminato', () => {
        inc.deletedAt = oldDeletedAt;
        this.salva();
      });
    },

    // --- Proprieta dettaglio ---
    apriProprieta(id) { this.proprietaSelezionata = id; this.vistaCorrente = 'proprieta'; },
    anniDisponibili() { const a = new Date().getFullYear(); return [a - 2, a - 1, a, a + 1]; },
    storicoIncassiProprieta(propId, anno) {
      return this.attivi(this.dati.incassiAffitti).filter(i => i.proprietaId === propId && i.mese.startsWith(String(anno)))
        .sort((a, b) => b.dataPrevista.localeCompare(a.dataPrevista));
    },
    totaleIncassiAnno(propId, anno) {
      return this.storicoIncassiProprieta(propId, anno).filter(i => i.dataIncasso).reduce((acc, i) => {
        const cur = i.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (i.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },
    storicoUtenzeProprieta(propId, anno) {
      return this.dati.utenze.filter(u => u.proprietaId === propId && u.dataScadenza && u.dataScadenza.startsWith(String(anno)))
        .sort((a, b) => b.dataScadenza.localeCompare(a.dataScadenza));
    },
    totaleUtenzeAnno(propId, anno) {
      return this.storicoUtenzeProprieta(propId, anno).reduce((acc, u) => {
        const cur = u.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (u.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },

    // --- Movimenti banca ---
    incassiBancaMese(bancaId) {
      return this.attivi(this.dati.incassiAffitti).filter(i => i.bancaId === bancaId && i.mese === this.meseBanca)
        .sort((a, b) => (a.dataPrevista || '').localeCompare(b.dataPrevista || ''));
    },
    totaleIncassatoBancaMese(bancaId) {
      return this.incassiBancaMese(bancaId).filter(i => i.dataIncasso).reduce((acc, i) => {
        const cur = i.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (i.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },
    totaleDaGirareBancaMese(bancaId) {
      return this.incassiBancaMese(bancaId).filter(i => i.dataIncasso && !i.girato).reduce((acc, i) => {
        const cur = i.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (i.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },
    segnaGirato(inc, bancaDestId) {
      if (!bancaDestId) return;
      const bancaOrig = this.dati.banche.find(b => b.id === inc.bancaId);
      const bancaDest = this.dati.banche.find(b => b.id === bancaDestId);
      if (bancaOrig && bancaDest && (bancaOrig.currency || 'EUR') !== (bancaDest.currency || 'EUR')) {
        alert('Impossibile girare fondi tra banche con valute diverse.');
        return;
      }
      inc.girato = true; inc.dataGiro = oggi(); inc.bancaDestinazioneId = bancaDestId; this.salva();
    },

    // --- Utenze ---
    resetFormUtenza() {
      const propAttive = this.attivi(this.dati.proprieta);
      this.nuovaUtenza = {
        proprietaId: propAttive.length > 0 ? propAttive[0].id : '',
        tipo: 'acqua', fornitore: '', periodoRiferimento: '',
        dataScadenza: '', importo: 0, stato: 'da_ricevere', currency: 'EUR', note: ''
      };
    },
    utenzeFiltrate() {
      return this.dati.utenze.filter(u => {
        if (this.filtroUtenzeProprieta && u.proprietaId !== this.filtroUtenzeProprieta) return false;
        if (this.filtroUtenzeTipo && u.tipo !== this.filtroUtenzeTipo) return false;
        if (this.filtroUtenzeStato && u.stato !== this.filtroUtenzeStato) return false;
        if (this.filtroUtenzeAnno && u.dataScadenza && !u.dataScadenza.startsWith(String(this.filtroUtenzeAnno))) return false;
        return true;
      }).sort((a, b) => (b.dataScadenza || '').localeCompare(a.dataScadenza || ''));
    },
    totaleUtenzeFiltrate() {
      return this.utenzeFiltrate().reduce((acc, u) => {
        const cur = u.currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (u.importo || 0);
        return acc;
      }, { EUR: 0, USD: 0 });
    },
    aggiungiUtenza() {
      const prop = this.attivi(this.dati.proprieta).find(p => p.id === this.nuovaUtenza.proprietaId);
      const currency = this.nuovaUtenza.currency || (prop && prop.currency) || 'EUR';
      this.dati.utenze.push({ id: uid(), ...this.nuovaUtenza, currency });
      this.mostraFormUtenza = false; this.resetFormUtenza(); this.salva();
    },
    cambiaStatoUtenza(u, stato) {
      if (!stato) return; u.stato = stato;
      if (stato === 'pagata') u.dataPagamento = oggi();
      this.salva();
    },
    eliminaUtenza(id) {
      const idx = this.dati.utenze.findIndex(u => u.id === id);
      if (idx < 0) return;
      // Utenze non hanno tombstone in PR1: deep-clone + splice, undo pusha indietro.
      const snap = JSON.parse(JSON.stringify(this.dati.utenze[idx]));
      this.dati.utenze.splice(idx, 1);
      this.salva();
      this.mostraUndoToast('Utenza eliminata', () => {
        this.dati.utenze.push(snap);
        this.salva();
      });
    },

    // --- Impostazioni: Proprieta ---
    creaProprieta() {
      return { id: null, nome: '', tipo: 'appartamento', scadenzaAffitto: '1',
        importoAffittoMensile: 0, bancaIncasso: '', intestatario: '', bancaDestinazione: '',
        currency: 'EUR', deletedAt: null, note: '' };
    },
    modificaProprieta(p) { this.editProprieta = { ...p }; this.mostraFormProprieta = true; },
    async salvaProprieta() {
      if (!this.editProprieta.nome) return alert('Inserire il nome');
      // Soft-confirm modal Alpine (rimpiazza confirm() nativo per coerenza UX con incasso).
      if (!(this.editProprieta.importoAffittoMensile > 0)) {
        const ok = await this.chiediConferma('Attenzione: importo mensile = ' + (this.editProprieta.importoAffittoMensile || 0) + '. La proprieta NON apparira come incasso sul calendario. Salvare comunque?');
        if (!ok) return;
      }
      // Currency-mismatch: degradato a toast warn non bloccante (coerenza con incasso).
      const valutaProp = this.editProprieta.currency || 'EUR';
      const bancaIncasso = this.dati.banche.find(b => b.id === this.editProprieta.bancaIncasso);
      const bancaDest = this.dati.banche.find(b => b.id === this.editProprieta.bancaDestinazione);
      const conflitti = [];
      if (bancaIncasso && (bancaIncasso.currency || 'EUR') !== valutaProp) {
        conflitti.push('banca di incasso "' + bancaIncasso.nome + '" (' + (bancaIncasso.currency || 'EUR') + ')');
      }
      if (bancaDest && (bancaDest.currency || 'EUR') !== valutaProp) {
        conflitti.push('banca di destinazione "' + bancaDest.nome + '" (' + (bancaDest.currency || 'EUR') + ')');
      }
      if (conflitti.length > 0) {
        this.mostraToast('warn', 'Valuta proprieta (' + valutaProp + ') diversa da ' + conflitti.join(' e ') + '.');
      }
      if (this.editProprieta.id) {
        const idx = this.dati.proprieta.findIndex(p => p.id === this.editProprieta.id && !p.deletedAt);
        if (idx >= 0) this.dati.proprieta[idx] = { ...this.editProprieta };
      } else { this.editProprieta.id = uid(); this.dati.proprieta.push({ ...this.editProprieta }); }
      this.mostraFormProprieta = false; this.generaIncassiAttesi(); this.salva();
    },
    eliminaProprieta(id) {
      const p = this.dati.proprieta.find(x => x.id === id);
      if (!p) return;
      const ora = new Date().toISOString();
      // Cascading soft-delete sugli incassi attivi (utenze restano linkate via proprietaId
      // e ricompaiono naturalmente al restore della proprieta — niente tombstone in PR1).
      const incassiToccati = this.attivi(this.dati.incassiAffitti).filter(i => i.proprietaId === id);
      const preState = {
        propPrev: p.deletedAt,
        incassi: incassiToccati.map(i => ({ id: i.id, deletedAt: i.deletedAt })),
      };
      p.deletedAt = ora;
      for (const i of incassiToccati) i.deletedAt = ora;
      this.salva();
      this.mostraUndoToast('Proprieta eliminata', () => {
        p.deletedAt = preState.propPrev;
        for (const ref of preState.incassi) {
          const i = this.dati.incassiAffitti.find(x => x.id === ref.id);
          if (i) i.deletedAt = ref.deletedAt;
        }
        this.salva();
      });
    },

    // --- Impostazioni: Banche ---
    creaBanca() { return { id: null, nome: '', intestatario: '', currency: 'EUR' }; },
    modificaBanca(b) { this.editBanca = { ...b }; this.mostraFormBanca = true; },
    salvaBanca() {
      if (!this.editBanca.nome) return alert('Inserire il nome della banca');
      if (this.editBanca.id) {
        const idx = this.dati.banche.findIndex(b => b.id === this.editBanca.id);
        if (idx >= 0) this.dati.banche[idx] = { ...this.editBanca };
      } else { this.editBanca.id = uid(); this.dati.banche.push({ ...this.editBanca }); }
      this.mostraFormBanca = false; this.salva();
    },
    eliminaBanca(id) {
      const nIncassi = this.attivi(this.dati.incassiAffitti).filter(i => i.bancaId === id || i.bancaDestinazioneId === id).length;
      const nProp = this.attivi(this.dati.proprieta).filter(p => p.bancaIncasso === id || p.bancaDestinazione === id).length;
      if (nIncassi + nProp > 0) {
        this.mostraToast('warn', 'Impossibile eliminare: ' + nProp + ' proprieta e ' + nIncassi + ' incassi usano questa banca.');
        return;
      }
      const idx = this.dati.banche.findIndex(b => b.id === id);
      if (idx < 0) return;
      const snap = JSON.parse(JSON.stringify(this.dati.banche[idx]));
      this.dati.banche.splice(idx, 1);
      this.salva();
      this.mostraUndoToast('Banca eliminata', () => {
        this.dati.banche.push(snap);
        this.salva();
      });
    },

    formatValuta, formatData
  };
}
