import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { ConvexGeometry } from "ek3d/addons/geometries/ConvexGeometry";
import { ConvexObjectBreaker } from "ek3d/addons/misc/ConvexObjectBreaker";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
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

interface BtVector {
  x(): number;
  y(): number;
  z(): number;
  setValue(x: number, y: number, z: number): void;
  threeObject?: Mesh;
}
interface BtQuaternion {
  x(): number;
  y(): number;
  z(): number;
  w(): number;
}
interface BtTransform {
  setIdentity(): void;
  setOrigin(value: BtVector): void;
  setRotation(value: BtQuaternion): void;
  getOrigin(): BtVector;
  getRotation(): BtQuaternion;
}
interface BtShape {
  setMargin(value: number): void;
  calculateLocalInertia(mass: number, inertia: BtVector): void;
}
interface BtHull extends BtShape {
  addPoint(point: BtVector, recalculate: boolean): void;
}
interface BtMotion {
  getWorldTransform(transform: BtTransform): void;
}
interface BtBody {
  setLinearVelocity(value: BtVector): void;
  setAngularVelocity(value: BtVector): void;
  getLinearVelocity(): BtVector;
  getAngularVelocity(): BtVector;
  setActivationState(value: number): void;
  setUserPointer(value: BtVector): void;
  getUserPointer(): BtVector;
  getMotionState(): BtMotion | null;
}
interface BtContact {
  getDistance(): number;
  getAppliedImpulse(): number;
  get_m_positionWorldOnB(): BtVector;
  get_m_normalWorldOnB(): BtVector;
}
interface BtManifold {
  getBody0(): BtBody;
  getBody1(): BtBody;
  getNumContacts(): number;
  getContactPoint(index: number): BtContact;
}
interface BtDispatcher {
  getNumManifolds(): number;
  getManifoldByIndexInternal(index: number): BtManifold;
}
interface BtWorld {
  setGravity(value: BtVector): void;
  addRigidBody(body: BtBody): void;
  removeRigidBody(body: BtBody): void;
  stepSimulation(delta: number, steps: number): void;
}
interface BtInfo {
  set_m_restitution(value: number): void;
  set_m_friction(value: number): void;
}
interface AmmoRuntime {
  btVector3: new (x: number, y: number, z: number) => BtVector;
  btQuaternion: new (x: number, y: number, z: number, w: number) => BtQuaternion;
  btTransform: new () => BtTransform;
  btDefaultCollisionConfiguration: new () => object;
  btCollisionDispatcher: new (config: object) => BtDispatcher;
  btDbvtBroadphase: new () => object;
  btSequentialImpulseConstraintSolver: new () => object;
  btDiscreteDynamicsWorld: new (
    dispatcher: BtDispatcher,
    broadphase: object,
    solver: object,
    config: object,
  ) => BtWorld;
  btBoxShape: new (halfExtents: BtVector) => BtShape;
  btSphereShape: new (radius: number) => BtShape;
  btConvexHullShape: new () => BtHull;
  btDefaultMotionState: new (transform: BtTransform) => BtMotion;
  btRigidBodyConstructionInfo: new (mass: number, motion: BtMotion, shape: BtShape, inertia: BtVector) => BtInfo;
  btRigidBody: new (info: BtInfo) => BtBody;
  castObject<T>(value: object, type: new (...args: never[]) => T): T;
  destroy(value: object): void;
}
declare const Ammo: (options: { locateFile(path: string): string }) => Promise<AmmoRuntime>;

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing break canvas");
const canvas = selected;
let disposed = false;
canvas.dataset.state = "loading";

async function start(): Promise<void> {
  const ammo = await Ammo({ locateFile: (path) => `/examples/libs/${path}` });
  if (disposed) return;
  const scene = new Scene();
  scene.background = new Color(0xbfd1e5);
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 2000);
  camera.position.set(-14, 8, 16);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    createBackground: WebGLBackground,
    createShadowMap: WebGLShadowMap,
    shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
  });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  if (!renderer.shadowMap) throw new Error("Shadow map unavailable");
  renderer.shadowMap.enabled = true;
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 2, 0);
  controls.update();
  scene.add(new AmbientLight(0xbbbbbb));
  const light = new DirectionalLight(0xffffff, 3);
  light.position.set(-10, 18, 5);
  light.castShadow = true;
  light.shadow.camera.left = light.shadow.camera.bottom = -14;
  light.shadow.camera.right = light.shadow.camera.top = 14;
  light.shadow.camera.near = 2;
  light.shadow.camera.far = 50;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(light);
  const config = new ammo.btDefaultCollisionConfiguration();
  const dispatcher = new ammo.btCollisionDispatcher(config);
  const broadphase = new ammo.btDbvtBroadphase();
  const solver = new ammo.btSequentialImpulseConstraintSolver();
  const world = new ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, config);
  const gravity = new ammo.btVector3(0, -7.8, 0);
  world.setGravity(gravity);
  const transform = new ammo.btTransform();
  const point = new ammo.btVector3(0, 0, 0);
  const breaker = new ConvexObjectBreaker();
  const retiredMaterials = new Set<MeshPhongMaterial>();
  const bodies = new Map<Mesh, { body: BtBody; shape: BtShape; motion: BtMotion; pointer?: BtVector }>();
  const moving = new Set<Mesh>();
  const ballMaterial = new MeshPhongMaterial({ color: 0x202020 });
  const impactPoint = new Vector3(),
    impactNormal = new Vector3();
  const raycaster = new Raycaster(),
    mouse = new Vector2();
  const timer = new Timer();
  timer.connect(document);

  function addBody(object: Mesh, shape: BtShape, mass: number, velocity?: Vector3, angularVelocity?: Vector3): BtBody {
    const initial = new ammo.btTransform();
    initial.setIdentity();
    const p = object.position,
      q = object.quaternion;
    const origin = new ammo.btVector3(p.x, p.y, p.z);
    const rotation = new ammo.btQuaternion(q.x, q.y, q.z, q.w);
    initial.setOrigin(origin);
    initial.setRotation(rotation);
    const motion = new ammo.btDefaultMotionState(initial);
    const inertia = new ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, inertia);
    const info = new ammo.btRigidBodyConstructionInfo(mass, motion, shape, inertia);
    info.set_m_restitution(0.5);
    info.set_m_friction(0.5);
    const body = new ammo.btRigidBody(info);
    if (velocity) {
      const v = new ammo.btVector3(velocity.x, velocity.y, velocity.z);
      body.setLinearVelocity(v);
      ammo.destroy(v);
    }
    if (angularVelocity) {
      const v = new ammo.btVector3(angularVelocity.x, angularVelocity.y, angularVelocity.z);
      body.setAngularVelocity(v);
      ammo.destroy(v);
    }
    ammo.destroy(info);
    ammo.destroy(inertia);
    ammo.destroy(rotation);
    ammo.destroy(origin);
    ammo.destroy(initial);
    scene.add(object);
    world.addRigidBody(body);
    bodies.set(object, { body, shape, motion });
    if (mass > 0) {
      moving.add(object);
      body.setActivationState(4);
    }
    return body;
  }
  function addDebris(object: Mesh): void {
    object.castShadow = object.receiveShadow = true;
    const shape = new ammo.btConvexHullShape();
    const positions = object.geometry.getAttribute("position");
    if (!(positions instanceof BufferAttribute)) throw new Error("Missing fracture positions");
    if (object.material instanceof MeshPhongMaterial) retiredMaterials.add(object.material);
    for (let i = 0; i < positions.count; i++) {
      point.setValue(positions.getX(i), positions.getY(i), positions.getZ(i));
      shape.addPoint(point, i === positions.count - 1);
    }
    shape.setMargin(0.05);
    const body = addBody(
      object,
      shape,
      object.userData.mass,
      object.userData.velocity,
      object.userData.angularVelocity,
    );
    const pointer = new ammo.btVector3(0, 0, 0);
    pointer.threeObject = object;
    body.setUserPointer(pointer);
    const entry = bodies.get(object);
    if (entry) entry.pointer = pointer;
  }
  function remove(object: Mesh, disposeGeometry = true): void {
    const entry = bodies.get(object);
    if (!entry) return;
    world.removeRigidBody(entry.body);
    scene.remove(object);
    moving.delete(object);
    bodies.delete(object);
    ammo.destroy(entry.body);
    ammo.destroy(entry.motion);
    ammo.destroy(entry.shape);
    if (entry.pointer) ammo.destroy(entry.pointer);
    if (disposeGeometry) object.geometry.dispose();
  }
  function box(mass: number, half: Vector3, position: Vector3, color: number): void {
    const mesh = new Mesh(new BoxGeometry(half.x * 2, half.y * 2, half.z * 2), new MeshPhongMaterial({ color }));
    mesh.position.copy(position);
    breaker.prepareBreakableObject(mesh, mass, new Vector3(), new Vector3(), true);
    addDebris(mesh);
  }
  const ground = new Mesh<MeshPhongMaterial>(new BoxGeometry(40, 1, 40), new MeshPhongMaterial({ color: 0xffffff }));
  ground.position.set(0, -0.5, 0);
  ground.receiveShadow = true;
  const halfGround = new ammo.btVector3(20, 0.5, 20);
  const groundShape = new ammo.btBoxShape(halfGround);
  ammo.destroy(halfGround);
  groundShape.setMargin(0.05);
  addBody(ground, groundShape, 0);
  new TextureLoader().load(
    "/examples/textures/grid.png",
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(40, 40);
      ground.material.map = texture;
      ground.material.needsUpdate = true;
    },
    undefined,
    (error) => {
      if (!disposed) {
        canvas.dataset.state = "error";
        console.error(error);
      }
    },
  );
  box(1000, new Vector3(2, 5, 2), new Vector3(-8, 5, 0), 0xb03014);
  box(1000, new Vector3(2, 5, 2), new Vector3(8, 5, 0), 0xb03214);
  box(100, new Vector3(7, 0.2, 1.5), new Vector3(0, 10.2, 0), 0xb3b865);
  for (let i = 0; i < 8; i++) box(120, new Vector3(1, 2, 0.15), new Vector3(0, 2, 15 * (0.5 - i / 9)), 0xb0b0b0);
  const mountain = new Mesh(
    new ConvexGeometry([
      new Vector3(4, -5, 4),
      new Vector3(-4, -5, 4),
      new Vector3(4, -5, -4),
      new Vector3(-4, -5, -4),
      new Vector3(0, 5, 0),
    ]),
    new MeshPhongMaterial({ color: 0xb03814 }),
  );
  mountain.position.set(5, 2.5, -7);
  breaker.prepareBreakableObject(mountain, 860, new Vector3(), new Vector3(), true);
  addDebris(mountain);

  function onPointer(event: PointerEvent): void {
    mouse.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const ball = new Mesh(new SphereGeometry(0.4, 14, 10), ballMaterial);
    ball.castShadow = ball.receiveShadow = true;
    ball.position.copy(raycaster.ray.origin).add(raycaster.ray.direction);
    const shape = new ammo.btSphereShape(0.4);
    shape.setMargin(0.05);
    const body = addBody(ball, shape, 35);
    const direction = raycaster.ray.direction;
    const velocity = new ammo.btVector3(direction.x * 24, direction.y * 24, direction.z * 24);
    body.setLinearVelocity(velocity);
    ammo.destroy(velocity);
  }
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  function update(delta: number): void {
    world.stepSimulation(delta, 10);
    for (const object of moving) {
      const motion = bodies.get(object)?.body.getMotionState();
      if (!motion) continue;
      motion.getWorldTransform(transform);
      const p = transform.getOrigin(),
        q = transform.getRotation();
      object.position.set(p.x(), p.y(), p.z());
      object.quaternion.set(q.x(), q.y(), q.z(), q.w());
      object.userData.collided = false;
    }
    const removed: Mesh[] = [];
    for (let i = 0; i < dispatcher.getNumManifolds(); i++) {
      const manifold = dispatcher.getManifoldByIndexInternal(i);
      const first = ammo.castObject(manifold.getBody0(), ammo.btRigidBody);
      const second = ammo.castObject(manifold.getBody1(), ammo.btRigidBody);
      const a = ammo.castObject(first.getUserPointer(), ammo.btVector3).threeObject;
      const b = ammo.castObject(second.getUserPointer(), ammo.btVector3).threeObject;
      if (!a && !b) continue;
      if ((!a?.userData.breakable && !b?.userData.breakable) || (a?.userData.collided && b?.userData.collided))
        continue;
      let impulse = 0;
      for (let j = 0; j < manifold.getNumContacts(); j++) {
        const contact = manifold.getContactPoint(j);
        if (contact.getDistance() < 0) {
          impulse = contact.getAppliedImpulse();
          const p = contact.get_m_positionWorldOnB(),
            n = contact.get_m_normalWorldOnB();
          impactPoint.set(p.x(), p.y(), p.z());
          impactNormal.set(n.x(), n.y(), n.z());
          break;
        }
      }
      if (impulse <= 250) continue;
      for (const [object, body] of [
        [a, first],
        [b, second],
      ] as const) {
        if (!object || !object.userData.breakable || object.userData.collided) continue;
        for (const fragment of breaker.subdivideByImpact(object, impactPoint, impactNormal, 1, 2)) {
          const v = body.getLinearVelocity(),
            w = body.getAngularVelocity();
          fragment.userData.velocity.set(v.x(), v.y(), v.z());
          fragment.userData.angularVelocity.set(w.x(), w.y(), w.z());
          addDebris(fragment);
        }
        object.userData.collided = true;
        removed.push(object);
      }
    }
    for (const object of removed) remove(object);
  }
  window.addEventListener("pointerdown", onPointer);
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    renderer.setAnimationLoop(null);
    window.removeEventListener("pointerdown", onPointer);
    window.removeEventListener("resize", resize);
    timer.dispose();
    controls.dispose();
    light.shadow.dispose();
    stats.dom.remove();
    disposeObject(scene, retiredMaterials);
    for (const object of bodies.keys()) remove(object, false);
    ammo.destroy(point);
    ammo.destroy(transform);
    ammo.destroy(gravity);
    ammo.destroy(world);
    ammo.destroy(solver);
    ammo.destroy(broadphase);
    ammo.destroy(dispatcher);
    ammo.destroy(config);
    renderer.dispose();
  });
  canvas.dataset.state = "ready";
  renderer.setAnimationLoop(() => {
    timer.update();
    update(timer.getDelta());
    renderer.render(scene, camera);
    stats.update();
  });
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) disposed = true;
});
start().catch((error: unknown) => {
  if (!disposed) {
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  }
});
