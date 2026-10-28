import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import {
  AmmoPhysics,
  type AmmoRuntime,
  type AmmoTransform,
  type AmmoVector,
  type AmmoQuaternion,
} from "../src/addons/physics/AmmoPhysics";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { SphereGeometry } from "../src/geometries/SphereGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Vector3 } from "../src/math/Vector3";
import { InstancedMesh } from "../src/objects/InstancedMesh";
import { Mesh } from "../src/objects/Mesh";
import { Scene } from "../src/scenes/Scene";

class Vec implements AmmoVector {
  constructor(
    private a = 0,
    private b = 0,
    private c = 0,
  ) {}
  x(): number {
    return this.a;
  }
  y(): number {
    return this.b;
  }
  z(): number {
    return this.c;
  }
}
class Quat extends Vec implements AmmoQuaternion {
  constructor(
    x = 0,
    y = 0,
    z = 0,
    private d = 1,
  ) {
    super(x, y, z);
  }
  w(): number {
    return this.d;
  }
}
class Transform implements AmmoTransform {
  origin: AmmoVector = new Vec();
  rotation: AmmoQuaternion = new Quat();
  setIdentity(): void {
    this.origin = new Vec();
    this.rotation = new Quat();
  }
  setOrigin(value: AmmoVector): void {
    this.origin = new Vec(value.x(), value.y(), value.z());
  }
  setRotation(value: AmmoQuaternion): void {
    this.rotation = new Quat(value.x(), value.y(), value.z(), value.w());
  }
  setFromOpenGLMatrix(value: ArrayLike<number>): void {
    this.setOrigin(new Vec(value[12], value[13], value[14]));
  }
  getOrigin(): AmmoVector {
    return this.origin;
  }
  getRotation(): AmmoQuaternion {
    return this.rotation;
  }
  copy(value: AmmoTransform): void {
    this.setOrigin(value.getOrigin());
    this.setRotation(value.getRotation());
  }
}
class Shape {
  margin: number = 0;
  setMargin(value: number): void {
    this.margin = value;
  }
  calculateLocalInertia(_mass: number, _inertia: AmmoVector): void {}
}
class BoxShape extends Shape {
  constructor(readonly half: AmmoVector) {
    super();
  }
}
class SphereShape extends Shape {
  constructor(readonly radius: number) {
    super();
  }
}
class State {
  transform: Transform = new Transform();
  constructor(value: AmmoTransform) {
    this.transform.copy(value);
  }
  getWorldTransform(value: AmmoTransform): void {
    value.setOrigin(this.transform.origin);
    value.setRotation(this.transform.rotation);
  }
}
class Info {
  restitution: number = 0;
  constructor(
    readonly mass: number,
    readonly state: State,
    readonly shape: Shape,
    _inertia: AmmoVector,
  ) {}
  set_m_restitution(value: number): void {
    this.restitution = value;
  }
}
class Body {
  angular: Vec = new Vec(1, 1, 1);
  linear: Vec = new Vec(1, 1, 1);
  constructor(readonly info: Info) {}
  getMotionState(): State {
    return this.info.state;
  }
  setAngularVelocity(value: AmmoVector): void {
    this.angular = new Vec(value.x(), value.y(), value.z());
  }
  setLinearVelocity(value: AmmoVector): void {
    this.linear = new Vec(value.x(), value.y(), value.z());
  }
  setWorldTransform(value: AmmoTransform): void {
    this.info.state.transform.copy(value);
  }
}
class World {
  bodies: Body[] = [];
  removed: Body[] = [];
  steps: number = 0;
  setGravity(_value: AmmoVector): void {}
  addRigidBody(body: Body): void {
    this.bodies.push(body);
  }
  removeRigidBody(body: Body): void {
    this.removed.push(body);
  }
  stepSimulation(_delta: number, _maxSubSteps: number): void {
    this.steps++;
  }
}

test("AmmoPhysics adds scene bodies, synchronizes instances and disposes the simulation", () => {
  vi.useFakeTimers();
  const world = new World();
  const destroyed: object[] = [];
  const runtime: AmmoRuntime = {
    btDefaultCollisionConfiguration: class {},
    btCollisionDispatcher: class {},
    btDbvtBroadphase: class {},
    btSequentialImpulseConstraintSolver: class {},
    btDiscreteDynamicsWorld: class {
      constructor() {
        return world;
      }
    } as unknown as AmmoRuntime["btDiscreteDynamicsWorld"],
    btVector3: Vec,
    btQuaternion: Quat,
    btTransform: Transform,
    btBoxShape: BoxShape,
    btSphereShape: SphereShape,
    btDefaultMotionState: State,
    btRigidBodyConstructionInfo: Info as unknown as AmmoRuntime["btRigidBodyConstructionInfo"],
    btRigidBody: Body as unknown as AmmoRuntime["btRigidBody"],
    destroy: (value) => {
      destroyed.push(value);
    },
  };
  const material = new MeshBasicMaterial();
  const ground = new Mesh(new BoxGeometry(4, 2, 6), material);
  ground.userData.physics = { mass: 0, restitution: 0.25 };
  const instances = new InstancedMesh(new SphereGeometry(0.5), material, 2);
  instances.setMatrixAt(0, new Matrix4().makeTranslation(1, 2, 3));
  instances.setMatrixAt(1, new Matrix4().makeTranslation(4, 5, 6));
  instances.userData.physics = { mass: 1, restitution: 0.75 };
  const scene = new Scene();
  scene.add(ground, instances);
  const physics = AmmoPhysics(runtime);
  try {
    physics.addScene(scene);
    assert.equal(world.bodies.length, 3);
    assert.equal(world.bodies[0].info.mass, 0);
    assert.equal(world.bodies[0].info.restitution, 0.25);
    assert.equal((world.bodies[1].info.shape as SphereShape).radius, 0.5);
    assert.equal(world.bodies[1].info.restitution, 0.75);
    physics.setMeshPosition(instances, new Vector3(7, 8, 9), 1);
    assert.equal(world.bodies[2].linear.x(), 0);
    assert.equal(world.bodies[2].angular.y(), 0);
    vi.advanceTimersByTime(100);
    assert.ok(world.steps > 0);
    assert.deepEqual(Array.from(instances.instanceMatrix.array.slice(28, 31)), [7, 8, 9]);
    assert.throws(() => physics.setMeshPosition(ground, new Vector3()));
    physics.dispose();
    physics.dispose();
    assert.equal(world.removed.length, 3);
    assert.ok(destroyed.includes(world));
    const steps = world.steps;
    vi.advanceTimersByTime(100);
    assert.equal(world.steps, steps);
  } finally {
    physics.dispose();
    vi.useRealTimers();
    instances.dispose();
    ground.geometry.dispose();
    instances.geometry.dispose();
    material.dispose();
  }
});
