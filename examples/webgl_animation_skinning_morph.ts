import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import type { AnimationAction } from "ek3d/animation/AnimationAction";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Loop } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
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
const scene = new Scene();
scene.background = new Color(0xe0e0e0);
scene.fog = new Fog(0xe0e0e0, 20, 100);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.25, 100);
camera.position.set(-5, 3, 10);
camera.lookAt(0, 2, 0);
const hemi = new HemisphereLight(0xffffff, 0x8d8d8d, 3);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const directional = new DirectionalLight(0xffffff, 3);
directional.position.set(0, 20, 10);
scene.add(directional);
const ground = new Mesh(new PlaneGeometry(2000, 2000), new MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const grid = new GridHelper(200, 40, 0x000000, 0x000000);
const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
for (const material of gridMaterials) {
  material.opacity = 0.2;
  material.transparent = true;
}
scene.add(grid);
const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshStandardMaterial: standardShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
let mixer: AnimationMixer | undefined;
let gui: GUI | undefined;
let disposed = false;
new GLTFLoader().load(
  "/examples/models/gltf/RobotExpressive/RobotExpressive.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const model = gltf.scene;
    scene.add(model);
    const animationMixer = new AnimationMixer(model);
    mixer = animationMixer;
    const states = ["Idle", "Walking", "Running", "Dance", "Death", "Sitting", "Standing"];
    const emotes = ["Jump", "Yes", "No", "Wave", "Punch", "ThumbsUp"];
    const actions: Record<string, AnimationAction> = {};
    for (const clip of gltf.animations) {
      const action = animationMixer.clipAction(clip);
      actions[clip.name] = action;
      if (emotes.includes(clip.name) || states.indexOf(clip.name) >= 4) {
        action.clampWhenFinished = true;
        action.loop = Loop.Once;
      }
    }
    const api = { state: "Walking" };
    let active = actions["Walking"];
    active.play();
    function fade(name: string, duration: number): void {
      const next = actions[name];
      if (!next) return;
      if (active !== next) active.fadeOut(duration);
      active = next;
      active.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
    }
    gui = new GUI();
    const stateFolder = gui.addFolder("States");
    stateFolder
      .add(api, "state")
      .options(states)
      .onChange(() => fade(api.state, 0.5));
    stateFolder.open();
    const emoteFolder = gui.addFolder("Emotes");
    function restore(): void {
      animationMixer.removeEventListener("finished", restore);
      fade(api.state, 0.2);
    }
    for (const name of emotes) {
      const button = {
        play: () => {
          fade(name, 0.2);
          animationMixer.addEventListener("finished", restore);
        },
      };
      emoteFolder.add(button, "play").name(name);
    }
    emoteFolder.open();
    const face = model.getObjectByName("Head_4") as Mesh | undefined;
    if (face?.morphTargetDictionary && face.morphTargetInfluences) {
      const expressions = gui.addFolder("Expressions");
      for (const [name, index] of Object.entries(face.morphTargetDictionary))
        expressions.add(face.morphTargetInfluences, String(index), 0, 1, 0.01).name(name);
      expressions.open();
    }
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
  gui?.destroy();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
});
