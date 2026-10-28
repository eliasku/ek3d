import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, Mapping } from "ek3d/constants";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { disposeObject } from "./dispose-object";
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing transmission alpha canvas");
const canvas = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 2000);
camera.position.set(-5, 0.5, 0);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ToneMapping.ACESFilmic;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 5;
controls.maxDistance = 20;
controls.target.y = 0.5;
controls.update();
const gui = new GUI();
const manager = new LoadingManager();
let environment: DataTexture | undefined;
let disposed = false,
  frames = 0;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
new UltraHDRLoader(manager).load(
  "/examples/textures/equirectangular/royal_esplanade_2k.hdr.jpg",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    environment = texture;
    texture.mapping = Mapping.EquirectangularReflection;
    scene.environment = texture;
    new GLTFLoader(manager).load(
      "/examples/models/gltf/DragonAttenuation.glb",
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        let material: MeshPhysicalMaterial | undefined;
        gltf.scene.traverse((child) => {
          if (child instanceof Mesh && child.material instanceof MeshPhysicalMaterial) material = child.material;
        });
        if (!material) {
          disposeObject(gltf.scene);
          fail(new Error("Missing dragon physical material"));
          return;
        }
        scene.add(gltf.scene);
        const target = material;
        const params = {
          color: target.color.getHex(),
          transmission: target.transmission,
          opacity: 1,
          metalness: target.metalness,
          roughness: target.roughness,
          ior: target.ior,
          thickness: target.thickness,
          attenuationColor: target.attenuationColor.getHex(),
          attenuationDistance: target.attenuationDistance,
          specularIntensity: target.specularIntensity,
          specularColor: 0xffffff,
          envMapIntensity: 1,
          exposure: 1,
        };
        gui.addColor(params, "color").onChange(() => target.color.set(params.color));
        gui.add(params, "transmission", 0, 1, 0.01).onChange(() => {
          target.transmission = params.transmission;
        });
        gui.add(params, "opacity", 0, 1, 0.01).onChange(() => {
          target.opacity = params.opacity;
          const transparent = params.opacity < 1;
          if (target.transparent !== transparent) {
            target.transparent = transparent;
            target.needsUpdate = true;
          }
        });
        gui.add(params, "metalness", 0, 1, 0.01).onChange(() => {
          target.metalness = params.metalness;
        });
        gui.add(params, "roughness", 0, 1, 0.01).onChange(() => {
          target.roughness = params.roughness;
        });
        gui.add(params, "ior", 1, 2, 0.01).onChange(() => {
          target.ior = params.ior;
        });
        gui.add(params, "thickness", 0, 5, 0.01).onChange(() => {
          target.thickness = params.thickness;
        });
        gui
          .addColor(params, "attenuationColor")
          .name("attenuation color")
          .onChange(() => target.attenuationColor.set(params.attenuationColor));
        gui.add(params, "attenuationDistance", 0, 1, 0.01).onChange(() => {
          target.attenuationDistance = params.attenuationDistance;
        });
        gui.add(params, "specularIntensity", 0, 1, 0.01).onChange(() => {
          target.specularIntensity = params.specularIntensity;
        });
        gui.addColor(params, "specularColor").onChange(() => target.specularColor.set(params.specularColor));
        gui
          .add(params, "envMapIntensity", 0, 1, 0.01)
          .name("envMap intensity")
          .onChange(() => {
            target.envMapIntensity = params.envMapIntensity;
          });
        gui.add(params, "exposure", 0, 1, 0.01).onChange(() => {
          renderer.toneMappingExposure = params.exposure;
        });
        gui.open();
        canvas.dataset.state = "rendered";
      },
      undefined,
      fail,
    );
  },
  undefined,
  fail,
);
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
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
  scene.environment = null;
  disposeObject(scene);
  environment?.dispose();
  dfg.dispose();
  renderer.dispose();
});
