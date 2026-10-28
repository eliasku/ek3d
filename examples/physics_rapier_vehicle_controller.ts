import type { RapierBody } from "ek3d/addons/physics/RapierPhysics";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RapierHelper } from "ek3d/addons/helpers/RapierHelper";
import { Stats } from "ek3d/addons/libs/Stats";
import { RapierPhysics } from "ek3d/addons/physics/RapierPhysics";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Wrapping } from "ek3d/constants";
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
  camera.position.set(0, 4, 10);
  const light = new DirectionalLight(0xffffff, 4);
  light.position.set(0, 12.5, 12.5);
  light.castShadow = true;
  light.shadow.camera.left = -40;
  light.shadow.camera.right = 40;
  light.shadow.camera.top = 40;
  light.shadow.camera.bottom = -40;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 50;
  light.shadow.mapSize.set(2048, 2048);
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
  const ground = new Mesh(new BoxGeometry(100, 0.5, 100), groundMaterial);
  ground.position.set(0, -0.25, -20);
  ground.receiveShadow = true;
  ground.userData.physics = { mass: 0 };
  scene.add(ground);
  new TextureLoader().load("/examples/textures/grid.png", (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.wrapS = texture.wrapT = Wrapping.Repeat;
    texture.repeat.set(80, 80);
    groundMaterial.map = texture;
    groundMaterial.needsUpdate = true;
  });
  physics.addScene(scene);
  const helper = new RapierHelper(physics.world);
  scene.add(helper);
  cleanup.push(() => {
    scene.remove(helper);
    helper.dispose();
  });
  const car = new Mesh(new BoxGeometry(2, 1, 4), new MeshStandardMaterial({ color: 0xff0000 }));
  car.castShadow = true;
  car.position.y = 1;
  scene.add(car);
  physics.addMesh(car, 10, 0.8);
  const chassis = car.userData.physics.body as RapierBody;
  const vehicle = physics.world.createVehicleController(chassis);
  cleanup.push(() => physics.world.removeVehicleController(vehicle));
  const wheels: Mesh[] = [];
  for (const position of [
    new Vector3(-1, 0, -1.5),
    new Vector3(1, 0, -1.5),
    new Vector3(-1, 0, 1.5),
    new Vector3(1, 0, 1.5),
  ]) {
    const index = wheels.length;
    vehicle.addWheel(position, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.8, 0.3);
    vehicle.setWheelSuspensionStiffness(index, 24);
    vehicle.setWheelFrictionSlip(index, 1000);
    vehicle.setWheelSteering(index, position.z < 0 ? 1 : 0);
    const geometry = new CylinderGeometry(0.3, 0.3, 0.4, 16);
    geometry.rotateZ(Math.PI * 0.5);
    const wheel = new Mesh(geometry, new MeshStandardMaterial({ color: 0x000000 }));
    wheel.castShadow = true;
    wheel.position.copy(position);
    wheels.push(wheel);
    car.add(wheel);
  }
  vehicle.setWheelSteering(0, Math.PI / 4);
  vehicle.setWheelSteering(1, Math.PI / 4);
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
  let acceleration = 0,
    braking = 0;
  const steerQuat = new Quaternion(),
    rotationQuat = new Quaternion();
  const up = new Vector3(0, 1, 0),
    axle = new Vector3();
  function updateCar(): void {
    if (keys.has("r")) {
      chassis.setTranslation(new runtime.Vector3(0, 1, 0), true);
      chassis.setRotation(new runtime.Quaternion(0, 0, 0, 1), true);
      chassis.setLinvel(new runtime.Vector3(0, 0, 0), true);
      chassis.setAngvel(new runtime.Vector3(0, 0, 0), true);
      acceleration = 0;
      braking = 0;
      return;
    }
    const forward = Number(keys.has("s") || keys.has("arrowdown")) - Number(keys.has("w") || keys.has("arrowup"));
    const right = Number(keys.has("a") || keys.has("arrowleft")) - Number(keys.has("d") || keys.has("arrowright"));
    if (forward < 0) acceleration = Math.max(-30, acceleration - 1);
    else if (forward > 0) acceleration = Math.min(30, acceleration + 1);
    else {
      acceleration = 0;
      if (chassis.isSleeping()) chassis.wakeUp();
    }
    braking = keys.has(" ") ? Math.min(1, braking + 0.05) : 0;
    vehicle.setWheelEngineForce(0, acceleration);
    vehicle.setWheelEngineForce(1, acceleration);
    const current = vehicle.wheelSteering(0) ?? 0;
    const steering = current + ((Math.PI / 4) * right - current) * 0.25;
    vehicle.setWheelSteering(0, steering);
    vehicle.setWheelSteering(1, steering);
    for (let i = 0; i < 4; i++) vehicle.setWheelBrake(i, braking);
  }
  function updateWheels(): void {
    wheels.forEach((wheel, index) => {
      const direction = vehicle.wheelAxleCs(index);
      if (!direction) return;
      axle.set(direction.x, direction.y, direction.z);
      const connection = vehicle.wheelChassisConnectionPointCs(index)?.y ?? 0;
      wheel.position.y = connection - (vehicle.wheelSuspensionLength(index) ?? 0);
      steerQuat.setFromAxisAngle(up, vehicle.wheelSteering(index) ?? 0);
      rotationQuat.setFromAxisAngle(axle, vehicle.wheelRotation(index) ?? 0);
      wheel.quaternion.multiplyQuaternions(steerQuat, rotationQuat);
    });
  }
  cleanup.push(() => renderer.setAnimationLoop(null));
  renderer.setAnimationLoop(() => {
    updateCar();
    vehicle.updateVehicle(1 / 60);
    updateWheels();
    controls.target.copy(car.position);
    controls.update();
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
