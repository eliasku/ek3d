import { CCDIKHelper, CCDIKSolver } from "ek3d/addons/animation/CCDIKSolver";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { TransformControls } from "ek3d/addons/controls/TransformControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { CubeCamera } from "ek3d/cameras/CubeCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Object3D } from "ek3d/core/Object3D";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import type { Material } from "ek3d/materials/Material";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { SkinnedMesh } from "ek3d/objects/SkinnedMesh";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing IK canvas");
const canvas = selected;
canvas.dataset.state = "loading";
const scene = new Scene();
scene.background = new Color(0xffffff);
scene.fog = new FogExp2(0xffffff, 0.17);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.001, 5000);
camera.position.set(0.9728517749133652, 1.1044765132727201, 0.7316689528482836);
camera.lookAt(scene.position);
scene.add(new AmbientLight(0xffffff, 8));
const dfg = createDFGLUT(),
  ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const orbit = new OrbitControls(camera, canvas);
orbit.minDistance = 0.2;
orbit.maxDistance = 1.5;
orbit.enableDamping = true;
const transform = new TransformControls(camera, canvas);
transform.size = 0.75;
transform.showX = false;
transform.space = "world";
scene.add(transform.getHelper());
transform.addEventListener("mouseDown", () => {
  orbit.enabled = false;
});
transform.addEventListener("mouseUp", () => {
  orbit.enabled = true;
});
const stats = new Stats();
document.body.appendChild(stats.dom);
const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
const loader = new GLTFLoader().setDRACOLoader(draco);
const cubeTarget = new WebGLCubeRenderTarget(1024);
const cubeCamera = new CubeCamera(0.05, 50, cubeTarget);
scene.add(cubeCamera);
const v = new Vector3();
let solver: CCDIKSolver | undefined, helper: CCDIKHelper | undefined, gui: GUI | undefined;
let sphere: Mesh | undefined, head: Object3D | undefined;
let oldMaterials: Material[] = [];
let disposed = false,
  failed = false,
  frames = 0;
function updateIK(): void {
  solver?.update();
  scene.traverse((object) => {
    if (object instanceof SkinnedMesh) object.computeBoundingSphere();
  });
}
const conf = { followSphere: false, turnHead: true, ik_solver: true, update: updateIK };
loader.load(
  "/examples/models/gltf/kira.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const model = gltf.scene;
    const hand = model.getObjectByName("hand_l");
    const target = model.getObjectByName("target_hand_l");
    const ball = model.getObjectByName("boule");
    const kira = model.getObjectByName("Kira_Shirt_left");
    head = model.getObjectByName("head");
    if (!hand || !target || !(ball instanceof Mesh) || !(kira instanceof SkinnedMesh) || !head) {
      disposeObject(model);
      failed = true;
      canvas.dataset.state = "error";
      canvas.dataset.error = "Missing IK model nodes";
      return;
    }
    scene.add(model);
    sphere = ball;
    orbit.target.copy(ball.position);
    hand.attach(ball);
    oldMaterials = Array.isArray(ball.material) ? ball.material : [ball.material];
    ball.material = new MeshBasicMaterial({ envMap: cubeTarget.texture });
    kira.add(kira.skeleton.bones[0]);
    const iks = [
      {
        target: 22,
        effector: 6,
        links: [
          { index: 5, rotationMin: new Vector3(1.2, -1.8, -0.4), rotationMax: new Vector3(1.7, -1.1, 0.3) },
          { index: 4, rotationMin: new Vector3(0.1, -0.7, -1.8), rotationMax: new Vector3(1.1, 0, -1.4) },
        ],
      },
    ];
    solver = new CCDIKSolver(kira, iks);
    helper = solver.createHelper(0.01);
    scene.add(helper);
    transform.attach(target);
    gui = new GUI();
    gui.add(conf, "followSphere").name("follow sphere");
    gui.add(conf, "turnHead").name("turn head");
    gui.add(conf, "ik_solver").name("IK auto update");
    gui.add(conf, "update").name("IK manual update()");
    gui.open();
  },
  undefined,
  (error: unknown) => {
    if (disposed) return;
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  if (sphere) {
    sphere.visible = false;
    sphere.getWorldPosition(cubeCamera.position);
    cubeCamera.update(renderer, scene);
    sphere.visible = true;
    if (conf.followSphere) {
      sphere.getWorldPosition(v);
      orbit.target.lerp(v, 0.1);
    }
    if (head && conf.turnHead) {
      sphere.getWorldPosition(v);
      head.lookAt(v);
      head.rotation.set(head.rotation.x, head.rotation.y + Math.PI, head.rotation.z);
    }
    if (conf.ik_solver) updateIK();
  }
  orbit.update();
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (!failed && solver) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  draco.dispose();
  orbit.dispose();
  transform.dispose();
  gui?.destroy();
  stats.dom.remove();
  if (helper) {
    scene.remove(helper);
    helper.dispose();
  }
  scene.remove(transform.getHelper());
  disposeObject(scene, oldMaterials);
  cubeTarget.dispose();
  renderer.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
  canvas.dataset.state = "disposed";
});
