import { SMAAPass } from "ek3d/addons/postprocessing/SMAAPass";
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
import { ColorSpace } from "ek3d/constants";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const params = {
  enabled: true,
  autoRotate: true,
};

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
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
texture.colorSpace = ColorSpace.SRGB;

const material2 = new MeshBasicMaterial({ map: texture });

const mesh2 = new Mesh(geometry, material2);
mesh2.position.x = 100;
scene.add(mesh2);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const smaaPass = new SMAAPass();
composer.addPass(smaaPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Page check hooks (instead of lil-gui): 1 toggles SMAA, 2 toggles rotation.

let frames = 0;
let publishedFrames = -1;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.smaa = String(smaaPass.enabled);
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  if (params.autoRotate === true) {
    for (let i = 0; i < scene.children.length; i++) {
      const child = scene.children[i];

      child.rotation.x += 0.005;
      child.rotation.y += 0.01;
    }
  }

  smaaPass.enabled = params.enabled;

  composer.render();
  publishState();
  frames++;
}

renderer.setAnimationLoop(animate);

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") params.enabled = !params.enabled;
  else if (event.code === "Digit2") params.autoRotate = !params.autoRotate;
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
    renderer.dispose();
  },
  { once: true },
);
