import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { RectAreaLightTexturesLib } from "../src/addons/lights/RectAreaLightTexturesLib";
import { RectAreaLightUniformsLib } from "../src/addons/lights/RectAreaLightUniformsLib";
import { compressNormals, compressPositions, compressUvs } from "../src/addons/utils/GeometryCompressionUtils";
import {
  reduceVertices,
  sortInstancedMesh,
  traverseGenerator,
  traverseVisibleGenerator,
} from "../src/addons/utils/SceneUtils";
import { unwrapUVs } from "../src/addons/utils/unwrapUVs";
import { Float32BufferAttribute, type BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { InstancedBufferAttribute } from "../src/core/InstancedBufferAttribute";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Color } from "../src/math/Color";
import { Matrix4 } from "../src/math/Matrix4";
import { Group } from "../src/objects/Group";
import { InstancedMesh } from "../src/objects/InstancedMesh";
import { Mesh } from "../src/objects/Mesh";

function triangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  return geometry;
}

test("geometry compression packs normals, positions and UVs", () => {
  const geometry = triangle();
  compressPositions(geometry);
  compressNormals(geometry, "OCT1Byte");
  compressUvs(geometry);
  const position = geometry.attributes.position as BufferAttribute;
  const normal = geometry.attributes.normal as BufferAttribute;
  const uv = geometry.attributes.uv as BufferAttribute;
  assert.ok(position.array instanceof Uint16Array);
  assert.ok(normal.array instanceof Int8Array);
  assert.deepEqual(Array.from(normal.array), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(Array.from(uv.array), [32768, 32768, 65535, 32768, 32768, 65535]);
  assert.ok(geometry.boundingBox);
});

test("geometry compression quantizes out-of-range UVs and does not repack", () => {
  const geometry = triangle();
  geometry.setAttribute("uv", new Float32BufferAttribute([-2, 5, 2, 5, 0, 5], 2));
  compressUvs(geometry);
  const uv = geometry.attributes.uv as BufferAttribute;
  assert.equal(uv.normalized, false);
  assert.deepEqual(Array.from(uv.array), [0, 0, 65535, 0, 32767, 0]);
  compressUvs(geometry);
  assert.equal(geometry.attributes.uv, uv);
});

test("scene helpers reduce transformed vertices, traverse visibility, and sort instances", () => {
  const geometry = triangle();
  const material = new MeshBasicMaterial();
  const root = new Group();
  const mesh = new Mesh(geometry, material);
  mesh.position.x = 2;
  root.add(mesh);
  const hidden = new Group();
  hidden.visible = false;
  root.add(hidden);
  assert.equal(
    reduceVertices(root, (sum, vertex) => sum + vertex.x, 0),
    7,
  );
  assert.equal([...traverseGenerator(root)].length, 3);
  assert.equal([...traverseVisibleGenerator(root)].length, 2);
  const instances = new InstancedMesh(geometry, material, 2);
  instances.setMatrixAt(0, new Matrix4().makeTranslation(1, 0, 0));
  instances.setMatrixAt(1, new Matrix4().makeTranslation(2, 0, 0));
  instances.setColorAt(0, new Color(1, 0, 0));
  instances.setColorAt(1, new Color(0, 1, 0));
  const custom = new InstancedBufferAttribute(new Float32Array([3, 4, 5, 6]), 2);
  geometry.setAttribute("custom", custom);
  sortInstancedMesh(instances, (a, b) => b - a);
  const matrix = new Matrix4();
  instances.getMatrixAt(0, matrix);
  assert.equal(matrix.elements[12], 2);
  assert.deepEqual(Array.from(instances.instanceColor!.array), [0, 1, 0, 1, 0, 0]);
  assert.deepEqual(Array.from(custom.array), [5, 6, 3, 4]);
});

test("UV atlas uses supplied packer and remaps triangle geometry", () => {
  const mesh = new Mesh(triangle(), new MeshBasicMaterial());
  let calls = 0;
  const result = unwrapUVs(
    mesh,
    (boxes) => {
      calls++;
      let x = 0,
        height = 0;
      for (const box of boxes) {
        box.x = x;
        box.y = 0;
        x += box.w;
        height = Math.max(height, box.h);
      }
      return { w: x, h: height };
    },
    { resolution: 64, padding: 1 },
  );
  assert.ok(result);
  assert.ok(calls > 0);
  assert.equal(result.charts.length, 1);
  assert.deepEqual(Array.from(result.meshes[0].faceCharts), [0]);
  assert.equal(mesh.geometry.attributes.uv1.count, 3);
});

test("UV atlas preserves geometry when charts cannot fit", () => {
  const geometry = triangle();
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const result = unwrapUVs(
    mesh,
    (boxes) => {
      for (const box of boxes) {
        box.x = 0;
        box.y = 0;
      }
      return { w: 100, h: 100 };
    },
    { resolution: 4, padding: 4 },
  );
  assert.equal(result, null);
  assert.equal(mesh.geometry, geometry);
  assert.equal(geometry.getAttribute("uv1"), undefined);
});

test("UV atlas excludes degenerate faces", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 2, 0, 0], 3));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const result = unwrapUVs(mesh, () => ({ w: 0, h: 0 }));
  assert.ok(result);
  assert.equal(result.warnings.excludedFaces, 1);
  assert.deepEqual(Array.from(result.meshes[0].faceCharts), [-1]);
  assert.deepEqual(Array.from((mesh.geometry.attributes.uv1 as BufferAttribute).array), [0, 0, 0, 0, 0, 0]);
});

test("rectangular light libraries expose the existing LTC data for explicit composition", () => {
  const inputs = RectAreaLightUniformsLib.init();
  const library = RectAreaLightTexturesLib.init();
  assert.ok(library.LTC_FLOAT_1);
  assert.deepEqual(inputs.LTC_FLOAT_1.image.data, library.LTC_FLOAT_1.image.data);
  inputs.LTC_FLOAT_1.dispose();
  inputs.LTC_FLOAT_2.dispose();
  inputs.LTC_HALF_1.dispose();
  inputs.LTC_HALF_2.dispose();
  library.LTC_FLOAT_1?.dispose();
  library.LTC_FLOAT_2?.dispose();
  library.LTC_HALF_1?.dispose();
  library.LTC_HALF_2?.dispose();
});
