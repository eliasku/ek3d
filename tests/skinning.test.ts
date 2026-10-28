import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Bone } from "../src/objects/Bone";
import { Skeleton } from "../src/objects/Skeleton";
import { SkinnedMesh } from "../src/objects/SkinnedMesh";
import { Mesh } from "../src/objects/Mesh";
import { Object3D } from "../src/core/Object3D";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Float32BufferAttribute, Uint16BufferAttribute } from "../src/core/BufferAttribute";
import { Raycaster } from "../src/core/Raycaster";
import type { Intersection } from "../src/core/Raycaster";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Vector3 } from "../src/math/Vector3";
import { Vector4 } from "../src/math/Vector4";
import { Frustum } from "../src/math/Frustum";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { BindMode, TextureType, PixelFormat, TextureFilter } from "../src/constants";
import { Bone as ReferenceBone } from "../upstream/three.js/src/objects/Bone.js";
import { Skeleton as ReferenceSkeleton } from "../upstream/three.js/src/objects/Skeleton.js";
import { SkinnedMesh as ReferenceSkinnedMesh } from "../upstream/three.js/src/objects/SkinnedMesh.js";
import { Mesh as ReferenceMesh } from "../upstream/three.js/src/objects/Mesh.js";
import { BufferGeometry as ReferenceGeometry } from "../upstream/three.js/src/core/BufferGeometry.js";
import {
  Float32BufferAttribute as ReferenceAttribute,
  Uint16BufferAttribute as ReferenceIndex,
} from "../upstream/three.js/src/core/BufferAttribute.js";
import { MeshBasicMaterial as ReferenceMaterial } from "../upstream/three.js/src/materials/MeshBasicMaterial.js";

const UpstreamBone = ReferenceBone as unknown as typeof Bone;
const UpstreamSkeleton = ReferenceSkeleton as unknown as typeof Skeleton;
const UpstreamSkinnedMesh = ReferenceSkinnedMesh as unknown as typeof SkinnedMesh;
const UpstreamMesh = ReferenceMesh as unknown as typeof Mesh;
const UpstreamGeometry = ReferenceGeometry as unknown as typeof BufferGeometry;
const UpstreamAttribute = ReferenceAttribute as unknown as typeof Float32BufferAttribute;
const UpstreamIndex = ReferenceIndex as unknown as typeof Uint16BufferAttribute;
const UpstreamMaterial = ReferenceMaterial as unknown as typeof MeshBasicMaterial;

const positions = [-1, -1, 0, 1, -1, 0, 0, 1, 0];
const indices = [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0];
const weights = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function pair() {
  const geometry = new BufferGeometry()
    .setAttribute("position", new Float32BufferAttribute(positions, 3))
    .setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4))
    .setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  const reference = new UpstreamGeometry()
    .setAttribute("position", new UpstreamAttribute(positions, 3))
    .setAttribute("skinIndex", new UpstreamIndex(indices, 4))
    .setAttribute("skinWeight", new UpstreamAttribute(weights, 4));
  const actual = new SkinnedMesh(geometry, new MeshBasicMaterial());
  const expected = new UpstreamSkinnedMesh(reference, new UpstreamMaterial());
  const root = new Bone();
  const tip = new Bone();
  const referenceRoot = new UpstreamBone();
  const referenceTip = new UpstreamBone();
  root.add(tip);
  referenceRoot.add(referenceTip);
  actual.add(root);
  expected.add(referenceRoot);
  tip.position.y = referenceTip.position.y = 2;
  root.name = referenceRoot.name = "root";
  tip.name = referenceTip.name = "tip";
  actual.updateMatrixWorld(true);
  expected.updateMatrixWorld(true);
  const skeleton = new Skeleton([root, tip]);
  const referenceSkeleton = new UpstreamSkeleton([referenceRoot, referenceTip]);
  actual.bind(skeleton);
  expected.bind(referenceSkeleton);
  return { actual, expected, root, tip, referenceRoot, referenceTip, skeleton, referenceSkeleton };
}

function close(actual: ArrayLike<number>, expected: ArrayLike<number>, epsilon = 1e-6) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    assert.ok(Math.abs(actual[i] - expected[i]) <= epsilon, `component ${i}: ${actual[i]} != ${expected[i]}`);
  }
}

function hits(object: Pick<SkinnedMesh, "raycast">, ray: Raycaster) {
  const intersections: Intersection[] = [];
  object.raycast(ray, intersections);
  return intersections.map((hit) => ({
    distance: hit.distance,
    point: hit.point.toArray(),
    faceIndex: hit.faceIndex,
    normal: hit.normal?.toArray(),
    uv: hit.uv?.toArray(),
  }));
}

function rayAt(x: number, y = 0) {
  return new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1));
}

test("bones retain hierarchy, subtype, transforms and first-match skeleton lookup", () => {
  const { actual, root, tip, skeleton, referenceSkeleton } = pair();
  assert.ok(root instanceof Object3D);
  assert.equal(root.isBone, true);
  assert.equal(root.type, "Bone");
  assert.equal(tip.parent, root);
  assert.equal(root.parent, actual);
  assert.equal(skeleton.getBoneByName("root"), root);
  assert.equal(skeleton.getBoneByName("tip"), tip);
  assert.equal(skeleton.getBoneByName("missing"), undefined);
  assert.equal(referenceSkeleton.getBoneByName("missing"), undefined);
  tip.name = "root";
  assert.equal(skeleton.getBoneByName("root"), root);
  const clone = root.clone();
  assert.ok(clone instanceof Bone);
  assert.notEqual(clone.uuid, root.uuid);
  assert.equal(clone.parent, null);
  assert.equal(clone.children.length, 1);
  assert.ok(clone.children[0] instanceof Bone);
  assert.notEqual(clone.children[0], tip);
  assert.equal(clone.children[0].parent, clone);
  assert.deepEqual(clone.children[0].position.toArray(), tip.position.toArray());
  assert.equal(root.clone(false).children.length, 0);
});

test("implicit binding recalculates inverse matrices and pose restores the bind hierarchy", () => {
  const { actual, expected, root, tip, referenceRoot, referenceTip, skeleton, referenceSkeleton } = pair();
  for (const [bone, child] of [
    [root, tip],
    [referenceRoot, referenceTip],
  ] as const) {
    bone.position.set(1, 2, 3);
    bone.rotation.z = 0.3;
    child.position.set(0, 4, 1);
    child.scale.set(1, 2, 1);
  }
  actual.bind(skeleton);
  expected.bind(referenceSkeleton);
  assert.equal(actual.skeleton, skeleton);
  assert.deepEqual(actual.bindMatrix.elements, expected.bindMatrix.elements);
  assert.deepEqual(actual.bindMatrixInverse.elements, expected.bindMatrixInverse.elements);
  const rest = [root, tip].map((bone) => ({
    position: bone.position.toArray(),
    quaternion: bone.quaternion.toArray(),
    scale: bone.scale.toArray(),
  }));
  for (let i = 0; i < skeleton.bones.length; i++) {
    close(skeleton.boneInverses[i].elements, referenceSkeleton.boneInverses[i].elements);
    close(
      new Matrix4().multiplyMatrices(skeleton.bones[i].matrixWorld, skeleton.boneInverses[i]).elements,
      new Matrix4().elements,
    );
  }
  for (const bone of [root, tip, referenceRoot, referenceTip]) {
    bone.position.set(7, -2, 9);
    bone.rotation.set(0.2, -0.4, 0.8);
    bone.scale.set(3, 1, 2);
  }
  actual.updateMatrixWorld(true);
  expected.updateMatrixWorld(true);
  actual.pose();
  expected.pose();
  for (let i = 0; i < skeleton.bones.length; i++) {
    const bone = skeleton.bones[i];
    close(bone.position.toArray(), rest[i].position);
    close(bone.quaternion.toArray(), rest[i].quaternion);
    close(bone.scale.toArray(), rest[i].scale);
    close(bone.matrix.elements, referenceSkeleton.bones[i].matrix.elements);
  }
  actual.updateMatrixWorld(true);
  skeleton.update();
  close(skeleton.boneMatrices!, [...new Matrix4().elements, ...new Matrix4().elements]);
});

test("explicit binding preserves supplied inverses and copies rather than owns the bind matrix", () => {
  const { actual, expected, skeleton, referenceSkeleton } = pair();
  const inverse = skeleton.boneInverses[1];
  const saved = inverse.elements.slice();
  actual.position.set(3, -2, 1);
  expected.position.copy(actual.position);
  actual.updateMatrixWorld(true);
  expected.updateMatrixWorld(true);
  const bindMatrix = new Matrix4().makeRotationZ(0.4).setPosition(2, 3, 4);
  actual.bind(skeleton, bindMatrix);
  expected.bind(referenceSkeleton, bindMatrix);
  assert.equal(skeleton.boneInverses[1], inverse);
  assert.deepEqual(inverse.elements, saved);
  assert.notEqual(actual.bindMatrix, bindMatrix);
  assert.deepEqual(actual.bindMatrix.elements, expected.bindMatrix.elements);
  assert.deepEqual(actual.bindMatrixInverse.elements, expected.bindMatrixInverse.elements);
  bindMatrix.identity();
  assert.notDeepEqual(actual.bindMatrix.elements, bindMatrix.elements);
});

test("skeleton updates pack column-major float matrices and textures retain their storage until disposal", () => {
  for (const count of [0, 1, 4, 5, 17]) {
    const bones = Array.from({ length: count }, () => new Bone());
    const referenceBones = Array.from({ length: count }, () => new UpstreamBone());
    const skeleton = new Skeleton(bones);
    const reference = new UpstreamSkeleton(referenceBones);
    assert.notEqual(skeleton.bones, bones);
    assert.ok(skeleton.boneMatrices instanceof Float32Array);
    assert.equal(skeleton.boneMatrices.length, count * 16);
    bones.forEach((bone, i) => {
      for (const item of [bone, referenceBones[i]]) {
        item.position.set(i + 0.25, -i, 2);
        item.rotation.z = i * 0.2;
        item.scale.set(1, 2, 3);
        item.updateMatrixWorld(true);
      }
    });
    skeleton.update();
    reference.update();
    assert.deepEqual(skeleton.boneMatrices, reference.boneMatrices);
    bones.forEach((bone, i) => close(skeleton.boneMatrices!.slice(i * 16, (i + 1) * 16), bone.matrixWorld.elements));
    const original = skeleton.boneMatrices.slice();
    assert.equal(skeleton.computeBoneTexture(), skeleton);
    reference.computeBoneTexture();
    const texture = skeleton.boneTexture!;
    const size = Math.max(4, Math.ceil(Math.sqrt(count * 4) / 4) * 4);
    assert.equal(texture.image.width, size);
    assert.equal(texture.image.height, size);
    assert.equal(texture.image.data, skeleton.boneMatrices);
    assert.ok(texture.image.data instanceof Float32Array);
    assert.equal(skeleton.boneMatrices.length, size * size * 4);
    assert.deepEqual(skeleton.boneMatrices.slice(0, count * 16), original);
    assert.ok(skeleton.boneMatrices.slice(count * 16).every((value) => value === 0));
    assert.deepEqual(texture.image.data, reference.boneTexture!.image.data);
    assert.equal(texture.format, PixelFormat.RGBA);
    assert.equal(texture.type, TextureType.Float);
    assert.equal(texture.magFilter, TextureFilter.Nearest);
    assert.equal(texture.minFilter, TextureFilter.Nearest);
    assert.equal(texture.generateMipmaps, false);
    const version = texture.version;
    const storage = skeleton.boneMatrices;
    if (count > 0) {
      bones[0].position.x = referenceBones[0].position.x = 12;
      bones[0].updateMatrixWorld(true);
      referenceBones[0].updateMatrixWorld(true);
    }
    skeleton.update();
    reference.update();
    assert.equal(skeleton.boneTexture, texture);
    assert.equal(skeleton.boneMatrices, storage);
    assert.equal(texture.version, version + 1);
    assert.deepEqual(storage, reference.boneMatrices);
    let disposals = 0;
    texture.addEventListener("dispose", () => disposals++);
    skeleton.dispose();
    skeleton.dispose();
    assert.equal(disposals, 1);
    assert.equal(skeleton.boneTexture === null, true);
    assert.equal(skeleton.boneMatrices, storage);
    skeleton.computeBoneTexture();
    assert.notEqual(skeleton.boneTexture, texture);
    assert.deepEqual(skeleton.boneTexture!.image.data, storage);
    skeleton.dispose();
    reference.dispose();
  }
});

test("skeleton clones share bones and inverses but own matrix storage; JSON reconstructs references and inverses", () => {
  const { skeleton, referenceSkeleton, root, tip } = pair();
  skeleton.update();
  skeleton.computeBoneTexture();
  const clone = skeleton.clone();
  assert.notEqual(clone.uuid, skeleton.uuid);
  assert.notEqual(clone.bones, skeleton.bones);
  assert.equal(clone.bones[0], root);
  assert.equal(clone.bones[1], tip);
  assert.equal(clone.boneInverses, skeleton.boneInverses);
  assert.notEqual(clone.boneMatrices, skeleton.boneMatrices);
  assert.equal(clone.boneTexture, null);
  clone.update();
  close(clone.boneMatrices!, skeleton.boneMatrices!.slice(0, 32));
  clone.boneMatrices![0] = 42;
  assert.equal(skeleton.boneMatrices![0], 1);
  const json = JSON.parse(JSON.stringify(skeleton.toJSON()));
  assert.deepEqual(json, {
    ...referenceSkeleton.toJSON(),
    uuid: skeleton.uuid,
    bones: skeleton.bones.map((bone) => bone.uuid),
  });
  const restored = new Skeleton();
  assert.equal(restored.fromJSON(json, { [root.uuid]: root, [tip.uuid]: tip }), restored);
  assert.deepEqual(restored.toJSON(), json);
  assert.equal(restored.bones[0], root);
  assert.equal(restored.bones[1], tip);
  assert.notEqual(restored.boneInverses[0], skeleton.boneInverses[0]);
  restored.update();
  close(restored.boneMatrices!, skeleton.boneMatrices!.slice(0, 32));
  skeleton.dispose();
});

test("skin weights normalize by Manhattan length including negative and all-zero weights", () => {
  const { actual, expected } = pair();
  const values = [2, 3, 5, 0, 0, 0, 0, 0, -2, 2, -4, 0];
  const attribute = new Float32BufferAttribute(values, 4);
  const referenceAttribute = new UpstreamAttribute(values, 4);
  actual.geometry.setAttribute("skinWeight", attribute);
  expected.geometry.setAttribute("skinWeight", referenceAttribute);
  actual.normalizeSkinWeights();
  expected.normalizeSkinWeights();
  assert.equal(actual.geometry.getAttribute("skinWeight"), attribute);
  assert.deepEqual(attribute.array, referenceAttribute.array);
  close(attribute.array, [0.2, 0.3, 0.5, 0, 1, 0, 0, 0, -0.25, 0.25, -0.5, 0]);
  for (let i = 0; i < 3; i++) close([new Vector4().fromBufferAttribute(attribute, i).manhattanLength()], [1]);
  const normalized = Array.from(attribute.array);
  actual.normalizeSkinWeights();
  close(attribute.array, normalized);
});

test("absolute and relative morphs precede blended skin deformation and preserve target identity", () => {
  for (const relative of [false, true]) {
    const { actual, expected, root, tip, referenceRoot, referenceTip } = pair();
    const targets = [
      positions.map((value, i) => (relative ? (i % 3 === 0 ? 2 : 0) : value + (i % 3 === 0 ? 2 : 0))),
      positions.map((value, i) => (relative ? (i % 3 === 1 ? 4 : 0) : value + (i % 3 === 1 ? 4 : 0))),
    ];
    actual.geometry.morphAttributes.position = targets.map((values, i) => {
      const attribute = new Float32BufferAttribute(values, 3);
      attribute.name = i === 0 ? "wide" : "";
      return attribute;
    });
    Object.assign(expected.geometry.morphAttributes, {
      position: targets.map((values, i) => {
        const attribute = new UpstreamAttribute(values, 3);
        attribute.name = i === 0 ? "wide" : "";
        return attribute;
      }),
    });
    actual.geometry.morphTargetsRelative = expected.geometry.morphTargetsRelative = relative;
    actual.updateMorphTargets();
    expected.updateMorphTargets();
    assert.deepEqual(actual.morphTargetDictionary, { wide: 0, "1": 1 });
    assert.deepEqual(actual.morphTargetInfluences, [0, 0]);
    const plain = new Mesh(actual.geometry, actual.material);
    const referencePlain = new UpstreamMesh(expected.geometry, expected.material);
    for (const mesh of [actual, expected]) {
      const skinWeights = mesh.geometry.getAttribute("skinWeight") as Float32BufferAttribute;
      for (let i = 0; i < 3; i++) skinWeights.setXYZW(i, 0.25, 0.75, 0, 0);
    }
    root.position.x = referenceRoot.position.x = 3;
    tip.rotation.z = referenceTip.rotation.z = Math.PI / 2;
    actual.updateMatrixWorld(true);
    expected.updateMatrixWorld(true);
    for (const influences of [
      [0, 0],
      [0.25, 0.5],
      [0.75, 0.75],
      [-0.5, 0.25],
    ]) {
      actual.morphTargetInfluences = influences.slice();
      expected.morphTargetInfluences = influences.slice();
      plain.morphTargetInfluences = influences.slice();
      referencePlain.morphTargetInfluences = influences.slice();
      for (let i = 0; i < 3; i++) {
        const morphed = new Vector3();
        assert.equal(plain.getVertexPosition(i, morphed), morphed);
        close(morphed.toArray(), referencePlain.getVertexPosition(i, new Vector3()).toArray());
        close(morphed.toArray(), [positions[i * 3] + 2 * influences[0], positions[i * 3 + 1] + 4 * influences[1], 0]);
        const target = new Vector3();
        assert.equal(actual.getVertexPosition(i, target), target);
        close(target.toArray(), expected.getVertexPosition(i, new Vector3()).toArray());
        close(target.toArray(), actual.applyBoneTransform(i, morphed).toArray());
      }
    }
  }
});

test("bone transforms distinguish Vector3 positions and Vector4 homogeneous positions and directions", () => {
  const { actual, expected, root, referenceRoot } = pair();
  root.position.set(3, 4, 5);
  referenceRoot.position.copy(root.position);
  root.rotation.z = referenceRoot.rotation.z = Math.PI / 2;
  actual.updateMatrixWorld(true);
  expected.updateMatrixWorld(true);
  const position = new Vector3(1, 0, 0);
  assert.equal(actual.applyBoneTransform(0, position), position);
  close(position.toArray(), [3, 5, 5]);
  close(position.toArray(), expected.applyBoneTransform(0, new Vector3(1, 0, 0)).toArray());
  for (const w of [0, 1]) {
    const target = new Vector4(1, 0, 0, w);
    assert.equal(actual.applyBoneTransform(0, target), target);
    close(target.toArray(), expected.applyBoneTransform(0, new Vector4(1, 0, 0, w)).toArray());
    close(target.toArray(), w === 0 ? [0, 1, 0, 0] : [3, 5, 5, 1]);
    assert.equal(target.w, w);
  }
});

test("skinned mesh clones share resources and skeletons but isolate bind matrices, morph weights and bounds", () => {
  const { actual, expected, skeleton } = pair();
  actual.morphTargetInfluences = expected.morphTargetInfluences = [0.5];
  actual.morphTargetDictionary = expected.morphTargetDictionary = { smile: 0 };
  actual.computeBoundingBox();
  actual.computeBoundingSphere();
  expected.computeBoundingBox();
  expected.computeBoundingSphere();
  const reference = expected.clone();
  const clone = actual.clone();
  const copy = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial()).copy(actual, false);
  for (const result of [clone, copy]) {
    assert.ok(result instanceof SkinnedMesh);
    assert.equal(result.geometry, actual.geometry);
    assert.equal(result.material, actual.material);
    assert.equal(result.skeleton, actual.skeleton);
    assert.notEqual(result.bindMatrix, actual.bindMatrix);
    assert.notEqual(result.bindMatrixInverse, actual.bindMatrixInverse);
    assert.deepEqual(result.bindMatrix.elements, reference.bindMatrix.elements);
    assert.notEqual(result.boundingBox, actual.boundingBox);
    assert.notEqual(result.boundingSphere, actual.boundingSphere);
    assert.deepEqual(result.boundingBox!.min.toArray(), reference.boundingBox!.min.toArray());
    assert.deepEqual(result.boundingSphere!.center.toArray(), reference.boundingSphere!.center.toArray());
    assert.notEqual(result.morphTargetInfluences, actual.morphTargetInfluences);
    assert.notEqual(result.morphTargetDictionary, actual.morphTargetDictionary);
    result.bindMatrix.elements[12] = 99;
    result.boundingBox!.min.x = -99;
    result.morphTargetInfluences![0] = 1;
  }
  assert.equal(clone.children.length, reference.children.length);
  assert.notEqual(clone.children[0], actual.children[0]);
  assert.ok(clone.children[0] instanceof Bone);
  assert.equal(copy.children.length, 0);
  assert.equal(actual.bindMatrix.elements[12], 0);
  assert.equal(actual.boundingBox!.min.x, -1);
  assert.deepEqual(actual.morphTargetInfluences, [0.5]);
  const json = actual.toJSON();
  const referenceJSON = expected.toJSON("") as {
    object: { bindMatrix: number[]; bindMode: BindMode };
    skeletons: unknown[];
  };
  assert.equal(json.object.type, "SkinnedMesh");
  assert.equal(json.object.skeleton, actual.skeleton.uuid);
  assert.deepEqual(json.object.bindMatrix, referenceJSON.object.bindMatrix);
  assert.equal(json.object.bindMode, referenceJSON.object.bindMode);
  assert.equal(json.skeletons.length, 1);
  assert.equal(referenceJSON.skeletons.length, 1);
  const restored = new Skeleton().fromJSON(
    JSON.parse(JSON.stringify(json.skeletons[0])),
    Object.fromEntries(skeleton.bones.map((bone) => [bone.uuid, bone])),
  );
  assert.deepEqual(restored.toJSON().boneInverses, actual.skeleton.toJSON().boneInverses);
});

test("animated bounds, culling and picking require refresh and include morph and skin deformation", () => {
  const { actual, expected, root, referenceRoot } = pair();
  actual.geometry.morphTargetsRelative = expected.geometry.morphTargetsRelative = true;
  const offsets = [2, 0, 0, 2, 0, 0, 2, 0, 0];
  actual.geometry.morphAttributes.position = [new Float32BufferAttribute(offsets, 3)];
  Object.assign(expected.geometry.morphAttributes, { position: [new UpstreamAttribute(offsets, 3)] });
  actual.updateMorphTargets();
  expected.updateMorphTargets();
  actual.geometry.computeBoundingBox();
  expected.geometry.computeBoundingBox();
  const geometryBox = actual.geometry.boundingBox!.clone();
  const camera = new OrthographicCamera(-3, 3, 3, -3, 0.1, 20);
  camera.position.z = 10;
  camera.updateMatrixWorld(true);
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
  assert.equal(actual.boundingSphere === null, true);
  assert.equal(frustum.intersectsObject(actual), true);
  assert.ok(actual.boundingSphere);
  actual.computeBoundingBox();
  expected.computeBoundingBox();
  expected.computeBoundingSphere();
  assert.equal(hits(actual, rayAt(0)).length, 1);
  const oldBox = actual.boundingBox!.clone();
  root.position.x = referenceRoot.position.x = 10;
  actual.morphTargetInfluences![0] = expected.morphTargetInfluences![0] = 1;
  actual.updateMatrixWorld(true);
  expected.updateMatrixWorld(true);
  assert.deepEqual(actual.boundingBox, oldBox);
  assert.equal(frustum.intersectsObject(actual), true);
  assert.deepEqual(hits(actual, rayAt(12)), []);
  actual.computeBoundingSphere();
  expected.computeBoundingSphere();
  assert.deepEqual(hits(actual, rayAt(12)), []);
  actual.computeBoundingBox();
  expected.computeBoundingBox();
  assert.equal(frustum.intersectsObject(actual), false);
  assert.deepEqual(actual.boundingBox!.min.toArray(), [11, -1, 0]);
  assert.deepEqual(actual.boundingBox!.max.toArray(), [13, 1, 0]);
  assert.deepEqual(actual.boundingBox!.min.toArray(), expected.boundingBox!.min.toArray());
  close(actual.boundingSphere!.center.toArray(), expected.boundingSphere!.center.toArray());
  assert.equal(actual.boundingSphere!.radius, expected.boundingSphere!.radius);
  assert.equal(hits(actual, rayAt(12)).length, 1);
  assert.deepEqual(hits(actual, rayAt(12)), hits(expected, rayAt(12)));
  assert.deepEqual(hits(actual, rayAt(0)), []);
  assert.deepEqual(actual.geometry.boundingBox, geometryBox);
  const clipped = rayAt(12);
  clipped.far = 5;
  assert.deepEqual(hits(actual, clipped), []);
  clipped.far = 20;
  clipped.near = 11;
  assert.deepEqual(hits(actual, clipped), []);
});

test("attached and detached modes use their respective inverse bind spaces under transformed picking", () => {
  for (const mode of [BindMode.Attached, BindMode.Detached] as const) {
    const { actual, expected, root, referenceRoot } = pair();
    actual.bindMode = expected.bindMode = mode;
    actual.position.set(4, -2, 1);
    expected.position.copy(actual.position);
    actual.rotation.z = expected.rotation.z = Math.PI / 2;
    actual.scale.set(2, 3, 1);
    expected.scale.copy(actual.scale);
    root.position.x = referenceRoot.position.x = 1;
    actual.updateMatrixWorld(true);
    expected.updateMatrixWorld(true);
    close(actual.bindMatrixInverse.elements, expected.bindMatrixInverse.elements);
    close(
      actual.bindMatrixInverse.elements,
      mode === BindMode.Attached ? new Matrix4().copy(actual.matrixWorld).invert().elements : new Matrix4().elements,
    );
    actual.computeBoundingBox();
    expected.computeBoundingBox();
    actual.computeBoundingSphere();
    expected.computeBoundingSphere();
    const center = new Vector3();
    for (let i = 0; i < 3; i++) {
      const vertex = actual.getVertexPosition(i, new Vector3());
      close(vertex.toArray(), expected.getVertexPosition(i, new Vector3()).toArray());
      center.add(vertex);
    }
    center.multiplyScalar(1 / 3).applyMatrix4(actual.matrixWorld);
    const ray = rayAt(center.x, center.y);
    const intersections = hits(actual, ray);
    assert.equal(intersections.length, 1);
    assert.deepEqual(intersections, hits(expected, ray));
    close(intersections[0].point, center.toArray());
    close(actual.boundingBox!.min.toArray(), expected.boundingBox!.min.toArray());
    close(actual.boundingBox!.max.toArray(), expected.boundingBox!.max.toArray());
  }
});
