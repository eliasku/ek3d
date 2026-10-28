import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { DRACOLoader } from "ek3d/addons/loaders/DRACOLoader";
import { DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Timer } from "ek3d/core/Timer";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing gltf transmission example canvas");
const canvas: HTMLCanvasElement = canvasSel;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let controls!: OrbitControls<PerspectiveCamera>;
let timer!: Timer;
let mixer: AnimationMixer | undefined;

init();

function init(): void {
  timer = new Timer();
  timer.connect(document);

  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 20);
  camera.position.set(0, 0.4, 0.7);

  scene = new Scene();

  const dfgLUT = createDFGLUT();
  const ltcTextures = createLTCTextures();

  new UltraHDRLoader().setPath("/examples/textures/equirectangular/").load("royal_esplanade_2k.hdr.jpg", function (
    texture: DataTexture,
  ) {
    texture.mapping = EquirectangularReflectionMapping;

    scene.background = texture;
    scene.backgroundBlurriness = 0.35;

    scene.environment = texture;

    // model

    new GLTFLoader()
      .setPath("/examples/models/gltf/")
      .setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG))
      .load("IridescentDishWithOlives.glb", function (gltf) {
        mixer = new AnimationMixer(gltf.scene);
        mixer.clipAction(gltf.animations[0]).play();

        scene.add(gltf.scene);
      });
  } as never);

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshPhysicalMaterial: physicalShader,
      MeshBasicMaterial: basicShader,
      PointsMaterial: pointsShader,
      MeshLambertMaterial: lambertShader,
      MeshPhongMaterial: phongShader,
      LineBasicMaterial: basicShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.autoRotate = true;
  controls.autoRotateSpeed = -0.75;
  controls.enableDamping = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 1;
  controls.target.set(0, 0.1, 0);
  controls.update();

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("resize", onWindowResize);
      timer.disconnect();
      mixer?.stopAllAction();
      controls.dispose();
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
    { once: true },
  );
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

//

function animate(): void {
  timer.update();

  if (mixer) mixer.update(timer.getDelta());

  controls.update();

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
