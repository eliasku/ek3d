import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { LoftGeometry } from "../src/addons/geometries/LoftGeometry";
import { AnimationPathHelper } from "../src/addons/helpers/AnimationPathHelper";
import { MorphAnimMesh } from "../src/addons/misc/MorphAnimMesh";
import { TubePainter } from "../src/addons/misc/TubePainter";
import { RollerCoasterGeometry } from "../src/addons/misc/RollerCoaster";
import { AnimationClip } from "../src/animation/AnimationClip";
import { VectorKeyframeTrack } from "../src/animation/tracks/VectorKeyframeTrack";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { LineCurve3 } from "../src/extras/curves/LineCurve3";
import { Object3D } from "../src/core/Object3D";
import { Vector3 } from "../src/math/Vector3";

test("loft closes seams and adds independently shaded end caps", () => {
  const ring = (z: number) => [new Vector3(0, 0, z), new Vector3(1, 0, z), new Vector3(1, 1, z), new Vector3(0, 1, z)];
  const geometry = new LoftGeometry([ring(0), ring(1)], { capStart: true, capEnd: true });
  const position = geometry.getAttribute("position") as BufferAttribute;
  const normal = geometry.getAttribute("normal") as BufferAttribute;
  assert.equal(position.count, 18);
  assert.equal(geometry.index!.count, 36);
  assert.deepEqual([normal.getX(0), normal.getY(0), normal.getZ(0)], [normal.getX(4), normal.getY(4), normal.getZ(4)]);
  assert.ok(normal.getZ(10) < -0.99);
  assert.ok(normal.getZ(14) > 0.99);
  const open = new LoftGeometry([ring(0), ring(1)], { closed: false });
  assert.equal(open.index!.count, 18);
});

test("path sampling includes endpoints and morph playback changes direction", () => {
  const object = new Object3D();
  const track = new VectorKeyframeTrack(`${object.uuid}.position`, [0, 1], [0, 0, 0, 2, 4, 6]);
  const clip = new AnimationClip("move", 1, [track]);
  const helper = new AnimationPathHelper(object, clip, object, { divisions: 2 });
  const positions = helper.line!.geometry.getAttribute("position") as BufferAttribute;
  assert.deepEqual(Array.from(positions.array), [0, 0, 0, 1, 2, 3, 2, 4, 6]);
  assert.equal((helper.points!.geometry.getAttribute("position") as BufferAttribute).count, 2);
  helper.dispose();
  const mesh = new MorphAnimMesh();
  mesh.animations.push(clip);
  mesh.playAnimation("move", 2);
  assert.equal(mesh.activeAction!.timeScale, 2);
  mesh.setDirectionBackward();
  assert.equal(mesh.mixer.timeScale, -1);
  mesh.setDirectionForward();
  assert.equal(mesh.mixer.timeScale, 1);
  assert.throws(() => mesh.playAnimation("missing", 1), /undefined/);
  assert.equal(mesh.activeAction, null);
});

test("tube painter ignores zero length strokes and extends its existing end cap", () => {
  const painter = new TubePainter();
  painter.moveTo(new Vector3());
  painter.lineTo(new Vector3());
  assert.equal(painter.mesh.geometry.drawRange.count, 0);
  painter.lineTo(new Vector3(0, 0, 1));
  const first = painter.mesh.geometry.drawRange.count;
  assert.ok(first > 90);
  painter.lineTo(new Vector3(0, 0, 2));
  assert.equal(painter.mesh.geometry.drawRange.count, first + 90);
  painter.update();
  painter.mesh.geometry.dispose();
  painter.mesh.material.dispose();
});

test("roller coaster extrusion adds rail faces and alternating ties", () => {
  const curve = new LineCurve3(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
  const first = new RollerCoasterGeometry(curve, 1);
  const second = new RollerCoasterGeometry(curve, 2);
  assert.equal((first.getAttribute("position") as BufferAttribute).count, 102);
  assert.equal((second.getAttribute("position") as BufferAttribute).count, 216);
  assert.equal((second.getAttribute("normal") as BufferAttribute).count, 216);
  first.dispose();
  second.dispose();
});
