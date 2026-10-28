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
export function RapierPhysics(RAPIER: RapierRuntime) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const entries = new Map<Mesh, { bodies: RapierBody[]; colliders: RapierCollider[]; dynamic: boolean }>();
  const timer = new Timer();
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const zero = { x: 0, y: 0, z: 0 };
  let disposed = false;

  function shapeFor(geometry: BufferGeometry): RapierColliderDesc | null {
    const p = (geometry as BufferGeometry & { parameters?: Record<string, number> }).parameters ?? {};
    switch (geometry.type) {
      case "RoundedBoxGeometry": {
        const r = p.radius ?? 0.1;
        return RAPIER.ColliderDesc.roundCuboid(
          (p.width ?? 1) / 2 - r,
          (p.height ?? 1) / 2 - r,
          (p.depth ?? 1) / 2 - r,
          r,
        );
      }
      case "BoxGeometry":
        return RAPIER.ColliderDesc.cuboid((p.width ?? 1) / 2, (p.height ?? 1) / 2, (p.depth ?? 1) / 2);
      case "SphereGeometry":
      case "IcosahedronGeometry":
        return RAPIER.ColliderDesc.ball(p.radius ?? 1);
      case "CylinderGeometry":
        return RAPIER.ColliderDesc.cylinder((p.height ?? 0.5) / 2, p.radiusBottom ?? 0.5);
      case "CapsuleGeometry":
        return RAPIER.ColliderDesc.capsule((p.height ?? 0.5) / 2, p.radius ?? 0.5);
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
        return RAPIER.ColliderDesc.trimesh(vertices, indices);
      }
      default:
        console.error("RapierPhysics: Unsupported geometry type:", geometry.type);
        return null;
    }
  }

  function check(mesh: Mesh): void {
    if (disposed) throw new Error("RapierPhysics is disposed");
    if (entries.has(mesh)) throw new Error("RapierPhysics: Mesh already added");
  }
  function createBody(
    p: RapierVector,
    q: RapierRotation,
    mass: number,
    shape: RapierColliderDesc,
  ): { body: RapierBody; collider: RapierCollider } {
    const desc = mass > 0 ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
    desc.setTranslation(p.x, p.y, p.z);
    desc.setRotation(q);
    const body = world.createRigidBody(desc);
    try {
      return { body, collider: world.createCollider(shape, body) };
    } catch (error) {
      world.removeRigidBody(body);
      throw error;
    }
  }
  function register(mesh: Mesh, bodies: RapierBody[], colliders: RapierCollider[], dynamic: boolean): void {
    entries.set(mesh, { bodies, colliders, dynamic });
    if (!mesh.userData.physics) mesh.userData.physics = {};
    mesh.userData.physics.body = mesh instanceof InstancedMesh ? bodies : bodies[0];
    mesh.userData.physics.collider = mesh instanceof InstancedMesh ? colliders : colliders[0];
  }
  function addMesh(mesh: Mesh, mass = 0, restitution = 0): void {
    check(mesh);
    const shape = shapeFor(mesh.geometry);
    if (!shape) return;
    shape.setMass(mass);
    shape.setRestitution(restitution);
    const bodies: RapierBody[] = [],
      colliders: RapierCollider[] = [];
    try {
      const count = mesh instanceof InstancedMesh ? mesh.count : 1;
      for (let i = 0; i < count; i++) {
        if (mesh instanceof InstancedMesh) mesh.getMatrixAt(i, matrix).decompose(position, rotation, scale);
        else {
          position.copy(mesh.position);
          rotation.copy(mesh.quaternion);
        }
        const result = createBody(position, rotation, mass, shape);
        bodies.push(result.body);
        colliders.push(result.collider);
      }
      register(mesh, bodies, colliders, mass > 0);
    } catch (error) {
      for (const body of bodies) world.removeRigidBody(body);
      throw error;
    }
  }
  function addScene(scene: Object3D): void {
    scene.traverse((child) => {
      if (child instanceof Mesh && child.userData.physics) {
        const data = child.userData.physics as { mass?: number; restitution?: number };
        addMesh(child, data.mass, data.restitution);
      }
    });
  }
  function removeMesh(mesh: Mesh): void {
    const entry = entries.get(mesh);
    if (!entry) return;
    entries.delete(mesh);
    for (const body of entry.bodies) world.removeRigidBody(body);
    const data = mesh.userData.physics as
      | { body?: RapierBody | RapierBody[]; collider?: RapierCollider | RapierCollider[] }
      | undefined;
    if (data) {
      if (data.body === entry.bodies || data.body === entry.bodies[0]) delete data.body;
      if (data.collider === entry.colliders || data.collider === entry.colliders[0]) delete data.collider;
    }
  }
  function getBody(mesh: Mesh, index: number): RapierBody {
    if (disposed) throw new Error("RapierPhysics is disposed");
    const body = entries.get(mesh)?.bodies[index];
    if (!body) throw new Error("RapierPhysics: Mesh or instance is not registered");
    return body;
  }
  function setMeshPosition(mesh: Mesh, value: RapierVector, index = 0): void {
    const body = getBody(mesh, index);
    body.setAngvel(zero, true);
    body.setLinvel(zero, true);
    body.setTranslation(value, true);
  }
  function setMeshVelocity(mesh: Mesh, value: RapierVector, index = 0): void {
    getBody(mesh, index).setLinvel(value, true);
  }
  function applyImpulse(mesh: Mesh, value: RapierVector, index = 0): void {
    getBody(mesh, index).applyImpulse(value, true);
  }
  function addHeightfield(
    mesh: Mesh,
    width: number,
    depth: number,
    heights: Float32Array,
    size: RapierVector,
  ): RapierBody {
    check(mesh);
    const shape = RAPIER.ColliderDesc.heightfield(width, depth, heights, size);
    const { body, collider } = createBody(mesh.position, mesh.quaternion, 0, shape);
    register(mesh, [body], [collider], false);
    return body;
  }
  function step(delta?: number): void {
    if (disposed) return;
    if (delta === undefined) {
      timer.update();
      delta = timer.getDelta();
    }
    world.timestep = Math.min(delta, 1 / 30);
    world.step();
    for (const [mesh, entry] of entries) {
      if (!entry.dynamic) continue;
      for (let i = 0; i < entry.bodies.length; i++) {
        const body = entry.bodies[i];
        if (mesh instanceof InstancedMesh) {
          mesh.getMatrixAt(i, matrix).decompose(position, rotation, scale);
          const p = body.translation(),
            q = body.rotation();
          position.set(p.x, p.y, p.z);
          rotation.set(q.x, q.y, q.z, q.w);
          matrix.compose(position, rotation, scale);
          mesh.setMatrixAt(i, matrix);
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
  const interval = setInterval(step, 1000 / 60);
  function dispose(): void {
    if (disposed) return;
    clearInterval(interval);
    timer.dispose();
    for (const mesh of entries.keys()) removeMesh(mesh);
    disposed = true;
    world.free();
  }
  return {
    RAPIER,
    world,
    addScene,
    addMesh,
    removeMesh,
    setMeshPosition,
    setMeshVelocity,
    applyImpulse,
    addHeightfield,
    step,
    dispose,
  };
}
