/* ===== charts.js — Chart.js instances for Lab, Simulator, Comparison ===== */

const Charts = (() => {
  let labChart = null;
  let simChart = null;
  let compChart = null;

  /* ---------- Lab Chart ---------- */
  function initLabChart() {
    if (labChart) return labChart;
    const ctx = document.getElementById('labChart');
    if (!ctx) return null;

    labChart = new Chart(ctx.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'מדידות',
            data: [],
            backgroundColor: '#ef4444',
            borderColor: '#ef4444',
            pointRadius: 7,
            pointHoverRadius: 9,
            order: 1
          },
          {
            label: 'קו מגמה',
            data: [],
            type: 'line',
            borderColor: '#ef4444',
            borderDash: [6, 4],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            order: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { size: 10, family: 'Assistant' } } },
          tooltip: {
            callbacks: {
              label: ctx => `B=${ctx.parsed.x.toFixed(1)} μT, tan(θ)=${ctx.parsed.y.toFixed(3)}`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'B_loop [μT]', font: { size: 11, family: 'Assistant' } },
            beginAtZero: true
          },
          y: {
            title: { display: true, text: 'tan(θ)', font: { size: 11, family: 'Assistant' } },
            beginAtZero: true
          }
        }
      }
    });
    return labChart;
  }

  function updateLabChart(points, slope) {
    if (!labChart) initLabChart();
    if (!labChart) return;

    labChart.data.datasets[0].data = points;

    if (points.length >= 2 && slope) {
      const maxX = Math.max(...points.map(p => p.x)) * 1.15;
      labChart.data.datasets[1].data = [{ x: 0, y: 0 }, { x: maxX, y: maxX * slope }];
    } else {
      labChart.data.datasets[1].data = [];
    }

    labChart.update();
  }

  /* ---------- Simulator Chart ---------- */
  function initSimChart() {
    if (simChart) return simChart;
    const ctx = document.getElementById('simChart');
    if (!ctx) return null;

    simChart = new Chart(ctx.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'אידיאלי',
            data: [],
            backgroundColor: '#10b981',
            borderColor: '#10b981',
            pointRadius: 5,
            pointHoverRadius: 7,
            order: 1
          },
          {
            label: 'קו מגמה',
            data: [],
            type: 'line',
            borderColor: '#10b981',
            borderDash: [6, 4],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            order: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `B=${ctx.parsed.x.toFixed(1)} μT, tan(θ)=${ctx.parsed.y.toFixed(3)}`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'B_loop [μT]', font: { size: 9, family: 'Assistant' } },
            beginAtZero: true
          },
          y: {
            title: { display: true, text: 'tan(θ)', font: { size: 9, family: 'Assistant' } },
            beginAtZero: true,
            suggestedMax: 2
          }
        }
      }
    });
    return simChart;
  }

  function addSimPoint(bloop, tanTheta) {
    if (!simChart) initSimChart();
    if (!simChart) return;
    simChart.data.datasets[0].data.push({ x: bloop, y: tanTheta });
    updateSimTrendLine();
    simChart.update();
  }

  function updateSimTrendLine() {
    if (!simChart) return;
    const points = simChart.data.datasets[0].data;
    const badge = document.getElementById('simSlopeBadge');

    if (points.length < 2) {
      simChart.data.datasets[1].data = [];
      if (badge) badge.classList.add('hidden');
      return;
    }

    const slope = Physics.slopeThruOrigin(points);
    const maxX = Math.max(...points.map(p => p.x)) * 1.15;
    simChart.data.datasets[1].data = [{ x: 0, y: 0 }, { x: maxX, y: maxX * slope }];

    // Update slope/BH badge
    if (badge) {
      badge.classList.remove('hidden');
      const bh = Physics.bhFromSlope(slope);
      document.getElementById('simSlopeVal').textContent = slope.toFixed(4);
      document.getElementById('simBHVal').textContent = isFinite(bh) ? bh.toFixed(1) : '--';
    }
  }

  function clearSimChart() {
    if (!simChart) return;
    simChart.data.datasets[0].data = [];
    simChart.data.datasets[1].data = [];
    simChart.update();
    const badge = document.getElementById('simSlopeBadge');
    if (badge) badge.classList.add('hidden');
  }

  /* ---------- Comparison Chart ---------- */
  function initComparisonChart() {
    if (compChart) return compChart;
    const ctx = document.getElementById('comparisonChart');
    if (!ctx) return null;

    compChart = new Chart(ctx.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'מעבדה',
            data: [],
            backgroundColor: '#ef4444',
            borderColor: '#ef4444',
            pointRadius: 7,
            pointStyle: 'circle',
            order: 1
          },
          {
            label: 'קו מגמה (מעבדה)',
            data: [],
            type: 'line',
            borderColor: '#ef4444',
            borderDash: [6, 4],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            order: 3
          },
          {
            label: 'סימולטור',
            data: [],
            backgroundColor: '#10b981',
            borderColor: '#10b981',
            pointRadius: 7,
            pointStyle: 'triangle',
            order: 2
          },
          {
            label: 'קו מגמה (סימולטור)',
            data: [],
            type: 'line',
            borderColor: '#10b981',
            borderDash: [6, 4],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            order: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 10, family: 'Assistant' },
              filter: item => !item.text.includes('קו מגמה')
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'B_loop [μT]', font: { size: 11, family: 'Assistant' } },
            beginAtZero: true
          },
          y: {
            title: { display: true, text: 'tan(θ)', font: { size: 11, family: 'Assistant' } },
            beginAtZero: true
          }
        }
      }
    });
    return compChart;
  }

  function updateComparison(labPoints, labSlope, simPoints, simSlope) {
    if (!compChart) initComparisonChart();
    if (!compChart) return;

    const container = document.getElementById('comparisonChartContainer');
    const card = document.getElementById('labComparisonCard');

    if (labPoints.length < 2 || simPoints.length < 2) {
      if (container) container.classList.add('hidden');
      if (card) card.classList.add('hidden');
      return;
    }

    if (container) container.classList.remove('hidden');
    if (card) card.classList.remove('hidden');

    // Lab data
    compChart.data.datasets[0].data = labPoints;
    const labMaxX = Math.max(...labPoints.map(p => p.x)) * 1.15;
    compChart.data.datasets[1].data = [{ x: 0, y: 0 }, { x: labMaxX, y: labMaxX * labSlope }];

    // Sim data
    compChart.data.datasets[2].data = simPoints;
    const simMaxX = Math.max(...simPoints.map(p => p.x)) * 1.15;
    compChart.data.datasets[3].data = [{ x: 0, y: 0 }, { x: simMaxX, y: simMaxX * simSlope }];

    compChart.update();

    // Update comparison card — slope is tan(θ)/B_loop[μT], so 1/slope = B_H in μT
    const labBH = Physics.bhFromSlope(labSlope);
    const simBH = Physics.bhFromSlope(simSlope);
    const litBH = 25.0; // Israel reference

    document.getElementById('compLabBH').textContent = labBH.toFixed(1);
    document.getElementById('compSimBH').textContent = simBH.toFixed(1);
    document.getElementById('compLitBH').textContent = litBH.toFixed(1);

    const avgBH = (labBH + simBH) / 2;
    const error = Math.abs(avgBH - litBH) / litBH * 100;
    document.getElementById('compError').textContent = error.toFixed(1) + '%';
  }

  return {
    initLabChart,
    updateLabChart,
    initSimChart,
    addSimPoint,
    clearSimChart,
    initComparisonChart,
    updateComparison,
    get labChart() { return labChart; },
    get simChart() { return simChart; }
  };
})();
