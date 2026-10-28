import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { RepeatWrapping } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

interface Vec {
  x(): number;
  y(): number;
  z(): number;
}
interface Rotation extends Vec {
  w(): number;
}
interface Transform {
  setIdentity(): void;
  setOrigin(v: Vec): void;
  getOrigin(): Vec;
  getRotation(): Rotation;
}
interface Motion {
  getWorldTransform(t: Transform): void;
}
interface Shape {
  setMargin(n: number): void;
  setLocalScaling(v: Vec): void;
  calculateLocalInertia(m: number, v: Vec): void;
}
interface Body {
  getMotionState(): Motion | null;
}
interface World {
  setGravity(v: Vec): void;
  addRigidBody(b: Body): void;
  removeRigidBody(b: Body): void;
  stepSimulation(dt: number, steps: number): void;
}
interface AmmoRuntime {
  HEAPF32: Float32Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
  destroy(value: object): void;
  btVector3: new (x: number, y: number, z: number) => Vec;
  btTransform: new () => Transform;
  btDefaultCollisionConfiguration: new () => object;
  btCollisionDispatcher: new (c: object) => object;
  btDbvtBroadphase: new () => object;
  btSequentialImpulseConstraintSolver: new () => object;
  btDiscreteDynamicsWorld: new (d: object, b: object, s: object, c: object) => World;
  btHeightfieldTerrainShape: new (
    w: number,
    d: number,
    p: number,
    scale: number,
    min: number,
    max: number,
    axis: number,
    type: string,
    flip: boolean,
  ) => Shape;
  btSphereShape: new (r: number) => Shape;
  btBoxShape: new (v: Vec) => Shape;
  btCylinderShape: new (v: Vec) => Shape;
  btConeShape: new (r: number, h: number) => Shape;
  btDefaultMotionState: new (t: Transform) => Motion;
  btRigidBodyConstructionInfo: new (m: number, state: Motion, shape: Shape, inertia: Vec) => object;
  btRigidBody: new (info: object) => Body;
}
type AmmoFactory = (options: { locateFile(path: string): string }) => Promise<AmmoRuntime>;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing terrain canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) disposed = true;
});
async function start(): Promise<void> {
  if (!("Ammo" in window) || typeof window.Ammo !== "function") throw new Error("Ammo runtime failed to load");
  const factory = window.Ammo as AmmoFactory;
  const A = await factory({ locateFile: (path) => `/examples/libs/${path}` });
  if (disposed) return;
  const owned: object[] = [];
  const own = <T extends object>(value: T): T => {
    owned.push(value);
    return value;
  };
  const vector = (x: number, y: number, z: number): Vec => own(new A.btVector3(x, y, z));
  const config = own(new A.btDefaultCollisionConfiguration());
  const dispatcher = own(new A.btCollisionDispatcher(config));
  const broadphase = own(new A.btDbvtBroadphase());
  const solver = own(new A.btSequentialImpulseConstraintSolver());
  const world = own(new A.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, config));
  world.setGravity(vector(0, -6, 0));
  const transformAux = own(new A.btTransform());
  const heights = new Float32Array(128 * 128);
  for (let z = 0; z < 128; z++)
    for (let x = 0; x < 128; x++) {
      const radius = Math.sqrt(Math.pow((x - 64) / 64, 2.0) + Math.pow((z - 64) / 64, 2.0));
      heights[z * 128 + x] = (Math.sin(radius * 12) + 1) * 0.5 * 10 - 2;
    }
  const ptr = A._malloc(heights.byteLength);
  if (!ptr) throw new Error("Unable to allocate terrain heightfield");
  A.HEAPF32.set(heights, ptr >> 2);
  const groundShape = own(new A.btHeightfieldTerrainShape(128, 128, ptr, 1, -2, 8, 1, "PHY_FLOAT", false));
  groundShape.setLocalScaling(vector(100 / 127, 1, 100 / 127));
  groundShape.setMargin(0.05);
  const bodies: Body[] = [];
  function body(shape: Shape, mass: number, x: number, y: number, z: number): Body {
    const inertia = vector(0, 0, 0);
    if (mass) shape.calculateLocalInertia(mass, inertia);
    const transform = own(new A.btTransform());
    transform.setIdentity();
    transform.setOrigin(vector(x, y, z));
    const motion = own(new A.btDefaultMotionState(transform));
    const info = own(new A.btRigidBodyConstructionInfo(mass, motion, shape, inertia));
    const result = own(new A.btRigidBody(info));
    world.addRigidBody(result);
    bodies.push(result);
    return result;
  }
  body(groundShape, 0, 0, 3, 0);
  const scene = new Scene();
  scene.background = new Color(0xbfd1e5);
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 2000);
  camera.position.set(0, heights[64 + 64 * 128] * 10 + 5, 50);
  camera.lookAt(0, 0, 0);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createShadowMap: WebGLShadowMap,
    shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
  });
  if (!renderer.shadowMap) throw new Error("Missing shadow renderer");
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  const geometry = new PlaneGeometry(100, 100, 127, 127);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position") as BufferAttribute;
  for (let i = 0; i < heights.length; i++) positions.setY(i, heights[i]);
  geometry.computeVertexNormals();
  const material = new MeshPhongMaterial({ color: 0xc7c7c7 });
  const ground = new Mesh(geometry, material);
  ground.castShadow = ground.receiveShadow = true;
  scene.add(ground);
  new TextureLoader().load(
    "/examples/textures/grid.png",
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(127, 127);
      material.map = texture;
      material.needsUpdate = true;
    },
    undefined,
    fail,
  );
  scene.add(new AmbientLight(0xbbbbbb));
  const light = new DirectionalLight(0xffffff, 3);
  light.position.set(100, 100, 50);
  light.castShadow = true;
  light.shadow.camera.left = light.shadow.camera.bottom = -50;
  light.shadow.camera.right = light.shadow.camera.top = 50;
  light.shadow.camera.near = 200 / 30;
  light.shadow.camera.far = 200;
  light.shadow.mapSize.set(2048, 2048);
  scene.add(light);
  const dynamic: { mesh: Mesh; body: Body }[] = [];
  function spawn(): void {
    const type = Math.ceil(Math.random() * 4);
    let shape: Shape, mesh: Mesh;
    const material = (): MeshPhongMaterial => new MeshPhongMaterial({ color: Math.floor(Math.random() * (1 << 24)) });
    if (type === 1) {
      const radius = 1 + Math.random() * 3;
      mesh = new Mesh(new SphereGeometry(radius, 20, 20), material());
      shape = own(new A.btSphereShape(radius));
      shape.setMargin(0.05);
    } else if (type === 2) {
      const sx = 1 + Math.random() * 3,
        sy = 1 + Math.random() * 3,
        sz = 1 + Math.random() * 3;
      mesh = new Mesh(new BoxGeometry(sx, sy, sz, 1, 1, 1), material());
      shape = own(new A.btBoxShape(vector(sx * 0.5, sy * 0.5, sz * 0.5)));
      shape.setMargin(0.05);
    } else if (type === 3) {
      const radius = 1 + Math.random() * 3,
        height = 1 + Math.random() * 3;
      mesh = new Mesh(new CylinderGeometry(radius, radius, height, 20, 1), material());
      shape = own(new A.btCylinderShape(vector(radius, height * 0.5, radius)));
      shape.setMargin(0.05);
    } else {
      const radius = 1 + Math.random() * 3,
        height = 2 + Math.random() * 3;
      mesh = new Mesh(new ConeGeometry(radius, height, 20, 2), material());
      shape = own(new A.btConeShape(radius, height));
    }
    mesh.position.set((Math.random() - 0.5) * 128 * 0.6, 13, (Math.random() - 0.5) * 128 * 0.6);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    dynamic.push({ mesh, body: body(shape, 15, mesh.position.x, mesh.position.y, mesh.position.z) });
  }
  const timer = new Timer();
  timer.connect(document);
  let time = 0,
    next = 3,
    frames = 0;
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
    timer.dispose();
    controls.dispose();
    stats.dom.remove();
    disposeObject(scene);
    light.shadow.dispose();
    renderer.dispose();
    for (const b of bodies) world.removeRigidBody(b);
    for (let i = owned.length - 1; i >= 0; i--) A.destroy(owned[i]);
    A._free(ptr);
  });
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = timer.getDelta();
    if (dynamic.length < 30 && time > next) {
      spawn();
      next = time + 3;
    }
    world.stepSimulation(dt, 10);
    for (const item of dynamic) {
      const motion = item.body.getMotionState();
      if (!motion) continue;
      motion.getWorldTransform(transformAux);
      const p = transformAux.getOrigin(),
        q = transformAux.getRotation();
      item.mesh.position.set(p.x(), p.y(), p.z());
      item.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
    }
    renderer.render(scene, camera);
    time += dt;
    stats.update();
    canvas.dataset.frames = String(++frames);
    if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  });
}
void start().catch(fail);
