import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { StencilFunc, Side, StencilOp } from "ek3d/constants";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { PlaneHelper } from "ek3d/helpers/PlaneHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { ShadowMaterial } from "ek3d/materials/ShadowMaterial";
import { Plane } from "ek3d/math/Plane";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { shadowShader } from "ek3d/renderers/shaders/ShadowShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing stencil clipping canvas");
const timer = new Timer();
timer.connect(document);
const scene = new Scene();
const camera = new PerspectiveCamera(36, innerWidth / innerHeight, 1, 100);
camera.position.set(2, 2, 2);
scene.add(new AmbientLight(0xffffff, 1.5));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(5, 10, 7.5);
light.castShadow = true;
light.shadow.camera.right = 2;
light.shadow.camera.left = -2;
light.shadow.camera.top = 2;
light.shadow.camera.bottom = -2;
light.shadow.mapSize.set(1024, 1024);
scene.add(light);
const planes = [
  new Plane(new Vector3(-1, 0, 0), 0),
  new Plane(new Vector3(0, -1, 0), 0),
  new Plane(new Vector3(0, 0, -1), 0),
];
const helpers = planes.map((plane) => {
  const helper = new PlaneHelper(plane, 2, 0xffffff);
  helper.visible = false;
  scene.add(helper);
  return helper;
});
function createPlaneStencilGroup(geometry: BufferGeometry, plane: Plane, renderOrder: number): Group {
  const group = new Group();
  const base = new MeshBasicMaterial();
  base.depthWrite = false;
  base.depthTest = false;
  base.colorWrite = false;
  base.stencilWrite = true;
  base.stencilFunc = StencilFunc.Always;
  const back = base.clone();
  back.side = Side.Back;
  back.clippingPlanes = [plane];
  back.stencilFail = back.stencilZFail = back.stencilZPass = StencilOp.IncrementWrap;
  const front = base.clone();
  front.side = Side.Front;
  front.clippingPlanes = [plane];
  front.stencilFail = front.stencilZFail = front.stencilZPass = StencilOp.DecrementWrap;
  base.dispose();
  const backMesh = new Mesh(geometry, back);
  const frontMesh = new Mesh(geometry, front);
  backMesh.renderOrder = frontMesh.renderOrder = renderOrder;
  group.add(backMesh, frontMesh);
  return group;
}
const geometry = new TorusKnotGeometry(0.4, 0.15, 220, 60);
const object = new Group();
scene.add(object);
const planeGeometry = new PlaneGeometry(4, 4);
const planeObjects = planes.map((plane, i) => {
  const stencil = createPlaneStencilGroup(geometry, plane, i + 1);
  const material = new MeshStandardMaterial({
    color: 0xe91e63,
    metalness: 0.1,
    roughness: 0.75,
    clippingPlanes: planes.filter((other) => other !== plane),
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: StencilFunc.NotEqual,
    stencilFail: StencilOp.Replace,
    stencilZFail: StencilOp.Replace,
    stencilZPass: StencilOp.Replace,
  });
  const mesh = new Mesh(planeGeometry, material);
  mesh.onAfterRender = (renderer) => renderer.clearStencil();
  mesh.renderOrder = i + 1.1;
  object.add(stencil);
  const group = new Group();
  group.add(mesh);
  scene.add(group);
  return mesh;
});
const material = new MeshStandardMaterial({
  color: 0xffc107,
  metalness: 0.1,
  roughness: 0.75,
  clippingPlanes: planes,
  clipShadows: true,
  shadowSide: Side.Double,
});
const clipped = new Mesh(geometry, material);
clipped.castShadow = true;
clipped.renderOrder = 6;
object.add(clipped);
const ground = new Mesh(
  new PlaneGeometry(9, 9, 1, 1),
  new ShadowMaterial({ color: 0x000000, opacity: 0.25, side: Side.Double }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1;
ground.receiveShadow = true;
scene.add(ground);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  stencil: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshStandardMaterial: standardShader,
    ShadowMaterial: shadowShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x263238);
if (!renderer.shadowMap) throw new Error("Missing shadow map system");
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 2;
controls.maxDistance = 20;
controls.update();
const stats = new Stats();
document.body.appendChild(stats.dom);
const params = {
  animate: true,
  planeX: { constant: 0, negated: false, displayHelper: false },
  planeY: { constant: 0, negated: false, displayHelper: false },
  planeZ: { constant: 0, negated: false, displayHelper: false },
};
const gui = new GUI();
gui.add(params, "animate");
(["planeX", "planeY", "planeZ"] as const).forEach((key, i) => {
  const settings = params[key];
  const folder = gui.addFolder(key);
  folder.add(settings, "displayHelper").onChange(() => {
    helpers[i].visible = settings.displayHelper;
  });
  folder
    .add(settings, "constant")
    .min(-1)
    .max(1)
    .onChange(() => {
      planes[i].constant = settings.constant;
    });
  folder.add(settings, "negated").onChange(() => {
    planes[i].negate();
    settings.constant = planes[i].constant;
  });
  folder.open();
});
renderer.setAnimationLoop(() => {
  timer.update();
  if (params.animate) {
    object.rotation.x += timer.getDelta() * 0.5;
    object.rotation.y += timer.getDelta() * 0.2;
  }
  planeObjects.forEach((mesh, i) => {
    const plane = planes[i];
    plane.coplanarPoint(mesh.position);
    mesh.lookAt(mesh.position.x - plane.normal.x, mesh.position.y - plane.normal.y, mesh.position.z - plane.normal.z);
  });
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.dispose();
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  light.shadow.dispose();
  dfg.dispose();
  renderer.dispose();
});
