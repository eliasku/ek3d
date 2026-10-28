import { SSAARenderPass } from "ek3d/addons/postprocessing/SSAARenderPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Object3D } from "ek3d/core/Object3D";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { Color } from "ek3d/math/Color";
import { degToRad } from "ek3d/math/MathUtils";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Group } from "ek3d/objects/Group";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const params = {
  sampleLevel: 2,
  viewOffsetX: 0,
  autoRotate: true,
  perspective: true,
};

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const renderer = new WebGLRenderer({
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshNormalMaterial: normalShader, MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(window.innerWidth, window.innerHeight);

const width = window.innerWidth || 1;
const height = window.innerHeight || 1;
const aspect = width / height;

const cameraP = new PerspectiveCamera(65, aspect, 3, 10);
cameraP.position.z = 7;
cameraP.setViewOffset(width, height, params.viewOffsetX, 0, width, height);

const cameraO = new OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 3, 10);
cameraO.position.z = 7;

const fov = degToRad(cameraP.fov);
const hyperfocus = (cameraP.near + cameraP.far) / 2;
const orthoHeight = 2 * Math.tan(fov / 2) * hyperfocus;
cameraO.zoom = height / orthoHeight;

const scene = new Scene();

const group = new Group();
scene.add(group);

const light = new PointLight(0xefffef, 500);
light.position.z = 10;
light.position.y = -10;
light.position.x = -10;
scene.add(light);

const light2 = new PointLight(0xffefef, 500);
light2.position.z = 10;
light2.position.x = -10;
light2.position.y = 10;
scene.add(light2);

const light3 = new PointLight(0xefefff, 500);
light3.position.z = 10;
light3.position.x = 10;
light3.position.y = -10;
scene.add(light3);

const light4 = new AmbientLight(0xffffff, 0.2);
scene.add(light4);

const geometry = new SphereGeometry(3, 48, 24);
const material = new MeshStandardMaterial();
material.roughness = 0.5;
material.metalness = 0;

const mesh = new InstancedMesh(geometry, material, 120);
const dummy = new Object3D();
const color = new Color();

for (let i = 0; i < 120; i++) {
  dummy.position.x = Math.random() * 4 - 2;
  dummy.position.y = Math.random() * 4 - 2;
  dummy.position.z = Math.random() * 4 - 2;
  dummy.rotation.x = Math.random();
  dummy.rotation.y = Math.random();
  dummy.rotation.z = Math.random();

  dummy.scale.setScalar(Math.random() * 0.2 + 0.05);

  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);

  color.setHSL(Math.random(), 1.0, 0.3);
  mesh.setColorAt(i, color);
}

group.add(mesh);

const composer = new EffectComposer(renderer);
const ssaaRenderPassP = new SSAARenderPass(scene, cameraP);
composer.addPass(ssaaRenderPassP);
const ssaaRenderPassO = new SSAARenderPass(scene, cameraO);
composer.addPass(ssaaRenderPassO);
const outputPass = new OutputPass();
composer.addPass(outputPass);

let frames = 0;
let publishedFrames = -1;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.camera = params.perspective ? "perspective" : "orthographic";
  canvas.dataset.sampleLevel = String(ssaaRenderPassP.sampleLevel);
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  if (params.autoRotate) {
    for (let i = 0; i < scene.children.length; i++) {
      const child = scene.children[i];

      child.rotation.x += 0.005;
      child.rotation.y += 0.01;
    }
  }

  ssaaRenderPassP.sampleLevel = ssaaRenderPassO.sampleLevel = params.sampleLevel;
  ssaaRenderPassP.unbiased = ssaaRenderPassO.unbiased = true;
  ssaaRenderPassP.clearColor = ssaaRenderPassO.clearColor = 0x000000;
  ssaaRenderPassP.clearAlpha = ssaaRenderPassO.clearAlpha = 0;

  ssaaRenderPassP.enabled = params.perspective;
  ssaaRenderPassO.enabled = !params.perspective;

  cameraP.view!.offsetX = params.viewOffsetX;

  composer.render();
  publishState();
  frames++;
}

renderer.setAnimationLoop(animate);

// Page check hooks (instead of lil-gui): 1–5 set sample level, 6 toggles projection, 7 shifts view offset.

window.addEventListener("keydown", (event) => {
  const digit = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].indexOf(event.code);
  if (digit !== -1) {
    params.sampleLevel = digit;
  } else if (event.code === "Digit6") {
    params.perspective = !params.perspective;
  } else if (event.code === "Digit7") {
    params.viewOffsetX += 4;
  }
});

function onWindowResize(): void {
  const widthRes = window.innerWidth;
  const heightRes = window.innerHeight;
  const aspectRes = widthRes / heightRes;

  cameraP.aspect = aspectRes;
  cameraP.setViewOffset(widthRes, heightRes, params.viewOffsetX, 0, widthRes, heightRes);
  cameraP.updateProjectionMatrix();

  cameraO.left = -heightRes * aspectRes;
  cameraO.right = heightRes * aspectRes;
  cameraO.top = heightRes;
  cameraO.bottom = -heightRes;
  cameraO.updateProjectionMatrix();

  renderer.setSize(widthRes, heightRes);
  composer.setSize(widthRes, heightRes);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    composer.dispose();
    geometry.dispose();
    material.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
