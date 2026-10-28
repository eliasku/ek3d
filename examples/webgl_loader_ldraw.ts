import { LDrawLoader } from "ek3d/addons/loaders/LDrawLoader";
import { LDrawConditionalLineMaterial } from "ek3d/addons/materials/LDrawConditionalLineMaterial";
import { LDrawUtils } from "ek3d/addons/utils/LDrawUtils";
import common from "ek3d/renderers/shaders/ShaderChunk/common.glsl";
import color_pars_vertex from "ek3d/renderers/shaders/ShaderChunk/color_pars_vertex.glsl";
import color_vertex from "ek3d/renderers/shaders/ShaderChunk/color_vertex.glsl";
import fog_pars_vertex from "ek3d/renderers/shaders/ShaderChunk/fog_pars_vertex.glsl";
import fog_pars_fragment from "ek3d/renderers/shaders/ShaderChunk/fog_pars_fragment.glsl";
import fog_vertex from "ek3d/renderers/shaders/ShaderChunk/fog_vertex.glsl";
import logdepthbuf_pars_vertex from "ek3d/renderers/shaders/ShaderChunk/logdepthbuf_pars_vertex.glsl";
import logdepthbuf_pars_fragment from "ek3d/renderers/shaders/ShaderChunk/logdepthbuf_pars_fragment.glsl";
import logdepthbuf_vertex from "ek3d/renderers/shaders/ShaderChunk/logdepthbuf_vertex.glsl";
import logdepthbuf_fragment from "ek3d/renderers/shaders/ShaderChunk/logdepthbuf_fragment.glsl";
import clipping_planes_pars_vertex from "ek3d/renderers/shaders/ShaderChunk/clipping_planes_pars_vertex.glsl";
import clipping_planes_vertex from "ek3d/renderers/shaders/ShaderChunk/clipping_planes_vertex.glsl";
import clipping_planes_pars_fragment from "ek3d/renderers/shaders/ShaderChunk/clipping_planes_pars_fragment.glsl";
import clipping_planes_fragment from "ek3d/renderers/shaders/ShaderChunk/clipping_planes_fragment.glsl";
import color_pars_fragment from "ek3d/renderers/shaders/ShaderChunk/color_pars_fragment.glsl";
import color_fragment from "ek3d/renderers/shaders/ShaderChunk/color_fragment.glsl";
import tonemapping_fragment from "ek3d/renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import colorspace_fragment from "ek3d/renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import fog_fragment from "ek3d/renderers/shaders/ShaderChunk/fog_fragment.glsl";
import premultiplied_alpha_fragment from "ek3d/renderers/shaders/ShaderChunk/premultiplied_alpha_fragment.glsl";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { ToneMapping, TextureType } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Box3 } from "ek3d/math/Box3";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import type { Group } from "ek3d/objects/Group";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLOutput } from "ek3d/renderers/webgl/WebGLOutput";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing ldraw example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

/** Shader chunks required by LDrawConditionalLineMaterial's includes. */
const chunks: Record<string, string> = {
  common,
  color_pars_vertex,
  color_vertex,
  fog_pars_vertex,
  fog_pars_fragment,
  fog_vertex,
  fog_fragment,
  logdepthbuf_pars_vertex,
  logdepthbuf_pars_fragment,
  logdepthbuf_vertex,
  logdepthbuf_fragment,
  clipping_planes_pars_vertex,
  clipping_planes_vertex,
  clipping_planes_pars_fragment,
  clipping_planes_fragment,
  color_pars_fragment,
  color_fragment,
  tonemapping_fragment,
  colorspace_fragment,
  premultiplied_alpha_fragment,
};

const modelFileList: Record<string, string> = {
  Car: "models/car.ldr_Packed.mpd",
  "Lunar Vehicle": "models/1621-1-LunarMPVVehicle.mpd_Packed.mpd",
  "Radar Truck": "models/889-1-RadarTruck.mpd_Packed.mpd",
  Trailer: "models/4838-1-MiniVehicles.mpd_Packed.mpd",
  Bulldozer: "models/4915-1-MiniConstruction.mpd_Packed.mpd",
  Helicopter: "models/4918-1-MiniFlyers.mpd_Packed.mpd",
  Plane: "models/5935-1-IslandHopper.mpd_Packed.mpd",
  Lighthouse: "models/30023-1-Lighthouse.ldr_Packed.mpd",
  "X-Wing mini": "models/30051-1-X-wingFighter-Mini.mpd_Packed.mpd",
  "AT-ST mini": "models/30054-1-AT-ST-Mini.mpd_Packed.mpd",
  "AT-AT mini": "models/4489-1-AT-AT-Mini.mpd_Packed.mpd",
  Shuttle: "models/4494-1-Imperial Shuttle-Mini.mpd_Packed.mpd",
  "TIE Interceptor": "models/6965-1-TIEIntercep_4h4MXk5.mpd_Packed.mpd",
  "Star fighter": "models/6966-1-JediStarfighter-Mini.mpd_Packed.mpd",
  "X-Wing": "models/7140-1-X-wingFighter.mpd_Packed.mpd",
  "AT-ST": "models/10174-1-ImperialAT-ST-UCS.mpd_Packed.mpd",
  Window: "models/6156-1-WindowBrick.mpd_Packed.mpd",
};

let camera: PerspectiveCamera;
let scene: Scene;
let renderer: WebGLRenderer;
let controls: OrbitControls<PerspectiveCamera>;
let model: Group | undefined;
let gui: GUI | undefined;

const guiData = {
  modelFileName: modelFileList["Car"]!,
  displayLines: true,
  conditionalLines: true,
  smoothNormals: true,
  buildingStep: 0,
  noBuildingSteps: "No steps.",
  flatColors: false,
  mergeModel: false,
};

// progress bar

const progressBarDiv = document.createElement("div");
progressBarDiv.innerText = "Loading...";
progressBarDiv.style.fontSize = "3em";
progressBarDiv.style.color = "#888";
progressBarDiv.style.display = "block";
progressBarDiv.style.position = "absolute";
progressBarDiv.style.top = "50%";
progressBarDiv.style.width = "100%";
progressBarDiv.style.textAlign = "center";

init();

function init(): void {
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    outputBufferType: TextureType.HalfFloat,
    createOutput: WebGLOutput,
    preserveDrawingBuffer: true,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaderChunks: chunks,
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
  renderer.setAnimationLoop(animate);

  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.set(150, 200, 250);

  const pmremGenerator = new PMREMGenerator(renderer);

  scene = new Scene();
  scene.background = new Color(0xdeebed);
  const environment = new RoomEnvironment();
  scene.environment = pmremGenerator.fromScene(environment, 0.04).texture;
  environment.dispose();

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.enableDamping = true;

  window.addEventListener("resize", onWindowResize);

  showProgressBar();

  // load materials and then the model

  reloadObject(true);
}

function updateObjectsVisibility(): void {
  model!.traverse((c) => {
    const holder = c as unknown as {
      isLineSegments?: boolean;
      isConditionalLine?: boolean;
      isGroup?: boolean;
      visible: boolean;
      userData: { buildingStep?: number };
    };

    if (holder.isLineSegments) {
      if (holder.isConditionalLine) {
        holder.visible = guiData.conditionalLines;
      } else {
        holder.visible = guiData.displayLines;
      }
    } else if (holder.isGroup) {
      // Hide objects with building step > gui setting
      holder.visible = (holder.userData.buildingStep ?? 0) <= guiData.buildingStep;
    }
  });
}

function reloadObject(resetCamera: boolean): void {
  if (model) {
    scene.remove(model);
  }

  model = undefined;

  updateProgressBar(0);
  showProgressBar();

  // only smooth when not rendering with flat colors to improve processing time
  const lDrawLoader = new LDrawLoader();
  lDrawLoader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  lDrawLoader.smoothNormals = guiData.smoothNormals && !guiData.flatColors;

  lDrawLoader.setPath("/examples/models/ldraw/officialLibrary/").load(
    guiData.modelFileName,
    function (group2: Group) {
      if (model) {
        scene.remove(model);
      }

      model = group2;

      // demonstrate how to use convert to flat colors to better mimic the lego instructions look
      if (guiData.flatColors) {
        function convertMaterial(input: unknown): MeshBasicMaterial {
          const source = input as {
            color: import("ek3d/math/Color").Color;
            polygonOffset: boolean;
            polygonOffsetUnits: number;
            polygonOffsetFactor: number;
            opacity: number;
            transparent: boolean;
            depthWrite: boolean;
          };

          const newMaterial = new MeshBasicMaterial();
          newMaterial.color.copy(source.color);
          newMaterial.polygonOffset = source.polygonOffset;
          newMaterial.polygonOffsetUnits = source.polygonOffsetUnits;
          newMaterial.polygonOffsetFactor = source.polygonOffsetFactor;
          newMaterial.opacity = source.opacity;
          newMaterial.transparent = source.transparent;
          newMaterial.depthWrite = source.depthWrite;
          newMaterial.toneMapped = false;

          return newMaterial;
        }

        model.traverse((c) => {
          const holder = c as unknown as { isMesh?: boolean; material?: unknown };
          if (holder.isMesh) {
            if (Array.isArray(holder.material)) {
              holder.material = (holder.material as unknown[]).map(convertMaterial);
            } else {
              holder.material = convertMaterial(holder.material);
            }
          }
        });
      }

      // Merge model geometries by material
      if (guiData.mergeModel) model = LDrawUtils.mergeObject(model);

      // Convert from LDraw coordinates: rotate 180 degrees around OX
      model.rotation.x = Math.PI;

      scene.add(model);

      (guiData as { buildingStep: number }).buildingStep =
        ((model.userData as { numBuildingSteps: number }).numBuildingSteps ?? 1) - 1;

      updateObjectsVisibility();

      // Adjust camera and light

      const bbox = new Box3().setFromObject(model);
      const size = bbox.getSize(new Vector3());
      const radius = Math.max(size.x, Math.max(size.y, size.z)) * 0.5;

      if (resetCamera) {
        controls.target0.copy(bbox.getCenter(new Vector3()));
        controls.position0.set(-2.3, 1, 2).multiplyScalar(radius).add(controls.target0);
        controls.reset();
      }

      createGUI();

      hideProgressBar();
    },
    onProgress,
    onError,
  );
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createGUI(): void {
  if (gui) {
    gui.destroy();
  }

  gui = new GUI();

  gui
    .add(guiData as unknown as Record<string, string>, "modelFileName", modelFileList)
    .name("Model")
    .onFinishChange(function () {
      reloadObject(true);
    });

  gui
    .add(guiData as unknown as Record<string, boolean>, "flatColors")
    .name("Flat Colors")
    .onChange(function () {
      reloadObject(false);
    });

  gui
    .add(guiData as unknown as Record<string, boolean>, "mergeModel")
    .name("Merge model")
    .onChange(function () {
      reloadObject(false);
    });

  const numBuildingSteps = (model!.userData as { numBuildingSteps?: number }).numBuildingSteps ?? 1;

  if (numBuildingSteps > 1) {
    gui
      .add(guiData as unknown as Record<string, number>, "buildingStep", 0, numBuildingSteps - 1)
      .step(1)
      .name("Building step")
      .onChange(updateObjectsVisibility);
  } else {
    gui
      .add(guiData as unknown as Record<string, string>, "noBuildingSteps")
      .name("Building step")
      .onChange(updateObjectsVisibility);
  }

  gui
    .add(guiData as unknown as Record<string, boolean>, "smoothNormals")
    .name("Smooth Normals")
    .onChange(function changeNormals() {
      reloadObject(false);
    });

  gui
    .add(guiData as unknown as Record<string, boolean>, "displayLines")
    .name("Display Lines")
    .onChange(updateObjectsVisibility);
  gui
    .add(guiData as unknown as Record<string, boolean>, "conditionalLines")
    .name("Conditional Lines")
    .onChange(updateObjectsVisibility);
}

//

function animate(): void {
  controls.update();
  render();

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
  if (model)
    canvas.dataset.buildingSteps = String((model.userData as { numBuildingSteps?: number }).numBuildingSteps ?? 0);
}

function render(): void {
  renderer.render(scene, camera);
}

function onProgress(xhr: ProgressEvent): void {
  if (xhr.lengthComputable) {
    updateProgressBar(xhr.loaded / xhr.total);

    console.log(Math.round((xhr.loaded / xhr.total) * 100) + "% downloaded");
  }
}

function onError(error: unknown): void {
  const message = "Error loading model";
  progressBarDiv.innerText = message;

  console.log(message);

  console.error(error);
}

function showProgressBar(): void {
  document.body.appendChild(progressBarDiv);
}

function hideProgressBar(): void {
  document.body.removeChild(progressBarDiv);
}

function updateProgressBar(fraction: number): void {
  progressBarDiv.innerText = "Loading... " + Math.round(fraction * 100) + "%";
}
