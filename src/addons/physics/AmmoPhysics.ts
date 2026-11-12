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
export class AmmoPhysics {
  private ammo: AmmoRuntime;
  private configuration: object;
  private dispatcher: object;
  private broadphase: object;
  private solver: object;
  private world: AmmoWorld;
  private worldTransform: AmmoTransform;
  private entries: { mesh: Mesh; bodies: AmmoBody[] }[];
  private bodiesByMesh: WeakMap<Mesh, AmmoBody[]>;
  private resources: { body: AmmoBody; state: AmmoMotionState }[];
  private shapes: AmmoShape[];
  private disposed: boolean;
  private lastTime: number;
  private interval: ReturnType<typeof setInterval>;

  constructor(ammo: AmmoRuntime) {
    this.ammo = ammo;
    this.configuration = new ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new ammo.btCollisionDispatcher(this.configuration);
    this.broadphase = new ammo.btDbvtBroadphase();
    this.solver = new ammo.btSequentialImpulseConstraintSolver();
    this.world = new ammo.btDiscreteDynamicsWorld(this.dispatcher, this.broadphase, this.solver, this.configuration);
    const gravity = new ammo.btVector3(0, -9.8, 0);
    this.world.setGravity(gravity);
    ammo.destroy(gravity);
    this.worldTransform = new ammo.btTransform();
    this.entries = [];
    this.bodiesByMesh = new WeakMap();
    this.resources = [];
    this.shapes = [];
    this.disposed = false;
    this.lastTime = 0;

    this.addScene = this.addScene.bind(this);
    this.addMesh = this.addMesh.bind(this);
    this.setMeshPosition = this.setMeshPosition.bind(this);
    this.dispose = this.dispose.bind(this);
    this.step = this.step.bind(this);
    this.interval = setInterval(this.step, 1000 / 60);
  }

  addMesh(mesh: Mesh, mass = 0, restitution = 0): void {
    if (this.disposed) throw new Error("AmmoPhysics is disposed");
    const geometry = mesh.geometry;
    let shape: AmmoShape;
    if (geometry instanceof BoxGeometry) {
      const { width, height, depth } = geometry.parameters;
      const size = new this.ammo.btVector3(width / 2, height / 2, depth / 2);
      shape = new this.ammo.btBoxShape(size);
      this.ammo.destroy(size);
    } else if (geometry instanceof SphereGeometry || geometry instanceof IcosahedronGeometry) {
      shape = new this.ammo.btSphereShape(geometry.parameters.radius ?? 1);
    } else {
      console.error("AmmoPhysics: Unsupported geometry type:", geometry.type);
      return;
    }
    shape.setMargin(0.05);
    this.shapes.push(shape);
    const bodies: AmmoBody[] = [];
    const count = mesh instanceof InstancedMesh ? mesh.count : 1;
    for (let i = 0; i < count; i++) {
      const transform = new this.ammo.btTransform();
      if (mesh instanceof InstancedMesh) {
        transform.setFromOpenGLMatrix(mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16));
      } else {
        transform.setIdentity();
        const position = new this.ammo.btVector3(mesh.position.x, mesh.position.y, mesh.position.z);
        const q = mesh.quaternion;
        const rotation = new this.ammo.btQuaternion(q.x, q.y, q.z, q.w);
        transform.setOrigin(position);
        transform.setRotation(rotation);
        this.ammo.destroy(position);
        this.ammo.destroy(rotation);
      }
      const state = new this.ammo.btDefaultMotionState(transform);
      this.ammo.destroy(transform);
      const inertia = new this.ammo.btVector3(0, 0, 0);
      shape.calculateLocalInertia(mass, inertia);
      const info = new this.ammo.btRigidBodyConstructionInfo(mass, state, shape, inertia);
      info.set_m_restitution(restitution);
      const body = new this.ammo.btRigidBody(info);
      this.ammo.destroy(info);
      this.ammo.destroy(inertia);
      this.world.addRigidBody(body);
      bodies.push(body);
      this.resources.push({ body, state });
    }
    if (mass > 0) {
      this.entries.push({ mesh, bodies });
      this.bodiesByMesh.set(mesh, bodies);
    }
  }

  addScene(scene: Object3D): void {
    scene.traverse((child) => {
      if (child instanceof Mesh && child.userData.physics) {
        const physics = child.userData.physics as { mass?: number; restitution?: number };
        this.addMesh(child, physics.mass, physics.restitution);
      }
    });
  }

  setMeshPosition(mesh: Mesh, position: Vector3, index = 0): void {
    const body = this.bodiesByMesh.get(mesh)?.[mesh instanceof InstancedMesh ? index : 0];
    if (this.disposed || body === undefined) throw new Error("AmmoPhysics: mesh or instance is not dynamic");
    const zero = new this.ammo.btVector3(0, 0, 0);
    body.setAngularVelocity(zero);
    body.setLinearVelocity(zero);
    this.ammo.destroy(zero);
    this.worldTransform.setIdentity();
    const origin = new this.ammo.btVector3(position.x, position.y, position.z);
    this.worldTransform.setOrigin(origin);
    this.ammo.destroy(origin);
    body.setWorldTransform(this.worldTransform);
  }

  private step(): void {
    const time = performance.now();
    if (this.lastTime > 0) {
      this.world.stepSimulation((time - this.lastTime) / 1000, 10);
      for (const { mesh, bodies } of this.entries) {
        for (let i = 0; i < bodies.length; i++) {
          bodies[i].getMotionState().getWorldTransform(this.worldTransform);
          const position = this.worldTransform.getOrigin();
          const quaternion = this.worldTransform.getRotation();
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
    this.lastTime = time;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.interval);
    for (const { body, state } of this.resources) {
      this.world.removeRigidBody(body);
      this.ammo.destroy(body);
      this.ammo.destroy(state);
    }
    for (const shape of this.shapes) this.ammo.destroy(shape);
    this.ammo.destroy(this.worldTransform);
    this.ammo.destroy(this.world);
    this.ammo.destroy(this.solver);
    this.ammo.destroy(this.broadphase);
    this.ammo.destroy(this.dispatcher);
    this.ammo.destroy(this.configuration);
    this.entries.length = 0;
    this.resources.length = 0;
    this.shapes.length = 0;
  }
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
