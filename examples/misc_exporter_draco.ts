import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { DRACOExporter } from "ek3d/addons/exporters/DRACOExporter";
import type { DracoEncoderModule } from "ek3d/addons/exporters/DRACOExporter";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing Draco exporter canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.fog = new Fog(0xa0a0a0, 4, 20);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(4, 2, 4);
const hemi = new HemisphereLight(0xffffff, 0x444444, 3);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, 20, 10);
light.castShadow = true;
light.shadow.camera.top = 2;
light.shadow.camera.bottom = -2;
light.shadow.camera.left = -2;
light.shadow.camera.right = 2;
scene.add(light);
const ground = new Mesh(new PlaneGeometry(40, 40), new MeshPhongMaterial({ color: 0xbbbbbb, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new GridHelper(40, 20, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);
const mesh = new Mesh(new TorusKnotGeometry(0.75, 0.2, 200, 30), new MeshPhongMaterial({ color: 0x00ff00 }));
mesh.castShadow = true;
mesh.position.y = 1.5;
scene.add(mesh);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (renderer.shadowMap === null) throw new Error("Shadow map unavailable");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.5, 0);
controls.update();
const gui = new GUI();
const runtimeWindow = window as Window & {
  DracoEncoderModule?: () => DracoEncoderModule | Promise<DracoEncoderModule>;
};
if (typeof runtimeWindow.DracoEncoderModule !== "function") throw new Error("Missing Draco encoder runtime");
const encoder = Promise.resolve(runtimeWindow.DracoEncoderModule());
let disposed = false;
let frames = 0;
canvas.dataset.state = "loading";
const params = {
  export: async () => {
    try {
      const exporter = new DRACOExporter(await encoder);
      const result = await exporter.parseAsync(mesh);
      if (disposed) return;
      const url = URL.createObjectURL(new Blob([result.buffer as ArrayBuffer], { type: "application/octet-stream" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "file.drc";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    }
  },
};
gui.add(params, "export").name("Export DRC");
gui.open();
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
});
