import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Color } from "../../math/Color";
import { ColorManagement } from "../../math/ColorManagement";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { LinearSRGBColorSpace, SRGBColorSpace } from "../../constants";
import { InterleavedBuffer } from "../../core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import { LoaderUtils } from "../../loaders/LoaderUtils";

const _taskCache = new WeakMap<ArrayBuffer, { key: string; promise: Promise<BufferGeometry> }>();

const WASM_BIN_URL = "/libs/draco/draco_decoder.wasm";
const WASM_JS_URL = "/libs/draco/draco_wasm_wrapper.js";
const JS_URL = "/libs/draco/draco_decoder.js";

/** glTF-embedded Draco uses a dedicated wasm runtime optimized for the glTF attribute layout. */
export const DRACO_GLTF_CONFIG = {
  js: "/libs/draco/gltf/draco_wasm_wrapper.js",
  wasm: "/libs/draco/gltf/draco_decoder.wasm",
};

/** Geometry payload produced inside the decoding worker. */
export interface DRACOGeometryData {
  index: { array: Uint32Array; itemSize: number } | null;
  attributes: DRACOAttributeData[];
}

/** One decoded attribute as transferred arrays plus layout metadata. */
export interface DRACOAttributeData {
  name: string;
  count: number;
  itemSize: number;
  array: Float32Array | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array;
  stride: number;
  vertexColorSpace?: string | null;
}

/** Numeric typed arrays accepted as decode targets. */
type TypedArrayCtor =
  | Float32ArrayConstructor
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor;

/** Instance shape of the typed arrays produced by the decoder. */
type TypedArrayInstance = Float32Array | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array;

/** Draco module surface used inside the worker. */
interface DracoDecoderHost {
  HEAPU32: Uint32Array;
  DT_FLOAT32: number;
  DT_INT8: number;
  DT_INT16: number;
  DT_INT32: number;
  DT_UINT8: number;
  DT_UINT16: number;
  DT_UINT32: number;
  TRIANGULAR_MESH: number;
  POINT_CLOUD: number;
  Decoder: new () => DracoDecoderInstance;
  Mesh: new () => DracoGeometryHost;
  PointCloud: new () => DracoGeometryHost;
  destroy(target: unknown): void;
  _malloc(byteLength: number): number;
  _free(ptr: number): void;
  /** Draco exposes semantic constants (POSITION, NORMAL, COLOR, TEX_COORD) as numbers. */
  [name: string]: unknown;
}

/** Draco decoder instance surface used inside the worker. */
interface DracoDecoderInstance {
  GetEncodedGeometryType(array: Int8Array): number;
  DecodeArrayToMesh(array: Int8Array, byteLength: number, geometry: unknown): { ok(): boolean; error_msg(): string };
  DecodeArrayToPointCloud(
    array: Int8Array,
    byteLength: number,
    geometry: unknown,
  ): { ok(): boolean; error_msg(): string };
  GetAttributeId(geometry: unknown, semantic: number): number;
  GetAttribute(geometry: unknown, id: number): unknown;
  GetAttributeByUniqueId(geometry: unknown, id: number): unknown;
  GetTrianglesUInt32Array(geometry: unknown, byteLength: number, ptr: number): void;
  GetAttributeDataArrayForAllPoints(
    geometry: unknown,
    attribute: unknown,
    dataFormat: number,
    byteLength: number,
    ptr: number,
  ): void;
}

/** Attribute handle inside the worker. */
interface DracoAttribute {
  num_components(): number;
}

/** Geometry handle inside the worker. */
interface DracoGeometryHost {
  ptr: number;
  num_points(): number;
  num_faces(): number;
}

/** A dedicated decoder worker enriched by DRACOLoader with task bookkeeping. */
interface DRACOWorkerHost extends Worker {
  _callbacks: Record<number, { resolve: (message: unknown) => void; reject: (message: unknown) => void }>;
  _taskCosts: Record<number, number>;
  _taskLoad: number;
}

export type DRACOOnLoad = (bufferGeometry: BufferGeometry) => void;
export type DRACOOnProgress = (event: ProgressEvent) => void;

/**
 * A loader for the Draco format.
 *
 * [Draco](https://google.github.io/draco/) is an open source library for compressing
 * and decompressing 3D meshes and point clouds. Compressed geometry can be significantly smaller,
 * at the cost of additional decoding time on the client device.
 *
 * Standalone Draco files have a `.drc` extension, and contain vertex positions, normals, colors,
 * and other attributes. Draco files do not contain materials, textures, animation, or node hierarchies –
 * to use these features, embed Draco geometry inside of a glTF file. A normal glTF file can be converted
 * to a Draco-compressed glTF file using [glTF-Pipeline](https://github.com/CesiumGS/gltf-pipeline).
 * When using Draco with glTF, an instance of `DRACOLoader`
 * will need to be attached to {@link GLTFLoader} so that the loader decoder can be reused, using
 * the {@link GLTFLoader#setDRACOLoader} method.
 *
 * ```typescript
 * const loader = new DRACOLoader();
 * const geometry = await loader.loadAsync( 'models/draco/bunny.drc' );
 * geometry.computeVertexNormals(); // optional
 *
 * loader.dispose();
 * ```
 *
 * @augments Loader
 */
export class DRACOLoader extends Loader<BufferGeometry, string> {
  decoderPaths: { js: string | null; wasm: string | null; dep_js: string | null };
  decoderConfig: { type?: "js" | "wasm"; wasmBinary?: ArrayBuffer };
  decoderBinary: string | null;
  decoderPending: Promise<void> | null;

  workerLimit: number;
  workerPool: DRACOWorkerHost[];
  workerNextTaskID: number;
  workerSourceURL: string;

  defaultAttributeIDs: { position: string; normal: string; color: string; uv: string };
  defaultAttributeTypes: { position: string; normal: string; color: string; uv: string };

  /**
   * Constructs a new Draco loader.
   *
   * @param manager - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);

    this.decoderPaths = {
      js: WASM_JS_URL,
      wasm: WASM_BIN_URL,
      dep_js: JS_URL,
    };
    this.decoderConfig = {};
    this.decoderBinary = null;
    this.decoderPending = null;

    this.workerLimit = 4;
    this.workerPool = [];
    this.workerNextTaskID = 1;
    this.workerSourceURL = "";

    this.defaultAttributeIDs = {
      position: "POSITION",
      normal: "NORMAL",
      color: "COLOR",
      uv: "TEX_COORD",
    };
    this.defaultAttributeTypes = {
      position: "Float32Array",
      normal: "Float32Array",
      color: "Float32Array",
      uv: "Float32Array",
    };
  }

  /**
   * Provides configuration for the decoder libraries. Configuration cannot be changed after decoding begins.
   *
   * @param path - The decoder path, or a config object with explicit URLs for each decoder file.
   * @return A reference to this loader.
   */
  setDecoderPath(path: string | { js: string; wasm: string }): this {
    const { decoderPaths } = this;
    if (typeof path === "object") {
      decoderPaths.js = path.js;
      decoderPaths.wasm = path.wasm;
      decoderPaths.dep_js = null;
    } else {
      decoderPaths.js = LoaderUtils.resolveURL(WASM_JS_URL, path);
      decoderPaths.wasm = LoaderUtils.resolveURL(WASM_BIN_URL, path);
      decoderPaths.dep_js = LoaderUtils.resolveURL(JS_URL, path);
    }

    return this;
  }

  /**
   * Provides configuration for the decoder libraries. Configuration cannot be changed after decoding begins.
   * Kept for API parity with the upstream lifecycle; the module paths are fixed at construction.
   *
   * @param config - The decoder config.
   * @return A reference to this loader.
   */
  setDecoderConfig(config: { type?: "js" | "wasm" }): this {
    this.decoderConfig = config;

    return this;
  }

  /**
   * Sets the maximum number of Web Workers to be used during decoding.
   * A lower limit may be preferable if workers are also for other tasks in the application.
   *
   * @param workerLimit - The worker limit.
   * @return A reference to this loader.
   */
  setWorkerLimit(workerLimit: number): this {
    this.workerLimit = workerLimit;

    return this;
  }

  /**
   * Starts loading from the given URL and passes the loaded Draco asset
   * to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  override load(
    url: string,
    onLoad?: DRACOOnLoad,
    onProgress?: DRACOOnProgress,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);

    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);

    loader.load(
      url,
      (buffer: unknown) => {
        this.parse(buffer as ArrayBuffer, onLoad, onError);
      },
      onProgress,
      onError,
    );
  }

  /**
   * Parses the given Draco data.
   *
   * @param buffer - The raw Draco data as an array buffer.
   * @param onLoad - Executed when the loading/parsing process has been finished.
   * @param onError - Executed when errors occur.
   */
  parse(buffer: ArrayBuffer, onLoad?: DRACOOnLoad, onError: (error: unknown) => void = () => {}): void {
    this.decodeDracoFile(buffer, onLoad ?? (() => {}), null, null, SRGBColorSpace, onError).catch(onError);
  }

  //

  decodeDracoFile(
    buffer: ArrayBuffer,
    callback: DRACOOnLoad,
    attributeIDs: Record<string, string | number> | null = null,
    attributeTypes: Record<string, string> | null = null,
    vertexColorSpace: string = LinearSRGBColorSpace,
    onError: (error: unknown) => void = () => {},
  ): Promise<void> {
    const taskConfig = {
      attributeIDs: attributeIDs ?? this.defaultAttributeIDs,
      attributeTypes: attributeTypes ?? this.defaultAttributeTypes,
      useUniqueIDs: !!attributeIDs,
      vertexColorSpace: vertexColorSpace,
    };

    return this.decodeGeometry(buffer, taskConfig)
      .then((geometry) => callback(geometry))
      .catch(onError);
  }

  decodeGeometry(buffer: ArrayBuffer, taskConfig: DecodeTaskConfig): Promise<BufferGeometry> {
    const taskKey = JSON.stringify(taskConfig);

    // Check for an existing task using this buffer. A transferred buffer cannot be transferred
    // again from this thread.
    if (_taskCache.has(buffer)) {
      const cachedTask = _taskCache.get(buffer)!;

      if (cachedTask.key === taskKey) {
        return cachedTask.promise;
      } else if (buffer.byteLength === 0) {
        // Technically, it would be possible to wait for the previous task to complete,
        // transfer the buffer back, and decode again with the second configuration. That
        // is complex, and I don't know of any reason to decode a Draco buffer twice in
        // different ways, so this is left unimplemented.
        throw new Error(
          "THREE.DRACOLoader: Unable to re-decode a buffer with different settings. Buffer has already been transferred.",
        );
      }
    }

    //

    let worker: DRACOWorkerHost;

    const taskID = this.workerNextTaskID++;
    const taskCost = buffer.byteLength;

    // Obtain a worker and assign a task, and construct a geometry instance
    // when the task completes.
    const geometryPending = this._getWorker(taskID, taskCost)
      .then((_worker) => {
        worker = _worker;

        return new Promise<unknown>((resolve, reject) => {
          worker._callbacks[taskID] = { resolve, reject };

          worker.postMessage({ type: "decode", id: taskID, taskConfig, buffer }, [buffer]);
        });
      })
      .then((raw) => {
        const message = raw as DRACODecodeMessage;
        return this._createGeometry(message.geometry);
      });

    // Remove task from the task list.
    // Note: replaced '.finally()' with '.catch().then()' block - iOS 11 support (#19416)
    void geometryPending
      .catch(() => true)
      .then(() => {
        if (worker && taskID) {
          this._releaseTask(worker, taskID);
        }
      });

    // Cache the task result.
    _taskCache.set(buffer, {
      key: taskKey,
      promise: geometryPending,
    });

    return geometryPending;
  }

  _createGeometry(geometryData: DRACOGeometryData): BufferGeometry {
    const geometry = new BufferGeometry();

    if (geometryData.index) {
      geometry.setIndex(new BufferAttribute(geometryData.index.array, 1));
    }

    for (let i = 0; i < geometryData.attributes.length; i++) {
      const { name, array, itemSize, stride, vertexColorSpace } = geometryData.attributes[i];

      let attribute;

      if (itemSize === stride) {
        attribute = new BufferAttribute(array, itemSize);
      } else {
        const buffer = new InterleavedBuffer(array as Float32Array, stride);

        attribute = new InterleavedBufferAttribute(buffer, itemSize, 0);
      }

      if (name === "color") {
        this._assignVertexColorSpace(attribute, vertexColorSpace ?? LinearSRGBColorSpace);

        attribute.normalized = array instanceof Float32Array === false;
      }

      geometry.setAttribute(name, attribute);
    }

    return geometry;
  }

  _assignVertexColorSpace(attribute: BufferAttribute | InterleavedBufferAttribute, inputColorSpace: string): void {
    // While .drc files do not specify colorspace, the only 'official' tooling
    // is PLY and OBJ converters, which use sRGB. We'll assume sRGB when a .drc
    // file is passed into .load() or .parse(). GLTFLoader uses internal APIs
    // to decode geometry, and vertex colors are already Linear-sRGB in there.

    if (inputColorSpace !== SRGBColorSpace) return;

    const _color = new Color();

    for (let i = 0, il = attribute.count; i < il; i++) {
      _color.fromBufferAttribute(attribute, i);
      ColorManagement.colorSpaceToWorking(_color, SRGBColorSpace);
      attribute.setXYZ(i, _color.r, _color.g, _color.b);
    }
  }

  _loadLibrary(url: string, responseType: string): Promise<unknown> {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setResponseType(responseType);
    loader.setWithCredentials(this.withCredentials);

    return new Promise((resolve, reject) => {
      loader.load(url, resolve as never, undefined, reject);
    });
  }

  /**
   * Preloads the decoder (prefetching library and Web Worker used for decoding).
   *
   * @return A reference to this loader.
   */
  preload(): this {
    // Preloading resolves asynchronously up to each worker's onmessage; nothing to await here.
    void this._initDecoder();

    return this;
  }

  _initDecoder(): Promise<void> {
    if (this.decoderPending !== null) return this.decoderPending;

    const useJS = typeof WebAssembly !== "object" || this.decoderConfig.type === "js";
    const librariesPending: Promise<unknown>[] = [];

    const { decoderPaths } = this;
    if (useJS) {
      if (decoderPaths.dep_js === null) {
        throw new Error("THREE.DRACOLoader: WebAssembly is required when using a custom decoder paths.");
      }

      librariesPending.push(this._loadLibrary(decoderPaths.dep_js as string, "text"));
    } else {
      librariesPending.push(this._loadLibrary(decoderPaths.js as string, "text"));
      librariesPending.push(this._loadLibrary(decoderPaths.wasm as string, "arraybuffer"));
    }

    this.decoderPending = Promise.all(librariesPending).then((libraries) => {
      const jsContent = libraries[0] as string;

      if (!useJS) {
        this.decoderConfig.wasmBinary = libraries[1] as ArrayBuffer;
      }

      const fn = DRACOWorker.toString();

      const body = [
        "/* draco decoder */",
        jsContent,
        "",
        "/* worker */",
        fn.substring(fn.indexOf("{") + 1, fn.lastIndexOf("}")),
      ].join("\n");

      this.workerSourceURL = URL.createObjectURL(new Blob([body]));
    });

    return this.decoderPending as Promise<void>;
  }

  _getWorker(taskID: number, taskCost: number): Promise<DRACOWorkerHost> {
    return this._initDecoder().then(() => {
      if (this.workerPool.length < this.workerLimit) {
        const worker = new Worker(this.workerSourceURL) as DRACOWorkerHost;

        worker._callbacks = {};
        worker._taskCosts = {};
        worker._taskLoad = 0;

        worker.onmessage = function (e: MessageEvent) {
          const message = e.data as { type: string; id: number };

          switch (message.type) {
            case "decode":
              worker._callbacks[message.id].resolve(message);
              break;

            case "error":
              worker._callbacks[message.id].reject(message);
              break;

            default:
              console.error('THREE.DRACOLoader: Unexpected message, "' + message.type + '"');
          }
        };

        worker.postMessage({ type: "init", decoderConfig: this.decoderConfig });

        this.workerPool.push(worker);
      } else {
        this.workerPool.sort(function (a, b) {
          return a._taskLoad > b._taskLoad ? -1 : 1;
        });
      }

      const target = this.workerPool[this.workerPool.length - 1]!;
      target._taskCosts[taskID] = taskCost;
      target._taskLoad += taskCost;
      return target;
    });
  }

  _releaseTask(worker: DRACOWorkerHost, taskID: number): void {
    worker._taskLoad -= worker._taskCosts[taskID];
    delete worker._callbacks[taskID];
    delete worker._taskCosts[taskID];
  }

  debug(): void {
    console.log(
      "Task load: ",
      this.workerPool.map((worker) => worker._taskLoad),
    );
  }

  /**
   * Disposes this loader instance: terminates workers and releases the decoder blob URL.
   *
   * @return A reference to this loader.
   */
  dispose(): this {
    for (let i = 0; i < this.workerPool.length; ++i) {
      this.workerPool[i].terminate();
    }

    this.workerPool.length = 0;

    if (this.workerSourceURL !== "") {
      URL.revokeObjectURL(this.workerSourceURL);
    }

    return this;
  }
}

/** Messages exchanged with the decoder worker. */
type WorkerMessage =
  | { type: "init"; decoderConfig: Record<string, unknown> }
  | { type: "decode"; id: number; buffer: ArrayBuffer; taskConfig: DecodeTaskConfig }
  | { type: "error"; id: number; error: string };

/** Worker-side decode task payload. */
interface DecodeTaskConfig {
  attributeIDs: Record<string, string | number>;
  attributeTypes: Record<string, string>;
  useUniqueIDs: boolean;
  vertexColorSpace: string;
}

/** Worker decode result envelope. */
interface DRACODecodeMessage {
  id: number;
  geometry: DRACOGeometryData;
}

/* WEB WORKER */

declare global {
  /** Provided by the draco decoder script loaded ahead of this worker body. */
  function DracoDecoderModule(config: Record<string, unknown>): void;
}

function DRACOWorker(): void {
  let decoderConfig: Record<string, unknown>;
  let decoderPending: Promise<{ draco: DracoDecoderHost }>;

  onmessage = function (e: MessageEvent) {
    const message = e.data as WorkerMessage;

    switch (message.type) {
      case "init":
        decoderConfig = message.decoderConfig;
        decoderPending = new Promise(function (resolve /*, reject*/) {
          decoderConfig.onModuleLoaded = function (draco: DracoDecoderHost) {
            // Module is Promise-like. Wrap before resolving to avoid loop.
            resolve({ draco: draco });
          };

          // The draco decoder script exposes this global inside the worker.
          (self as unknown as { DracoDecoderModule: (config: Record<string, unknown>) => void }).DracoDecoderModule(
            decoderConfig,
          );
        });
        break;

      case "decode": {
        const buffer = message.buffer;
        const taskConfig = message.taskConfig;
        // Errors inside the decode pipeline are posted back through worker message instead of
        // thrown rejection — nothing to await in the worker event handler.
        void decoderPending.then((module) => {
          const draco = module.draco;
          const decoder = new draco.Decoder();

          try {
            const geometry = decodeGeometry(draco, decoder, new Int8Array(buffer), taskConfig);

            const buffers: Transferable[] = geometry.attributes.map((attr) => attr.array.buffer as ArrayBuffer);

            if (geometry.index) buffers.push(geometry.index.array.buffer as ArrayBuffer);

            (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(
              { type: "decode", id: message.id, geometry },
              buffers,
            );
          } catch (error) {
            console.error(error);

            (self as unknown as { postMessage(m: unknown): void }).postMessage({
              type: "error",
              id: message.id,
              error: (error as Error).message,
            });
          } finally {
            draco.destroy(decoder);
          }
        });
        break;
      }
    }
  };

  function decodeGeometry(
    draco: DracoDecoderHost,
    decoder: DracoDecoderInstance,
    array: Int8Array,
    taskConfig: DecodeTaskConfig,
  ): DRACOGeometryData {
    const attributeIDs = taskConfig.attributeIDs;
    const attributeTypes = taskConfig.attributeTypes;

    let dracoGeometry: DracoGeometryHost;
    let decodingStatus: { ok(): boolean; error_msg(): string };

    const geometryType = decoder.GetEncodedGeometryType(array);

    if (geometryType === draco.TRIANGULAR_MESH) {
      dracoGeometry = new draco.Mesh();
      decodingStatus = decoder.DecodeArrayToMesh(array, array.byteLength, dracoGeometry);
    } else if (geometryType === draco.POINT_CLOUD) {
      dracoGeometry = new draco.PointCloud();
      decodingStatus = decoder.DecodeArrayToPointCloud(array, array.byteLength, dracoGeometry);
    } else {
      throw new Error("THREE.DRACOLoader: Unexpected geometry type.");
    }

    if (!decodingStatus.ok() || dracoGeometry.ptr === 0) {
      throw new Error("THREE.DRACOLoader: Decoding failed: " + decodingStatus.error_msg());
    }

    const geometry = { index: null, attributes: [] } as DRACOGeometryData;

    // Gather all vertex attributes.
    for (const attributeName in attributeIDs) {
      // Upstream resolves e.g. "Float32Array" against the worker global scope.
      const attributeType = (self as unknown as Record<string, TypedArrayCtor | undefined>)[
        attributeTypes[attributeName]
      ] as TypedArrayCtor;

      let attribute;
      let attributeID;

      // A Draco file may be created with default vertex attributes, whose attribute IDs
      // are mapped 1:1 from their semantic name (POSITION, NORMAL, ...). Alternatively,
      // a Draco file may contain a custom set of attributes, identified by known unique
      // IDs. glTF files always do the latter, and `.drc` files typically do the former.
      if (taskConfig.useUniqueIDs) {
        attributeID = Number(attributeIDs[attributeName]);
        attribute = decoder.GetAttributeByUniqueId(dracoGeometry, attributeID);
      } else {
        const semantic = draco[attributeIDs[attributeName].toString()] as number;
        attributeID = decoder.GetAttributeId(dracoGeometry, semantic);

        if (attributeID === -1) continue;

        attribute = decoder.GetAttribute(dracoGeometry, attributeID);
      }

      const attributeResult = decodeAttribute(
        draco,
        decoder,
        dracoGeometry,
        attributeName,
        attributeType,
        attribute as DracoAttribute,
      );

      if (attributeName === "color") {
        attributeResult.vertexColorSpace = taskConfig.vertexColorSpace;
      }

      geometry.attributes.push(attributeResult);
    }

    // Add index.
    if (geometryType === draco.TRIANGULAR_MESH) {
      geometry.index = decodeIndex(draco, decoder, dracoGeometry);
    }

    draco.destroy(dracoGeometry);

    return geometry;
  }

  function decodeIndex(
    draco: DracoDecoderHost,
    decoder: DracoDecoderInstance,
    dracoGeometry: DracoGeometryHost,
  ): { array: Uint32Array; itemSize: number } {
    const numFaces = dracoGeometry.num_faces();
    const numIndices = numFaces * 3;
    const byteLength = numIndices * 4;

    const ptr = draco._malloc(byteLength);
    decoder.GetTrianglesUInt32Array(dracoGeometry, byteLength, ptr);
    const index = new Uint32Array(draco.HEAPU32.buffer, ptr, numIndices).slice();
    draco._free(ptr);

    return { array: index, itemSize: 1 };
  }

  function decodeAttribute(
    draco: DracoDecoderHost,
    decoder: DracoDecoderInstance,
    dracoGeometry: DracoGeometryHost,
    attributeName: string,
    TypedArray: TypedArrayCtor,
    attribute: DracoAttribute,
  ): DRACOAttributeData {
    const count = dracoGeometry.num_points();
    const itemSize = attribute.num_components();
    const dracoDataType = getDracoDataType(draco, TypedArray);

    // Reference: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#data-alignment
    const srcByteStride = itemSize * TypedArray.BYTES_PER_ELEMENT;
    const dstByteStride = Math.ceil(srcByteStride / 4) * 4;

    const dstStride = dstByteStride / TypedArray.BYTES_PER_ELEMENT;

    const srcByteLength = count * srcByteStride;
    const dstByteLength = count * dstByteStride;

    const ptr = draco._malloc(srcByteLength);
    decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, dracoDataType, srcByteLength, ptr);

    const heap = draco.HEAPU32.buffer as ArrayBuffer;
    const srcArray = new TypedArray(heap, ptr, srcByteLength / TypedArray.BYTES_PER_ELEMENT);
    let dstArray: TypedArrayInstance;

    if (srcByteStride === dstByteStride) {
      // THREE.BufferAttribute

      dstArray = srcArray.slice();
    } else {
      // THREE.InterleavedBufferAttribute

      dstArray = new TypedArray(dstByteLength / TypedArray.BYTES_PER_ELEMENT);

      let dstOffset = 0;

      for (let i = 0; i < count; i++) {
        for (let j = 0; j < itemSize; j++) {
          dstArray[dstOffset + j] = srcArray[i * itemSize + j];
        }

        dstOffset += dstStride;
      }
    }

    draco._free(ptr);

    return {
      name: attributeName,
      count: count,
      itemSize: itemSize,
      array: dstArray,
      stride: dstStride,
    };
  }

  function getDracoDataType(draco: DracoDecoderHost, TypedArray: TypedArrayCtor): number {
    switch (TypedArray) {
      case Float32Array:
        return draco.DT_FLOAT32;
      case Int8Array:
        return draco.DT_INT8;
      case Int16Array:
        return draco.DT_INT16;
      case Int32Array:
        return draco.DT_INT32;
      case Uint8Array:
        return draco.DT_UINT8;
      case Uint16Array:
        return draco.DT_UINT16;
      case Uint32Array:
        return draco.DT_UINT32;
    }

    return draco.DT_FLOAT32;
  }
}
