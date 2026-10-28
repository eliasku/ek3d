import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { OBB } from "ek3d/addons/math/OBB";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Raycaster } from "ek3d/core/Raycaster";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing OBB canvas");
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 0, 75);
const scene = new Scene();
scene.background = new Color(0xffffff);
const light = new HemisphereLight(0xffffff, 0x222222, 4);
light.position.set(1, 1, 1);
scene.add(light);
const timer = new Timer();
timer.connect(document);
const geometry = new BoxGeometry(10, 5, 6);
const localBox = new OBB(new Vector3(), new Vector3(5, 2.5, 3));
const objects: { mesh: Mesh<MeshLambertMaterial>; box: OBB }[] = [];
for (let i = 0; i < 100; i++) {
  const mesh = new Mesh<MeshLambertMaterial>(geometry, new MeshLambertMaterial({ color: 0x00ff00 }));
  mesh.matrixAutoUpdate = false;
  mesh.position.set(Math.random() * 80 - 40, Math.random() * 80 - 40, Math.random() * 80 - 40);
  mesh.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
  mesh.scale.set(Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5);
  scene.add(mesh);
  objects.push({ mesh, box: new OBB() });
}
const hitbox = new Mesh<MeshBasicMaterial>(geometry, new MeshBasicMaterial({ color: 0x000000, wireframe: true }));
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshBasicMaterial: basicShader, MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
const stats = new Stats();
document.body.appendChild(stats.dom);
const raycaster = new Raycaster();
const mouse = new Vector2();
const intersection = new Vector3();
function click(event: MouseEvent): void {
  event.preventDefault();
  mouse.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  let closest = Infinity;
  let selected: Mesh<MeshLambertMaterial> | null = null;
  for (const { mesh, box } of objects) {
    if (box.intersectRay(raycaster.ray, intersection) !== null) {
      const distance = raycaster.ray.origin.distanceTo(intersection);
      if (distance < closest) {
        closest = distance;
        selected = mesh;
      }
    }
  }
  if (selected) selected.add(hitbox);
  else hitbox.removeFromParent();
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
document.addEventListener("click", click);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  controls.update();
  const delta = timer.getDelta();
  for (const { mesh, box } of objects) {
    mesh.rotation.x += delta * Math.PI * 0.2;
    mesh.rotation.y += delta * Math.PI * 0.1;
    mesh.updateMatrix();
    mesh.updateMatrixWorld();
    box.copy(localBox).applyMatrix4(mesh.matrixWorld);
    mesh.material.color.setHex(0x00ff00);
  }
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      if (objects[i].box.intersectsOBB(objects[j].box)) {
        objects[i].mesh.material.color.setHex(0xff0000);
        objects[j].mesh.material.color.setHex(0xff0000);
      }
    }
  }
  renderer.render(scene, camera);
  stats.update();
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.removeEventListener("click", click);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.disconnect();
  controls.dispose();
  disposeObject(scene, [hitbox.material]);
  renderer.dispose();
  stats.dom.remove();
});
