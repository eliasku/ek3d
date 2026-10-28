import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { GodraysPass } from "ek3d/addons/postprocessing/GodraysPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, TextureType } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import type { Material } from "ek3d/materials/Material";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing godrays canvas");
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(-175, 50, 0);
const scene = new Scene();
scene.background = new Color(0x000000);
const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshStandardMaterial: standardShader,
    MeshDepthMaterial: depthShader,
    MeshDistanceMaterial: distanceShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Shadow maps unavailable");
renderer.shadowMap.enabled = true;
const light = new PointLight(0xf6287d, 10000);
light.position.set(0, 50, 0);
light.castShadow = true;
light.shadow.bias = -0.001;
light.shadow.mapSize.set(1024, 1024);
scene.add(light, new AmbientLight(0xcccccc, 0.4));
const sphere = new Mesh(new SphereGeometry(0.5, 16, 16), new MeshBasicMaterial({ color: 0xffffff }));
sphere.position.copy(light.position);
scene.add(sphere);
const backdropGeometry = new PlaneGeometry(400, 200);
const backdropMaterial = new MeshBasicMaterial({ color: 0x200808, side: Side.Double });
for (const [x, y, z, ry, rx, sx, sy] of [
  [-200, 100, 0, Math.PI / 2, 0, 1, 1],
  [200, 100, 0, Math.PI / 2, 0, 1, 1],
  [0, 100, -200, 0, 0, 1, 1],
  [0, 100, 200, 0, 0, 1, 1],
  [0, 200, 0, 0, Math.PI / 2, 3, 6],
]) {
  const wall = new Mesh(backdropGeometry, backdropMaterial);
  wall.position.set(x, y, z);
  wall.rotation.set(rx, ry, 0);
  wall.scale.set(sx, sy, 1);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}
const target = new WebGLRenderTarget(innerWidth, innerHeight, { type: TextureType.HalfFloat });
target.depthTexture = new DepthTexture(target.width, target.height, TextureType.UnsignedInt);
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const godrays = new GodraysPass(light, camera, {
  density: 1 / 128,
  maxDensity: 0.5,
  distanceAttenuation: 2,
  color: new Color(0xf6287d),
  raymarchSteps: 60,
  blur: true,
  gammaCorrection: true,
});
composer.addPass(godrays);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.5, 0);
controls.enableDamping = true;
controls.maxDistance = 200;
controls.update();
const stats = new Stats();
document.body.appendChild(stats.dom);
composer.setSize(innerWidth, innerHeight);
let frames = 0;
let disposed = false;
const replacedMaterials = new Set<Material>();
new GLTFLoader().load(
  "/examples/models/gltf/godrays_demo.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const pillars = gltf.scene.getObjectByName("concrete");
    const base = gltf.scene.getObjectByName("base");
    if (!(pillars instanceof Mesh) || !(base instanceof Mesh)) {
      disposeObject(gltf.scene);
      canvas.dataset.state = "error";
      console.error("Unexpected godrays model");
      return;
    }
    for (const material of [pillars.material, base.material]) {
      for (const entry of Array.isArray(material) ? material : [material]) replacedMaterials.add(entry);
    }
    pillars.material = new MeshStandardMaterial({ color: 0x333333 });
    base.material = new MeshStandardMaterial({ color: 0x333333, side: Side.Double });
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    scene.add(gltf.scene);
    renderer.setAnimationLoop(() => {
      controls.update();
      stats.begin();
      composer.render();
      stats.end();
      canvas.dataset.state = "rendered";
      canvas.dataset.frames = String(++frames);
    });
  },
  undefined,
  (error) => {
    canvas.dataset.state = "error";
    console.error(error);
  },
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  godrays.dispose();
  composer.dispose();
  disposeObject(scene, replacedMaterials);
  light.shadow.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
  stats.dom.remove();
  renderer.dispose();
});
