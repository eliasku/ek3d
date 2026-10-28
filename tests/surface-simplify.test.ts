import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SimplifyModifier, type MeshoptSimplifierLike } from "../src/addons/modifiers/SimplifyModifier";
import { MeshSurfaceSampler } from "../src/addons/math/MeshSurfaceSampler";
import { mergeVertices } from "../src/addons/utils/BufferGeometryUtils";
import { BufferAttribute, Float32BufferAttribute } from "../src/core/BufferAttribute";
import { InterleavedBufferAttribute } from "../src/core/InterleavedBufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Color } from "../src/math/Color";
import { Vector2 } from "../src/math/Vector2";
import { Vector3 } from "../src/math/Vector3";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Mesh } from "../src/objects/Mesh";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { SphereGeometry } from "../src/geometries/SphereGeometry";

// The simplifier runtime is consumer-supplied vendor code: the test loads the packaged public
// asset at runtime and bundles no copy, so a static import cannot work — publicDir assets are
// not module graph entries. Nothing here compares against the upstream modifier implementation.
let runtime: Promise<MeshoptSimplifierLike> | undefined;

function loadSimplifier(): Promise<MeshoptSimplifierLike> {
  runtime ??= (async () => {
    const source = readFileSync("examples/public/examples/libs/meshopt_simplifier.module.js", "utf8");
    const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
    const module = (await import(/* @vite-ignore */ url)) as { MeshoptSimplifier: MeshoptSimplifierLike };
    return module.MeshoptSimplifier;
  })();
  return runtime;
}

/** Deterministic generator returning the given sequence cyclically. */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

function square(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

/** Two disjoint triangles so one face can carry zero weight. */
function twoTriangles(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 4, 0, 0, 5, 0, 0, 5, 1, 0], 3),
  );
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  return geometry;
}

test("sampler builds cumulative area weights over the whole surface", () => {
  const sampler = new MeshSurfaceSampler(new Mesh(square(), new MeshBasicMaterial())).build();

  const distribution = sampler.distribution;
  assert.ok(distribution instanceof Float32Array);
  assert.equal(distribution.length, 2);
  assert.equal(distribution[0], 0.5);
  assert.equal(distribution[1], 1);
});

test("sampler never samples zero-weight faces", () => {
  const geometry = twoTriangles();
  geometry.setAttribute("weight", new Float32BufferAttribute([1, 1, 1, 0, 0, 0], 1));

  const sampler = new MeshSurfaceSampler(new Mesh(geometry, new MeshBasicMaterial()))
    .setWeightAttribute("weight")
    .setRandomGenerator(sequence([0.99, 0.2, 0.2, 0.99, 0.1, 0.7]))
    .build();

  // The zero-weight face adds nothing to the cumulative distribution.
  assert.equal(sampler.distribution?.[1], sampler.distribution?.[0]);

  const position = new Vector3();
  for (let i = 0; i < 12; i++) {
    sampler.sample(position);
    // The weighted face is the triangle (0,0) (1,0) (1,1): points satisfy y <= x.
    assert.equal(position.z, 0);
    const at = JSON.stringify(position.toArray());
    assert.ok(position.x >= 0 && position.x <= 1, `x outside the weighted face: ${at}`);
    assert.ok(position.y >= 0 && position.y <= 1, `y outside the weighted face: ${at}`);
    assert.ok(position.y <= position.x + 1e-12, `sampled outside the weighted face: ${at}`);
  }
});

test("sampler interpolates uv, color and normal deterministically for a seeded generator", () => {
  const geometry = square();
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setAttribute("color", new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1], 3));

  const first = new MeshSurfaceSampler(new Mesh(geometry, new MeshBasicMaterial()))
    .setRandomGenerator(sequence([0, 0, 0]))
    .build();
  const second = new MeshSurfaceSampler(new Mesh(geometry, new MeshBasicMaterial()))
    .setRandomGenerator(sequence([0, 0, 0]))
    .build();

  const position = new Vector3();
  const normal = new Vector3();
  const color = new Color();
  const uv = new Vector2();

  first.sample(position, normal, color, uv);
  // u = 0 and v = 0 leave the third vertex, so every interpolated attribute equals it.
  assert.deepEqual(position.toArray(), [1, 1, 0]);
  assert.deepEqual(uv.toArray(), [1, 1]);
  assert.deepEqual([color.r, color.g, color.b], [0, 0, 1]);
  // Without a normal attribute the geometric face normal is returned.
  assert.ok(Math.abs(normal.x) < 1e-12);
  assert.ok(Math.abs(normal.y) < 1e-12);
  assert.ok(Math.abs(normal.z - 1) < 1e-12);

  const mirrored = new Vector3();
  const mirroredNormal = new Vector3();
  const mirroredColor = new Color();
  const mirroredUV = new Vector2();
  second.sample(mirrored, mirroredNormal, mirroredColor, mirroredUV);
  assert.deepEqual(mirrored.toArray(), position.toArray());
  assert.deepEqual(mirroredNormal.toArray(), normal.toArray());
  assert.deepEqual(mirroredUV.toArray(), uv.toArray());
  assert.deepEqual([mirroredColor.r, mirroredColor.g, mirroredColor.b], [color.r, color.g, color.b]);
});

test("sampler interpolates an existing normal attribute and normalizes it", () => {
  const geometry = square();
  geometry.setAttribute("normal", new Float32BufferAttribute([2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1], 3));

  const sampler = new MeshSurfaceSampler(new Mesh(geometry, new MeshBasicMaterial()))
    .setRandomGenerator(sequence([0, 0, 0.5, 0.5]))
    .build();

  const position = new Vector3();
  const normal = new Vector3();
  // u = 0 and v = 0.5 interpolate the second and third vertex normals: (0, 0.5, 0.5).
  sampler.sample(position, normal);
  assert.deepEqual(position.toArray(), [1, 0.5, 0]);
  assert.ok(Math.abs(normal.length() - 1) < 1e-12);
  assert.equal(normal.x, 0);
  assert.ok(Math.abs(normal.y - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(normal.z - Math.SQRT1_2) < 1e-12);
});

test("sampler needs build() and a CPU-readable position attribute", () => {
  assert.throws(
    () => new MeshSurfaceSampler(new Mesh(new BufferGeometry(), new MeshBasicMaterial())),
    /position attribute/,
  );

  const sampler = new MeshSurfaceSampler(new Mesh(square(), new MeshBasicMaterial()));
  assert.throws(() => sampler.sample(new Vector3()), /build\(\)/);

  // An empty surface builds an empty distribution; sampling must not index into it.
  const empty = new BufferGeometry();
  empty.setAttribute("position", new Float32BufferAttribute([], 3));
  const noFaces = new MeshSurfaceSampler(new Mesh(empty, new MeshBasicMaterial())).build();
  assert.deepEqual(noFaces.distribution?.length, 0);
  assert.throws(() => noFaces.sample(new Vector3()), /no faces/);
});

test("simplifier refuses to run without a consumer-provided runtime", async () => {
  await assert.rejects(new SimplifyModifier().modify(new BoxGeometry(), 12), /setSimplifier\(\)/);

  const modifier = new SimplifyModifier().setSimplifier(null);
  await assert.rejects(modifier.modify(new BoxGeometry(), 12), /setSimplifier\(\)/);
});

type Attribute = BufferAttribute | InterleavedBufferAttribute;

/** Reads a CPU attribute; the fixtures never use GPU-only buffers. */
function attribute(geometry: BufferGeometry, name: string): Attribute {
  const found = geometry.getAttribute(name);
  assert.ok(found instanceof BufferAttribute || found instanceof InterleavedBufferAttribute);
  return found;
}

function vertexCount(geometry: BufferGeometry): number {
  return attribute(geometry, "position").count;
}

function indexCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  assert.ok(index !== null);
  return index.count;
}

function positions(geometry: BufferGeometry): string[] {
  const position = attribute(geometry, "position");
  const result: string[] = [];
  for (let i = 0; i < position.count; i++) result.push(`${position.getX(i)},${position.getY(i)},${position.getZ(i)}`);
  return result;
}

/** Asserts the compacted result: every vertex is referenced and every position came from the input. */
function assertCompacted(source: BufferGeometry, result: BufferGeometry): void {
  const index = result.getIndex();
  assert.ok(index !== null);
  assert.equal(index.count % 3, 0);

  const count = vertexCount(result);
  assert.ok(count > 0);

  const referenced = new Set<number>();
  for (let i = 0; i < index.count; i++) {
    const vertex = index.getX(i);
    assert.ok(vertex >= 0 && vertex < count, `index ${vertex} outside ${count} vertices`);
    referenced.add(vertex);
  }
  assert.equal(referenced.size, count, "every result vertex must be referenced by the index");

  const sourcePositions = new Set(positions(source));
  for (const position of positions(result)) {
    assert.ok(sourcePositions.has(position), `result vertex ${position} is not an input vertex`);
  }
}

test("simplifier reduces indexed geometry and rebuilds every attribute densely", async () => {
  const simplifier = await loadSimplifier();
  const geometry = new SphereGeometry(1, 24, 16);
  const sourceVertices = vertexCount(geometry);
  const sourceIndices = indexCount(geometry);

  const result = await new SimplifyModifier()
    .setSimplifier(simplifier)
    .modify(geometry, Math.floor(sourceVertices * 0.75));

  assert.ok(indexCount(result) < sourceIndices);
  assert.ok(vertexCount(result) < sourceVertices);

  const normal = attribute(result, "normal");
  const uv = attribute(result, "uv");
  assert.equal(vertexCount(result), normal.count);
  assert.equal(vertexCount(result), uv.count);
  assertCompacted(geometry, result);

  // Normals are copied verbatim alongside positions, so they stay unit length.
  for (let i = 0; i < normal.count; i++) {
    const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
    assert.ok(Math.abs(length - 1) < 1e-5, `normal ${i} has length ${length}`);
  }
});

test("simplifier welds non-indexed geometry before reducing it", async () => {
  const simplifier = await loadSimplifier();
  // A box is already minimal, so use a smooth non-indexed surface that has slack to collapse.
  const nonIndexed = new SphereGeometry(1, 16, 12).toNonIndexed();
  assert.equal(nonIndexed.getIndex(), null);

  // Welding is what makes collapsing possible; without it the shared vertices stay split.
  const welded = mergeVertices(nonIndexed);
  const result = await new SimplifyModifier().setSimplifier(simplifier).modify(nonIndexed, 200);

  assert.ok(indexCount(result) < indexCount(welded));
  assert.ok(vertexCount(result) < vertexCount(welded));
  assert.ok(indexCount(result) > 0);
  assertCompacted(welded, result);
});

test("simplifier boundaries: no removal keeps the triangles, over-reduction stops at one", async () => {
  const simplifier = await loadSimplifier();
  const modifier = new SimplifyModifier().setSimplifier(simplifier);
  const geometry = new SphereGeometry(1, 12, 8);

  const untouched = await modifier.modify(geometry, 0);
  assert.equal(indexCount(untouched), indexCount(geometry));

  const minimal = await modifier.modify(geometry, vertexCount(geometry) * 10);
  // The target clamps to three indices, but a closed surface cannot always collapse that far.
  assert.ok(indexCount(minimal) < indexCount(geometry));
  assert.equal(indexCount(minimal) % 3, 0);
  assert.ok(vertexCount(minimal) < vertexCount(geometry));
  assertCompacted(geometry, minimal);
});

test("simplifier accepts an 8-bit index buffer and returns a usable index", async () => {
  const simplifier = await loadSimplifier();
  const geometry = new SphereGeometry(1, 6, 4);
  const source = geometry.getIndex();
  assert.ok(source !== null);
  // glTF may deliver 8-bit indices; meshopt only accepts 16/32-bit ones.
  geometry.setIndex(new BufferAttribute(Uint8Array.from(source.array), 1));

  const result = await new SimplifyModifier().setSimplifier(simplifier).modify(geometry, 20);

  assert.ok(indexCount(result) > 0);
  assertCompacted(geometry, result);
});

test("simplifier and sampler leave their input geometry untouched", async () => {
  const simplifier = await loadSimplifier();
  const geometry = new SphereGeometry(1, 8, 6);
  const beforePositions = positions(geometry);
  const index = geometry.getIndex();
  assert.ok(index !== null);
  const beforeIndex = Array.from(index.array);

  await new SimplifyModifier().setSimplifier(simplifier).modify(geometry, 20);

  assert.deepEqual(positions(geometry), beforePositions);
  assert.deepEqual(Array.from(geometry.getIndex()!.array), beforeIndex);

  assert.equal(attribute(geometry, "position").array instanceof Float32Array, true);

  const sampler = new MeshSurfaceSampler(new Mesh(geometry, new MeshBasicMaterial())).build();
  sampler.sample(new Vector3(), new Vector3(), new Color(), new Vector2());
  assert.deepEqual(positions(geometry), beforePositions);
});
