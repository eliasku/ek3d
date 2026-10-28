import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { PLYExporter } from "../src/addons/exporters/PLYExporter";
import { BufferAttribute, Float32BufferAttribute, Uint8BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Object3D } from "../src/core/Object3D";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { PointsMaterial } from "../src/materials/PointsMaterial";
import { Mesh } from "../src/objects/Mesh";
import { Points } from "../src/objects/Points";

function triangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setIndex([0, 1, 2]);
  return geometry;
}

test("PLY ASCII merges transformed meshes and custom properties", () => {
  const first = triangle();
  first.setAttribute("weight", new BufferAttribute(new Int16Array([2, 3, 4]), 1));
  const a = new Mesh(first, new MeshBasicMaterial());
  a.position.x = 2;
  const b = new Mesh(triangle(), new MeshBasicMaterial());
  const root = new Object3D();
  root.add(a, b);
  root.updateMatrixWorld(true);
  const result = new PLYExporter().parse(root, undefined, { customPropertyMapping: { weight: ["weight"] } });
  assert.ok(typeof result === "string");
  assert.ok(result.includes("element vertex 6\n"));
  assert.ok(result.includes("property short weight\n"));
  assert.ok(result.endsWith("2 0 0 2\n3 0 0 3\n2 1 0 4\n0 0 0 0\n1 0 0 0\n0 1 0 0\n3 0 1 2\n3 3 4 5\n\n"));
});

test("PLY binary writes both endiannesses with typed attributes and indices", () => {
  const geometry = triangle();
  geometry.setAttribute("color", new Uint8BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  for (const littleEndian of [false, true]) {
    const result = new PLYExporter().parse(mesh, undefined, { binary: true, littleEndian });
    assert.ok(result instanceof ArrayBuffer);
    const bytes = new Uint8Array(result);
    const text = new TextDecoder().decode(bytes);
    const start = text.indexOf("end_header\n") + "end_header\n".length;
    assert.ok(text.includes(`format binary_${littleEndian ? "little" : "big"}_endian 1.0`));
    const data = new DataView(result);
    assert.equal(data.getFloat32(start + 15, littleEndian), 1);
    assert.equal(data.getUint8(start + 12), 255);
    assert.equal(data.getUint8(start + 45), 3);
    assert.equal(data.getUint32(start + 46 + 8, littleEndian), 2);
  }
});

test("PLY point clouds omit faces and excluded attributes", () => {
  const geometry = triangle();
  geometry.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const points = new Points(geometry, new PointsMaterial());
  const result = new PLYExporter().parse(points, undefined, { excludeAttributes: ["normal"] });
  assert.ok(typeof result === "string");
  assert.ok(!result.includes("element face"));
  assert.ok(!result.includes("property float nx"));
});

test("PLY defers the callback and rejects incomplete triangles", () => {
  const previous = globalThis.requestAnimationFrame;
  const pending: FrameRequestCallback[] = [];
  globalThis.requestAnimationFrame = (callback) => {
    pending.push(callback);
    return 1;
  };
  try {
    let callbackResult: string | ArrayBuffer | undefined;
    const exporter = new PLYExporter();
    const result = exporter.parse(new Mesh(triangle(), new MeshBasicMaterial()), (value) => {
      callbackResult = value;
    });
    assert.equal(callbackResult, undefined);
    assert.equal(pending.length, 1);
    pending[0](0);
    assert.equal(callbackResult, result);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
    const oldError = console.error;
    console.error = () => {};
    try {
      assert.equal(exporter.parse(new Mesh(geometry, new MeshBasicMaterial())), null);
    } finally {
      console.error = oldError;
    }
  } finally {
    globalThis.requestAnimationFrame = previous;
  }
});

test("PLY fills missing normals, UVs, colors and custom properties in ASCII and binary", () => {
  const first = triangle();
  first.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  first.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  first.setAttribute("color", new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  first.setAttribute("weight", new Float32BufferAttribute([2, 3, 4], 1));
  const root = new Object3D();
  const material = new MeshBasicMaterial();
  root.add(new Mesh(first, material), new Mesh(triangle(), material));
  const exporter = new PLYExporter();
  const options = { customPropertyMapping: { weight: ["weight"] } };
  const ascii = exporter.parse(root, undefined, options);
  assert.ok(typeof ascii === "string");
  assert.ok(ascii.includes("0 0 0 0 0 0 0 0 1 1 1 0\n"));
  const binary = exporter.parse(root, undefined, { ...options, binary: true, littleEndian: true });
  assert.ok(binary instanceof ArrayBuffer);
  const bytes = new Uint8Array(binary);
  const headerEnd = new TextDecoder().decode(bytes).indexOf("end_header\n") + "end_header\n".length;
  const view = new DataView(binary);
  const missing = headerEnd + 3 * 48;
  assert.deepEqual(
    Array.from({ length: 12 }, (_, i) => view.getFloat32(missing + i * 4, true)),
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  );
});
