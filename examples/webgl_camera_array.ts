import { ArrayCamera } from "ek3d/cameras/ArrayCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Vector4 } from "ek3d/math/Vector4";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing array camera canvas");
const canvas: HTMLCanvasElement = selected;
const amount = 6;
const cameras: PerspectiveCamera[] = [];
for (let y = 0; y < amount; y++) {
  for (let x = 0; x < amount; x++) {
    const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 10);
    camera.viewport = new Vector4();
    camera.position.set(x / amount - 0.5, 0.5 - y / amount, 1.5).multiplyScalar(2);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    cameras.push(camera);
  }
}
const camera = new ArrayCamera(cameras);
camera.position.z = 3;
const scene = new Scene();
scene.add(new AmbientLight(0x999999));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0.5, 0.5, 1);
light.castShadow = true;
light.shadow.camera.zoom = 4;
scene.add(light);
const background = new Mesh(new PlaneGeometry(100, 100), new MeshPhongMaterial({ color: 0x000066 }));
background.receiveShadow = true;
background.position.z = -1;
scene.add(background);
const mesh = new Mesh(new CylinderGeometry(0.5, 0.5, 1, 32), new MeshPhongMaterial({ color: 0xff0000 }));
mesh.castShadow = true;
mesh.receiveShadow = true;
scene.add(mesh);
const renderer = new WebGLRenderer({
  canvas,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
});
renderer.shadowMap!.enabled = true;
function resize(): void {
  const width = (innerWidth / amount) * devicePixelRatio;
  const height = (innerHeight / amount) * devicePixelRatio;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  for (let y = 0; y < amount; y++) {
    for (let x = 0; x < amount; x++) {
      const subcamera = cameras[amount * y + x]!;
      subcamera.viewport.set(Math.floor(x * width), Math.floor(y * height), Math.ceil(width), Math.ceil(height));
      subcamera.aspect = camera.aspect;
      subcamera.updateProjectionMatrix();
    }
  }
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
}
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  mesh.rotation.x += 0.005;
  mesh.rotation.z += 0.01;
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  light.shadow.dispose();
  renderer.dispose();
});
