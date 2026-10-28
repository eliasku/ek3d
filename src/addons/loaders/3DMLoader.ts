import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Object3D } from "../../core/Object3D";
import { Wrapping, Side, Mapping, TextureFilter } from "../../constants";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLight } from "../../lights/PointLight";
import { RectAreaLight } from "../../lights/RectAreaLight";
import { SpotLight } from "../../lights/SpotLight";
import { BufferGeometryLoader } from "../../loaders/BufferGeometryLoader";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { TextureLoader } from "../../loaders/TextureLoader";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { MeshPhysicalMaterial } from "../../materials/MeshPhysicalMaterial";
import { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import { PointsMaterial } from "../../materials/PointsMaterial";
import { SpriteMaterial } from "../../materials/SpriteMaterial";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Line } from "../../objects/Line";
import { Mesh } from "../../objects/Mesh";
import { Points } from "../../objects/Points";
import { Sprite } from "../../objects/Sprite";
import { CanvasTexture } from "../../textures/CanvasTexture";
import { EXRLoader } from "./EXRLoader";
import type { EXRZlibDecoder } from "./EXRLoader";
import { Rhino3dmWorker } from "./Rhino3dmWorker";

type RGB = { r: number; g: number; b: number; a: number };
type Vector = { 0: number; 1: number; 2: number };
type GeometryData =
  | {
      format: "buffers";
      position?: Float32Array;
      normal?: Float32Array;
      uv?: Float32Array;
      color?: Float32Array;
      index?: Uint32Array | Uint16Array;
    }
  | { data: { attributes: Record<string, unknown> }; type?: string };
type Attributes = {
  id: string;
  name: string;
  layerIndex: number;
  materialIndex: number;
  materialSource: { name: string };
  drawColor: RGB;
  castsShadows: boolean;
  receivesShadows: boolean;
  isInstanceDefinitionObject: boolean;
  objectIds: string[];
};
type RhinoObject = {
  objectType: string;
  attributes: Attributes;
  geometry: GeometryData | TextDotData | LightData | InstanceData | null;
};
type TextDotData = { fontHeight: number; fontFace: string; text: string; point: Vector };
type LightData = {
  lightStyle: { name: string };
  location: Vector;
  direction: Vector;
  width: Vector;
  length: Vector;
  intensity: number;
  diffuse: RGB;
  spotAngleRadians: number;
};
type InstanceData = {
  parentIdefId: string;
  xform: {
    array: [
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
    ];
  };
};
type TextureData = { type: string; image: string | null; wrapU: number; wrapV: number; repeat?: [number, number] };
type MaterialData = {
  id: string;
  name: string;
  diffuseColor: RGB;
  emissionColor: RGB;
  specularColor: RGB;
  disableLighting: boolean;
  indexOfRefraction: number;
  reflectivity: number;
  transparency: number;
  pbrSupported: boolean;
  textures: TextureData[];
  pbr: {
    anisotropic: number;
    anisotropicRotation: number;
    baseColor: RGB;
    clearcoat: number;
    clearcoatRoughness: number;
    metallic: number;
    roughness: number;
    sheen: number;
    specular: number;
    subsurface: number;
    opacity: number;
  };
};
export interface Rhino3dmData {
  objects: RhinoObject[];
  materials: MaterialData[];
  layers: { renderMaterialIndex: number; visible: boolean }[];
  views: unknown[];
  namedViews: unknown[];
  groups: unknown[];
  strings: unknown[];
  settings: Record<string, unknown>;
  renderSettings: unknown;
  renderEnvironment: { image: string } | null;
}
export interface Rhino3dmWarning {
  message: string;
  type: string;
  guid?: string;
}
type WorkerMessage =
  | { type: "warning"; id: number; data: Rhino3dmWarning }
  | { type: "decode"; id: number; data: Rhino3dmData }
  | { type: "error"; id: number; error: { message: string; stack?: string } };
type Task = {
  resolve: (data: Rhino3dmData) => void;
  reject: (error: unknown) => void;
  cost: number;
  warnings: Rhino3dmWarning[];
};
type WorkerState = { worker: Worker; tasks: Map<number, Task>; load: number };
type ColoredMaterial = MeshStandardMaterial | MeshPhysicalMaterial | PointsMaterial | LineBasicMaterial;
const geometryLoader = new BufferGeometryLoader();
const rgb = (c: RGB) => new Color(c.r / 255, c.g / 255, c.b / 255);

/** Loads Rhino 3DM files using the rhino3dm.js and WASM runtime at libraryPath. */
export class Rhino3dmLoader extends Loader<Object3D> {
  libraryPath: string = "";
  libraryPending: Promise<void> | null = null;
  libraryConfig: { wasmBinary?: ArrayBuffer } = {};
  workerLimit: number = 4;
  workerPool: WorkerState[] = [];
  workerNextTaskID: number = 1;
  workerSourceURL: string = "";
  subdivisionLevel: number = 3;
  materials: ColoredMaterial[] = [];
  warnings: Rhino3dmWarning[] = [];
  url: string = "";
  zlibDecoder: EXRZlibDecoder | null = null;
  private disposed: boolean = false;
  private readonly tasks: WeakMap<ArrayBuffer, Promise<Object3D>> = new WeakMap();
  private readonly disposeSignal: Promise<never>;
  private rejectDispose: ((reason: Error) => void) | null = null;

  constructor(manager?: LoadingManager) {
    super(manager);
    this.disposeSignal = new Promise<never>((_, reject) => {
      this.rejectDispose = reject;
    });
    this.disposeSignal.catch(() => {});
  }
  setLibraryPath(path: string): this {
    this.libraryPath = path;
    return this;
  }
  setZlibDecoder(decoder: EXRZlibDecoder): this {
    this.zlibDecoder = decoder;
    return this;
  }
  setWorkerLimit(limit: number): this {
    if (!Number.isInteger(limit) || limit < 1)
      throw new RangeError("Rhino3dmLoader: worker limit must be a positive integer");
    this.workerLimit = limit;
    return this;
  }
  setSubdivisionLevel(level: number): this {
    if (!Number.isInteger(level) || level < 0)
      throw new RangeError("Rhino3dmLoader: subdivision level must be a nonnegative integer");
    this.subdivisionLevel = level;
    return this;
  }
  load(
    url: string,
    onLoad?: (value: Object3D) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    this.url = url;
    const loader = new FileLoader(this.manager)
      .setPath(this.path)
      .setRequestHeader(this.requestHeader)
      .setWithCredentials(this.withCredentials)
      .setPriority(this.priority)
      .setCache(this.cache)
      .setResponseType("arraybuffer");
    loader.load(
      url,
      (value) => {
        if (!(value instanceof ArrayBuffer)) {
          const error = new Error("Rhino3dmLoader: expected an ArrayBuffer");
          if (onError) onError(error);
          else console.error(error);
          return;
        }
        this.decodeObjects(value, url)
          .then(onLoad)
          .catch((error) => {
            if (onError) onError(error);
            else console.error(error);
          });
      },
      onProgress,
      onError,
    );
  }
  parse(data: ArrayBuffer, onLoad: (value: Object3D) => void, onError?: (error: unknown) => void): void {
    this.parseAsync(data)
      .then(onLoad)
      .catch((error) => {
        if (onError) onError(error);
        else console.error(error);
      });
  }
  parseAsync(data: ArrayBuffer): Promise<Object3D> {
    return this.decodeObjects(data, "");
  }
  debug(): void {
    console.log(
      "Task load: ",
      this.workerPool.map((worker) => worker.load),
    );
  }

  decodeObjects(buffer: ArrayBuffer, _url: string): Promise<Object3D> {
    if (this.disposed) return Promise.reject(new Error("Rhino3dmLoader: loader disposed"));
    const cached = this.tasks.get(buffer);
    if (cached) return cached;
    const cost = buffer.byteLength;
    const warnings: Rhino3dmWarning[] = [];
    const promise = Promise.race([this._getWorker(cost), this.disposeSignal])
      .then((state) => {
        if (this.disposed) throw new Error("Rhino3dmLoader: loader disposed");
        const id = this.workerNextTaskID++;
        return new Promise<Rhino3dmData>((resolve, reject) => {
          state.tasks.set(id, { resolve, reject, cost, warnings });
          try {
            state.worker.postMessage({ type: "decode", id, buffer, subdivisionLevel: this.subdivisionLevel }, [buffer]);
          } catch (error) {
            this._releaseTask(state, id);
            reject(error);
          }
        });
      })
      .then((data) => {
        const result = this._createGeometry(data, warnings);
        result.userData.warnings = warnings;
        return result;
      });
    this.tasks.set(buffer, promise);
    return promise;
  }
  _releaseTask(state: WorkerState, id: number): void {
    const task = state.tasks.get(id);
    if (task) {
      state.load -= task.cost;
      state.tasks.delete(id);
    }
  }
  private async _initLibrary(): Promise<void> {
    if (!this.libraryPending) {
      const js = new FileLoader(this.manager).setPath(this.libraryPath).setPriority(this.priority).setCache(this.cache);
      const wasm = new FileLoader(this.manager)
        .setPath(this.libraryPath)
        .setPriority(this.priority)
        .setCache(this.cache)
        .setResponseType("arraybuffer");
      this.libraryPending = Promise.all([js.loadAsync("rhino3dm.js"), wasm.loadAsync("rhino3dm.wasm")]).then(
        ([source, binary]) => {
          if (this.disposed) throw new Error("Rhino3dmLoader: loader disposed");
          if (typeof source !== "string" || !(binary instanceof ArrayBuffer))
            throw new Error("Rhino3dmLoader: invalid runtime files");
          this.libraryConfig.wasmBinary = binary;
          const fn = Rhino3dmWorker.toString();
          this.workerSourceURL = URL.createObjectURL(
            new Blob([source, "\n", fn.substring(fn.indexOf("{") + 1, fn.lastIndexOf("}"))]),
          );
        },
      );
    }
    return this.libraryPending;
  }
  private async _getWorker(cost: number): Promise<WorkerState> {
    await this._initLibrary();
    if (this.disposed) throw new Error("Rhino3dmLoader: loader disposed");
    if (this.workerPool.length < this.workerLimit) {
      const worker = new Worker(this.workerSourceURL);
      const state: WorkerState = { worker, tasks: new Map(), load: cost };
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        const task = state.tasks.get(message.id);
        if (message.type === "warning") {
          this.warnings.push(message.data);
          task?.warnings.push(message.data);
          return;
        }
        if (!task) return;
        this._releaseTask(state, message.id);
        if (message.type === "decode") task.resolve(message.data);
        else {
          const error = new Error(message.error.message);
          if (message.error.stack) error.stack = message.error.stack;
          task.reject(error);
        }
      };
      worker.onerror = (event) => {
        for (const [id, task] of state.tasks) {
          this._releaseTask(state, id);
          task.reject(new Error(event.message || "Rhino3dmLoader: worker failed"));
        }
        worker.terminate();
        const index = this.workerPool.indexOf(state);
        if (index !== -1) this.workerPool.splice(index, 1);
      };
      try {
        worker.postMessage({ type: "init", libraryConfig: this.libraryConfig });
      } catch (error) {
        worker.terminate();
        throw error;
      }
      this.workerPool.push(state);
      return state;
    }
    const state = this.workerPool.reduce((best, worker) => (worker.load < best.load ? worker : best));
    state.load += cost;
    return state;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const error = new Error("Rhino3dmLoader: loader disposed");
    this.rejectDispose?.(error);
    for (const state of this.workerPool) {
      for (const [id, task] of state.tasks) {
        this._releaseTask(state, id);
        task.reject(error);
      }
      state.worker.terminate();
    }
    this.workerPool.length = 0;
    if (this.workerSourceURL) {
      URL.revokeObjectURL(this.workerSourceURL);
      this.workerSourceURL = "";
    }
  }

  _compareMaterials<T extends ColoredMaterial>(material: T): T {
    const match = this.materials.find(
      (m) =>
        m.name === material.name &&
        m.type === material.type &&
        m.vertexColors === material.vertexColors &&
        m.color.equals(material.color),
    );
    if (match) return match as T;
    this.materials.push(material);
    return material;
  }
  _createMaterial(
    material?: MaterialData,
    environment?: { image: string } | null,
    warnings: Rhino3dmWarning[] = this.warnings,
  ): MeshStandardMaterial | MeshPhysicalMaterial {
    if (!material)
      return new MeshStandardMaterial({
        color: new Color(1, 1, 1),
        metalness: 0.8,
        name: Loader.DEFAULT_MATERIAL_NAME,
        side: Side.Double,
      });
    const mat = new MeshPhysicalMaterial({
      color: rgb(material.diffuseColor),
      emissive: rgb(material.emissionColor),
      flatShading: material.disableLighting,
      ior: material.indexOfRefraction,
      name: material.name,
      reflectivity: material.reflectivity,
      opacity: 1 - material.transparency,
      side: Side.Double,
      specularColor: rgb(material.specularColor),
      transparent: material.transparency > 0,
    });
    mat.userData.id = material.id;
    if (material.pbrSupported) {
      const p = material.pbr;
      mat.anisotropy = p.anisotropic;
      mat.anisotropyRotation = p.anisotropicRotation;
      mat.color = new Color(p.baseColor.r, p.baseColor.g, p.baseColor.b);
      mat.clearcoat = p.clearcoat;
      mat.clearcoatRoughness = p.clearcoatRoughness;
      mat.metalness = p.metallic;
      mat.roughness = p.roughness;
      mat.sheen = p.sheen;
      mat.specularIntensity = p.specular;
      mat.thickness = p.subsurface;
      mat.opacity = p.opacity;
      mat.transparent = p.opacity < 1;
    }
    const loader = new TextureLoader(this.manager).setPriority(this.priority).setCache(this.cache);
    for (const texture of material.textures) {
      if (texture.image === null) continue;
      const map = loader.load(texture.image);
      switch (texture.type) {
        case "Bump":
          mat.bumpMap = map;
          break;
        case "Diffuse":
        case "PBR_BaseColor":
          mat.map = map;
          break;
        case "Emap":
          mat.envMap = map;
          break;
        case "Opacity":
          mat.transmissionMap = map;
          break;
        case "Transparency":
        case "PBR_Alpha":
          mat.alphaMap = map;
          mat.transparent = true;
          break;
        case "PBR_AmbientOcclusion":
          mat.aoMap = map;
          break;
        case "PBR_Anisotropic":
          mat.anisotropyMap = map;
          break;
        case "PBR_Clearcoat":
          mat.clearcoatMap = map;
          break;
        case "PBR_ClearcoatBump":
          mat.clearcoatNormalMap = map;
          break;
        case "PBR_ClearcoatRoughness":
          mat.clearcoatRoughnessMap = map;
          break;
        case "PBR_Displacement":
          mat.displacementMap = map;
          break;
        case "PBR_Emission":
          mat.emissiveMap = map;
          break;
        case "PBR_Metallic":
          mat.metalnessMap = map;
          break;
        case "PBR_Roughness":
          mat.roughnessMap = map;
          break;
        case "PBR_Sheen":
          mat.sheenColorMap = map;
          break;
        case "PBR_Specular":
          mat.specularColorMap = map;
          break;
        case "PBR_Subsurface":
          mat.thicknessMap = map;
          break;
        default: {
          const warning = {
            message: `THREE.3DMLoader: No conversion exists for 3dm ${texture.type}.`,
            type: "no conversion",
          };
          warnings.push(warning);
          if (warnings !== this.warnings) this.warnings.push(warning);
        }
      }
      map.wrapS = texture.wrapU === 0 ? Wrapping.Repeat : Wrapping.ClampToEdge;
      map.wrapT = texture.wrapV === 0 ? Wrapping.Repeat : Wrapping.ClampToEdge;
      if (texture.repeat) map.repeat.set(texture.repeat[0], texture.repeat[1]);
    }
    if (environment) {
      const loader = new EXRLoader(this.manager).setPriority(this.priority).setCache(this.cache);
      if (this.zlibDecoder) loader.setZlibDecoder(this.zlibDecoder);
      loader.load(environment.image, (texture) => {
        texture.mapping = Mapping.EquirectangularReflection;
        mat.envMap = texture;
      });
    }
    return mat;
  }
  _geometryFromData(data: GeometryData): BufferGeometry {
    if ("format" in data && data.format === "buffers") {
      const geometry = new BufferGeometry();
      if (data.position?.length) geometry.setAttribute("position", new BufferAttribute(data.position, 3));
      if (data.normal?.length) geometry.setAttribute("normal", new BufferAttribute(data.normal, 3));
      if (data.uv?.length) geometry.setAttribute("uv", new BufferAttribute(data.uv, 2));
      if (data.color?.length) geometry.setAttribute("color", new BufferAttribute(data.color, 3));
      if (data.index?.length) geometry.setIndex(new BufferAttribute(data.index, 1));
      return geometry;
    }
    return geometryLoader.parse(data);
  }
  _createGeometry(data: Rhino3dmData, warnings: Rhino3dmWarning[] = this.warnings): Object3D {
    const root = new Object3D();
    Object.assign(root.userData, {
      layers: data.layers,
      views: data.views,
      namedViews: data.namedViews,
      groups: data.groups,
      strings: data.strings,
      settings: data.settings,
      objectType: "File3dm",
    });
    root.userData.settings.renderSettings = data.renderSettings;
    const definitions: RhinoObject[] = [],
      references: RhinoObject[] = [],
      definitionObjects: Object3D[] = [];
    for (const obj of data.objects) {
      if (obj.objectType === "InstanceDefinition") {
        definitions.push(obj);
        continue;
      }
      if (obj.objectType === "InstanceReference") {
        references.push(obj);
        continue;
      }
      const a = obj.attributes;
      const layer = data.layers[a.layerIndex];
      const index =
        a.materialSource?.name === "ObjectMaterialSource_MaterialFromLayer"
          ? layer?.renderMaterialIndex
          : a.materialSource?.name === "ObjectMaterialSource_MaterialFromObject"
            ? a.materialIndex
            : -1;
      const material =
        index !== undefined && index >= 0
          ? this._createMaterial(data.materials[index], data.renderEnvironment, warnings)
          : null;
      const child = this._createObject(obj, material);
      if (!child) continue;
      child.visible = layer?.visible ?? true;
      if (a.isInstanceDefinitionObject) definitionObjects.push(child);
      else root.add(child);
    }
    for (const definition of definitions)
      for (const reference of references) {
        const geometry = reference.geometry as InstanceData;
        if (geometry.parentIdefId !== definition.attributes.id) continue;
        const instance = new Object3D();
        instance.applyMatrix4(new Matrix4().set(...geometry.xform.array));
        for (const id of definition.attributes.objectIds)
          for (const child of definitionObjects)
            if (id === child.userData.attributes.id) instance.add(child.clone(true));
        root.add(instance);
      }
    return root;
  }
  _createObject(obj: RhinoObject, mat: MeshStandardMaterial | MeshPhysicalMaterial | null): Object3D | undefined {
    const a = obj.attributes;
    let object: Object3D | undefined;
    switch (obj.objectType) {
      case "Point":
      case "PointSet": {
        const geometry = this._geometryFromData(obj.geometry as GeometryData);
        const material = new PointsMaterial(
          geometry.hasAttribute("color")
            ? { vertexColors: true, sizeAttenuation: false, size: 2 }
            : { color: rgb(a.drawColor), sizeAttenuation: false, size: 2 },
        );
        object = new Points(geometry, this._compareMaterials(material));
        break;
      }
      case "Mesh":
      case "Extrusion":
      case "SubD":
      case "Brep": {
        if (!obj.geometry) return undefined;
        const geometry = this._geometryFromData(obj.geometry as GeometryData);
        const material = mat ?? this._createMaterial();
        if (geometry.hasAttribute("color")) material.vertexColors = true;
        const mesh = new Mesh(geometry, this._compareMaterials(material));
        mesh.castShadow = a.castsShadows;
        mesh.receiveShadow = a.receivesShadows;
        object = mesh;
        break;
      }
      case "Curve":
        object = new Line(
          this._geometryFromData(obj.geometry as GeometryData),
          this._compareMaterials(new LineBasicMaterial({ color: rgb(a.drawColor) })),
        );
        break;
      case "TextDot": {
        const g = obj.geometry as TextDotData;
        const ctx = document.createElement("canvas").getContext("2d");
        if (!ctx) throw new Error("Rhino3dmLoader: canvas context unavailable");
        const font = `${g.fontHeight}px ${g.fontFace}`;
        ctx.font = font;
        const width = ctx.measureText(g.text).width + 10,
          height = g.fontHeight + 10,
          ratio = window.devicePixelRatio;
        ctx.canvas.width = width * ratio;
        ctx.canvas.height = height * ratio;
        ctx.canvas.style.width = `${width}px`;
        ctx.canvas.style.height = `${height}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.font = font;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${a.drawColor.r},${a.drawColor.g},${a.drawColor.b},${a.drawColor.a})`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "white";
        ctx.fillText(g.text, width / 2, height / 2);
        const texture = new CanvasTexture(ctx.canvas);
        texture.minFilter = TextureFilter.Linear;
        texture.generateMipmaps = false;
        texture.wrapS = Wrapping.ClampToEdge;
        texture.wrapT = Wrapping.ClampToEdge;
        const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false }));
        sprite.position.set(g.point[0], g.point[1], g.point[2]);
        sprite.scale.set(width / 10, height / 10, 1);
        object = sprite;
        break;
      }
      case "Light": {
        const g = obj.geometry as LightData;
        let light: PointLight | SpotLight | RectAreaLight | DirectionalLight | undefined;
        switch (g.lightStyle.name) {
          case "LightStyle_WorldPoint": {
            const l = new PointLight();
            l.castShadow = a.castsShadows;
            l.position.set(g.location[0], g.location[1], g.location[2]);
            l.shadow.normalBias = 0.1;
            light = l;
            break;
          }
          case "LightStyle_WorldSpot": {
            const l = new SpotLight();
            l.castShadow = a.castsShadows;
            l.position.set(g.location[0], g.location[1], g.location[2]);
            l.target.position.set(g.direction[0], g.direction[1], g.direction[2]);
            l.angle = g.spotAngleRadians;
            l.shadow.normalBias = 0.1;
            light = l;
            break;
          }
          case "LightStyle_WorldDirectional": {
            const l = new DirectionalLight();
            l.castShadow = a.castsShadows;
            l.position.set(g.location[0], g.location[1], g.location[2]);
            l.target.position.set(g.direction[0], g.direction[1], g.direction[2]);
            l.shadow.normalBias = 0.1;
            light = l;
            break;
          }
          case "LightStyle_WorldRectangular": {
            const l = new RectAreaLight();
            l.width = Math.abs(g.width[2]);
            l.height = Math.abs(g.length[0]);
            l.position.set(g.location[0] - l.height / 2, g.location[1], g.location[2] - l.width / 2);
            l.lookAt(g.direction[0], g.direction[1], g.direction[2]);
            light = l;
            break;
          }
        }
        if (light) {
          light.intensity = g.intensity;
          light.color = rgb(g.diffuse);
          object = light;
        }
        break;
      }
    }
    if (object) {
      object.userData.attributes = a;
      object.userData.objectType = obj.objectType;
      if (a.name && obj.objectType !== "Light") object.name = a.name;
    }
    return object;
  }
}
