import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing furnace canvas");
const canvas = selected;
const scene = new Scene();
scene.background = new Color(0xcccccc);
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 30);
camera.position.z = 18;
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshBasicMaterial: basicShader, MeshPhysicalMaterial: physicalShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const envScene = new Scene();
envScene.background = new Color(0xcccccc);
const pmrem = new PMREMGenerator(renderer);
const environment = pmrem.fromScene(envScene);
pmrem.dispose();
const geometry = new SphereGeometry(0.4, 32, 16);
const materials: MeshPhysicalMaterial[] = [];
for (let x = 0; x <= 10; x++) {
  for (let y = 0; y <= 10; y++) {
    const material = new MeshPhysicalMaterial({
      roughness: x / 10,
      metalness: y / 10,
      color: 0xffffff,
      envMap: environment.texture,
      envMapIntensity: 1,
      transmission: 0,
      ior: 1.5,
    });
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x - 5, 5 - y, 0);
    scene.add(mesh);
  }
}
const gui = new GUI();
gui
  .add({ tint: false }, "tint")
  .name("Tint for Visibility")
  .onChange((value: unknown) => {
    for (const material of materials) material.color.setHex(value ? 0xccccff : 0xffffff);
  });
let frames = 0;
canvas.dataset.state = "rendered";
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
window.addEventListener(
  "pagehide",
  (event) => {
    if (event.persisted) return;
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
    gui.destroy();
    for (const material of materials) material.envMap = null;
    disposeObject(scene);
    environment.dispose();
    dfg.dispose();
    renderer.dispose();
  },
  { once: false },
);
