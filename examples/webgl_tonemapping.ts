import { ToneMapping, Mapping } from "ek3d/constants";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { DRACOLoader } from "ek3d/addons/loaders/DRACOLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import type { NumberController } from "ek3d/addons/libs/lil-gui/NumberController";
import tonemapping_pars_fragment from "ek3d/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl";
import { Scene } from "ek3d/scenes/Scene";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing tonemapping example canvas");
const canvas: HTMLCanvasElement = canvasSel;

let renderer!: WebGLRenderer;
let scene!: Scene;
let camera!: PerspectiveCamera;
let controls!: OrbitControls<PerspectiveCamera>;
let gui!: GUI;
let guiExposure: NumberController | null = null;

const params = {
  exposure: 1.0,
  toneMapping: "Neutral",
  blurriness: 0.3,
  intensity: 1.0,
};

const toneMappingOptions = {
  None: ToneMapping.No,
  Linear: ToneMapping.Linear,
  Reinhard: ToneMapping.Reinhard,
  Cineon: ToneMapping.Cineon,
  ACESFilmic: ToneMapping.ACESFilmic,
  AgX: ToneMapping.AgX,
  Neutral: ToneMapping.Neutral,
  Custom: ToneMapping.Custom,
};

init().catch(function (err: unknown) {
  console.error(err);
});

async function init(): Promise<void> {
  const dfgLUT = createDFGLUT();
  const ltcTextures = createLTCTextures();

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

  renderer.toneMapping = toneMappingOptions[params.toneMapping as keyof typeof toneMappingOptions];
  renderer.toneMappingExposure = params.exposure;

  // Set ToneMapping.Custom to Uncharted2
  // source: http://filmicworlds.com/blog/filmic-tonemapping-operators/

  tonemapping_pars_fragment.set(
    tonemapping_pars_fragment.get().replace(
      "vec3 CustomToneMapping( vec3 color ) { return color; }",
      `#define Uncharted2Helper( x ) max( ( ( x * ( 0.15 * x + 0.10 * 0.50 ) + 0.20 * 0.02 ) / ( x * ( 0.15 * x + 0.50 ) + 0.20 * 0.30 ) ) - 0.02 / 0.30, vec3( 0.0 ) )

					float toneMappingWhitePoint = 1.0;

					vec3 CustomToneMapping( vec3 color ) {
						color *= toneMappingExposure;
						return saturate( Uncharted2Helper( color ) / Uncharted2Helper( vec3( toneMappingWhitePoint ) ) );

					}`,
    ),
  );

  scene = new Scene();
  scene.backgroundBlurriness = params.blurriness;

  const light = new DirectionalLight(0xfff3ee, 3); // simulate sun
  light.position.set(1, 0.05, 0.7);
  scene.add(light);

  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 10);
  camera.position.set(-0.02, 0.03, 0.05);

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 0.03;
  controls.maxDistance = 0.2;
  controls.target.set(0, 0.03, 0);
  controls.update();

  const hdrLoader = new HDRLoader().setPath("/examples/textures/equirectangular/");

  const dracoLoader = new DRACOLoader();
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setPath("/examples/models/gltf/");

  const [texture, gltf] = await Promise.all([
    hdrLoader.loadAsync("venice_sunset_1k.hdr"),
    gltfLoader.loadAsync("venice_mask.glb"),
  ]);

  // environment

  texture.mapping = Mapping.EquirectangularReflection;

  scene.background = texture;
  scene.environment = texture;

  // model

  scene.add(gltf.scene);

  window.addEventListener("resize", onWindowResize);

  //

  gui = new GUI();
  const toneMappingFolder = gui.addFolder("Tone Mapping");

  toneMappingFolder
    .add(params, "toneMapping", Object.keys(toneMappingOptions) as unknown as string[])
    .name("type")
    .onChange(function () {
      updateGUI();

      renderer.toneMapping = toneMappingOptions[params.toneMapping as keyof typeof toneMappingOptions];
    });

  const exposureController = toneMappingFolder.add(params, "exposure", 0, 2);

  exposureController.onChange(function (value) {
    renderer.toneMappingExposure = value as number;
  });

  guiExposure = exposureController as NumberController;

  const backgroundFolder = gui.addFolder("Background");

  backgroundFolder.add(params, "blurriness", 0, 1).onChange(function (value) {
    scene.backgroundBlurriness = value as number;
  });

  backgroundFolder.add(params, "intensity", 0, 1).onChange(function (value) {
    scene.backgroundIntensity = value as number;
  });

  updateGUI();

  gui.open();
}

function updateGUI(): void {
  if (params.toneMapping === "None") {
    guiExposure?.hide();
  } else {
    guiExposure?.show();
  }
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  controls.update();

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.toneMapping = params.toneMapping;
}
