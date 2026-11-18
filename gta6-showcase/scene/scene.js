// =============================================================================
// MacBook Pro 14" (Space Gray) on a dark walnut desk — deterministic renderer.
// The website frames are composited into the display texture each frame.
// =============================================================================
import * as THREE from 'three';
import * as TL from '../render/timeline.mjs';
import { buildMacbook } from './macbook.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1920);
const H = Number(q.get('h') || 1080);
const SW = Number(q.get('sw') || 3024);
const SH = Math.round((SW * 1964) / 3024);

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const M = buildMacbook({ renderer, TL, SW, SH, aspect: W / H });
const { scene, camera } = M;

// ---------------------------------------------------------------- frame
async function frame(t, b64) {
  const cam = TL.camera(t);
  camera.position.set(...cam.pos);
  camera.fov = cam.fov; camera.updateProjectionMatrix();
  camera.lookAt(...cam.target);
  M.dof.uFocus.value = cam.focus;
  const power = TL.screenPower(t);
  const target = M.projectedScreenWidth();
  if (b64) {
    const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
    const bmp = await createImageBitmap(blob);
    M.updateScreen(bmp, target);
    bmp.close();
  } else if (power <= 0) {
    M.clearScreen();
  }
  M.applyScreen(power);
  M.setBacklight(TL.backlight(t));
  renderer.render(scene, camera);
  return { target: Math.round(target) };
}

// ---------------------------------------------------------------- boot
const ready = (async () => {
  await M.init();
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  return true;
})();

window.__scene = { ready, frame, W, H, SW, SH };
window.__dbg = { scene, renderer, camera, THREE, lights: M.lights, desk: M.desk, laptop: M.laptop };
