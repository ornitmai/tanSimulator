/* ===== labReport.js — Lab Data Table & BH Calculation ===== */

const LabReport = (() => {
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    Charts.initLabChart();

    // Bind system parameter changes
    const wEl = document.getElementById('labWindings');
    const rEl = document.getElementById('labRadius');

    if (wEl) {
      wEl.value = App.state.lab.windings;
      wEl.addEventListener('input', () => {
        App.state.lab.windings = parseInt(wEl.value) || 1;
        App.saveState();
        renderTable();
      });
    }
    if (rEl) {
      rEl.value = App.state.lab.radius;
      rEl.addEventListener('input', () => {
        App.state.lab.radius = parseFloat(rEl.value) || 1;
        App.saveState();
        renderTable();
      });
    }

    renderTable();
  }

  function renderTable() {
    const body = document.getElementById('labTableBody');
    if (!body) return;

    const N = App.state.lab.windings;
    const R = App.state.lab.radius / 100; // cm → m
    const rows = App.state.lab.rows;
    const points = [];

    body.innerHTML = '';

    rows.forEach((row, idx) => {
      const angle = parseFloat(row.a);
      const hasAngle = !isNaN(angle) && row.a !== null && row.a !== '';
      const tan = hasAngle ? Math.tan(angle * Math.PI / 180) : 0;
      const bloop = Physics.bLoop(row.i, N, R) * 1e6; // → μT

      if (hasAngle) {
        points.push({ x: bloop, y: tan });
      }

      const tr = document.createElement('tr');
      tr.className = 'border-b hover:bg-blue-50/30 transition';
      tr.innerHTML = `
        <td class="p-3 text-slate-400 text-xs">${idx + 1}</td>
        <td class="p-3">
          <input type="number" step="0.1" min="0" max="5"
            class="w-20 border rounded text-center font-bold bg-white p-1"
            value="${row.i}" data-idx="${idx}" data-field="i">
        </td>
        <td class="p-3">
          <input type="number" step="1" min="0" max="89"
            class="w-20 border rounded text-center font-bold text-blue-700 bg-white p-1"
            value="${hasAngle ? row.a : ''}" data-idx="${idx}" data-field="a"
            placeholder="---">
        </td>
        <td class="p-3 font-mono text-slate-500">${hasAngle ? tan.toFixed(3) : '---'}</td>
        <td class="p-3 font-mono text-blue-600 font-bold">${bloop.toFixed(1)}</td>
        <td class="p-3">
          <button class="text-red-400 hover:text-red-600 text-xs" data-delete="${idx}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      body.appendChild(tr);
    });

    // Bind inputs
    body.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        if (field === 'i') {
          App.state.lab.rows[idx].i = parseFloat(e.target.value) || 0;
        } else {
          const val = e.target.value;
          App.state.lab.rows[idx].a = val === '' ? null : parseFloat(val);
        }
        App.saveState();
        renderTable();
      });
    });

    // Bind delete buttons
    body.querySelectorAll('button[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.delete);
        App.state.lab.rows.splice(idx, 1);
        App.saveState();
        renderTable();
      });
    });

    // Compute slope & B_H
    let slope = null;
    if (points.length >= 2) {
      slope = Physics.slopeThruOrigin(points);
      const bh = Physics.bhFromSlope(slope);

      document.getElementById('labSlopeDisplay').textContent = slope.toFixed(4);
      // slope = tan(θ)/B_loop[μT], so 1/slope = B_H in μT
      document.getElementById('labBHDisplay').innerHTML = bh.toFixed(1) + ' μT';
    } else {
      document.getElementById('labSlopeDisplay').textContent = '---';
      document.getElementById('labBHDisplay').textContent = '--- μT';
    }

    // Update chart
    Charts.updateLabChart(points, slope);

    // Try comparison if sim data exists
    tryComparison(points, slope);
  }

  function tryComparison(labPoints, labSlope) {
    if (!App.state.sim.history || App.state.sim.history.length < 2) return;
    if (!labPoints || labPoints.length < 2 || !labSlope) return;

    const simPoints = App.state.sim.history.map(s => ({
      x: s.b,
      y: s.t
    }));
    const simSlope = Physics.slopeThruOrigin(simPoints);

    Charts.updateComparison(labPoints, labSlope, simPoints, simSlope);
  }

  function addRow() {
    const rows = App.state.lab.rows;
    const lastI = rows.length > 0 ? rows[rows.length - 1].i : 0;
    rows.push({ i: parseFloat((lastI + 0.5).toFixed(1)), a: null });
    App.saveState();
    renderTable();
  }

  function clearAll() {
    App.state.lab.rows = [
      { i: 0.5, a: null },
      { i: 1.0, a: null },
      { i: 1.5, a: null },
      { i: 2.0, a: null }
    ];
    App.saveState();
    renderTable();
  }

  return { init, renderTable, addRow, clearAll };
})();
