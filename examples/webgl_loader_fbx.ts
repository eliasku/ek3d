import { loadZlibDecoder } from "./fflate";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { FBXLoader } from "ek3d/addons/loaders/FBXLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import type { Material } from "ek3d/materials/Material";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import type { Object3D } from "ek3d/core/Object3D";
import { Mesh } from "ek3d/objects/Mesh";
import { SkinnedMesh } from "ek3d/objects/SkinnedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { Texture } from "ek3d/textures/Texture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing FBX loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const assets = [
  "Samba Dancing",
  "morph_test",
  "monkey",
  "monkey_embedded_texture",
  "vCube",
  "archer/ArcherRi01",
  "warrior/Warrior",
  "stanford-bunny",
  "mixamo",
  "RotationTest",
  "exampleWindow",
  "Head_69",
  "morph-translation",
  "ball_anims_asc_2018",
];

const scales = new Map<string, number>([
  ["warrior/Warrior", 100],
  ["archer/ArcherRi01", 100],
  ["stanford-bunny", 0.001],
  ["Head_69", 100],
  ["ball_anims_asc_2018", 50],
]);

const params = {
  asset: "Samba Dancing",
};

const timer = new Timer();
timer.connect(document);

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(100, 200, 300);

const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.fog = new Fog(0xa0a0a0, 200, 1000);

const hemiLight = new HemisphereLight(0xffffff, 0x444444, 5);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const dirLight = new DirectionalLight(0xffffff, 5);
dirLight.position.set(0, 200, 100);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 180;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.camera.left = -120;
dirLight.shadow.camera.right = 120;
scene.add(dirLight);

// Ground

const groundGeometry = new PlaneGeometry(2000, 2000);
const groundMaterial = new MeshPhongMaterial({ color: 0x999999, depthWrite: false });
const ground = new Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new GridHelper(2000, 20, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

// Renderer

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshLambertMaterial: lambertShader,
    LineBasicMaterial: basicShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const shadowMap = renderer.shadowMap;
if (shadowMap === null) throw new Error("the shadow map system failed to install");
shadowMap.enabled = true;

const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableDamping = true;
controls.target.set(0, 100, 0);
controls.update();

const stats = new Stats();
document.body.appendChild(stats.dom);

const gui = new GUI();
gui.add(params, "asset", assets).onChange((value) => {
  loadAsset(value as string);
});
const guiMorphsFolder = gui.addFolder("Morphs").hide();
const guiAnimationsFolder = gui.addFolder("Animations").hide();

// Loading

const loader = new FBXLoader();
loader.setPath("/examples/models/fbx/");

let object: Object3D | undefined;
let mixer: AnimationMixer | null = null;
let disposed = false;
let frames = 0;
let assetRequest = 0;

/** Releases every GPU resource the previous asset owns before it leaves the scene. */
function disposeObject(target: Object3D): void {
  target.traverse((child) => {
    if (child instanceof SkinnedMesh && child.skeleton !== undefined) child.skeleton.dispose();

    const renderable = child as Object3D & {
      material?: Material | Material[];
      geometry?: { dispose(): void };
    };

    if (renderable.material !== undefined) {
      const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof Texture) value.dispose();
        }
        material.dispose();
      }
    }

    if (renderable.geometry !== undefined) renderable.geometry.dispose();
  });
}

function loadAsset(asset: string): void {
  const request = ++assetRequest;
  loader.trimAnimationClips = asset === "ball_anims_asc_2018";

  loader.load(
    asset + ".fbx",
    (group) => {
      // A response arriving after pagehide must not resurrect disposed renderer state.
      if (disposed || request !== assetRequest) {
        disposeObject(group);
        return;
      }
      if (object !== undefined && mixer !== null) {
        mixer.stopAllAction();
        mixer.uncacheRoot(object);
      }

      if (object !== undefined) {
        disposeObject(object);
        scene.remove(object);
      }

      object = group;

      const scale = scales.get(asset);
      object.scale.setScalar(scale ?? 1);

      while (guiAnimationsFolder.children.length > 0) guiAnimationsFolder.children[0].destroy();
      guiAnimationsFolder.hide();

      if (object.animations.length > 0) {
        const clips = object.animations;
        const activeMixer = new AnimationMixer(object);
        mixer = activeMixer;

        activeMixer.clipAction(clips[0]).play();

        const animationParams = { clip: clips[0].name };

        guiAnimationsFolder.show();
        guiAnimationsFolder
          .add(
            animationParams,
            "clip",
            clips.map((clip) => clip.name),
          )
          .onChange((name) => {
            activeMixer.stopAllAction();

            const clip = clips.find((candidate) => candidate.name === name);
            if (clip === undefined) throw new Error(`Unknown animation clip "${String(name)}"`);
            activeMixer.clipAction(clip).play();
          });
      } else {
        mixer = null;
      }

      while (guiMorphsFolder.children.length > 0) guiMorphsFolder.children[0].destroy();
      guiMorphsFolder.hide();

      object.traverse((child) => {
        if (!(child instanceof Mesh)) return;

        child.castShadow = true;
        child.receiveShadow = true;

        const dictionary = child.morphTargetDictionary;
        const influences = child.morphTargetInfluences;
        if (dictionary === undefined || influences === undefined) return;

        guiMorphsFolder.show();
        const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid);

        for (const key of Object.keys(dictionary)) {
          meshFolder.add(influences, String(dictionary[key]), 0, 1, 0.01).name(key);
        }
      });

      scene.add(object);

      canvas.dataset.loaded = "true";
      canvas.dataset.asset = asset;
      canvas.dataset.animations = String(object.animations.length);
    },
    undefined,
    (error) => {
      if (disposed || request !== assetRequest) return;

      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
}

function animate(): void {
  timer.update();

  const delta = timer.getDelta();

  if (mixer !== null) mixer.update(delta);

  controls.update();

  renderer.render(scene, camera);

  stats.update();

  frames++;
  canvas.dataset.frames = String(frames);
  canvas.dataset.clip = mixer === null ? "" : String(mixer.time.toFixed(3));

  if (canvas.dataset.state !== "error" && canvas.dataset.loaded === "true") canvas.dataset.state = "rendered";
}

renderer.setAnimationLoop(animate);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    window.removeEventListener("resize", onWindowResize);
    renderer.setAnimationLoop(null);

    if (object !== undefined) {
      disposeObject(object);
      scene.remove(object);
      object = undefined;
    }

    mixer?.stopAllAction();
    mixer = null;

    for (const child of guiAnimationsFolder.children) child.destroy();
    for (const child of guiMorphsFolder.children) child.destroy();
    gui.destroy();
    controls.dispose();
    stats.dom.remove();
    grid.geometry.dispose();
    grid.material.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();
    dirLight.dispose();
    timer.disconnect();
    renderer.dispose();
  },
  { once: true },
);

// Compressed binary FBX array properties need the example-owned zlib runtime.
loadZlibDecoder().then(
  (runtime) => {
    if (disposed) return;
    loader.setZlibDecoder(runtime);
    loadAsset(params.asset);
  },
  (error: unknown) => {
    if (disposed) return;

    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
