import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { BufferGeometryLoader } from "../src/loaders/BufferGeometryLoader";
import { MaterialLoader } from "../src/loaders/MaterialLoader";
import { ObjectLoader } from "../src/loaders/ObjectLoader";
import { AnimationLoader } from "../src/loaders/AnimationLoader";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Float32BufferAttribute, Uint16BufferAttribute } from "../src/core/BufferAttribute";
import { InstancedBufferAttribute } from "../src/core/InstancedBufferAttribute";
import { InstancedBufferGeometry } from "../src/core/InstancedBufferGeometry";
import { InterleavedBuffer } from "../src/core/InterleavedBuffer";
import { InstancedInterleavedBuffer } from "../src/core/InstancedInterleavedBuffer";
import { InterleavedBufferAttribute } from "../src/core/InterleavedBufferAttribute";
import { Object3D } from "../src/core/Object3D";
import { Scene } from "../src/scenes/Scene";
import { Mesh } from "../src/objects/Mesh";
import { Group } from "../src/objects/Group";
import { SkinnedMesh } from "../src/objects/SkinnedMesh";
import { InstancedMesh } from "../src/objects/InstancedMesh";
import { BatchedMesh } from "../src/objects/BatchedMesh";
import { Bone } from "../src/objects/Bone";
import { Skeleton } from "../src/objects/Skeleton";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { MeshPhysicalMaterial } from "../src/materials/MeshPhysicalMaterial";
import { ShaderMaterial } from "../src/materials/ShaderMaterial";
import { DataTexture } from "../src/textures/DataTexture";
import { AnimationClip } from "../src/animation/AnimationClip";
import { NumberKeyframeTrack } from "../src/animation/tracks/NumberKeyframeTrack";
import { VectorKeyframeTrack } from "../src/animation/tracks/VectorKeyframeTrack";
import { QuaternionKeyframeTrack } from "../src/animation/tracks/QuaternionKeyframeTrack";
import { BooleanKeyframeTrack } from "../src/animation/tracks/BooleanKeyframeTrack";
import { StringKeyframeTrack } from "../src/animation/tracks/StringKeyframeTrack";
import { ColorKeyframeTrack } from "../src/animation/tracks/ColorKeyframeTrack";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { ShapeGeometry } from "../src/geometries/ShapeGeometry";
import { Shape } from "../src/extras/core/Shape";
import { LineCurve } from "../src/extras/curves/LineCurve";
import { Matrix4 } from "../src/math/Matrix4";
import { RepeatWrapping, SRGBColorSpace, DynamicDrawUsage } from "../src/constants";

function triangle() {
  return new BufferGeometry().setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
}

const factories = {
  objects: { Object3D, Scene, Group, Mesh, SkinnedMesh, InstancedMesh, BatchedMesh, Bone },
  materials: { MeshBasicMaterial, MeshPhysicalMaterial, ShaderMaterial },
  geometries: { BoxGeometry, ShapeGeometry },
};

test("BufferGeometryLoader preserves interleaved ownership, morphs, index, groups and UUID", () => {
  const geometry = triangle();
  const shared = new InterleavedBuffer(new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1]), 6);
  shared.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", new InterleavedBufferAttribute(shared, 3, 0));
  geometry.setAttribute("normal", new InterleavedBufferAttribute(shared, 3, 3));
  geometry.setIndex([0, 1]);
  geometry.morphAttributes.position = [new Float32BufferAttribute([1, 0, 0, 2, 0, 0], 3)];
  geometry.morphTargetsRelative = true;
  geometry.addGroup(0, 2, 1);
  geometry.computeBoundingSphere();
  geometry.name = "shared";
  geometry.userData = { fixture: true };
  const parsed = new BufferGeometryLoader().parse(geometry.toJSON());
  const position = parsed.getAttribute("position");
  const normal = parsed.getAttribute("normal");
  assert(position instanceof InterleavedBufferAttribute);
  assert(normal instanceof InterleavedBufferAttribute);
  assert.equal(position.data, normal.data);
  assert.equal(position.data.uuid, shared.uuid);
  assert.equal(position.data.usage, DynamicDrawUsage);
  assert.equal(parsed.uuid, geometry.uuid);
  assert.deepEqual(Array.from(position.data.array), Array.from(shared.array));
  assert.deepEqual(parsed.index!.array, geometry.index!.array);
  assert.deepEqual(parsed.morphAttributes.position[0].array, geometry.morphAttributes.position[0].array);
  assert.equal(parsed.morphTargetsRelative, true);
  assert.deepEqual(parsed.groups, geometry.groups);
  assert.deepEqual(parsed.boundingSphere, geometry.boundingSphere);
  assert.deepEqual(parsed.userData, geometry.userData);
  assert.throws(() => new BufferGeometryLoader().parse({ type: "Unknown", data: {} }), /Unknown geometry type/);
});

test("instanced geometry retains divisor and custom attribute metadata", () => {
  const geometry = new InstancedBufferGeometry();
  geometry.instanceCount = 7;
  geometry.setAttribute(
    "shared",
    new InterleavedBufferAttribute(new InstancedInterleavedBuffer(new Float32Array([2, 4, 6]), 3, 2), 3, 0),
  );
  geometry.setAttribute("offset", new InstancedBufferAttribute(new Float32Array([1, 2, 3]), 3, false, 4));
  const parsed = new BufferGeometryLoader().parse(geometry.toJSON());
  assert(parsed instanceof InstancedBufferGeometry);
  const attribute = parsed.getAttribute("offset");
  assert(attribute instanceof InstancedBufferAttribute);
  assert.equal(attribute.meshPerAttribute, 4);
  assert.equal(parsed.instanceCount, 7);
  const shared = parsed.getAttribute("shared");
  assert(shared instanceof InterleavedBufferAttribute);
  assert(shared.data instanceof InstancedInterleavedBuffer);
  assert.equal(shared.data.meshPerAttribute, 2);
});

test("MaterialLoader explicit constructors retain physical properties and texture references", () => {
  const texture = new DataTexture(new Uint8Array([255, 64, 32, 255]), 1, 1);
  const material = new MeshPhysicalMaterial({ roughness: 0.25, metalness: 0.6, clearcoat: 0.8, transmission: 0.4 });
  material.map = texture;
  material.normalMap = texture;
  material.name = "physical";
  const loader = new MaterialLoader(undefined, { MeshPhysicalMaterial });
  loader.setTextures({ [texture.uuid]: texture });
  const parsed = loader.parse(material.toJSON());
  assert(parsed instanceof MeshPhysicalMaterial);
  assert.equal(parsed.uuid, material.uuid);
  assert.equal(parsed.map, texture);
  assert.equal(parsed.normalMap, texture);
  for (const property of ["roughness", "metalness", "clearcoat", "transmission", "ior", "reflectivity"] as const) {
    assert.ok(Math.abs(parsed[property] - material[property]) < 1e-12, property);
  }
  assert.equal(parsed.name, material.name);
  assert.throws(() => loader.parse({ type: "MeshBasicMaterial" }), /Unknown material type/);
  assert.throws(() => loader.parse({ type: "constructor" }), /Unknown material type/);
  assert.throws(() => new MaterialLoader().parse(material.toJSON()), /Unknown material type/);
});

test("shader material JSON retains uniforms and GLSL source", () => {
  const original = new ShaderMaterial({
    uniforms: { strength: { value: 3 } },
    vertexShader: "void main(){}",
    fragmentShader: "void main(){}",
  });
  const restored = new MaterialLoader(undefined, { ShaderMaterial }).parse(original.toJSON());
  assert(restored instanceof ShaderMaterial);
  assert.equal(restored.uniforms.strength.value, 3);
  assert.equal(restored.vertexShader, original.vertexShader);
  assert.equal(restored.fragmentShader, original.fragmentShader);
});

test("ObjectLoader round trip preserves resource identity, UUIDs, textures and animations", async () => {
  const texture = new DataTexture(new Uint8Array([1, 2, 3, 255]), 1, 1);
  texture.wrapS = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(2, 3);
  const material = new MeshBasicMaterial({ map: texture });
  const geometry = triangle();
  const scene = new Scene();
  const first = new Mesh(geometry, material);
  const second = new Mesh(geometry, material);
  first.name = "first";
  second.name = "second";
  scene.add(first, second);
  const clip = new AnimationClip("move", 1, [new NumberKeyframeTrack(".position[x]", [0, 1], [0, 2])]);
  first.animations.push(clip);
  second.animations.push(clip);
  const json = scene.toJSON();
  const loader = new ObjectLoader(undefined, factories);
  for (const restored of [loader.parse(json), await loader.parseAsync(json)]) {
    const a = restored.children[0];
    const b = restored.children[1];
    assert(a instanceof Mesh && b instanceof Mesh);
    assert.equal(restored.uuid, scene.uuid);
    assert.equal(a.uuid, first.uuid);
    assert.equal(a.geometry, b.geometry);
    assert.equal(a.material, b.material);
    assert(a.material instanceof MeshBasicMaterial);
    assert(a.material.map instanceof DataTexture);
    assert.equal(a.material.map.uuid, texture.uuid);
    assert.equal(a.material.map.source.uuid, texture.source.uuid);
    assert.equal(a.material.map.wrapS, RepeatWrapping);
    assert.equal(a.material.map.colorSpace, SRGBColorSpace);
    assert.deepEqual(a.material.map.repeat.toArray(), [2, 3]);
    assert.deepEqual(Array.from(a.material.map.image.data!), [1, 2, 3, 255]);
    assert.equal(a.animations[0], b.animations[0]);
    assert.equal(a.animations[0].uuid, clip.uuid);
    assert.equal(restored.toJSON().object.uuid, scene.uuid);
  }
});

test("ObjectLoader restores skinning, bone references and instanced transforms", () => {
  const geometry = triangle();
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Uint16Array(12), 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const material = new MeshBasicMaterial();
  const bone = new Bone();
  const skin = new SkinnedMesh(geometry, material);
  skin.add(bone);
  skin.bind(new Skeleton([bone]));
  const instances = new InstancedMesh(geometry, material, 2);
  const matrix = new Matrix4().makeTranslation(3, 4, 5);
  instances.setMatrixAt(1, matrix);
  const group = new Group().add(skin, instances);
  const restored = new ObjectLoader(undefined, factories).parse(group.toJSON());
  const restoredSkin = restored.children[0];
  const restoredInstances = restored.children[1];
  assert(restoredSkin instanceof SkinnedMesh && restoredInstances instanceof InstancedMesh);
  assert.equal(restoredSkin.skeleton.uuid, skin.skeleton.uuid);
  assert.equal(restoredSkin.skeleton.bones[0], restoredSkin.children[0]);
  assert.deepEqual(restoredSkin.bindMatrix.elements, skin.bindMatrix.elements);
  assert.equal(restoredSkin.geometry, restoredInstances.geometry);
  assert.equal(restoredInstances.count, 2);
  const result = new Matrix4();
  restoredInstances.getMatrixAt(1, result);
  assert.deepEqual(result.elements, matrix.elements);
});

test("ObjectLoader explicit geometry and curve factories restore shape geometry", () => {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1, 0);
  shape.lineTo(0, 1);
  shape.closePath();
  const mesh = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial());
  const loader = new ObjectLoader(undefined, {
    ...factories,
    createCurve(json) {
      if (json.type !== "LineCurve") throw new Error(`Unknown curve ${json.type}`);
      return new LineCurve().fromJSON(json);
    },
  });
  const parsed = loader.parse(mesh.toJSON());
  assert(parsed instanceof Mesh);
  assert(parsed.geometry instanceof ShapeGeometry);
  const actualPosition = parsed.geometry.getAttribute("position");
  const expectedPosition = mesh.geometry.getAttribute("position");
  assert(actualPosition instanceof Float32BufferAttribute && expectedPosition instanceof Float32BufferAttribute);
  assert.deepEqual(actualPosition.array, expectedPosition.array);
  assert.throws(() => new ObjectLoader(undefined, factories).parse(mesh.toJSON()), /Unknown curve type/);
  assert.throws(
    () =>
      new ObjectLoader(undefined, { objects: { Mesh }, materials: { MeshBasicMaterial } }).parse(
        new Mesh(new BoxGeometry(), new MeshBasicMaterial()).toJSON(),
      ),
    /Unknown geometry type/,
  );
  assert.throws(() => loader.parse({ object: { type: "MissingObject" } }), /Unknown object type/);
  assert.throws(() => loader.parse({ object: { type: "toString" } }), /Unknown object type/);
});

test("ObjectLoader restores BatchedMesh capacities, geometry ranges and instance textures", () => {
  const original = new BatchedMesh(3, 9, 9, new MeshBasicMaterial());
  const geometryId = original.addGeometry(triangle());
  const instanceId = original.addInstance(geometryId);
  const matrix = new Matrix4().makeTranslation(4, 5, 6);
  original.setMatrixAt(instanceId, matrix);
  const restored = new ObjectLoader(undefined, factories).parse(original.toJSON());
  assert(restored instanceof BatchedMesh);
  assert.equal(restored.maxInstanceCount, original.maxInstanceCount);
  assert.equal(restored.instanceCount, original.instanceCount);
  assert.deepEqual(restored._geometryInfo, original._geometryInfo);
  const actual = new Matrix4();
  restored.getMatrixAt(instanceId, actual);
  assert.deepEqual(actual.elements, matrix.elements);
  assert.equal(restored._matricesTexture!.uuid, original._matricesTexture!.uuid);
  assert.equal(restored._indirectTexture!.uuid, original._indirectTexture!.uuid);
  original.dispose();
  restored.dispose();
});

test("AnimationLoader preserves every core track kind and rejects unknown tracks", () => {
  const tracks = [
    new NumberKeyframeTrack(".opacity", [0, 1], [0, 1]),
    new VectorKeyframeTrack(".position", [0, 1], [0, 0, 0, 1, 2, 3]),
    new QuaternionKeyframeTrack(".quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 1, 0]),
    new ColorKeyframeTrack(".color", [0, 1], [1, 0, 0, 0, 1, 0]),
    new BooleanKeyframeTrack(".visible", [0, 1], [false, true]),
    new StringKeyframeTrack(".name", [0, 1], ["a", "b"]),
  ];
  const clip = new AnimationClip("all", 1, tracks);
  const json = AnimationClip.toJSON(clip);
  const parsed = new AnimationLoader().parse([json]);
  assert.equal(parsed[0].uuid, clip.uuid);
  assert.deepEqual(AnimationClip.toJSON(parsed[0]), json);
  assert.throws(
    () =>
      new AnimationLoader().parse([
        { name: "bad", tracks: [{ name: ".x", type: "unknown", times: [0], values: [1] }] },
      ]),
    /Unsupported type|unsupported type|Unknown/i,
  );
});
