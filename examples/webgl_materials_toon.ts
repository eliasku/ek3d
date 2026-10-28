import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { Stats } from "ek3d/addons/libs/Stats";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BackSide, RedFormat } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import type { Material } from "ek3d/materials/Material";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshToonMaterial } from "ek3d/materials/MeshToonMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { toonShader } from "ek3d/renderers/shaders/ToonShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { DataTexture } from "ek3d/textures/DataTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing toon canvas");
const canvas = selected;
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 2500);
camera.position.set(0, 400, 1400);
const scene = new Scene();
scene.background = new Color(0x444488);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  shaders: { MeshBasicMaterial: basicShader, MeshToonMaterial: toonShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 200;
controls.maxDistance = 2000;
const stats = new Stats();
document.body.appendChild(stats.dom);
const manager = new LoadingManager();
let disposed = false;
let frames = 0;
canvas.dataset.state = "loading";
const outline = new ShaderMaterial({
  side: BackSide,
  vertexShader: `void main() {
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 pos2 = projectionMatrix * modelViewMatrix * vec4(position - normal, 1.0);
    gl_Position = pos + normalize(pos - pos2) * 0.003 * pos.w;
  }`,
  fragmentShader: `void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`,
});
const meshes: Mesh<Material>[] = [];
const particle = new Mesh<Material>(new SphereGeometry(4, 8, 8), new MeshBasicMaterial({ color: 0xffffff }));
particle.add(new PointLight(0xffffff, 2, 800, 0));
scene.add(particle, new AmbientLight(0xc1c1c1, 3));
meshes.push(particle);
new FontLoader(manager).load(
  "/examples/fonts/gentilis_regular.typeface.json",
  (font) => {
    if (disposed) return;
    const geometry = new SphereGeometry(32, 32, 16);
    for (let alpha = 0, index = 0; alpha <= 1; alpha += 0.2, index++) {
      const colors = new Uint8Array(index + 2);
      for (let c = 0; c < colors.length; c++) colors[c] = (c / colors.length) * 256;
      const gradientMap = new DataTexture(colors, colors.length, 1, RedFormat);
      gradientMap.needsUpdate = true;
      for (let beta = 0; beta <= 1; beta += 0.2)
        for (let gamma = 0; gamma <= 1; gamma += 0.2) {
          const color = new Color().setHSL(alpha, 0.5, gamma * 0.5 + 0.1).multiplyScalar(1 - beta * 0.2);
          const mesh = new Mesh<Material>(geometry, new MeshToonMaterial({ color, gradientMap }));
          mesh.position.set(alpha * 400 - 200, beta * 400 - 200, gamma * 400 - 200);
          scene.add(mesh);
          meshes.push(mesh);
        }
    }
    function label(name: string, position: Vector3): void {
      const mesh = new Mesh<Material>(
        new TextGeometry(name, { font, size: 20, depth: 1, curveSegments: 1 }),
        new MeshBasicMaterial(),
      );
      mesh.position.copy(position);
      scene.add(mesh);
      meshes.push(mesh);
    }
    label("-gradientMap", new Vector3(-350, 0, 0));
    label("+gradientMap", new Vector3(350, 0, 0));
    label("-diffuse", new Vector3(0, 0, -300));
    label("+diffuse", new Vector3(0, 0, 300));
    canvas.dataset.state = "rendered";
  },
  undefined,
  (error) => {
    if (!disposed) {
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    }
  },
);
renderer.setAnimationLoop(() => {
  stats.begin();
  const timer = Date.now() * 0.00025;
  particle.position.set(Math.sin(timer * 7) * 300, Math.cos(timer * 5) * 400, Math.cos(timer * 3) * 300);
  renderer.render(scene, camera);
  const materials = meshes.map((mesh) => mesh.material);
  for (const mesh of meshes) mesh.material = outline;
  const background = scene.background;
  scene.background = null;
  renderer.autoClear = false;
  renderer.render(scene, camera);
  renderer.autoClear = true;
  scene.background = background;
  meshes.forEach((mesh, index) => {
    mesh.material = materials[index];
  });
  stats.end();
  canvas.dataset.frames = String(++frames);
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  disposeObject(scene);
  outline.dispose();
  stats.dom.remove();
  renderer.dispose();
});
