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
export class JoltPhysics {
  private jolt: JoltRuntime;
  private world: JoltWorld;
  private bodyInterface: JoltBodyInterface;
  private entries: Map<Mesh, { bodies: JoltBody[]; dynamic: boolean }>;
  private position: Vector3;
  private rotation: Quaternion;
  private scale: Vector3;
  private matrix: Matrix4;
  private timer: Timer;
  private disposed: boolean;
  private interval: ReturnType<typeof setInterval>;

  constructor(jolt: JoltRuntime) {
    this.jolt = jolt;
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
    this.world = new jolt.JoltInterface(settings);
    jolt.destroy(settings);
    this.bodyInterface = this.world.GetPhysicsSystem().GetBodyInterface();
    this.entries = new Map();
    this.position = new Vector3();
    this.rotation = new Quaternion();
    this.scale = new Vector3();
    this.matrix = new Matrix4();
    this.timer = new Timer();
    this.disposed = false;

    this.addScene = this.addScene.bind(this);
    this.addMesh = this.addMesh.bind(this);
    this.setMeshPosition = this.setMeshPosition.bind(this);
    this.setMeshVelocity = this.setMeshVelocity.bind(this);
    this.dispose = this.dispose.bind(this);
    this.step = this.step.bind(this);
    this.interval = setInterval(this.step, 1000 / 60);
  }

  addMesh(mesh: Mesh, mass = 0, restitution = 0): void {
    if (this.disposed) throw new Error("JoltPhysics is disposed");
    if (this.entries.has(mesh)) throw new Error("JoltPhysics: Mesh already added");
    const geometry = mesh.geometry;
    let shape: JoltShape;
    if (geometry instanceof BoxGeometry) {
      const { width, height, depth } = geometry.parameters;
      const half = new this.jolt.Vec3(width / 2, height / 2, depth / 2);
      shape = new this.jolt.BoxShape(half, 0.025 * Math.min(width, height, depth), null);
      this.jolt.destroy(half);
    } else if (geometry instanceof SphereGeometry || geometry instanceof IcosahedronGeometry) {
      shape = new this.jolt.SphereShape(geometry.parameters.radius, null);
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
          this.matrix
            .fromArray(mesh.instanceMatrix.array, index * 16)
            .decompose(this.position, this.rotation, this.scale);
        } else {
          this.position.copy(mesh.position);
          this.rotation.copy(mesh.quaternion);
        }
        const p = new this.jolt.RVec3(this.position.x, this.position.y, this.position.z);
        const q = new this.jolt.Quat(this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w);
        const creation = new this.jolt.BodyCreationSettings(
          shape,
          p,
          q,
          mass > 0 ? this.jolt.EMotionType_Dynamic : this.jolt.EMotionType_Static,
          mass > 0 ? 1 : 0,
        );
        this.jolt.destroy(p);
        this.jolt.destroy(q);
        creation.mRestitution = restitution;
        let body: JoltBody;
        try {
          body = this.bodyInterface.CreateBody(creation);
        } finally {
          this.jolt.destroy(creation);
        }
        bodies.push(body);
        this.bodyInterface.AddBody(body.GetID(), this.jolt.EActivation_Activate);
      }
      this.entries.set(mesh, { bodies, dynamic: mass > 0 });
    } catch (error) {
      for (const body of bodies) {
        this.bodyInterface.RemoveBody(body.GetID());
        this.bodyInterface.DestroyBody(body.GetID());
      }
      throw error;
    } finally {
      shape.Release();
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

  private getBody(mesh: Mesh, index: number): JoltBody {
    if (this.disposed) throw new Error("JoltPhysics is disposed");
    const body = this.entries.get(mesh)?.bodies[index];
    if (!body) throw new Error("JoltPhysics: Mesh or instance is not registered");
    return body;
  }

  setMeshPosition(mesh: Mesh, value: Vector3, index = 0): void {
    const body = this.getBody(mesh, index);
    const p = new this.jolt.RVec3(value.x, value.y, value.z);
    const q = new this.jolt.Quat(0, 0, 0, 1);
    const zero = new this.jolt.Vec3(0, 0, 0);
    try {
      this.bodyInterface.SetPositionAndRotation(body.GetID(), p, q, this.jolt.EActivation_Activate);
      this.bodyInterface.SetLinearAndAngularVelocity(body.GetID(), zero, zero);
      this.syncMesh(mesh, this.entries.get(mesh)!.bodies);
    } finally {
      this.jolt.destroy(p);
      this.jolt.destroy(q);
      this.jolt.destroy(zero);
    }
  }

  setMeshVelocity(mesh: Mesh, value: Vector3, index = 0): void {
    const body = this.getBody(mesh, index);
    const velocity = new this.jolt.Vec3(value.x, value.y, value.z);
    try {
      this.bodyInterface.SetLinearVelocity(body.GetID(), velocity);
      this.bodyInterface.ActivateBody(body.GetID());
    } finally {
      this.jolt.destroy(velocity);
    }
  }

  private syncMesh(mesh: Mesh, bodies: JoltBody[]): void {
    for (let index = 0; index < bodies.length; index++) {
      const body = bodies[index];
      const p = body.GetPosition();
      const q = body.GetRotation();
      this.position.set(p.GetX(), p.GetY(), p.GetZ());
      this.rotation.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
      if (mesh instanceof InstancedMesh) {
        mesh.getMatrixAt(index, this.matrix);
        this.scale.setFromMatrixScale(this.matrix);
        this.matrix.compose(this.position, this.rotation, this.scale).toArray(mesh.instanceMatrix.array, index * 16);
      } else {
        mesh.position.copy(this.position);
        mesh.quaternion.copy(this.rotation);
      }
    }
    if (mesh instanceof InstancedMesh) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  private step(): void {
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 1 / 30);
    this.world.Step(delta, delta > 1 / 55 ? 2 : 1);
    for (const [mesh, entry] of this.entries) {
      if (entry.dynamic) this.syncMesh(mesh, entry.bodies);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.interval);
    this.timer.dispose();
    for (const { bodies } of this.entries.values()) {
      for (const body of bodies) {
        this.bodyInterface.RemoveBody(body.GetID());
        this.bodyInterface.DestroyBody(body.GetID());
      }
    }
    this.entries.clear();
    this.jolt.destroy(this.world);
  }
}
