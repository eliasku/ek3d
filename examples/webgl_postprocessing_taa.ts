import { TAARenderPass } from "ek3d/addons/postprocessing/TAARenderPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { Scene } from "ek3d/scenes/Scene";
import { TextureFilter, ColorSpace } from "ek3d/constants";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 300;

const scene = new Scene();

const geometry = new BoxGeometry(120, 120, 120);
const material1 = new MeshBasicMaterial({ color: 0xffffff, wireframe: true });

const mesh1 = new Mesh(geometry, material1);
mesh1.position.x = -100;
scene.add(mesh1);

const texture = await new TextureLoader().loadAsync("/examples/textures/brick_diffuse.jpg");
texture.minFilter = TextureFilter.Nearest;
texture.magFilter = TextureFilter.Nearest;
texture.anisotropy = 1;
texture.generateMipmaps = false;
texture.colorSpace = ColorSpace.SRGB;

const material2 = new MeshBasicMaterial({ map: texture });

const mesh2 = new Mesh(geometry, material2);
mesh2.position.x = 100;
scene.add(mesh2);

const composer = new EffectComposer(renderer);

const taaRenderPass = new TAARenderPass(scene, camera);
taaRenderPass.unbiased = false;
composer.addPass(taaRenderPass);

const renderPass = new RenderPass(scene, camera);
renderPass.enabled = false;
composer.addPass(renderPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Page check hooks (instead of lil-gui): keys 1–5 set the TAA sample level.

let index = 0;
let frames = 0;
let publishedFrames = -1;
let rotate = true;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.sampleLevel = String(taaRenderPass.sampleLevel);
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  index++;
  frames++;

  if (rotate || Math.round(index / 200) % 2 === 0) {
    for (let i = 0; i < scene.children.length; i++) {
      const child = scene.children[i];

      child.rotation.x += 0.005;
      child.rotation.y += 0.01;
    }

    taaRenderPass.accumulate = false;
  } else {
    taaRenderPass.accumulate = true;
  }

  composer.render();
  publishState();
}

renderer.setAnimationLoop(animate);

window.addEventListener("keydown", (event) => {
  const digit = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].indexOf(event.code);
  if (digit !== -1) {
    taaRenderPass.sampleLevel = digit;
    rotate = false;
    index = 200; // jump into the accumulate phase
  } else if (event.code === "Digit6") {
    rotate = !rotate;
  }
});

function onWindowResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    composer.dispose();
    geometry.dispose();
    material1.dispose();
    material2.dispose();
    texture.dispose();
    renderer.dispose();
  },
  { once: true },
);
