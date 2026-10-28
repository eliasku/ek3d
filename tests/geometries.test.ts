import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { Raycaster } from "../src/core/Raycaster";
import { Vector2 } from "../src/math/Vector2";
import { Vector3 } from "../src/math/Vector3";
import { Mesh } from "../src/objects/Mesh";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { CapsuleGeometry } from "../src/geometries/CapsuleGeometry";
import { CircleGeometry } from "../src/geometries/CircleGeometry";
import { ConeGeometry } from "../src/geometries/ConeGeometry";
import { CylinderGeometry } from "../src/geometries/CylinderGeometry";
import { DodecahedronGeometry } from "../src/geometries/DodecahedronGeometry";
import { EdgesGeometry } from "../src/geometries/EdgesGeometry";
import { IcosahedronGeometry } from "../src/geometries/IcosahedronGeometry";
import { LatheGeometry } from "../src/geometries/LatheGeometry";
import { OctahedronGeometry } from "../src/geometries/OctahedronGeometry";
import { PolyhedronGeometry } from "../src/geometries/PolyhedronGeometry";
import { RingGeometry } from "../src/geometries/RingGeometry";
import { SphereGeometry } from "../src/geometries/SphereGeometry";
import { TetrahedronGeometry } from "../src/geometries/TetrahedronGeometry";
import { TorusGeometry } from "../src/geometries/TorusGeometry";
import { TorusKnotGeometry } from "../src/geometries/TorusKnotGeometry";
import { WireframeGeometry } from "../src/geometries/WireframeGeometry";
import { TubeGeometry } from "../src/geometries/TubeGeometry";
import { ShapeGeometry } from "../src/geometries/ShapeGeometry";
import { ExtrudeGeometry } from "../src/geometries/ExtrudeGeometry";
import { RoundedBoxGeometry } from "../src/addons/geometries/RoundedBoxGeometry";
import { type Curve, type CurveJSON } from "../src/extras/core/Curve";
import { CurvePath } from "../src/extras/core/CurvePath";
import { Path } from "../src/extras/core/Path";
import { Shape } from "../src/extras/core/Shape";
import { LineCurve3 } from "../src/extras/curves/LineCurve3";
import { CatmullRomCurve3 } from "../src/extras/curves/CatmullRomCurve3";
import { BufferGeometry as UpstreamBufferGeometry } from "../upstream/three.js/src/core/BufferGeometry.js";
import { Float32BufferAttribute as UpstreamAttribute } from "../upstream/three.js/src/core/BufferAttribute.js";
import { Raycaster as UpstreamRaycaster } from "../upstream/three.js/src/core/Raycaster.js";
import { Vector2 as UpstreamVector2 } from "../upstream/three.js/src/math/Vector2.js";
import { Vector3 as UpstreamVector3 } from "../upstream/three.js/src/math/Vector3.js";
import { Mesh as UpstreamMesh } from "../upstream/three.js/src/objects/Mesh.js";
import { MeshBasicMaterial as UpstreamMaterial } from "../upstream/three.js/src/materials/MeshBasicMaterial.js";
import { CapsuleGeometry as UpstreamCapsule } from "../upstream/three.js/src/geometries/CapsuleGeometry.js";
import { CircleGeometry as UpstreamCircle } from "../upstream/three.js/src/geometries/CircleGeometry.js";
import { ConeGeometry as UpstreamCone } from "../upstream/three.js/src/geometries/ConeGeometry.js";
import { CylinderGeometry as UpstreamCylinder } from "../upstream/three.js/src/geometries/CylinderGeometry.js";
import { DodecahedronGeometry as UpstreamDodecahedron } from "../upstream/three.js/src/geometries/DodecahedronGeometry.js";
import { EdgesGeometry as UpstreamEdges } from "../upstream/three.js/src/geometries/EdgesGeometry.js";
import { IcosahedronGeometry as UpstreamIcosahedron } from "../upstream/three.js/src/geometries/IcosahedronGeometry.js";
import { LatheGeometry as UpstreamLathe } from "../upstream/three.js/src/geometries/LatheGeometry.js";
import { OctahedronGeometry as UpstreamOctahedron } from "../upstream/three.js/src/geometries/OctahedronGeometry.js";
import { PolyhedronGeometry as UpstreamPolyhedron } from "../upstream/three.js/src/geometries/PolyhedronGeometry.js";
import { RingGeometry as UpstreamRing } from "../upstream/three.js/src/geometries/RingGeometry.js";
import { SphereGeometry as UpstreamSphere } from "../upstream/three.js/src/geometries/SphereGeometry.js";
import { TetrahedronGeometry as UpstreamTetrahedron } from "../upstream/three.js/src/geometries/TetrahedronGeometry.js";
import { TorusGeometry as UpstreamTorus } from "../upstream/three.js/src/geometries/TorusGeometry.js";
import { TorusKnotGeometry as UpstreamTorusKnot } from "../upstream/three.js/src/geometries/TorusKnotGeometry.js";
import { WireframeGeometry as UpstreamWireframe } from "../upstream/three.js/src/geometries/WireframeGeometry.js";
import { TubeGeometry as UpstreamTube } from "../upstream/three.js/src/geometries/TubeGeometry.js";
import { ShapeGeometry as UpstreamShapeGeometry } from "../upstream/three.js/src/geometries/ShapeGeometry.js";
import { ExtrudeGeometry as UpstreamExtrude } from "../upstream/three.js/src/geometries/ExtrudeGeometry.js";
import { RoundedBoxGeometry as UpstreamRoundedBox } from "../upstream/three.js/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CurvePath as UpstreamCurvePath } from "../upstream/three.js/src/extras/core/CurvePath.js";
import { Shape as UpstreamShape } from "../upstream/three.js/src/extras/core/Shape.js";
import { LineCurve3 as UpstreamLineCurve3 } from "../upstream/three.js/src/extras/curves/LineCurve3.js";
import { CatmullRomCurve3 as UpstreamCatmullRom } from "../upstream/three.js/src/extras/curves/CatmullRomCurve3.js";

function jsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, entry: unknown) => (key === "uuid" ? undefined : entry)));
}

function snapshot(geometry: BufferGeometry | UpstreamBufferGeometry) {
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return {
    type: geometry.type,
    index: geometry.index?.array ?? null,
    attributes: Object.fromEntries(
      Object.keys(geometry.attributes).map((name) => {
        const attribute = geometry.getAttribute(name);
        assert.ok(attribute && "array" in attribute);
        return [name, { array: attribute.array, itemSize: attribute.itemSize, normalized: attribute.normalized }];
      }),
    ),
    groups: geometry.groups,
    box: [geometry.boundingBox?.min.toArray(), geometry.boundingBox?.max.toArray()],
    sphere: [geometry.boundingSphere?.center.toArray(), geometry.boundingSphere?.radius],
  };
}

function assertGeometry(actual: BufferGeometry, expected: BufferGeometry | UpstreamBufferGeometry) {
  assert.deepEqual(snapshot(actual), snapshot(expected), actual.type);
}

function assertOwnership(source: BufferGeometry) {
  const before = jsonValue(snapshot(source));
  const clone = source.clone();
  assert.equal(clone.constructor, source.constructor);
  assert.notEqual(clone.uuid, source.uuid);
  assertGeometry(clone, source);
  assert.deepEqual(jsonValue(clone.toJSON()), jsonValue(source.toJSON()));
  if ("parameters" in source && "parameters" in clone) {
    assert.notEqual(clone.parameters, source.parameters);
  }
  for (const name of Object.keys(source.attributes)) {
    const attribute = clone.getAttribute(name);
    const original = source.getAttribute(name);
    assert.ok(attribute && original && "array" in attribute && "array" in original);
    assert.notEqual(attribute, original);
    assert.notEqual(attribute.array.buffer, original.array.buffer);
    attribute.setX(0, attribute.getX(0) + 7);
  }
  if (clone.index && source.index) {
    assert.notEqual(clone.index.array.buffer, source.index.array.buffer);
    clone.index.setX(0, clone.index.getX(0) + 1);
  }
  assert.notEqual(clone.groups, source.groups);
  if (clone.groups[0]) clone.groups[0].count = 0;
  assert.ok(clone.boundingBox && clone.boundingSphere);
  assert.notEqual(clone.boundingBox, source.boundingBox);
  assert.notEqual(clone.boundingSphere, source.boundingSphere);
  clone.boundingBox.min.x -= 10;
  clone.boundingSphere.center.y += 10;
  clone.boundingSphere.radius += 10;
  assert.deepEqual(jsonValue(snapshot(source)), before);

  assert.equal(clone.copy(source), clone);
  assertGeometry(clone, source);
  assert.deepEqual(jsonValue(clone.toJSON()), jsonValue(source.toJSON()));
  for (const name of Object.keys(source.attributes)) {
    const attribute = clone.getAttribute(name);
    const original = source.getAttribute(name);
    assert.ok(attribute && original && "array" in attribute && "array" in original);
    assert.notEqual(attribute.array.buffer, original.array.buffer);
  }
  if (clone.index && source.index) assert.notEqual(clone.index.array.buffer, source.index.array.buffer);
  assert.notEqual(clone.boundingBox, source.boundingBox);
  assert.notEqual(clone.boundingSphere, source.boundingSphere);
  if (clone.groups[0]) assert.notEqual(clone.groups[0], source.groups[0]);
}

test("ordinary geometries preserve upstream arcs, caps, clamping, serialization and ownership", () => {
  const points = [
    [0, -1.5],
    [0.8, -0.9],
    [0.4, 0.3],
    [1.1, 0.8],
    [0, 1.4],
  ] as const;
  const profile = points.map(([x, y]) => new Vector2(x, y));
  const upstreamProfile = points.map(([x, y]) => new UpstreamVector2(x, y));
  const cases = [
    [new CapsuleGeometry(0.7, 2.3, 3, 9, 2), new UpstreamCapsule(0.7, 2.3, 3, 9, 2), CapsuleGeometry],
    [new CapsuleGeometry(0.7, -2, 0, 2, 0), new UpstreamCapsule(0.7, -2, 0, 2, 0), CapsuleGeometry],
    [new CircleGeometry(1.7, 2, 0.3, 4.1), new UpstreamCircle(1.7, 2, 0.3, 4.1), CircleGeometry],
    [
      new ConeGeometry(1.3, 2.7, 7, 3, false, 0.2, 4.3),
      new UpstreamCone(1.3, 2.7, 7, 3, false, 0.2, 4.3),
      ConeGeometry,
    ],
    [
      new CylinderGeometry(0.6, 1.2, 2.4, 7.8, 2.9, false, 0.4, 4.7),
      new UpstreamCylinder(0.6, 1.2, 2.4, 7.8, 2.9, false, 0.4, 4.7),
      CylinderGeometry,
    ],
    [
      new CylinderGeometry(1.1, 0, 2.4, 7, 2, true, 0.4, 3.7),
      new UpstreamCylinder(1.1, 0, 2.4, 7, 2, true, 0.4, 3.7),
      CylinderGeometry,
    ],
    [new LatheGeometry(profile, 7.8, 0.4, 3.9), new UpstreamLathe(upstreamProfile, 7.8, 0.4, 3.9), LatheGeometry],
    [new LatheGeometry(profile, 7, 0.2, 8), new UpstreamLathe(upstreamProfile, 7, 0.2, 8), LatheGeometry],
    [new RingGeometry(0.3, 1.7, 7, 3, 0.2, 4.1), new UpstreamRing(0.3, 1.7, 7, 3, 0.2, 4.1), RingGeometry],
    [new RingGeometry(0.3, 1.7, 1, 0, 0.2, 4.1), new UpstreamRing(0.3, 1.7, 1, 0, 0.2, 4.1), RingGeometry],
    [
      new SphereGeometry(1.7, 7.8, 5.9, 0.4, 4.2, 0.3, 1.8),
      new UpstreamSphere(1.7, 7.8, 5.9, 0.4, 4.2, 0.3, 1.8),
      SphereGeometry,
    ],
    [new SphereGeometry(1.7, 1, 1, 0.4, 4.2, 0, 4), new UpstreamSphere(1.7, 1, 1, 0.4, 4.2, 0, 4), SphereGeometry],
    [
      new TorusGeometry(2.1, 0.35, 7.8, 11.9, 4.5, 0.4, 3.8),
      new UpstreamTorus(2.1, 0.35, 7.8, 11.9, 4.5, 0.4, 3.8),
      TorusGeometry,
    ],
    [
      new TorusKnotGeometry(1.3, 0.2, 23.8, 5.9, 3, 4),
      new UpstreamTorusKnot(1.3, 0.2, 23.8, 5.9, 3, 4),
      TorusKnotGeometry,
    ],
  ] as const;
  for (const [actual, expected, Geometry] of cases) {
    assertGeometry(actual, expected);
    assert.deepEqual(jsonValue(actual.toJSON()), jsonValue(expected.toJSON()), actual.type);
    assertGeometry(Geometry.fromJSON(JSON.parse(JSON.stringify(actual.toJSON()))), expected);
    assertOwnership(actual);
  }
});

test("polyhedra preserve flat and subdivided normals, UV seams and constructor round-trips", () => {
  const vertices = [-1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1];
  const indices = [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3];
  for (const detail of [0, 1]) {
    const cases = [
      [
        new PolyhedronGeometry(vertices, indices, 1.7, detail),
        new UpstreamPolyhedron(vertices, indices, 1.7, detail),
        PolyhedronGeometry,
      ],
      [new DodecahedronGeometry(1.7, detail), new UpstreamDodecahedron(1.7, detail), DodecahedronGeometry],
      [new IcosahedronGeometry(1.7, detail), new UpstreamIcosahedron(1.7, detail), IcosahedronGeometry],
      [new OctahedronGeometry(1.7, detail), new UpstreamOctahedron(1.7, detail), OctahedronGeometry],
      [new TetrahedronGeometry(1.7, detail), new UpstreamTetrahedron(1.7, detail), TetrahedronGeometry],
    ] as const;
    for (const [actual, expected, Geometry] of cases) {
      assertGeometry(actual, expected);
      assert.deepEqual(jsonValue(actual.toJSON()), jsonValue(expected.toJSON()));
      assertGeometry(Geometry.fromJSON(JSON.parse(JSON.stringify(actual.toJSON()))), expected);
      assertOwnership(actual);
    }
  }
});

test("edges distinguish coplanar and folded faces, skip degenerate triangles and preserve boundaries", () => {
  for (const { z, threshold, edgeCount } of [
    { z: 0, threshold: 1, edgeCount: 4 },
    { z: 0, threshold: 0, edgeCount: 5 },
    { z: 1, threshold: 30, edgeCount: 5 },
    { z: 1, threshold: 60, edgeCount: 4 },
  ]) {
    const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, z, 0.00001, 0, 0];
    // The last two triangles repeat a vertex exactly and at upstream's hash precision.
    const indices = [0, 1, 2, 1, 0, 3, 0, 0, 1, 0, 4, 1];
    const indexed = new BufferGeometry()
      .setAttribute("position", new Float32BufferAttribute(positions, 3))
      .setIndex(indices);
    const upstreamIndexed = new UpstreamBufferGeometry()
      .setAttribute("position", new UpstreamAttribute(positions, 3))
      .setIndex(indices);
    for (const [source, upstreamSource] of [
      [indexed, upstreamIndexed],
      [indexed.toNonIndexed(), upstreamIndexed.toNonIndexed()],
    ] as const) {
      const actual = new EdgesGeometry(source, threshold);
      assertGeometry(actual, new UpstreamEdges(upstreamSource, threshold));
      assert.equal(actual.getAttribute("position")?.count, edgeCount * 2);
      assert.equal(actual.parameters.geometry, source);
      assertOwnership(actual);
    }
  }
});

test("wireframes deduplicate shared edges in indexed, overlapping-group and non-indexed inputs", () => {
  const positions = [0, 0, 0, 2, 0, 0, 0, 1, 0, 2, 1, 0];
  const indices = [0, 1, 2, 2, 1, 3];
  for (const mode of ["indexed", "groups", "non-indexed"] as const) {
    let source = new BufferGeometry()
      .setAttribute("position", new Float32BufferAttribute(positions, 3))
      .setIndex(indices);
    let upstream = new UpstreamBufferGeometry()
      .setAttribute("position", new UpstreamAttribute(positions, 3))
      .setIndex(indices);
    if (mode === "groups") {
      for (const geometry of [source, upstream]) {
        geometry.addGroup(0, 6, 0);
        geometry.addGroup(0, 3, 1);
      }
    } else if (mode === "non-indexed") {
      source = source.toNonIndexed();
      upstream = upstream.toNonIndexed();
    }
    const actual = new WireframeGeometry(source);
    assertGeometry(actual, new UpstreamWireframe(upstream));
    assert.equal(actual.getAttribute("position")?.count, 10);
    assert.equal(actual.parameters.geometry, source);
    assertOwnership(actual);
  }
});

test("curved geometries provide real ray hits while a ray through the torus hole misses", () => {
  const cases = [
    [new SphereGeometry(1.4, 18, 12), new UpstreamSphere(1.4, 18, 12), 0.17, 0.23, true],
    [new CapsuleGeometry(0.8, 2.1, 5, 16, 3), new UpstreamCapsule(0.8, 2.1, 5, 16, 3), 0.13, 1.35, true],
    [new TorusGeometry(2, 0.5, 12, 24), new UpstreamTorus(2, 0.5, 12, 24), 1.93, 0.13, true],
    [new TorusGeometry(2, 0.5, 12, 24), new UpstreamTorus(2, 0.5, 12, 24), 0, 0, false],
  ] as const;
  const withoutObject = (hit: object) => Object.fromEntries(Object.entries(hit).filter(([key]) => key !== "object"));
  for (const [geometry, upstreamGeometry, x, y, shouldHit] of cases) {
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    const upstreamMesh = new UpstreamMesh(upstreamGeometry, new UpstreamMaterial());
    mesh.position.set(0.4, -0.2, -1);
    const upstreamPosition: unknown = Reflect.get(upstreamMesh, "position");
    assert.ok(upstreamPosition instanceof UpstreamVector3);
    upstreamPosition.set(0.4, -0.2, -1);
    mesh.updateMatrixWorld(true);
    upstreamMesh.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(x + 0.4, y - 0.2, 5), new Vector3(0, 0, -1));
    const upstreamRay = new UpstreamRaycaster(new UpstreamVector3(x + 0.4, y - 0.2, 5), new UpstreamVector3(0, 0, -1));
    const hits = ray.intersectObject(mesh);
    const upstreamHits = upstreamRay.intersectObject(upstreamMesh);
    assert.equal(hits.length > 0, shouldHit, geometry.type);
    assert.deepEqual(jsonValue(hits.map(withoutObject)), jsonValue(upstreamHits.map(withoutObject)));
    for (const hit of hits) assert.equal(hit.object, mesh);
  }
});

function createSpatialCurve(json: CurveJSON): Curve<Vector3 | null> {
  switch (json.type) {
    case "CatmullRomCurve3":
      return new CatmullRomCurve3().fromJSON(json);
    case "LineCurve3":
      return new LineCurve3().fromJSON(json);
    case "CurvePath":
      return new CurvePath<Vector3>().fromJSON(json, createSpatialCurve);
    default:
      throw new Error(`Unsupported curve: ${json.type}`);
  }
}

test("tubes preserve open and closed buffers, Frenet frames, ownership and explicit path decoding", () => {
  const points = [new Vector3(-2, 0, 0), new Vector3(-1, 2, 1), new Vector3(1, 1, 3), new Vector3(2, -1, 0)];
  for (const closed of [false, true]) {
    const path = new CatmullRomCurve3(points, closed, "centripetal");
    const upstreamPath = new UpstreamCatmullRom(
      points.map((p) => new UpstreamVector3(p.x, p.y, p.z)),
      closed,
      "centripetal",
    );
    const actual = new TubeGeometry(path, 17, 0.3, 7, closed);
    const expected = new UpstreamTube(upstreamPath, 17, 0.3, 7, closed);
    assertGeometry(actual, expected);
    for (const key of ["tangents", "normals", "binormals"] as const) {
      assert.deepEqual(
        actual[key].map((v) => v.toArray()),
        expected[key].map((v: UpstreamVector3) => v.toArray()),
      );
    }
    assert.deepEqual(jsonValue(actual.toJSON()), jsonValue(expected.toJSON()));
    assertGeometry(TubeGeometry.fromJSON(JSON.parse(JSON.stringify(actual.toJSON())), createSpatialCurve), expected);
    assertOwnership(actual);
  }
  const path = new CurvePath<Vector3>();
  const upstreamPath = new UpstreamCurvePath();
  path.add(new LineCurve3(new Vector3(), new Vector3(0, 1, 2)));
  path.add(new LineCurve3(new Vector3(0, 1, 2), new Vector3(2, 2, 3)));
  // @ts-expect-error Upstream's abstract getPoint JSDoc omits its arguments.
  upstreamPath.add(new UpstreamLineCurve3(new UpstreamVector3(), new UpstreamVector3(0, 1, 2)));
  // @ts-expect-error Upstream's abstract getPoint JSDoc omits its arguments.
  upstreamPath.add(new UpstreamLineCurve3(new UpstreamVector3(0, 1, 2), new UpstreamVector3(2, 2, 3)));
  const nested = new CurvePath<Vector3>();
  const upstreamNested = new UpstreamCurvePath();
  nested.add(path);
  // @ts-expect-error Upstream's abstract getPoint JSDoc omits its arguments.
  upstreamNested.add(upstreamPath);
  const actual = new TubeGeometry(nested, 12, 0.2, 5);
  const expected = new UpstreamTube(upstreamNested, 12, 0.2, 5);
  assertGeometry(actual, expected);
  assertGeometry(TubeGeometry.fromJSON(JSON.parse(JSON.stringify(actual.toJSON())), createSpatialCurve), expected);
  const failure = new Error("consumer decoder failed");
  assert.throws(
    () =>
      TubeGeometry.fromJSON(actual.toJSON(), () => {
        throw failure;
      }),
    (error) => error === failure,
  );
});

test("shape triangulation and extrusion preserve holes, bevels, near-coincident contours, groups and JSON", () => {
  const shape = new Shape([
    new Vector2(0, 0),
    new Vector2(0, 4),
    new Vector2(4, 4),
    new Vector2(4, 0),
    new Vector2(4 - 1e-10, 0),
    new Vector2(0, 0),
  ]);
  shape.holes.push(
    new Path([new Vector2(1, 1), new Vector2(3, 1), new Vector2(3, 3), new Vector2(1, 3), new Vector2(1, 1)]),
  );
  const island = new Shape([new Vector2(6, 0), new Vector2(6, 1), new Vector2(7, 0), new Vector2(6, 0)]);
  const shapes = [shape, island];
  const upstreamShapes = shapes.map((value) =>
    new UpstreamShape().fromJSON(JSON.parse(JSON.stringify(value.toJSON()))),
  );
  const shapesByUUID = Object.fromEntries(shapes.map((value) => [value.uuid, value]));
  const flat = new ShapeGeometry(shapes, 5);
  const upstreamFlat = new UpstreamShapeGeometry(upstreamShapes, 5);
  assertGeometry(flat, upstreamFlat);
  assert.equal(flat.groups.length, 2);
  assert.deepEqual(jsonValue(flat.toJSON()), jsonValue(upstreamFlat.toJSON()));
  assertGeometry(ShapeGeometry.fromJSON(JSON.parse(JSON.stringify(flat.toJSON())), shapesByUUID), upstreamFlat);
  assertOwnership(flat);
  const path = new CatmullRomCurve3([new Vector3(), new Vector3(0, 1, 2), new Vector3(1, 2, 4), new Vector3(2, 1, 6)]);
  const upstreamPath = new UpstreamCatmullRom(
    path.points.map((point) => new UpstreamVector3(point.x, point.y, point.z)),
  );
  for (const byPath of [false, true]) {
    const options = {
      depth: 1.7,
      steps: 5,
      curveSegments: 5,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelThickness: 0.15,
      bevelSize: 0.12,
      bevelOffset: -0.02,
      ...(byPath ? { extrudePath: path } : {}),
    };
    const upstreamOptions = { ...options, ...(byPath ? { extrudePath: upstreamPath } : {}) };
    const actual = new ExtrudeGeometry(shapes, options);
    // @ts-expect-error Upstream's ~Options JSDoc resolves to the geometry, not its option bag.
    const expected = new UpstreamExtrude(upstreamShapes, upstreamOptions);
    assertGeometry(actual, expected);
    assert.equal(actual.groups.length, 4);
    assert.deepEqual(jsonValue(actual.toJSON()), jsonValue(expected.toJSON()));
    assertGeometry(
      ExtrudeGeometry.fromJSON(JSON.parse(JSON.stringify(actual.toJSON())), shapesByUUID, createSpatialCurve),
      expected,
    );
    assertOwnership(actual);
    if (byPath) {
      const failure = new Error("consumer extrusion decoder failed");
      assert.throws(
        () =>
          ExtrudeGeometry.fromJSON(actual.toJSON(), shapesByUUID, () => {
            throw failure;
          }),
        (error) => error === failure,
      );
    }
  }
  for (const [x, y, shouldHit] of [
    [0.5, 0.7, true],
    [2, 2, false],
    [5, 2, false],
  ] as const) {
    const ray = new Raycaster(new Vector3(x, y, 5), new Vector3(0, 0, -1));
    const upstreamRay = new UpstreamRaycaster(new UpstreamVector3(x, y, 5), new UpstreamVector3(0, 0, -1));
    const hits = ray.intersectObject(new Mesh(flat, new MeshBasicMaterial()));
    const upstreamHits = upstreamRay.intersectObject(new UpstreamMesh(upstreamFlat, new UpstreamMaterial()));
    assert.equal(hits.length > 0, shouldHit);
    const withoutObject = (hit: object) => Object.fromEntries(Object.entries(hit).filter(([key]) => key !== "object"));
    assert.deepEqual(jsonValue(hits.map(withoutObject)), jsonValue(upstreamHits.map(withoutObject)));
  }
});

test("extrusion invokes custom top and wall UV generators with the same vertices and indices as upstream", () => {
  const shape = new Shape([new Vector2(0, 0), new Vector2(0, 2), new Vector2(3, 2), new Vector2(3, 0)]);
  const upstreamShape = new UpstreamShape().fromJSON(JSON.parse(JSON.stringify(shape.toJSON())));
  const calls: number[][] = [];
  const UVGenerator = {
    generateTopUV(
      _geometry: unknown,
      vertices: number[],
      a: number,
      b: number,
      c: number,
    ): [Vector2, Vector2, Vector2] {
      calls.push([3, a, b, c, vertices.length]);
      return [
        new Vector2(vertices[a * 3] * 0.25, vertices[a * 3 + 1] * 0.5),
        new Vector2(vertices[b * 3] * 0.25, vertices[b * 3 + 1] * 0.5),
        new Vector2(vertices[c * 3] * 0.25, vertices[c * 3 + 1] * 0.5),
      ];
    },
    generateSideWallUV(
      _geometry: unknown,
      vertices: number[],
      a: number,
      b: number,
      c: number,
      d: number,
    ): [Vector2, Vector2, Vector2, Vector2] {
      calls.push([4, a, b, c, d, vertices.length]);
      return [
        new Vector2(vertices[a * 3] + vertices[a * 3 + 1], vertices[a * 3 + 2] * 0.5),
        new Vector2(vertices[b * 3] + vertices[b * 3 + 1], vertices[b * 3 + 2] * 0.5),
        new Vector2(vertices[c * 3] + vertices[c * 3 + 1], vertices[c * 3 + 2] * 0.5),
        new Vector2(vertices[d * 3] + vertices[d * 3 + 1], vertices[d * 3 + 2] * 0.5),
      ];
    },
  };
  const options = { depth: 2, steps: 2, bevelEnabled: false, UVGenerator };
  const actual = new ExtrudeGeometry(shape, options);
  const actualCalls = calls.splice(0);
  // @ts-expect-error Upstream's ~Options JSDoc resolves to the geometry, not its option bag.
  const expected = new UpstreamExtrude(upstreamShape, options);
  assertGeometry(actual, expected);
  assert.deepEqual(actualCalls, calls);
  assert.ok(calls.some((call) => call[0] === 3));
  assert.ok(calls.some((call) => call[0] === 4));
  assertOwnership(actual);
});

test("rounded box matches upstream vertices, normals and UVs across rounding and degenerate inputs", () => {
  const cases = [
    [new RoundedBoxGeometry(1, 1, 1, 7, 0.1), new UpstreamRoundedBox(1, 1, 1, 7, 0.1)],
    [new RoundedBoxGeometry(2.4, 1.2, 3, 4, 0.35), new UpstreamRoundedBox(2.4, 1.2, 3, 4, 0.35)],
    // radius clamped to the shortest side
    [new RoundedBoxGeometry(1, 1, 1, 3, 5), new UpstreamRoundedBox(1, 1, 1, 3, 5)],
    // segments = 0: plain unit box
    [new RoundedBoxGeometry(1, 1, 1, 0, 0.5), new UpstreamRoundedBox(1, 1, 1, 0, 0.5) as unknown],
  ] as const;
  for (const [actual, expected] of cases as unknown as [RoundedBoxGeometry, RoundedBoxGeometry][]) {
    assertGeometry(actual, expected);
    assert.deepEqual(
      actual.parameters,
      expected.parameters as unknown as RoundedBoxGeometry["parameters"],
      actual.type,
    );
    assert.deepEqual(jsonValue(actual.toJSON()), jsonValue(expected.toJSON()));
    assert.equal(actual.index === null, (actual.parameters as unknown as { segments: number }).segments > 0);
    const normals = (actual.attributes.normal as Float32BufferAttribute).array;
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
      assert.ok(Math.abs(length - 1) < 1e-6, "normal not normalized");
    }
  }
  const restored = RoundedBoxGeometry.fromJSON(JSON.parse(JSON.stringify(cases[0][0].toJSON())));
  assertGeometry(restored, cases[0][1] as unknown as UpstreamBufferGeometry);
  assertOwnership(cases[0][0]);
});
