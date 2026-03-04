/* ===== earthLayers.js — 2D Earth Cross-Section & Geological Timeline ===== */

const EarthLayers = (() => {
  let initialized = false;

  // Timeline data
  let reversalData = null;
  let currentPolarity = 'normal';

  // Layer data
  const layerInfo = {
    crust: {
      title: 'הקרום (Crust)',
      text: 'השכבה הדקה והמוצקה עליה אנחנו עומדים. כאן נמצאים הסלעים ש"זוכרים" את השדה המגנטי העתיק (פליאומגנטיזם).',
      extra: 'עובי: 5-70 ק"מ. סלעי בזלת בקרקעית האוקיינוס הם "סרט ההקלטה" של היפוכי הקטבים.',
      stats: { 'עובי': '5-70 ק"מ', 'טמפרטורה': '0-870°C', 'מצב צבירה': 'מוצק' }
    },
    mantle: {
      title: 'המעטפת (Mantle)',
      text: 'סלעים חמים וצמיגיים מאוד. היא מעבירה את החום מהליבה החוצה בתהליך של קונבקציה.',
      extra: 'מצב צבירה: מוצק-גמיש. היא פועלת כמבודד חום אדיר.',
      stats: { 'עובי': '2,900 ק"מ', 'טמפרטורה': '870-4,400°C', 'מצב צבירה': 'גמיש-מוצק' }
    },
    outer: {
      title: 'הליבה החיצונית',
      text: 'ברזל וניקל נוזליים המסתחררים בטמפרטורה של 4,000 מעלות. זהו מנוע הדינמו של כדור הארץ!',
      extra: 'כאן נוצר השדה המגנטי (B_H). התנועה הנוזלית כאן היא זו שגורמת להיפוכי הקטבים.',
      stats: { 'עובי': '2,200 ק"מ', 'טמפרטורה': '4,400-6,100°C', 'מצב צבירה': 'נוזלי', 'תפקיד': 'מנוע הדינמו!' }
    },
    inner: {
      title: 'הליבה הפנימית',
      text: 'כדור ברזל מוצק בטמפרטורה של פני השמש. למרות החום, היא מוצקה בגלל הלחץ האדיר שמופעל עליה.',
      extra: 'היא פועלת כמייצב לשדה המגנטי ומונעת ממנו להתהפך בתדירות גבוהה מדי.',
      stats: { 'רדיוס': '1,220 ק"מ', 'טמפרטורה': '~5,400°C', 'מצב צבירה': 'מוצק', 'הרכב': 'ברזל-ניקל' }
    }
  };

  /* ========== INIT ========== */
  function init() {
    if (initialized) return;
    const container = document.getElementById('earth2dContainer');
    if (!container) return;

    initialized = true;

    // Bind layer clicks
    container.querySelectorAll('.layer-circle[data-layer]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = el.dataset.layer;
        if (layerId && layerInfo[layerId]) {
          showLayerInfo(layerId);
          highlightLayer(layerId);
        }
      });
    });

    // Load reversal data
    loadReversals();

    // Build timeline bar
    buildTimelineBar();

    // Bind timeline slider
    const slider = document.getElementById('timelineSlider');
    if (slider) {
      slider.addEventListener('input', onTimelineChange);
    }
  }

  /* ========== LAYER INFO ========== */
  function showLayerInfo(id) {
    const info = layerInfo[id];
    if (!info) return;

    document.getElementById('layerTitle').textContent = info.title;
    document.getElementById('layerText').textContent = info.text;

    const extra = document.getElementById('layerExtra');
    extra.textContent = info.extra;
    extra.classList.remove('hidden');

    const statsEl = document.getElementById('layerStats');
    if (info.stats) {
      statsEl.innerHTML = Object.entries(info.stats).map(([k, v]) =>
        `<div class="p-2 bg-slate-50 rounded-lg border text-center">
          <div class="text-[10px] text-slate-500 font-bold">${k}</div>
          <div class="text-sm font-bold text-slate-800">${v}</div>
        </div>`
      ).join('');
      statsEl.classList.remove('hidden');
    }
  }

  function highlightLayer(id) {
    // Remove previous highlight
    document.querySelectorAll('.layer-circle').forEach(el => {
      el.classList.remove('active-layer');
    });
    // Add highlight to selected
    const el = document.querySelector(`.layer-circle[data-layer="${id}"]`);
    if (el) el.classList.add('active-layer');
  }

  /* ========== FIELD DIRECTION ========== */
  function updateFieldIndicator(strength, reversed) {
    const indicator = document.getElementById('fieldDirectionIndicator');
    if (!indicator) return;

    if (reversed) {
      indicator.classList.add('reversed');
    } else {
      indicator.classList.remove('reversed');
    }

    if (strength < 0.3) {
      indicator.classList.add('weak');
    } else {
      indicator.classList.remove('weak');
    }
  }

  /* ========== TIMELINE ========== */
  async function loadReversals() {
    try {
      const resp = await fetch('assets/data/reversals.json');
      reversalData = await resp.json();
      buildTimelineBar();
    } catch (e) {
      console.warn('Failed to load reversal data:', e);
    }
  }

  function buildTimelineBar() {
    const bar = document.getElementById('timelineBar');
    if (!bar || !reversalData) return;

    bar.innerHTML = '';
    const totalMa = 800;

    const events = reversalData.events;
    let lastEnd = 0;

    events.forEach(ev => {
      if (ev.start > lastEnd) {
        const gap = document.createElement('div');
        gap.style.flex = ((ev.start - lastEnd) / totalMa).toString();
        gap.style.background = '#94a3b8';
        gap.title = `${lastEnd}-${ev.start} Ma (לא ידוע)`;
        bar.appendChild(gap);
      }

      const segment = document.createElement('div');
      const width = (ev.end - ev.start) / totalMa;
      segment.style.flex = width.toString();
      segment.title = `${ev.name}: ${ev.start}-${ev.end} Ma (${ev.polarity})`;

      switch (ev.polarity) {
        case 'normal': segment.style.background = '#2563eb'; break;
        case 'reversed': segment.style.background = '#ef4444'; break;
        default: segment.style.background = '#94a3b8';
      }

      bar.appendChild(segment);
      lastEnd = ev.end;
    });
  }

  function onTimelineChange() {
    const slider = document.getElementById('timelineSlider');
    if (!slider || !reversalData) return;

    const ma = parseFloat(slider.value);
    const infoEl = document.getElementById('timelineInfo');
    const animEl = document.getElementById('reversalAnimation');

    // Find current event
    let event = null;
    for (const ev of reversalData.events) {
      if (ma >= ev.start && ma <= ev.end) {
        event = ev;

        // Check sub-events
        if (ev.subEvents) {
          for (const sub of ev.subEvents) {
            if (ma >= sub.start && ma <= sub.end) {
              event = sub;
              break;
            }
          }
        }
        break;
      }
    }

    if (event) {
      const polarityHe = event.polarity === 'normal' ? 'נורמלי' : event.polarity === 'reversed' ? 'הפוך' : 'מעורב';
      infoEl.textContent = `${ma.toFixed(1)} Ma — ${event.name} (${polarityHe})`;

      // Check if near a reversal boundary
      const isNearReversal = reversalData.events.some(ev => {
        return Math.abs(ma - ev.start) < 0.3 || Math.abs(ma - ev.end) < 0.3;
      });

      if (isNearReversal) {
        animEl.classList.remove('hidden');
        const distToEdge = reversalData.events.reduce((min, ev) => {
          return Math.min(min, Math.abs(ma - ev.start), Math.abs(ma - ev.end));
        }, Infinity);
        const strength = Math.max(0.05, 1 - (1 - distToEdge / 0.3));
        document.getElementById('reversalState').textContent = 'היפוך קטבים בפעולה!';
        document.getElementById('reversalStrength').textContent = (strength * 100).toFixed(0) + '%';
        updateFieldIndicator(strength, event.polarity === 'reversed');
      } else {
        animEl.classList.add('hidden');
        updateFieldIndicator(1.0, event.polarity === 'reversed');
      }

      currentPolarity = event.polarity;
    } else {
      infoEl.textContent = `${ma.toFixed(1)} Ma — לא ידוע`;
      animEl.classList.add('hidden');
      updateFieldIndicator(0.5, false);
    }
  }

  /* ========== LIFECYCLE ========== */
  function onShow() {
    // No animation needed for 2D
  }

  function onHide() {
    // No animation to stop
  }

  return { init, onShow, onHide };
})();
