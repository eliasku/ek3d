import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPixelatedPass } from "ek3d/addons/postprocessing/RenderPixelatedPass";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { TextureFilter, Wrapping, ColorSpace } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Euler } from "ek3d/math/Euler";
import { Quaternion } from "ek3d/math/Quaternion";
import { Spherical } from "ek3d/math/Spherical";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing pixelation canvas");
const aspect = innerWidth / innerHeight;
const camera = new OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
camera.position.set(0, 2 * Math.tan(Math.PI / 6), 2);
const scene = new Scene();
scene.background = new Color(0x151729);
const timer = new Timer();
timer.connect(document);
const renderer = new WebGLRenderer({
  canvas,
  createBackground: WebGLBackground,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader, MeshNormalMaterial: normalShader },
});
if (renderer.shadowMap) renderer.shadowMap.enabled = true;
renderer.setSize(innerWidth, innerHeight);
const composer = new EffectComposer(renderer);
const pixel = new RenderPixelatedPass(6, scene, camera);
composer.addPass(pixel);
composer.addPass(new OutputPass());
const controls = new OrbitControls(camera, canvas);
controls.maxZoom = 2;
const params = {
  pixelSize: 6,
  snapping: true,
  pixelAlignedPanning: true,
  pixelAlignedObjects: true,
  rotationSnap: 15,
  cameraRotationSnap: 9,
  cameraZoomSnap: 0.1,
};
const gui = new GUI();
gui
  .add(params, "pixelSize")
  .min(1)
  .max(16)
  .step(1)
  .onChange(() => pixel.setPixelSize(params.pixelSize));
gui.add(pixel, "normalEdgeStrength").min(0).max(2).step(0.05);
gui.add(pixel, "depthEdgeStrength").min(0).max(1).step(0.05);
const snapping = gui.add(params, "snapping").name("Enable Pixel Snapping");
const folder = gui.addFolder("Snapping").close();
snapping.onChange((enabled: unknown) =>
  folder.controllers.forEach((controller) => controller.enable(Boolean(enabled))),
);
folder.add(params, "pixelAlignedPanning");
folder.add(params, "pixelAlignedObjects");
folder.add(params, "rotationSnap").min(0).max(90).step(1).name("rotationSnap (deg, 0 = off)");
folder.add(params, "cameraRotationSnap").min(0).max(90).step(1).name("cameraRotationSnap (deg, 0 = off)");
folder.add(params, "cameraZoomSnap").min(0).max(1).step(0.05).name("cameraZoomSnap (0 = off)");
let disposed = false;
const loader = new TextureLoader();
const texture = loader.load("/examples/textures/checker.png", (map) => {
  if (disposed) map.dispose();
});
const texture2 = loader.load("/examples/textures/checker.png", (map) => {
  if (disposed) map.dispose();
});
for (const map of [texture, texture2]) {
  map.minFilter = TextureFilter.Nearest;
  map.magFilter = TextureFilter.Nearest;
  map.generateMipmaps = false;
  map.wrapS = Wrapping.Repeat;
  map.wrapT = Wrapping.Repeat;
  map.colorSpace = ColorSpace.SRGB;
}
texture.repeat.set(3, 3);
texture2.repeat.set(1.5, 1.5);
const boxMaterial = new MeshPhongMaterial({ map: texture2 });
for (const [size, x, z] of [
  [0.4, 0, 0],
  [0.5, -0.5, -0.5],
]) {
  const mesh = new Mesh(new BoxGeometry(size, size, size), boxMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.y = Math.PI / 4;
  mesh.position.set(x, size / 2 + 0.0001, z);
  scene.add(mesh);
}
const floor = new Mesh(new PlaneGeometry(2, 2), new MeshPhongMaterial({ map: texture }));
floor.receiveShadow = true;
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const crystal = new Mesh<MeshPhongMaterial>(
  new IcosahedronGeometry(0.2),
  new MeshPhongMaterial({ color: 0x68b7e9, emissive: 0x4f7e8b, shininess: 10, specular: 0xffffff }),
);
crystal.castShadow = true;
crystal.receiveShadow = true;
scene.add(crystal);
scene.add(new AmbientLight(0x757f8e, 3));
const directional = new DirectionalLight(0xfffecd, 1.5);
directional.position.set(100, 100, 100);
directional.castShadow = true;
directional.shadow.mapSize.set(2048, 2048);
scene.add(directional);
const spot = new SpotLight(0xffc100, 10, 10, Math.PI / 16, 0.02, 2);
spot.position.set(2, 2, 0);
spot.castShadow = true;
scene.add(spot.target);
scene.add(spot);
function resize(): void {
  const ratio = innerWidth / innerHeight;
  camera.left = -ratio;
  camera.right = ratio;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
function snapCamera(): void {
  if (params.cameraRotationSnap > 0) {
    const increment = (params.cameraRotationSnap * Math.PI) / 180;
    const offset = new Vector3().subVectors(camera.position, controls.target);
    const spherical = new Spherical().setFromVector3(offset);
    spherical.theta = Math.round(spherical.theta / increment) * increment;
    spherical.phi = Math.round(spherical.phi / increment) * increment;
    spherical.makeSafe();
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    camera.up.set(0, 1, 0);
    camera.lookAt(controls.target);
  }
  if (params.cameraZoomSnap > 0) {
    camera.zoom = Math.max(
      params.cameraZoomSnap,
      Math.round(camera.zoom / params.cameraZoomSnap) * params.cameraZoomSnap,
    );
    camera.updateProjectionMatrix();
  }
}
function basis(): [Vector3, Vector3, Vector3, Quaternion] {
  camera.updateMatrixWorld();
  const q = camera.getWorldQuaternion(new Quaternion());
  return [
    new Vector3(1, 0, 0).applyQuaternion(q),
    new Vector3(0, 1, 0).applyQuaternion(q),
    new Vector3(0, 0, -1).applyQuaternion(q),
    q,
  ];
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  const t = timer.getElapsed();
  crystal.material.emissiveIntensity = Math.round((Math.sin(t * 3) * 0.5 + 0.5) * 5) / 5;
  crystal.position.y = 0.7 + Math.sin(t * 2) * 0.05;
  const cycle = Math.floor(t / 8);
  const tween = Math.max(0, Math.min(1, (t - cycle * 8 - 6) / 2));
  crystal.rotation.y = (cycle + tween * tween * (3 - 2 * tween)) * 2 * Math.PI;
  const size = renderer.getSize(new Vector2());
  const ratio = size.x / size.y;
  const width = Math.max(1, Math.floor(size.x / params.pixelSize));
  const height = Math.max(1, Math.floor(size.y / params.pixelSize));
  const cameraPosition = camera.position.clone();
  const cameraQuaternion = camera.quaternion.clone();
  const zoom = camera.zoom;
  if (params.snapping) snapCamera();
  if (params.snapping && params.pixelAlignedPanning) {
    const pixelWidth = (camera.right - camera.left) / camera.zoom / width;
    const pixelHeight = (camera.top - camera.bottom) / camera.zoom / height;
    const [right, up] = basis();
    const position = camera.getWorldPosition(new Vector3());
    const x = position.dot(right) / pixelWidth;
    const y = position.dot(up) / pixelHeight;
    const dx = (x - Math.round(x)) * pixelWidth;
    const dy = (y - Math.round(y)) * pixelHeight;
    camera.left = -ratio - dx;
    camera.right = ratio - dx;
    camera.top = 1 - dy;
    camera.bottom = -1 - dy;
    camera.updateProjectionMatrix();
  } else {
    camera.left = -ratio;
    camera.right = ratio;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
  }
  const position = crystal.position.clone();
  const rotation = crystal.rotation.clone();
  if (params.snapping && params.pixelAlignedObjects) {
    const pw = (camera.right - camera.left) / camera.zoom / width;
    const ph = (camera.top - camera.bottom) / camera.zoom / height;
    const [right, up, forward] = basis();
    const x = Math.round(crystal.position.dot(right) / pw) * pw;
    const y = Math.round(crystal.position.dot(up) / ph) * ph;
    const z = crystal.position.dot(forward);
    crystal.position.set(0, 0, 0).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(forward, z);
  }
  if (params.snapping && params.rotationSnap > 0) {
    const increment = (params.rotationSnap * Math.PI) / 180;
    const q = basis()[3];
    const relative = q.clone().invert().multiply(crystal.quaternion);
    const euler = new Euler().setFromQuaternion(relative);
    euler.set(
      Math.round(euler.x / increment) * increment,
      Math.round(euler.y / increment) * increment,
      Math.round(euler.z / increment) * increment,
    );
    relative.setFromEuler(euler);
    crystal.quaternion.copy(q.multiply(relative));
  }
  composer.render();
  crystal.position.copy(position);
  crystal.rotation.copy(rotation);
  camera.position.copy(cameraPosition);
  camera.quaternion.copy(cameraQuaternion);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  timer.dispose();
  controls.dispose();
  gui.destroy();
  for (const pass of composer.passes) pass.dispose();
  composer.dispose();
  directional.shadow.dispose();
  spot.shadow.dispose();
  disposeObject(scene);
  renderer.dispose();
});
