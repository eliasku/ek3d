import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ShadowMap } from "ek3d/constants";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Timer } from "ek3d/core/Timer";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasSel) throw new Error("Missing VSM shadow canvas");
const canvas: HTMLCanvasElement = canvasSel;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap!.enabled = true;
renderer.shadowMap!.type = ShadowMap.VSM;
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 10, 30);
const scene = new Scene();
scene.background = new Color(0x222244);
scene.fog = new Fog(0x222244, 50, 100);
scene.add(new AmbientLight(0x444444));
const spotLight = new SpotLight(0xff8888, 400);
spotLight.angle = Math.PI / 5;
spotLight.penumbra = 0.3;
spotLight.position.set(8, 10, 5);
spotLight.castShadow = true;
spotLight.shadow.camera.near = 8;
spotLight.shadow.camera.far = 200;
spotLight.shadow.mapSize.set(256, 256);
spotLight.shadow.bias = -0.002;
spotLight.shadow.radius = 4;
scene.add(spotLight);
const dirLight = new DirectionalLight(0x8888ff, 3);
dirLight.position.set(3, 12, 17);
dirLight.castShadow = true;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 500;
dirLight.shadow.camera.right = 17;
dirLight.shadow.camera.left = -17;
dirLight.shadow.camera.top = 17;
dirLight.shadow.camera.bottom = -17;
dirLight.shadow.mapSize.set(512, 512);
dirLight.shadow.radius = 4;
dirLight.shadow.bias = -0.0005;
const dirGroup = new Group();
dirGroup.add(dirLight);
scene.add(dirGroup);
const material = new MeshPhongMaterial({ color: 0x999999, shininess: 0, specular: 0x222222 });
const torusKnot = new Mesh(new TorusKnotGeometry(25, 8, 75, 20), material);
torusKnot.scale.multiplyScalar(1 / 18);
torusKnot.position.y = 3;
torusKnot.castShadow = true;
torusKnot.receiveShadow = true;
scene.add(torusKnot);
const pillar = new Mesh(new CylinderGeometry(0.75, 0.75, 7, 32), material);
pillar.position.set(8, 3.5, 8);
pillar.castShadow = true;
pillar.receiveShadow = true;
scene.add(pillar);
for (const [x, z] of [
  [8, -8],
  [-8, 8],
  [-8, -8],
]) {
  const clone = pillar.clone();
  clone.position.set(x, 3.5, z);
  scene.add(clone);
}
const ground = new Mesh(
  new PlaneGeometry(200, 200),
  new MeshPhongMaterial({ color: 0x999999, shininess: 0, specular: 0x111111 }),
);
ground.rotation.x = -Math.PI / 2;
ground.scale.multiplyScalar(3);
ground.castShadow = true;
ground.receiveShadow = true;
scene.add(ground);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2, 0);
controls.update();
const timer = new Timer();
timer.connect(document);
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
const config = { spotlightRadius: 4, spotlightSamples: 8, dirlightRadius: 4, dirlightSamples: 8 };
const spotlightFolder = gui.addFolder("Spotlight");
spotlightFolder
  .add(config, "spotlightRadius")
  .name("radius")
  .min(0)
  .max(25)
  .onChange(() => {
    spotLight.shadow.radius = config.spotlightRadius;
  });
spotlightFolder
  .add(config, "spotlightSamples", 1, 25, 1)
  .name("samples")
  .onChange(() => {
    spotLight.shadow.blurSamples = config.spotlightSamples;
  });
spotlightFolder.open();
const dirlightFolder = gui.addFolder("Directional Light");
dirlightFolder
  .add(config, "dirlightRadius")
  .name("radius")
  .min(0)
  .max(25)
  .onChange(() => {
    dirLight.shadow.radius = config.dirlightRadius;
  });
dirlightFolder
  .add(config, "dirlightSamples", 1, 25, 1)
  .name("samples")
  .onChange(() => {
    dirLight.shadow.blurSamples = config.dirlightSamples;
  });
dirlightFolder.open();
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop((time) => {
  timer.update();
  const delta = timer.getDelta();
  torusKnot.rotation.x += 0.25 * delta;
  torusKnot.rotation.y += 0.5 * delta;
  torusKnot.rotation.z += delta;
  dirGroup.rotation.y += 0.7 * delta;
  dirLight.position.z = 17 + Math.sin(time * 0.001) * 5;
  renderer.render(scene, camera);
  stats.update();
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  timer.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
