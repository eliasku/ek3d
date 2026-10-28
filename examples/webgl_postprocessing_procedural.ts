import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import chunk_common from "ek3d/renderers/shaders/ShaderChunk/common.glsl";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

const vertexShader = document.querySelector("#procedural-vert")!.textContent!.trim();

const fragment = (id: string) => document.querySelector(id)!.textContent!.trim();

// The `<script>` bodies use `#include <common>`; resolve the chunk at build time.
const materialFor = (id: string) =>
  new ShaderMaterial({ vertexShader, fragmentShader: fragment(id).replace("#include <common>", chunk_common) });

const noiseRandom1DMaterial = materialFor("#noiseRandom1D-frag");
const noiseRandom2DMaterial = materialFor("#noiseRandom2D-frag");
const noiseRandom3DMaterial = materialFor("#noiseRandom3D-frag");

const postMaterial = noiseRandom3DMaterial;

const postPlane = new PlaneGeometry(2, 2);
const postQuad = new Mesh(postPlane, postMaterial);
const postScene = new Scene();
postScene.add(postQuad);

const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const procedures = { 0: noiseRandom1DMaterial, 1: noiseRandom2DMaterial, 2: noiseRandom3DMaterial };
let procedure = 2;

let frames = 0;
let publishedFrames = -1;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.procedure = String(procedure);
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  postQuad.material = procedures[procedure as 0 | 1 | 2]!;

  renderer.render(postScene, postCamera);
  publishState();
  frames++;
}

renderer.setAnimationLoop(animate);

// Page check hooks (instead of lil-gui): 1–3 select the noise procedure.

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") procedure = 0;
  else if (event.code === "Digit2") procedure = 1;
  else if (event.code === "Digit3") procedure = 2;
});

function onWindowResize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    postPlane.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
