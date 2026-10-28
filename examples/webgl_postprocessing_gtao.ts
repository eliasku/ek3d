import { GTAOPass } from "ek3d/addons/postprocessing/GTAOPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader, type GLTF } from "ek3d/addons/loaders/GLTFLoader";
import { DRACOLoader } from "ek3d/addons/loaders/DRACOLoader";
import { DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { Stats } from "ek3d/addons/libs/Stats";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Box3 } from "ek3d/math/Box3";
import { Color } from "ek3d/math/Color";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing gtao example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let composer!: EffectComposer;
let controls!: OrbitControls<PerspectiveCamera>;
let timer!: Timer;
let stats!: Stats;
let mixer: AnimationMixer | undefined;

init();

function init(): void {
  const dracoLoader = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
  const loader = new GLTFLoader().setDRACOLoader(dracoLoader).setPath("/examples/models/gltf/");

  timer = new Timer();
  timer.connect(document);

  stats = new Stats();
  document.body.appendChild(stats.dom);

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshPhysicalMaterial: physicalShader,
      MeshBasicMaterial: basicShader,
      PointsMaterial: pointsShader,
      LineBasicMaterial: basicShader,
      MeshNormalMaterial: normalShader,
      MeshLambertMaterial: lambertShader,
    },
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  const pmremGenerator = new PMREMGenerator(renderer);

  scene = new Scene();
  scene.background = new Color(0xbfe3dd);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
  camera.position.set(5, 2, 8);

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.target.set(0, 0.5, 0);
  controls.update();
  controls.enablePan = false;
  controls.enableDamping = true;

  const width = window.innerWidth;
  const height = window.innerHeight;

  composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const gtaoPass = new GTAOPass(scene, camera, width, height);
  gtaoPass.output = GTAOPass.OUTPUT.Denoise;
  composer.addPass(gtaoPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  loader.load(
    "LittlestTokyo.glb",
    (gltf: GLTF) => {
      const model = gltf.scene;
      model.position.set(1, 1, 0);
      model.scale.set(0.01, 0.01, 0.01);
      scene.add(model);

      mixer = new AnimationMixer(model);
      mixer.clipAction(gltf.animations[0]).play();

      const box = new Box3().setFromObject(scene);
      gtaoPass.setSceneClipBox(box);
    },
    undefined,
    (e: unknown) => console.error(e),
  );

  // Init gui
  const gui = new GUI();

  gui
    .add(gtaoPass, "output", {
      Default: GTAOPass.OUTPUT.Default,
      Diffuse: GTAOPass.OUTPUT.Diffuse,
      "AO Only": GTAOPass.OUTPUT.AO,
      "AO Only + Denoise": GTAOPass.OUTPUT.Denoise,
      Depth: GTAOPass.OUTPUT.Depth,
      Normal: GTAOPass.OUTPUT.Normal,
    })
    .onChange(function (value: unknown) {
      gtaoPass.output = value as number;
    });

  const aoParameters = {
    radius: 0.25,
    distanceExponent: 1.0,
    thickness: 1.0,
    scale: 1.0,
    samples: 16,
    distanceFallOff: 1.0,
    screenSpaceRadius: false,
  };
  const pdParameters = {
    lumaPhi: 10.0,
    depthPhi: 2.0,
    normalPhi: 3.0,
    radius: 4.0,
    radiusExponent: 1.0,
    rings: 2.0,
    samples: 16,
  };
  gtaoPass.updateGtaoMaterial(aoParameters);
  gtaoPass.updatePdMaterial(pdParameters);
  gui.add(gtaoPass, "blendIntensity").min(0).max(1).step(0.01);
  gui
    .add(aoParameters, "radius")
    .min(0.01)
    .max(1)
    .step(0.01)
    .onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
  gui
    .add(aoParameters, "distanceExponent")
    .min(1)
    .max(4)
    .step(0.01)
    .onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
  gui
    .add(aoParameters, "thickness")
    .min(0.01)
    .max(10)
    .step(0.01)
    .onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
  gui
    .add(aoParameters, "distanceFallOff")
    .min(0)
    .max(1)
    .step(0.01)
    .onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
  gui
    .add(aoParameters, "scale")
    .min(0.01)
    .max(2.0)
    .step(0.01)
    .onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
  gui
    .add(aoParameters, "samples")
    .min(2)
    .max(32)
    .step(1)
    .onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
  gui.add(aoParameters, "screenSpaceRadius").onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
  gui
    .add(pdParameters, "lumaPhi")
    .min(0)
    .max(20)
    .step(0.01)
    .onChange(() => gtaoPass.updatePdMaterial(pdParameters));
  gui
    .add(pdParameters, "depthPhi")
    .min(0.01)
    .max(20)
    .step(0.01)
    .onChange(() => gtaoPass.updatePdMaterial(pdParameters));
  gui
    .add(pdParameters, "normalPhi")
    .min(0.01)
    .max(20)
    .step(0.01)
    .onChange(() => gtaoPass.updatePdMaterial(pdParameters));
  gui
    .add(pdParameters, "radius")
    .min(0)
    .max(32)
    .step(1)
    .onChange(() => gtaoPass.updatePdMaterial(pdParameters));
  gui
    .add(pdParameters, "radiusExponent")
    .min(0.1)
    .max(4.0)
    .step(0.1)
    .onChange(() => gtaoPass.updatePdMaterial(pdParameters));
  gui
    .add(pdParameters, "rings")
    .min(1)
    .max(16)
    .step(0.125)
    .onChange(() => gtaoPass.updatePdMaterial(pdParameters));
  gui
    .add(pdParameters, "samples")
    .min(2)
    .max(32)
    .step(1)
    .onChange(() => gtaoPass.updatePdMaterial(pdParameters));
  canvas.dataset.gui = String(gui.controllers.length);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("resize", onWindowResize);
      timer.disconnect();
      stats.dom.remove();
      mixer?.stopAllAction();
      controls.dispose();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      composer.dispose();
    },
    { once: true },
  );
}

function onWindowResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);
}

function animate(): void {
  timer.update();

  const delta = timer.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  controls.update();

  stats.begin();
  composer.render();
  stats.end();

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
