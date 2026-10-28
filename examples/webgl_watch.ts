import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { TAARenderPass } from "ek3d/addons/postprocessing/TAARenderPass";
import { UnrealBloomPass } from "ek3d/addons/postprocessing/UnrealBloomPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Object3D } from "ek3d/core/Object3D";
import { Blending, Mapping, ToneMapping } from "ek3d/constants";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { Material } from "ek3d/materials/Material";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Spherical } from "ek3d/math/Spherical";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import type { Texture } from "ek3d/textures/Texture";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 20);
camera.position.set(0.8, 0.5, -1.5);
const scene = new Scene();
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ToneMapping.Neutral;
renderer.toneMappingExposure = 0.7;
renderer.shadowMap!.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 0.3;
controls.maxDistance = 10;
controls.target.set(0, -0.1, 0);
controls.update();
controls.enabled = false;
const startDistance = controls.getDistance(),
  startPhi = controls.getPolarAngle(),
  startTheta = controls.getAzimuthalAngle();
const start = performance.now(),
  spherical = new Spherical();
const light = new DirectionalLight(0xffffff, 6);
light.position.set(0.2, 0.6, 0.4);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
light.shadow.radius = 8;
light.shadow.bias = -0.0005;
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 2;
light.shadow.camera.right = light.shadow.camera.top = 0.5;
light.shadow.camera.left = light.shadow.camera.bottom = -0.5;
scene.add(light);
const point = new PointLight(0x7b8cad, 1, 0, 2);
point.position.set(-0.3, -0.2, -0.2);
scene.add(point);
const setting = {
  roughness: 0.1,
  metalness: 1,
  opacity: 0.8,
  threshold: 0,
  strength: 0.007,
  radius: 0,
  postProcess: false,
};
const taa = new TAARenderPass(scene, camera);
taa.sampleLevel = 2;
const bloom = new UnrealBloomPass(new Vector2(innerWidth, innerHeight), 1.5, 0.4, 0.85);
bloom.threshold = setting.threshold;
bloom.strength = setting.strength;
bloom.radius = setting.radius;
const composer = new EffectComposer(renderer);
const output = new OutputPass();
composer.addPass(taa);
composer.addPass(bloom);
composer.addPass(output);
const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
const oldMaterials = new Set<Material>();
let disposed = false,
  loaded = false,
  frames = 0;
let gui: GUI | undefined;
let model: Object3D | undefined;
let environment: Texture | undefined;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
new HDRLoader().load(
  "/examples/textures/equirectangular/lobe.hdr",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    environment = texture;
    texture.mapping = Mapping.EquirectangularReflection;
    scene.background = scene.environment = texture;
    scene.backgroundBlurriness = 0.5;
    scene.backgroundIntensity = 1;
    scene.environmentIntensity = 1.5;
    new GLTFLoader().setDRACOLoader(draco).load(
      "/examples/models/gltf/rolex.glb",
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        model = gltf.scene;
        model.rotation.x = Math.PI * 0.25;
        const materials = new Map<string, MeshStandardMaterial>();
        model.traverse((child) => {
          if (
            !(child instanceof Mesh) ||
            Array.isArray(child.material) ||
            !(child.material instanceof MeshStandardMaterial)
          )
            return;
          child.material.vertexColors = false;
          const prior = materials.get(child.material.name);
          if (prior && prior !== child.material) {
            oldMaterials.add(child.material);
            child.material = prior;
          } else materials.set(child.material.name, child.material);
          if (child.name !== "glass" && child.name !== "floor") child.castShadow = child.receiveShadow = true;
        });
        const glass = model.getObjectByName("glass");
        const gold = materials.get("Gold"),
          silver = materials.get("Silver");
        const names = ["hour", "minute", "second", "mini_03", "mini_02", "mini_01"];
        const hands = names.map((name) => model!.getObjectByName(name));
        if (!(glass instanceof Mesh) || !gold || !silver || hands.some((hand) => !hand)) {
          disposeObject(model, oldMaterials);
          model = undefined;
          fail(new Error("Missing watch parts"));
          return;
        }
        for (const material of Array.isArray(glass.material) ? glass.material : [glass.material])
          oldMaterials.add(material);
        glass.material = new MeshPhysicalMaterial({
          color: 0x020205,
          transparent: true,
          opacity: setting.opacity,
          metalness: 0,
          roughness: 0,
          iridescence: 0.3,
          clearcoat: 1,
          blending: Blending.Additive,
        });
        scene.add(model);
        gui = new GUI();
        const updateMaterial = () => {
          gold.metalness = silver.metalness = setting.metalness;
          gold.roughness = silver.roughness = setting.roughness;
          if (glass.material instanceof MeshPhysicalMaterial) glass.material.opacity = setting.opacity;
        };
        gui.add(setting, "roughness", 0, 1, 0.01).onChange(updateMaterial);
        gui.add(setting, "metalness", 0, 1, 0.01).onChange(updateMaterial);
        gui.add(setting, "opacity", 0, 1, 0.01).onChange(updateMaterial);
        gui.add(setting, "postProcess");
        const updateBloom = () => {
          bloom.threshold = setting.threshold;
          bloom.strength = setting.strength;
          bloom.radius = setting.radius;
        };
        gui.add(setting, "threshold", 0, 1, 0.01).onChange(updateBloom);
        gui.add(setting, "strength", 0, 0.1, 0.001).onChange(updateBloom);
        gui.add(setting, "radius", 0, 1, 0.01).onChange(updateBloom);
        loaded = true;
      },
      undefined,
      fail,
    );
  },
  undefined,
  fail,
);
function animate(): void {
  const t = Math.min(1, (performance.now() - start) / 6000);
  if (t < 1) {
    const eased = t * (2 - t);
    spherical.set(
      startDistance + (1 - startDistance) * eased,
      startPhi,
      startTheta + (-Math.PI * 0.2 - startTheta) * eased,
    );
    camera.position.setFromSpherical(spherical).add(controls.target);
    camera.lookAt(controls.target);
  } else if (!controls.enabled) {
    controls.enabled = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
  }
  controls.update();
  if (loaded && model) {
    const date = new Date();
    const values = [
      (date.getHours() % 12) * 30,
      date.getMinutes() * 6,
      date.getSeconds() * 6,
      Math.min(date.getDay(), 30) * 12,
      date.getMonth() * 30,
      date.getMilliseconds() * 0.36,
    ];
    ["hour", "minute", "second", "mini_03", "mini_02", "mini_01"].forEach((name, i) => {
      model!.getObjectByName(name)!.rotation.y = (-values[i] * Math.PI) / 180;
    });
  }
  if (setting.postProcess) composer.render();
  else renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
}
renderer.setAnimationLoop(animate);
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
  gui?.destroy();
  if (model) disposeObject(model, oldMaterials);
  environment?.dispose();
  draco.dispose();
  taa.dispose();
  bloom.dispose();
  output.dispose();
  composer.dispose();
  dfg.dispose();
  renderer.dispose();
});
