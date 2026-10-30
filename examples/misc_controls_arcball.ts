import { ArcballControls } from "ek3d/addons/controls/ArcballControls";
import { OBJLoader } from "ek3d/addons/loaders/OBJLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { Mapping, ColorSpace, Wrapping, ToneMapping } from "ek3d/constants";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { DEG2RAD } from "ek3d/math/MathUtils";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Scene } from "ek3d/scenes/Scene";

const perspectiveDistance = 2.5;
const orthographicDistance = 120;

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing arcball controls example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const cameras = ["Orthographic", "Perspective"];

let camera: PerspectiveCamera | OrthographicCamera;
let controls: ArcballControls<PerspectiveCamera | OrthographicCamera>;
let scene: Scene;
let renderer: WebGLRenderer;

let gui: GUI;
let folderOptions: GUI;
let folderAnimations: GUI;

const cameraType = { type: "Perspective" };

const arcballGui = {
  gizmoVisible: true,

  setArcballControls: function () {
    controls = new ArcballControls(camera, canvas, scene);
    controls.addEventListener("change", render);

    this.gizmoVisible = true;

    this.populateGui();
  },

  populateGui: function () {
    if (folderOptions === undefined || folderAnimations === undefined) return;

    folderOptions.add(controls, "enabled").name("Enable controls");
    folderOptions.add(controls, "enableFocus").name("Enable focus");
    folderOptions.add(controls, "enableGrid").name("Enable Grid");
    folderOptions.add(controls, "enableRotate").name("Enable rotate");
    folderOptions.add(controls, "enablePan").name("Enable pan");
    folderOptions.add(controls, "enableZoom").name("Enable zoom");
    folderOptions.add(controls, "cursorZoom").name("Cursor zoom");
    folderOptions.add(controls, "adjustNearFar").name("adjust near/far");
    folderOptions.add(controls, "scaleFactor", 1.1, 10, 0.1).name("Scale factor");
    folderOptions.add(controls, "minDistance", 0, 50, 0.5).name("Min distance");
    folderOptions.add(controls, "maxDistance", 0, 50, 0.5).name("Max distance");
    folderOptions.add(controls, "minZoom", 0, 50, 0.5).name("Min zoom");
    folderOptions.add(controls, "maxZoom", 0, 50, 0.5).name("Max zoom");
    folderOptions
      .add(arcballGui, "gizmoVisible")
      .name("Show gizmos")
      .onChange(function () {
        controls.setGizmosVisible(arcballGui.gizmoVisible);
      });
    folderOptions.add(controls, "copyState").name("Copy state(ctrl+c)");
    folderOptions.add(controls, "pasteState").name("Paste state(ctrl+v)");
    folderOptions.add(controls, "reset").name("Reset");
    folderAnimations.add(controls, "enableAnimations").name("Enable anim.");
    folderAnimations.add(controls, "dampingFactor", 0, 100, 1).name("Damping");
    folderAnimations.add(controls, "wMax", 0, 100, 1).name("Angular spd");
  },
};

const resources: Array<{ dispose(): void }> = [];

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();
resources.push(dfgLUT, ...Object.values(ltcTextures));

renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  alpha: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: { MeshStandardMaterial: standardShader, LineBasicMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ToneMapping.Reinhard;
renderer.toneMappingExposure = 3;
(canvas as HTMLCanvasElement).style.background =
  "linear-gradient( 180deg, rgba( 0,0,0,1 ) 0%, rgba( 128,128,255,1 ) 100% )";

scene = new Scene();

camera = makePerspectiveCamera();
camera.position.set(0, 0, perspectiveDistance);

const material = new MeshStandardMaterial();

new OBJLoader().setPath("/examples/models/obj/cerberus/").load("Cerberus.obj", function (group: Group) {
  const textureLoader = new TextureLoader().setPath("/examples/models/obj/cerberus/");

  material.roughness = 1;
  material.metalness = 1;

  const diffuseMap = textureLoader.load("Cerberus_A.jpg", render);
  diffuseMap.colorSpace = ColorSpace.SRGB;
  material.map = diffuseMap;

  material.metalnessMap = material.roughnessMap = textureLoader.load("Cerberus_RM.jpg", render);
  material.normalMap = textureLoader.load("Cerberus_N.jpg", render);

  material.map!.wrapS = Wrapping.Repeat;
  material.roughnessMap!.wrapS = Wrapping.Repeat;
  material.metalnessMap!.wrapS = Wrapping.Repeat;
  material.normalMap!.wrapS = Wrapping.Repeat;

  group.traverse(function (child) {
    if (child instanceof Mesh) {
      child.material = material;
    }
  });

  group.rotation.y = Math.PI / 2;
  group.position.x += 0.25;
  scene.add(group);
  render();

  new HDRLoader().setPath("/examples/textures/equirectangular/").load("venice_sunset_1k.hdr", function (hdrEquirect) {
    hdrEquirect.mapping = Mapping.EquirectangularReflection;

    scene.environment = hdrEquirect;

    render();
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onWindowResize);

  //

  gui = new GUI();
  gui
    .add(cameraType, "type", cameras)
    .name("Choose Camera")
    .onChange(function () {
      setCamera(cameraType.type as "Orthographic" | "Perspective");
    });

  folderOptions = gui.addFolder("Arcball parameters");
  folderAnimations = folderOptions.addFolder("Animations");

  arcballGui.setArcballControls();

  render();
});

function makeOrthographicCamera(): OrthographicCamera {
  const halfFovV = DEG2RAD * 45 * 0.5;
  const halfFovH = Math.atan((window.innerWidth / window.innerHeight) * Math.tan(halfFovV));

  const halfW = perspectiveDistance * Math.tan(halfFovH);
  const halfH = perspectiveDistance * Math.tan(halfFovV);
  const near = 0.01;
  const far = 2000;
  return new OrthographicCamera(-halfW, halfW, halfH, -halfH, near, far);
}

function makePerspectiveCamera(): PerspectiveCamera {
  const fov = 45;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.01;
  const far = 2000;
  return new PerspectiveCamera(fov, aspect, near, far);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "c") {
    if (event.ctrlKey || event.metaKey) {
      controls.copyState();
    }
  } else if (event.key === "v") {
    if (event.ctrlKey || event.metaKey) {
      controls.pasteState();
    }
  }
}

function onWindowResize(): void {
  if (camera.type == "OrthographicCamera" && camera instanceof OrthographicCamera) {
    const halfFovV = DEG2RAD * 45 * 0.5;
    const halfFovH = Math.atan((window.innerWidth / window.innerHeight) * Math.tan(halfFovV));

    const halfW = perspectiveDistance * Math.tan(halfFovH);
    const halfH = perspectiveDistance * Math.tan(halfFovV);
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
  } else if (camera.type == "PerspectiveCamera" && camera instanceof PerspectiveCamera) {
    camera.aspect = window.innerWidth / window.innerHeight;
  }

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

function render(): void {
  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.camera = camera.type;
  canvas.dataset.gizmoVisible = String(arcballGui.gizmoVisible);
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

function setCamera(type: "Orthographic" | "Perspective"): void {
  if (type == "Orthographic") {
    camera = makeOrthographicCamera();
    camera.position.set(0, 0, orthographicDistance);
  } else if (type == "Perspective") {
    camera = makePerspectiveCamera();
    camera.position.set(0, 0, perspectiveDistance);
  }

  controls.setCamera(camera);

  render();

  publisheState();
}

function publisheState(): void {
  render();
}

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("keydown", onKeyDown);
    controls?.dispose();
    renderer.dispose();
    for (const resource of resources) resource.dispose();
    gui?.destroy();
  },
  { once: true },
);
