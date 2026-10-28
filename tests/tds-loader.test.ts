import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { AdditiveBlending, DoubleSide } from "../src/constants";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { TDSLoader } from "../src/addons/loaders/TDSLoader";
import { MeshPhongMaterial } from "../src/materials/MeshPhongMaterial";
import { Mesh } from "../src/objects/Mesh";

afterEach(() => vi.unstubAllGlobals());

/** A minimal 3DS chunk: 2-byte id, 4-byte little-endian size that includes the header. */
function chunk(id: number, body: number[] | Uint8Array = []): number[] {
  const bytes = body instanceof Uint8Array ? Array.from(body) : body;
  return [id & 0xff, (id >> 8) & 0xff, (bytes.length + 6) & 0xff, ((bytes.length + 6) >> 8) & 0xff, 0, 0, ...bytes];
}

function concat(parts: number[][]): ArrayBuffer {
  return Uint8Array.from(parts.flat()).buffer as ArrayBuffer;
}

function u16(...values: number[]): number[] {
  return values.flatMap((value) => [value & 0xff, (value >> 8) & 0xff]);
}

function f32(...values: number[]): number[] {
  const bytes = new Uint8Array(values.length * 4);
  values.forEach((value, index) => new DataView(bytes.buffer).setFloat32(index * 4, value, true));
  return Array.from(bytes);
}

function ascii(value: string): number[] {
  return Array.from(new TextEncoder().encode(value)).concat(0);
}

function attribute(geometry: { getAttribute(name: string): unknown }, name: string): BufferAttribute {
  const value = geometry.getAttribute(name);
  assert.ok(value instanceof BufferAttribute, `missing ${name} attribute`);
  return value;
}

const materialEntry = chunk(0xafff, [
  ...chunk(0xa000, ascii("RedMat")),
  ...chunk(0xa020, chunk(0x0011, [255, 0, 0])),
  ...chunk(0xa030, chunk(0x0011, [0, 0, 255])),
  ...chunk(0xa040, chunk(0x0030, u16(50))),
  ...chunk(0xa050, chunk(0x0031, f32(0.25))),
  ...chunk(0xa081),
  ...chunk(0xa083),
  ...chunk(0xa085),
  ...chunk(0xa087, [4]),
]);

function meshEntry(materialName: string, name = "Tri"): number[] {
  const faceArray = chunk(0x4120, [
    ...u16(2),
    ...u16(0, 1, 2, 0),
    ...u16(0, 2, 3, 0),
    ...chunk(0x4130, [...ascii(materialName), ...u16(2), ...u16(0, 1)]),
  ]);

  const tri = chunk(0x4100, [
    ...chunk(0x4110, [...u16(4), ...f32(0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0)]),
    ...chunk(0x4140, [...u16(4), ...f32(0, 0, 1, 0, 1, 1, 0, 1)]),
    ...faceArray,
  ]);

  return chunk(0x4000, [...ascii(name), ...tri]);
}

function file(extra: number[] = []): ArrayBuffer {
  return concat([
    chunk(0x4d4d, [
      ...chunk(0x0002, [3, 0, 0, 0]),
      ...chunk(0x3d3d, [...materialEntry, ...extra, ...meshEntry("RedMat")]),
    ]),
  ]);
}

test("3DS chunks produce geometry, groups, textures and material properties", () => {
  const object = new TDSLoader().parse(file(), "");

  assert.equal(object.children.length, 1);
  const mesh = object.children[0];
  assert.ok(mesh instanceof Mesh, "expected a mesh child");
  assert.equal(mesh.name, "Tri");

  const material = mesh.material;
  assert.ok(material instanceof MeshPhongMaterial, "expected a single phong material");
  assert.equal(material.name, "RedMat");
  assert.equal(material.side, DoubleSide);
  assert.equal(material.blending, AdditiveBlending);
  assert.equal(material.wireframe, true);
  assert.equal(material.wireframeLinewidth, 4);
  assert.equal(material.shininess, 50);
  assert.equal(material.opacity, 0.75);
  assert.equal(material.transparent, true);
  assert.equal(Number(material.color.r.toFixed(3)), 1);
  assert.equal(material.color.g, 0);
  assert.equal(material.specular.b, 1);

  assert.equal(attribute(mesh.geometry, "position").count, 4);
  assert.equal(attribute(mesh.geometry, "uv").count, 4);
  assert.equal(attribute(mesh.geometry, "normal").count, 4);
  assert.deepEqual(Array.from(mesh.geometry.getIndex()?.array ?? []), [0, 1, 2, 0, 2, 3]);
  assert.deepEqual(
    mesh.geometry.groups.map((group) => [group.start, group.count, group.materialIndex]),
    [[0, 6, 0]],
  );
});

test("master scale applies to the returned group, not to the meshes", () => {
  const object = new TDSLoader().parse(file(chunk(0x0100, f32(2.5))), "");

  assert.equal(object.scale.x, 2.5);
  assert.equal(object.scale.y, 2.5);
  assert.equal(object.children[0].scale.x, 1);
});

test("texture maps resolve against the resource path and unknown map files stay null", () => {
  const textureEntry = chunk(0xafff, [
    ...chunk(0xa000, ascii("Mapped")),
    ...chunk(0xa200, [...chunk(0xa300, ascii("color.jpg")), ...chunk(0xa358, f32(0.5)), ...chunk(0xa356, f32(2))]),
  ]);

  const loaded: string[] = [];
  vi.stubGlobal("document", {
    createElementNS: () => {
      const listeners = new Map<string, () => void>();
      return {
        complete: false,
        addEventListener(type: string, listener: () => void) {
          listeners.set(type, listener);
        },
        removeEventListener(type: string) {
          listeners.delete(type);
        },
        set src(value: string) {
          loaded.push(value);
          queueMicrotask(() => listeners.get("load")?.());
        },
      };
    },
  });

  const loader = new TDSLoader().setResourcePath("/textures/");
  const object = loader.parse(
    concat([chunk(0x4d4d, chunk(0x3d3d, [...textureEntry, ...meshEntry("Mapped")]))]),
    "/models/",
  );

  const mesh = object.children.find((child) => child.name === "Tri");
  assert.ok(mesh instanceof Mesh);
  const material = mesh.material;
  assert.ok(material instanceof MeshPhongMaterial);
  assert.equal(material.map !== null, true);
  assert.equal(loaded[0], "/textures/color.jpg");
  assert.equal(material.name, "Mapped");
  assert.equal(material.map?.offset.x, 0.5);
  assert.equal(material.map?.repeat.y, 2);
});

test("a truncated file throws instead of returning a partially built group", () => {
  assert.throws(() => new TDSLoader().parse(new ArrayBuffer(2), ""));
});
