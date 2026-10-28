import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Object3D } from "ek3d/core/Object3D";
import { Raycaster } from "ek3d/core/Raycaster";
import { Group } from "ek3d/objects/Group";
import { Sprite } from "ek3d/objects/Sprite";
import { SpriteMaterial } from "ek3d/materials/SpriteMaterial";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { spriteShader } from "ek3d/renderers/shaders/SpriteShader";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing raycaster sprite canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;
const raycaster = new Raycaster();
const pointer = new Vector2();
let selectedObject: Sprite | null = null;
let renderer!: WebGLRenderer;
let scene!: Scene;
let camera!: PerspectiveCamera;
let group!: Group;
let controls!: OrbitControls;

init();

function init(): void {
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { SpriteMaterial: spriteShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  scene = new Scene();
  scene.background = new Color(0xffffff);
  group = new Group();
  scene.add(group);
  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(15, 15, 15);
  camera.lookAt(scene.position);
  controls = new OrbitControls(camera, canvas);
  controls.minDistance = 15;
  controls.maxDistance = 250;

  const sprite1 = new Sprite(new SpriteMaterial({ color: "#69f" }));
  sprite1.position.set(6, 5, 5);
  sprite1.scale.set(2, 5, 1);
  group.add(sprite1);

  const sprite2 = new Sprite(new SpriteMaterial({ color: "#69f", sizeAttenuation: false }));
  sprite2.material.rotation = (Math.PI / 3) * 4;
  sprite2.position.set(8, -2, 2);
  sprite2.center.set(0.5, 0);
  sprite2.scale.set(0.1, 0.5, 0.1);
  group.add(sprite2);

  const group2 = new Object3D();
  group2.scale.set(1, 2, 1);
  group2.position.set(-5, 0, 0);
  group2.rotation.set(Math.PI / 2, 0, 0);
  group.add(group2);
  const sprite3 = new Sprite(new SpriteMaterial({ color: "#69f" }));
  sprite3.position.set(0, 2, 5);
  sprite3.scale.set(10, 2, 3);
  sprite3.center.set(-0.1, 0);
  sprite3.material.rotation = Math.PI / 3;
  group2.add(sprite3);

  window.addEventListener("resize", onWindowResize);
  document.addEventListener("pointermove", onPointerMove);
}

function animate(): void {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerMove(event: PointerEvent): void {
  if (selectedObject !== null) {
    selectedObject.material.color.set("#69f");
    selectedObject = null;
  }
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(group, true)[0];
  if (hit && hit.object instanceof Sprite) {
    selectedObject = hit.object;
    selectedObject.material.color.set("#f00");
  }
}

window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  document.removeEventListener("pointermove", onPointerMove);
  renderer.setAnimationLoop(null);
  controls.dispose();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
