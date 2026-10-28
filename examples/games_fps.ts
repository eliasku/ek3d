import { OctreeHelper } from "ek3d/addons/helpers/OctreeHelper";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { Capsule } from "ek3d/addons/math/Capsule";
import { Octree } from "ek3d/addons/math/Octree";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, ShadowMap } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Color } from "ek3d/math/Color";
import { Sphere } from "ek3d/math/Sphere";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing FPS canvas");
const canvas: HTMLCanvasElement = selected;
const timer = new Timer();
timer.connect(document);
const scene = new Scene();
scene.background = new Color(0x88ccee);
scene.fog = new Fog(0x88ccee, 0, 50);
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
camera.rotation.order = "YXZ";
const fillLight = new HemisphereLight(0x8dc1de, 0x00668d, 1.5);
fillLight.position.set(2, 1, 1);
scene.add(fillLight);
const light = new DirectionalLight(0xffffff, 2.5);
light.position.set(-5, 25, -1);
light.castShadow = true;
light.shadow.camera.near = 0.01;
light.shadow.camera.far = 500;
light.shadow.camera.right = 30;
light.shadow.camera.left = -30;
light.shadow.camera.top = 30;
light.shadow.camera.bottom = -30;
light.shadow.mapSize.set(1024, 1024);
light.shadow.radius = 4;
light.shadow.bias = -0.00006;
scene.add(light);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  shaders: {
    MeshLambertMaterial: lambertShader,
    MeshStandardMaterial: standardShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ToneMapping.ACESFilmic;
if (!renderer.shadowMap) throw new Error("Missing shadow renderer");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = ShadowMap.VSM;
const stats = new Stats();
document.body.appendChild(stats.dom);

const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const sphereGeometry = new IcosahedronGeometry(0.2, 5);
const sphereMaterial = new MeshLambertMaterial({ color: 0xdede8d });
const spheres = Array.from({ length: 100 }, () => {
  const mesh = new Mesh(sphereGeometry, sphereMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { mesh, collider: new Sphere(new Vector3(0, -100, 0), 0.2), velocity: new Vector3() };
});
type Projectile = (typeof spheres)[number];
let sphereIndex = 0;
const worldOctree = new Octree();
const playerCollider = new Capsule(new Vector3(0, 0.35, 0), new Vector3(0, 1, 0), 0.35);
const playerVelocity = new Vector3();
const playerDirection = new Vector3();
const vector1 = new Vector3();
const vector2 = new Vector3();
const vector3 = new Vector3();
const keyStates: Record<string, boolean> = {};
let playerOnFloor = false;
let mouseTime = 0;
let disposed = false;
let loaded = false;
let gui: GUI | undefined;

function onKeyDown(event: KeyboardEvent): void {
  keyStates[event.code] = true;
}
function onKeyUp(event: KeyboardEvent): void {
  keyStates[event.code] = false;
}
function onMouseDown(): void {
  document.body.requestPointerLock().catch((error: unknown) => console.error("Failed to lock pointer:", error));
  mouseTime = performance.now();
}
function onMouseUp(): void {
  if (document.pointerLockElement === null) return;
  const sphere = spheres[sphereIndex];
  camera.getWorldDirection(playerDirection);
  sphere.collider.center.copy(playerCollider.end).addScaledVector(playerDirection, playerCollider.radius * 1.5);
  const impulse = 15 + 30 * (1 - Math.exp((mouseTime - performance.now()) * 0.001));
  sphere.velocity.copy(playerDirection).multiplyScalar(impulse).addScaledVector(playerVelocity, 2);
  sphereIndex = (sphereIndex + 1) % spheres.length;
}
function onMouseMove(event: MouseEvent): void {
  if (document.pointerLockElement === document.body) {
    camera.rotation.y -= event.movementX / 500;
    camera.rotation.x -= event.movementY / 500;
  }
}
function onResize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);
canvas.addEventListener("mousedown", onMouseDown);
document.addEventListener("mouseup", onMouseUp);
document.body.addEventListener("mousemove", onMouseMove);
window.addEventListener("resize", onResize);

function updatePlayer(deltaTime: number): void {
  let damping = Math.exp(-4 * deltaTime) - 1;
  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime;
    damping *= 0.1;
  }
  playerVelocity.addScaledVector(playerVelocity, damping);
  playerCollider.translate(vector3.copy(playerVelocity).multiplyScalar(deltaTime));
  const result = worldOctree.capsuleIntersect(playerCollider);
  playerOnFloor = false;
  if (result) {
    playerOnFloor = result.normal.y >= 0.15;
    if (!playerOnFloor) playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
    if (result.depth >= 1e-10) playerCollider.translate(result.normal.multiplyScalar(result.depth));
  }
  camera.position.copy(playerCollider.end);
}

function playerSphereCollision(sphere: Projectile): void {
  const center = vector1.addVectors(playerCollider.start, playerCollider.end).multiplyScalar(0.5);
  const sphereCenter = sphere.collider.center;
  const radius = playerCollider.radius + sphere.collider.radius;
  for (const point of [playerCollider.start, playerCollider.end, center]) {
    const distanceSquared = point.distanceToSquared(sphereCenter);
    if (distanceSquared < radius * radius) {
      const normal = vector1.subVectors(point, sphereCenter).normalize();
      const v1 = vector2.copy(normal).multiplyScalar(normal.dot(playerVelocity));
      const v2 = vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));
      playerVelocity.add(v2).sub(v1);
      sphere.velocity.add(v1).sub(v2);
      sphereCenter.addScaledVector(normal, -(radius - Math.sqrt(distanceSquared)) / 2);
    }
  }
}

function updateSpheres(deltaTime: number): void {
  for (const sphere of spheres) {
    sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);
    const result = worldOctree.sphereIntersect(sphere.collider);
    if (result) {
      sphere.velocity.addScaledVector(result.normal, -result.normal.dot(sphere.velocity) * 1.5);
      sphere.collider.center.add(result.normal.multiplyScalar(result.depth));
    } else {
      sphere.velocity.y -= GRAVITY * deltaTime;
    }
    sphere.velocity.addScaledVector(sphere.velocity, Math.exp(-1.5 * deltaTime) - 1);
    playerSphereCollision(sphere);
  }
  for (let i = 0; i < spheres.length; i++) {
    const s1 = spheres[i];
    for (let j = i + 1; j < spheres.length; j++) {
      const s2 = spheres[j];
      const distanceSquared = s1.collider.center.distanceToSquared(s2.collider.center);
      const radius = s1.collider.radius + s2.collider.radius;
      if (distanceSquared < radius * radius) {
        const normal = vector1.subVectors(s1.collider.center, s2.collider.center).normalize();
        const v1 = vector2.copy(normal).multiplyScalar(normal.dot(s1.velocity));
        const v2 = vector3.copy(normal).multiplyScalar(normal.dot(s2.velocity));
        s1.velocity.add(v2).sub(v1);
        s2.velocity.add(v1).sub(v2);
        const distance = (radius - Math.sqrt(distanceSquared)) / 2;
        s1.collider.center.addScaledVector(normal, distance);
        s2.collider.center.addScaledVector(normal, -distance);
      }
    }
  }
  for (const sphere of spheres) sphere.mesh.position.copy(sphere.collider.center);
}

function controls(deltaTime: number): void {
  const speed = deltaTime * (playerOnFloor ? 25 : 8);
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  if (keyStates.KeyW) playerVelocity.addScaledVector(playerDirection, speed);
  if (keyStates.KeyS) playerVelocity.addScaledVector(playerDirection, -speed);
  playerDirection.cross(camera.up);
  if (keyStates.KeyA) playerVelocity.addScaledVector(playerDirection, -speed);
  if (keyStates.KeyD) playerVelocity.addScaledVector(playerDirection, speed);
  if (playerOnFloor && keyStates.Space) playerVelocity.y = 15;
}

canvas.dataset.state = "loading";
new GLTFLoader().setPath("/examples/models/gltf/").load(
  "collision-world.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    scene.add(gltf.scene);
    worldOctree.fromGraphNode(gltf.scene);
    gltf.scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if ("map" in material && material.map instanceof Texture) material.map.anisotropy = 4;
      }
    });
    const helper = new OctreeHelper(worldOctree);
    helper.visible = false;
    scene.add(helper);
    gui = new GUI({ width: 200 });
    gui.add({ debug: false }, "debug").onChange((value: unknown) => {
      helper.visible = Boolean(value);
    });
    loaded = true;
  },
  undefined,
  (error: unknown) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);

function animate(): void {
  timer.update();
  const deltaTime = Math.min(0.05, timer.getDelta()) / STEPS_PER_FRAME;
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    controls(deltaTime);
    updatePlayer(deltaTime);
    updateSpheres(deltaTime);
    if (camera.position.y <= -25) {
      playerCollider.start.set(0, 0.35, 0);
      playerCollider.end.set(0, 1, 0);
      playerCollider.radius = 0.35;
      camera.position.copy(playerCollider.end);
      camera.rotation.set(0, 0, 0);
    }
  }
  renderer.render(scene, camera);
  stats.update();
  if (loaded) canvas.dataset.state = "rendered";
}
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("keyup", onKeyUp);
  canvas.removeEventListener("mousedown", onMouseDown);
  document.removeEventListener("mouseup", onMouseUp);
  document.body.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("resize", onResize);
  if (document.pointerLockElement === document.body) document.exitPointerLock();
  gui?.destroy();
  stats.dom.remove();
  timer.dispose();
  disposeObject(scene);
  light.shadow.dispose();
  dfg.dispose();
  renderer.dispose();
});
