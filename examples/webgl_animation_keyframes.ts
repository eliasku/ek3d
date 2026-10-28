import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { Sky } from "ek3d/addons/objects/Sky";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { DRACOLoader } from "ek3d/addons/loaders/DRACOLoader";
import { DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { ACESFilmicToneMapping } from "ek3d/constants";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import tonemapping_fragment from "ek3d/renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import colorspace_fragment from "ek3d/renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import { Vector3 } from "ek3d/math/Vector3";
import { Timer } from "ek3d/core/Timer";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing animation keyframes example canvas");
const canvas: HTMLCanvasElement = canvasSel;

let mixer: AnimationMixer | undefined;

const timer = new Timer();
timer.connect(document);

const stats = new Stats();
document.body.appendChild(stats.dom);

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const chunks = getShaderChunks();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaderChunks: chunks,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshBasicMaterial: basicShader,
    PointsMaterial: pointsShader,
    MeshLambertMaterial: lambertShader,
    MeshPhongMaterial: phongShader,
    LineBasicMaterial: basicShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;

const scene = new Scene();

// Sky

const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

const uniforms = sky.material.uniforms;
uniforms["turbidity"].value = 0;
uniforms["rayleigh"].value = 3;
uniforms["mieDirectionalG"].value = 0.7;
uniforms["cloudElevation"].value = 1;
(uniforms["sunPosition"].value as Vector3).set(-0.8, 0.19, 0.56); // elevation: 11, azimuth: -55

const pmremGenerator = new PMREMGenerator(renderer);
const environment = pmremGenerator.fromScene(sky).texture;
scene.environment = environment;

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
camera.position.set(5, 2, 8);

const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0.7, 0);
controls.update();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(DRACO_GLTF_CONFIG);

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load(
  "/examples/models/gltf/LittlestTokyo.glb",
  function (gltf) {
    const model = gltf.scene;
    model.position.set(1, 1, 0);
    model.scale.set(0.01, 0.01, 0.01);
    scene.add(model);

    mixer = new AnimationMixer(model);
    mixer.clipAction(gltf.animations[0]).play();

    renderer.setAnimationLoop(animate);
  },
  undefined,
  function (e: unknown) {
    console.error(e);
  },
);

window.onresize = function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
};

function animate(): void {
  timer.update();

  const delta = timer.getDelta();

  mixer?.update(delta);

  controls.update();

  stats.update();

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

/** Shader chunk registry covering the two includes the Sky shader embeds. */
function getShaderChunks(): Record<string, string> {
  return { tonemapping_fragment, colorspace_fragment };
}

window.addEventListener(
  "pagehide",
  () => {
    timer.disconnect();
    stats.dom.remove();
    mixer?.stopAllAction();
    controls.dispose();
    dracoLoader.dispose();
    renderer.setAnimationLoop(null);
    pmremGenerator.dispose();
    sky.geometry.dispose();
    renderer.dispose();
  },
  { once: true },
);
