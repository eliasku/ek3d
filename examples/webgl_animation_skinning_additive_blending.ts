import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import type { AnimationAction } from "ek3d/animation/AnimationAction";
import { makeClipAdditive, subclip } from "ek3d/animation/AnimationUtils";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SkeletonHelper } from "ek3d/helpers/SkeletonHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing animation canvas");
const timer = new Timer();
timer.connect(document);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 100);
camera.position.set(-1, 2, 3);
const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.fog = new Fog(0xa0a0a0, 10, 50);
const hemi = new HemisphereLight(0xffffff, 0x8d8d8d, 3);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(3, 10, 10);
light.castShadow = true;
light.shadow.camera.top = 2;
light.shadow.camera.bottom = -2;
light.shadow.camera.left = -2;
light.shadow.camera.right = 2;
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 40;
scene.add(light);
const ground = new Mesh(new PlaneGeometry(100, 100), new MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshStandardMaterial: standardShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (renderer.shadowMap) renderer.shadowMap.enabled = true;
const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.enablePan = false;
controls.enableZoom = false;
controls.target.set(0, 1, 0);
controls.update();
const stats = new Stats();
document.body.appendChild(stats.dom);
let mixer: AnimationMixer | undefined;
let gui: GUI | undefined;
let disposed = false;
new GLTFLoader().load(
  "/examples/models/gltf/Xbot.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const model = gltf.scene;
    scene.add(model);
    model.traverse((child) => {
      if (child instanceof Mesh) child.castShadow = true;
    });
    const skeleton = new SkeletonHelper(model);
    skeleton.visible = false;
    scene.add(skeleton);
    const animationMixer = new AnimationMixer(model);
    mixer = animationMixer;
    type Entry = { weight: number; action?: AnimationAction };
    const base: Record<string, Entry> = { idle: { weight: 1 }, walk: { weight: 0 }, run: { weight: 0 } };
    const additive: Record<string, Entry> = {
      sneak_pose: { weight: 0 },
      sad_pose: { weight: 0 },
      agree: { weight: 0 },
      headShake: { weight: 0 },
    };
    function setWeight(action: AnimationAction, value: number): void {
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(value);
    }
    for (let clip of gltf.animations) {
      const entry = base[clip.name] ?? additive[clip.name];
      if (!entry) continue;
      if (additive[clip.name]) {
        makeClipAdditive(clip);
        if (clip.name.endsWith("_pose")) clip = subclip(clip, clip.name, 2, 3, 30);
      }
      const action = animationMixer.clipAction(clip);
      entry.action = action;
      setWeight(action, entry.weight);
      action.play();
    }
    let current = "idle";
    gui = new GUI({ width: 310 });
    const baseFolder = gui.addFolder("Base Actions");
    const additiveFolder = gui.addFolder("Additive Action Weights");
    const speedFolder = gui.addFolder("General Speed");
    const buttons = new Map<string, HTMLElement>();
    function transition(name: string): void {
      const start = base[current]?.action;
      const end = base[name]?.action;
      if (start === end) return;
      const execute = (): void => {
        if (end) {
          setWeight(end, 1);
          end.time = 0;
          if (start) start.crossFadeTo(end, 0.35, true);
          else end.fadeIn(0.35);
        } else start?.fadeOut(0.35);
      };
      if (current === "idle" || !start || !end) execute();
      else {
        const onLoop = (event: { action?: AnimationAction }): void => {
          if (event.action === start) {
            animationMixer.removeEventListener("loop", onLoop);
            execute();
          }
        };
        animationMixer.addEventListener("loop", onLoop);
      }
      current = name;
      for (const [key, element] of buttons) element.classList.toggle("control-inactive", key !== current);
    }
    for (const name of ["None", ...Object.keys(base)]) {
      const command = { select: () => transition(name) };
      const button = baseFolder.add(command, "select").name(name);
      buttons.set(name, button.domElement);
      button.domElement.classList.toggle("control-inactive", name !== current);
    }
    for (const [name, entry] of Object.entries(additive))
      additiveFolder
        .add(entry, "weight", 0, 1, 0.01)
        .name(name)
        .listen()
        .onChange(() => {
          if (entry.action) setWeight(entry.action, entry.weight);
        });
    const settings = { speed: 1 };
    speedFolder
      .add(settings, "speed", 0, 1.5, 0.01)
      .name("modify time scale")
      .onChange(() => {
        animationMixer.timeScale = settings.speed;
      });
    baseFolder.open();
    additiveFolder.open();
    speedFolder.open();
  },
  undefined,
  (error: unknown) => console.error(error),
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  mixer?.update(timer.getDelta());
  renderer.render(scene, camera);
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  timer.dispose();
  mixer?.stopAllAction();
  controls.dispose();
  gui?.destroy();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
});
