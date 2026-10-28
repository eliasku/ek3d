import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { Rhino3dmLoader } from "../src/addons/loaders/3DMLoader";
import { FileLoader } from "../src/loaders/FileLoader";
import { Mesh } from "../src/objects/Mesh";
import { TextureLoader } from "../src/loaders/TextureLoader";
import { Texture } from "../src/textures/Texture";
import { MeshPhysicalMaterial } from "../src/materials/MeshPhysicalMaterial";
import { SpotLight } from "../src/lights/SpotLight";
import { ClampToEdgeWrapping, RepeatWrapping } from "../src/constants";

const attributes = {
  id: "mesh",
  name: "triangle",
  layerIndex: 0,
  materialIndex: -1,
  materialSource: { name: "ObjectMaterialSource_MaterialFromObject" },
  drawColor: { r: 255, g: 0, b: 0, a: 255 },
  castsShadows: true,
  receivesShadows: true,
  isInstanceDefinitionObject: true,
  objectIds: [] as string[],
};
const emptyData = () => ({
  objects: [],
  materials: [],
  layers: [],
  views: [],
  namedViews: [],
  groups: [],
  strings: [],
  settings: {},
  renderSettings: {},
  renderEnvironment: null,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("builds typed geometry and transformed instance definitions", () => {
  const loader = new Rhino3dmLoader();
  const data = {
    ...emptyData(),
    layers: [{ renderMaterialIndex: -1, visible: false }],
    objects: [
      {
        objectType: "Mesh",
        attributes,
        geometry: {
          format: "buffers" as const,
          position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          index: new Uint32Array([0, 1, 2]),
        },
      },
      {
        objectType: "Mesh",
        attributes: { ...attributes, id: "second", name: "second" },
        geometry: { format: "buffers" as const, position: new Float32Array([0, 0, 0]) },
      },
      {
        objectType: "InstanceDefinition",
        attributes: { ...attributes, id: "definition", objectIds: ["second", "mesh"] },
        geometry: null,
      },
      {
        objectType: "InstanceReference",
        attributes,
        geometry: {
          parentIdefId: "definition",
          xform: {
            array: [1, 0, 0, 4, 0, 1, 0, 5, 0, 0, 1, 6, 0, 0, 0, 1] as [
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
            ],
          },
        },
      },
    ],
  };
  const result = loader._createGeometry(data);
  assert.equal(result.children.length, 1);
  const instance = result.children[0];
  assert.deepEqual(instance.position.toArray(), [4, 5, 6]);
  assert.deepEqual(
    instance.children.map((child) => child.name),
    ["second", "triangle"],
  );
  const mesh = instance.children[1];
  assert.ok(mesh instanceof Mesh);
  assert.equal(mesh.visible, false);
  assert.equal(mesh.name, "triangle");
  assert.equal(mesh.geometry.getAttribute("position")?.count, 3);
  assert.deepEqual(Array.from(mesh.geometry.index!.array), [0, 1, 2]);
  assert.equal(mesh.castShadow, true);
  assert.equal(result.userData.objectType, "File3dm");
});

test("reads worker-serialized numeric-key vectors for text dots and lights", () => {
  const context = {
    canvas: { width: 0, height: 0, style: { width: "", height: "" } },
    font: "",
    textBaseline: "",
    textAlign: "",
    fillStyle: "",
    measureText: () => ({ width: 20 }),
    setTransform: () => {},
    fillRect: () => {},
    fillText: () => {},
  };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  const loader = new Rhino3dmLoader();
  const dot = loader._createObject(
    {
      objectType: "TextDot",
      attributes,
      geometry: { fontHeight: 10, fontFace: "Arial", text: "dot", point: { 0: 1, 1: 2, 2: 3 } },
    },
    null,
  );
  assert.deepEqual(dot?.position.toArray(), [1, 2, 3]);
  for (const style of [
    "LightStyle_WorldPoint",
    "LightStyle_WorldSpot",
    "LightStyle_WorldDirectional",
    "LightStyle_WorldRectangular",
  ]) {
    const light = loader._createObject(
      {
        objectType: "Light",
        attributes,
        geometry: {
          lightStyle: { name: style },
          location: { 0: 4, 1: 5, 2: 6 },
          direction: { 0: 1, 1: 2, 2: 3 },
          width: { 0: 0, 1: 0, 2: 2 },
          length: { 0: 4, 1: 0, 2: 0 },
          intensity: 2,
          diffuse: attributes.drawColor,
          spotAngleRadians: 0.5,
        },
      },
      null,
    );
    assert.ok(light);
    assert.deepEqual(light.position.toArray(), style === "LightStyle_WorldRectangular" ? [2, 5, 5] : [4, 5, 6]);
    if (light instanceof SpotLight) assert.deepEqual(light.target.position.toArray(), [1, 2, 3]);
  }
});

test("maps PBR textures and reports unsupported texture types", () => {
  const maps = new Map<string, Texture>();
  vi.spyOn(TextureLoader.prototype, "load").mockImplementation((url) => {
    const texture = new Texture();
    maps.set(url, texture);
    return texture;
  });
  const color = { r: 255, g: 128, b: 0, a: 255 };
  const textureTypes = [
    "Bump",
    "Diffuse",
    "Emap",
    "Opacity",
    "Transparency",
    "PBR_Alpha",
    "PBR_AmbientOcclusion",
    "PBR_Anisotropic",
    "PBR_BaseColor",
    "PBR_Clearcoat",
    "PBR_ClearcoatBump",
    "PBR_ClearcoatRoughness",
    "PBR_Displacement",
    "PBR_Emission",
    "PBR_Metallic",
    "PBR_Roughness",
    "PBR_Sheen",
    "PBR_Specular",
    "PBR_Subsurface",
    "Unknown",
  ];
  const loader = new Rhino3dmLoader();
  const mat = loader._createMaterial({
    id: "id",
    name: "pbr",
    diffuseColor: color,
    emissionColor: color,
    specularColor: color,
    disableLighting: false,
    indexOfRefraction: 1.5,
    reflectivity: 0.5,
    transparency: 0,
    pbrSupported: true,
    pbr: {
      anisotropic: 0.1,
      anisotropicRotation: 0.2,
      baseColor: color,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      metallic: 0.5,
      roughness: 0.6,
      sheen: 0.7,
      specular: 0.8,
      subsurface: 0.9,
      opacity: 0.5,
    },
    textures: textureTypes.map((type) => ({
      type,
      image: type,
      wrapU: 0,
      wrapV: 1,
      repeat: [2, 3] as [number, number],
    })),
  });
  assert.ok(mat instanceof MeshPhysicalMaterial);
  const mappings = {
    bumpMap: "Bump",
    map: "PBR_BaseColor",
    envMap: "Emap",
    transmissionMap: "Opacity",
    alphaMap: "PBR_Alpha",
    aoMap: "PBR_AmbientOcclusion",
    anisotropyMap: "PBR_Anisotropic",
    clearcoatMap: "PBR_Clearcoat",
    clearcoatNormalMap: "PBR_ClearcoatBump",
    clearcoatRoughnessMap: "PBR_ClearcoatRoughness",
    displacementMap: "PBR_Displacement",
    emissiveMap: "PBR_Emission",
    metalnessMap: "PBR_Metallic",
    roughnessMap: "PBR_Roughness",
    sheenColorMap: "PBR_Sheen",
    specularColorMap: "PBR_Specular",
    thicknessMap: "PBR_Subsurface",
  } as const;
  for (const [field, name] of Object.entries(mappings)) assert.equal(Reflect.get(mat, field), maps.get(name));
  assert.equal(mat.opacity, 0.5);
  assert.equal(mat.transparent, true);
  assert.equal(mat.transmission, 0);
  assert.equal(maps.get("Bump")?.wrapS, RepeatWrapping);
  assert.equal(maps.get("Bump")?.wrapT, ClampToEdgeWrapping);
  assert.deepEqual(maps.get("Bump")?.repeat.toArray(), [2, 3]);
  assert.match(loader.warnings[0].message, /Unknown/);
});

test("disposal rejects decoding while runtime files are still loading", async () => {
  vi.spyOn(FileLoader.prototype, "loadAsync").mockImplementation(() => new Promise(() => {}));
  const loader = new Rhino3dmLoader();
  const pending = loader.parseAsync(new ArrayBuffer(8));
  loader.dispose();
  await assert.rejects(pending, /disposed/);
  await assert.rejects(loader.parseAsync(new ArrayBuffer(1)), /disposed/);
});

test("worker tasks are cached, tracked, rejected and released on disposal", async () => {
  vi.spyOn(FileLoader.prototype, "loadAsync").mockImplementation(function (this: FileLoader) {
    return Promise.resolve(this.responseType === "arraybuffer" ? new ArrayBuffer(4) : "runtime");
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:rhino-test");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  let started: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    terminated: boolean = false;
    constructor() {
      workers.push(this);
    }
    postMessage(message: { type: string }): void {
      if (message.type === "decode") started();
    }
    terminate(): void {
      this.terminated = true;
    }
  }
  vi.stubGlobal("Worker", FakeWorker);
  const loader = new Rhino3dmLoader().setLibraryPath("/runtime/").setWorkerLimit(1);
  const buffer = new ArrayBuffer(12);
  const pending = loader.decodeObjects(buffer, "model.3dm");
  assert.equal(loader.decodeObjects(buffer, "model.3dm"), pending);
  await ready;
  assert.equal(loader.workerPool[0].load, 12);
  loader.dispose();
  await assert.rejects(pending, /disposed/);
  assert.equal(workers[0].terminated, true);
  assert.equal(loader.workerPool.length, 0);
  assert.deepEqual(revoke.mock.calls[0], ["blob:rhino-test"]);
});

test("worker warnings and decode errors settle their own tasks and release cost", async () => {
  vi.spyOn(FileLoader.prototype, "loadAsync").mockImplementation(function (this: FileLoader) {
    return Promise.resolve(this.responseType === "arraybuffer" ? new ArrayBuffer(4) : "runtime");
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:rhino-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  let started: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    constructor() {
      workers.push(this);
    }
    postMessage(message: { type: string }): void {
      if (message.type === "decode") started();
    }
    terminate(): void {}
  }
  vi.stubGlobal("Worker", FakeWorker);
  const loader = new Rhino3dmLoader();
  const pending = loader.parseAsync(new ArrayBuffer(7));
  await ready;
  const send = (data: unknown) => workers[0].onmessage?.({ data } as MessageEvent);
  send({ type: "warning", id: 1, data: { message: "missing image", type: "missing resource" } });
  send({ type: "error", id: 1, error: { message: "invalid 3dm" } });
  await assert.rejects(pending, /invalid 3dm/);
  assert.equal(loader.warnings[0].message, "missing image");
  assert.equal(loader.workerPool[0].load, 0);
  loader.dispose();
});
