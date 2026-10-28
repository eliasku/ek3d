import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Raycaster } from "ek3d/core/Raycaster";
import { Timer } from "ek3d/core/Timer";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Points } from "ek3d/objects/Points";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing raycasting points canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;
const pointer = new Vector2();
const raycaster = new Raycaster();
raycaster.params.Points.threshold = 0.1;
const rotateY = new Matrix4().makeRotationY(0.005);
const timer = new Timer();
timer.connect(document);
let spheresIndex = 0;
let toggle = 0;

function generatePointcloud(color: Color, indexed: boolean, grouped: boolean): Points {
  const width = 80;
  const length = 160;
  const numPoints = width * length;
  const positions = new Float32Array(numPoints * 3);
  const colors = new Float32Array(numPoints * 3);
  let k = 0;
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < length; j++) {
      const u = i / width;
      const v = j / length;
      const y = (Math.cos(u * Math.PI * 4) + Math.sin(v * Math.PI * 8)) / 20;
      positions[3 * k] = u - 0.5;
      positions[3 * k + 1] = y;
      positions[3 * k + 2] = v - 0.5;
      const intensity = (y + 0.1) * 5;
      colors[3 * k] = color.r * intensity;
      colors[3 * k + 1] = color.g * intensity;
      colors[3 * k + 2] = color.b * intensity;
      k++;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  if (indexed) {
    const indices = new Uint16Array(numPoints);
    for (let i = 0; i < numPoints; i++) indices[i] = i;
    geometry.setIndex(new BufferAttribute(indices, 1));
    if (grouped) geometry.addGroup(0, indices.length);
  }
  return new Points(geometry, new PointsMaterial({ size: 0.05, vertexColors: true }));
}

const scene = new Scene();
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(10, 10, 10);
camera.lookAt(scene.position);
camera.updateMatrix();
const pointclouds = [
  generatePointcloud(new Color(1, 0, 0), false, false),
  generatePointcloud(new Color(0, 1, 0), true, false),
  generatePointcloud(new Color(0, 1, 1), true, true),
];
pointclouds.forEach((cloud, i) => {
  cloud.scale.set(5, 10, 10);
  cloud.position.set((i - 1) * 5, 0, 0);
  scene.add(cloud);
});
const sphereGeometry = new SphereGeometry(0.1, 32, 32);
const sphereMaterial = new MeshBasicMaterial({ color: 0xff0000 });
const spheres: Mesh[] = [];
for (let i = 0; i < 40; i++) {
  const sphere = new Mesh(sphereGeometry, sphereMaterial);
  scene.add(sphere);
  spheres.push(sphere);
}
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { PointsMaterial: pointsShader, MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
const stats = new Stats();
document.body.appendChild(stats.dom);
window.addEventListener("resize", onWindowResize);
document.addEventListener("pointermove", onPointerMove);

function onPointerMove(event: PointerEvent): void {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function animate(): void {
  timer.update();
  camera.applyMatrix4(rotateY);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  const intersection = raycaster.intersectObjects(pointclouds, false)[0];
  if (toggle > 0.02 && intersection !== undefined) {
    spheres[spheresIndex].position.copy(intersection.point);
    spheres[spheresIndex].scale.set(1, 1, 1);
    spheresIndex = (spheresIndex + 1) % spheres.length;
    toggle = 0;
  }
  for (const sphere of spheres) {
    sphere.scale.multiplyScalar(0.98);
    sphere.scale.clampScalar(0.01, 1);
  }
  toggle += timer.getDelta();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
}
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  document.removeEventListener("pointermove", onPointerMove);
  renderer.setAnimationLoop(null);
  timer.dispose();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
