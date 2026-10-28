import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Blending, ColorSpace } from "ek3d/constants";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing snow sprites canvas");
const canvas = selected;
let disposed = false,
  pending = 5,
  frames = 0,
  mouseX = 0,
  mouseY = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(75, innerWidth / innerHeight, 1, 2000);
camera.position.z = 1000;
const scene = new Scene();
scene.fog = new FogExp2(0, 0.0008);
const vertices: number[] = [];
for (let i = 0; i < 10000; i++)
  vertices.push(Math.random() * 2000 - 1000, Math.random() * 2000 - 1000, Math.random() * 2000 - 1000);
const geometry = new BufferGeometry();
geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
const loader = new TextureLoader();
const textures = [1, 2, 3, 4, 5].map((i) => {
  const texture = loader.load(
    `/examples/textures/sprites/snowflake${i}.png`,
    (value) => {
      if (disposed) value.dispose();
      else {
        value.colorSpace = ColorSpace.SRGB;
        pending--;
      }
    },
    undefined,
    (error) => {
      if (disposed) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
  return texture;
});
const parameters = [
  { h: 1, s: 0.2, l: 0.5, map: textures[1], size: 20 },
  { h: 0.95, s: 0.1, l: 0.5, map: textures[2], size: 15 },
  { h: 0.9, s: 0.05, l: 0.5, map: textures[0], size: 10 },
  { h: 0.85, s: 0, l: 0.5, map: textures[4], size: 8 },
  { h: 0.8, s: 0, l: 0.5, map: textures[3], size: 5 },
];
const materials = parameters.map((p) => {
  const material = new PointsMaterial({
    size: p.size,
    map: p.map,
    blending: Blending.Additive,
    depthTest: false,
    transparent: true,
  });
  material.color.setHSL(p.h, p.s, p.l, ColorSpace.SRGB);
  const particles = new Points(geometry, material);
  particles.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  scene.add(particles);
  return material;
});
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true, shaders: { PointsMaterial: pointsShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
const settings = { texture: true };
gui.add(settings, "texture").onChange(() => {
  materials.forEach((material, i) => {
    material.map = settings.texture ? parameters[i].map : null;
    material.needsUpdate = true;
  });
});
gui.open();
function pointer(event: PointerEvent): void {
  if (event.isPrimary) {
    mouseX = event.clientX - innerWidth / 2;
    mouseY = event.clientY - innerHeight / 2;
  }
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  const time = Date.now() * 0.00005;
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  scene.children.forEach((object, i) => {
    object.rotation.y = time * (i < 4 ? i + 1 : -(i + 1));
  });
  materials.forEach((material, i) => {
    const p = parameters[i];
    material.color.setHSL(((360 * (p.h + time)) % 360) / 360, p.s, p.l, ColorSpace.SRGB);
  });
  renderer.render(scene, camera);
  if (!pending && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  stats.update();
}
document.body.style.touchAction = "none";
document.body.addEventListener("pointermove", pointer);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.body.removeEventListener("pointermove", pointer);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  textures.forEach((texture) => texture.dispose());
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
