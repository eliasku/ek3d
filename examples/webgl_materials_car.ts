import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping, MultiplyBlending } from "ek3d/constants";
import type { Object3D } from "ek3d/core/Object3D";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import type { Material } from "ek3d/materials/Material";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing car canvas");
const canvas = selected;
const scene = new Scene();
scene.background = new Color(0x333333);
scene.fog = new Fog(0x333333, 10, 15);
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
camera.position.set(4.25, 1.4, -4.5);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
const controls = new OrbitControls(camera, canvas);
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI / 2;
controls.target.set(0, 0.5, 0);
controls.update();
const grid = new GridHelper(20, 40, 0xffffff, 0xffffff);
grid.material.opacity = 0.2;
grid.material.depthWrite = false;
grid.material.transparent = true;
scene.add(grid);
const body = new MeshPhysicalMaterial({
  color: 0xff0000,
  metalness: 1,
  roughness: 0.5,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
});
const details = new MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.5 });
const glass = new MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0, transmission: 1 });
const colors = { body: 0xff0000, details: 0xffffff, glass: 0xffffff };
const gui = new GUI();
gui.addColor(colors, "body").onChange(() => body.color.set(colors.body));
gui.addColor(colors, "details").onChange(() => details.color.set(colors.details));
gui.addColor(colors, "glass").onChange(() => glass.color.set(colors.glass));
const stats = new Stats();
document.body.appendChild(stats.dom);
const manager = new LoadingManager();
const draco = new DRACOLoader(manager).setDecoderPath(DRACO_GLTF_CONFIG);
const oldMaterials = new Set<Material>();
const wheels: Object3D[] = [];
let disposed = false,
  failed = false,
  frames = 0;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
manager.onLoad = () => {
  if (!disposed && !failed) canvas.dataset.state = "rendered";
};
const env = new HDRLoader(manager).load(
  "/examples/textures/equirectangular/venice_sunset_1k.hdr",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.mapping = EquirectangularReflectionMapping;
    scene.environment = texture;
  },
  undefined,
  fail,
);
const shadow = new TextureLoader(manager).load(
  "/examples/models/gltf/ferrari_ao.png",
  (texture) => {
    if (disposed) texture.dispose();
  },
  undefined,
  fail,
);
new GLTFLoader(manager).setDRACOLoader(draco).load(
  "/examples/models/gltf/ferrari.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const car = gltf.scene.children[0];
    if (!car) {
      disposeObject(gltf.scene);
      fail(new Error("Missing car model"));
      return;
    }
    for (const [names, replacement] of [
      [["body"], body],
      [["rim_fl", "rim_fr", "rim_rr", "rim_rl", "trim"], details],
      [["glass"], glass],
    ] as const) {
      for (const name of names) {
        const part = car.getObjectByName(name);
        if (!(part instanceof Mesh)) {
          disposeObject(gltf.scene, oldMaterials);
          fail(new Error(`Missing car part ${name}`));
          return;
        }
        for (const material of Array.isArray(part.material) ? part.material : [part.material])
          oldMaterials.add(material);
        part.material = replacement;
      }
    }
    for (const name of ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"]) {
      const wheel = car.getObjectByName(name);
      if (!wheel) {
        disposeObject(gltf.scene, oldMaterials);
        fail(new Error(`Missing ${name}`));
        return;
      }
      wheels.push(wheel);
    }
    const plane = new Mesh(
      new PlaneGeometry(0.655 * 4, 1.3 * 4),
      new MeshBasicMaterial({
        map: shadow,
        blending: MultiplyBlending,
        toneMapped: false,
        transparent: true,
        premultipliedAlpha: true,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.renderOrder = 2;
    car.add(plane);
    scene.add(gltf.scene);
  },
  undefined,
  fail,
);
renderer.setAnimationLoop(() => {
  controls.update();
  const time = -performance.now() / 1000;
  for (const wheel of wheels) wheel.rotation.x = time * Math.PI * 2;
  grid.position.z = -time % 1;
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  scene.environment = null;
  disposeObject(scene, [...oldMaterials, body, details, glass]);
  env.dispose();
  shadow.dispose();
  draco.dispose();
  dfg.dispose();
  renderer.dispose();
});
