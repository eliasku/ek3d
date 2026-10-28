import { HTMLMesh } from "ek3d/addons/interactive/HTMLMesh";
import type { HTMLCanvasPointerEvent } from "ek3d/addons/interactive/HTMLMesh";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Raycaster } from "ek3d/core/Raycaster";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing HTMLMesh example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const scene = new Scene();
scene.background = new Color(0x151515);

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10);
camera.position.set(0, 0, 2.2);

// Torus knot, rebuilt from the GUI values that are shown on the 3D plane.

const params = {
  radius: 0.22,
  tube: 0.08,
  tubularSegments: 64,
  radialSegments: 8,
  p: 2,
  q: 3,
  spin: false,
};

const torus = new Mesh<MeshNormalMaterial>(createTorusGeometry(), new MeshNormalMaterial());
torus.position.set(0.42, 0, -0.4);
scene.add(torus);

function createTorusGeometry(): TorusKnotGeometry {
  return new TorusKnotGeometry(
    params.radius,
    params.tube,
    params.tubularSegments,
    params.radialSegments,
    params.p,
    params.q,
  );
}

function rebuildTorus(): void {
  const geometry = torus.geometry;
  torus.geometry = createTorusGeometry();
  geometry.dispose();
}

// The GUI stays laid out and focusable for the 3D copy, but is transparent and click-through on
// the page itself: `visibility: hidden` would also block focus for text fields driven from the mesh.
const gui = new GUI({ width: 300, title: "Torus knot" });
gui.domElement.style.opacity = "0";
gui.domElement.style.pointerEvents = "none";

gui.add(params, "radius", 0.1, 0.4, 0.01).onChange(rebuildTorus);
gui.add(params, "tube", 0.02, 0.16, 0.01).onChange(rebuildTorus);
gui.add(params, "tubularSegments", 8, 128, 1).onChange(rebuildTorus);
gui.add(params, "radialSegments", 3, 24, 1).onChange(rebuildTorus);
gui.add(params, "p", 1, 10, 1).onChange(rebuildTorus);
gui.add(params, "q", 1, 10, 1).onChange(rebuildTorus);
gui.add(params, "spin");

// The GUI DOM as a textured plane. Mesh pointer events are replayed on the DOM widgets,
// so clicking the plane edits the GUI that is painted on it.

const htmlMesh = new HTMLMesh(gui.domElement);
htmlMesh.position.set(-0.33, 0, 0.4);
htmlMesh.scale.setScalar(2.2); // the plane is one texture pixel per 0.001 world units
scene.add(htmlMesh);

const raycaster = new Raycaster();
const pointer = new Vector2();
const meshEventData = new Vector2();
const meshEvent: HTMLCanvasPointerEvent = { type: "", data: meshEventData };
let hits = 0;

function forwardPointer(event: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const intersections = raycaster.intersectObject(htmlMesh, false);
  const intersection = intersections.length > 0 ? intersections[0] : undefined;
  canvas.dataset.hit = String(intersection !== undefined);

  if (intersection === undefined || intersection.uv === undefined) return;

  // Texture rows run top-down, the mesh UV origin is bottom-left.
  meshEventData.set(intersection.uv.x, 1 - intersection.uv.y);
  meshEvent.type = event.type;
  htmlMesh.dispatchEvent(meshEvent);

  hits++;
  canvas.dataset.hits = String(hits);
  canvas.dataset.lastEvent = event.type;
}

// Only mouse event types are forwarded: HTMLMesh replays them as MouseEvent instances, which is
// what the rasterized widgets listen to.
canvas.addEventListener("mousemove", forwardPointer);
canvas.addEventListener("mousedown", forwardPointer);
canvas.addEventListener("mouseup", forwardPointer);
canvas.addEventListener("click", forwardPointer);

// Renderer

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, MeshNormalMaterial: normalShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const stats = new Stats();
document.body.appendChild(stats.dom);

let frames = 0;
let updates = 0;
let lastVersion = htmlMesh.texture.version;

renderer.setAnimationLoop(animate);

function animate(): void {
  if (params.spin) {
    torus.rotation.y += 0.01;
    torus.rotation.x += 0.005;
  }

  renderer.render(scene, camera);
  stats.update();

  if (htmlMesh.texture.version !== lastVersion) {
    lastVersion = htmlMesh.texture.version;
    updates++;
  }

  frames++;
  canvas.dataset.frames = String(frames);
  canvas.dataset.params = JSON.stringify(params);
  canvas.dataset.controllers = String(gui.controllers.length);
  canvas.dataset.updates = String(updates);
  canvas.dataset.domSize = `${gui.domElement.offsetWidth}x${gui.domElement.offsetHeight}`;
  canvas.dataset.textureSize = `${htmlMesh.texture.image?.width ?? 0}x${htmlMesh.texture.image?.height ?? 0}`;
  canvas.dataset.state = "rendered";
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    canvas.removeEventListener("mousemove", forwardPointer);
    canvas.removeEventListener("mousedown", forwardPointer);
    canvas.removeEventListener("mouseup", forwardPointer);
    canvas.removeEventListener("click", forwardPointer);
    renderer.setAnimationLoop(null);
    htmlMesh.dispose();
    torus.geometry.dispose();
    torus.material.dispose();
    gui.destroy();
    stats.dom.remove();
    renderer.dispose();
  },
  { once: true },
);
