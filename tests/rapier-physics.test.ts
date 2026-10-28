import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import {
  RapierPhysics,
  type RapierRuntime,
  type RapierVector,
  type RapierRotation,
} from "../src/addons/physics/RapierPhysics";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Quaternion } from "../src/math/Quaternion";
import { Vector3 } from "../src/math/Vector3";
import { InstancedMesh } from "../src/objects/InstancedMesh";
import { Mesh } from "../src/objects/Mesh";

class Desc {
  position: RapierVector = { x: 0, y: 0, z: 0 };
  rotation: RapierRotation = { x: 0, y: 0, z: 0, w: 1 };
  setTranslation(x: number, y: number, z: number): this {
    this.position = { x, y, z };
    return this;
  }
  setRotation(value: RapierRotation): this {
    this.rotation = { x: value.x, y: value.y, z: value.z, w: value.w };
    return this;
  }
  setMass(): this {
    return this;
  }
  setRestitution(): this {
    return this;
  }
}
class Body {
  position: RapierVector;
  orientation: RapierRotation;
  constructor(desc: Desc) {
    this.position = { ...desc.position };
    this.orientation = { ...desc.rotation };
  }
  translation(): RapierVector {
    return this.position;
  }
  rotation(): RapierRotation {
    return this.orientation;
  }
  setTranslation(value: RapierVector): void {
    this.position = { ...value };
  }
  setLinvel(): void {}
  setAngvel(): void {}
  applyImpulse(): void {}
}
class World {
  bodies: Body[] = [];
  removed: Body[] = [];
  freed: boolean = false;
  timestep: number = 0;
  createRigidBody(desc: Desc): Body {
    const body = new Body(desc);
    this.bodies.push(body);
    return body;
  }
  createCollider(): object {
    return {};
  }
  removeRigidBody(body: Body): void {
    this.removed.push(body);
  }
  step(): void {}
  free(): void {
    this.freed = true;
  }
}
function runtime(): RapierRuntime {
  return {
    World,
    RigidBodyDesc: { dynamic: () => new Desc(), fixed: () => new Desc() },
    ColliderDesc: { cuboid: () => new Desc(), heightfield: () => new Desc() },
  } as unknown as RapierRuntime;
}

test("Rapier preserves instance rotation and scale and removes all bodies without disposing meshes", () => {
  vi.useFakeTimers();
  try {
    const physics = RapierPhysics(runtime());
    const world = physics.world as unknown as World;
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    const disposeGeometry = vi.spyOn(geometry, "dispose");
    const disposeMaterial = vi.spyOn(material, "dispose");
    const mesh = new InstancedMesh(geometry, material, 1);
    const initialRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 3);
    mesh.setMatrixAt(0, new Matrix4().compose(new Vector3(1, 2, 3), initialRotation, new Vector3(2, 3, 4)));
    physics.addMesh(mesh, 1);
    assert.ok(Math.abs(world.bodies[0].orientation.y - initialRotation.y) < 1e-6);
    physics.setMeshPosition(mesh, { x: 5, y: 6, z: 7 });
    physics.step(1 / 60);
    const position = new Vector3(),
      rotation = new Quaternion(),
      scale = new Vector3();
    mesh.getMatrixAt(0, new Matrix4()).decompose(position, rotation, scale);
    assert.deepEqual(position.toArray(), [5, 6, 7]);
    assert.ok(Math.abs(rotation.y - initialRotation.y) < 1e-6);
    assert.ok(Math.abs(scale.x - 2) < 1e-6 && Math.abs(scale.y - 3) < 1e-6 && Math.abs(scale.z - 4) < 1e-6);
    physics.removeMesh(mesh);
    assert.equal(world.removed.length, 1);
    assert.equal(mesh.userData.physics.body, undefined);
    physics.dispose();
    physics.dispose();
    assert.equal(world.removed.length, 1);
    assert.equal(world.freed, true);
    assert.equal(disposeGeometry.mock.calls.length, 0);
    assert.equal(disposeMaterial.mock.calls.length, 0);
    assert.equal(vi.getTimerCount(), 0);
  } finally {
    vi.useRealTimers();
  }
});

test("Rapier tracks fixed meshes and heightfields for removal and disposal", () => {
  vi.useFakeTimers();
  try {
    const physics = RapierPhysics(runtime());
    const world = physics.world as unknown as World;
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const terrain = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    physics.addMesh(mesh);
    physics.addHeightfield(terrain, 1, 1, new Float32Array(4), { x: 1, y: 1, z: 1 });
    physics.removeMesh(terrain);
    assert.equal(world.removed.length, 1);
    physics.dispose();
    assert.equal(world.removed.length, 2);
    assert.equal(mesh.userData.physics.body, undefined);
    assert.equal(terrain.userData.physics.body, undefined);
  } finally {
    vi.useRealTimers();
  }
});
