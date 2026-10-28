import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import type { AnimationClip } from "ek3d/animation/AnimationClip";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { clone } from "ek3d/addons/utils/SkeletonUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DetachedBindMode } from "ek3d/constants";
import type { Object3D } from "ek3d/core/Object3D";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Mesh } from "ek3d/objects/Mesh";
import { SkinnedMesh } from "ek3d/objects/SkinnedMesh";
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
const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.fog = new Fog(0xa0a0a0, 10, 50);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000);
camera.position.set(2, 3, -6);
camera.lookAt(0, 1, 0);
const hemi = new HemisphereLight(0xffffff, 0x8d8d8d, 3);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(-3, 10, -10);
light.castShadow = true;
light.shadow.camera.top = 4;
light.shadow.camera.bottom = -4;
light.shadow.camera.left = -4;
light.shadow.camera.right = 4;
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 40;
scene.add(light);
const ground = new Mesh(new PlaneGeometry(200, 200), new MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }));
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
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (renderer.shadowMap) renderer.shadowMap.enabled = true;
const mixers: AnimationMixer[] = [];
const objects: Object3D[] = [];
let model: Object3D | undefined;
let animations: AnimationClip[] = [];
let disposed = false;
function clear(): void {
  for (const mixer of mixers) mixer.stopAllAction();
  mixers.length = 0;
  const skeletons = new Set<SkinnedMesh["skeleton"]>();
  for (const object of objects) {
    scene.remove(object);
    object.traverse((child) => {
      if (child instanceof SkinnedMesh) skeletons.add(child.skeleton);
    });
  }
  for (const skeleton of skeletons) skeleton.dispose();
  objects.length = 0;
}
function setup(): void {
  if (!model) return;
  clear();
  if (!params.sharedSkeleton) {
    for (const [index, clip] of [0, 1, 3].entries()) {
      const object = clone(model);
      object.position.x = (index - 1) * 2;
      const mixer = new AnimationMixer(object);
      mixer.clipAction(animations[clip]).play();
      scene.add(object);
      objects.push(object);
      mixers.push(mixer);
    }
  } else {
    const shared = clone(model);
    const mesh = shared.getObjectByName("vanguard_Mesh");
    const bone = shared.getObjectByName("mixamorigHips");
    if (!(mesh instanceof SkinnedMesh) || !bone) throw new Error("Missing Soldier skeleton");
    const identity = new Matrix4();
    for (let i = 0; i < 3; i++) {
      const object = mesh.clone();
      object.bindMode = DetachedBindMode;
      object.bind(mesh.skeleton, identity);
      object.position.x = (i - 1) * 2;
      object.scale.setScalar(0.01);
      object.rotation.x = -Math.PI / 2;
      scene.add(object);
      objects.push(object);
    }
    scene.add(bone);
    objects.push(bone);
    const mixer = new AnimationMixer(bone);
    mixer.clipAction(animations[1]).play();
    mixers.push(mixer);
  }
}
const params = { sharedSkeleton: false };
const gui = new GUI();
gui.add(params, "sharedSkeleton").onChange(setup);
gui.open();
new GLTFLoader().load(
  "/examples/models/gltf/Soldier.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    model = gltf.scene;
    animations = gltf.animations;
    model.traverse((object) => {
      if (object instanceof Mesh) object.castShadow = true;
    });
    setup();
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
  for (const mixer of mixers) mixer.update(timer.getDelta());
  renderer.render(scene, camera);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  timer.dispose();
  gui.destroy();
  clear();
  if (model) disposeObject(model);
  disposeObject(scene);
  renderer.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
});
