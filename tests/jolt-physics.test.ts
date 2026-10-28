import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { JoltPhysics, type JoltRuntime, type JoltVector, type JoltQuaternion } from "../src/addons/physics/JoltPhysics";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Quaternion } from "../src/math/Quaternion";
import { Vector3 } from "../src/math/Vector3";
import { InstancedMesh } from "../src/objects/InstancedMesh";
import { Mesh } from "../src/objects/Mesh";

class Vec implements JoltVector {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
  ) {}
  GetX(): number {
    return this.x;
  }
  GetY(): number {
    return this.y;
  }
  GetZ(): number {
    return this.z;
  }
}
class Quat extends Vec implements JoltQuaternion {
  constructor(
    x: number,
    y: number,
    z: number,
    readonly w: number,
  ) {
    super(x, y, z);
  }
  GetW(): number {
    return this.w;
  }
}
class Shape {
  AddRef(): void {}
  Release(): void {}
}
class Creation {
  mRestitution: number = 0;
  constructor(
    readonly shape: Shape,
    readonly p: JoltVector,
    readonly q: JoltQuaternion,
  ) {}
}
class Body {
  p: JoltVector;
  q: JoltQuaternion;
  velocity: JoltVector = new Vec(0, 0, 0);
  constructor(info: Creation) {
    this.p = info.p;
    this.q = info.q;
  }
  GetID(): Body {
    return this;
  }
  GetPosition(): JoltVector {
    return this.p;
  }
  GetRotation(): JoltQuaternion {
    return this.q;
  }
}

function fixture(): { runtime: JoltRuntime; removed: Body[]; bodies: Body[]; destroyed: object[] } {
  const bodies: Body[] = [];
  const removed: Body[] = [];
  const destroyed: object[] = [];
  const bodyInterface = {
    CreateBody(settings: object): Body {
      const body = new Body(settings as Creation);
      bodies.push(body);
      return body;
    },
    AddBody(): void {},
    RemoveBody(id: object): void {
      removed.push(id as Body);
    },
    DestroyBody(): void {},
    SetPositionAndRotation(id: object, p: JoltVector, q: JoltQuaternion): void {
      const body = id as Body;
      body.p = p;
      body.q = q;
    },
    SetLinearAndAngularVelocity(id: object, linear: JoltVector): void {
      (id as Body).velocity = linear;
    },
    SetLinearVelocity(id: object, velocity: JoltVector): void {
      (id as Body).velocity = velocity;
    },
    ActivateBody(): void {},
  };
  const runtime: JoltRuntime = {
    Vec3: Vec,
    RVec3: Vec,
    Quat,
    BoxShape: Shape,
    SphereShape: Shape,
    ObjectLayerPairFilterTable: class {
      EnableCollision(): void {}
    },
    BroadPhaseLayer: class {},
    BroadPhaseLayerInterfaceTable: class {
      MapObjectToBroadPhaseLayer(): void {}
    },
    ObjectVsBroadPhaseLayerFilterTable: class {},
    JoltSettings: class {
      mObjectLayerPairFilter: object = {};
      mBroadPhaseLayerInterface: object = {};
      mObjectVsBroadPhaseLayerFilter: object = {};
    },
    JoltInterface: class {
      GetPhysicsSystem(): { GetBodyInterface(): typeof bodyInterface } {
        return { GetBodyInterface: () => bodyInterface };
      }
      Step(delta: number): void {
        for (const body of bodies)
          body.p = new Vec(body.p.GetX() + body.velocity.GetX() * delta, body.p.GetY(), body.p.GetZ());
      }
    },
    BodyCreationSettings: Creation,
    EMotionType_Dynamic: 1,
    EMotionType_Static: 0,
    EActivation_Activate: 1,
    destroy(value: object): void {
      destroyed.push(value);
    },
  };
  return { runtime, removed, bodies, destroyed };
}

test("Jolt teleport resets velocity without destroying a body and preserves instance scale", () => {
  vi.useFakeTimers();
  const { runtime, bodies, removed } = fixture();
  const physics = JoltPhysics(runtime);
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 2);
  const matrix = new Matrix4();
  mesh.setMatrixAt(0, matrix.compose(new Vector3(1, 2, 3), new Quaternion(), new Vector3(2, 3, 4)));
  mesh.setMatrixAt(1, matrix.makeTranslation(8, 9, 10));
  try {
    physics.addMesh(mesh, 1);
    physics.setMeshVelocity(mesh, new Vector3(6, 0, 0));
    vi.advanceTimersByTime(100);
    mesh.getMatrixAt(0, matrix);
    assert(matrix.elements[12] > 1);
    assert.equal(matrix.elements[0], 2);
    assert.equal(matrix.elements[5], 3);
    assert.equal(matrix.elements[10], 4);
    physics.setMeshPosition(mesh, new Vector3(4, 5, 6));
    vi.advanceTimersByTime(100);
    mesh.getMatrixAt(0, matrix);
    assert.deepEqual(matrix.elements.slice(12, 15), [4, 5, 6]);
    mesh.getMatrixAt(1, matrix);
    assert.deepEqual(matrix.elements.slice(12, 15), [8, 9, 10]);
    assert.equal(bodies.length, 2);
    assert.equal(removed.length, 0);
    assert.throws(() => physics.setMeshPosition(mesh, new Vector3(), 2), /not registered/);
    assert.throws(() => physics.addMesh(mesh, 1), /already added/);
    physics.dispose();
    assert.equal(removed.length, 2);
    physics.dispose();
    assert.equal(removed.length, 2);
    assert.equal(vi.getTimerCount(), 0);
    assert.throws(() => physics.setMeshVelocity(mesh, new Vector3()), /disposed/);
  } finally {
    physics.dispose();
    geometry.dispose();
    material.dispose();
    vi.useRealTimers();
  }
});

test("Jolt tracks static bodies for teleport and disposal without touching caller resources", () => {
  const { runtime, removed } = fixture();
  const physics = JoltPhysics(runtime);
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  let releases = 0;
  geometry.addEventListener("dispose", () => {
    releases++;
  });
  material.addEventListener("dispose", () => {
    releases++;
  });
  try {
    physics.addMesh(mesh);
    physics.setMeshPosition(mesh, new Vector3(3, 4, 5));
    assert.deepEqual(mesh.position.toArray(), [3, 4, 5]);
    physics.dispose();
    assert.equal(removed.length, 1);
    assert.equal(releases, 0);
  } finally {
    physics.dispose();
    geometry.dispose();
    material.dispose();
  }
});
