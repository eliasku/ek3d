import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { GLTFLoader, type GLTF } from "ek3d/addons/loaders/GLTFLoader";
import type { MeshoptDecoderLike } from "ek3d/addons/loaders/GLTFLoader";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { ToneMapping } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Color } from "ek3d/math/Color";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import type { Group } from "ek3d/objects/Group";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing gltf compressed example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

let camera: PerspectiveCamera;
let scene: Scene;
let renderer: WebGLRenderer;

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

/** meshopt decoder is vendor runtime (user decision): asset copy of the upstream module. */

init();
render();

function init(): void {
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
      MeshLambertMaterial: lambertShader,
      LineBasicMaterial: basicShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ToneMapping.ACESFilmic;
  renderer.toneMappingExposure = 1;

  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.set(0, 100, 0);

  const environment = new RoomEnvironment();
  const pmremGenerator = new PMREMGenerator(renderer);

  scene = new Scene();
  scene.background = new Color(0xbbbbbb);
  scene.environment = pmremGenerator.fromScene(environment, 0.04).texture;
  environment.dispose();

  const grid = new GridHelper(500, 10, 0xffffff, 0xffffff);
  grid.material.opacity = 0.5;
  grid.material.depthWrite = false;
  grid.material.transparent = true;
  scene.add(grid);

  void loadModel();

  const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.addEventListener("change", render); // use if there is no animation loop
  controls.minDistance = 400;
  controls.maxDistance = 1000;
  controls.target.set(10, 90, -16);
  controls.update();

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("resize", onWindowResize);
      controls.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

async function loadModel(): Promise<void> {
  meshoptDecoder = await loadMeshoptDecoder();

  const ktx2Loader = new KTX2Loader().detectSupport(renderer);

  const loader = new GLTFLoader().setPath("/examples/models/gltf/");
  loader.setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(meshoptDecoder ?? null);
  loader.load("coffeemat.glb", function (gltf: GLTF) {
    // coffeemat.glb was produced from the source scene using gltfpack:
    // gltfpack -i coffeemat/scene.gltf -o coffeemat.glb -cc -tc
    // The resulting model uses EXT_meshopt_compression (for geometry) and KHR_texture_basisu (for texture compression using ETC1S/BasisLZ)

    (gltf.scene as Group).position.y = 8;

    scene.add(gltf.scene);

    render();
  });
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

//

function render(): void {
  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
