import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { DodecahedronGeometry } from "ek3d/geometries/DodecahedronGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#c");
const content = document.querySelector<HTMLDivElement>("#content");
if (!canvas || !content) throw new Error("Missing multiple-elements page elements");
const geometries = [
  new BoxGeometry(1, 1, 1),
  new SphereGeometry(0.5, 12, 8),
  new DodecahedronGeometry(0.5),
  new CylinderGeometry(0.5, 0.5, 1, 12),
];
const root = new Scene();
const views: {
  scene: Scene;
  element: HTMLDivElement;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  mesh: Mesh;
}[] = [];
for (let i = 0; i < 40; i++) {
  const scene = new Scene();
  root.add(scene);
  const item = document.createElement("div");
  item.className = "list-item";
  const element = document.createElement("div");
  const description = document.createElement("div");
  description.textContent = `Scene ${i + 1}`;
  item.append(element, description);
  content.appendChild(item);
  const camera = new PerspectiveCamera(50, 1, 1, 10);
  camera.position.z = 2;
  const controls = new OrbitControls(camera, element);
  controls.minDistance = 2;
  controls.maxDistance = 5;
  controls.enablePan = false;
  controls.enableZoom = false;
  const material = new MeshStandardMaterial({
    color: new Color().setHSL(Math.random(), 1, 0.75, SRGBColorSpace),
    roughness: 0.5,
    metalness: 0,
    flatShading: true,
  });
  const mesh = new Mesh(geometries[Math.floor(geometries.length * Math.random())], material);
  scene.add(mesh, new HemisphereLight(0xaaaaaa, 0x444444, 3));
  const light = new DirectionalLight(0xffffff, 1.5);
  light.position.set(1, 1, 1);
  scene.add(light);
  views.push({ scene, element, camera, controls, mesh });
}
const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  getDFGLUT: () => dfgLUT,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
let width = 0;
let height = 0;
let frames = 0;
let disposed = false;
canvas.dataset.state = "loading";
renderer.setAnimationLoop(() => {
  const newWidth = canvas.clientWidth;
  const newHeight = canvas.clientHeight;
  if (newWidth !== width || newHeight !== height) {
    width = newWidth;
    height = newHeight;
    renderer.setSize(width, height, false);
  }
  canvas.style.transform = `translateY(${window.scrollY}px)`;
  renderer.setClearColor(0xffffff);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setClearColor(0xe0e0e0);
  renderer.setScissorTest(true);
  for (const view of views) {
    view.mesh.rotation.y = Date.now() * 0.001;
    const rect = view.element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) continue;
    const bottom = height - rect.bottom;
    renderer.setViewport(rect.left, bottom, rect.width, rect.height);
    renderer.setScissor(rect.left, bottom, rect.width, rect.height);
    view.camera.aspect = rect.width / rect.height;
    view.camera.updateProjectionMatrix();
    renderer.render(view.scene, view.camera);
  }
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  for (const view of views) view.controls.dispose();
  disposeObject(root);
  for (const geometry of geometries) if (!views.some((view) => view.mesh.geometry === geometry)) geometry.dispose();
  dfgLUT.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
