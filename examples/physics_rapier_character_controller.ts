import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CapsuleGeometry } from "ek3d/geometries/CapsuleGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RapierHelper } from "ek3d/addons/helpers/RapierHelper";
import { Stats } from "ek3d/addons/libs/Stats";
import { RapierPhysics } from "ek3d/addons/physics/RapierPhysics";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping } from "ek3d/constants";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { Color } from "ek3d/math/Color";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { loadRapier } from "./rapier-runtime";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing Rapier canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false;
const cleanup: (() => void)[] = [];
function dispose(): void {
  if (disposed) return;
  disposed = true;
  for (const release of cleanup.reverse()) release();
  cleanup.length = 0;
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});

async function init(): Promise<void> {
  canvas.dataset.state = "loading";
  const runtime = await loadRapier();
  if (disposed) return;
  const physics = RapierPhysics(runtime);
  cleanup.push(() => physics.dispose());
  const scene = new Scene();
  scene.background = new Color(0xbfd1e5);
  cleanup.push(() => disposeObject(scene));
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(2, 5, 15);
  const light = new DirectionalLight(0xffffff, 3);
  light.position.set(0, 12.5, 12.5);
  light.castShadow = true;
  light.shadow.camera.left = -10;
  light.shadow.camera.right = 10;
  light.shadow.camera.top = 10;
  light.shadow.camera.bottom = -10;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 50;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.radius = 3;
  light.shadow.blurSamples = 8;
  scene.add(light);
  cleanup.push(() => light.shadow.dispose());
  const dfg = createDFGLUT();
  cleanup.push(() => dfg.dispose());
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createEnvironments: WebGLEnvironments,
    createShadowMap: WebGLShadowMap,
    getDFGLUT: () => dfg,
    shaders: { MeshStandardMaterial: standardShader, LineBasicMaterial: basicShader, MeshDepthMaterial: depthShader },
  });
  cleanup.push(() => renderer.dispose());
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  if (!renderer.shadowMap) throw new Error("Missing shadow renderer");
  renderer.shadowMap.enabled = true;
  const controls = new OrbitControls(camera, canvas);
  cleanup.push(() => controls.dispose());
  controls.target.set(0, 2, 0);
  controls.update();
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  cleanup.push(() => stats.dom.remove());
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  cleanup.push(() => window.removeEventListener("resize", resize));
  scene.add(new HemisphereLight(0x555555, 0xffffff));
  const groundMaterial = new MeshStandardMaterial({ color: 0xffffff });
  const ground = new Mesh(new BoxGeometry(20, 0.5, 20), groundMaterial);
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  ground.userData.physics = { mass: 0 };
  scene.add(ground);
  new TextureLoader().load("/examples/textures/grid.png", (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(20, 20);
    groundMaterial.map = texture;
    groundMaterial.needsUpdate = true;
  });
  for (let i = 0; i < 10; i++) {
    const fixed = Math.random() > 0.7;
    const mesh = new Mesh(
      fixed ? new BoxGeometry(1, 1, 1) : new SphereGeometry(0.25),
      new MeshStandardMaterial({ color: fixed ? 0xff0000 : 0x00ff00 }),
    );
    mesh.castShadow = true;
    mesh.position.set(Math.random() * 20 - 10, 0.5, Math.random() * 20 - 10);
    mesh.userData.physics = { mass: fixed ? 0 : 0.5, restitution: fixed ? 0 : 0.3 };
    scene.add(mesh);
  }
  physics.addScene(scene);
  const helper = new RapierHelper(physics.world);
  scene.add(helper);
  cleanup.push(() => {
    scene.remove(helper);
    helper.dispose();
  });
  const player = new Mesh(new CapsuleGeometry(0.3, 1, 8, 8), new MeshStandardMaterial({ color: 0x0000ff }));
  player.castShadow = true;
  player.position.set(0, 0.8, 0);
  scene.add(player);
  const controller = physics.world.createCharacterController(0.01);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(3);
  const collider = physics.world.createCollider(runtime.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0));
  cleanup.push(() => {
    physics.world.removeCharacterController(controller);
    physics.world.removeCollider(collider, true);
  });
  const keys = new Set<string>();
  function keydown(event: KeyboardEvent): void {
    keys.add(event.key.toLowerCase());
  }
  function keyup(event: KeyboardEvent): void {
    keys.delete(event.key.toLowerCase());
  }
  function blur(): void {
    keys.clear();
  }
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  cleanup.push(() => {
    window.removeEventListener("keydown", keydown);
    window.removeEventListener("keyup", keyup);
    window.removeEventListener("blur", blur);
  });
  const displacement = new runtime.Vector3(0, 0, 0);
  cleanup.push(() => renderer.setAnimationLoop(null));
  renderer.setAnimationLoop(() => {
    const right = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
    const forward = Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown"));
    displacement.x = (right * 2.5) / 60;
    displacement.z = (-forward * 2.5) / 60;
    controller.computeColliderMovement(collider, displacement);
    const movement = controller.computedMovement();
    const position = collider.translation();
    position.x += movement.x;
    position.y += movement.y;
    position.z += movement.z;
    collider.setTranslation(position);
    player.position.set(position.x, position.y, position.z);
    helper.update();
    renderer.render(scene, camera);
    stats.update();
    canvas.dataset.state = "rendered";
  });
}
void init().catch((error: unknown) => {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
  dispose();
});
