/* ===== app.js — SPA Navigation & Shared State ===== */

const App = (() => {
  let currentPage = 'hub';
  const pageInited = { hub: false, lab: false, sim: false, earth: false };

  /* ---------- Navigation ---------- */

  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + id);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const nav = document.getElementById('nav-' + id);
    if (nav) nav.classList.add('active');

    document.getElementById('mobileMenu').classList.add('hidden');
    currentPage = id;
    window.scrollTo(0, 0);

    // Lazy-init each page on first visit
    if (!pageInited[id]) {
      pageInited[id] = true;
      switch (id) {
        case 'lab':
          if (typeof LabReport !== 'undefined') LabReport.init();
          break;
        case 'sim':
          if (typeof Simulator3D !== 'undefined') Simulator3D.init();
          break;
        case 'earth':
          if (typeof EarthLayers !== 'undefined') EarthLayers.init();
          break;
      }
    }

    // Notify modules of page visibility
    if (id === 'sim' && typeof Simulator3D !== 'undefined') Simulator3D.onShow();
    if (id !== 'sim' && typeof Simulator3D !== 'undefined') Simulator3D.onHide();
    if (id === 'earth' && typeof EarthLayers !== 'undefined') EarthLayers.onShow();
    if (id !== 'earth' && typeof EarthLayers !== 'undefined') EarthLayers.onHide();
  }

  function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('hidden');
  }

  /* ---------- Shared State ---------- */

  const state = {
    // Simulator parameters
    sim: {
      current: 0.5,
      windings: 5,
      radius: 0.10,
      bh: 2.5e-5,
      isPowerOn: false,
      storm: false,
      history: [],
      errors: {
        calibration: { enabled: false, offset: 0 },
        noise: { enabled: false, stdDev: 1 },
        placement: { enabled: false, offset: 0 }
      }
    },
    // Lab data
    lab: {
      windings: 5,
      radius: 10, // cm
      rows: [
        { i: 0.5, a: null },
        { i: 1.0, a: null },
        { i: 1.5, a: null },
        { i: 2.0, a: null }
      ]
    },
    // Hub text fields
    hub: {
      brainstorm: '',
      bhValue: '',
      animals: '',
      climate: '',
      tech: '',
      verdict: '',
      reflection: []
    }
  };

  /* ---------- localStorage ---------- */

  function saveState() {
    try {
      localStorage.setItem('tanSim_state', JSON.stringify(state));
    } catch (e) { /* quota exceeded */ }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem('tanSim_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge
        if (parsed.sim) Object.assign(state.sim, parsed.sim);
        if (parsed.lab) Object.assign(state.lab, parsed.lab);
        if (parsed.hub) Object.assign(state.hub, parsed.hub);
        if (parsed.sim && parsed.sim.errors) {
          Object.assign(state.sim.errors, parsed.sim.errors);
        }
        if (parsed.sim && parsed.sim.history) {
          state.sim.history = parsed.sim.history;
        }
        if (parsed.lab && parsed.lab.rows) {
          state.lab.rows = parsed.lab.rows;
        }
      }
    } catch (e) { /* parse error */ }
  }

  /* ---------- Hub localStorage binding ---------- */

  function bindHubFields() {
    const bindings = {
      'hubBrainstorm': 'brainstorm',
      'hubBHValue': 'bhValue',
      'hubAnimals': 'animals',
      'hubClimate': 'climate',
      'hubTech': 'tech',
      'hubVerdict': 'verdict'
    };
    Object.entries(bindings).forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.value = state.hub[key] || '';
      el.addEventListener('input', () => {
        state.hub[key] = el.value;
        saveState();
      });
    });
  }

  /* ---------- Init ---------- */

  function init() {
    loadState();
    bindHubFields();

    // Make nav functions global for onclick handlers
    window.showPage = showPage;
    window.toggleMobileMenu = toggleMobileMenu;
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    showPage,
    toggleMobileMenu,
    state,
    saveState,
    loadState,
    get currentPage() { return currentPage; }
  };
})();
