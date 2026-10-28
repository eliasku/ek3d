import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { RoundedBoxGeometry } from "ek3d/addons/geometries/RoundedBoxGeometry";
import { ToneMapping, TextureFilter, ColorSpace } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Color } from "ek3d/math/Color";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

/**
 * Minimal lottie-web surface the page uses. lottie-web is vendor runtime
 * (user decision): the page imports it from the upstream CDN URL, like upstream.
 */
interface LottieAnimation {
  container: HTMLElement;
  totalFrames: number;
  currentFrame: number;
  play(): void;
  pause(): void;
  goToAndStop(frame: number, isFrame: boolean): void;
  addEventListener(event: string, listener: () => void): void;
}

interface LottieLike {
  loadAnimation(config: {
    container: HTMLElement;
    animType: string;
    loop: boolean;
    autoplay: boolean;
    animationData: unknown;
    rendererSettings: { dpr: number };
  }): LottieAnimation;
}

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing lottie example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

let renderer!: WebGLRenderer;
let scene!: Scene;
let camera!: PerspectiveCamera;
let controls!: OrbitControls<PerspectiveCamera>;

const lottieUrl = "https://cdn.jsdelivr.net/npm/lottie-web@5.13.0/+esm";
let lottie: LottieLike | undefined;

init();

function init(): void {
  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
  camera.position.z = 2.5;

  scene = new Scene();
  scene.background = new Color(0x111111);

  renderer = new WebGLRenderer({
    canvas,
    preserveDrawingBuffer: true,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshBasicMaterial: basicShader,
      PointsMaterial: pointsShader,
      MeshLambertMaterial: lambertShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.toneMapping = ToneMapping.ACESFilmic;

  const environment = new RoomEnvironment();
  const pmremGenerator = new PMREMGenerator(renderer);

  scene.environment = pmremGenerator.fromScene(environment, 0.04).texture;
  environment.dispose();

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.autoRotate = true;

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("resize", onWindowResize);
      controls.dispose();
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
    { once: true },
  );

  // lottie: load the vendor runtime eagerly so it is ready before the JSON data callback runs;
  // a failed CDN load keeps the scene alive and reports through the loader error path.
  import(/* @vite-ignore: runtime-selected external URL, never a local file */ lottieUrl)
    .then((mod: { default: LottieLike }) => {
      lottie = mod.default;
    })
    .catch(function (e: unknown) {
      console.error(e);
    });

  const loader = new FileLoader();
  loader.setResponseType("json");
  loader.load(
    "/examples/textures/lottie/24017-lottie-logo-animation.json",
    function (data: unknown) {
      if (lottie === undefined) throw new Error("lottie runtime not loaded");

      const lottieData = data as { w: number; h: number };
      const container = document.createElement("div");
      const dpr = window.devicePixelRatio;
      container.style.width = lottieData.w * dpr + "px";
      container.style.height = lottieData.h * dpr + "px";
      document.body.appendChild(container);

      const animation = lottie.loadAnimation({
        container: container,
        animType: "canvas",
        loop: true,
        autoplay: true,
        animationData: data,
        rendererSettings: { dpr: dpr },
      });

      const texture = new CanvasTexture(animation.container as unknown as HTMLCanvasElement);
      texture.minFilter = TextureFilter.Nearest;
      texture.generateMipmaps = false;
      texture.colorSpace = ColorSpace.SRGB;

      animation.addEventListener("enterFrame", function () {
        texture.needsUpdate = true;
      });

      container.style.display = "none"; // must be done after loadAnimation() otherwise canvas has 0 dimensions

      setupControls(animation);

      const geometry = new RoundedBoxGeometry(1, 1, 1, 7, 0.1);
      const mesh = new Mesh(geometry, new MeshStandardMaterial({ roughness: 0, map: texture }));
      scene.add(mesh);
    },
    undefined,
    function (e: unknown) {
      console.error(e);
    },
  );
}

function setupControls(animation: LottieAnimation): void {
  // Lottie animation API
  // https://airbnb.io/lottie/#/web

  const scrubber = document.getElementById("scrubber") as HTMLInputElement;
  scrubber.max = String(animation.totalFrames);

  scrubber.addEventListener("pointerdown", function () {
    animation.pause();
  });

  scrubber.addEventListener("pointerup", function () {
    animation.play();
  });

  scrubber.addEventListener("input", function () {
    animation.goToAndStop(parseFloat(scrubber.value), true);
  });

  animation.addEventListener("enterFrame", function () {
    scrubber.value = String(animation.currentFrame);
  });
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

//

function animate(): void {
  controls.update();

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
