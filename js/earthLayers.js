/* ===== earthLayers.js — 3D Earth Cross-Section & Geological Timeline ===== */

const EarthLayers = (() => {
  let scene, camera, renderer, controls;
  let initialized = false;
  let animating = false;
  let container;

  // 3D groups
  let earthGroup;
  let layerMeshes = {};
  let fieldLines = [];
  let dynamoParticles;

  // Timeline data
  let reversalData = null;
  let currentPolarity = 'normal';

  // Layer data
  const layerInfo = {
    crust: {
      title: 'הקרום (Crust)',
      text: 'השכבה הדקה והמוצקה עליה אנחנו עומדים. כאן נמצאים הסלעים ש"זוכרים" את השדה המגנטי העתיק (פליאומגנטיזם).',
      extra: 'עובי: 5-70 ק"מ. סלעי בזלת בקרקעית האוקיינוס הם "סרט ההקלטה" של היפוכי הקטבים.',
      color: 0x5d4037,
      stats: { 'עובי': '5-70 ק"מ', 'טמפרטורה': '0-870°C', 'מצב צבירה': 'מוצק' }
    },
    mantle: {
      title: 'המעטפת (Mantle)',
      text: 'סלעים חמים וצמיגיים מאוד. היא מעבירה את החום מהליבה החוצה בתהליך של קונבקציה.',
      extra: 'מצב צבירה: מוצק-גמיש. היא פועלת כמבודד חום אדיר.',
      color: 0xd84315,
      stats: { 'עובי': '2,900 ק"מ', 'טמפרטורה': '870-4,400°C', 'מצב צבירה': 'גמיש-מוצק' }
    },
    outer: {
      title: 'הליבה החיצונית',
      text: 'ברזל וניקל נוזליים המסתחררים בטמפרטורה של 4,000 מעלות. זהו מנוע הדינמו של כדור הארץ!',
      extra: 'כאן נוצר השדה המגנטי (B_H). התנועה הנוזלית כאן היא זו שגורמת להיפוכי הקטבים.',
      color: 0xff8f00,
      stats: { 'עובי': '2,200 ק"מ', 'טמפרטורה': '4,400-6,100°C', 'מצב צבירה': 'נוזלי', 'תפקיד': 'מנוע הדינמו!' }
    },
    inner: {
      title: 'הליבה הפנימית',
      text: 'כדור ברזל מוצק בטמפרטורה של פני השמש. למרות החום, היא מוצקה בגלל הלחץ האדיר שמופעל עליה.',
      extra: 'היא פועלת כמייצב לשדה המגנטי ומונעת ממנו להתהפך בתדירות גבוהה מדי.',
      color: 0xffeb3b,
      stats: { 'רדיוס': '1,220 ק"מ', 'טמפרטורה': '~5,400°C', 'מצב צבירה': 'מוצק', 'הרכב': 'ברזל-ניקל' }
    }
  };

  /* ========== INIT ========== */
  function init() {
    if (initialized) return;
    container = document.getElementById('earth3dContainer');
    if (!container) return;

    // WebGL check
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) throw new Error('No WebGL');
    } catch (e) {
      const loading = document.getElementById('earth3dLoading');
      if (loading) loading.innerHTML = '<div class="text-center text-red-400"><i class="fas fa-exclamation-triangle text-3xl mb-2"></i><div class="text-sm font-bold">WebGL לא נתמך</div></div>';
      return;
    }

    initialized = true;

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3, 1.5, 3);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 8;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 3, 3);
    scene.add(dirLight);
    const backLight = new THREE.PointLight(0xffeedd, 0.3, 10);
    backLight.position.set(-3, 2, -2);
    scene.add(backLight);

    // Stars background
    buildStars();

    // Build Earth
    buildEarth();

    // Build magnetic field lines
    buildFieldLines();

    // Load reversal data
    loadReversals();

    // Build timeline bar
    buildTimelineBar();

    // Bind timeline slider
    const slider = document.getElementById('timelineSlider');
    if (slider) {
      slider.addEventListener('input', onTimelineChange);
    }

    // Raycaster for clicking layers
    setupRaycaster();

    // Remove loading
    const loading = document.getElementById('earth3dLoading');
    if (loading) loading.style.display = 'none';

    window.addEventListener('resize', onResize);
  }

  /* ========== BUILD STARS ========== */
  function buildStars() {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < 500; i++) {
      positions.push(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
    scene.add(new THREE.Points(geo, mat));
  }

  /* ========== BUILD EARTH ========== */
  function buildEarth() {
    earthGroup = new THREE.Group();

    // Clipping plane to show cross-section
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    // Inner core
    const innerGeo = new THREE.SphereGeometry(0.22, 32, 32);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xffeb3b,
      emissive: 0xffeb3b,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      clippingPlanes: [clipPlane],
      clipShadows: true
    });
    layerMeshes.inner = new THREE.Mesh(innerGeo, innerMat);
    layerMeshes.inner.userData = { layerId: 'inner' };
    earthGroup.add(layerMeshes.inner);

    // Outer core
    const outerGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0xff8f00,
      emissive: 0xff6600,
      emissiveIntensity: 0.15,
      roughness: 0.5,
      clippingPlanes: [clipPlane],
      clipShadows: true
    });
    layerMeshes.outer = new THREE.Mesh(outerGeo, outerMat);
    layerMeshes.outer.userData = { layerId: 'outer' };
    earthGroup.add(layerMeshes.outer);

    // Mantle
    const mantleGeo = new THREE.SphereGeometry(0.95, 32, 32);
    const mantleMat = new THREE.MeshStandardMaterial({
      color: 0xd84315,
      roughness: 0.7,
      clippingPlanes: [clipPlane],
      clipShadows: true
    });
    layerMeshes.mantle = new THREE.Mesh(mantleGeo, mantleMat);
    layerMeshes.mantle.userData = { layerId: 'mantle' };
    earthGroup.add(layerMeshes.mantle);

    // Crust
    const crustGeo = new THREE.SphereGeometry(1.0, 32, 32);
    const crustMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.8,
      clippingPlanes: [clipPlane],
      clipShadows: true
    });
    layerMeshes.crust = new THREE.Mesh(crustGeo, crustMat);
    layerMeshes.crust.userData = { layerId: 'crust' };
    earthGroup.add(layerMeshes.crust);

    // Cross-section cap (flat disc to cover the cut)
    const capGeo = new THREE.CircleGeometry(1.0, 64);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.9 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.rotation.y = Math.PI;
    cap.position.z = 0.001;
    earthGroup.add(cap);

    // Cross-section rings (visible layers on cut face)
    const ringColors = [
      { r: 0.22, color: 0xffeb3b },  // inner
      { r: 0.55, color: 0xff8f00 },  // outer
      { r: 0.95, color: 0xd84315 },  // mantle
      { r: 1.0,  color: 0x5d4037 }   // crust
    ];
    ringColors.forEach(rc => {
      const ringGeo = new THREE.RingGeometry(rc.r - 0.04, rc.r, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: rc.color, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.y = Math.PI;
      ring.position.z = 0.002;
      earthGroup.add(ring);
    });

    // Inner fill discs
    const fillData = [
      { r: 0.22, color: 0xffeb3b },
      { r: 0.55, color: 0xff8f00 },
      { r: 0.95, color: 0xd84315 },
      { r: 1.0,  color: 0x5d4037 }
    ];
    for (let i = fillData.length - 1; i >= 0; i--) {
      const fGeo = new THREE.CircleGeometry(fillData[i].r, 64);
      const fMat = new THREE.MeshStandardMaterial({
        color: fillData[i].color,
        side: THREE.DoubleSide,
        roughness: 0.8
      });
      const fill = new THREE.Mesh(fGeo, fMat);
      fill.rotation.y = Math.PI;
      fill.position.z = 0.003 + i * 0.001;
      fill.userData = { layerId: Object.keys(layerInfo)[i] };
      earthGroup.add(fill);
    }

    renderer.localClippingEnabled = true;
    earthGroup.rotation.y = Math.PI * 0.3;
    scene.add(earthGroup);
  }

  /* ========== FIELD LINES ========== */
  function buildFieldLines() {
    fieldLines = [];
    const lineCount = 8;
    const lineMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.6 });

    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2;
      const points = [];
      const segments = 40;

      for (let j = 0; j <= segments; j++) {
        const t = (j / segments) * Math.PI;
        const r = 1.5 * Math.sin(t);
        const y = 1.5 * Math.cos(t);
        const x = r * Math.cos(angle) * 0.3;
        const z = r * Math.sin(angle) * 0.3;
        points.push(new THREE.Vector3(x, y, z));
      }

      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMat.clone());
      scene.add(line);
      fieldLines.push(line);
    }
  }

  function updateFieldLines(strength, reversed) {
    fieldLines.forEach((line, i) => {
      line.material.opacity = 0.6 * strength;
      const scale = 0.5 + strength * 0.5;
      line.scale.set(scale, reversed ? -scale : scale, scale);
    });
  }

  /* ========== RAYCASTER ========== */
  function setupRaycaster() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('click', (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(earthGroup.children, false);

      if (intersects.length > 0) {
        for (const hit of intersects) {
          const layerId = hit.object.userData.layerId;
          if (layerId && layerInfo[layerId]) {
            showLayerInfo(layerId);
            highlightLayer(layerId);
            break;
          }
        }
      }
    });
  }

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
    Object.entries(layerMeshes).forEach(([key, mesh]) => {
      if (key === id) {
        mesh.material.emissiveIntensity = (mesh.material.emissiveIntensity || 0) + 0.4;
        setTimeout(() => {
          mesh.material.emissiveIntensity = Math.max(0, (mesh.material.emissiveIntensity || 0) - 0.4);
        }, 800);
      }
    });
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

    // Build a simplified timeline bar
    const events = reversalData.events;
    let lastEnd = 0;

    events.forEach(ev => {
      if (ev.start > lastEnd) {
        // Gap - unknown/mixed
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
        updateFieldLines(strength, event.polarity === 'reversed');
      } else {
        animEl.classList.add('hidden');
        updateFieldLines(1.0, event.polarity === 'reversed');
      }

      currentPolarity = event.polarity;
    } else {
      infoEl.textContent = `${ma.toFixed(1)} Ma — לא ידוע`;
      animEl.classList.add('hidden');
      updateFieldLines(0.5, false);
    }
  }

  /* ========== ANIMATION ========== */
  function startAnimation() {
    if (animating) return;
    animating = true;
    animate();
  }

  function stopAnimation() {
    animating = false;
  }

  function animate() {
    if (!animating) return;
    requestAnimationFrame(animate);

    // Slow Earth rotation
    if (earthGroup) {
      earthGroup.rotation.y += 0.002;
    }

    // Outer core glow pulse
    if (layerMeshes.outer) {
      const t = performance.now() * 0.001;
      layerMeshes.outer.material.emissiveIntensity = 0.1 + Math.sin(t * 2) * 0.08;
    }

    controls.update();
    renderer.render(scene, camera);
  }

  /* ========== LIFECYCLE ========== */
  function onShow() {
    if (initialized) {
      startAnimation();
      onResize();
    }
  }

  function onHide() {
    stopAnimation();
  }

  function onResize() {
    if (!container || !camera || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  return { init, onShow, onHide };
})();
