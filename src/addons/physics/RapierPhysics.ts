import { Timer } from "../../core/Timer";
import { GLBufferAttribute } from "../../core/GLBufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Object3D } from "../../core/Object3D";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";
import { InstancedMesh } from "../../objects/InstancedMesh";
import { Mesh } from "../../objects/Mesh";

export interface RapierVector {
  x: number;
  y: number;
  z: number;
}
export interface RapierRotation extends RapierVector {
  w: number;
}
export interface RapierBody {
  translation(): RapierVector;
  linvel(): RapierVector;
  rotation(): RapierRotation;
  setTranslation(value: RapierVector, wake: boolean): void;
  setRotation(value: RapierRotation, wake: boolean): void;
  setLinvel(value: RapierVector, wake: boolean): void;
  setAngvel(value: RapierVector, wake: boolean): void;
  applyImpulse(value: RapierVector, wake: boolean): void;
  setAngularDamping(value: number): void;
  isSleeping(): boolean;
  wakeUp(): void;
}
export interface RapierCollider {
  translation(): RapierVector;
  setTranslation(value: RapierVector): void;
}
export interface RapierColliderDesc {
  setMass(value: number): RapierColliderDesc;
  setRestitution(value: number): RapierColliderDesc;
  setTranslation(x: number, y: number, z: number): RapierColliderDesc;
}
export interface RapierBodyDesc {
  setTranslation(x: number, y: number, z: number): RapierBodyDesc;
  setRotation(value: RapierRotation): RapierBodyDesc;
}
export interface RapierCharacterController {
  setApplyImpulsesToDynamicBodies(value: boolean): void;
  setCharacterMass(value: number): void;
  computeColliderMovement(collider: RapierCollider, translation: RapierVector): void;
  computedMovement(): RapierVector;
}
export interface RapierVehicleController {
  addWheel(
    position: RapierVector,
    direction: RapierVector,
    axle: RapierVector,
    restLength: number,
    radius: number,
  ): void;
  setWheelSuspensionStiffness(index: number, value: number): void;
  setWheelFrictionSlip(index: number, value: number): void;
  setWheelSteering(index: number, value: number): void;
  setWheelEngineForce(index: number, value: number): void;
  setWheelBrake(index: number, value: number): void;
  wheelAxleCs(index: number): RapierVector | null;
  wheelChassisConnectionPointCs(index: number): RapierVector | null;
  wheelSuspensionLength(index: number): number | null;
  wheelSteering(index: number): number | null;
  wheelRotation(index: number): number | null;
  updateVehicle(delta: number): void;
}
export interface RapierWorld {
  timestep: number;
  createRigidBody(desc: RapierBodyDesc): RapierBody;
  createCollider(desc: RapierColliderDesc, body?: RapierBody): RapierCollider;
  removeRigidBody(body: RapierBody): void;
  removeCollider(collider: RapierCollider, wakeUp: boolean): void;
  createImpulseJoint(data: object, body1: RapierBody, body2: RapierBody, wakeUp: boolean): object;
  createCharacterController(offset: number): RapierCharacterController;
  removeCharacterController(controller: RapierCharacterController): void;
  createVehicleController(body: RapierBody): RapierVehicleController;
  removeVehicleController(controller: RapierVehicleController): void;
  debugRender(): { vertices: Float32Array; colors: Float32Array };
  step(): void;
  free(): void;
}
export interface RapierRuntime {
  World: new (gravity: RapierVector) => RapierWorld;
  Vector3: new (x: number, y: number, z: number) => RapierVector;
  Quaternion: new (x: number, y: number, z: number, w: number) => RapierRotation;
  RigidBodyDesc: { dynamic(): RapierBodyDesc; fixed(): RapierBodyDesc };
  ColliderDesc: {
    roundCuboid(x: number, y: number, z: number, radius: number): RapierColliderDesc;
    cuboid(x: number, y: number, z: number): RapierColliderDesc;
    ball(radius: number): RapierColliderDesc;
    cylinder(halfHeight: number, radius: number): RapierColliderDesc;
    capsule(halfHeight: number, radius: number): RapierColliderDesc;
    trimesh(vertices: Float32Array, indices: Uint32Array): RapierColliderDesc;
    heightfield(width: number, depth: number, heights: Float32Array, scale: RapierVector): RapierColliderDesc;
  };
  JointData: { spherical(anchor1: RapierVector, anchor2: RapierVector): object };
}

/** Creates a Rapier world using an initialized, caller-owned runtime. */
export class RapierPhysics {
  RAPIER: RapierRuntime;
  world: RapierWorld;
  // Reassigning exposed references must not replace the simulation's captured state.
  private runtime: RapierRuntime;
  private simulation: RapierWorld;
  private entries: Map<Mesh, { bodies: RapierBody[]; colliders: RapierCollider[]; dynamic: boolean }>;
  private timer: Timer;
  private matrix: Matrix4;
  private position: Vector3;
  private rotation: Quaternion;
  private scale: Vector3;
  private zero: RapierVector;
  private disposed: boolean;
  private interval: ReturnType<typeof setInterval>;

  constructor(RAPIER: RapierRuntime) {
    this.runtime = RAPIER;
    this.simulation = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.entries = new Map();
    this.timer = new Timer();
    this.matrix = new Matrix4();
    this.position = new Vector3();
    this.rotation = new Quaternion();
    this.scale = new Vector3();
    this.zero = { x: 0, y: 0, z: 0 };
    this.disposed = false;

    this.addScene = this.addScene.bind(this);
    this.addMesh = this.addMesh.bind(this);
    this.removeMesh = this.removeMesh.bind(this);
    this.setMeshPosition = this.setMeshPosition.bind(this);
    this.setMeshVelocity = this.setMeshVelocity.bind(this);
    this.applyImpulse = this.applyImpulse.bind(this);
    this.addHeightfield = this.addHeightfield.bind(this);
    this.step = this.step.bind(this);
    this.dispose = this.dispose.bind(this);
    this.interval = setInterval(this.step, 1000 / 60);
    this.RAPIER = RAPIER;
    this.world = this.simulation;
  }

  private shapeFor(geometry: BufferGeometry): RapierColliderDesc | null {
    const p = (geometry as BufferGeometry & { parameters?: Record<string, number> }).parameters ?? {};
    switch (geometry.type) {
      case "RoundedBoxGeometry": {
        const r = p.radius ?? 0.1;
        return this.runtime.ColliderDesc.roundCuboid(
          (p.width ?? 1) / 2 - r,
          (p.height ?? 1) / 2 - r,
          (p.depth ?? 1) / 2 - r,
          r,
        );
      }
      case "BoxGeometry":
        return this.runtime.ColliderDesc.cuboid((p.width ?? 1) / 2, (p.height ?? 1) / 2, (p.depth ?? 1) / 2);
      case "SphereGeometry":
      case "IcosahedronGeometry":
        return this.runtime.ColliderDesc.ball(p.radius ?? 1);
      case "CylinderGeometry":
        return this.runtime.ColliderDesc.cylinder((p.height ?? 0.5) / 2, p.radiusBottom ?? 0.5);
      case "CapsuleGeometry":
        return this.runtime.ColliderDesc.capsule((p.height ?? 0.5) / 2, p.radius ?? 0.5);
      case "BufferGeometry": {
        const attribute = geometry.getAttribute("position");
        if (!attribute || attribute instanceof GLBufferAttribute)
          throw new Error("RapierPhysics: Geometry requires a CPU position attribute");
        const vertices = new Float32Array(attribute.count * 3);
        for (let i = 0; i < attribute.count; i++) {
          vertices[i * 3] = attribute.getX(i);
          vertices[i * 3 + 1] = attribute.getY(i);
          vertices[i * 3 + 2] = attribute.getZ(i);
        }
        const index = geometry.getIndex();
        const indices = index
          ? Uint32Array.from(index.array)
          : Uint32Array.from({ length: attribute.count }, (_, i) => i);
        return this.runtime.ColliderDesc.trimesh(vertices, indices);
      }
      default:
        console.error("RapierPhysics: Unsupported geometry type:", geometry.type);
        return null;
    }
  }

  private check(mesh: Mesh): void {
    if (this.disposed) throw new Error("RapierPhysics is disposed");
    if (this.entries.has(mesh)) throw new Error("RapierPhysics: Mesh already added");
  }

  private createBody(
    p: RapierVector,
    q: RapierRotation,
    mass: number,
    shape: RapierColliderDesc,
  ): { body: RapierBody; collider: RapierCollider } {
    const desc = mass > 0 ? this.runtime.RigidBodyDesc.dynamic() : this.runtime.RigidBodyDesc.fixed();
    desc.setTranslation(p.x, p.y, p.z);
    desc.setRotation(q);
    const body = this.simulation.createRigidBody(desc);
    try {
      return { body, collider: this.simulation.createCollider(shape, body) };
    } catch (error) {
      this.simulation.removeRigidBody(body);
      throw error;
    }
  }

  private register(mesh: Mesh, bodies: RapierBody[], colliders: RapierCollider[], dynamic: boolean): void {
    this.entries.set(mesh, { bodies, colliders, dynamic });
    if (!mesh.userData.physics) mesh.userData.physics = {};
    mesh.userData.physics.body = mesh instanceof InstancedMesh ? bodies : bodies[0];
    mesh.userData.physics.collider = mesh instanceof InstancedMesh ? colliders : colliders[0];
  }

  addMesh(mesh: Mesh, mass = 0, restitution = 0): void {
    this.check(mesh);
    const shape = this.shapeFor(mesh.geometry);
    if (!shape) return;
    shape.setMass(mass);
    shape.setRestitution(restitution);
    const bodies: RapierBody[] = [],
      colliders: RapierCollider[] = [];
    try {
      const count = mesh instanceof InstancedMesh ? mesh.count : 1;
      for (let i = 0; i < count; i++) {
        if (mesh instanceof InstancedMesh) {
          mesh.getMatrixAt(i, this.matrix).decompose(this.position, this.rotation, this.scale);
        } else {
          this.position.copy(mesh.position);
          this.rotation.copy(mesh.quaternion);
        }
        const result = this.createBody(this.position, this.rotation, mass, shape);
        bodies.push(result.body);
        colliders.push(result.collider);
      }
      this.register(mesh, bodies, colliders, mass > 0);
    } catch (error) {
      for (const body of bodies) this.simulation.removeRigidBody(body);
      throw error;
    }
  }

  addScene(scene: Object3D): void {
    scene.traverse((child) => {
      if (child instanceof Mesh && child.userData.physics) {
        const data = child.userData.physics as { mass?: number; restitution?: number };
        this.addMesh(child, data.mass, data.restitution);
      }
    });
  }

  removeMesh(mesh: Mesh): void {
    const entry = this.entries.get(mesh);
    if (!entry) return;
    this.entries.delete(mesh);
    for (const body of entry.bodies) this.simulation.removeRigidBody(body);
    const data = mesh.userData.physics as
      | { body?: RapierBody | RapierBody[]; collider?: RapierCollider | RapierCollider[] }
      | undefined;
    if (data) {
      if (data.body === entry.bodies || data.body === entry.bodies[0]) delete data.body;
      if (data.collider === entry.colliders || data.collider === entry.colliders[0]) delete data.collider;
    }
  }

  private getBody(mesh: Mesh, index: number): RapierBody {
    if (this.disposed) throw new Error("RapierPhysics is disposed");
    const body = this.entries.get(mesh)?.bodies[index];
    if (!body) throw new Error("RapierPhysics: Mesh or instance is not registered");
    return body;
  }

  setMeshPosition(mesh: Mesh, value: RapierVector, index = 0): void {
    const body = this.getBody(mesh, index);
    body.setAngvel(this.zero, true);
    body.setLinvel(this.zero, true);
    body.setTranslation(value, true);
  }

  setMeshVelocity(mesh: Mesh, value: RapierVector, index = 0): void {
    this.getBody(mesh, index).setLinvel(value, true);
  }

  applyImpulse(mesh: Mesh, value: RapierVector, index = 0): void {
    this.getBody(mesh, index).applyImpulse(value, true);
  }

  addHeightfield(mesh: Mesh, width: number, depth: number, heights: Float32Array, size: RapierVector): RapierBody {
    this.check(mesh);
    const shape = this.runtime.ColliderDesc.heightfield(width, depth, heights, size);
    const { body, collider } = this.createBody(mesh.position, mesh.quaternion, 0, shape);
    this.register(mesh, [body], [collider], false);
    return body;
  }

  step(delta?: number): void {
    if (this.disposed) return;
    if (delta === undefined) {
      this.timer.update();
      delta = this.timer.getDelta();
    }
    this.simulation.timestep = Math.min(delta, 1 / 30);
    this.simulation.step();
    for (const [mesh, entry] of this.entries) {
      if (!entry.dynamic) continue;
      for (let i = 0; i < entry.bodies.length; i++) {
        const body = entry.bodies[i];
        if (mesh instanceof InstancedMesh) {
          mesh.getMatrixAt(i, this.matrix).decompose(this.position, this.rotation, this.scale);
          const p = body.translation(),
            q = body.rotation();
          this.position.set(p.x, p.y, p.z);
          this.rotation.set(q.x, q.y, q.z, q.w);
          this.matrix.compose(this.position, this.rotation, this.scale);
          mesh.setMatrixAt(i, this.matrix);
        } else {
          const p = body.translation(),
            q = body.rotation();
          mesh.position.set(p.x, p.y, p.z);
          mesh.quaternion.set(q.x, q.y, q.z, q.w);
        }
      }
      if (mesh instanceof InstancedMesh) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    clearInterval(this.interval);
    this.timer.dispose();
    for (const mesh of this.entries.keys()) this.removeMesh(mesh);
    this.disposed = true;
    this.simulation.free();
  }
}
