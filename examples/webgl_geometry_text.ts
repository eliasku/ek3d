import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import type { Font } from "ek3d/addons/loaders/FontLoader";
import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing text example canvas");

type FontWeight = "regular" | "bold";

const fontNames = ["helvetiker", "optimer", "gentilis", "droid/droid_sans", "droid/droid_serif"] as const;
type FontName = (typeof fontNames)[number];

const fontURLs: Record<FontName, Record<FontWeight, string>> = {
  helvetiker: {
    regular: new URL("./fonts/helvetiker_regular.typeface.json", import.meta.url).href,
    bold: new URL("./fonts/helvetiker_bold.typeface.json", import.meta.url).href,
  },
  optimer: {
    regular: new URL("./fonts/optimer_regular.typeface.json", import.meta.url).href,
    bold: new URL("./fonts/optimer_bold.typeface.json", import.meta.url).href,
  },
  gentilis: {
    regular: new URL("./fonts/gentilis_regular.typeface.json", import.meta.url).href,
    bold: new URL("./fonts/gentilis_bold.typeface.json", import.meta.url).href,
  },
  "droid/droid_sans": {
    regular: new URL("./fonts/droid/droid_sans_regular.typeface.json", import.meta.url).href,
    bold: new URL("./fonts/droid/droid_sans_bold.typeface.json", import.meta.url).href,
  },
  "droid/droid_serif": {
    regular: new URL("./fonts/droid/droid_serif_regular.typeface.json", import.meta.url).href,
    bold: new URL("./fonts/droid/droid_serif_bold.typeface.json", import.meta.url).href,
  },
};

let text = "three.js";
let bevelEnabled = true;
let font: Font | undefined;
let fontName: FontName = "optimer";
let fontWeight: FontWeight = "bold";
let fontIndex = 1;

const depth = 20;
const size = 70;
const hover = 30;
const curveSegments = 4;
const bevelThickness = 2;
const bevelSize = 1.5;
const mirror = true;

let targetRotation = 0;
let targetRotationOnPointerDown = 0;
let pointerX = 0;
let pointerXOnPointerDown = 0;
let windowHalfX = window.innerWidth / 2;

let firstLetter = true;
let loadToken = 0;
let loading = true;
let loadError: string | undefined;
let textMesh1: Mesh | undefined;
let textMesh2: Mesh | undefined;

const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 1500);
camera.position.set(0, 400, 700);
const cameraTarget = new Vector3(0, 150, 0);

const scene = new Scene();
scene.background = new Color(0x000000);
scene.fog = new Fog(0x000000, 250, 1400);

const dirLight = new DirectionalLight(0xffffff, 0.4);
dirLight.position.set(0, 0, 1).normalize();
scene.add(dirLight);

const pointLight = new PointLight(0xffffff, 4.5, 0, 0);
pointLight.color.setHSL(Math.random(), 1, 0.5);
pointLight.position.set(0, 100, 90);
scene.add(pointLight);

const materials = [
  new MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
  new MeshPhongMaterial({ color: 0xffffff }), // side
];

const group = new Group();
group.position.y = 100;
scene.add(group);

const plane = new Mesh(
  new PlaneGeometry(10000, 10000),
  new MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true }),
);
plane.position.y = 100;
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

function updateDataset(): void {
  canvas!.dataset.font = fontName;
  canvas!.dataset.weight = fontWeight;
  canvas!.dataset.text = text;
  canvas!.dataset.bevel = String(bevelEnabled);
  canvas!.dataset.rotation = String(group.rotation.y);
}

function refreshText(): void {
  if (textMesh1 !== undefined) group.remove(textMesh1);
  if (textMesh2 !== undefined) group.remove(textMesh2);
  textMesh1?.geometry.dispose();
  textMesh1 = undefined;
  textMesh2 = undefined;
  updateDataset();
  if (text === "" || font === undefined) return;
  const geometry = new TextGeometry(text, {
    font,
    size,
    depth,
    curveSegments,
    bevelThickness,
    bevelSize,
    bevelEnabled,
  });
  geometry.computeBoundingBox();
  const centerOffset = -0.5 * (geometry.boundingBox!.max.x - geometry.boundingBox!.min.x);
  textMesh1 = new Mesh(geometry, materials);
  textMesh1.position.x = centerOffset;
  textMesh1.position.y = hover;
  textMesh1.position.z = 0;
  textMesh1.rotation.x = 0;
  textMesh1.rotation.y = Math.PI * 2;
  group.add(textMesh1);
  if (!mirror) return;
  textMesh2 = new Mesh(geometry, materials);
  textMesh2.position.x = centerOffset;
  textMesh2.position.y = -hover;
  textMesh2.position.z = depth;
  textMesh2.rotation.x = Math.PI;
  textMesh2.rotation.y = Math.PI * 2;
  group.add(textMesh2);
}

function loadFont(): void {
  const token = ++loadToken;
  loading = true;
  loadError = undefined;
  canvas!.dataset.state = "loading";
  const url = fontURLs[fontName][fontWeight];
  new FontLoader()
    .loadAsync(url)
    .then((loaded) => {
      if (token !== loadToken) return;
      font = loaded;
      loading = false;
      refreshText();
    })
    .catch((cause: unknown) => {
      if (token !== loadToken) return;
      loading = false;
      loadError = cause instanceof Error ? cause.message : String(cause);
      canvas!.dataset.state = "error";
      canvas!.dataset.error = loadError;
      throw cause;
    });
}

function changeColor(): void {
  pointLight.color.setHSL(Math.random(), 1, 0.5);
}

function changeFont(): void {
  fontIndex++;
  fontName = fontNames[fontIndex % fontNames.length];
  loadFont();
}

function changeWeight(): void {
  fontWeight = fontWeight === "bold" ? "regular" : "bold";
  loadFont();
}

function changeBevel(): void {
  bevelEnabled = !bevelEnabled;
  refreshText();
}

function onDocumentKeyDown(event: KeyboardEvent): void {
  switch (event.key) {
    case "F1":
      event.preventDefault();
      changeColor();
      return;
    case "F2":
      event.preventDefault();
      changeFont();
      return;
    case "F3":
      event.preventDefault();
      changeWeight();
      return;
    case "F4":
      event.preventDefault();
      changeBevel();
      return;
  }
  const backspace = event.key === "Backspace";
  const printable = !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1;
  if (!backspace && !printable) return;
  if (firstLetter) {
    firstLetter = false;
    text = "";
  }
  if (backspace) {
    event.preventDefault();
    text = text.substring(0, text.length - 1);
  } else {
    text += event.key;
  }
  refreshText();
}

function onPointerDown(event: PointerEvent): void {
  if (event.isPrimary === false) return;
  pointerXOnPointerDown = event.clientX - windowHalfX;
  targetRotationOnPointerDown = targetRotation;
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(event: PointerEvent): void {
  if (event.isPrimary === false) return;
  pointerX = event.clientX - windowHalfX;
  targetRotation = targetRotationOnPointerDown + (pointerX - pointerXOnPointerDown) * 0.02;
}

function onPointerUp(event: PointerEvent): void {
  if (event.isPrimary === false) return;
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
}

function onWindowResize(): void {
  windowHalfX = window.innerWidth / 2;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  group.rotation.y += (targetRotation - group.rotation.y) * 0.05;
  camera.lookAt(cameraTarget);
  renderer.clear();
  renderer.render(scene, camera);
  if (loading || loadError !== undefined) return;
  canvas!.dataset.state = "rendered";
  canvas!.dataset.rotation = String(group.rotation.y);
}

function dispose(): void {
  loadToken++;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", onWindowResize);
  document.removeEventListener("keydown", onDocumentKeyDown);
  canvas!.removeEventListener("pointerdown", onPointerDown);
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
  textMesh1?.geometry.dispose();
  plane.geometry.dispose();
  (plane.material as MeshBasicMaterial).dispose();
  for (const material of materials) material.dispose();
  renderer.dispose();
}

canvas.style.touchAction = "none";
canvas.addEventListener("pointerdown", onPointerDown);
document.addEventListener("keydown", onDocumentKeyDown);
window.addEventListener("resize", onWindowResize);
window.addEventListener("pagehide", dispose, { once: true });

updateDataset();
loadFont();
renderer.setAnimationLoop(animate);
