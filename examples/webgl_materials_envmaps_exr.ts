import { EXRLoader } from "ek3d/addons/loaders/EXRLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping, SRGBColorSpace } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import type { DataTexture } from "ek3d/textures/DataTexture";
import type { Texture } from "ek3d/textures/Texture";
import type { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { loadZlibDecoder } from "./fflate";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing EXR envmaps example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const params = {
  envMap: "EXR",
  roughness: 0.0,
  metalness: 0.0,
  exposure: 1.0,
  debug: false,
};

let camera: PerspectiveCamera;
let scene: Scene;
let renderer: WebGLRenderer;
let controls: OrbitControls<PerspectiveCamera>;
let stats: Stats;
let gui: GUI;

let torusMesh: Mesh;
let planeMesh: Mesh;

let pngCubeRenderTarget: WebGLCubeRenderTarget | null = null;
let exrCubeRenderTarget: WebGLCubeRenderTarget | null = null;
let pngBackground: Texture | null = null;
let exrBackground: DataTexture | null = null;
let exrTexture: DataTexture | null = null;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();
const resources: Array<{ dispose(): void }> = [dfgLUT, ...Object.values(ltcTextures)];

let pmremGenerator: PMREMGenerator;
let disposed = false;

init().catch(function (error: unknown) {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
});

async function init(): Promise<void> {
  camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 0, 120);

  scene = new Scene();

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: { MeshStandardMaterial: standardShader, MeshBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  renderer.toneMapping = ACESFilmicToneMapping;

  const torusGeometry = new TorusKnotGeometry(18, 8, 150, 20);
  const torusMaterial = new MeshStandardMaterial({
    metalness: params.metalness,
    roughness: params.roughness,
    envMapIntensity: 1.0,
  });

  torusMesh = new Mesh(torusGeometry, torusMaterial);
  scene.add(torusMesh);

  const planeGeometry = new PlaneGeometry(200, 200);
  const planeMaterial = new MeshBasicMaterial();

  planeMesh = new Mesh(planeGeometry, planeMaterial);
  planeMesh.position.y = -50;
  planeMesh.rotation.x = -Math.PI * 0.5;
  scene.add(planeMesh);

  resources.push(torusGeometry, torusMaterial, planeGeometry, planeMaterial);

  stats = new Stats();
  document.body.appendChild(stats.dom);

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.minDistance = 50;
  controls.maxDistance = 300;

  gui = new GUI();
  gui.add(params, "envMap", ["EXR", "PNG"]);
  gui.add(params, "roughness", 0, 1, 0.01);
  gui.add(params, "metalness", 0, 1, 0.01);
  gui.add(params, "exposure", 0, 2, 0.01);
  gui.add(params, "debug");
  gui.open();

  canvas.dataset.gui = String(gui.controllers.length);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      window.removeEventListener("resize", onWindowResize);
      renderer.setAnimationLoop(null);
      controls.dispose();
      gui.destroy();
      exrCubeRenderTarget?.dispose();
      pngCubeRenderTarget?.dispose();
      exrTexture?.dispose();
      pngBackground?.dispose();
      stats.dom.remove();
      pmremGenerator.dispose();
      for (const resource of resources) resource.dispose();
      renderer.dispose();
    },
    { once: true },
  );

  pmremGenerator = new PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // piz_compressed.exr: PIZ needs no zlib, but the shared runtime is injected for the page.
  const runtime = await loadZlibDecoder();
  if (disposed) return;
  const exrLoader = new EXRLoader().setZlibDecoder(runtime);

  const [exrLoaded, pngLoaded] = await Promise.all([
    exrLoader.loadAsync("/examples/textures/piz_compressed.exr").then((texture) => {
      if (disposed) texture.dispose();
      else exrTexture = texture;
      return texture;
    }),
    new TextureLoader().loadAsync("/examples/textures/equirectangular.png").then((texture) => {
      if (disposed) texture.dispose();
      else pngBackground = texture;
      return texture;
    }),
  ]);

  if (disposed) return;

  exrTexture = exrLoaded;

  exrTexture.mapping = EquirectangularReflectionMapping;
  exrCubeRenderTarget = pmremGenerator.fromEquirectangular(exrTexture);
  exrBackground = exrTexture;

  pngLoaded.mapping = EquirectangularReflectionMapping;
  pngLoaded.colorSpace = SRGBColorSpace;

  pngCubeRenderTarget = pmremGenerator.fromEquirectangular(pngLoaded);
  pngBackground = pngLoaded;

  pmremGenerator.dispose();

  canvas.dataset.exr = "loaded";
  canvas.dataset.png = "loaded";
  canvas.dataset.loaded = "true";
  canvas.dataset.frames = "0";

  render();
}

function onWindowResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

function animate(): void {
  stats.begin();

  if (!disposed) render();

  stats.end();
}

function render(): void {
  if (disposed) return;

  const material = torusMesh.material as MeshStandardMaterial;
  const planeMaterial = planeMesh.material as MeshBasicMaterial;

  material.roughness = params.roughness;
  material.metalness = params.metalness;

  let newEnvMap: Texture | null = material.envMap;
  let background: Texture | null = scene.background as Texture | null;

  switch (params.envMap) {
    case "EXR":
      newEnvMap = exrCubeRenderTarget ? exrCubeRenderTarget.texture : null;
      background = exrBackground;
      break;
    case "PNG":
      newEnvMap = pngCubeRenderTarget ? pngCubeRenderTarget.texture : null;
      background = pngBackground;
      break;
  }

  if (newEnvMap !== material.envMap) {
    material.envMap = newEnvMap;
    material.needsUpdate = true;

    planeMaterial.map = newEnvMap;
    planeMaterial.needsUpdate = true;
  }

  torusMesh.rotation.y += 0.005;
  planeMesh.visible = params.debug;

  scene.background = background;
  renderer.toneMappingExposure = params.exposure;

  renderer.render(scene, camera);

  canvas.dataset.envMap = params.envMap;
  if (canvas.dataset.loaded === "true" && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
