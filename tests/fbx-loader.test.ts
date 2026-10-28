import assert from "node:assert/strict";
import { deflateSync, inflateSync } from "node:zlib";
import { afterEach, test, vi } from "vite-plus/test";
import { FBXLoader } from "../src/addons/loaders/FBXLoader";
import type { FBXZlibRuntime } from "../src/addons/loaders/FBXLoader";
import { NURBSCurve } from "../src/addons/curves/NURBSCurve";
import { Wrapping, ColorSpace } from "../src/constants";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { Vector4 } from "../src/math/Vector4";
import { Bone } from "../src/objects/Bone";
import { Line } from "../src/objects/Line";
import { Mesh } from "../src/objects/Mesh";
import { SkinnedMesh } from "../src/objects/SkinnedMesh";

afterEach(() => vi.unstubAllGlobals());

function ascii(lines: string[]): ArrayBuffer {
  const bytes = new TextEncoder().encode(lines.join("\n") + "\n");
  return bytes.buffer.slice(0) as ArrayBuffer;
}

function attribute(geometry: { getAttribute(name: string): unknown }, name: string): BufferAttribute {
  const value = geometry.getAttribute(name);
  assert.ok(value instanceof BufferAttribute, `missing ${name} attribute`);
  return value;
}

/** Extent of one attribute component, which is stable regardless of earcut triangle order. */
function extent(attribute: BufferAttribute, component: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < attribute.count; i++) {
    const value = attribute.getComponent(i, component);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max];
}

// --- binary fixture builder -------------------------------------------------

interface BinaryNode {
  name: string;
  properties: Uint8Array[];
  children: BinaryNode[];
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function int64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, true);
  view.setUint32(4, Math.floor(value / 0x100000000), true);
  return bytes;
}

function propString(value: string): Uint8Array {
  const text = new TextEncoder().encode(value);
  return concat([Uint8Array.of(0x53), uint32(text.byteLength), text]);
}

function propLong(value: number): Uint8Array {
  return concat([Uint8Array.of(0x4c), int64(value)]);
}

function propIntArray(values: number[]): Uint8Array {
  const data = new Uint8Array(values.length * 4);
  values.forEach((value, i) => new DataView(data.buffer).setInt32(i * 4, value, true));
  return concat([Uint8Array.of(0x69), uint32(values.length), uint32(0), uint32(0), data]);
}

function propDoubleArray(values: number[], compressed: boolean): Uint8Array {
  const raw = new Uint8Array(values.length * 8);
  values.forEach((value, i) => new DataView(raw.buffer).setFloat64(i * 8, value, true));

  if (!compressed) return concat([Uint8Array.of(0x64), uint32(values.length), uint32(0), uint32(0), raw]);

  // fflate's `unzlibSync` expects a zlib wrapper, which is what node's deflateSync produces.
  const deflated = deflateSync(raw);
  const packed = new Uint8Array(deflated.buffer, deflated.byteOffset, deflated.byteLength);
  return concat([Uint8Array.of(0x64), uint32(values.length), uint32(1), uint32(packed.byteLength), packed]);
}

const nameBytes = (node: BinaryNode): Uint8Array => new TextEncoder().encode(node.name);

function nodeSize(node: BinaryNode): number {
  const properties = node.properties.reduce((sum, property) => sum + property.byteLength, 0);
  const children = node.children.reduce((sum, child) => sum + nodeSize(child), 0);
  return 12 + 1 + nameBytes(node).byteLength + properties + children;
}

function encodeNode(node: BinaryNode, base: number): Uint8Array {
  const name = nameBytes(node);
  const properties = concat(node.properties);
  const header = concat([uint32(base + nodeSize(node)), uint32(node.properties.length), uint32(properties.byteLength)]);
  const parts = [header, Uint8Array.of(name.byteLength), name, properties];

  let offset = base + header.byteLength + 1 + name.byteLength + properties.byteLength;
  for (const child of node.children) {
    const bytes = encodeNode(child, offset);
    parts.push(bytes);
    offset += bytes.byteLength;
  }

  return concat(parts);
}

function binaryFBX(version: number, nodes: BinaryNode[]): ArrayBuffer {
  const magic = new TextEncoder().encode("Kaydara FBX Binary  \0");
  const header = concat([magic, Uint8Array.of(0x1a, 0x00), uint32(version)]);
  const parts = [header];
  let offset = header.byteLength;
  for (const node of nodes) {
    const bytes = encodeNode(node, offset);
    parts.push(bytes);
    offset += bytes.byteLength;
  }
  // The end-of-content heuristic reserves a 160-byte footer plus alignment padding.
  parts.push(new Uint8Array(192));
  const file = concat(parts);
  return file.buffer.slice(0) as ArrayBuffer;
}

function binaryMeshNodes(compressed: boolean): BinaryNode[] {
  return [
    {
      name: "Objects",
      properties: [],
      children: [
        {
          name: "Geometry",
          properties: [propLong(100), propString("Geometry::quad"), propString("Mesh")],
          children: [
            {
              name: "Vertices",
              properties: [propDoubleArray([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], compressed)],
              children: [],
            },
            {
              name: "PolygonVertexIndex",
              properties: [propIntArray([0, 1, 2, -4])],
              children: [],
            },
          ],
        },
        {
          name: "Model",
          properties: [propLong(200), propString("Model::quad"), propString("Mesh")],
          children: [],
        },
      ],
    },
    {
      name: "Connections",
      properties: [],
      children: [
        {
          name: "C",
          properties: [propString("OO"), propLong(100), propLong(200)],
          children: [],
        },
      ],
    },
  ];
}

const runtime: FBXZlibRuntime = { unzlibSync: (data: Uint8Array): Uint8Array => new Uint8Array(inflateSync(data)) };

const quadObject = [
  '\tGeometry: 100, "Geometry::quad", "Mesh" {',
  "\t\tVertices: *12 {",
  "\t\t\ta: 0,0,0,1,0,0,1,1,0,0,1,0",
  "\t\t}",
  "\t\tPolygonVertexIndex: *4 {",
  "\t\t\ta: 0,1,2,-4",
  "\t\t}",
  "\t\tLayerElementNormal: 0 {",
  "\t\t\tVersion: 101",
  '\t\t\tName: ""',
  '\t\t\tMappingInformationType: "ByPolygonVertex"',
  '\t\t\tReferenceInformationType: "Direct"',
  "\t\t\tNormals: *12 {",
  "\t\t\t\ta: 0,0,1,0,0,1,0,0,1,0,0,1",
  "\t\t\t}",
  "\t\t}",
  "\t\tLayerElementUV: 0 {",
  "\t\t\tVersion: 101",
  '\t\t\tName: "UVChannel_1"',
  '\t\t\tMappingInformationType: "ByPolygonVertex"',
  '\t\t\tReferenceInformationType: "Direct"',
  "\t\t\tUV: *8 {",
  "\t\t\t\ta: 0,0,1,0,1,1,0,1",
  "\t\t\t}",
  "\t\t}",
  "\t}",
  '\tModel: 200, "Model::quad", "Mesh" {',
  "\t\tVersion: 232",
  "\t}",
];

const header = ["; FBX 7.4.0 project file", "FBXHeaderExtension:  {", "\tFBXVersion: 7400", "}"];

test("ASCII quad geometry triangulates and keeps normals and UVs", () => {
  const group = new FBXLoader().parse(
    ascii([...header, "Objects:  {", ...quadObject, "}", "Connections:  {", '\tC: "OO",100,200', "}"]),
  );

  const mesh = group.children[0];
  assert.ok(mesh instanceof Mesh, "expected a mesh model");
  assert.ok(!Array.isArray(mesh.material), "a single material must not become an array");

  const geometry = mesh.geometry;
  assert.equal(attribute(geometry, "position").count, 6, "a quad becomes two triangles");
  assert.equal(attribute(geometry, "normal").count, 6);
  assert.equal(attribute(geometry, "uv").count, 6);
  assert.deepEqual(extent(attribute(geometry, "position"), 0), [0, 1]);
  assert.deepEqual(extent(attribute(geometry, "position"), 1), [0, 1]);
  assert.deepEqual(extent(attribute(geometry, "uv"), 1), [0, 1]);
  assert.equal(mesh.castShadow, false);
});

test("ASCII skin cluster binds a skeleton and pads weights to four influences", () => {
  const group = new FBXLoader().parse(
    ascii([
      ...header,
      "Objects:  {",
      ...quadObject,
      '\tModel: 210, "Model::joint1", "LimbNode" {',
      "\t\tVersion: 232",
      "\t}",
      '\tDeformer: 700, "Deformer::skinCluster1", "Skin" {',
      "\t\tVersion: 101",
      "\t}",
      '\tDeformer: 701, "SubDeformer::cluster1", "Cluster" {',
      "\t\tVersion: 100",
      "\t\tIndexes: *4 {",
      "\t\t\ta: 0,1,2,3",
      "\t\t}",
      "\t\tWeights: *4 {",
      "\t\t\ta: 1,1,1,1",
      "\t\t}",
      "\t\tTransformLink: *16 {",
      "\t\t\ta: 1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1",
      "\t\t}",
      "\t}",
      "}",
      "Connections:  {",
      '\tC: "OO",700,100',
      '\tC: "OO",701,700',
      '\tC: "OO",100,200',
      '\tC: "OO",210,701',
      '\tC: "OO",902,200',
      "}",
    ]),
  );

  const meshes: SkinnedMesh[] = [];
  const bones: Bone[] = [];
  group.traverse((child) => {
    if (child instanceof SkinnedMesh) meshes.push(child);
    if (child instanceof Bone) bones.push(child);
  });

  assert.equal(meshes.length, 1, "expected one skinned mesh");
  assert.equal(bones.length, 1, "expected one bone for the cluster");

  const skinned = meshes[0];
  assert.equal(skinned.skeleton.bones.length, 1);
  assert.equal(skinned.skeleton.bones[0], bones[0]);

  const skinWeight = attribute(skinned.geometry, "skinWeight");
  assert.equal(skinWeight.count, 6);
  assert.equal(skinWeight.itemSize, 4);

  for (let i = 0; i < skinWeight.count; i++) {
    assert.equal(skinWeight.getComponent(i, 0), 1, "painted weight survives normalization");
    assert.equal(skinWeight.getComponent(i, 3), 0, "missing influences are padded with zero");
  }
});

test("ASCII animation stacks produce position tracks and trimming rebases them", () => {
  const lines = [
    ...header,
    "Objects:  {",
    ...quadObject,
    '\tAnimationCurve: 300, "AnimCurve::", "" {',
    "\t\tDefault: 0",
    "\t\tKeyVer: 4008",
    "\t\tKeyTime: *3 {",
    "\t\t\ta: 0,23093079000,46186158000",
    "\t\t}",
    "\t\tKeyValueFloat: *3 {",
    "\t\t\ta: 0,10,0",
    "\t\t}",
    "\t}",
    '\tAnimationCurveNode: 400, "AnimCurveNode::T", "" {',
    "\t\tProperties70:  {",
    '\t\t\tP: "d|X", "Number", "", "A",0',
    "\t\t}",
    "\t}",
    '\tAnimationLayer: 500, "AnimLayer::BaseLayer", "" {',
    "\t}",
    '\tAnimationStack: 600, "AnimStack::Take 001", "" {',
    "\t\tProperties70:  {",
    '\t\t\tP: "LocalStart", "KTime", "Time", "",0',
    '\t\t\tP: "LocalStop", "KTime", "Time", "",23093079000',
    "\t\t}",
    "\t}",
    "}",
    "Connections:  {",
    '\tC: "OO",100,200',
    '\tC: "OP",300,400, "d|X"',
    '\tC: "OP",400,200, "Lcl Translation"',
    '\tC: "OO",400,500',
    '\tC: "OO",500,600',
    "}",
  ];

  const group = new FBXLoader().parse(ascii(lines));

  assert.equal(group.animations.length, 1);
  const clip = group.animations[0];
  assert.equal(clip.name, "Take 001");
  assert.equal(clip.tracks.length, 1, "only the animated axis produces a track");

  const [track] = clip.tracks;
  assert.equal(track.name, "quad.position");
  assert.deepEqual(Array.from(track.times), [0, 0.5, 1]);
  assert.deepEqual(Array.from(track.values as Float32Array), [0, 0, 0, 10, 0, 0, 0, 0, 0]);

  const loader = new FBXLoader();
  loader.trimAnimationClips = true;
  const trimmed = loader.parse(ascii(lines)).animations[0];

  assert.equal(trimmed.tracks.length, 1);
  assert.deepEqual(Array.from(trimmed.tracks[0].times), [0, 0.5], "the clip starts at zero");
  assert.deepEqual(Array.from(trimmed.tracks[0].values as Float32Array), [0, 0, 0, 10, 0, 0]);
});

test("ASCII NurbsCurve geometry samples the NURBS closure", () => {
  const group = new FBXLoader().parse(
    ascii([
      ...header,
      "Objects:  {",
      '\tGeometry: 110, "Geometry::nurbs", "NurbsCurve" {',
      "\t\tOrder: 2",
      '\t\tForm: "Open"',
      "\t\tKnotVector: *4 {",
      "\t\t\ta: 0,0,1,1",
      "\t\t}",
      "\t\tPoints: *8 {",
      "\t\t\ta: 0,0,0,1,10,10,0,1",
      "\t\t}",
      "\t}",
      '\tModel: 300, "Model::nurbs", "NurbsCurve" {',
      "\t\tVersion: 232",
      "\t}",
      "}",
      "Connections:  {",
      '\tC: "OO",110,300',
      "}",
    ]),
  );

  const line = group.children[0];
  assert.ok(line instanceof Line, "expected a NURBS line model");
  assert.equal(line.material.linewidth, 1);

  const position = attribute(line.geometry, "position");
  assert.equal(position.count, 25, "two control points sampled twelve times each");
  assert.deepEqual(extent(position, 0), [0, 10]);
  assert.deepEqual(extent(position, 1), [0, 10]);
  assert.deepEqual(Array.from(position.array.slice(0, 3)), [0, 0, 0]);
  assert.deepEqual(Array.from(position.array.slice(-3)), [10, 10, 0]);
});

test("NURBSCurve evaluates weighted control points and a unit tangent", () => {
  const curve = new NURBSCurve(
    2,
    [0, 0, 0, 1, 1, 1],
    [new Vector4(0, 0, 0, 1), new Vector4(5, 10, 0, 1), new Vector4(10, 0, 0, 1)],
  );

  const start = curve.getPoint(0);
  assert.deepEqual([start.x, start.y, start.z], [0, 0, 0]);

  const middle = curve.getPoint(0.5);
  assert.ok(Math.abs(middle.y - 5) < 1e-9, `midpoint y was ${middle.y}`);

  const tangent = curve.getTangent(0.5);
  assert.ok(Math.abs(tangent.length() - 1) < 1e-9, "tangent must be normalized");
});

test("missing versions and unsupported or unknown formats are rejected", () => {
  assert.throws(() => new FBXLoader().parse(ascii(["; no version"])), /Cannot find the version number/);

  assert.throws(
    () =>
      new FBXLoader().parse(ascii(["; FBX 6.0.0 project file", "FBXHeaderExtension:  {", "\tFBXVersion: 6100", "}"])),
    /FBX version not supported, FileVersion: 6100/,
  );

  assert.throws(
    () => new FBXLoader().parse(ascii(["Kaydara\\FBX\\Binary\\\\", "not really binary"])),
    /Unknown format/,
  );
});

test("binary files below version 6400 are rejected", () => {
  assert.throws(() => new FBXLoader().parse(binaryFBX(6100, [])), /FBX version not supported, FileVersion: 6100/);
});

test("uncompressed binary arrays parse without a zlib runtime", () => {
  const group = new FBXLoader().parse(binaryFBX(7400, binaryMeshNodes(false)));

  const mesh = group.children[0];
  assert.ok(mesh instanceof Mesh, "expected a binary mesh model");

  const position = attribute(mesh.geometry, "position");
  assert.equal(position.count, 6);
  assert.deepEqual(extent(position, 0), [0, 1]);
  assert.deepEqual(extent(position, 1), [0, 1]);
});

test("compressed binary arrays require the injected zlib runtime", () => {
  const buffer = binaryFBX(7400, binaryMeshNodes(true));

  assert.throws(() => new FBXLoader().parse(buffer), /setZlibDecoder/);

  const loader = new FBXLoader();
  loader.setZlibDecoder(runtime);
  const group = loader.parse(buffer);

  const mesh = group.children[0];
  assert.ok(mesh instanceof Mesh, "expected a binary mesh model");

  const position = attribute(mesh.geometry, "position");
  assert.equal(position.count, 6);
  assert.deepEqual(extent(position, 0), [0, 1]);
  assert.deepEqual(extent(position, 1), [0, 1]);
});

test("embedded texture content becomes a data URL with FBX wrap and color space settings", () => {
  const image = { addEventListener: () => undefined, removeEventListener: () => undefined, src: "" };
  vi.stubGlobal("document", {
    createElementNS: () => image,
  });

  const group = new FBXLoader().parse(
    ascii([
      ...header,
      "Objects:  {",
      '\tVideo: 900, "Video::embedded", "Clip" {',
      '\t\tFilename: "embedded.png"',
      '\t\tRelativeFilename: "embedded.png"',
      "\t\tContent: ,",
      '\t\t\t"aGVsbG8="',
      "\t}",
      '\tTexture: 901, "Texture::embedded", "" {',
      '\t\tFileName: "embedded.png"',
      "\t\tProperties70:  {",
      '\t\t\tP: "WrapModeU", "enum", "", "",0',
      '\t\t\tP: "WrapModeV", "enum", "", "",1',
      "\t\t}",
      "\t}",
      '\tMaterial: 902, "Material::mat", "" {',
      '\t\tShadingModel: "phong"',
      "\t\tDiffuseColor: 1,0,0",
      "\t}",
      ...quadObject,
      "}",
      "Connections:  {",
      // FBX "OO" lists the child first: the embedded video is a child of its texture.
      '\tC: "OO",900,901',
      '\tC: "OP",901,902, "DiffuseColor"',
      '\tC: "OO",100,200',
      '\tC: "OO",902,200',
      "}",
    ]),
  );

  const mesh = group.children[0];
  assert.ok(mesh instanceof Mesh, "expected a mesh model");
  assert.ok(!Array.isArray(mesh.material));

  assert.equal(mesh.material.name, "mat");
  const map = mesh.material.map;
  assert.ok(map !== null, "expected the diffuse texture to be attached");
  assert.equal(image.src, "data:image/png;base64,aGVsbG8=");
  assert.equal(map.wrapS, Wrapping.Repeat, "wrap mode 0 repeats");
  assert.equal(map.wrapT, Wrapping.ClampToEdge, "wrap mode 1 clamps");
  assert.equal(map.colorSpace, ColorSpace.SRGB, "diffuse maps are sRGB");
});
