import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import type { AnimationClip } from "ek3d/animation/AnimationClip";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { Stats } from "ek3d/addons/libs/Stats";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { ShadowMapViewer } from "ek3d/addons/utils/ShadowMapViewer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ShadowMap } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing shadow canvas");
const canvas = selected;
const floor = -250;
const scene = new Scene();
scene.background = new Color(0x59472b);
scene.fog = new Fog(0x59472b, 1000, 3000);
const camera = new PerspectiveCamera(23, innerWidth / innerHeight, 10, 3000);
camera.position.set(700, 50, 1900);
scene.add(new AmbientLight(0xffffff));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, 1500, 1000);
light.castShadow = true;
light.shadow.camera.top = 2000;
light.shadow.camera.bottom = -2000;
light.shadow.camera.left = -2000;
light.shadow.camera.right = 2000;
light.shadow.camera.near = 1200;
light.shadow.camera.far = 2500;
light.shadow.bias = 0.0001;
light.shadow.mapSize.set(2048, 1024);
scene.add(light);
const planeMaterial = new MeshPhongMaterial({ color: 0xffdd99 });
const ground = new Mesh(new PlaneGeometry(100, 100), planeMaterial);
ground.position.y = floor;
ground.rotation.x = -Math.PI / 2;
ground.scale.set(100, 100, 100);
ground.receiveShadow = true;
scene.add(ground);
for (const [width, height, depth] of [
  [1500, 220, 150],
  [1600, 170, 250],
] as const) {
  const block = new Mesh(new BoxGeometry(width, height, depth), planeMaterial);
  block.position.set(0, floor - 50, 20);
  block.castShadow = block.receiveShadow = true;
  scene.add(block);
}
const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  reversedDepthBuffer: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshStandardMaterial: standardShader,
    MeshBasicMaterial: basicShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
if (!renderer.shadowMap) throw new Error("Shadow map unavailable");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = ShadowMap.PCF;
const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 200;
controls.maxDistance = 2200;
controls.target.set(0, -75, 25);
controls.update();
const timer = new Timer();
timer.connect(document);
const stats = new Stats();

const manager = new LoadingManager();
let disposed = false;
let failed = false;
let pending = 5;
canvas.dataset.state = "loading";
function loaded(): void {
  if (!disposed && --pending === 0 && !failed) canvas.dataset.state = "rendered";
}
function onError(error: unknown): void {
  if (!disposed) {
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  }
}
new FontLoader(manager).load(
  "/examples/fonts/helvetiker_bold.typeface.json",
  (font) => {
    if (disposed) return;
    const geometry = new TextGeometry("THREE.JS", {
      font,
      size: 200,
      depth: 50,
      curveSegments: 12,
      bevelThickness: 2,
      bevelSize: 5,
      bevelEnabled: true,
    });
    geometry.computeBoundingBox();
    const text = new Mesh(geometry, new MeshPhongMaterial({ color: 0xff0000, specular: 0xffffff }));
    if (geometry.boundingBox) text.position.x = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
    text.position.y = floor + 67;
    text.castShadow = text.receiveShadow = true;
    scene.add(text);
    loaded();
  },
  undefined,
  onError,
);
const mixer = new AnimationMixer(scene);
const morphs: { mesh: Mesh<MeshStandardMaterial>; speed: number }[] = [];

function addMorph(
  source: Mesh<MeshStandardMaterial>,
  clip: AnimationClip,
  speed: number,
  duration: number,
  x: number,
  y: number,
  z: number,
  fudgeColor: boolean,
): void {
  const mesh = source.clone();
  mesh.material = source.material.clone();
  if (fudgeColor) mesh.material.color.offsetHSL(0, Math.random() * 0.5 - 0.25, Math.random() * 0.5 - 0.25);
  mixer
    .clipAction(clip, mesh)
    .setDuration(duration)
    .startAt(-duration * Math.random())
    .play();
  mesh.position.set(x, y, z);
  mesh.rotation.y = Math.PI / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  morphs.push({ mesh, speed });
}
const loader = new GLTFLoader(manager);
const originals: Mesh<MeshStandardMaterial>[] = [];
function loadModel(name: string, add: (mesh: Mesh<MeshStandardMaterial>, clip: AnimationClip) => void): void {
  loader.load(
    `/examples/models/gltf/${name}.glb`,
    (gltf) => {
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }
      const mesh = gltf.scene.children[0];
      const clip = gltf.animations[0];
      if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshStandardMaterial) || !clip) {
        disposeObject(gltf.scene);
        onError(new Error(`Unexpected ${name} model`));
        return;
      }
      originals.push(mesh as Mesh<MeshStandardMaterial>);
      add(mesh as Mesh<MeshStandardMaterial>, clip);
      loaded();
    },
    undefined,
    onError,
  );
}
loadModel("Horse", (mesh, clip) => {
  for (const z of [300, 450, 600, -300, -450, -600])
    addMorph(mesh, clip, 550, 1, 100 - Math.random() * 1000, floor, z, true);
});
loadModel("Flamingo", (mesh, clip) => addMorph(mesh, clip, 500, 1, 500 - Math.random() * 500, floor + 350, 40, false));
loadModel("Stork", (mesh, clip) => addMorph(mesh, clip, 350, 1, 500 - Math.random() * 500, floor + 350, 340, false));
loadModel("Parrot", (mesh, clip) => addMorph(mesh, clip, 450, 0.5, 500 - Math.random() * 500, floor + 300, 700, false));
const viewer = new ShadowMapViewer(light);
viewer.position.x = 10;
viewer.position.y = innerHeight - 256 - 10;
viewer.size.width = 512;
viewer.size.height = 256;
viewer.update();
let showHUD = false;
function onKeyDown(event: KeyboardEvent): void {
  if (event.key.toLowerCase() === "t") showHUD = !showHUD;
}
window.addEventListener("keydown", onKeyDown);
let frames = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = timer.getDelta();
  stats.begin();
  mixer.update(delta);
  for (const morph of morphs) {
    morph.mesh.position.x += morph.speed * delta;
    if (morph.mesh.position.x > 2000) morph.mesh.position.x = -1000 - Math.random() * 500;
  }
  controls.update(delta);
  renderer.clear();
  renderer.render(scene, camera);
  if (showHUD) viewer.render(renderer);
  stats.end();
  canvas.dataset.frames = String(++frames);
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  viewer.position.y = innerHeight - 256 - 10;
  viewer.update();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", onKeyDown);
  viewer.dispose();
  renderer.setAnimationLoop(null);
  timer.dispose();
  controls.dispose();
  stats.dom.remove();
  mixer.stopAllAction();
  mixer.uncacheRoot(scene);
  disposeObject(scene);
  for (const original of originals) original.material.dispose();
  light.shadow.dispose();
  dfg.dispose();
  ltc.LTC_FLOAT_1.dispose();
  ltc.LTC_FLOAT_2.dispose();
  ltc.LTC_HALF_1.dispose();
  ltc.LTC_HALF_2.dispose();
  renderer.dispose();
});
