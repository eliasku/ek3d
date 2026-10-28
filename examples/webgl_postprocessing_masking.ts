import { ClearMaskPass, MaskPass } from "ek3d/addons/postprocessing/MaskPass";
import { ClearPass } from "ek3d/addons/postprocessing/ClearPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { TexturePass } from "ek3d/addons/postprocessing/TexturePass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { Scene } from "ek3d/scenes/Scene";
import { TextureFilter, ColorSpace } from "ek3d/constants";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing masking example canvas");

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 10;

const scene1 = new Scene();
const scene2 = new Scene();

const box = new Mesh(new BoxGeometry(4, 4, 4), new MeshBasicMaterial());
scene1.add(box);

const torus = new Mesh(new TorusGeometry(3, 1, 16, 32), new MeshBasicMaterial());
scene2.add(torus);

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setClearColor(0xe0e0e0);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;

//

const clearPass = new ClearPass();

const clearMaskPass = new ClearMaskPass();

const maskPass1 = new MaskPass(scene1, camera);
const maskPass2 = new MaskPass(scene2, camera);

const loader = new TextureLoader();
const texture1 = await loader.loadAsync("/examples/textures/masking-layer1.png");
texture1.colorSpace = ColorSpace.SRGB;
texture1.minFilter = TextureFilter.Linear;
texture1.generateMipmaps = false;
const texture2 = await loader.loadAsync("/examples/textures/masking-layer2.png");
texture2.colorSpace = ColorSpace.SRGB;

const texturePass1 = new TexturePass(texture1);
const texturePass2 = new TexturePass(texture2);

const outputPass = new OutputPass();

const renderTarget = new WebGLRenderTarget(window.innerWidth, window.innerHeight, { stencilBuffer: true });

const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(clearPass);
composer.addPass(maskPass1);
composer.addPass(texturePass1);
composer.addPass(clearMaskPass);
composer.addPass(maskPass2);
composer.addPass(texturePass2);
composer.addPass(clearMaskPass);
composer.addPass(outputPass);

function publishState(): void {
  canvas!.dataset.state = "rendered";
  canvas!.dataset.masked = "true";
  canvas!.dataset.frames = String(frames);
}

let frames = 0;

function animate(): void {
  const time = performance.now() * 0.001 + 6000;

  box.position.x = Math.cos(time / 1.5) * 2;
  box.position.y = Math.sin(time) * 2;
  box.rotation.x = time;
  box.rotation.y = time / 2;

  torus.position.x = Math.cos(time) * 2;
  torus.position.y = Math.sin(time / 1.5) * 2;
  torus.rotation.x = time;
  torus.rotation.y = time / 2;

  renderer.clear();
  composer.render(time);
  frames++;
  publishState();
}

renderer.setAnimationLoop(animate);

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
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
