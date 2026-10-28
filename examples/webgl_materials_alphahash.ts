import { TAARenderPass } from "ek3d/addons/postprocessing/TAARenderPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { Stats } from "ek3d/addons/libs/Stats";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing alphahash example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let controls!: OrbitControls<PerspectiveCamera>;
let stats!: Stats;
let mesh!: InstancedMesh;
let material!: MeshStandardMaterial;

let composer!: EffectComposer;
let renderPass!: RenderPass;
let taaRenderPass!: TAARenderPass;

let needsUpdate = false;

const amount = parseInt(window.location.search.slice(1)) || 3;
const count = Math.pow(amount, 3);

const color = new Color();

const params = {
  alpha: 0.5,
  alphaHash: true,
  taa: true,
  sampleLevel: 2,
};

init();

function init(): void {
  camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(amount, amount, amount);
  camera.lookAt(0, 0, 0);

  scene = new Scene();

  const geometry = new IcosahedronGeometry(0.5, 3);

  material = new MeshStandardMaterial({
    color: 0xffffff,
    alphaHash: params.alphaHash,
    opacity: params.alpha,
  });

  mesh = new InstancedMesh(geometry, material, count);

  let i = 0;
  const offset = (amount - 1) / 2;

  const matrix = new Matrix4();

  for (let x = 0; x < amount; x++) {
    for (let y = 0; y < amount; y++) {
      for (let z = 0; z < amount; z++) {
        matrix.setPosition(offset - x, offset - y, offset - z);

        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, color.setHex(Math.random() * 0xffffff));

        i++;
      }
    }
  }

  scene.add(mesh);

  //

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshBasicMaterial: basicShader,
      MeshLambertMaterial: lambertShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  //

  const environment = new RoomEnvironment();
  const pmremGenerator = new PMREMGenerator(renderer);

  scene.environment = pmremGenerator.fromScene(environment, 0.04).texture;
  environment.dispose();

  //

  composer = new EffectComposer(renderer);

  renderPass = new RenderPass(scene, camera);
  renderPass.enabled = false;

  taaRenderPass = new TAARenderPass(scene, camera);

  const outputPass = new OutputPass();

  composer.addPass(renderPass);
  composer.addPass(taaRenderPass);
  composer.addPass(outputPass);

  //

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;

  controls.addEventListener("change", () => (needsUpdate = true));

  //

  const gui = new GUI();

  gui.add(params, "alpha", 0, 1).onChange(onMaterialUpdate);
  gui.add(params, "alphaHash").onChange(onMaterialUpdate);

  const taaFolder = gui.addFolder("Temporal Anti-Aliasing");

  taaFolder
    .add(params, "taa")
    .name("enabled")
    .onChange(() => {
      renderPass.enabled = !params.taa;
      taaRenderPass.enabled = params.taa;

      sampleLevelCtrl.enable(params.taa);

      needsUpdate = true;
    });

  const sampleLevelCtrl = taaFolder.add(params, "sampleLevel", 0, 6, 1).onChange(() => (needsUpdate = true));
  canvas.dataset.gui = String(gui.controllers.length);

  //

  stats = new Stats();
  document.body.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("resize", onWindowResize);
      controls.dispose();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      composer.dispose();
      stats.dom.remove();
    },
    { once: true },
  );
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  needsUpdate = true;
}

function onMaterialUpdate(): void {
  material.opacity = params.alpha;
  material.alphaHash = params.alphaHash;
  material.transparent = !params.alphaHash;
  material.depthWrite = params.alphaHash;

  material.needsUpdate = true;
  needsUpdate = true;
}

function animate(): void {
  render();

  stats.update();

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

function render(): void {
  if (needsUpdate) {
    taaRenderPass.accumulate = false;
    taaRenderPass.sampleLevel = 0;

    needsUpdate = false;
  } else {
    taaRenderPass.accumulate = true;
    taaRenderPass.sampleLevel = params.sampleLevel;
  }

  composer.render();
}
