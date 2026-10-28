import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { degToRad } from "ek3d/math/MathUtils";
import { Object3D } from "ek3d/core/Object3D";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { Raycaster } from "ek3d/core/Raycaster";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Line } from "ek3d/objects/Line";
import { LineSegments } from "ek3d/objects/LineSegments";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing interactive lines canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;
const pointer = new Vector2();
const raycaster = new Raycaster();
let theta = 0;
let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let stats!: Stats;
let parentTransform!: Object3D;
let sphereInter!: Mesh;

init();

function init(): void {
  camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
  scene = new Scene();
  scene.background = new Color(0xf0f0f0);
  sphereInter = new Mesh(new SphereGeometry(5), new MeshBasicMaterial({ color: 0xff0000 }));
  sphereInter.visible = false;
  scene.add(sphereInter);

  const lineGeometry = new BufferGeometry();
  const points: number[] = [];
  const point = new Vector3();
  const direction = new Vector3();
  for (let i = 0; i < 50; i++) {
    direction.x += Math.random() - 0.5;
    direction.y += Math.random() - 0.5;
    direction.z += Math.random() - 0.5;
    direction.normalize().multiplyScalar(10);
    point.add(direction);
    points.push(point.x, point.y, point.z);
  }
  lineGeometry.setAttribute("position", new Float32BufferAttribute(points, 3));

  parentTransform = new Object3D();
  parentTransform.position.set(Math.random() * 40 - 20, Math.random() * 40 - 20, Math.random() * 40 - 20);
  parentTransform.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
  parentTransform.scale.set(Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5);
  for (let i = 0; i < 50; i++) {
    const material = new LineBasicMaterial({ color: Math.random() * 0xffffff });
    const object = Math.random() > 0.5 ? new Line(lineGeometry, material) : new LineSegments(lineGeometry, material);
    object.position.set(Math.random() * 400 - 200, Math.random() * 400 - 200, Math.random() * 400 - 200);
    object.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
    object.scale.set(Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5);
    parentTransform.add(object);
  }
  scene.add(parentTransform);
  raycaster.params.Line.threshold = 3;

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  stats = new Stats();
  document.body.appendChild(stats.dom);
  document.addEventListener("pointermove", onPointerMove);
  window.addEventListener("resize", onWindowResize);
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerMove(event: PointerEvent): void {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function animate(): void {
  theta += 0.1;
  camera.position.x = 100 * Math.sin(degToRad(theta));
  camera.position.y = 100 * Math.sin(degToRad(theta));
  camera.position.z = 100 * Math.cos(degToRad(theta));
  camera.lookAt(scene.position);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(parentTransform.children, true);
  sphereInter.visible = intersects.length > 0;
  if (intersects.length > 0) sphereInter.position.copy(intersects[0].point);
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
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
