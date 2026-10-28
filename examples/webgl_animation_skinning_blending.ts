import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import type { AnimationAction } from "ek3d/animation/AnimationAction";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
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
camera.position.set(1, 2, -3);
camera.lookAt(0, 1, 0);
const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.fog = new Fog(0xa0a0a0, 10, 50);
const hemi = new HemisphereLight(0xffffff, 0x8d8d8d, 3);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(-3, 10, -10);
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
const stats = new Stats();
document.body.appendChild(stats.dom);
let mixer: AnimationMixer | undefined;
let gui: GUI | undefined;
let disposed = false;
let updateActions: ((delta: number) => void) | undefined;
new GLTFLoader().load(
  "/examples/models/gltf/Soldier.glb",
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
    const idle = animationMixer.clipAction(gltf.animations[0]);
    const walk = animationMixer.clipAction(gltf.animations[3]);
    const run = animationMixer.clipAction(gltf.animations[1]);
    const actions = [idle, walk, run];
    let singleStep = false;
    let nextStep = 0;
    function weight(action: AnimationAction, value: number): void {
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(value);
    }
    function crossFade(start: AnimationAction, end: AnimationAction, defaultDuration: number): void {
      const duration = settings.useDefaultDuration ? defaultDuration : settings.customDuration;
      singleStep = false;
      for (const action of actions) action.paused = false;
      const execute = (): void => {
        weight(end, 1);
        end.time = 0;
        start.crossFadeTo(end, duration, true);
      };
      if (start === idle) execute();
      else {
        const onLoop = (event: { action?: AnimationAction }): void => {
          if (event.action === start) {
            animationMixer.removeEventListener("loop", onLoop);
            execute();
          }
        };
        animationMixer.addEventListener("loop", onLoop);
      }
    }
    const settings = {
      showModel: true,
      showSkeleton: false,
      deactivateAll: () => {
        for (const action of actions) action.stop();
      },
      activateAll: () => {
        weight(idle, settings.idleWeight);
        weight(walk, settings.walkWeight);
        weight(run, settings.runWeight);
        for (const action of actions) action.play();
      },
      pauseContinue: () => {
        if (singleStep) {
          singleStep = false;
          for (const action of actions) action.paused = false;
        } else {
          const paused = !idle.paused;
          for (const action of actions) action.paused = paused;
        }
      },
      singleStep: () => {
        for (const action of actions) action.paused = false;
        singleStep = true;
        nextStep = settings.stepSize;
      },
      stepSize: 0.05,
      walkToIdle: () => crossFade(walk, idle, 1),
      idleToWalk: () => crossFade(idle, walk, 0.5),
      walkToRun: () => crossFade(walk, run, 2.5),
      runToWalk: () => crossFade(run, walk, 5),
      useDefaultDuration: true,
      customDuration: 3.5,
      idleWeight: 0,
      walkWeight: 1,
      runWeight: 0,
      timeScale: 1,
    };
    gui = new GUI({ width: 310 });
    const visibility = gui.addFolder("Visibility");
    visibility
      .add(settings, "showModel")
      .name("show model")
      .onChange(() => {
        model.visible = settings.showModel;
      });
    visibility
      .add(settings, "showSkeleton")
      .name("show skeleton")
      .onChange(() => {
        skeleton.visible = settings.showSkeleton;
      });
    const activation = gui.addFolder("Activation/Deactivation");
    activation.add(settings, "deactivateAll").name("deactivate all");
    activation.add(settings, "activateAll").name("activate all");
    const stepping = gui.addFolder("Pausing/Stepping");
    stepping.add(settings, "pauseContinue").name("pause/continue");
    stepping.add(settings, "singleStep").name("make single step");
    stepping.add(settings, "stepSize", 0.01, 0.1, 0.001).name("modify step size");
    const fading = gui.addFolder("Crossfading");
    const buttons = [
      fading.add(settings, "walkToIdle").name("from walk to idle"),
      fading.add(settings, "idleToWalk").name("from idle to walk"),
      fading.add(settings, "walkToRun").name("from walk to run"),
      fading.add(settings, "runToWalk").name("from run to walk"),
    ];
    fading.add(settings, "useDefaultDuration").name("use default duration");
    fading.add(settings, "customDuration", 0, 10, 0.01).name("set custom duration");
    const weights = gui.addFolder("Blend Weights");
    weights
      .add(settings, "idleWeight", 0, 1, 0.01)
      .name("modify idle weight")
      .listen()
      .onChange(() => weight(idle, settings.idleWeight));
    weights
      .add(settings, "walkWeight", 0, 1, 0.01)
      .name("modify walk weight")
      .listen()
      .onChange(() => weight(walk, settings.walkWeight));
    weights
      .add(settings, "runWeight", 0, 1, 0.01)
      .name("modify run weight")
      .listen()
      .onChange(() => weight(run, settings.runWeight));
    const speed = gui.addFolder("General Speed");
    speed
      .add(settings, "timeScale", 0, 1.5, 0.01)
      .name("modify time scale")
      .onChange(() => {
        animationMixer.timeScale = settings.timeScale;
      });
    for (const folder of [visibility, activation, stepping, fading, weights, speed]) folder.open();
    settings.activateAll();
    updateActions = (delta) => {
      settings.idleWeight = idle.getEffectiveWeight();
      settings.walkWeight = walk.getEffectiveWeight();
      settings.runWeight = run.getEffectiveWeight();
      const [i, w, r] = [settings.idleWeight, settings.walkWeight, settings.runWeight];
      if ((i === 1 && w === 0 && r === 0) || (i === 0 && w === 1 && r === 0) || (i === 0 && w === 0 && r === 1)) {
        const enabled = [w === 1, i === 1, w === 1, r === 1];
        buttons.forEach((button, index) => {
          if (enabled[index]) button.enable();
          else button.disable();
        });
      }
      if (singleStep) {
        delta = nextStep;
        nextStep = 0;
      }
      animationMixer.update(delta);
    };
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
  updateActions?.(timer.getDelta());
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
  gui?.destroy();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
});
