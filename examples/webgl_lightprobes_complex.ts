import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { LightProbeGridHelperWebGL } from "ek3d/addons/helpers/LightProbeGridHelperWebGL";
import { LightProbeGridWebGL } from "ek3d/addons/lighting/LightProbeGridWebGL";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, Side } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
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
camera.position.set(0, 2.5, 16);
// Materials

const wallMaterial = new MeshStandardMaterial({ color: 0xcccccc, side: Side.Back });
const whiteMat = new MeshStandardMaterial({ color: 0xeeeeee });

// Room shell: x=-8 to 8, z=-4 to 4, y=0 to 5

const room = new Mesh(new BoxGeometry(16, 5, 8), wallMaterial);
room.position.set(0, 2.5, 0);
room.receiveShadow = true;
scene.add(room);

const redWall = new Mesh(new PlaneGeometry(8, 5), new MeshStandardMaterial({ color: 0xdd2200 }));
redWall.rotation.y = Math.PI / 2;
redWall.position.set(-7.99, 2.5, 0);
scene.add(redWall);

const blueWall = new Mesh(new PlaneGeometry(8, 5), new MeshStandardMaterial({ color: 0x0044ff }));
blueWall.rotation.y = -Math.PI / 2;
blueWall.position.set(7.99, 2.5, 0);
scene.add(blueWall);

// Dividing wall at x=0 with doorway

const dividerMat = new MeshStandardMaterial({ color: 0xcccccc });
const doorwayHalfGap = 1.25;

// Left section of divider (z = -4 to -1.25)
const dividerLeft = new Mesh(new BoxGeometry(0.3, 5, 4 - doorwayHalfGap), dividerMat);
dividerLeft.position.set(0, 2.5, -(doorwayHalfGap + (4 - doorwayHalfGap) / 2));
dividerLeft.castShadow = true;
dividerLeft.receiveShadow = true;
scene.add(dividerLeft);

// Right section of divider (z = 1.25 to 4)
const dividerRight = new Mesh(new BoxGeometry(0.3, 5, 4 - doorwayHalfGap), dividerMat);
dividerRight.position.set(0, 2.5, doorwayHalfGap + (4 - doorwayHalfGap) / 2);
dividerRight.castShadow = true;
dividerRight.receiveShadow = true;
scene.add(dividerRight);

// Lintel above doorway
const lintel = new Mesh(new BoxGeometry(0.3, 1.2, doorwayHalfGap * 2), dividerMat);
lintel.position.set(0, 4.4, 0);
lintel.castShadow = true;
lintel.receiveShadow = true;
scene.add(lintel);

// Left room objects

// Columns
const columnGeom = new CylinderGeometry(0.3, 0.3, 4, 16);

for (const x of [-6, -2]) {
  for (const z of [-2.5, 2.5]) {
    const col = new Mesh(columnGeom, whiteMat);
    col.position.set(x, 2, z);
    col.castShadow = true;
    col.receiveShadow = true;
    scene.add(col);
  }
}

// Table with golden sphere
const tableTop = new Mesh(new BoxGeometry(2.4, 0.12, 1.4), new MeshStandardMaterial({ color: 0x886644 }));
tableTop.position.set(-4, 1.0, 0);
tableTop.castShadow = true;
tableTop.receiveShadow = true;
scene.add(tableTop);

const legGeom = new BoxGeometry(0.1, 1, 0.1);

for (const x of [-5.05, -2.95]) {
  for (const z of [-0.55, 0.55]) {
    const leg = new Mesh(legGeom, tableTop.material);
    leg.position.set(x, 0.5, z);
    leg.castShadow = true;
    scene.add(leg);
  }
}

const sphere = new Mesh(
  new SphereGeometry(0.35, 32, 32),
  new MeshStandardMaterial({ color: 0xffd700, metalness: 0.3, roughness: 0.4 }),
);
sphere.position.set(-4, 1.41, 0);
sphere.castShadow = true;
sphere.receiveShadow = true;
scene.add(sphere);

// Stepped blocks near red wall
const step1 = new Mesh(new BoxGeometry(1.5, 0.5, 1), whiteMat);
step1.position.set(-7, 0.25, 0);
step1.castShadow = true;
step1.receiveShadow = true;
scene.add(step1);

const step2 = new Mesh(new BoxGeometry(1.0, 1.0, 1), whiteMat);
step2.position.set(-7, 0.5, 0);
step2.castShadow = true;
step2.receiveShadow = true;
scene.add(step2);

const step3 = new Mesh(new BoxGeometry(0.5, 1.5, 1), whiteMat);
step3.position.set(-7, 0.75, 0);
step3.castShadow = true;
step3.receiveShadow = true;
scene.add(step3);

// Right room objects

// Columns
for (const x of [2, 6]) {
  for (const z of [-2.5, 2.5]) {
    const col = new Mesh(columnGeom, whiteMat);
    col.position.set(x, 2, z);
    col.castShadow = true;
    col.receiveShadow = true;
    scene.add(col);
  }
}

// Pedestal with torus knot
const pedestal = new Mesh(new BoxGeometry(0.8, 1.2, 0.8), whiteMat);
pedestal.position.set(4, 0.6, 0);
pedestal.castShadow = true;
pedestal.receiveShadow = true;
scene.add(pedestal);

const torusKnot = new Mesh(
  new TorusKnotGeometry(0.3, 0.1, 64, 16),
  new MeshStandardMaterial({ color: 0xff44aa, metalness: 0.2, roughness: 0.5 }),
);
torusKnot.position.set(4, 1.65, 0);
torusKnot.castShadow = true;
torusKnot.receiveShadow = true;
scene.add(torusKnot);

// Tall cone sculpture
const sculpture = new Mesh(new ConeGeometry(0.4, 2.5, 5), whiteMat);
sculpture.position.set(6.5, 1.25, -1.5);
sculpture.castShadow = true;
sculpture.receiveShadow = true;
scene.add(sculpture);

// Lights

// Warm point light in left room
const warmLight = new PointLight(0xffaa44, 30);
warmLight.position.set(-4, 4.5, 0);
warmLight.castShadow = true;
warmLight.shadow.mapSize.setScalar(256);
warmLight.shadow.radius = 12;
warmLight.shadow.bias = -0.002;
scene.add(warmLight);

// Cool point light in right room
const coolLight = new PointLight(0x88bbff, 30);
coolLight.position.set(4, 4.5, 0);
coolLight.castShadow = true;
coolLight.shadow.mapSize.setScalar(256);
coolLight.shadow.radius = 12;
coolLight.shadow.bias = -0.002;
scene.add(coolLight);

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
renderer.toneMapping = ToneMapping.ACESFilmic;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2.5, 0);
controls.update();
const params = { enabled: true, showProbes: false, resolution: 6 };
let probes: LightProbeGridWebGL[] = [];
let helpers: LightProbeGridHelperWebGL[] = [];
function bake(resolution: number): void {
  for (const probe of probes) {
    scene.remove(probe);
    probe.dispose();
  }
  probes = [-3.9, 3.9].map((x) => {
    const probe = new LightProbeGridWebGL(7.8, 4.7, 7.6, resolution, resolution, resolution);
    probe.position.set(x, 2.45, 0);
    probe.bake(renderer, scene, { cubemapSize: 32, near: 0.05, far: 20 });
    probe.visible = params.enabled;
    return probe;
  });
  scene.add(...probes);
  if (!helpers.length) {
    helpers = probes.map((probe) => {
      const helper = new LightProbeGridHelperWebGL(probe);
      helper.visible = params.showProbes;
      scene.add(helper);
      return helper;
    });
  } else
    helpers.forEach((helper, i) => {
      helper.probes = probes[i];
      helper.update();
    });
}
bake(params.resolution);
const gui = new GUI();
gui
  .add(params, "enabled")
  .name("GI")
  .onChange(() => {
    for (const probe of probes) probe.visible = params.enabled;
  });
gui
  .add(params, "resolution", 2, 12, 1)
  .name("Resolution")
  .onFinishChange(() => bake(params.resolution));
gui
  .add(params, "showProbes")
  .name("Show Probes")
  .onChange(() => {
    for (const helper of helpers) helper.visible = params.showProbes;
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
  for (const helper of helpers) {
    scene.remove(helper);
    helper.dispose();
  }
  for (const probe of probes) {
    scene.remove(probe);
    probe.dispose();
  }
  disposeObject(scene);
  dfg.dispose();
  renderer.dispose();
});
