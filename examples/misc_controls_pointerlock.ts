import { PointerLockControls } from "ek3d/addons/controls/PointerLockControls";
import { SRGBColorSpace } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Raycaster } from "ek3d/core/Raycaster";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import type { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Vector3 } from "ek3d/math/Vector3";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing pointer lock controls example canvas");
const canvas: HTMLCanvasElement = element;
const blocker = document.querySelector<HTMLDivElement>("#blocker");
if (blocker === null) throw new Error("Missing pointer lock blocker overlay");
const instructions = document.querySelector<HTMLDivElement>("#instructions");
if (instructions === null) throw new Error("Missing pointer lock instructions overlay");

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.y = 10;

const scene = new Scene();
scene.background = new Color(0xffffff);
scene.fog = new Fog(0xffffff, 0, 750);

const light = new HemisphereLight(0xeeeeff, 0x777788, 2.5);
light.position.set(0.5, 1, 0.75);
scene.add(light);

const controls = new PointerLockControls(camera, document.body);

instructions.addEventListener("click", () => {
  controls.lock();
});

controls.addEventListener("lock", () => {
  instructions.style.display = "none";
  blocker.style.display = "none";
});

controls.addEventListener("unlock", () => {
  blocker.style.display = "block";
  instructions.style.display = "";
});

scene.add(controls.object);

const objects: Mesh[] = [];

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new Vector3();
const direction = new Vector3();
const vertex = new Vector3();
const color = new Color();

function onDocumentKeyDown(event: KeyboardEvent): void {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = true;
      break;

    case "ArrowLeft":
    case "KeyA":
      moveLeft = true;
      break;

    case "ArrowDown":
    case "KeyS":
      moveBackward = true;
      break;

    case "ArrowRight":
    case "KeyD":
      moveRight = true;
      break;

    case "Space":
      if (canJump === true) velocity.y += 350;
      canJump = false;
      break;
  }
}

function onDocumentKeyUp(event: KeyboardEvent): void {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = false;
      break;

    case "ArrowLeft":
    case "KeyA":
      moveLeft = false;
      break;

    case "ArrowDown":
    case "KeyS":
      moveBackward = false;
      break;

    case "ArrowRight":
    case "KeyD":
      moveRight = false;
      break;
  }
}

document.addEventListener("keydown", onDocumentKeyDown);
document.addEventListener("keyup", onDocumentKeyUp);

const raycaster = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, 10);

// floor

let floorGeometry: BufferGeometry = new PlaneGeometry(2000, 2000, 100, 100);
floorGeometry.rotateX(-Math.PI / 2);

// vertex displacement

let position = floorGeometry.attributes.position as BufferAttribute;

for (let i = 0, l = position.count; i < l; i++) {
  vertex.fromBufferAttribute(position, i);

  vertex.x += Math.random() * 20 - 10;
  vertex.y += Math.random() * 2;
  vertex.z += Math.random() * 20 - 10;

  position.setXYZ(i, vertex.x, vertex.y, vertex.z);
}

floorGeometry = floorGeometry.toNonIndexed(); // ensure each face has unique vertices

position = floorGeometry.attributes.position as BufferAttribute;
const colorsFloor: number[] = [];

for (let i = 0, l = position.count; i < l; i++) {
  color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, SRGBColorSpace);
  colorsFloor.push(color.r, color.g, color.b);
}

floorGeometry.setAttribute("color", new Float32BufferAttribute(colorsFloor, 3));

const floorMaterial = new MeshBasicMaterial({ vertexColors: true });

const floor = new Mesh(floorGeometry, floorMaterial);
scene.add(floor);

// objects

const boxGeometry = new BoxGeometry(20, 20, 20).toNonIndexed();

position = boxGeometry.attributes.position as BufferAttribute;
const colorsBox: number[] = [];

for (let i = 0, l = position.count; i < l; i++) {
  color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, SRGBColorSpace);
  colorsBox.push(color.r, color.g, color.b);
}

boxGeometry.setAttribute("color", new Float32BufferAttribute(colorsBox, 3));

for (let i = 0; i < 500; i++) {
  const boxMaterial = new MeshPhongMaterial({
    specular: 0xffffff,
    flatShading: true,
    vertexColors: true,
  });
  boxMaterial.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75, SRGBColorSpace);

  const box = new Mesh(boxGeometry, boxMaterial);
  box.position.x = Math.floor(Math.random() * 20 - 10) * 20;
  box.position.y = Math.floor(Math.random() * 20) * 20 + 10;
  box.position.z = Math.floor(Math.random() * 20 - 10) * 20;

  scene.add(box);
  objects.push(box);
}

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

function publishState(): void {
  canvas.dataset.state = "rendered";
  canvas.dataset.locked = String(controls.isLocked);
  canvas.dataset.frames = String(frames);
}

let frames = 0;

function animate(): void {
  const time = performance.now();

  if (controls.isLocked === true) {
    raycaster.ray.origin.copy(controls.object.position);
    raycaster.ray.origin.y -= 10;

    const intersections = raycaster.intersectObjects(objects, false);

    const onObject = intersections.length > 0;

    const delta = (time - prevTime) / 1000;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize(); // this ensures consistent movements in all directions

    if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

    if (onObject === true) {
      velocity.y = Math.max(0, velocity.y);
      canJump = true;
    }

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    controls.object.position.y += velocity.y * delta; // new behavior

    if (controls.object.position.y < 10) {
      velocity.y = 0;
      controls.object.position.y = 10;

      canJump = true;
    }
  }

  prevTime = time;

  renderer.render(scene, camera);
  frames++;
  publishState();
}

renderer.setAnimationLoop(animate);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    document.removeEventListener("keydown", onDocumentKeyDown);
    document.removeEventListener("keyup", onDocumentKeyUp);
    controls.dispose();
    renderer.setAnimationLoop(null);
    floorGeometry.dispose();
    boxGeometry.dispose();
    floorMaterial.dispose();
    for (const box of objects) (box.material as MeshPhongMaterial).dispose();
    renderer.dispose();
  },
  { once: true },
);
