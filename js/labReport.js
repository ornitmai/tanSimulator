/* ===== labReport.js — Lab Data Table & BH Calculation ===== */

const LabReport = (() => {
  let initialized = false;
  let bhLocked = false; // true after correct answer

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
        resetBHCheck();
        renderTable();
      });
    }
    if (rEl) {
      rEl.value = App.state.lab.radius;
      rEl.addEventListener('input', () => {
        App.state.lab.radius = parseFloat(rEl.value) || 1;
        App.saveState();
        resetBHCheck();
        renderTable();
      });
    }

    // Enter key on current input triggers takeMeasurement
    const currentInput = document.getElementById('labCurrentInput');
    if (currentInput) {
      currentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') takeMeasurement();
      });
    }

    bindBHCheck();
    renderTable();
  }

  function bindBHCheck() {
    const btn = document.getElementById('labBHCheck');
    if (btn) {
      btn.addEventListener('click', checkBH);
    }
    const input = document.getElementById('labBHInput');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkBH();
      });
    }
  }

  function checkBH() {
    if (bhLocked) return;
    const input = document.getElementById('labBHInput');
    const feedback = document.getElementById('labBHFeedback');
    if (!input || !feedback) return;

    const slopeText = document.getElementById('labSlopeDisplay').textContent;
    const slope = parseFloat(slopeText);
    if (!slope || isNaN(slope)) return;

    const correctBH = Physics.bhFromSlope(slope);
    const studentBH = parseFloat(input.value);
    if (isNaN(studentBH) || studentBH <= 0) {
      feedback.textContent = 'הכניסו ערך מספרי חיובי';
      feedback.className = 'mt-2 text-sm font-bold text-amber-400';
      return;
    }

    const error = Math.abs(studentBH - correctBH) / correctBH;
    if (error <= 0.05) {
      // Correct — within ±5%
      feedback.innerHTML = '<i class="fas fa-check-circle"></i> מצוין! B<sub>H</sub> = ' + correctBH.toFixed(1) + ' μT';
      feedback.className = 'mt-2 text-sm font-bold text-green-400';
      input.classList.add('ring-2', 'ring-green-400');
      bhLocked = true;
    } else {
      // Wrong
      const hint = studentBH > correctBH ? 'גבוה מדי' : 'נמוך מדי';
      feedback.innerHTML = hint + ' — רמז: B<sub>H</sub> = 1 / slope';
      feedback.className = 'mt-2 text-sm font-bold text-red-400';
      input.classList.remove('ring-2', 'ring-green-400');
    }
  }

  function resetBHCheck() {
    bhLocked = false;
    const input = document.getElementById('labBHInput');
    const feedback = document.getElementById('labBHFeedback');
    if (input) {
      input.value = '';
      input.classList.remove('ring-2', 'ring-green-400');
    }
    if (feedback) {
      feedback.textContent = '';
    }
  }

  /** Student sets current and clicks "קח מדידה" — adds row with locked I, empty θ */
  function takeMeasurement() {
    const currentInput = document.getElementById('labCurrentInput');
    if (!currentInput) return;
    const I = parseFloat(currentInput.value);
    if (isNaN(I) || I <= 0) return;

    App.state.lab.rows.push({ i: I, a: null });
    App.saveState();

    // Advance current input for next measurement
    currentInput.value = (I + 0.5).toFixed(1);

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

    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="py-8 italic text-slate-300">עדיין אין מדידות — קבעו זרם ולחצו "קח מדידה"</td></tr>';
    }

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
        <td class="p-3 font-bold text-slate-700">${row.i.toFixed(1)} A</td>
        <td class="p-3">
          <input type="number" step="1" min="0" max="89"
            class="w-24 border-2 border-blue-300 rounded-lg text-center font-bold text-blue-700 bg-blue-50 p-1.5 focus:ring-2 focus:ring-blue-400 outline-none"
            value="${hasAngle ? row.a : ''}" data-idx="${idx}" data-field="a"
            placeholder="מה מדדתם?">
        </td>
        <td class="p-3 font-mono text-slate-400">${hasAngle ? tan.toFixed(3) : '---'}</td>
        <td class="p-3 font-mono text-slate-400">${bloop.toFixed(1)}</td>
        <td class="p-3">
          <button class="text-red-400 hover:text-red-600 text-xs" data-delete="${idx}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      body.appendChild(tr);
    });

    // Bind angle inputs only (I is read-only)
    body.querySelectorAll('input[data-field="a"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const val = e.target.value;
        App.state.lab.rows[idx].a = val === '' ? null : parseFloat(val);
        App.saveState();
        resetBHCheck();
        renderTable();
      });
    });

    // Bind delete buttons
    body.querySelectorAll('button[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.delete);
        App.state.lab.rows.splice(idx, 1);
        App.saveState();
        resetBHCheck();
        renderTable();
      });
    });

    // Compute slope & show guided B_H section
    let slope = null;
    const bhSection = document.getElementById('labBHSection');
    const bhWaiting = document.getElementById('labBHWaiting');

    if (points.length >= 2) {
      slope = Physics.slopeThruOrigin(points);
      document.getElementById('labSlopeDisplay').textContent = slope.toFixed(4);
      if (bhSection) bhSection.classList.remove('hidden');
      if (bhWaiting) bhWaiting.classList.add('hidden');
    } else {
      document.getElementById('labSlopeDisplay').textContent = '---';
      if (bhSection) bhSection.classList.add('hidden');
      if (bhWaiting) bhWaiting.classList.remove('hidden');
      resetBHCheck();
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

  function clearAll() {
    App.state.lab.rows = [];
    App.saveState();
    resetBHCheck();
    renderTable();
    // Reset current input
    const ci = document.getElementById('labCurrentInput');
    if (ci) ci.value = '0.5';
  }

  return { init, renderTable, takeMeasurement, clearAll };
})();
