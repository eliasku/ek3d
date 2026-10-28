import { BoxGeometry } from "../../geometries/BoxGeometry";
import { IcosahedronGeometry } from "../../geometries/IcosahedronGeometry";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import type { Object3D } from "../../core/Object3D";
import type { Vector3 } from "../../math/Vector3";
import { Mesh } from "../../objects/Mesh";
import { InstancedMesh } from "../../objects/InstancedMesh";

export interface AmmoVector {
  x(): number;
  y(): number;
  z(): number;
}
export interface AmmoQuaternion extends AmmoVector {
  w(): number;
}
export interface AmmoTransform {
  setIdentity(): void;
  setOrigin(value: AmmoVector): void;
  setRotation(value: AmmoQuaternion): void;
  setFromOpenGLMatrix(value: ArrayLike<number>): void;
  getOrigin(): AmmoVector;
  getRotation(): AmmoQuaternion;
}
export interface AmmoShape {
  setMargin(value: number): void;
  calculateLocalInertia(mass: number, inertia: AmmoVector): void;
}
export interface AmmoMotionState {
  getWorldTransform(transform: AmmoTransform): void;
}
export interface AmmoBody {
  getMotionState(): AmmoMotionState;
  setAngularVelocity(value: AmmoVector): void;
  setLinearVelocity(value: AmmoVector): void;
  setWorldTransform(value: AmmoTransform): void;
}
export interface AmmoWorld {
  setGravity(value: AmmoVector): void;
  addRigidBody(body: AmmoBody): void;
  removeRigidBody(body: AmmoBody): void;
  stepSimulation(delta: number, maxSubSteps: number): void;
}
export interface AmmoRuntime {
  btDefaultCollisionConfiguration: new () => object;
  btCollisionDispatcher: new (configuration: object) => object;
  btDbvtBroadphase: new () => object;
  btSequentialImpulseConstraintSolver: new () => object;
  btDiscreteDynamicsWorld: new (
    dispatcher: object,
    broadphase: object,
    solver: object,
    configuration: object,
  ) => AmmoWorld;
  btVector3: new (x: number, y: number, z: number) => AmmoVector;
  btQuaternion: new (x: number, y: number, z: number, w: number) => AmmoQuaternion;
  btTransform: new () => AmmoTransform;
  btBoxShape: new (halfExtents: AmmoVector) => AmmoShape;
  btSphereShape: new (radius: number) => AmmoShape;
  btDefaultMotionState: new (transform: AmmoTransform) => AmmoMotionState;
  btRigidBodyConstructionInfo: new (
    mass: number,
    state: AmmoMotionState,
    shape: AmmoShape,
    inertia: AmmoVector,
  ) => { set_m_restitution(value: number): void };
  btRigidBody: new (info: { set_m_restitution(value: number): void }) => AmmoBody;
  destroy(value: object): void;
}

/** Creates an Ammo simulation using a caller-provided initialized runtime. */
export function AmmoPhysics(ammo: AmmoRuntime): {
  addScene(scene: Object3D): void;
  addMesh(mesh: Mesh, mass?: number, restitution?: number): void;
  setMeshPosition(mesh: Mesh, position: Vector3, index?: number): void;
  dispose(): void;
} {
  const configuration = new ammo.btDefaultCollisionConfiguration();
  const dispatcher = new ammo.btCollisionDispatcher(configuration);
  const broadphase = new ammo.btDbvtBroadphase();
  const solver = new ammo.btSequentialImpulseConstraintSolver();
  const world = new ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const gravity = new ammo.btVector3(0, -9.8, 0);
  world.setGravity(gravity);
  ammo.destroy(gravity);
  const worldTransform = new ammo.btTransform();
  const entries: { mesh: Mesh; bodies: AmmoBody[] }[] = [];
  const bodiesByMesh = new WeakMap<Mesh, AmmoBody[]>();
  const resources: { body: AmmoBody; state: AmmoMotionState }[] = [];
  const shapes: AmmoShape[] = [];
  let disposed = false;

  function addMesh(mesh: Mesh, mass = 0, restitution = 0): void {
    if (disposed) throw new Error("AmmoPhysics is disposed");
    const geometry = mesh.geometry;
    let shape: AmmoShape;
    if (geometry instanceof BoxGeometry) {
      const { width, height, depth } = geometry.parameters;
      const size = new ammo.btVector3(width / 2, height / 2, depth / 2);
      shape = new ammo.btBoxShape(size);
      ammo.destroy(size);
    } else if (geometry instanceof SphereGeometry || geometry instanceof IcosahedronGeometry) {
      shape = new ammo.btSphereShape(geometry.parameters.radius ?? 1);
    } else {
      console.error("AmmoPhysics: Unsupported geometry type:", geometry.type);
      return;
    }
    shape.setMargin(0.05);
    shapes.push(shape);
    const bodies: AmmoBody[] = [];
    const count = mesh instanceof InstancedMesh ? mesh.count : 1;
    for (let i = 0; i < count; i++) {
      const transform = new ammo.btTransform();
      if (mesh instanceof InstancedMesh) {
        transform.setFromOpenGLMatrix(mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16));
      } else {
        transform.setIdentity();
        const position = new ammo.btVector3(mesh.position.x, mesh.position.y, mesh.position.z);
        const q = mesh.quaternion;
        const rotation = new ammo.btQuaternion(q.x, q.y, q.z, q.w);
        transform.setOrigin(position);
        transform.setRotation(rotation);
        ammo.destroy(position);
        ammo.destroy(rotation);
      }
      const state = new ammo.btDefaultMotionState(transform);
      ammo.destroy(transform);
      const inertia = new ammo.btVector3(0, 0, 0);
      shape.calculateLocalInertia(mass, inertia);
      const info = new ammo.btRigidBodyConstructionInfo(mass, state, shape, inertia);
      info.set_m_restitution(restitution);
      const body = new ammo.btRigidBody(info);
      ammo.destroy(info);
      ammo.destroy(inertia);
      world.addRigidBody(body);
      bodies.push(body);
      resources.push({ body, state });
    }
    if (mass > 0) {
      entries.push({ mesh, bodies });
      bodiesByMesh.set(mesh, bodies);
    }
  }
  function addScene(scene: Object3D): void {
    scene.traverse((child) => {
      if (child instanceof Mesh && child.userData.physics) {
        const physics = child.userData.physics as { mass?: number; restitution?: number };
        addMesh(child, physics.mass, physics.restitution);
      }
    });
  }
  function setMeshPosition(mesh: Mesh, position: Vector3, index = 0): void {
    const body = bodiesByMesh.get(mesh)?.[mesh instanceof InstancedMesh ? index : 0];
    if (disposed || body === undefined) throw new Error("AmmoPhysics: mesh or instance is not dynamic");
    const zero = new ammo.btVector3(0, 0, 0);
    body.setAngularVelocity(zero);
    body.setLinearVelocity(zero);
    ammo.destroy(zero);
    worldTransform.setIdentity();
    const origin = new ammo.btVector3(position.x, position.y, position.z);
    worldTransform.setOrigin(origin);
    ammo.destroy(origin);
    body.setWorldTransform(worldTransform);
  }
  let lastTime = 0;
  const interval = setInterval(() => {
    const time = performance.now();
    if (lastTime > 0) {
      world.stepSimulation((time - lastTime) / 1000, 10);
      for (const { mesh, bodies } of entries) {
        for (let i = 0; i < bodies.length; i++) {
          bodies[i].getMotionState().getWorldTransform(worldTransform);
          const position = worldTransform.getOrigin();
          const quaternion = worldTransform.getRotation();
          if (mesh instanceof InstancedMesh) {
            compose(position, quaternion, mesh.instanceMatrix.array, i * 16);
          } else {
            mesh.position.set(position.x(), position.y(), position.z());
            mesh.quaternion.set(quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
          }
        }
        if (mesh instanceof InstancedMesh) {
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }
      }
    }
    lastTime = time;
  }, 1000 / 60);
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    clearInterval(interval);
    for (const { body, state } of resources) {
      world.removeRigidBody(body);
      ammo.destroy(body);
      ammo.destroy(state);
    }
    for (const shape of shapes) ammo.destroy(shape);
    ammo.destroy(worldTransform);
    ammo.destroy(world);
    ammo.destroy(solver);
    ammo.destroy(broadphase);
    ammo.destroy(dispatcher);
    ammo.destroy(configuration);
    entries.length = 0;
    resources.length = 0;
    shapes.length = 0;
  }
  return { addScene, addMesh, setMeshPosition, dispose };
}

function compose(
  position: AmmoVector,
  quaternion: AmmoQuaternion,
  array: { [index: number]: number },
  index: number,
): void {
  const x = quaternion.x(),
    y = quaternion.y(),
    z = quaternion.z(),
    w = quaternion.w();
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2;
  const yy = y * y2,
    yz = y * z2,
    zz = z * z2;
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2;
  array[index] = 1 - (yy + zz);
  array[index + 1] = xy + wz;
  array[index + 2] = xz - wy;
  array[index + 3] = 0;
  array[index + 4] = xy - wz;
  array[index + 5] = 1 - (xx + zz);
  array[index + 6] = yz + wx;
  array[index + 7] = 0;
  array[index + 8] = xz + wy;
  array[index + 9] = yz - wx;
  array[index + 10] = 1 - (xx + yy);
  array[index + 11] = 0;
  array[index + 12] = position.x();
  array[index + 13] = position.y();
  array[index + 14] = position.z();
  array[index + 15] = 1;
}
