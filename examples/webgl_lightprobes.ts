import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { LightProbeGridHelperWebGL } from "ek3d/addons/helpers/LightProbeGridHelperWebGL";
import { LightProbeGridWebGL } from "ek3d/addons/lighting/LightProbeGridWebGL";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing probe canvas");
const scene = new Scene();
scene.background = new Color(0x111111);
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 2.5, 8);
const wall = new MeshStandardMaterial({ color: 0xcccccc });
const red = new MeshStandardMaterial({ color: 0xff0000 });
const green = new MeshStandardMaterial({ color: 0x00ff00 });
const object = new MeshStandardMaterial({ color: 0xeeeeee });
const floor = new Mesh(new PlaneGeometry(6, 6), wall);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const ceiling = new Mesh(new PlaneGeometry(6, 6), wall);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 5;
ceiling.receiveShadow = true;
scene.add(ceiling);
const back = new Mesh(new PlaneGeometry(6, 5), wall);
back.position.set(0, 2.5, -3);
back.receiveShadow = true;
scene.add(back);
const front = new Mesh(new PlaneGeometry(6, 5), wall);
front.rotation.y = Math.PI;
front.position.set(0, 2.5, 3);
front.receiveShadow = true;
scene.add(front);
const left = new Mesh(new PlaneGeometry(6, 5), red);
left.rotation.y = Math.PI / 2;
left.position.set(-3, 2.5, 0);
left.receiveShadow = true;
scene.add(left);
const right = new Mesh(new PlaneGeometry(6, 5), green);
right.rotation.y = -Math.PI / 2;
right.position.set(3, 2.5, 0);
right.receiveShadow = true;
scene.add(right);
const tall = new Mesh(new BoxGeometry(1.2, 2.5, 1.2), object);
tall.position.set(-0.8, 1.25, -0.8);
tall.rotation.y = Math.PI / 8;
tall.castShadow = tall.receiveShadow = true;
scene.add(tall);
const short = new Mesh(new BoxGeometry(1.2, 1.2, 1.2), object);
short.position.set(1, 0.6, 0.5);
short.rotation.y = -Math.PI / 6;
short.castShadow = short.receiveShadow = true;
scene.add(short);
const sphere = new Mesh(new SphereGeometry(0.5, 32, 32), object.clone());
sphere.position.set(1, 1.9, 0.5);
sphere.castShadow = sphere.receiveShadow = true;
scene.add(sphere);
const light = new PointLight(0xffffff, 40);
light.position.set(0, 4.5, 0);
light.castShadow = true;
light.shadow.mapSize.setScalar(256);
light.shadow.radius = 10;
light.shadow.normalBias = -0.02;
scene.add(light);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshDepthMaterial: depthShader,
    MeshDistanceMaterial: distanceShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap!.enabled = true;
renderer.toneMapping = ACESFilmicToneMapping;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2.5, 0);
controls.update();
const params = { enabled: true, showProbes: false, resolution: 6 };
let probes: LightProbeGridWebGL | undefined;
let helper: LightProbeGridHelperWebGL | undefined;
function bake(resolution: number): void {
  if (probes) {
    scene.remove(probes);
    probes.dispose();
  }
  probes = new LightProbeGridWebGL(5.6, 4.7, 5.6, resolution, resolution, resolution);
  probes.position.set(0, 2.45, 0);
  probes.bake(renderer, scene, { cubemapSize: 32, near: 0.05, far: 20 });
  probes.visible = params.enabled;
  scene.add(probes);
  if (!helper) {
    helper = new LightProbeGridHelperWebGL(probes);
    helper.visible = params.showProbes;
    scene.add(helper);
  } else {
    helper.probes = probes;
    helper.update();
  }
}
bake(params.resolution);
const gui = new GUI();
gui
  .add(params, "enabled")
  .name("GI")
  .onChange(() => {
    if (probes) probes.visible = params.enabled;
  });
gui
  .add(params, "resolution", 2, 12, 1)
  .name("Resolution")
  .onFinishChange(() => bake(params.resolution));
gui
  .add(params, "showProbes")
  .name("Show Probes")
  .onChange(() => {
    if (helper) helper.visible = params.showProbes;
  });
renderer.setAnimationLoop(() => renderer.render(scene, camera));
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  if (helper) {
    scene.remove(helper);
    helper.dispose();
  }
  if (probes) {
    scene.remove(probes);
    probes.dispose();
  }
  disposeObject(scene);
  dfg.dispose();
  renderer.dispose();
});
