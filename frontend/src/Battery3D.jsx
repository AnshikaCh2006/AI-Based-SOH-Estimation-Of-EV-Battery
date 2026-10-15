import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { 
  Layers, Flame, Zap, Eye, RotateCw, RefreshCw, ZoomIn, ZoomOut, 
  Maximize2, Minimize2, Compass, AlertCircle, CheckCircle2, Info, Thermometer
} from "lucide-react";

// Helper to interpolate between color stops for thermal heatmaps
function getThermalColor(t, minT = 20, maxT = 50) {
  const norm = Math.max(0, Math.min(1, (t - minT) / (maxT - minT)));
  // Gradient: Deep Blue (0.0) -> Cyan (0.25) -> Green (0.5) -> Yellow (0.75) -> Red (1.0)
  const c = new THREE.Color();
  if (norm < 0.25) {
    const f = norm / 0.25;
    c.lerpColors(new THREE.Color("#0055ff"), new THREE.Color("#00d4ff"), f);
  } else if (norm < 0.5) {
    const f = (norm - 0.25) / 0.25;
    c.lerpColors(new THREE.Color("#00d4ff"), new THREE.Color("#10b981"), f);
  } else if (norm < 0.75) {
    const f = (norm - 0.5) / 0.25;
    c.lerpColors(new THREE.Color("#10b981"), new THREE.Color("#f59e0b"), f);
  } else {
    const f = (norm - 0.75) / 0.25;
    c.lerpColors(new THREE.Color("#f59e0b"), new THREE.Color("#ef4444"), f);
  }
  return c;
}

export default function Battery3D({ telemetry = {}, compact = false }) {
  const hostRef = useRef(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [viewMode, setViewMode] = useState("status"); // "status" | "thermal" | "voltage" | "xray"
  const [exploded, setExploded] = useState(0); // 0 to 1
  const [autoRotate, setAutoRotate] = useState(!compact);
  const [activePreset, setActivePreset] = useState("iso");
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Keep live refs for animation loop
  const explodedRef = useRef(exploded);
  explodedRef.current = exploded;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const subassembliesRef = useRef({});

  // Synthetic individual cell module properties based on current battery telemetry
  const baseTemp = Number(telemetry.temperature_mean) || 31.5;
  const baseVolt = Number(telemetry.voltage_mean) || 3.72;
  const baseResistance = Number(telemetry.internal_resistance_mohm) || 36.2;
  const baseSoh = Number(telemetry.soh_percent) || 98.5;
  const hasAnomaly = Number(telemetry.anomaly_label) === 1;

  const moduleData = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      // Center modules experience slightly higher thermal concentration
      const distFromCenter = Math.sqrt(Math.pow(row - 1.5, 2) + Math.pow(col - 1.5, 2));
      const tempDelta = (2.2 - distFromCenter * 0.9);
      const temp = Number((baseTemp + tempDelta + (i === 6 && hasAnomaly ? 9.8 : (i % 3) * 0.4)).toFixed(1));
      const volt = Number((baseVolt + (i === 6 && hasAnomaly ? -0.28 : (i % 2 === 0 ? 0.015 : -0.012))).toFixed(3));
      const res = Number((baseResistance + (i === 6 && hasAnomaly ? 14.5 : (i % 4) * 0.8)).toFixed(1));
      
      let status = "normal";
      if (hasAnomaly && (i === 6 || i === 10)) {
        status = "critical";
      } else if (temp > 38 || volt < 3.3 || res > 46) {
        status = "warning";
      }

      return {
        id: i + 1,
        row: row + 1,
        col: col + 1,
        temp,
        volt,
        res,
        soh: Number((baseSoh - (status === "critical" ? 8.2 : status === "warning" ? 2.1 : 0.2)).toFixed(1)),
        status,
        name: `Cell Module #${String(i + 1).padStart(2, "0")}`
      };
    });
  }, [baseTemp, baseVolt, baseResistance, baseSoh, hasAnomaly]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    // SCENE SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#09101b");
    scene.fog = new THREE.FogExp2("#09101b", 0.032);

    const width = el.clientWidth || 600;
    const height = el.clientHeight || 400;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(11.5, 8.5, 12.5);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    el.appendChild(renderer.domElement);

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // don't go below floor
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // LIGHTING
    const ambientLight = new THREE.HemisphereLight(0xdceaff, 0x081326, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(10, 15, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const cyanFill = new THREE.DirectionalLight(0x00d4ff, 1.6);
    cyanFill.position.set(-10, 8, -6);
    scene.add(cyanFill);

    const amberRim = new THREE.DirectionalLight(0x38bdf8, 1.2);
    amberRim.position.set(2, 6, -10);
    scene.add(amberRim);

    // STUDIO FLOOR & HOLOGRAPHIC GRID
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#080e18",
      roughness: 0.85,
      metalness: 0.4
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.8;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(30, 60, 0x00f2fe, 0x1e2e45);
    grid.position.y = -1.78;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    scene.add(grid);

    // Concentric radar circles on floor
    const ringMat = new THREE.LineBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.18 });
    [4, 8, 12].forEach(r => {
      const ringGeo = new THREE.RingGeometry(r - 0.02, r + 0.02, 64);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -1.77;
      scene.add(ring);
    });

    // MASTER GROUPS (Subassemblies)
    const root = new THREE.Group();
    scene.add(root);

    const trayGroup = new THREE.Group();
    const coolingGroup = new THREE.Group();
    const modulesGroup = new THREE.Group();
    const busbarsGroup = new THREE.Group();
    const bmsGroup = new THREE.Group();
    const hvGroup = new THREE.Group();
    const lidGroup = new THREE.Group();

    root.add(trayGroup);
    root.add(coolingGroup);
    root.add(modulesGroup);
    root.add(busbarsGroup);
    root.add(bmsGroup);
    root.add(hvGroup);
    root.add(lidGroup);

    subassembliesRef.current = {
      trayGroup, coolingGroup, modulesGroup, busbarsGroup, bmsGroup, hvGroup, lidGroup
    };

    // SHARED MATERIALS
    const matAluminum = new THREE.MeshStandardMaterial({
      color: "#334155", metalness: 0.85, roughness: 0.28
    });
    const matDarkChassis = new THREE.MeshStandardMaterial({
      color: "#16202e", metalness: 0.7, roughness: 0.4
    });
    const matCopper = new THREE.MeshStandardMaterial({
      color: "#ea580c", metalness: 0.92, roughness: 0.22
    });
    const matNickel = new THREE.MeshStandardMaterial({
      color: "#e2e8f0", metalness: 0.95, roughness: 0.15
    });
    const matCoolantBlue = new THREE.MeshStandardMaterial({
      color: "#0284c7", metalness: 0.6, roughness: 0.2, emissive: "#0369a1", emissiveIntensity: 0.4
    });
    const matHvOrange = new THREE.MeshStandardMaterial({
      color: "#f97316", metalness: 0.35, roughness: 0.35, emissive: "#c2410c", emissiveIntensity: 0.3
    });
    const matPcbGreen = new THREE.MeshStandardMaterial({
      color: "#064e3b", metalness: 0.4, roughness: 0.5
    });
    const matLexanGlass = new THREE.MeshPhysicalMaterial({
      color: "#94a3b8",
      metalness: 0.1,
      roughness: 0.15,
      transmission: 0.78,
      thickness: 0.6,
      transparent: true,
      opacity: 0.55
    });

    // 1. TRAY & REINFORCED LOWER CHASSIS
    const trayBase = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 5.8), matDarkChassis);
    trayBase.position.y = -0.85;
    trayBase.castShadow = true;
    trayBase.receiveShadow = true;
    trayGroup.add(trayBase);

    // Side crash rails & mounting flanges with simulated bolt holes
    const railMat = matAluminum;
    const rails = [
      { s: [8.4, 0.4, 0.25], p: [0, -0.6, 2.9] },
      { s: [8.4, 0.4, 0.25], p: [0, -0.6, -2.9] },
      { s: [0.25, 0.4, 5.8], p: [4.1, -0.6, 0] },
      { s: [0.25, 0.4, 5.8], p: [-4.1, -0.6, 0] },
    ];
    rails.forEach(r => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(...r.s), railMat);
      rail.position.set(...r.p);
      rail.castShadow = true;
      trayGroup.add(rail);
    });

    // Internal structural divider ribs
    [-1.9, 0, 1.9].forEach(x => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 5.5), matAluminum);
      rib.position.set(x, -0.55, 0);
      trayGroup.add(rib);
    });

    // 2. LIQUID COOLING PLATE & MANIFOLDS
    const coldPlate = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.12, 5.4), matCoolantBlue);
    coldPlate.position.set(0, -0.52, 0);
    coolingGroup.add(coldPlate);

    // Front cooling manifold headers
    const manifoldIn = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.2, 16), matAluminum);
    manifoldIn.rotation.x = Math.PI / 2;
    manifoldIn.position.set(-3.95, -0.48, 0);
    coolingGroup.add(manifoldIn);

    const manifoldOut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.2, 16), matAluminum);
    manifoldOut.rotation.x = Math.PI / 2;
    manifoldOut.position.set(3.95, -0.48, 0);
    coolingGroup.add(manifoldOut);

    // 3. 16 CELL MODULES (4 x 4 Matrix)
    const moduleMeshes = [];
    const modW = 1.68, modD = 1.15, modH = 0.58;
    const startX = -2.75, startZ = -1.95;
    const gapX = 0.16, gapZ = 0.16;

    // Cache module materials
    const moduleMaterials = moduleData.map(m => {
      let col = "#10b981";
      let emissive = "#047857";
      if (m.status === "critical") {
        col = "#ef4444";
        emissive = "#b91c1c";
      } else if (m.status === "warning") {
        col = "#f59e0b";
        emissive = "#b45309";
      }
      return new THREE.MeshStandardMaterial({
        color: col,
        metalness: 0.55,
        roughness: 0.28,
        emissive: emissive,
        emissiveIntensity: 0.35
      });
    });

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const idx = r * 4 + c;
        const x = startX + c * (modW + gapX);
        const z = startZ + r * (modD + gapZ);
        const info = moduleData[idx];

        const singleModGroup = new THREE.Group();
        singleModGroup.position.set(x, -0.15, z);

        // Lower module enclosure
        const modBase = new THREE.Mesh(new THREE.BoxGeometry(modW, modH * 0.45, modD), matDarkChassis);
        modBase.position.y = -modH * 0.25;
        modBase.castShadow = true;
        singleModGroup.add(modBase);

        // Main cell module body (reactive to status / heat)
        const cellBody = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.08, modH * 0.5, modD - 0.08), moduleMaterials[idx]);
        cellBody.position.y = modH * 0.1;
        cellBody.castShadow = true;
        cellBody.userData = { isCellModule: true, moduleIndex: idx, info };
        singleModGroup.add(cellBody);
        moduleMeshes.push(cellBody);

        // Cylindrical cell terminal arrays on top (realistic 4680/21700 cell pack appearance)
        const cellR = 0.1, cellH = 0.04;
        const cellCylGeo = new THREE.CylinderGeometry(cellR, cellR, cellH, 12);
        for (let cr = 0; cr < 2; cr++) {
          for (let cc = 0; cc < 4; cc++) {
            const cellTop = new THREE.Mesh(cellCylGeo, matNickel);
            cellTop.position.set(
              -modW * 0.35 + cc * (modW * 0.24),
              modH * 0.37,
              -modD * 0.25 + cr * (modD * 0.5)
            );
            singleModGroup.add(cellTop);
          }
        }

        // Module laser-welded copper interconnect strip
        const strip = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.88, 0.02, modD * 0.16), matCopper);
        strip.position.set(0, modH * 0.4, 0);
        singleModGroup.add(strip);

        // Micro status LED
        const ledGeo = new THREE.BoxGeometry(0.06, 0.03, 0.06);
        const ledMat = new THREE.MeshStandardMaterial({
          color: info.status === "critical" ? "#ef4444" : info.status === "warning" ? "#f59e0b" : "#10b981",
          emissive: info.status === "critical" ? "#ef4444" : info.status === "warning" ? "#f59e0b" : "#10b981",
          emissiveIntensity: 1.5
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(modW * 0.4, modH * 0.38, -modD * 0.38);
        singleModGroup.add(led);

        modulesGroup.add(singleModGroup);
      }
    }

    // 4. INTER-MODULE HIGH-CURRENT BUSBARS & CROSS BRACES
    for (let c = 0; c < 4; c++) {
      const z = startZ + c * (modD + gapZ);
      const crossBus = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.06, 0.12), matCopper);
      crossBus.position.set(0, 0.24, z);
      busbarsGroup.add(crossBus);
    }
    // Heavy longitudinal braces
    [-1.85, 1.85].forEach(x => {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 5.2), matAluminum);
      brace.position.set(x, 0.28, 0);
      busbarsGroup.add(brace);
    });

    // 5. BATTERY MANAGEMENT SYSTEM (BMS) MASTER CONTROLLER
    const bmsBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.1), matDarkChassis);
    bmsBox.position.set(0, 0.05, 3.1);
    bmsGroup.add(bmsBox);

    const bmsBoard = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.9), matPcbGreen);
    bmsBoard.position.set(0, 0.23, 3.1);
    bmsGroup.add(bmsBoard);

    // Heatsink fins on BMS
    for (let f = 0; f < 6; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.7), matAluminum);
      fin.position.set(-0.4 + f * 0.16, 0.28, 3.1);
      bmsGroup.add(fin);
    }

    // BMS pulsating indicator LEDs
    const bmsLedMat = new THREE.MeshStandardMaterial({
      color: "#00f2fe", emissive: "#00f2fe", emissiveIntensity: 2.0
    });
    const bmsLed = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), bmsLedMat);
    bmsLed.position.set(0.55, 0.26, 3.35);
    bmsGroup.add(bmsLed);

    // 6. HIGH VOLTAGE (HV) DISTRIBUTION & JUNCTION BOX
    // Heavy orange HV cables with curve
    const cableMat = matHvOrange;
    const curvePointsPos = [
      new THREE.Vector3(2.5, 0.15, -2.6),
      new THREE.Vector3(3.2, 0.35, -2.9),
      new THREE.Vector3(3.6, 0.45, -3.3)
    ];
    const curvePos = new THREE.CatmullRomCurve3(curvePointsPos);
    const cablePos = new THREE.Mesh(new THREE.TubeGeometry(curvePos, 20, 0.08, 12, false), cableMat);
    hvGroup.add(cablePos);

    const curvePointsNeg = [
      new THREE.Vector3(-2.5, 0.15, -2.6),
      new THREE.Vector3(-3.2, 0.35, -2.9),
      new THREE.Vector3(-3.6, 0.45, -3.3)
    ];
    const curveNeg = new THREE.CatmullRomCurve3(curvePointsNeg);
    const cableNeg = new THREE.Mesh(new THREE.TubeGeometry(curveNeg, 20, 0.08, 12, false), cableMat);
    hvGroup.add(cableNeg);

    // HV Bulkhead Terminals (Positive Red, Negative Silver)
    const termPos = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.35, 16), new THREE.MeshStandardMaterial({ color: "#dc2626", metalness: 0.6 }));
    termPos.position.set(3.6, 0.45, -3.3);
    hvGroup.add(termPos);

    const termNeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.35, 16), new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.8 }));
    termNeg.position.set(-3.6, 0.45, -3.3);
    hvGroup.add(termNeg);

    // Pyro-fuse manual service disconnect (MSD) safety block
    const msdBlock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.5), matHvOrange);
    msdBlock.position.set(0, 0.32, -2.75);
    hvGroup.add(msdBlock);

    // 7. TRANSLUCENT LEXAN TOP COVER & SEAL GASKET
    const topLid = new THREE.Mesh(new THREE.BoxGeometry(8.15, 0.08, 5.75), matLexanGlass);
    topLid.position.set(0, 0.48, 0);
    topLid.castShadow = true;
    lidGroup.add(topLid);

    // Top protective perimeter rim frame
    const lidFrame = new THREE.Mesh(new THREE.BoxGeometry(8.25, 0.12, 5.85), matAluminum);
    lidFrame.position.set(0, 0.48, 0);
    lidGroup.add(lidFrame);

    // High Voltage Warning Emblem on cover
    const warningLabelMat = new THREE.MeshBasicMaterial({ color: "#facc15" });
    const warningDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), warningLabelMat);
    warningDecal.rotation.x = -Math.PI / 2;
    warningDecal.position.set(0, 0.53, 0);
    lidGroup.add(warningDecal);

    // HOLOGRAPHIC SELECTION BOX
    const highlightBox = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(modW, modH, modD)), 0x00f2fe);
    highlightBox.visible = false;
    scene.add(highlightBox);

    // RAYCASTING FOR INTERACTIVE CELL INSPECTION
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(moduleMeshes, false);
      if (intersects.length > 0) {
        renderer.domElement.style.cursor = "pointer";
        const hit = intersects[0].object;
        highlightBox.setFromObject(hit);
        highlightBox.visible = true;
      } else {
        renderer.domElement.style.cursor = "grab";
        if (!selectedModule) {
          highlightBox.visible = false;
        }
      }
    };

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(moduleMeshes, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        setSelectedModule(hit.userData.info);
        highlightBox.setFromObject(hit);
        highlightBox.visible = true;
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);

    // RESIZE OBSERVER
    let disposed = false;
    const handleResize = () => {
      if (disposed || !el) return;
      const w = el.clientWidth || 600;
      const h = el.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(el);

    // ANIMATION LOOP
    let animId = 0;
    let clock = new THREE.Clock();

    const animate = () => {
      if (disposed) return;
      const elapsedTime = clock.getElapsedTime();

      // Exploded View dynamic positioning
      const exp = explodedRef.current;
      lidGroup.position.y = exp * 3.8;
      busbarsGroup.position.y = exp * 1.8;
      hvGroup.position.y = exp * 1.4;
      bmsGroup.position.y = exp * 1.2;
      modulesGroup.position.y = exp * 0.45;
      coolingGroup.position.y = -exp * 1.2;
      trayGroup.position.y = -exp * 2.2;

      // Pulse BMS Status LED
      bmsLedMat.emissiveIntensity = 1.0 + Math.sin(elapsedTime * 6) * 0.8;

      // Color Mode updates
      const currentMode = viewModeRef.current;
      moduleMeshes.forEach((mesh, i) => {
        const d = moduleData[i];
        if (currentMode === "thermal") {
          mesh.material.color = getThermalColor(d.temp, 22, 48);
          mesh.material.emissive = getThermalColor(d.temp, 22, 48).multiplyScalar(0.2);
          mesh.material.opacity = 1.0;
          mesh.material.transparent = false;
        } else if (currentMode === "voltage") {
          const vNorm = (d.volt - 3.2) / (4.2 - 3.2);
          mesh.material.color.setHSL(0.58 + vNorm * 0.25, 0.9, 0.5);
          mesh.material.emissive.setHex(0x000000);
          mesh.material.opacity = 1.0;
          mesh.material.transparent = false;
        } else if (currentMode === "xray") {
          mesh.material.color.setHex(d.status === "critical" ? 0xef4444 : 0x00f2fe);
          mesh.material.emissive.setHex(d.status === "critical" ? 0xb91c1c : 0x005577);
          mesh.material.opacity = 0.55;
          mesh.material.transparent = true;
          matLexanGlass.opacity = 0.15;
          matDarkChassis.opacity = 0.45;
          matDarkChassis.transparent = true;
        } else {
          // Status mode
          const col = d.status === "critical" ? "#ef4444" : d.status === "warning" ? "#f59e0b" : "#10b981";
          const em = d.status === "critical" ? "#b91c1c" : d.status === "warning" ? "#b45309" : "#047857";
          mesh.material.color.set(col);
          mesh.material.emissive.set(em);
          mesh.material.opacity = 1.0;
          mesh.material.transparent = false;
          matLexanGlass.opacity = 0.55;
          matDarkChassis.opacity = 1.0;
          matDarkChassis.transparent = false;
        }
      });

      controls.update();
      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [moduleData]);

  // Update controls auto-rotation
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 1.2;
    }
  }, [autoRotate]);

  // Camera preset transitions
  const applyPreset = (preset) => {
    setActivePreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === "iso") {
      camera.position.set(11.5, 8.5, 12.5);
      controls.target.set(0, 0, 0);
    } else if (preset === "top") {
      camera.position.set(0.01, 16.5, 0.01);
      controls.target.set(0, 0, 0);
    } else if (preset === "terminals") {
      camera.position.set(0, 5.2, -9.8);
      controls.target.set(0, 0, -2);
    } else if (preset === "side") {
      camera.position.set(14.5, 1.8, 0);
      controls.target.set(0, 0, 0);
    }
  };

  const handleZoom = (direction) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const factor = direction === "in" ? 0.8 : 1.25;
    camera.position.multiplyScalar(factor);
    controls.update();
  };

  return (
    <div className={`battery-digital-twin ${compact ? "compact-twin" : ""} ${isFullscreen ? "fullscreen-twin" : ""}`}>
      {/* 3D Model Header Bar */}
      <div className="twin-header">
        <div className="twin-title-group">
          <div className="live-badge">
            <span className="live-dot" />
            <b>3D DIGITAL TWIN</b>
          </div>
          <span className="pack-spec-tag">800V Architecture · 16S Module Matrix</span>
        </div>

        {/* View Mode Pills */}
        <div className="view-mode-selector">
          <button 
            className={viewMode === "status" ? "active" : ""} 
            onClick={() => setViewMode("status")}
            title="Real-time Health Status"
          >
            <CheckCircle2 size={13} /> Status
          </button>
          <button 
            className={viewMode === "thermal" ? "active" : ""} 
            onClick={() => setViewMode("thermal")}
            title="Thermal Heatmap Gradient"
          >
            <Flame size={13} /> Thermal
          </button>
          <button 
            className={viewMode === "voltage" ? "active" : ""} 
            onClick={() => setViewMode("voltage")}
            title="Cell Voltage Distribution"
          >
            <Zap size={13} /> Voltage
          </button>
          <button 
            className={viewMode === "xray" ? "active" : ""} 
            onClick={() => setViewMode("xray")}
            title="X-Ray Semi-Transparent Casing"
          >
            <Eye size={13} /> X-Ray
          </button>
        </div>

        {/* Quick Tools */}
        <div className="twin-action-tools">
          <button 
            className={`tool-btn ${autoRotate ? "active" : ""}`} 
            onClick={() => setAutoRotate(!autoRotate)} 
            title="Toggle Continuous Orbit"
          >
            <RotateCw size={14} />
          </button>
          <button className="tool-btn" onClick={() => handleZoom("in")} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button className="tool-btn" onClick={() => handleZoom("out")} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <button className="tool-btn" onClick={() => applyPreset("iso")} title="Reset Camera">
            <RefreshCw size={14} />
          </button>
          {!compact && (
            <button 
              className="tool-btn" 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              title={isFullscreen ? "Exit Fullscreen" : "Maximize 3D Station"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Canvas Viewport */}
      <div className="canvas-wrapper">
        <div className="three-viewport" ref={hostRef} />

        {/* Floating Camera Angle Selector (Overlay) */}
        <div className="camera-overlay-dock">
          <span className="dock-label"><Compass size={11} /> Angles:</span>
          {["iso", "top", "terminals", "side"].map(p => (
            <button 
              key={p} 
              className={activePreset === p ? "active" : ""} 
              onClick={() => applyPreset(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Exploded View Interactive Slider (Overlay) */}
        <div className="explosion-slider-dock">
          <Layers size={13} />
          <span className="slider-label">Exploded View:</span>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={exploded} 
            onChange={(e) => setExploded(parseFloat(e.target.value))}
            title="Disassemble Pack Layers"
          />
          <span className="slider-val">{Math.round(exploded * 100)}%</span>
        </div>

        {/* Dynamic Thermal / Status Legend (Overlay) */}
        {viewMode === "thermal" ? (
          <div className="thermal-legend-dock">
            <div className="legend-gradient" />
            <div className="legend-labels">
              <span>22°C (Cool)</span>
              <span>32°C (Nominal)</span>
              <span>42°C+ (Hot)</span>
            </div>
          </div>
        ) : (
          <div className="status-legend-dock">
            <span><i className="status-dot normal" /> Normal</span>
            <span><i className="status-dot warning" /> Warning</span>
            <span><i className="status-dot critical" /> Anomaly</span>
          </div>
        )}

        {/* Selected Module Detail HUD Card */}
        {selectedModule && (
          <div className="module-inspector-hud">
            <div className="hud-header">
              <div className="hud-title">
                <Info size={14} />
                <b>{selectedModule.name}</b>
              </div>
              <button className="hud-close" onClick={() => setSelectedModule(null)}>✕</button>
            </div>
            <div className="hud-grid">
              <div className="hud-metric">
                <span className="hud-label">Voltage</span>
                <span className="hud-val">{selectedModule.volt} <small>V</small></span>
              </div>
              <div className="hud-metric">
                <span className="hud-label">Temperature</span>
                <span className="hud-val" style={{ color: selectedModule.temp > 37 ? "#ef4444" : "#10b981" }}>
                  {selectedModule.temp} <small>°C</small>
                </span>
              </div>
              <div className="hud-metric">
                <span className="hud-label">Internal Res.</span>
                <span className="hud-val">{selectedModule.res} <small>mΩ</small></span>
              </div>
              <div className="hud-metric">
                <span className="hud-label">Health (SoH)</span>
                <span className="hud-val">{selectedModule.soh} <small>%</small></span>
              </div>
            </div>
            <div className={`hud-badge ${selectedModule.status}`}>
              {selectedModule.status === "critical" ? (
                <>
                  <AlertCircle size={13} />
                  <span>Thermal runaway / cell imbalance detected</span>
                </>
              ) : selectedModule.status === "warning" ? (
                <>
                  <AlertCircle size={13} />
                  <span>Degradation advisory threshold reached</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  <span>Operating within optimal design limits</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3D Footer Bar */}
      <div className="twin-footer">
        <span className="interaction-tip">
          🖱️ <b>Rotate:</b> Left Click + Drag · <b>Pan:</b> Right Click + Drag · <b>Zoom:</b> Scroll · <b>Inspect:</b> Click any cell module
        </span>
        <div className="pack-stats-micro">
          <span>Active Pack: <b>{telemetry.battery_id || "BATT_0001"}</b></span>
          <span>Chemistry: <b>{telemetry.chemistry || "NMC"}</b></span>
          <span>Pack Voltage: <b>{(baseVolt * 16).toFixed(1)} V</b></span>
        </div>
      </div>
    </div>
  );
}
