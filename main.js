import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

let scene, camera, renderer;

// GALAXY
let galaxyPoints = null, galaxyCore = null;

// HEART 3D INSTANCED + GLOW
let heartGroup = null;
let heartMesh = null;
let heartGlowMesh = null;

// Controls
let scaleTarget = 1.0;
let rotationTarget = 0.0;
let prevX = null;

let smoothScale = 1.0;
let smoothRot = 0.0;

let started = false;

init();
animate();

function $(id) { return document.getElementById(id); }

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg;
}

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 6;

  renderer = new THREE.WebGLRenderer({
    canvas: $("three-canvas"),
    antialias: true,
    alpha: false
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  addLights();

  createGalaxy();
  createHeart3DInstancedWithGlow();

  window.addEventListener("resize", onWindowResize);

  // Start button to satisfy webcam autoplay / permissions reliably
  const startBtn = $("startBtn");
  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      if (started) return;
      started = true;
      setStatus("Activando cámara...");
      try {
        await setupWebcamGesture();
        const overlay = $("overlay");
        if (overlay) overlay.style.display = "none";
      } catch (e) {
        console.error(e);
        setStatus("Error activando cámara. Revisa permisos o consola (F12).");
        started = false;
      }
    });
  }
}

function addLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.95);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  const dir2 = new THREE.DirectionalLight(0xffc0dd, 0.35);
  dir2.position.set(-4, 2, 3);
  scene.add(dir2);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// -----------------------------
// HEART 3D (InstancedMesh) + Glow Layer
// -----------------------------
function makeHeartShape2D() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.35);
  s.bezierCurveTo(0, 0.7, -0.6, 0.7, -0.6, 0.25);
  s.bezierCurveTo(-0.6, -0.15, -0.1, -0.35, 0, -0.65);
  s.bezierCurveTo(0.1, -0.35, 0.6, -0.15, 0.6, 0.25);
  s.bezierCurveTo(0.6, 0.7, 0, 0.7, 0, 0.35);
  return s;
}

function createHeart3DInstancedWithGlow() {
  const shape = makeHeartShape2D();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.20,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
    curveSegments: 16
  });
  geo.center();

  // Main material (real lighting)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff3b7a,
    metalness: 0.25,
    roughness: 0.35,
    transparent: true,
    opacity: 0.96,
    emissive: new THREE.Color(0xff2b66),
    emissiveIntensity: 0.25
  });

  // Glow material (cheap aura)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff66aa,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // Count (adjust for FPS)
  const N = 1200;

  heartMesh = new THREE.InstancedMesh(geo, mat, N);
  heartMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heartMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);

  heartGlowMesh = new THREE.InstancedMesh(geo, glowMat, N);
  heartGlowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heartGlowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);

  // For a nicer glow, render glow after main
  heartGlowMesh.renderOrder = 10;
  heartMesh.renderOrder = 5;

  const dummy = new THREE.Object3D();

  for (let i = 0; i < N; i++) {
    const t = Math.random() * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);

    const X = x * 0.06 + (Math.random() - 0.5) * 0.20;
    const Y = y * 0.06 + (Math.random() - 0.5) * 0.20;
    const Z = (Math.random() - 0.5) * 0.70;

    dummy.position.set(X, Y, Z);

    dummy.rotation.set(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 0.8
    );

    const s = 0.055 + Math.random() * 0.035;
    dummy.scale.set(s, s, s);

    dummy.updateMatrix();
    heartMesh.setMatrixAt(i, dummy.matrix);

    // Glow = same transform but slightly larger
    dummy.scale.set(s * 1.22, s * 1.22, s * 1.22);
    dummy.updateMatrix();
    heartGlowMesh.setMatrixAt(i, dummy.matrix);

    // Color variation (both)
    const r = 1.0;
    const g = 0.15 + Math.random() * 0.35;
    const b = 0.30 + Math.random() * 0.40;
    const c = new THREE.Color(r, g, b);

    heartMesh.setColorAt(i, c);
    heartGlowMesh.setColorAt(i, c);
  }

  heartMesh.instanceMatrix.needsUpdate = true;
  heartGlowMesh.instanceMatrix.needsUpdate = true;
  if (heartMesh.instanceColor) heartMesh.instanceColor.needsUpdate = true;
  if (heartGlowMesh.instanceColor) heartGlowMesh.instanceColor.needsUpdate = true;

  heartGroup = new THREE.Group();
  heartGroup.add(heartMesh);
  heartGroup.add(heartGlowMesh);
  heartGroup.position.set(0, 0, 0.0);

  scene.add(heartGroup);
}

// -----------------------------
// Galaxy swirl (arms)
// -----------------------------
function createGalaxy() {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];

  const arms = 3;
  const starCount = 9000;
  const radius = 32;

  for (let i = 0; i < starCount; i++) {
    const r = Math.pow(Math.random(), 0.55) * radius;

    const arm = Math.floor(Math.random() * arms);
    const armAngle = (arm / arms) * Math.PI * 2;

    const spin = Math.log(1 + r) * 2.2;

    const angleNoise = (Math.random() - 0.5) * 0.55;
    const radialNoise = (Math.random() - 0.5) * 0.9;

    const theta = armAngle + spin + angleNoise;

    const y = (Math.random() - 0.5) * 0.8 * (1.0 - r / radius);
    const rr = r + radialNoise;

    const x = Math.cos(theta) * rr;
    const z = Math.sin(theta) * rr;

    vertices.push(x, y, z);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  galaxyPoints = new THREE.Points(geometry, material);
  galaxyPoints.position.set(0, 0, -20);
  scene.add(galaxyPoints);

  // Core glow
  const coreGeom = new THREE.BufferGeometry();
  const coreVerts = [];

  for (let i = 0; i < 900; i++) {
    const rr = Math.pow(Math.random(), 2.2) * 2.2;
    const ang = Math.random() * Math.PI * 2;
    const yy = (Math.random() - 0.5) * 0.3;
    coreVerts.push(Math.cos(ang) * rr, yy, Math.sin(ang) * rr);
  }

  coreGeom.setAttribute("position", new THREE.Float32BufferAttribute(coreVerts, 3));

  const coreMat = new THREE.PointsMaterial({
    color: 0xffddff,
    size: 0.11,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  galaxyCore = new THREE.Points(coreGeom, coreMat);
  galaxyCore.position.set(0, 0, -20);
  scene.add(galaxyCore);
}

// -----------------------------
// Render loop
// -----------------------------
function animate() {
  requestAnimationFrame(animate);

  if (!heartGroup || !galaxyPoints) {
    renderer.render(scene, camera);
    return;
  }

  smoothScale += (scaleTarget - smoothScale) * 0.12;
  smoothRot += (rotationTarget - smoothRot) * 0.12;

  heartGroup.scale.set(smoothScale, smoothScale, smoothScale);
  heartGroup.rotation.y = smoothRot;

  // Boost when heart is tiny -> universe brightens and moves more
  const tinyStart = 0.95;
  const tinyFull = 0.70;
  const boost = Math.min(1, Math.max(0, (tinyStart - smoothScale) / (tinyStart - tinyFull)));

  // Galaxy motion
  galaxyPoints.rotation.y += 0.0015 + boost * 0.006;
  galaxyPoints.rotation.z += 0.0004;
  galaxyPoints.rotation.x = 0.35;

  const gScale = 1.0 + boost * 0.28;
  galaxyPoints.scale.set(gScale, gScale, gScale);

  if (galaxyCore) {
    galaxyCore.rotation.y += 0.002 + boost * 0.010;
    galaxyCore.material.opacity = 0.25 + boost * 0.75;
    const cScale = 1.0 + boost * 0.40;
    galaxyCore.scale.set(cScale, cScale, cScale);
  }

  // Glow reacts to boost (extra wow)
  if (heartGlowMesh) {
    heartGlowMesh.material.opacity = 0.12 + boost * 0.22; // more aura when tiny
  }

  renderer.render(scene, camera);
}

// -----------------------------
// MediaPipe gesture control
// -----------------------------
async function setupWebcamGesture() {
  const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3");

  const filesetResolver = await vision.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  const handLandmarker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    },
    runningMode: "VIDEO",
    numHands: 1
  });

  const video = document.createElement("video");
  video.style.display = "none";
  video.playsInline = true;
  video.muted = true;
  document.body.appendChild(video);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  setStatus("Cámara activa ✅");

  function detect() {
    const now = performance.now();
    const results = handLandmarker.detectForVideo(video, now);

    if (results.landmarks && results.landmarks.length > 0) {
      const lm = results.landmarks[0];

      // Pinch -> scale
      const thumb = lm[4];
      const index = lm[8];

      const pdx = thumb.x - index.x;
      const pdy = thumb.y - index.y;
      const pinch = Math.sqrt(pdx * pdx + pdy * pdy);

      scaleTarget = 0.7 + Math.min(1, Math.max(0, (pinch - 0.02) / 0.18)) * 2.2;

      // Wrist movement -> rotation (delta)
      const wrist = lm[0];
      if (prevX === null) prevX = wrist.x;

      const mx = wrist.x - prevX;
      prevX = wrist.x;

      rotationTarget += mx * 12;
    } else {
      prevX = null;
      scaleTarget = scaleTarget * 0.97 + 1.0 * 0.03;
    }

    requestAnimationFrame(detect);
  }

  detect();
}