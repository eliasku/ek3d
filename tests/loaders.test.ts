import { afterEach, test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { Cache } from "../src/loaders/Cache";
import { Loader } from "../src/loaders/Loader";
import { LoadingManager } from "../src/loaders/LoadingManager";
import { FileLoader } from "../src/loaders/FileLoader";
import { DataTextureLoader } from "../src/loaders/DataTextureLoader";
import { CompressedTextureLoader } from "../src/loaders/CompressedTextureLoader";
import { TextureFilter, Wrapping, PixelFormat, ColorSpace } from "../src/constants";

afterEach(() => vi.unstubAllGlobals());

function progressEvents() {
  if (typeof ProgressEvent !== "undefined") return;
  vi.stubGlobal(
    "ProgressEvent",
    class extends Event {
      readonly lengthComputable: boolean;
      readonly loaded: number;
      readonly total: number;
      constructor(type: string, init: ProgressEventInit = {}) {
        super(type);
        this.lengthComputable = init.lengthComputable ?? false;
        this.loaded = init.loaded ?? 0;
        this.total = init.total ?? 0;
      }
    },
  );
}

function completed(manager: LoadingManager) {
  return new Promise<void>((resolve) => {
    manager.onLoad = resolve;
  });
}

test("cache and default loader state have explicit independent owners", () => {
  const first = new FileLoader();
  const second = new FileLoader();
  assert.notEqual(first.manager, second.manager);
  assert.notEqual(first.manager.cache, second.manager.cache);
  assert.notEqual(first.manager.fileRequests, second.manager.fileRequests);
  assert.notEqual(first.manager.imageRequests, second.manager.imageRequests);
  assert.notEqual(first.manager.bitmapErrors, second.manager.bitmapErrors);
  assert.equal(first instanceof Loader, true);
  assert.equal(first.resourcePath, "");
  assert.equal(Loader.DEFAULT_MATERIAL_NAME, "__DEFAULT");
  const cache = new Cache();
  cache.add("file:asset", 1);
  assert.equal(cache.get("file:asset"), undefined);
  cache.enabled = true;
  cache.add("file:asset", 2);
  cache.add("__proto__", 3);
  assert.equal(cache.get("file:asset"), 2);
  assert.equal(cache.get("__proto__"), 3);
  cache.add("image:blob:https://example.test/id", {});
  assert.equal(cache.get("image:blob:https://example.test/id"), undefined);
  cache.remove("file:asset");
  assert.equal(cache.get("file:asset"), undefined);
  cache.clear();
  assert.deepEqual(Object.keys(cache.files), []);
});

test("manager resolves normalized URLs and owns handlers, progress, errors and reusable abort signals", () => {
  const events: unknown[][] = [];
  const manager = new LoadingManager(
    () => events.push(["complete"]),
    (...args) => events.push(["progress", ...args]),
    (...args) => events.push(["error", ...args]),
  );
  manager.onStart = (...args) => events.push(["start", ...args]);
  manager.setURLModifier((url) => "/assets/" + url);
  assert.equal(manager.resolveURL("cafe\u0301.png"), "/assets/café.png");
  const regex = /\.png$/g;
  const handler = new FileLoader(manager);
  manager.addHandler(regex, handler);
  assert.equal(manager.getHandler("a.png"), handler);
  assert.equal(manager.getHandler("b.png"), handler);
  manager.removeHandler(regex);
  assert.equal(manager.getHandler("a.png"), null);
  manager.itemStart("a");
  manager.itemStart("b");
  manager.itemEnd("a");
  manager.itemError("b");
  manager.itemEnd("b");
  assert.deepEqual(events, [
    ["start", "a", 0, 1],
    ["progress", "a", 1, 2],
    ["error", "b"],
    ["progress", "b", 2, 2],
    ["complete"],
  ]);
  const signal = manager.abortController.signal;
  manager.abort();
  assert.equal(signal.aborted, true);
  assert.equal(manager.abortController.signal.aborted, false);
});

test("file requests deduplicate only inside one manager and preserve options, progress and async cache delivery", async () => {
  progressEvents();
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request);
      return new Response("hello", { headers: { "Content-Length": "5" } });
    }),
  );
  const manager = new LoadingManager();
  manager.cache.enabled = true;
  const done = completed(manager);
  const items = vi.fn();
  manager.onProgress = items;
  manager.setURLModifier((url) => "https://example.test/" + url);
  const progress = vi.fn();
  const loader = new FileLoader(manager)
    .setPath("assets/")
    .setRequestHeader({ "X-Asset": "one" })
    .setWithCredentials(true)
    .setPriority("high")
    .setCache("no-store");
  const one = loader.loadAsync("hello.txt", progress);
  const duplicate = new FileLoader(manager).setPath("assets/").loadAsync("hello.txt", progress);
  const isolated = new FileLoader().loadAsync("https://example.test/assets/hello.txt");
  assert.deepEqual(await Promise.all([one, duplicate, isolated]), ["hello", "hello", "hello"]);
  await done;
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://example.test/assets/hello.txt");
  assert.equal(requests[0].headers.get("X-Asset"), "one");
  assert.equal(requests[0].credentials, "include");
  assert.equal(requests[0].cache, "no-store");
  assert.equal(items.mock.calls.length, 1);
  assert.deepEqual(items.mock.calls[0], ["https://example.test/assets/hello.txt", 1, 1]);
  assert.equal(progress.mock.calls.length, 2);
  for (const [event] of progress.mock.calls) {
    assert.equal(event.loaded, 5);
    assert.equal(event.total, 5);
    assert.equal(event.lengthComputable, true);
  }
  assert.deepEqual(Object.keys(manager.fileRequests), []);
  let synchronous = true;
  const cachedDone = completed(manager);
  await new Promise<void>((resolve) => {
    loader.load("hello.txt", (value) => {
      assert.equal(synchronous, false);
      assert.equal(value, "hello");
      resolve();
    });
    synchronous = false;
  });
  await cachedDone;
  assert.equal(requests.length, 2);
  manager.cache.clear();
});

test("file failures notify every duplicate, complete the manager, and leave failed data uncached", async () => {
  progressEvents();
  const manager = new LoadingManager();
  manager.cache.enabled = true;
  const errors = vi.fn();
  manager.onError = errors;
  const done = completed(manager);
  const fetcher = vi.fn(async () => new Response("missing", { status: 404, statusText: "Not Found" }));
  vi.stubGlobal("fetch", fetcher);
  const loader = new FileLoader(manager);
  const results = await Promise.allSettled([
    loader.loadAsync("https://example.test/missing"),
    loader.loadAsync("https://example.test/missing"),
  ]);
  await done;
  assert.equal(fetcher.mock.calls.length, 1);
  assert.equal(
    results.every((result) => result.status === "rejected"),
    true,
  );
  for (const result of results) {
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") continue;
    assert.ok(result.reason instanceof Error);
    assert.match(result.reason.message, /404/);
    assert.ok("response" in result.reason && result.reason.response instanceof Response);
    assert.equal(result.reason.response.status, 404);
  }
  assert.equal(errors.mock.calls.length, 1);
  assert.deepEqual(Object.keys(manager.fileRequests), []);
  assert.equal(manager.cache.get("file:https://example.test/missing"), undefined);
  vi.stubGlobal("fetch", async () => new Response("{bad json"));
  const corruptDone = completed(manager);
  await assert.rejects(loader.setResponseType("json").loadAsync("https://example.test/corrupt"), SyntaxError);
  await corruptDone;
  assert.equal(errors.mock.calls.length, 2);
});

test("file and manager abort retain error/completion behavior and allow subsequent requests", async () => {
  progressEvents();
  vi.stubGlobal(
    "fetch",
    (request: Request) =>
      new Promise<Response>((_resolve, reject) => {
        if (request.signal.aborted) reject(request.signal.reason);
        else request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
      }),
  );
  const reusable: FileLoader[] = [];
  for (const owner of ["loader", "manager"]) {
    const manager = new LoadingManager();
    const errors = vi.fn();
    manager.onError = errors;
    const done = completed(manager);
    const loader = new FileLoader(manager);
    reusable.push(loader);
    const request = loader.loadAsync("https://example.test/slow");
    if (owner === "loader") loader.abort();
    else manager.abort();
    await assert.rejects(request, { name: "AbortError" });
    await done;
    assert.equal(errors.mock.calls.length, 1);
    assert.deepEqual(Object.keys(manager.fileRequests), []);
    assert.equal(manager.abortController.signal.aborted, false);
  }
  vi.stubGlobal("fetch", async () => new Response("recovered"));
  for (const loader of reusable) assert.equal(await loader.loadAsync("https://example.test/ok"), "recovered");
});

test("data texture parser application preserves bytes and sampler metadata", async () => {
  progressEvents();
  const bytes = new Uint8Array([255, 64, 16, 255]);
  class Pixels extends DataTextureLoader {
    override parse(buffer: ArrayBuffer) {
      return {
        width: 1,
        height: 1,
        data: new Uint8Array(buffer),
        wrapS: Wrapping.Repeat,
        colorSpace: ColorSpace.SRGB,
        flipY: true,
        generateMipmaps: false,
      };
    }
  }
  const loader = new Pixels();
  const texture = loader.createDataTexture(bytes.buffer);
  assert.equal(texture.image.data?.buffer, bytes.buffer);
  assert.equal(texture.image.width, 1);
  assert.equal(texture.wrapS, Wrapping.Repeat);
  assert.equal(texture.minFilter, TextureFilter.Linear);
  assert.equal(texture.colorSpace, ColorSpace.SRGB);
  assert.equal(texture.flipY, true);
  assert.equal(texture.version, 1);
  vi.stubGlobal("fetch", async () => new Response(bytes));
  const loaded = await loader.loadAsync("https://example.test/pixel");
  assert.deepEqual(loaded.image.data, bytes);
  texture.dispose();
  loaded.dispose();
});

test("compressed texture loading preserves 2D and six-face payloads without a format registry", async () => {
  progressEvents();
  class Blocks extends CompressedTextureLoader {
    override parse(buffer: ArrayBuffer) {
      return {
        width: 4,
        height: 4,
        format: PixelFormat.RGBA_S3TC_DXT1,
        mipmapCount: 1,
        mipmaps: [{ data: new Uint8Array(buffer), width: 4, height: 4 }],
      };
    }
  }
  const bytes = new Uint8Array(8);
  vi.stubGlobal("fetch", async () => new Response(bytes));
  const loader = new Blocks();
  const texture = await loader.loadAsync("https://example.test/blocks");
  assert.equal(texture.format, PixelFormat.RGBA_S3TC_DXT1);
  assert.equal(texture.minFilter, TextureFilter.Linear);
  assert.equal(texture.mipmaps.length, 1);
  assert.equal(texture.version, 1);
  const cube = await loader.loadAsync(Array.from({ length: 6 }, (_, i) => `https://example.test/face-${i}`));
  assert.ok(Array.isArray(cube.image));
  assert.equal(cube.image.length, 6);
  assert.equal(cube.version, 1);
  texture.dispose();
  cube.dispose();
});
