import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { Rhino3dmWorker } from "../src/addons/loaders/Rhino3dmWorker";

type WorkerMessage = { type: string; id: number; data?: unknown; error?: { message: string } };

afterEach(() => {
  vi.unstubAllGlobals();
});

function startWorker(
  runtime: (config: { wasmBinary: ArrayBuffer; onAbort(reason: unknown): void }) => Promise<unknown>,
) {
  const messages: { message: WorkerMessage; transfer: Transferable[] }[] = [];
  let complete: (value: { message: WorkerMessage; transfer: Transferable[] }) => void = () => {};
  vi.stubGlobal("self", {
    rhino3dm: runtime,
    postMessage(message: WorkerMessage, transfer: Transferable[] = []) {
      const result = { message, transfer };
      messages.push(result);
      if (message.type !== "warning") complete(result);
    },
  });
  vi.stubGlobal("onmessage", null);
  Rhino3dmWorker();
  const send = (data: unknown) => {
    const scope = globalThis as unknown as { onmessage: (event: MessageEvent<unknown>) => void };
    scope.onmessage({ data } as MessageEvent<unknown>);
  };
  const decode = (data: unknown) =>
    new Promise<{ message: WorkerMessage; transfer: Transferable[] }>((resolve) => {
      complete = resolve;
      send(data);
    });
  return { send, decode, messages };
}

test("decodes objects, metadata and transferable mesh buffers through worker messages", async () => {
  const deleted: string[] = [];
  const dispose = (name: string) => () => {
    deleted.push(name);
  };
  const meshType = { constructor: { name: "ObjectType_Mesh" }, value: 1 };
  const pointType = { constructor: { name: "ObjectType_Point" }, value: 2 };
  const shared = new Float32Array([1, 2, 3, 0, 0, 1]);
  const position = shared.subarray(0, 3);
  const normal = shared.subarray(3);
  const mesh = {
    objectType: meshType,
    userStringCount: 1,
    getUserStrings: () => [["geom", "value"]],
    toThreejsBuffers: (indexed: boolean) => {
      assert.equal(indexed, false);
      return { position, normal };
    },
    delete: dispose("mesh"),
  };
  const point = { objectType: pointType, location: [4, 5, 6], userStringCount: 0, delete: dispose("point") };
  const attrs = (id: string) => ({
    id,
    name: id,
    groupCount: 1,
    userStringCount: 1,
    getGroupList: () => [3],
    getUserStrings: () => [["key", "value"]],
    decals: () => ({ count: 0 }),
    drawColor: () => ({ r: 255, g: 128, b: 0 }),
    delete: dispose(`attrs:${id}`),
  });
  const object = (geometry: object, id: string) => ({
    geometry: () => geometry,
    attributes: () => attrs(id),
    delete: dispose(`object:${id}`),
  });
  const table = <T>(items: T[]) => ({ count: items.length, get: (index: number) => items[index] });
  const empty = () => table([]);
  const render = {
    ambientLight: "white",
    renderEnvironments: { reflectionId: "env" },
    groundPlane: {},
    safeFrame: {},
    dithering: {},
    skylight: {},
    linearWorkflow: {},
    renderChannels: {},
    sun: {},
    postEffects: {},
  };
  const doc = {
    objects: () => table([object(mesh, "mesh-id"), object(point, "point-id")]),
    instanceDefinitions: () =>
      table([{ name: "definition", getObjectIds: () => ["mesh-id"], delete: dispose("definition") }]),
    materials: empty,
    layers: () => table([{ name: "layer", visible: true, delete: dispose("layer") }]),
    views: empty,
    namedViews: empty,
    groups: empty,
    strings: () => table([["author", "test"]]),
    settings: () => ({ modelUnitSystem: "millimeters", renderSettings: () => render }),
    renderContent: () => table([{ kind: "environment", id: "env", findChild: () => ({ fileName: "sky.png" }) }]),
    embeddedFiles: () => table([{ fileName: "sky.png" }]),
    getEmbeddedFileAsBase64: (name: string) => {
      assert.equal(name, "sky.png");
      return "YWJj";
    },
    delete: dispose("document"),
  };
  const wasm = new ArrayBuffer(4);
  const buffer = new Uint8Array([1, 2, 3]).buffer;
  const runtime = {
    File3dm: {
      fromByteArray: (bytes: Uint8Array) => {
        assert.deepEqual(Array.from(bytes), [1, 2, 3]);
        return doc;
      },
    },
    ObjectType: { Mesh: meshType, Point: pointType },
    TextureType: {},
  };
  const worker = startWorker((config) => {
    assert.equal(config.wasmBinary, wasm);
    return Promise.resolve(runtime);
  });
  worker.send({ type: "init", libraryConfig: { wasmBinary: wasm } });
  const result = await worker.decode({ type: "decode", id: 17, buffer, subdivisionLevel: 0 });
  assert.equal(result.message.type, "decode");
  assert.equal(result.message.id, 17);
  const data = result.message.data as {
    objects: { objectType: string; geometry: unknown; attributes: Record<string, unknown> }[];
    layers: unknown[];
    strings: unknown[];
    settings: Record<string, unknown>;
    renderSettings: Record<string, unknown>;
    renderEnvironment: unknown;
  };
  assert.equal(data.objects.length, 3);
  assert.equal(data.objects[0].objectType, "Mesh");
  assert.deepEqual(data.objects[0].geometry, { format: "buffers", position, normal });
  assert.deepEqual(data.objects[0].attributes.groupIds, [3]);
  assert.deepEqual(data.objects[0].attributes.userStrings, [["key", "value"]]);
  const geometryProperties = data.objects[0].attributes.geometry;
  assert.ok(geometryProperties && typeof geometryProperties === "object" && "userStrings" in geometryProperties);
  assert.deepEqual(geometryProperties.userStrings, [["geom", "value"]]);
  assert.equal(data.objects[1].objectType, "Point");
  assert.deepEqual(data.objects[1].geometry, {
    data: {
      attributes: {
        position: { itemSize: 3, type: "Float32Array", array: [4, 5, 6] },
        color: { itemSize: 3, type: "Float32Array", array: [1, 128 / 255, 0] },
      },
    },
  });
  assert.equal(data.objects[2].objectType, "InstanceDefinition");
  assert.deepEqual(data.objects[2].attributes.objectIds, ["mesh-id"]);
  assert.deepEqual(data.layers, [{ name: "layer", visible: true }]);
  assert.deepEqual(data.strings, [["author", "test"]]);
  assert.equal(data.settings.modelUnitSystem, "millimeters");
  assert.equal(data.renderSettings.ambientLight, "white");
  assert.deepEqual(data.renderEnvironment, {
    type: "renderEnvironment",
    image: "data:image/png;base64,YWJj",
    name: "sky.png",
  });
  assert.deepEqual(result.transfer, [shared.buffer]);
  assert.deepEqual(deleted, [
    "mesh",
    "attrs:mesh-id",
    "object:mesh-id",
    "point",
    "attrs:point-id",
    "object:point-id",
    "definition",
    "layer",
    "document",
  ]);
});

test("reports initialization, input and invalid file errors with their task IDs", async () => {
  const worker = startWorker(() => Promise.resolve({ File3dm: { fromByteArray: () => null } }));
  const request = (id: number, buffer = new ArrayBuffer(1), subdivisionLevel = 0) => ({
    type: "decode",
    id,
    buffer,
    subdivisionLevel,
  });
  let result = await worker.decode(request(1));
  assert.equal(result.message.id, 1);
  assert.equal(result.message.type, "error");
  assert.equal(result.message.error?.message, "Rhino worker is not initialized");
  worker.send({ type: "init", libraryConfig: { wasmBinary: new ArrayBuffer(1) } });
  result = await worker.decode(request(2, new ArrayBuffer(0)));
  assert.equal(result.message.id, 2);
  assert.equal(result.message.error?.message, "Invalid Rhino decode input");
  result = await worker.decode(request(3, new ArrayBuffer(1), -1));
  assert.equal(result.message.id, 3);
  assert.equal(result.message.error?.message, "Invalid Rhino decode input");
  result = await worker.decode(request(4));
  assert.equal(result.message.id, 4);
  assert.equal(result.message.error?.message, "Invalid 3DM file");
  worker.send({ type: "init", libraryConfig: { wasmBinary: "invalid" } });
  result = await worker.decode(request(5));
  assert.equal(result.message.id, 5);
  assert.equal(result.message.error?.message, "Invalid Rhino WASM binary");
});
