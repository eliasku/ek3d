import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { CCDIKSolver, type CCDIK } from "../src/addons/animation/CCDIKSolver";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Vector3 } from "../src/math/Vector3";
import { Bone } from "../src/objects/Bone";
import { Skeleton } from "../src/objects/Skeleton";
import { SkinnedMesh } from "../src/objects/SkinnedMesh";
import { Line } from "../src/objects/Line";
import { BufferAttribute } from "../src/core/BufferAttribute";

function fixture(ikOptions: Partial<CCDIK> = {}) {
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial());
  const link = new Bone(),
    effector = new Bone(),
    target = new Bone();
  effector.position.x = 1;
  target.position.y = 1;
  link.add(effector);
  mesh.add(link, target);
  mesh.bind(new Skeleton([link, effector, target]));
  mesh.updateMatrixWorld(true);
  const ik: CCDIK = { target: 2, effector: 1, links: [{ index: 0 }], ...ikOptions };
  return { mesh, link, effector, target, ik, solver: new CCDIKSolver(mesh, [ik]) };
}

test("CCD rotates the effector toward the target and honors angle limits", () => {
  const { link, effector, solver } = fixture({ maxAngle: Math.PI / 4 });
  assert.equal(solver.update(), solver);
  assert.ok(Math.abs(link.rotation.z - Math.PI / 4) < 1e-6);
  assert.ok(Math.abs(effector.matrixWorld.elements[12] - Math.SQRT1_2) < 1e-6);
  solver.update();
  assert.ok(Math.abs(link.rotation.z - Math.PI / 2) < 1e-6);
});

test("CCD blending, disabled links, and axis limitation preserve expected rotations", () => {
  const blended = fixture({ blendFactor: 0.5 });
  blended.solver.update();
  assert.ok(Math.abs(blended.link.rotation.z - Math.PI / 4) < 1e-6);
  const disabled = fixture({ links: [{ index: 0, enabled: false }] });
  disabled.solver.update();
  assert.equal(disabled.link.rotation.z, 0);
  const limited = fixture({
    links: [
      {
        index: 0,
        limitation: new Vector3(0, 0, 1),
        rotationMin: new Vector3(-1, -1, -0.3),
        rotationMax: new Vector3(1, 1, 0.3),
      },
    ],
  });
  limited.solver.update();
  assert.ok(Math.abs(limited.link.rotation.z - 0.3) < 1e-6);
  const negative = fixture({ links: [{ index: 0, limitation: new Vector3(0, 0, 1) }] });
  negative.target.position.y = -1;
  negative.mesh.updateMatrixWorld(true);
  negative.solver.update();
  assert.ok(Math.abs(negative.link.rotation.z + Math.PI / 2) < 1e-6);
});

test("IK helper reflects bone positions in mesh space and disposes its resources", () => {
  const { mesh, solver } = fixture();
  mesh.position.set(3, 4, 5);
  mesh.updateMatrixWorld(true);
  const helper = solver.createHelper(0.1);
  helper.updateMatrixWorld(true);
  assert.equal(helper.children.length, 4);
  assert.deepEqual(helper.children[0].position.toArray(), [0, 1, 0]);
  assert.deepEqual(helper.children[1].position.toArray(), [1, 0, 0]);
  const line = helper.children[3] as Line;
  const positions = line.geometry.attributes.position as BufferAttribute;
  assert.deepEqual(Array.from(positions.array), [0, 1, 0, 1, 0, 0, 0, 0, 0]);
  let disposed = false;
  line.geometry.addEventListener("dispose", () => {
    disposed = true;
  });
  helper.dispose();
  assert.equal(disposed, true);
});
