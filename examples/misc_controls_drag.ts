import { DragControls } from "ek3d/addons/controls/DragControls";
import { ShadowMap, TOUCH } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Raycaster } from "ek3d/core/Raycaster";
import { Vector2 } from "ek3d/math/Vector2";
import { Color } from "ek3d/math/Color";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { Scene } from "ek3d/scenes/Scene";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing drag controls example canvas");
const canvas: HTMLCanvasElement = element;

const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.z = 25;

const scene = new Scene();
scene.background = new Color(0xf0f0f0);

scene.add(new AmbientLight(0xaaaaaa));

const light = new SpotLight(0xffffff, 10000);
light.position.set(0, 25, 50);
light.angle = Math.PI / 9;

light.castShadow = true;
light.shadow.camera.near = 10;
light.shadow.camera.far = 100;
light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;

scene.add(light);

const group = new Group();
scene.add(group);

const geometry = new BoxGeometry();
const objects: Mesh[] = [];

for (let i = 0; i < 200; i++) {
  const object = new Mesh(geometry, new MeshLambertMaterial({ color: Math.random() * 0xffffff }));

  object.position.x = Math.random() * 30 - 15;
  object.position.y = Math.random() * 15 - 7.5;
  object.position.z = Math.random() * 20 - 10;

  object.rotation.x = Math.random() * 2 * Math.PI;
  object.rotation.y = Math.random() * 2 * Math.PI;
  object.rotation.z = Math.random() * 2 * Math.PI;

  object.scale.x = Math.random() * 2 + 1;
  object.scale.y = Math.random() * 2 + 1;
  object.scale.z = Math.random() * 2 + 1;

  object.castShadow = true;
  object.receiveShadow = true;

  scene.add(object);

  objects.push(object);
}

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshLambertMaterial: lambertShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap!.enabled = true;
renderer.shadowMap!.type = ShadowMap.PCF;

const controls = new DragControls([...objects], camera, canvas);
controls.rotateSpeed = 2;
controls.addEventListener("drag", () => {
  draggingFrame = 3;
  render();
});

const mouse = new Vector2();
const raycaster = new Raycaster();

let enableSelection = false;
let draggingFrame = 0;
let frames = 0;

function render(): void {
  renderer.render(scene, camera);
}

function publishState(): void {
  canvas.dataset.state = "rendered";
  canvas.dataset.dragging = String(draggingFrame > 0);
  canvas.dataset.grouped = String(group.children.length);
  canvas.dataset.frames = String(frames);
  if (draggingFrame > 0) draggingFrame--;
}

// Page check hooks: Digit1 toggles the touch pan/rotate assignment (the M key upstream), Shift+click selects.
window.addEventListener("keydown", (event) => {
  if (event.key === "Shift") enableSelection = true;
  if (event.code === "KeyM") {
    controls.touches.ONE = controls.touches.ONE === TOUCH.PAN ? TOUCH.ROTATE : TOUCH.PAN;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "Shift") enableSelection = false;
});

document.addEventListener("click", (event) => {
  event.preventDefault();

  if (enableSelection === true) {
    const draggableObjects = controls.objects;
    draggableObjects.length = 0;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersections = raycaster.intersectObjects(objects, true);

    if (intersections.length > 0) {
      const object = intersections[0].object as Mesh;

      if (group.children.includes(object) === true) {
        (object.material as MeshLambertMaterial).emissive.set(0x000000);
        scene.attach(object);
      } else {
        (object.material as MeshLambertMaterial).emissive.set(0xaaaaaa);
        group.attach(object);
      }

      controls.transformGroup = true;
      draggableObjects.push(group);
    }

    if (group.children.length === 0) {
      controls.transformGroup = false;
      draggableObjects.push(...objects);
    }
  }

  render();
});

function animate(): void {
  frames++;
  publishState();
  render();
}

renderer.setAnimationLoop(animate);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    controls.dispose();
    renderer.setAnimationLoop(null);
    for (const object of objects) (object.material as MeshLambertMaterial).dispose();
    geometry.dispose();
    renderer.dispose();
  },
  { once: true },
);
