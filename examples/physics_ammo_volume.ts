import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { mergeVertices } from "ek3d/addons/utils/BufferGeometryUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Quaternion } from "ek3d/math/Quaternion";
import { Raycaster } from "ek3d/core/Raycaster";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
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
  setRotation(q: Rotation): void;
  getOrigin(): Vec;
  getRotation(): Rotation;
}
interface Motion {
  getWorldTransform(t: Transform): void;
}
interface Shape {
  setMargin(n: number): void;
  calculateLocalInertia(m: number, v: Vec): void;
}
interface RigidBody {
  getMotionState(): Motion | null;
  setActivationState(n: number): void;
  setFriction(n: number): void;
  setLinearVelocity(v: Vec): void;
}
interface Node {
  get_m_x(): Vec;
  get_m_n(): Vec;
}
interface SoftBody {
  get_m_cfg(): {
    set_viterations(n: number): void;
    set_piterations(n: number): void;
    set_collisions(n: number): void;
    set_kDF(n: number): void;
    set_kDP(n: number): void;
    set_kPR(n: number): void;
  };
  get_m_materials(): { at(i: number): { set_m_kLST(n: number): void; set_m_kAST(n: number): void } };
  get_m_nodes(): { at(i: number): Node };
  setTotalMass(n: number, fromFaces: boolean): void;
  setActivationState(n: number): void;
}
interface WorldInfo {
  set_m_gravity(v: Vec): void;
}
interface World {
  setGravity(v: Vec): void;
  getWorldInfo(): WorldInfo;
  addRigidBody(b: RigidBody): void;
  removeRigidBody(b: RigidBody): void;
  addSoftBody(b: SoftBody, group: number, mask: number): void;
  removeSoftBody(b: SoftBody): void;
  stepSimulation(dt: number, steps: number): void;
}
interface AmmoRuntime {
  destroy(value: object): void;
  btVector3: new (x: number, y: number, z: number) => Vec;
  btQuaternion: new (x: number, y: number, z: number, w: number) => Rotation;
  btTransform: new () => Transform;
  btSoftBodyRigidBodyCollisionConfiguration: new () => object;
  btCollisionDispatcher: new (c: object) => object;
  btDbvtBroadphase: new () => object;
  btSequentialImpulseConstraintSolver: new () => object;
  btDefaultSoftBodySolver: new () => object;
  btSoftRigidDynamicsWorld: new (d: object, b: object, s: object, c: object, ss: object) => World;
  btSoftBodyHelpers: new () => {
    CreateFromTriMesh(
      info: WorldInfo,
      vertices: ArrayLike<number>,
      indices: ArrayLike<number>,
      count: number,
      randomize: boolean,
    ): SoftBody;
  };
  btBoxShape: new (v: Vec) => Shape;
  btSphereShape: new (r: number) => Shape;
  btDefaultMotionState: new (t: Transform) => Motion;
  btRigidBodyConstructionInfo: new (m: number, state: Motion, shape: Shape, inertia: Vec) => object;
  btRigidBody: new (info: object) => RigidBody;
  btCollisionObject: object;
  castObject(body: SoftBody, type: object): { getCollisionShape(): Shape };
}
type AmmoFactory = (options: { locateFile(path: string): string }) => Promise<AmmoRuntime>;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing volume canvas");
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
  const config = own(new A.btSoftBodyRigidBodyCollisionConfiguration());
  const dispatcher = own(new A.btCollisionDispatcher(config));
  const broadphase = own(new A.btDbvtBroadphase());
  const solver = own(new A.btSequentialImpulseConstraintSolver());
  const softSolver = own(new A.btDefaultSoftBodySolver());
  const world = own(new A.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, config, softSolver));
  world.setGravity(vector(0, -9.8, 0));
  world.getWorldInfo().set_m_gravity(vector(0, -9.8, 0));
  const aux = own(new A.btTransform());
  const helpers = own(new A.btSoftBodyHelpers());
  const scene = new Scene();
  scene.background = new Color(0xbfd1e5);
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 2000);
  camera.position.set(-7, 5, 8);
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
  controls.target.set(0, 2, 0);
  controls.update();
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  scene.add(new AmbientLight(0xbbbbbb));
  const light = new DirectionalLight(0xffffff, 3);
  light.position.set(-10, 10, 5);
  light.castShadow = true;
  light.shadow.camera.left = light.shadow.camera.bottom = -20;
  light.shadow.camera.right = light.shadow.camera.top = 20;
  light.shadow.camera.near = 2;
  light.shadow.camera.far = 50;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(light);
  const loader = new TextureLoader();
  const rigid: { mesh: Mesh; body: RigidBody }[] = [];
  const allRigid: RigidBody[] = [];
  const soft: { mesh: Mesh; body: SoftBody; association: number[][] }[] = [];
  function addRigid(mesh: Mesh, shape: Shape, mass: number, position: Vector3, rotation: Quaternion): RigidBody {
    mesh.position.copy(position);
    mesh.quaternion.copy(rotation);
    scene.add(mesh);
    const transform = own(new A.btTransform());
    transform.setIdentity();
    transform.setOrigin(vector(position.x, position.y, position.z));
    transform.setRotation(own(new A.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w)));
    const motion = own(new A.btDefaultMotionState(transform));
    const inertia = vector(0, 0, 0);
    shape.calculateLocalInertia(mass, inertia);
    const info = own(new A.btRigidBodyConstructionInfo(mass, motion, shape, inertia));
    const body = own(new A.btRigidBody(info));
    world.addRigidBody(body);
    allRigid.push(body);
    if (mass > 0) {
      body.setActivationState(4);
      rigid.push({ mesh, body });
    }
    return body;
  }
  function box(
    sx: number,
    sy: number,
    sz: number,
    position: Vector3,
    rotation: Quaternion,
    color: number,
  ): Mesh<MeshPhongMaterial> {
    const mesh = new Mesh<MeshPhongMaterial>(new BoxGeometry(sx, sy, sz), new MeshPhongMaterial({ color }));
    mesh.castShadow = mesh.receiveShadow = true;
    const shape = own(new A.btBoxShape(vector(sx / 2, sy / 2, sz / 2)));
    shape.setMargin(0.05);
    addRigid(mesh, shape, 0, position, rotation);
    return mesh;
  }
  const ground = box(40, 1, 40, new Vector3(0, -0.5, 0), new Quaternion(), 0xffffff);
  loader.load(
    "/examples/textures/grid.png",
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(40, 40);
      ground.material.map = texture;
      ground.material.needsUpdate = true;
    },
    undefined,
    fail,
  );
  function volume(geometry: BufferGeometry, pressure: number): void {
    const original = geometry.getAttribute("position") as BufferAttribute;
    const positionOnly = new BufferGeometry();
    positionOnly.setAttribute("position", original);
    const sourceIndex = geometry.getIndex();
    if (sourceIndex) positionOnly.setIndex(sourceIndex);
    const indexed = mergeVertices(positionOnly);
    const indices = indexed.getIndex();
    if (!indices) throw new Error("Unable to index volume geometry");
    const vertices = indexed.getAttribute("position") as BufferAttribute;
    const association: number[][] = [];
    for (let i = 0; i < vertices.count; i++) {
      const matches: number[] = [];
      association.push(matches);
      for (let j = 0; j < original.count; j++) {
        if (
          Math.abs(vertices.getX(i) - original.getX(j)) < 0.000001 &&
          Math.abs(vertices.getY(i) - original.getY(j)) < 0.000001 &&
          Math.abs(vertices.getZ(i) - original.getZ(j)) < 0.000001
        )
          matches.push(j);
      }
    }
    const mesh = new Mesh<MeshPhongMaterial>(geometry, new MeshPhongMaterial({ color: 0xffffff }));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    loader.load(
      "/examples/textures/colors.png",
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      },
      undefined,
      fail,
    );
    const body = own(
      helpers.CreateFromTriMesh(world.getWorldInfo(), vertices.array, indices.array, indices.count / 3, true),
    );
    positionOnly.dispose();
    indexed.dispose();
    const cfg = body.get_m_cfg();
    cfg.set_viterations(40);
    cfg.set_piterations(40);
    cfg.set_collisions(0x11);
    cfg.set_kDF(0.1);
    cfg.set_kDP(0.01);
    cfg.set_kPR(pressure);
    const material = body.get_m_materials().at(0);
    material.set_m_kLST(0.9);
    material.set_m_kAST(0.9);
    body.setTotalMass(15, false);
    A.castObject(body, A.btCollisionObject).getCollisionShape().setMargin(0.05);
    world.addSoftBody(body, 1, -1);
    body.setActivationState(4);
    soft.push({ mesh, body, association });
  }
  const sphere = new SphereGeometry(1.5, 40, 25);
  sphere.translate(5, 5, 0);
  volume(sphere, 250);
  const cuboid = new BoxGeometry(1, 1, 5, 4, 4, 20);
  cuboid.translate(-2, 5, 0);
  volume(cuboid, 120);
  box(10, 1, 4, new Vector3(3, 1, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 6), 0x606060);
  const raycaster = new Raycaster(),
    mouse = new Vector2(),
    ballMaterial = new MeshPhongMaterial({ color: 0x202020 });
  let click = false;
  function pointer(event: PointerEvent): void {
    if (!click) {
      mouse.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
      click = true;
    }
  }
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("pointerdown", pointer);
  window.addEventListener("resize", resize);
  const timer = new Timer();
  timer.connect(document);
  let frames = 0;
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointerdown", pointer);
    renderer.setAnimationLoop(null);
    timer.dispose();
    controls.dispose();
    stats.dom.remove();
    disposeObject(scene, [ballMaterial]);
    light.shadow.dispose();
    renderer.dispose();
    for (const body of allRigid) world.removeRigidBody(body);
    for (const item of soft) world.removeSoftBody(item.body);
    for (let i = owned.length - 1; i >= 0; i--) A.destroy(owned[i]);
  });
  renderer.setAnimationLoop(() => {
    timer.update();
    world.stepSimulation(timer.getDelta(), 10);
    for (const item of soft) {
      const positions = item.mesh.geometry.getAttribute("position") as BufferAttribute;
      const normals = item.mesh.geometry.getAttribute("normal") as BufferAttribute,
        nodes = item.body.get_m_nodes();
      for (let i = 0; i < item.association.length; i++) {
        const node = nodes.at(i),
          p = node.get_m_x(),
          n = node.get_m_n();
        for (const j of item.association[i]) {
          positions.setXYZ(j, p.x(), p.y(), p.z());
          normals.setXYZ(j, n.x(), n.y(), n.z());
        }
      }
      positions.needsUpdate = true;
      normals.needsUpdate = true;
    }
    for (const item of rigid) {
      const motion = item.body.getMotionState();
      if (!motion) continue;
      motion.getWorldTransform(aux);
      const p = aux.getOrigin(),
        q = aux.getRotation();
      item.mesh.position.set(p.x(), p.y(), p.z());
      item.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
    }
    if (click) {
      raycaster.setFromCamera(mouse, camera);
      const ball = new Mesh(new SphereGeometry(0.4, 18, 16), ballMaterial);
      ball.castShadow = ball.receiveShadow = true;
      const shape = own(new A.btSphereShape(0.4));
      shape.setMargin(0.05);
      const position = raycaster.ray.origin.clone().add(raycaster.ray.direction);
      const body = addRigid(ball, shape, 3, position, new Quaternion());
      body.setFriction(0.5);
      const velocity = raycaster.ray.direction.clone().multiplyScalar(14);
      body.setLinearVelocity(vector(velocity.x, velocity.y, velocity.z));
      click = false;
    }
    renderer.render(scene, camera);
    stats.update();
    canvas.dataset.frames = String(++frames);
    if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  });
}
void start().catch(fail);
