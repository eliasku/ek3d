import { Timer } from "../../core/Timer";
import type { Object3D } from "../../core/Object3D";
import { BoxGeometry } from "../../geometries/BoxGeometry";
import { IcosahedronGeometry } from "../../geometries/IcosahedronGeometry";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";
import { InstancedMesh } from "../../objects/InstancedMesh";
import { Mesh } from "../../objects/Mesh";

export interface JoltVector {
  GetX(): number;
  GetY(): number;
  GetZ(): number;
}
export interface JoltQuaternion extends JoltVector {
  GetW(): number;
}
export interface JoltShape {
  AddRef(): void;
  Release(): void;
}
export interface JoltBody {
  GetID(): object;
  GetPosition(): JoltVector;
  GetRotation(): JoltQuaternion;
}
export interface JoltBodyInterface {
  CreateBody(settings: object): JoltBody;
  AddBody(id: object, activation: number): void;
  RemoveBody(id: object): void;
  DestroyBody(id: object): void;
  SetPositionAndRotation(id: object, position: JoltVector, rotation: JoltQuaternion, activation: number): void;
  SetLinearAndAngularVelocity(id: object, linear: JoltVector, angular: JoltVector): void;
  SetLinearVelocity(id: object, velocity: JoltVector): void;
  ActivateBody(id: object): void;
}
export interface JoltSettings {
  mObjectLayerPairFilter: object;
  mBroadPhaseLayerInterface: object;
  mObjectVsBroadPhaseLayerFilter: object;
}
export interface JoltWorld {
  GetPhysicsSystem(): { GetBodyInterface(): JoltBodyInterface };
  Step(delta: number, collisionSteps: number): void;
}
export interface JoltRuntime {
  Vec3: new (x: number, y: number, z: number) => JoltVector;
  RVec3: new (x: number, y: number, z: number) => JoltVector;
  Quat: new (x: number, y: number, z: number, w: number) => JoltQuaternion;
  BoxShape: new (halfExtents: JoltVector, convexRadius: number, material: null) => JoltShape;
  SphereShape: new (radius: number, material: null) => JoltShape;
  ObjectLayerPairFilterTable: new (layers: number) => { EnableCollision(a: number, b: number): void };
  BroadPhaseLayer: new (value: number) => object;
  BroadPhaseLayerInterfaceTable: new (
    objectLayers: number,
    broadPhaseLayers: number,
  ) => {
    MapObjectToBroadPhaseLayer(layer: number, broadPhaseLayer: object): void;
  };
  ObjectVsBroadPhaseLayerFilterTable: new (
    broadPhase: object,
    broadPhaseLayers: number,
    objectFilter: object,
    objectLayers: number,
  ) => object;
  JoltSettings: new () => JoltSettings;
  JoltInterface: new (settings: JoltSettings) => JoltWorld;
  BodyCreationSettings: new (
    shape: JoltShape,
    position: JoltVector,
    rotation: JoltQuaternion,
    motion: number,
    layer: number,
  ) => { mRestitution: number };
  EMotionType_Dynamic: number;
  EMotionType_Static: number;
  EActivation_Activate: number;
  destroy(value: object): void;
}

/** Creates a simulation with a caller-owned initialized Jolt runtime. Dispose it before releasing the runtime. */
export function JoltPhysics(jolt: JoltRuntime): {
  addScene(scene: Object3D): void;
  addMesh(mesh: Mesh, mass?: number, restitution?: number): void;
  setMeshPosition(mesh: Mesh, position: Vector3, index?: number): void;
  setMeshVelocity(mesh: Mesh, velocity: Vector3, index?: number): void;
  dispose(): void;
} {
  const settings = new jolt.JoltSettings();
  const filter = new jolt.ObjectLayerPairFilterTable(2);
  filter.EnableCollision(0, 1);
  filter.EnableCollision(1, 1);
  const broadPhase = new jolt.BroadPhaseLayerInterfaceTable(2, 2);
  for (let layer = 0; layer < 2; layer++) {
    const value = new jolt.BroadPhaseLayer(layer);
    broadPhase.MapObjectToBroadPhaseLayer(layer, value);
    jolt.destroy(value);
  }
  settings.mObjectLayerPairFilter = filter;
  settings.mBroadPhaseLayerInterface = broadPhase;
  settings.mObjectVsBroadPhaseLayerFilter = new jolt.ObjectVsBroadPhaseLayerFilterTable(broadPhase, 2, filter, 2);
  // JoltInterface takes ownership of the three collision filters.
  const world = new jolt.JoltInterface(settings);
  jolt.destroy(settings);
  const bodyInterface = world.GetPhysicsSystem().GetBodyInterface();
  const entries = new Map<Mesh, { bodies: JoltBody[]; dynamic: boolean }>();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const matrix = new Matrix4();
  const timer = new Timer();
  let disposed = false;

  function addMesh(mesh: Mesh, mass = 0, restitution = 0): void {
    if (disposed) throw new Error("JoltPhysics is disposed");
    if (entries.has(mesh)) throw new Error("JoltPhysics: Mesh already added");
    const geometry = mesh.geometry;
    let shape: JoltShape;
    if (geometry instanceof BoxGeometry) {
      const { width, height, depth } = geometry.parameters;
      const half = new jolt.Vec3(width / 2, height / 2, depth / 2);
      shape = new jolt.BoxShape(half, 0.025 * Math.min(width, height, depth), null);
      jolt.destroy(half);
    } else if (geometry instanceof SphereGeometry || geometry instanceof IcosahedronGeometry) {
      shape = new jolt.SphereShape(geometry.parameters.radius, null);
    } else {
      console.error("JoltPhysics: Unsupported geometry type:", geometry.type);
      return;
    }
    shape.AddRef();
    const bodies: JoltBody[] = [];
    try {
      const count = mesh instanceof InstancedMesh ? mesh.count : 1;
      for (let index = 0; index < count; index++) {
        if (mesh instanceof InstancedMesh) {
          matrix.fromArray(mesh.instanceMatrix.array, index * 16).decompose(position, rotation, scale);
        } else {
          position.copy(mesh.position);
          rotation.copy(mesh.quaternion);
        }
        const p = new jolt.RVec3(position.x, position.y, position.z);
        const q = new jolt.Quat(rotation.x, rotation.y, rotation.z, rotation.w);
        const creation = new jolt.BodyCreationSettings(
          shape,
          p,
          q,
          mass > 0 ? jolt.EMotionType_Dynamic : jolt.EMotionType_Static,
          mass > 0 ? 1 : 0,
        );
        jolt.destroy(p);
        jolt.destroy(q);
        creation.mRestitution = restitution;
        let body: JoltBody;
        try {
          body = bodyInterface.CreateBody(creation);
        } finally {
          jolt.destroy(creation);
        }
        bodies.push(body);
        bodyInterface.AddBody(body.GetID(), jolt.EActivation_Activate);
      }
      entries.set(mesh, { bodies, dynamic: mass > 0 });
    } catch (error) {
      for (const body of bodies) {
        bodyInterface.RemoveBody(body.GetID());
        bodyInterface.DestroyBody(body.GetID());
      }
      throw error;
    } finally {
      shape.Release();
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

  function getBody(mesh: Mesh, index: number): JoltBody {
    if (disposed) throw new Error("JoltPhysics is disposed");
    const body = entries.get(mesh)?.bodies[index];
    if (!body) throw new Error("JoltPhysics: Mesh or instance is not registered");
    return body;
  }

  function setMeshPosition(mesh: Mesh, value: Vector3, index = 0): void {
    const body = getBody(mesh, index);
    const p = new jolt.RVec3(value.x, value.y, value.z);
    const q = new jolt.Quat(0, 0, 0, 1);
    const zero = new jolt.Vec3(0, 0, 0);
    try {
      bodyInterface.SetPositionAndRotation(body.GetID(), p, q, jolt.EActivation_Activate);
      bodyInterface.SetLinearAndAngularVelocity(body.GetID(), zero, zero);
      syncMesh(mesh, entries.get(mesh)!.bodies);
    } finally {
      jolt.destroy(p);
      jolt.destroy(q);
      jolt.destroy(zero);
    }
  }

  function setMeshVelocity(mesh: Mesh, value: Vector3, index = 0): void {
    const body = getBody(mesh, index);
    const velocity = new jolt.Vec3(value.x, value.y, value.z);
    try {
      bodyInterface.SetLinearVelocity(body.GetID(), velocity);
      bodyInterface.ActivateBody(body.GetID());
    } finally {
      jolt.destroy(velocity);
    }
  }

  function syncMesh(mesh: Mesh, bodies: JoltBody[]): void {
    for (let index = 0; index < bodies.length; index++) {
      const body = bodies[index];
      const p = body.GetPosition();
      const q = body.GetRotation();
      position.set(p.GetX(), p.GetY(), p.GetZ());
      rotation.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
      if (mesh instanceof InstancedMesh) {
        mesh.getMatrixAt(index, matrix);
        scale.setFromMatrixScale(matrix);
        matrix.compose(position, rotation, scale).toArray(mesh.instanceMatrix.array, index * 16);
      } else {
        mesh.position.copy(position);
        mesh.quaternion.copy(rotation);
      }
    }
    if (mesh instanceof InstancedMesh) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  function step(): void {
    timer.update();
    const delta = Math.min(timer.getDelta(), 1 / 30);
    world.Step(delta, delta > 1 / 55 ? 2 : 1);
    for (const [mesh, entry] of entries) {
      if (entry.dynamic) syncMesh(mesh, entry.bodies);
    }
  }
  const interval = setInterval(step, 1000 / 60);
  return {
    addScene,
    addMesh,
    setMeshPosition,
    setMeshVelocity,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearInterval(interval);
      timer.dispose();
      for (const { bodies } of entries.values()) {
        for (const body of bodies) {
          bodyInterface.RemoveBody(body.GetID());
          bodyInterface.DestroyBody(body.GetID());
        }
      }
      entries.clear();
      jolt.destroy(world);
    },
  };
}
