import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { ShadowMapViewer } from "ek3d/addons/utils/ShadowMapViewer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BasicShadowMap } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing shadow map viewer canvas");
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 15, 35);
const scene = new Scene();
scene.add(new AmbientLight(0x404040, 3));
const spot = new SpotLight(0xffffff, 500);
spot.name = "Spot Light";
spot.angle = Math.PI / 5;
spot.penumbra = 0.3;
spot.position.set(10, 10, 5);
spot.castShadow = true;
spot.shadow.camera.near = 8;
spot.shadow.camera.far = 30;
spot.shadow.mapSize.set(1024, 1024);
scene.add(spot, new CameraHelper(spot.shadow.camera));
const directional = new DirectionalLight(0xffffff, 3);
directional.name = "Dir. Light";
directional.position.set(0, 10, 0);
directional.castShadow = true;
directional.shadow.camera.near = 1;
directional.shadow.camera.far = 10;
directional.shadow.camera.right = 15;
directional.shadow.camera.left = -15;
directional.shadow.camera.top = 15;
directional.shadow.camera.bottom = -15;
directional.shadow.mapSize.set(1024, 1024);
scene.add(directional, new CameraHelper(directional.shadow.camera));
const red = new MeshPhongMaterial({ color: 0xff0000, shininess: 150, specular: 0x222222 });
const knot = new Mesh(new TorusKnotGeometry(25, 8, 75, 20), red);
knot.scale.multiplyScalar(1 / 18);
knot.position.y = 3;
knot.castShadow = true;
knot.receiveShadow = true;
scene.add(knot);
const cube = new Mesh(new BoxGeometry(3, 3, 3), red);
cube.position.set(8, 3, 8);
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);
const ground = new Mesh(
  new BoxGeometry(10, 0.15, 10),
  new MeshPhongMaterial({ color: 0xa0adaf, shininess: 150, specular: 0x111111 }),
);
ground.scale.multiplyScalar(3);
ground.receiveShadow = true;
scene.add(ground);
const dirViewer = new ShadowMapViewer(directional);
const spotViewer = new ShadowMapViewer(spot);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshDepthMaterial: depthShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.shadowMap!.enabled = true;
renderer.shadowMap!.type = BasicShadowMap;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2, 0);
controls.update();
const timer = new Timer();
timer.connect(document);
const stats = new Stats();
document.body.appendChild(stats.dom);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  const size = innerWidth * 0.15;
  dirViewer.position.x = 10;
  dirViewer.position.y = 10;
  dirViewer.size.width = size;
  dirViewer.size.height = size;
  dirViewer.update();
  spotViewer.size.set(size, size);
  spotViewer.position.set(size + 20, 10);
  dirViewer.updateForWindowResize();
  spotViewer.updateForWindowResize();
}
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = timer.getDelta();
  renderer.render(scene, camera);
  dirViewer.render(renderer);
  spotViewer.render(renderer);
  for (const mesh of [knot, cube]) {
    mesh.rotation.x += 0.25 * delta;
    mesh.rotation.y += 2 * delta;
    mesh.rotation.z += delta;
  }
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
  stats.dom.remove();
  dirViewer.dispose();
  spotViewer.dispose();
  spot.dispose();
  directional.dispose();
  disposeObject(scene);
  renderer.dispose();
});
