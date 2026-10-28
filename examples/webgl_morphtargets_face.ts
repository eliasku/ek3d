import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader, type GLTF } from "ek3d/addons/loaders/GLTFLoader";
import type { MeshoptDecoderLike } from "ek3d/addons/loaders/GLTFLoader";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { Stats } from "ek3d/addons/libs/Stats";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Timer } from "ek3d/core/Timer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Color } from "ek3d/math/Color";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
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
import { ToneMapping } from "ek3d/constants";
import type { Mesh } from "ek3d/objects/Mesh";
import { Scene } from "ek3d/scenes/Scene";

/**
 * meshopt decoder is vendor runtime (user decision): loaded from the packaged
 * asset copy of the upstream module (see init() for the dynamic import), then
 * injected into the glTF loader.
 */
const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing morphtargets face example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

let camera: PerspectiveCamera;
let scene: Scene;
let renderer: WebGLRenderer;
let stats: Stats;
let mixer: AnimationMixer | undefined;
let timer: Timer;
let controls: OrbitControls<PerspectiveCamera>;

let head: Mesh | undefined;

let meshoptDecoder: MeshoptDecoderLike | undefined;

/** meshopt decoder is vendor runtime (user decision): fetched from the packaged asset
 * (public dir, untransformed) and imported through a Blob URL at runtime. */
async function loadMeshoptDecoder(): Promise<MeshoptDecoderLike> {
  const source = (await new FileLoader()
    .setPath("/examples/libs/")
    .setResponseType("text")
    .loadAsync("meshopt_decoder.module.js")) as unknown as string;
  const mod = (await import(URL.createObjectURL(new Blob([source], { type: "text/javascript" })))) as {
    MeshoptDecoder: MeshoptDecoderLike;
  };
  return mod.MeshoptDecoder;
}

void init();

async function init(): Promise<void> {
  timer = new Timer();
  timer.connect(document);

  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 20);
  camera.position.set(-1.8, 0.8, 3);

  scene = new Scene();

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
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ToneMapping.ACESFilmic;

  const ktx2Loader = new KTX2Loader().detectSupport(renderer);

  meshoptDecoder = await loadMeshoptDecoder();

  new GLTFLoader()
    .setKTX2Loader(ktx2Loader)
    .setMeshoptDecoder(meshoptDecoder ?? null)
    .load("/examples/models/gltf/facecap.glb", function (gltf: GLTF) {
      const mesh = gltf.scene.children[0] as Mesh;

      scene.add(mesh);

      mixer = new AnimationMixer(mesh);

      mixer.clipAction(gltf.animations[0]).play();

      // GUI

      head = mesh.getObjectByName("mesh_2") as Mesh | undefined;
      if (head === undefined) throw new Error("mesh_2 not found in facecap.glb");

      const influences = head.morphTargetInfluences!;

      const gui = new GUI();
      gui.close();

      for (const [key, value] of Object.entries(head.morphTargetDictionary as Record<string, number>)) {
        gui
          .add(influences as unknown as Record<string, number>, String(value), 0, 1, 0.01)
          .name(key.replace("blendShape1.", ""))
          .listen();
      }
      canvas.dataset.guiControllers = String(gui.controllers.length);
    });

  const environment = new RoomEnvironment();
  const pmremGenerator = new PMREMGenerator(renderer);

  scene.background = new Color(0x666666);
  scene.environment = pmremGenerator.fromScene(environment, 0.04).texture;
  environment.dispose();

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 2.5;
  controls.maxDistance = 5;
  controls.minAzimuthAngle = -Math.PI / 2;
  controls.maxAzimuthAngle = Math.PI / 2;
  controls.maxPolarAngle = Math.PI / 1.8;
  controls.target.set(0, 0.15, -0.2);

  stats = new Stats();
  document.body.appendChild(stats.dom);

  renderer.setAnimationLoop(animate);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("resize", onWindowResize);
      controls.dispose();
      timer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      stats.dom.remove();
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

  if (mixer) {
    mixer.update(timer.getDelta());
  }

  controls.update(); // required if damping enabled

  renderer.render(scene, camera);

  stats.update();

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
  if (head !== undefined) {
    canvas.dataset.morphs = String(head.morphTargetInfluences!.length);
    canvas.dataset.morphDict = String(Object.keys(head.morphTargetDictionary ?? {}).length);
  }
}
