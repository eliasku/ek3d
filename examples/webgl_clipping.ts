import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Plane } from "ek3d/math/Plane";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing clipping canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(36, innerWidth / innerHeight, 0.25, 16);
camera.position.set(0, 1.3, 3);
const scene = new Scene();
scene.add(new AmbientLight(0xcccccc));
const spotLight = new SpotLight(0xffffff, 60);
spotLight.angle = Math.PI / 5;
spotLight.penumbra = 0.2;
spotLight.position.set(2, 3, 3);
spotLight.castShadow = true;
spotLight.shadow.camera.near = 3;
spotLight.shadow.camera.far = 10;
spotLight.shadow.mapSize.set(1024, 1024);
scene.add(spotLight);
const dirLight = new DirectionalLight(0x55505a, 3);
dirLight.position.set(0, 3, 0);
dirLight.castShadow = true;
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 10;
dirLight.shadow.camera.right = 1;
dirLight.shadow.camera.left = -1;
dirLight.shadow.camera.top = 1;
dirLight.shadow.camera.bottom = -1;
dirLight.shadow.mapSize.set(1024, 1024);
scene.add(dirLight);

const localPlane = new Plane(new Vector3(0, -1, 0), 0.8);
const globalPlane = new Plane(new Vector3(-1, 0, 0), 0.1);
const material = new MeshPhongMaterial({
  color: 0x80ee10,
  shininess: 100,
  side: DoubleSide,
  clippingPlanes: [localPlane],
  clipShadows: true,
  alphaToCoverage: true,
});
const object = new Mesh(new TorusKnotGeometry(0.4, 0.08, 95, 20), material);
object.castShadow = true;
scene.add(object);
const ground = new Mesh<MeshPhongMaterial>(
  new PlaneGeometry(9, 9, 1, 1),
  new MeshPhongMaterial({ color: 0xa0adaf, shininess: 150 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap!.enabled = true;
const globalPlanes = [globalPlane];
const emptyPlanes: Plane[] = [];
renderer.clippingPlanes = emptyPlanes;
renderer.localClippingEnabled = true;
const stats = new Stats();
document.body.appendChild(stats.dom);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1, 0);
controls.update();
const gui = new GUI();
const props = { alphaToCoverage: true };
const local = {
  get Enabled() {
    return renderer.localClippingEnabled;
  },
  set Enabled(value: boolean) {
    renderer.localClippingEnabled = value;
  },
  get Shadows() {
    return material.clipShadows;
  },
  set Shadows(value: boolean) {
    material.clipShadows = value;
  },
  get Plane() {
    return localPlane.constant;
  },
  set Plane(value: number) {
    localPlane.constant = value;
  },
};
const global = {
  get Enabled() {
    return renderer.clippingPlanes !== emptyPlanes;
  },
  set Enabled(value: boolean) {
    renderer.clippingPlanes = value ? globalPlanes : emptyPlanes;
  },
  get Plane() {
    return globalPlane.constant;
  },
  set Plane(value: number) {
    globalPlane.constant = value;
  },
};
const folderLocal = gui.addFolder("Local Clipping");
const folderGlobal = gui.addFolder("Global Clipping");
gui.add(props, "alphaToCoverage").onChange(() => {
  ground.material.alphaToCoverage = props.alphaToCoverage;
  ground.material.needsUpdate = true;
  material.alphaToCoverage = props.alphaToCoverage;
  material.needsUpdate = true;
});
folderLocal.add(local, "Enabled");
folderLocal.add(local, "Shadows");
folderLocal.add(local, "Plane", 0.3, 1.25);
folderGlobal.add(global, "Enabled");
folderGlobal.add(global, "Plane", -0.4, 3);

function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
const startTime = Date.now();
let frames = 0;
renderer.setAnimationLoop(() => {
  const time = (Date.now() - startTime) / 1000;
  object.position.y = 0.8;
  object.rotation.x = time * 0.5;
  object.rotation.y = time * 0.2;
  object.scale.setScalar(Math.cos(time) * 0.125 + 0.875);
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  spotLight.shadow.dispose();
  dirLight.shadow.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
