/* ===== simulator3d.js — Three.js 3D Lab Scene ===== */

const Simulator3D = (() => {
  let scene, camera, renderer, controls;
  let initialized = false;
  let animating = false;
  let container;

  // 3D objects
  let needle, ghostNeedle, compassBase, compassGlass;
  let windingMeshes = [];
  let ammeterDisplay, ledLight, rheostatSlider;
  let fieldArrows = { bh: null, bloop: null };

  // Animation state
  let currentNeedleAngle = 0;
  let targetNeedleAngle = 0;
  let ghostAngle = 0;
  let lastStormUpdate = 0;

  /* ========== INIT ========== */
  function init() {
    if (initialized) return;
    container = document.getElementById('sim3dContainer');
    if (!container) return;

    // WebGL check
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) throw new Error('No WebGL');
    } catch (e) {
      const loading = document.getElementById('sim3dLoading');
      if (loading) loading.innerHTML = '<div class="text-center text-red-600"><i class="fas fa-exclamation-triangle text-3xl mb-2"></i><div class="text-sm font-bold">WebGL לא נתמך בדפדפן זה</div><div class="text-xs text-slate-500">נסו Chrome או Firefox</div></div>';
      return;
    }

    initialized = true;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    scene.fog = new THREE.Fog(0xf0f4f8, 8, 25);

    // Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3, 2.5, 3);
    camera.lookAt(0, 0.5, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 0.5, 0);

    // Lighting
    setupLighting();

    // Ground
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Build lab objects
    buildWoodenBase();
    buildAluminumRing();
    buildWindings(App.state.sim.windings);
    buildCompass();
    buildElectricalEquipment();
    buildWires();
    buildFieldArrows();

    // Remove loading
    const loading = document.getElementById('sim3dLoading');
    if (loading) loading.style.display = 'none';

    // Bind controls
    bindControls();

    // Responsive
    window.addEventListener('resize', onResize);

    // Start animation
    startAnimation();
    updateSim();
  }

  /* ========== LIGHTING ========== */
  function setupLighting() {
    // Ambient
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Main directional
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 5, 2);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 15;
    dirLight.shadow.camera.left = -4;
    dirLight.shadow.camera.right = 4;
    dirLight.shadow.camera.top = 4;
    dirLight.shadow.camera.bottom = -4;
    scene.add(dirLight);

    // Warm fill
    const fillLight = new THREE.PointLight(0xffeedd, 0.3, 10);
    fillLight.position.set(-2, 3, -1);
    scene.add(fillLight);
  }

  /* ========== BUILD OBJECTS ========== */

  function buildWoodenBase() {
    const woodColor = 0x8B6914;

    // Main base board
    const baseGeo = new THREE.BoxGeometry(2.4, 0.08, 1.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.8, metalness: 0.05 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, 0.04, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    scene.add(base);

    // Feet
    const footGeo = new THREE.BoxGeometry(0.15, 0.06, 0.15);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x5a3e1b, roughness: 0.9 });
    [[-1, 0, -0.45], [1, 0, -0.45], [-1, 0, 0.45], [1, 0, 0.45]].forEach(pos => {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(pos[0], -0.01, pos[2]);
      scene.add(foot);
    });

    // Vertical supports
    const supportGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 16);
    const supportMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.7 });
    [-0.9, 0.9].forEach(x => {
      const support = new THREE.Mesh(supportGeo, supportMat);
      support.position.set(x, 0.88, 0);
      support.castShadow = true;
      scene.add(support);
    });

    // Horizontal platform (in the middle of the ring for the compass)
    const platGeo = new THREE.BoxGeometry(0.8, 0.04, 0.8);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x9B7832, roughness: 0.75 });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.set(0, 0.58, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    scene.add(platform);
  }

  function buildAluminumRing() {
    // Main aluminum ring (torus)
    const ringGeo = new THREE.TorusGeometry(0.85, 0.035, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0,
      metalness: 0.7,
      roughness: 0.3
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.88, 0);
    ring.rotation.y = Math.PI / 2; // perpendicular to base
    ring.castShadow = true;
    scene.add(ring);
  }

  function buildWindings(N) {
    // Remove old windings
    windingMeshes.forEach(m => scene.remove(m));
    windingMeshes = [];

    const nDisplay = Math.min(N, 30); // visual cap
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xb87333,
      metalness: 0.6,
      roughness: 0.4
    });

    for (let i = 0; i < nDisplay; i++) {
      const offset = (i - (nDisplay - 1) / 2) * 0.025;
      const windGeo = new THREE.TorusGeometry(0.85, 0.012, 8, 48);
      const winding = new THREE.Mesh(windGeo, copperMat);
      winding.position.set(0, 0.88, offset);
      winding.rotation.y = Math.PI / 2;
      winding.castShadow = true;
      scene.add(winding);
      windingMeshes.push(winding);
    }
  }

  function buildCompass() {
    // Compass body - cylinder
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.06, 32);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.3 });
    compassBase = new THREE.Mesh(bodyGeo, bodyMat);
    compassBase.position.set(0, 0.63, 0);
    compassBase.castShadow = true;
    scene.add(compassBase);

    // Compass face (white disc)
    const faceGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.005, 32);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0.665, 0);
    scene.add(face);

    // Tick marks
    const tickMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    for (let i = 0; i < 36; i++) {
      const isMajor = i % 9 === 0;
      const len = isMajor ? 0.04 : 0.015;
      const wid = isMajor ? 0.006 : 0.003;
      const tickGeo = new THREE.BoxGeometry(wid, 0.002, len);
      const tick = new THREE.Mesh(tickGeo, tickMat);
      const ang = (i * 10) * Math.PI / 180;
      const r = 0.21;
      tick.position.set(Math.sin(ang) * r, 0.669, Math.cos(ang) * r);
      tick.rotation.y = -ang;
      scene.add(tick);
    }

    // N/S labels
    addTextSprite('N', 0xff0000, 0, 0.669, 0.19, 0.06);
    addTextSprite('S', 0x1e293b, 0, 0.669, -0.19, 0.06);
    addTextSprite('E', 0x1e293b, -0.19, 0.669, 0, 0.04);
    addTextSprite('W', 0x1e293b, 0.19, 0.669, 0, 0.04);

    // Needle group
    const needleGroup = new THREE.Group();
    needleGroup.position.set(0, 0.672, 0);

    // Red half (north)
    const redGeo = new THREE.BoxGeometry(0.015, 0.004, 0.18);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.3 });
    const redHalf = new THREE.Mesh(redGeo, redMat);
    redHalf.position.set(0, 0, 0.09);
    needleGroup.add(redHalf);

    // Dark half (south)
    const darkGeo = new THREE.BoxGeometry(0.015, 0.004, 0.18);
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.3 });
    const darkHalf = new THREE.Mesh(darkGeo, darkMat);
    darkHalf.position.set(0, 0, -0.09);
    needleGroup.add(darkHalf);

    // Centre pivot
    const pivotGeo = new THREE.SphereGeometry(0.015, 12, 12);
    const pivotMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 });
    needleGroup.add(new THREE.Mesh(pivotGeo, pivotMat));

    scene.add(needleGroup);
    needle = needleGroup;

    // Ghost needle (transparent - shows ideal angle)
    const ghostGroup = new THREE.Group();
    ghostGroup.position.set(0, 0.675, 0);

    const ghostRedGeo = new THREE.BoxGeometry(0.015, 0.003, 0.17);
    const ghostRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, transparent: true, opacity: 0.2 });
    const ghostRed = new THREE.Mesh(ghostRedGeo, ghostRedMat);
    ghostRed.position.set(0, 0, 0.085);
    ghostGroup.add(ghostRed);

    const ghostDarkGeo = new THREE.BoxGeometry(0.015, 0.003, 0.17);
    const ghostDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.2 });
    const ghostDark = new THREE.Mesh(ghostDarkGeo, ghostDarkMat);
    ghostDark.position.set(0, 0, -0.085);
    ghostGroup.add(ghostDark);

    ghostGroup.visible = false;
    scene.add(ghostGroup);
    ghostNeedle = ghostGroup;

    // Glass dome
    const glassGeo = new THREE.SphereGeometry(0.24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });
    compassGlass = new THREE.Mesh(glassGeo, glassMat);
    compassGlass.position.set(0, 0.66, 0);
    scene.add(compassGlass);
  }

  function addTextSprite(text, color, x, y, z, size) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, sizeAttenuation: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    sprite.position.set(x, y, z);
    scene.add(sprite);
  }

  function buildElectricalEquipment() {
    // DC Power source (blue box)
    const psGeo = new THREE.BoxGeometry(0.5, 0.3, 0.35);
    const psMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.6, metalness: 0.2 });
    const ps = new THREE.Mesh(psGeo, psMat);
    ps.position.set(-1.6, 0.23, -0.6);
    ps.castShadow = true;
    scene.add(ps);

    // Label "DC"
    addTextSprite('DC', 0xffffff, -1.6, 0.35, -0.42, 0.08);

    // LED indicator
    const ledGeo = new THREE.SphereGeometry(0.025, 12, 12);
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x000000, emissiveIntensity: 0 });
    ledLight = new THREE.Mesh(ledGeo, ledMat);
    ledLight.position.set(-1.6, 0.4, -0.42);
    scene.add(ledLight);

    // Terminals
    const termGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8);
    const termRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6 });
    const termBlkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });
    const termRed = new THREE.Mesh(termGeo, termRedMat);
    termRed.position.set(-1.45, 0.41, -0.6);
    scene.add(termRed);
    const termBlk = new THREE.Mesh(termGeo, termBlkMat);
    termBlk.position.set(-1.75, 0.41, -0.6);
    scene.add(termBlk);

    // Rheostat (horizontal cylinder)
    const rheoGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 24);
    const rheoMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7, metalness: 0.3 });
    const rheo = new THREE.Mesh(rheoGeo, rheoMat);
    rheo.rotation.z = Math.PI / 2;
    rheo.position.set(1.5, 0.2, -0.6);
    rheo.castShadow = true;
    scene.add(rheo);

    // Wire winding visual on rheostat
    const rheoWireGeo = new THREE.TorusGeometry(0.13, 0.008, 6, 60);
    const rheoWireMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.5 });
    for (let i = -5; i <= 5; i++) {
      const rw = new THREE.Mesh(rheoWireGeo, rheoWireMat);
      rw.position.set(1.5 + i * 0.025, 0.2, -0.6);
      rw.rotation.y = Math.PI / 2;
      scene.add(rw);
    }

    // Rheostat slider knob
    const knobGeo = new THREE.BoxGeometry(0.08, 0.04, 0.06);
    const knobMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    rheostatSlider = new THREE.Mesh(knobGeo, knobMat);
    rheostatSlider.position.set(1.5, 0.34, -0.6);
    scene.add(rheostatSlider);

    // Rheostat supports
    const rSupGeo = new THREE.BoxGeometry(0.08, 0.14, 0.15);
    const rSupMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.8 });
    [1.2, 1.8].forEach(x => {
      const sup = new THREE.Mesh(rSupGeo, rSupMat);
      sup.position.set(x, 0.07, -0.6);
      scene.add(sup);
    });

    addTextSprite('R', 0xffffff, 1.5, 0.38, -0.6, 0.06);

    // Ammeter (box with display)
    const amGeo = new THREE.BoxGeometry(0.4, 0.25, 0.3);
    const amMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.6, metalness: 0.1 });
    const ammeter = new THREE.Mesh(amGeo, amMat);
    ammeter.position.set(0, 0.21, -0.8);
    ammeter.castShadow = true;
    scene.add(ammeter);

    // Ammeter face
    const amFaceGeo = new THREE.PlaneGeometry(0.25, 0.15);
    const amFaceMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const amFace = new THREE.Mesh(amFaceGeo, amFaceMat);
    amFace.position.set(0, 0.28, -0.649);
    scene.add(amFace);

    // Ammeter label
    addTextSprite('A', 0x22c55e, 0, 0.28, -0.64, 0.07);

    // Ammeter display sprite - updated dynamically
    const amDispCanvas = document.createElement('canvas');
    amDispCanvas.width = 128;
    amDispCanvas.height = 64;
    const amDispTex = new THREE.CanvasTexture(amDispCanvas);
    const amDispMat = new THREE.SpriteMaterial({ map: amDispTex, sizeAttenuation: true });
    ammeterDisplay = new THREE.Sprite(amDispMat);
    ammeterDisplay.scale.set(0.15, 0.075, 1);
    ammeterDisplay.position.set(0, 0.22, -0.64);
    ammeterDisplay._canvas = amDispCanvas;
    ammeterDisplay._texture = amDispTex;
    scene.add(ammeterDisplay);

    // Ammeter terminals
    const amTermRed = new THREE.Mesh(termGeo, termRedMat);
    amTermRed.position.set(0.12, 0.36, -0.8);
    scene.add(amTermRed);
    const amTermBlk = new THREE.Mesh(termGeo, termBlkMat);
    amTermBlk.position.set(-0.12, 0.36, -0.8);
    scene.add(amTermBlk);
  }

  function buildWires() {
    const wireMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
    const wireMatBlk = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Simplified wire paths using tubes
    const wireRadius = 0.01;

    // Wire 1: Power source → Ammeter (red)
    const path1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.45, 0.41, -0.6),
      new THREE.Vector3(-1.45, 0.5, -0.6),
      new THREE.Vector3(-0.5, 0.5, -0.7),
      new THREE.Vector3(0.12, 0.5, -0.75),
      new THREE.Vector3(0.12, 0.36, -0.8)
    ]);
    const wire1 = new THREE.Mesh(
      new THREE.TubeGeometry(path1, 20, wireRadius, 8, false),
      wireMat
    );
    wire1.castShadow = true;
    scene.add(wire1);

    // Wire 2: Ammeter → Coil top (red)
    const path2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 0.36, -0.8),
      new THREE.Vector3(-0.12, 0.5, -0.8),
      new THREE.Vector3(-0.5, 0.6, -0.4),
      new THREE.Vector3(-0.7, 0.88, 0),
      new THREE.Vector3(-0.5, 1.5, 0)
    ]);
    const wire2 = new THREE.Mesh(
      new THREE.TubeGeometry(path2, 20, wireRadius, 8, false),
      wireMat
    );
    wire2.castShadow = true;
    scene.add(wire2);

    // Wire 3: Coil bottom → Rheostat (black)
    const path3 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.5, 1.5, 0),
      new THREE.Vector3(0.7, 0.88, 0),
      new THREE.Vector3(0.9, 0.6, -0.3),
      new THREE.Vector3(1.2, 0.5, -0.5),
      new THREE.Vector3(1.2, 0.2, -0.6)
    ]);
    const wire3 = new THREE.Mesh(
      new THREE.TubeGeometry(path3, 20, wireRadius, 8, false),
      wireMatBlk
    );
    wire3.castShadow = true;
    scene.add(wire3);

    // Wire 4: Rheostat → Power source (black)
    const path4 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.8, 0.2, -0.6),
      new THREE.Vector3(1.8, 0.5, -0.6),
      new THREE.Vector3(0.5, 0.55, -0.9),
      new THREE.Vector3(-0.8, 0.55, -0.8),
      new THREE.Vector3(-1.75, 0.5, -0.6),
      new THREE.Vector3(-1.75, 0.41, -0.6)
    ]);
    const wire4 = new THREE.Mesh(
      new THREE.TubeGeometry(path4, 30, wireRadius, 8, false),
      wireMatBlk
    );
    wire4.castShadow = true;
    scene.add(wire4);
  }

  function buildFieldArrows() {
    // B_H arrow (north direction = +Z)
    const bhArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0.4, 0.75, -0.15),
      0.4,
      0x3b82f6,
      0.08,
      0.05
    );
    bhArrow.visible = true;
    scene.add(bhArrow);
    fieldArrows.bh = bhArrow;

    // B_loop arrow (perpendicular to coil plane = X direction)
    const bloopArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-0.15, 0.75, 0.4),
      0.3,
      0x22c55e,
      0.08,
      0.05
    );
    bloopArrow.visible = false;
    scene.add(bloopArrow);
    fieldArrows.bloop = bloopArrow;

    // Labels
    addTextSprite('B_H', 0x3b82f6, 0.4, 0.82, 0.3, 0.05);
  }

  /* ========== CONTROLS BINDING ========== */
  function bindControls() {
    const s = App.state.sim;

    // Main controls
    const elPower = document.getElementById('simPower');
    const elI = document.getElementById('simInputI');
    const elN = document.getElementById('simInputN');
    const elR = document.getElementById('simInputR');
    const elPlanet = document.getElementById('simPlanet');
    const elStorm = document.getElementById('simStorm');

    if (elPower) { elPower.checked = s.isPowerOn; elPower.addEventListener('change', updateSim); }
    if (elI) { elI.value = s.current; elI.addEventListener('input', updateSim); }
    if (elN) { elN.value = s.windings; elN.addEventListener('input', updateSim); }
    if (elR) { elR.value = s.radius; elR.addEventListener('input', updateSim); }
    if (elPlanet) { elPlanet.value = s.bh; elPlanet.addEventListener('change', updateSim); }
    if (elStorm) { elStorm.checked = s.storm; elStorm.addEventListener('change', updateSim); }

    // Error controls
    const errCal = document.getElementById('errCalibration');
    const errCalVal = document.getElementById('errCalibrationVal');
    const errNoise = document.getElementById('errNoise');
    const errNoiseVal = document.getElementById('errNoiseVal');
    const errPlace = document.getElementById('errPlacement');
    const errPlaceVal = document.getElementById('errPlacementVal');

    [errCal, errCalVal, errNoise, errNoiseVal, errPlace, errPlaceVal].forEach(el => {
      if (el) el.addEventListener('input', updateSim);
    });

    // Mobile controls toggle
    const handle = document.querySelector('.sim-controls-handle');
    if (handle) {
      handle.addEventListener('click', () => {
        document.querySelector('.sim-controls-sidebar').classList.toggle('expanded');
      });
    }
  }

  /* ========== UPDATE SIMULATION ========== */
  function updateSim() {
    const s = App.state.sim;

    // Read controls
    s.isPowerOn = document.getElementById('simPower')?.checked || false;
    s.current = parseFloat(document.getElementById('simInputI')?.value) || 0;
    s.windings = parseInt(document.getElementById('simInputN')?.value) || 5;
    s.radius = parseFloat(document.getElementById('simInputR')?.value) || 0.1;
    s.bh = parseFloat(document.getElementById('simPlanet')?.value) || 0;
    s.storm = document.getElementById('simStorm')?.checked || false;

    // Error state
    s.errors.calibration.enabled = document.getElementById('errCalibration')?.checked || false;
    s.errors.calibration.offset = parseFloat(document.getElementById('errCalibrationVal')?.value) || 0;
    s.errors.noise.enabled = document.getElementById('errNoise')?.checked || false;
    s.errors.noise.stdDev = parseFloat(document.getElementById('errNoiseVal')?.value) || 1;
    s.errors.placement.enabled = document.getElementById('errPlacement')?.checked || false;
    s.errors.placement.offset = parseFloat(document.getElementById('errPlacementVal')?.value) || 0;

    // Update display labels
    document.getElementById('simValI').textContent = s.current.toFixed(2) + ' A';
    document.getElementById('simValN').textContent = s.windings;
    document.getElementById('simValR').textContent = s.radius.toFixed(2);

    // Update error displays
    document.getElementById('errCalibrationDisp').textContent = s.errors.calibration.offset.toFixed(1) + '°';
    document.getElementById('errNoiseDisp').textContent = s.errors.noise.stdDev.toFixed(1) + '°';
    document.getElementById('errPlacementDisp').textContent = s.errors.placement.offset.toFixed(1) + ' cm';

    // Physics
    const Ieff = s.isPowerOn ? s.current : 0;
    const B_loop = Physics.bLoop(Ieff, s.windings, s.radius);
    const idealAngle = Physics.deflectionAngle(B_loop, s.bh);

    // Apply errors
    const errorsActive = s.errors.calibration.enabled || s.errors.noise.enabled || s.errors.placement.enabled;
    let measuredAngle = idealAngle;

    if (errorsActive) {
      const result = Physics.applyErrors(idealAngle, s.errors, {
        I: Ieff, N: s.windings, R: s.radius, B_H: s.bh
      });
      measuredAngle = result.measured;

      // Show ghost needle
      if (ghostNeedle) {
        ghostNeedle.visible = true;
        ghostAngle = idealAngle;
      }
    } else {
      if (ghostNeedle) ghostNeedle.visible = false;
    }

    // Storm jitter
    if (s.storm && s.isPowerOn) {
      measuredAngle += (Math.random() - 0.5) * 5;
    }

    targetNeedleAngle = measuredAngle;

    // Saturation warning
    const warnEl = document.getElementById('simSaturationWarning');
    if (warnEl) {
      warnEl.classList.toggle('hidden', Math.abs(measuredAngle) <= 75);
    }

    // Update displays
    document.getElementById('simValAngle').textContent = measuredAngle.toFixed(1) + '°';
    document.getElementById('simValBLoop').textContent = (Math.abs(B_loop) * 1e6).toFixed(1);
    document.getElementById('simBadgeBH').textContent = (s.bh * 1e6).toFixed(1);

    // Update 3D elements
    updateWindings();
    updateLED();
    updateAmmeter(Ieff);
    updateFieldArrows(B_loop);
    updateRheostat();

    App.saveState();
  }

  function updateWindings() {
    const N = App.state.sim.windings;
    if (windingMeshes.length !== Math.min(N, 30)) {
      buildWindings(N);
    }
  }

  function updateLED() {
    if (!ledLight) return;
    if (App.state.sim.isPowerOn) {
      ledLight.material.emissive = new THREE.Color(0x22c55e);
      ledLight.material.emissiveIntensity = 2;
      ledLight.material.color = new THREE.Color(0x22c55e);
    } else {
      ledLight.material.emissive = new THREE.Color(0x000000);
      ledLight.material.emissiveIntensity = 0;
      ledLight.material.color = new THREE.Color(0x666666);
    }
  }

  function updateAmmeter(Ieff) {
    if (!ammeterDisplay || !ammeterDisplay._canvas) return;
    const canvas = ammeterDisplay._canvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 64);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.abs(Ieff).toFixed(2) + 'A', 64, 32);
    ammeterDisplay._texture.needsUpdate = true;
  }

  function updateFieldArrows(B_loop) {
    if (fieldArrows.bloop) {
      fieldArrows.bloop.visible = App.state.sim.isPowerOn && Math.abs(B_loop) > 1e-9;
      const len = Math.min(Math.abs(B_loop) * 1e5 * 0.5, 0.6);
      if (len > 0.01) {
        fieldArrows.bloop.setLength(len, 0.08, 0.05);
        fieldArrows.bloop.setDirection(new THREE.Vector3(B_loop >= 0 ? 1 : -1, 0, 0));
      }
    }
  }

  function updateRheostat() {
    if (!rheostatSlider) return;
    const I = Math.abs(App.state.sim.current);
    const maxI = 3;
    const t = I / maxI;
    rheostatSlider.position.x = 1.2 + t * 0.6;
  }

  /* ========== ANIMATION LOOP ========== */
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

    // Smooth needle rotation (lerp)
    const targetRad = -targetNeedleAngle * Math.PI / 180;
    if (needle) {
      currentNeedleAngle += (targetRad - currentNeedleAngle) * 0.08;
      needle.rotation.y = currentNeedleAngle;
    }

    // Ghost needle shows ideal
    if (ghostNeedle && ghostNeedle.visible) {
      ghostNeedle.rotation.y = -ghostAngle * Math.PI / 180;
    }

    // Storm jitter - throttled at ~8 Hz
    const now = performance.now();
    if (App.state.sim.storm && App.state.sim.isPowerOn && now - lastStormUpdate > 120) {
      lastStormUpdate = now;
      updateSim();
    }

    controls.update();
    renderer.render(scene, camera);
  }

  /* ========== USER ACTIONS ========== */

  function flipPoles() {
    const el = document.getElementById('simInputI');
    if (el) {
      el.value = -parseFloat(el.value);
      updateSim();
    }
  }

  function takeSample() {
    const s = App.state.sim;
    if (!s.isPowerOn) return;

    // Vacuum guard — can't compute meaningful tan(90°)
    if (s.bh === 0) return;

    // Compute fresh from state — same logic as updateSim()
    const Ieff = s.current;
    const B_loop = Physics.bLoop(Ieff, s.windings, s.radius);
    const idealAngle = Physics.deflectionAngle(B_loop, s.bh);

    // Apply errors
    let measuredAngle = idealAngle;
    const errorsActive = s.errors.calibration.enabled || s.errors.noise.enabled || s.errors.placement.enabled;
    if (errorsActive) {
      const result = Physics.applyErrors(idealAngle, s.errors, {
        I: Ieff, N: s.windings, R: s.radius, B_H: s.bh
      });
      measuredAngle = result.measured;
    }

    // Storm jitter
    if (s.storm) {
      measuredAngle += (Math.random() - 0.5) * 5;
    }

    const b = Math.abs(B_loop) * 1e6; // μT

    // Clamp angle for chart purposes (prevent tan explosion near 90°)
    const MAX_ANGLE = 85;
    const clampedAngle = Math.min(Math.abs(measuredAngle), MAX_ANGLE) * Math.sign(measuredAngle);
    const t = Math.tan(clampedAngle * Math.PI / 180);

    s.history.unshift({
      i: s.current,
      a: measuredAngle,
      t: t,
      b: b
    });

    App.saveState();
    renderSimTable();
    Charts.addSimPoint(b, t);
  }

  function renderSimTable() {
    const body = document.getElementById('simTableBody');
    if (!body) return;
    const hist = App.state.sim.history;

    if (hist.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="py-10 italic text-slate-300">אין דגימות</td></tr>';
      return;
    }

    body.innerHTML = hist.map((s, i) =>
      `<tr class="border-b hover:bg-green-50/30">
        <td class="p-2 border-l font-bold text-red-600">${s.i.toFixed(2)}A</td>
        <td class="p-2 border-l font-bold text-blue-600">${s.a.toFixed(1)}°</td>
        <td class="p-2 border-l font-mono text-slate-400">${s.t.toFixed(3)}</td>
        <td class="p-1"><button onclick="Simulator3D.deleteSample(${i})" class="text-red-400 hover:text-red-600 text-[9px]"><i class="fas fa-times"></i></button></td>
      </tr>`
    ).join('');
  }

  function deleteSample(idx) {
    App.state.sim.history.splice(idx, 1);
    App.saveState();
    renderSimTable();
    rebuildSimChart();
  }

  function clearSamples() {
    App.state.sim.history = [];
    App.saveState();
    renderSimTable();
    Charts.clearSimChart();
  }

  function rebuildSimChart() {
    Charts.clearSimChart();
    App.state.sim.history.forEach(s => {
      Charts.addSimPoint(s.b, s.t);
    });
  }

  function resetDefaults() {
    const s = App.state.sim;
    s.isPowerOn = false;
    s.current = 0.5;
    s.windings = 5;
    s.radius = 0.1;
    s.bh = 2.5e-5;
    s.storm = false;
    s.errors.calibration.enabled = false;
    s.errors.calibration.offset = 0;
    s.errors.noise.enabled = false;
    s.errors.noise.stdDev = 1;
    s.errors.placement.enabled = false;
    s.errors.placement.offset = 0;

    // Sync DOM controls
    const el = (id) => document.getElementById(id);
    if (el('simPower')) el('simPower').checked = false;
    if (el('simInputI')) el('simInputI').value = 0.5;
    if (el('simInputN')) el('simInputN').value = 5;
    if (el('simInputR')) el('simInputR').value = 0.1;
    if (el('simPlanet')) el('simPlanet').value = '2.5e-5';
    if (el('simStorm')) el('simStorm').checked = false;
    if (el('errCalibration')) el('errCalibration').checked = false;
    if (el('errCalibrationVal')) el('errCalibrationVal').value = 0;
    if (el('errNoise')) el('errNoise').checked = false;
    if (el('errNoiseVal')) el('errNoiseVal').value = 1;
    if (el('errPlacement')) el('errPlacement').checked = false;
    if (el('errPlacementVal')) el('errPlacementVal').value = 0;

    // Collapse error panel
    const errPanel = el('errorPanel');
    if (errPanel) errPanel.classList.add('collapsed');

    updateSim();
  }

  function exportCSV() {
    const hist = App.state.sim.history;
    if (hist.length === 0) return;
    const csv = "Current(A),Angle(deg),tan(theta),B_loop(uT)\n" +
      hist.map(s => `${s.i},${s.a},${s.t},${s.b}`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sim_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ========== LIFECYCLE ========== */

  function onShow() {
    if (initialized) {
      startAnimation();
      onResize();
      Charts.initSimChart();
      renderSimTable();
      // Rebuild chart from saved history
      if (App.state.sim.history.length > 0) {
        rebuildSimChart();
      }
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

  return {
    init,
    onShow,
    onHide,
    flipPoles,
    takeSample,
    deleteSample,
    clearSamples,
    resetDefaults,
    exportCSV,
    updateSim
  };
})();
