import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { Brush } from "ek3d/addons/math/csg/core/Brush";
import { Evaluator } from "ek3d/addons/math/csg/core/Evaluator";
import { ADDITION, INTERSECTION, SUBTRACTION, type CSGOperation } from "ek3d/addons/math/csg/core/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide, PCFShadowMap } from "ek3d/constants";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { ShadowMaterial } from "ek3d/materials/ShadowMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { shadowShader } from "ek3d/renderers/shaders/ShadowShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing CSG canvas");
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 100);
camera.position.set(-1, 1, 1).normalize().multiplyScalar(10);
const scene = new Scene();
scene.background = new Color(0xfce4ec);
scene.add(new HemisphereLight(0xffffff, 0xbfd4d2, 3));
const light = new DirectionalLight(0xffffff, 0.3);
light.position.set(1, 4, 3).multiplyScalar(3);
light.castShadow = true;
light.shadow.mapSize.setScalar(2048);
light.shadow.bias = -1e-4;
light.shadow.normalBias = 1e-4;
scene.add(light);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshBasicMaterial: basicShader,
    ShadowMaterial: shadowShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Shadow map unavailable");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
const plane = new Mesh(
  new PlaneGeometry(),
  new ShadowMaterial({ color: 0xd81b60, transparent: true, opacity: 0.075, side: DoubleSide }),
);
plane.position.y = -3;
plane.rotation.x = -Math.PI / 2;
plane.scale.setScalar(10);
plane.receiveShadow = true;
scene.add(plane);
const offset = { polygonOffset: true, polygonOffsetUnits: 1, polygonOffsetFactor: 1 };
const baseBrush = new Brush(new IcosahedronGeometry(2, 3), new MeshStandardMaterial({ flatShading: true, ...offset }));
const brush = new Brush(new CylinderGeometry(1, 1, 5, 45), new MeshStandardMaterial({ color: 0x80cbc4, ...offset }));
const core = new Brush(
  new IcosahedronGeometry(0.15, 1),
  new MeshStandardMaterial({
    flatShading: true,
    color: 0xff9800,
    emissive: 0xff9800,
    emissiveIntensity: 0.35,
    ...offset,
  }),
);
core.castShadow = true;
scene.add(core);
const result = new Brush();
result.castShadow = result.receiveShadow = true;
scene.add(result);
const wireframe = new Mesh(result.geometry, new MeshBasicMaterial({ color: 0x009688, wireframe: true }));
scene.add(wireframe);
const evaluator = new Evaluator();
const params: { operation: CSGOperation; useGroups: boolean; wireframe: boolean } = {
  operation: SUBTRACTION,
  useGroups: true,
  wireframe: false,
};
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 5;
controls.maxDistance = 75;
const gui = new GUI();
gui.add(params, "operation", { SUBTRACTION, INTERSECTION, ADDITION });
gui.add(params, "wireframe");
gui.add(params, "useGroups");
const stats = new Stats();
document.body.appendChild(stats.dom);
let frames = 0;
renderer.setAnimationLoop(() => {
  const t = performance.now() + 9000;
  baseBrush.rotation.set(t * 0.0001, t * 0.00025, t * 0.0005);
  baseBrush.updateMatrixWorld();
  brush.rotation.set(t * -0.0002, t * -0.0005, t * -0.001);
  const s = 0.5 + 0.5 * (1 + Math.sin(t * 0.001));
  brush.scale.set(s, 1, s);
  brush.updateMatrixWorld();
  evaluator.useGroups = params.useGroups;
  evaluator.evaluate(baseBrush, brush, params.operation, result);
  wireframe.geometry = result.geometry;
  wireframe.position.copy(result.position);
  wireframe.quaternion.copy(result.quaternion);
  wireframe.scale.copy(result.scale);
  wireframe.visible = params.wireframe;
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
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
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  scene.add(baseBrush, brush);
  disposeObject(scene);
  light.shadow.dispose();
  dfg.dispose();
  renderer.dispose();
});
