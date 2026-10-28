import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { CSM } from "ek3d/addons/csm/CSM";
import { CSMHelper } from "ek3d/addons/csm/CSMHelper";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PCFShadowMap } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing CSM canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
let disposed = false,
  frames = 0;
const scene = new Scene();
scene.background = new Color("#454e61");
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 5000);
const orthoCamera = new OrthographicCamera();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshDepthMaterial: depthShader,
  },
});
const shadowMap = renderer.shadowMap!;
shadowMap.enabled = true;
shadowMap.type = PCFShadowMap;
renderer.setPixelRatio(devicePixelRatio);
const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI / 2;
camera.position.set(60, 60, 0);
controls.target.set(-100, 10, 0);
controls.update();
scene.add(new AmbientLight(0xffffff, 1.5));
const additionalLight = new DirectionalLight(0x000020, 1.5);
additionalLight.position.set(-1, -1, -1).normalize().multiplyScalar(-200);
scene.add(additionalLight);
const csm = new CSM({
  maxFar: 1000,
  cascades: 4,
  mode: "practical",
  parent: scene,
  shadowMapSize: 1024,
  lightDirection: new Vector3(-1, -1, -1).normalize(),
  camera,
});
const helper = new CSMHelper(csm);
helper.visible = false;
scene.add(helper);
const floorMaterial = new MeshPhongMaterial({ color: "#252a34" });
const material1 = new MeshPhongMaterial({ color: "#08d9d6" });
const material2 = new MeshPhongMaterial({ color: "#ff2e63" });
for (const material of [floorMaterial, material1, material2]) csm.setupMaterial(material);
const floorGeometry = new PlaneGeometry(10000, 10000, 8, 8);
const floor = new Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.castShadow = floor.receiveShadow = true;
scene.add(floor);
const geometry = new BoxGeometry(10, 10, 10);
for (let i = 0; i < 40; i++) {
  const cube1 = new Mesh(geometry, i % 2 === 0 ? material1 : material2);
  const cube2 = new Mesh(geometry, i % 2 === 0 ? material2 : material1);
  cube1.castShadow = cube1.receiveShadow = cube2.castShadow = cube2.receiveShadow = true;
  cube1.position.set(-i * 25, 20, 30);
  cube2.position.set(-i * 25, 20, -30);
  cube1.scale.y = Math.random() * 2 + 6;
  cube2.scale.y = Math.random() * 2 + 6;
  scene.add(cube1, cube2);
}
const params = {
  orthographic: false,
  fade: false,
  shadows: true,
  far: 1000,
  mode: "practical" as "uniform" | "logarithmic" | "practical",
  lightX: -1,
  lightY: -1,
  lightZ: -1,
  margin: 100,
  lightFar: 5000,
  lightNear: 1,
  autoUpdateHelper: true,
  updateHelper: () => helper.update(),
};
function updateOrthoCamera(): void {
  const size = controls.target.distanceTo(camera.position),
    aspect = camera.aspect;
  orthoCamera.left = (-size * aspect) / 2;
  orthoCamera.right = (size * aspect) / 2;
  orthoCamera.top = size / 2;
  orthoCamera.bottom = -size / 2;
  orthoCamera.position.copy(camera.position);
  orthoCamera.rotation.copy(camera.rotation);
  orthoCamera.updateProjectionMatrix();
}
const gui = new GUI();
gui.add(params, "orthographic").onChange(() => {
  updateOrthoCamera();
  csm.camera = params.orthographic ? orthoCamera : camera;
  csm.updateFrustums();
});
gui.add(params, "fade").onChange(() => {
  csm.fade = params.fade;
  csm.updateFrustums();
});
gui.add(params, "shadows").onChange(() => {
  shadowMap.enabled = params.shadows;
  for (const material of [floorMaterial, material1, material2]) material.needsUpdate = true;
});
gui
  .add(params, "far", 1, 5000)
  .step(1)
  .name("shadow far")
  .onChange(() => {
    csm.maxFar = params.far;
    csm.updateFrustums();
  });
gui
  .add(params, "mode", ["uniform", "logarithmic", "practical"])
  .name("frustum split mode")
  .onChange(() => {
    csm.mode = params.mode;
    csm.updateFrustums();
  });
gui
  .add(params, "lightX", -1, 1)
  .name("light direction x")
  .onChange(() => {
    csm.lightDirection.x = params.lightX;
  });
gui
  .add(params, "lightY", -1, 1)
  .name("light direction y")
  .onChange(() => {
    csm.lightDirection.y = params.lightY;
  });
gui
  .add(params, "lightZ", -1, 1)
  .name("light direction z")
  .onChange(() => {
    csm.lightDirection.z = params.lightZ;
  });
gui
  .add(params, "margin", 0, 200)
  .name("light margin")
  .onChange(() => {
    csm.lightMargin = params.margin;
  });
gui
  .add(params, "lightNear", 1, 10000)
  .name("light near")
  .onChange(() => {
    for (const light of csm.lights) {
      light.shadow.camera.near = params.lightNear;
      light.shadow.camera.updateProjectionMatrix();
    }
  });
gui
  .add(params, "lightFar", 1, 10000)
  .name("light far")
  .onChange(() => {
    for (const light of csm.lights) {
      light.shadow.camera.far = params.lightFar;
      light.shadow.camera.updateProjectionMatrix();
    }
  });
const folder = gui.addFolder("helper");
folder.add(helper, "visible");
for (const key of ["displayFrustum", "displayPlanes", "displayShadowBounds"] as const)
  folder.add(helper, key).onChange(() => helper.updateVisibility());
folder.add(params, "autoUpdateHelper").name("auto update");
folder.add(params, "updateHelper").name("update");
folder.open();
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  updateOrthoCamera();
  csm.updateFrustums();
  renderer.setSize(innerWidth, innerHeight);
}
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  try {
    controls.update();
    camera.updateMatrixWorld();
    if (params.orthographic) {
      updateOrthoCamera();
      orthoCamera.updateMatrixWorld();
      csm.updateFrustums();
    }
    csm.update();
    if (params.autoUpdateHelper) helper.update();
    renderer.render(scene, params.orthographic ? orthoCamera : camera);
    canvas.dataset.frames = String(++frames);
    canvas.dataset.state = "rendered";
  } catch (error) {
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    renderer.setAnimationLoop(null);
    console.error(error);
  }
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  helper.dispose();
  csm.remove();
  csm.dispose();
  for (const light of csm.lights) light.dispose();
  floorGeometry.dispose();
  geometry.dispose();
  floorMaterial.dispose();
  material1.dispose();
  material2.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
