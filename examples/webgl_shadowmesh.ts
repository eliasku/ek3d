import { ShadowMesh } from "ek3d/addons/objects/ShadowMesh";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { ArrowHelper } from "ek3d/helpers/ArrowHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Plane } from "ek3d/math/Plane";
import { Vector3 } from "ek3d/math/Vector3";
import { Vector4 } from "ek3d/math/Vector4";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const button = document.querySelector<HTMLInputElement>("#lightButton");
if (!canvas || !button) throw new Error("Missing shadow mesh controls");
const scene = new Scene();
scene.background = new Color(0x0096ff);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 1, 3000);
camera.position.set(0, 2.5, 10);
scene.add(camera);
const renderer = new WebGLRenderer({
  canvas,
  stencil: true,
  createBackground: WebGLBackground,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshLambertMaterial: lambertShader,
    MeshPhongMaterial: phongShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
const timer = new Timer();
timer.connect(document);
const sun = new DirectionalLight("rgb(255,255,255)", 3);
sun.position.set(5, 7, -1);
sun.lookAt(scene.position);
scene.add(sun);
const lightPosition = new Vector4(5, 7, -1, 0.001);
const direction = new Vector3().subVectors(scene.position, sun.position).normalize();
const arrows = [0, 0.2, -0.2].map((offset) => {
  const arrow = new ArrowHelper(
    direction,
    sun.position.clone().add(new Vector3(0, offset, 0)),
    0.9,
    0xffff00,
    0.25,
    0.08,
  );
  scene.add(arrow);
  return arrow;
});
const bulb = new Mesh(new SphereGeometry(0.09), new MeshBasicMaterial({ color: "rgb(255,255,255)" }));
const holder = new Mesh(new CylinderGeometry(0.05, 0.05, 0.13), new MeshBasicMaterial({ color: "rgb(75,75,75)" }));
bulb.visible = false;
holder.visible = false;
scene.add(bulb, holder);
const ground = new Mesh<MeshLambertMaterial>(
  new BoxGeometry(30, 0.01, 40),
  new MeshLambertMaterial({ color: "rgb(0,130,0)" }),
);
scene.add(ground);
const cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ color: "rgb(255,0,0)", emissive: 0x200000 }));
cube.position.z = -1;
const cylinder = new Mesh(
  new CylinderGeometry(0.3, 0.3, 2),
  new MeshPhongMaterial({ color: "rgb(0,0,255)", emissive: 0x000020 }),
);
cylinder.position.z = -2.5;
const torus = new Mesh(
  new TorusGeometry(1, 0.2, 10, 16, Math.PI * 2),
  new MeshPhongMaterial({ color: "rgb(255,0,255)", emissive: 0x200020 }),
);
torus.position.z = -6;
const sphere = new Mesh(
  new SphereGeometry(0.5, 20, 10),
  new MeshPhongMaterial({ color: "rgb(255,255,255)", emissive: 0x222222 }),
);
sphere.position.set(4, 0.5, 2);
const pyramid = new Mesh(
  new CylinderGeometry(0, 0.5, 2, 4),
  new MeshPhongMaterial({ color: "rgb(255,255,0)", emissive: 0x440000, flatShading: true, shininess: 0 }),
);
pyramid.position.set(-4, 1, 2);
const objects = [cube, cylinder, torus, sphere, pyramid];
const shadows = objects.map((object) => {
  const shadow = new ShadowMesh(object);
  scene.add(object, shadow);
  return shadow;
});
const plane = new Plane(new Vector3(0, 1, 0), 0.01);
let directional = true;
function toggle(): void {
  directional = !directional;
  (scene.background as Color).setHex(directional ? 0x0096ff : 0x000000);
  ground.material.color.setHex(directional ? 0x008200 : 0x969696);
  sun.position.set(directional ? 5 : 0, directional ? 7 : 6, directional ? -1 : -2);
  sun.lookAt(scene.position);
  lightPosition.set(sun.position.x, sun.position.y, sun.position.z, directional ? 0.001 : 0.9);
  bulb.position.copy(sun.position);
  holder.position.copy(bulb.position);
  holder.position.y += 0.12;
  for (const arrow of arrows) arrow.visible = directional;
  bulb.visible = !directional;
  holder.visible = !directional;
  button!.value = directional ? "Switch to PointLight" : "Switch to DirectionalLight";
}
function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
let horizontal = 0,
  vertical = 0;
resize();
window.addEventListener("resize", resize);
button.addEventListener("click", toggle);
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = timer.getDelta();
  cube.rotation.x += delta;
  cube.rotation.y += delta;
  cylinder.rotation.y += delta;
  cylinder.rotation.z -= delta;
  torus.rotation.x -= delta;
  torus.rotation.y -= delta;
  pyramid.rotation.y += 0.5 * delta;
  horizontal = (horizontal + 0.5 * delta) % (Math.PI * 2);
  vertical = (vertical + 1.5 * delta) % (Math.PI * 2);
  cube.position.x = Math.sin(horizontal) * 4;
  cylinder.position.x = -Math.sin(horizontal) * 4;
  torus.position.x = Math.cos(horizontal) * 4;
  cube.position.y = Math.sin(vertical) * 2 + 2.9;
  cylinder.position.y = Math.sin(vertical) * 2 + 3.1;
  torus.position.y = Math.cos(vertical) * 2 + 3.3;
  for (const object of objects) object.updateMatrixWorld();
  for (const shadow of shadows) shadow.update(plane, lightPosition);
  renderer.render(scene, camera);
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  button!.removeEventListener("click", toggle);
  renderer.setAnimationLoop(null);
  timer.dispose();
  sun.dispose();
  disposeObject(scene);
  renderer.dispose();
});
