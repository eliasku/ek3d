import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Vector3 } from "ek3d/math/Vector3";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { TextureType } from "ek3d/constants";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { Stats } from "ek3d/addons/libs/Stats";

const wrapper = document.querySelector<HTMLDivElement>("#wrapper");
if (wrapper === null) throw new Error("Missing depth comparison wrapper");
const original = document.querySelector<HTMLCanvasElement>("#scene");
if (original === null) throw new Error("Missing depth comparison canvas");
const canvas = original;
const camera = new PerspectiveCamera(72, window.innerWidth / 3 / window.innerHeight, 5, 9999);
camera.position.z = 12;
const reverseCamera = camera.clone();
const scene = new Scene();
const d = 0.0001;
const o = 0.5;
const positions = [
  -1 - o,
  -1,
  d,
  1 - o,
  -1,
  d,
  -1 - o,
  1,
  d,
  1 - o,
  -1,
  d,
  1 - o,
  1,
  d,
  -1 - o,
  1,
  d,
  -1 + o,
  -1,
  -d,
  1 + o,
  -1,
  -d,
  -1 + o,
  1,
  -d,
  1 + o,
  -1,
  -d,
  1 + o,
  1,
  -d,
  -1 + o,
  1,
  -d,
];
const colors = Array.from({ length: 12 }, (_, index) => (index < 6 ? [1, 0, 0] : [0, 1, 0])).flat();
const geometry = new BufferGeometry();
geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
const material = new MeshBasicMaterial({ vertexColors: true });
const meshes: Mesh[] = [];
for (let i = 0; i < 5; i++) {
  const mesh = new Mesh(geometry, material);
  const z = -800 * i;
  mesh.position.set(0, (4 - 0.2 * z) * (i - 2.5 + 1), z);
  mesh.scale.setScalar(1 + 50 * i);
  scene.add(mesh);
  meshes.push(mesh);
}
const stats = new Stats();
document.body.appendChild(stats.dom);
const views = ["normal z-buffer", "logarithmic z-buffer", "reverse z-buffer"].map((label, index) => {
  const surface = index === 0 ? canvas : document.createElement("canvas");
  if (index !== 0) wrapper.appendChild(surface);
  surface.style.left = `${(index * 100) / 3}%`;
  surface.style.width = "33.333333%";
  surface.style.right = "auto";
  const caption = document.createElement("div");
  caption.textContent = label;
  caption.style.cssText = `position:absolute;bottom:1em;left:${(index * 100) / 3}%;width:33.333333%;text-align:center;color:white;pointer-events:none`;
  wrapper.appendChild(caption);
  const renderer = new WebGLRenderer({
    canvas: surface,
    logarithmicDepthBuffer: index === 1,
    reversedDepthBuffer: index === 2,
    shaders: { MeshBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  const target = new WebGLRenderTarget();
  target.depthTexture = new DepthTexture(1, 1);
  target.depthTexture.type = TextureType.Float;
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, index === 2 ? reverseCamera : camera);
  const output = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(output);
  if (index === 2 && !renderer.capabilities.reversedDepthBuffer) {
    caption.textContent = "reverse z-buffer: EXT_clip_control unavailable";
    surface.dataset.extension = "unsupported";
  }
  return { surface, renderer, composer, renderPass, output };
});
function resize(): void {
  const width = window.innerWidth / 3;
  const height = window.innerHeight;
  for (const { renderer, composer } of views) {
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
  }
  for (const viewCamera of [camera, reverseCamera]) {
    viewCamera.aspect = width / height;
    viewCamera.updateProjectionMatrix();
  }
}
window.addEventListener("resize", resize);
resize();
const axis = new Vector3();
let frames = 0;
let disposed = false;
views[0]!.renderer.setAnimationLoop(() => {
  const now = performance.now() / 1000;
  axis.set(Math.sin(now), Math.cos(now), 0);
  for (const mesh of meshes) mesh.quaternion.setFromAxisAngle(axis, Math.PI / 6);
  for (const { composer, surface } of views) {
    composer.render();
    surface.dataset.state = "rendered";
    surface.dataset.frames = String(frames + 1);
  }
  frames++;
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  views[0]!.renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  for (const { renderer, composer, renderPass, output, surface } of views) {
    renderPass.dispose();
    output.dispose();
    composer.renderTarget1.depthTexture?.dispose();
    composer.renderTarget2.depthTexture?.dispose();
    composer.dispose();
    renderer.dispose();
    surface.dataset.state = "disposed";
  }
  geometry.dispose();
  material.dispose();
  stats.dom.remove();
});
