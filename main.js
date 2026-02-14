import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

let scene, camera, renderer;
let heartPoints, galaxyPoints;
let scaleTarget = 1;
let rotationTarget = 0;

init();
animate();

function init() {

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 6;

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("three-canvas"),
    antialias: true
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  createGalaxy();
  createHeart();
  setupWebcamGesture();
}

function createHeart() {

  const geometry = new THREE.BufferGeometry();
  const vertices = [];

  for (let i = 0; i < 2000; i++) {
    let t = Math.random() * Math.PI * 2;
    let x = 16 * Math.pow(Math.sin(t), 3);
    let y = 13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t);

    vertices.push(x*0.04, y*0.04, (Math.random()-0.5)*0.4);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  const material = new THREE.PointsMaterial({
    color: 0xff3366,
    size: 0.05
  });

  heartPoints = new THREE.Points(geometry, material);
  scene.add(heartPoints);
}

function createGalaxy() {

  const geometry = new THREE.BufferGeometry();
  const vertices = [];

  for (let i = 0; i < 6000; i++) {
    let r = Math.random() * 30;
    let angle = r * 0.3;
    let x = r * Math.cos(angle);
    let z = r * Math.sin(angle);
    let y = (Math.random()-0.5) * 2;

    vertices.push(x, y, z);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.05
  });

  galaxyPoints = new THREE.Points(geometry, material);
  scene.add(galaxyPoints);
}

function animate() {

  requestAnimationFrame(animate);

  // Smooth scale
  heartPoints.scale.lerp(new THREE.Vector3(scaleTarget, scaleTarget, scaleTarget), 0.1);

  // Rotation
  heartPoints.rotation.y += (rotationTarget - heartPoints.rotation.y) * 0.1;

  // Galaxy swirl
  galaxyPoints.rotation.y += 0.002;

  renderer.render(scene, camera);
}

function setupWebcamGesture() {

  import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3').then(async (vision) => {

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
    document.body.appendChild(video);

    const stream = await navigator.mediaDevices.getUserMedia({video:true});
    video.srcObject = stream;
    await video.play();

    async function detect() {

      const now = performance.now();
      const results = handLandmarker.detectForVideo(video, now);

      if (results.landmarks.length > 0) {
        const lm = results.landmarks[0];

        const thumb = lm[4];
        const index = lm[8];

        const dx = thumb.x - index.x;
        const dy = thumb.y - index.y;
        const pinch = Math.sqrt(dx*dx + dy*dy);

        scaleTarget = 0.5 + pinch * 5;

        const wrist = lm[0];
        rotationTarget = (wrist.x - 0.5) * 6;
      }

      requestAnimationFrame(detect);
    }

    detect();
  });
}
