import type { Camera } from "../../cameras/Camera";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Object3D } from "../../core/Object3D";
import { TextureLoader } from "../../loaders/TextureLoader";
import { Material } from "../../materials/Material";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Mesh } from "../../objects/Mesh";
import { SkinnedMesh } from "../../objects/SkinnedMesh";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { Scene } from "../../scenes/Scene";
import { Texture } from "../../textures/Texture";
import { DRACOLoader } from "./DRACOLoader";
import { GLTFLoader, type DRACOLoaderLike, type GLTF, type GLTFLoaderPlugin, type GLTFParser } from "./GLTFLoader";
import { KTX2Loader } from "./KTX2Loader";
import { calculateProgressiveLOD } from "./GLTFProgressiveLOD";
import { getRaycastMesh, registerRaycastMesh } from "./GLTFProgressiveRaycast";
import { PromiseGroup, type PromiseGroupOptions, type PromiseGroupResult } from "./GLTFProgressivePromises";

// Adapted from @needle-tools/gltf-progressive, commit 4d423859641a275d322318b0164bc6dce48d36a4.
// MIT License, Copyright (c) 2026 Needle Tools.
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
export const EXTENSION_NAME = "NEEDLE_progressive";

export interface ProgressiveLOD {
  path: string;
  hash?: string;
  width?: number;
  height?: number;
  densities?: number[];
  density?: number;
}
export interface ProgressiveInfo {
  guid: string;
  lods: ProgressiveLOD[] | string;
}

export interface ProgressiveTextureResult {
  material: Material;
  slot: string;
  texture: Texture | null;
  level: number;
}

/** A caller-provided worker adapter returns decoded native resources, ordered by primitive. */
export interface ProgressiveWorker {
  load(url: string, guid: string, kind: "mesh" | "texture"): Promise<BufferGeometry[] | Texture | null>;
}

export interface SmartLoadingHints {
  progressive?: boolean;
  usecase?: "product";
}

export interface ProgressiveOptions {
  enableLODsManager?: boolean;
  hints?: Omit<SmartLoadingHints, "progressive">;
  /** Optional worker adapter. The vendor getWorker API and query flag are not installed. */
  worker?: ProgressiveWorker;
}

export interface NEEDLE_progressive_plugin {
  onBeforeUpdateLOD?(renderer: WebGLRenderer, scene: Scene, camera: Camera, object: Mesh): void;
  onAfterUpdatedLOD?(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    object: Mesh,
    level: { mesh_lod: number; texture_lod: number },
  ): void;
  onRegisteredNewMesh?(mesh: Mesh, extension: ProgressiveInfo): void;
  onBeforeGetLODMesh?(mesh: Mesh, level: number): void;
}
interface ResourceInfo {
  extension: ProgressiveInfo;
  path: string;
  primitive: number;
  original: WeakRef<BufferGeometry | Texture>;
  active: boolean;
  manager?: LODsManager;
  loader: GLTFLoader;
  worker?: ProgressiveWorker;
}

const resources = new WeakMap<BufferGeometry | Texture, ResourceInfo>();
const sourceTextures = new WeakMap<object, ResourceInfo>();
const originals = new Map<string, Set<WeakRef<BufferGeometry | Texture>>>();
const managers = new Set<WeakRef<LODsManager>>();
const rendererManagers = new WeakMap<WebGLRenderer, LODsManager>();
const plugins: NEEDLE_progressive_plugin[] = [];
let registrationManager: LODsManager | undefined;
let activeRegistrationManager: WeakRef<LODsManager> | undefined;
const textureReferences = new WeakMap<Texture, number>();
const textureLevels = new WeakMap<Texture, number>();
const materialTextures = new WeakMap<Material, Map<string, Texture>>();
type LODResource = BufferGeometry[] | Texture | null;
const lodCache = new Map<string, Promise<LODResource> | WeakRef<Texture>>();
const textureCacheFinalizer = new FinalizationRegistry<string>((key) => {
  const entry = lodCache.get(key);
  if (entry instanceof WeakRef && !entry.deref()) lodCache.delete(key);
});
const loadingQueue: Array<() => void> = [];
let runningLoads = 0;
const loaderHints = new WeakMap<GLTFLoader, SmartLoadingHints>();

export function configureLoader(loader: GLTFLoader, options: SmartLoadingHints): void {
  const previous = loaderHints.get(loader);
  loaderHints.set(loader, { ...previous, ...options });
  if (previous) return;
  const load = loader.load.bind(loader);
  loader.load = function (url, onLoad, onProgress, onError) {
    let parsed: URL | undefined;
    try {
      parsed = new URL(url, typeof location === "undefined" ? undefined : location.href);
    } catch {
      // The loader resolves relative paths without a browser location.
    }
    if (parsed && (parsed.hostname === "needle.tools" || parsed.hostname.endsWith(".needle.tools"))) {
      const hints = loaderHints.get(loader);
      const usecase = hints?.usecase ?? "default";
      loader.requestHeader.Accept =
        hints?.progressive === false ? `*/*;usecase=${usecase}` : `*/*;progressive=allowed;usecase=${usecase}`;
      url = parsed.toString();
    }
    load(url, onLoad, onProgress, onError);
  };
}

function definition(value: unknown): ProgressiveInfo | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ProgressiveInfo>;
  return typeof candidate.guid === "string" && (Array.isArray(candidate.lods) || typeof candidate.lods === "string")
    ? (candidate as ProgressiveInfo)
    : null;
}

function metadata(resource: BufferGeometry | Texture): ResourceInfo | undefined {
  const info =
    resources.get(resource) ?? (resource instanceof Texture ? sourceTextures.get(resource.source) : undefined);
  return info?.active ? info : undefined;
}

function* textureSlots(
  material: Material,
): Generator<{ name: string; texture: Texture; target: Record<string, unknown>; key: string }> {
  if (material instanceof ShaderMaterial) {
    for (const name of Object.keys(material.uniforms)) {
      const target: Record<string, unknown> = material.uniforms[name];
      if (target.value instanceof Texture) yield { name, texture: target.value, target, key: "value" };
    }
  } else {
    const target = material as unknown as Record<string, unknown>;
    for (const name of Object.keys(target)) {
      const texture = target[name];
      if (texture instanceof Texture) yield { name, texture, target, key: name };
    }
  }
}

function trackMaterial(material: Material): void {
  if (materialTextures.has(material)) return;
  const slots = new Map<string, Texture>();
  for (const slot of textureSlots(material)) {
    if (!metadata(slot.texture)) continue;
    slots.set(slot.name, slot.texture);
    textureReferences.set(slot.texture, (textureReferences.get(slot.texture) ?? 0) + 1);
  }
  materialTextures.set(material, slots);
}

function replaceTexture(material: Material, name: string, previous: Texture, next: Texture): void {
  trackMaterial(material);
  const slots = materialTextures.get(material)!;
  const tracked = slots.get(name);
  if (tracked === next) return;
  textureReferences.set(next, (textureReferences.get(next) ?? 0) + 1);
  slots.set(name, next);
  if (tracked === previous) {
    const count = (textureReferences.get(previous) ?? 1) - 1;
    if (count > 0) textureReferences.set(previous, count);
    else {
      textureReferences.delete(previous);
      previous.dispose();
    }
  }
}

function register(
  resource: BufferGeometry | Texture,
  extension: ProgressiveInfo,
  path: string,
  primitive: number,
  manager: LODsManager,
  loader: GLTFLoader,
  worker?: ProgressiveWorker,
  key: string = extension.guid,
): void {
  const existing = resources.get(resource);
  if (
    existing?.active &&
    existing.extension === extension &&
    existing.path === path &&
    existing.primitive === primitive
  )
    return;
  const info = { extension, path, primitive, original: new WeakRef(resource), manager, loader, worker, active: true };
  resources.set(resource, info);
  let references = originals.get(key);
  if (!references) {
    references = new Set();
    originals.set(key, references);
  }
  references.add(new WeakRef(resource));
  if (resource instanceof Texture) {
    sourceTextures.set(resource.source, info);
    textureLevels.set(resource, typeof extension.lods === "string" ? 1 : extension.lods.length);
  }
}

function getRegistrationManager(): LODsManager {
  const active = activeRegistrationManager?.deref();
  if (active) return active;
  if (!registrationManager) {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(new DRACOLoader());
    registrationManager = new LODsManager(loader, null);
  }
  return registrationManager;
}
function resolvePath(base: string, path: string): string {
  if (/^(?:\.\/|https?:|data:|blob:|\/)/.test(path)) return path;
  return base + path;
}

export class NEEDLE_progressive implements GLTFLoaderPlugin {
  readonly name: string = EXTENSION_NAME;
  private static concurrentLoadingTasks: number =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android|IEMobile/i.test(navigator.userAgent) ? 20 : 50;

  static get maxConcurrentLoadingTasks(): number {
    return this.concurrentLoadingTasks;
  }
  static set maxConcurrentLoadingTasks(value: number) {
    this.concurrentLoadingTasks = value;
    while (loadingQueue.length && runningLoads < value) loadingQueue.shift()?.();
  }
  private readonly parser: GLTFParser;
  private readonly manager: LODsManager;
  private readonly loader: GLTFLoader;
  private readonly worker: ProgressiveWorker | undefined;
  private readonly loadingMeshes: Set<number> = new Set();

  constructor(parser: GLTFParser, manager?: LODsManager, sourceLoader?: GLTFLoader, worker?: ProgressiveWorker) {
    this.parser = parser;
    if (manager) {
      this.manager = manager;
      this.loader = sourceLoader ?? manager.sourceLoader;
      this.worker = sourceLoader ? worker : (worker ?? manager.sourceWorker);
    } else {
      const loader = new GLTFLoader(parser.options.manager);
      loader.setCrossOrigin(parser.options.crossOrigin);
      loader.setWithCredentials(parser.options.withCredentials);
      loader.setRequestHeader(parser.options.requestHeader);
      loader.setKTX2Loader(parser.options.ktx2Loader);
      loader.setMeshoptDecoder(parser.options.meshoptDecoder);
      const extension: unknown = parser.extensions.KHR_DRACO_MESH_COMPRESSION;
      if (extension && typeof extension === "object" && "dracoLoader" in extension) {
        const decoder: unknown = extension.dracoLoader;
        if (
          decoder &&
          typeof decoder === "object" &&
          "preload" in decoder &&
          "decodeDracoFile" in decoder &&
          typeof decoder.preload === "function" &&
          typeof decoder.decodeDracoFile === "function"
        ) {
          loader.setDRACOLoader(decoder as DRACOLoaderLike);
        }
      }
      if (!loader.dracoLoader) loader.setDRACOLoader(new DRACOLoader());
      this.manager = new LODsManager(loader, null);
      this.loader = loader;
      this.worker = undefined;
    }
  }

  loadMesh(index: number): Promise<Object3D> | null {
    if (this.loadingMeshes.has(index)) return null;
    const ext = definition(this.parser.json.meshes?.[index]?.extensions?.[EXTENSION_NAME]);
    if (!ext) return null;
    this.loadingMeshes.add(index);
    const pending: Promise<Object3D> = this.parser.getDependency("mesh", index);
    return pending
      .then((object) => {
        const meshes =
          object instanceof Mesh ? [object] : object.children.filter((child): child is Mesh => child instanceof Mesh);
        for (let primitive = 0; primitive < meshes.length; primitive++) {
          const mesh = meshes[primitive];
          register(mesh.geometry, ext, this.parser.options.path, primitive, this.manager, this.loader, this.worker);
          if (typeof ext.lods === "string" || ext.lods.length > 0) registerRaycastMesh(mesh, mesh.geometry);
          for (const plugin of plugins) plugin.onRegisteredNewMesh?.(mesh, ext);
        }
        return object;
      })
      .finally(() => {
        this.loadingMeshes.delete(index);
      });
  }

  static registerTexture(url: string, texture: Texture, level: number, index: number, ext: ProgressiveInfo): void {
    const manager = getRegistrationManager();
    register(texture, ext, url, index, manager, manager.sourceLoader, manager.sourceWorker);
    textureLevels.set(texture, level);
  }

  static registerMesh(url: string, key: string, mesh: Mesh, level: number, index: number, ext: ProgressiveInfo): void {
    const manager = getRegistrationManager();
    register(mesh.geometry, ext, url, index, manager, manager.sourceLoader, manager.sourceWorker, key);
    if (level > 0) registerRaycastMesh(mesh, mesh.geometry);
    for (const plugin of plugins) plugin.onRegisteredNewMesh?.(mesh, ext);
  }

  static getMeshLODExtension(geometry: BufferGeometry): ProgressiveInfo | null {
    return metadata(geometry)?.extension ?? null;
  }

  static getPrimitiveIndex(geometry: BufferGeometry): number {
    return metadata(geometry)?.primitive ?? -1;
  }

  static assignMeshLOD(mesh: Mesh, level: number): Promise<BufferGeometry | null> {
    const info = metadata(mesh.geometry);
    return info?.manager ? info.manager.assignMesh(mesh, info, level) : Promise.resolve(null);
  }

  static assignTextureLOD(object: Texture, level: number): Promise<Texture | null>;
  static assignTextureLOD(object: Material | Mesh, level: number): Promise<ProgressiveTextureResult[] | null>;
  static async assignTextureLOD(
    object: Texture | Material | Mesh,
    level: number = 0,
  ): Promise<Texture | ProgressiveTextureResult[] | null> {
    if (object instanceof Texture) {
      const info = metadata(object);
      return info?.manager ? info.manager.loadTexture(object, info, level) : null;
    }
    const materials =
      object instanceof Mesh ? (Array.isArray(object.material) ? object.material : [object.material]) : [object];
    const results: ProgressiveTextureResult[] = [];
    for (const material of materials) {
      trackMaterial(material);
      for (const slot of textureSlots(material)) {
        if (slot.name === "glyphMap") {
          results.push({ material, slot: slot.name, texture: slot.texture, level });
          continue;
        }
        const info = metadata(slot.texture);
        let texture = info?.manager ? await info.manager.loadTexture(slot.texture, info, level) : null;
        if (
          texture &&
          (!info?.active ||
            slot.target[slot.key] !== slot.texture ||
            (textureLevels.get(slot.texture) ?? Infinity) < level)
        ) {
          texture.dispose();
          texture = null;
        }
        if (texture) {
          replaceTexture(material, slot.name, slot.texture, texture);
          slot.target[slot.key] = texture;
          if (material instanceof ShaderMaterial) material.uniformsNeedUpdate = true;
          material.needsUpdate = true;
        }
        results.push({ material, slot: slot.name, texture, level });
      }
    }
    return results;
  }

  static hasLODLevelAvailable(
    object: Mesh | BufferGeometry | Texture | Material | Material[],
    level?: number,
  ): boolean {
    if (Array.isArray(object)) return object.some((material) => this.hasLODLevelAvailable(material, level));
    if (object instanceof Material) {
      for (const slot of textureSlots(object)) if (this.hasLODLevelAvailable(slot.texture, level)) return true;
      return false;
    }
    const resource = object instanceof Mesh ? object.geometry : object;
    const info = metadata(resource);
    if (!info) return false;
    if (level === undefined) return true;
    return level >= 0 && level < (Array.isArray(info.extension.lods) ? info.extension.lods.length : 1);
  }

  static getMaterialMinMaxLODsCount(material: Material | Material[]): {
    min_count: number;
    max_count: number;
    lods: Array<{ min_height: number; max_height: number }>;
  } {
    const result = { min_count: Infinity, max_count: 0, lods: [] as Array<{ min_height: number; max_height: number }> };
    for (const item of Array.isArray(material) ? material : [material]) {
      for (const slot of textureSlots(item)) {
        const lods = metadata(slot.texture)?.extension.lods;
        if (!Array.isArray(lods)) continue;
        result.min_count = Math.min(result.min_count, lods.length);
        result.max_count = Math.max(result.max_count, lods.length);
        lods.forEach((lod, index) => {
          if (lod.height === undefined) return;
          const bounds = (result.lods[index] ??= { min_height: Infinity, max_height: 0 });
          bounds.min_height = Math.min(bounds.min_height, lod.height);
          bounds.max_height = Math.max(bounds.max_height, lod.height);
        });
      }
    }
    return result;
  }

  static dispose(guid?: string): void {
    for (const [key, references] of originals) {
      if (guid !== undefined && guid !== key) continue;
      for (const reference of references) {
        const resource = reference.deref();
        if (!resource) continue;
        const info = metadata(resource);
        if (info) info.active = false;
        resources.delete(resource);
        if (resource instanceof Texture) {
          sourceTextures.delete(resource.source);
          textureReferences.delete(resource);
        }
        resource.dispose();
      }
      originals.delete(key);
    }
    for (const reference of managers) {
      const manager = reference.deref();
      if (manager) manager.disposeCache(guid);
      else managers.delete(reference);
    }
  }

  afterRoot(gltf?: GLTF): null {
    const associatedTextures = new Set<number>();
    for (const [object, association] of this.parser.associations) {
      if (object instanceof Mesh && typeof association.meshes === "number") {
        const ext = definition(this.parser.json.meshes?.[association.meshes]?.extensions?.[EXTENSION_NAME]);
        if (ext) {
          register(
            object.geometry,
            ext,
            this.parser.options.path,
            association.primitives ?? 0,
            this.manager,
            this.loader,
            this.worker,
          );
          if (typeof ext.lods === "string" || ext.lods.length > 0) registerRaycastMesh(object, object.geometry);
          for (const plugin of plugins) plugin.onRegisteredNewMesh?.(object, ext);
        }
      } else if (object instanceof Texture && typeof association.textures === "number") {
        const ext = definition(this.parser.json.textures?.[association.textures]?.extensions?.[EXTENSION_NAME]);
        associatedTextures.add(association.textures);
        if (ext) register(object, ext, this.parser.options.path, 0, this.manager, this.loader, this.worker);
      }
    }
    const textures: Array<{ extensions?: Record<string, unknown> }> = this.parser.json.textures ?? [];
    textures.forEach((texture, index) => {
      if (associatedTextures.has(index)) return;
      const ext = definition(texture?.extensions?.[EXTENSION_NAME]);
      if (!ext) return;
      const pending: Promise<Texture | null> = this.parser.getDependency("texture", index);
      void pending
        .then((result) => {
          if (result) register(result, ext, this.parser.options.path, index, this.manager, this.loader, this.worker);
        })
        .catch((error) => {
          console.error("Progressive texture registration failed", error);
        });
    });
    if (gltf) {
      for (const scene of gltf.scenes)
        scene.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          for (const material of Array.isArray(object.material) ? object.material : [object.material])
            trackMaterial(material);
        });
    }
    return null;
  }
}

export class LODsManager {
  static get(renderer: WebGLRenderer, loader?: GLTFLoader, worker?: ProgressiveWorker): LODsManager {
    let manager = rendererManagers.get(renderer);
    if (!manager) {
      manager = new LODsManager(loader ?? new GLTFLoader(), renderer, worker);
      rendererManagers.set(renderer, manager);
    } else if (loader) {
      manager.sourceLoader = loader;
      manager.sourceWorker = worker;
    }
    return manager;
  }

  static addPlugin(plugin: NEEDLE_progressive_plugin): void {
    plugins.push(plugin);
  }

  static removePlugin(plugin: NEEDLE_progressive_plugin): void {
    const index = plugins.indexOf(plugin);
    if (index >= 0) plugins.splice(index, 1);
  }
  private readonly _renderer: WebGLRenderer | null;
  overrideLodLevel: number | undefined = undefined;
  targetTriangleDensity: number = 200000;
  skinnedMeshAutoUpdateBoundsInterval: number = 30;
  updateInterval: "auto" | number = "auto";
  pause: boolean = false;
  manual: boolean = false;
  sourceLoader: GLTFLoader;
  sourceWorker: ProgressiveWorker | undefined;
  private readonly requested: WeakMap<object, number> = new WeakMap();
  private readonly meshTasks: WeakMap<Mesh, Promise<BufferGeometry | null>> = new WeakMap();
  private readonly materialRequests: WeakMap<Material, Map<string, number>> = new WeakMap();
  private readonly listeners: Set<
    (event: { type: "mesh" | "texture"; level: number; object: Mesh | Material }) => void
  > = new Set();
  private originalRender: WebGLRenderer["render"] | null = null;
  private wrapper: WebGLRenderer["render"] | null = null;
  private readonly textureStarted: WeakSet<Mesh> = new WeakSet();
  private readonly meshFrames: WeakMap<Mesh, number> = new WeakMap();
  private readonly skinnedOffsets: WeakMap<SkinnedMesh, number> = new WeakMap();
  private nextSkinnedOffset: number = 0;
  private readonly groups: Set<PromiseGroup> = new Set();
  private frame: number = 0;
  private lastRenderTime: number = 0;
  private adaptiveInterval: number = 1;
  private readonly frameRates: number[] = [60, 60, 60, 60, 60];

  constructor(loader: GLTFLoader, renderer: WebGLRenderer | null, worker?: ProgressiveWorker) {
    this.sourceLoader = loader;
    this._renderer = renderer;
    this.sourceWorker = worker;
    managers.add(new WeakRef(this));
  }

  get renderer(): WebGLRenderer {
    if (!this._renderer) throw new Error("A renderer is required to update progressive LODs.");
    return this._renderer;
  }

  addEventListener(
    _event: "changed",
    listener: (event: { type: "mesh" | "texture"; level: number; object: Mesh | Material }) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  removeEventListener(
    _event: "changed",
    listener: (event: { type: "mesh" | "texture"; level: number; object: Mesh | Material }) => void,
  ): boolean {
    return this.listeners.delete(listener);
  }

  awaitLoading(options?: PromiseGroupOptions): Promise<PromiseGroupResult> {
    const group = new PromiseGroup(this.frame, options);
    this.groups.add(group);
    void group.ready.then(() => {
      this.groups.delete(group);
    });
    return group.ready;
  }

  private capture(object: object, promise: Promise<unknown>): void {
    for (const group of this.groups) group.add(object, promise);
  }

  enable(): void {
    if (this.originalRender) return;
    const original = this.renderer.render;
    this.originalRender = original;
    let stack = 0;
    this.wrapper = (scene, camera) => {
      const target = this.renderer.getRenderTarget();
      if (target === null || ("isXRRenderTarget" in target && target.isXRRenderTarget)) {
        stack = 0;
        this.frame++;
        const now = performance.now();
        if (this.lastRenderTime) {
          this.frameRates.shift();
          this.frameRates.push(1000 / (now - this.lastRenderTime));
        }
        this.lastRenderTime = now;
      }
      const stackLevel = stack++;
      original.call(this.renderer, scene, camera);
      if (this.manual || this.pause) return;
      if (camera.parent?.type === "CubeCamera" || (stackLevel >= 1 && camera.type === "OrthographicCamera")) return;
      const renderLists = this.renderer.renderLists as {
        get(scene: Object3D, depth: number): { opaque: Array<{ material: Material }> };
      };
      const opaque = renderLists.get(scene, 0).opaque;
      if (
        opaque.length === 1 &&
        (opaque[0].material.name === "EffectMaterial" || opaque[0].material.name === "CopyShader")
      )
        return;
      if (this.updateInterval === "auto") {
        const fps = this.frameRates.reduce((sum, rate) => sum + rate, 0) / this.frameRates.length;
        if (fps < 40 && this.adaptiveInterval < 10) this.adaptiveInterval++;
        else if (fps >= 60 && this.adaptiveInterval > 1) this.adaptiveInterval--;
      }
      const interval = this.updateInterval === "auto" ? this.adaptiveInterval : this.updateInterval;
      if (interval <= 0 || this.frame % interval === 0) {
        this.update(scene, camera);
        for (const group of this.groups) group.update(this.frame);
      }
    };
    this.renderer.render = this.wrapper;
  }

  disable(): void {
    if (this.originalRender && this.renderer.render === this.wrapper) this.renderer.render = this.originalRender;
    this.originalRender = null;
    this.wrapper = null;
  }

  update(scene: Object3D, camera: Camera): void {
    const lists = this.renderer.renderLists as {
      get(
        scene: Object3D,
        depth: number,
      ): {
        opaque: Array<{ object: Object3D; material: Material }>;
        transparent: Array<{ object: Object3D; material: Material }>;
        transmissive: Array<{ object: Object3D; material: Material }>;
      };
    };
    const rendered = lists.get(scene, 0);
    const updateEntry = ({ object, material }: { object: Object3D; material: Material }): void => {
      if (
        [
          "LineBasicMaterial",
          "LineDashedMaterial",
          "PointsMaterial",
          "ShadowMaterial",
          "MeshDistanceMaterial",
          "MeshDepthMaterial",
        ].includes(material.type)
      )
        return;
      if (
        ["SphericalGaussianBlur", "BackgroundCubeMaterial", "CubemapFromEquirect", "EquirectangularToCubeUV"].includes(
          material.name,
        )
      )
        return;
      if (!(object instanceof Mesh)) return;
      const frames = this.meshFrames.get(object) ?? 0;
      this.meshFrames.set(object, frames + 1);
      if (frames < 2) return;
      if (scene instanceof Scene)
        for (const plugin of plugins) plugin.onBeforeUpdateLOD?.(this.renderer, scene, camera, object);
      const info = metadata(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const textureLods: ProgressiveLOD[][] = [];
      for (const material of materials) {
        for (const slot of textureSlots(material)) {
          const lods = metadata(slot.texture)?.extension.lods;
          if (Array.isArray(lods)) textureLods.push(lods);
        }
      }
      const meshLods = info && Array.isArray(info.extension.lods) ? info.extension.lods : undefined;
      if (
        this.overrideLodLevel === undefined &&
        object instanceof SkinnedMesh &&
        object.boundingBox &&
        this.skinnedMeshAutoUpdateBoundsInterval > 0
      ) {
        let offset = this.skinnedOffsets.get(object);
        if (offset === undefined) {
          offset = this.nextSkinnedOffset++;
          this.skinnedOffsets.set(object, offset);
        }
        if ((frames + 1 + offset) % this.skinnedMeshAutoUpdateBoundsInterval === 0) {
          const geometry = object.geometry;
          const raycastGeometry = getRaycastMesh(object);
          if (raycastGeometry) object.geometry = raycastGeometry;
          try {
            object.computeBoundingBox();
          } finally {
            object.geometry = geometry;
          }
        }
      }
      const levels =
        this.overrideLodLevel === undefined
          ? calculateProgressiveLOD(
              this.renderer,
              camera,
              object,
              meshLods,
              info?.primitive ?? 0,
              textureLods,
              this.targetTriangleDensity,
            )
          : { mesh_lod: this.overrideLodLevel, texture_lod: this.overrideLodLevel };
      if (info && levels.mesh_lod >= 0) void this.assignMesh(object, info, Math.round(levels.mesh_lod));
      if (textureLods.length && !this.textureStarted.has(object) && this.overrideLodLevel === undefined) {
        levels.texture_lod = Math.max(...textureLods.map((lods) => lods.length)) - 1;
        this.textureStarted.add(object);
      }
      if (levels.texture_lod >= 0)
        for (const material of materials) this.assignMaterial(material, Math.round(levels.texture_lod));
      if (scene instanceof Scene)
        for (const plugin of plugins) plugin.onAfterUpdatedLOD?.(this.renderer, scene, camera, object, levels);
    };
    for (const entries of [rendered.opaque, rendered.transparent, rendered.transmissive]) {
      for (const entry of entries) updateEntry(entry);
    }
  }

  assignMesh(mesh: Mesh, info: ResourceInfo, level: number): Promise<BufferGeometry | null> {
    if (this.requested.get(mesh) === level) return this.meshTasks.get(mesh) ?? Promise.resolve(null);
    this.requested.set(mesh, level);
    for (const plugin of plugins) plugin.onBeforeGetLODMesh?.(mesh, level);
    const task = this.load(info, level, false)
      .then((result) => {
        if (!info.active || this.requested.get(mesh) !== level || !Array.isArray(result)) return null;
        const geometry =
          level >= (Array.isArray(info.extension.lods) ? info.extension.lods.length : 1)
            ? info.original.deref()
            : result[info.primitive];
        if (geometry instanceof BufferGeometry) {
          resources.set(geometry, info);
          mesh.geometry = geometry;
          for (const listener of this.listeners) listener({ type: "mesh", level, object: mesh });
          return geometry;
        }
        return null;
      })
      .catch((error) => {
        if (this.requested.get(mesh) === level) this.requested.delete(mesh);
        console.error("Progressive mesh load failed", error);
        return null;
      });
    this.meshTasks.set(mesh, task);
    this.capture(mesh, task);
    return task;
  }

  private assignMaterial(material: Material, level: number): void {
    trackMaterial(material);
    let requests = this.materialRequests.get(material);
    if (!requests) {
      requests = new Map();
      this.materialRequests.set(material, requests);
    }
    const tasks: Promise<void>[] = [];
    for (const entry of textureSlots(material)) {
      if (entry.name === "glyphMap") continue;
      const slot = entry.name;
      const current = entry.texture;
      const info = metadata(current);
      if (!info) continue;
      const previous = requests.get(slot);
      if (previous === level || (this.overrideLodLevel === undefined && previous !== undefined && previous < level))
        continue;
      requests.set(slot, level);
      const request = requests;
      const task = this.loadTexture(current, info, level)
        .then((next) => {
          if (!next) return;
          if (
            !info.active ||
            request.get(slot) !== level ||
            entry.target[entry.key] !== current ||
            (textureLevels.get(current) ?? Infinity) < level
          ) {
            next.dispose();
            return;
          }
          replaceTexture(material, slot, current, next);
          entry.target[entry.key] = next;
          if (material instanceof ShaderMaterial) material.uniformsNeedUpdate = true;
          material.needsUpdate = true;
        })
        .catch((error) => {
          if (request.get(slot) === level) request.delete(slot);
          console.error("Progressive texture load failed", error);
        });
      tasks.push(task);
    }
    if (tasks.length) {
      const complete = Promise.all(tasks).then(() => {
        for (const listener of this.listeners) listener({ type: "texture", level, object: material });
      });
      this.capture(material, complete);
    }
  }

  async loadTexture(current: Texture, info: ResourceInfo, level: number): Promise<Texture | null> {
    const result = await this.load(info, level, true);
    if (!info.active || !(result instanceof Texture)) return null;
    const next = result.clone();
    next.offset = current.offset;
    next.repeat = current.repeat;
    next.center = current.center;
    next.rotation = current.rotation;
    next.matrixAutoUpdate = current.matrixAutoUpdate;
    next.matrix.copy(current.matrix);
    next.mapping = current.mapping;
    next.colorSpace = current.colorSpace;
    next.wrapS = current.wrapS;
    next.wrapT = current.wrapT;
    next.magFilter = current.magFilter;
    next.minFilter = current.minFilter;
    next.flipY = current.flipY;
    next.anisotropy = current.anisotropy;
    next.channel = current.channel;
    textureLevels.set(next, level);
    resources.set(next, info);
    return next;
  }

  private load(info: ResourceInfo, level: number, texture: boolean): Promise<BufferGeometry[] | Texture | null> {
    const lods = info.extension.lods;
    if (level >= (Array.isArray(lods) ? lods.length : 1)) {
      const original = info.original.deref();
      return Promise.resolve(original instanceof Texture ? original : original ? [original] : null);
    }
    const lod = Array.isArray(lods) ? lods[Math.max(0, level)] : { path: lods };
    const url = resolvePath(info.path, lod.path);
    const key = `${texture ? "texture" : "mesh"}:${info.extension.guid}:${url}`;
    const previous = lodCache.get(key);
    if (previous instanceof WeakRef) {
      const cached = previous.deref();
      if (cached) return Promise.resolve(cached);
      lodCache.delete(key);
    } else if (previous) return previous;
    if (!/\.(?:glb|gltf)(?:[?#]|$)/i.test(url)) return this.loadResource(info, url, lod.hash, texture);
    const task = this.schedule(() => this.loadResource(info, url, lod.hash, texture)).catch((error) => {
      console.error("Progressive LOD load failed", error);
      return null;
    });
    lodCache.set(key, task);
    void task.then((result) => {
      if (result instanceof Texture && lodCache.get(key) === task) {
        lodCache.set(key, new WeakRef(result));
        textureCacheFinalizer.register(result, key);
      }
    });
    return task;
  }

  disposeCache(guid?: string): void {
    for (const [key, entry] of lodCache) {
      if (guid !== undefined && !key.startsWith(`mesh:${guid}:`) && !key.startsWith(`texture:${guid}:`)) continue;
      lodCache.delete(key);
      if (entry instanceof WeakRef) {
        entry.deref()?.dispose();
      } else {
        void entry.then((result) => {
          if (Array.isArray(result)) for (const geometry of result) geometry.dispose();
          else result?.dispose();
        });
      }
    }
  }

  private async schedule(
    load: () => Promise<BufferGeometry[] | Texture | null>,
  ): Promise<BufferGeometry[] | Texture | null> {
    if (runningLoads >= NEEDLE_progressive.maxConcurrentLoadingTasks) {
      await new Promise<void>((resolve) => {
        loadingQueue.push(() => {
          runningLoads++;
          resolve();
        });
      });
    } else {
      runningLoads++;
    }
    try {
      return await load();
    } finally {
      runningLoads--;
      while (loadingQueue.length && runningLoads < NEEDLE_progressive.maxConcurrentLoadingTasks)
        loadingQueue.shift()?.();
    }
  }

  private async loadResource(
    info: ResourceInfo,
    url: string,
    hash: string | undefined,
    texture: boolean,
  ): Promise<BufferGeometry[] | Texture | null> {
    if (!/\.(?:glb|gltf)(?:[?#]|$)/i.test(url)) {
      return texture
        ? new TextureLoader(info.loader.manager).setCrossOrigin(info.loader.crossOrigin).loadAsync(url)
        : null;
    }
    const separator = url.includes("?") ? "&" : "?";
    if (info.worker) {
      return info.worker.load(
        hash ? `${url}${separator}v=${encodeURIComponent(hash)}` : url,
        info.extension.guid,
        texture ? "texture" : "mesh",
      );
    }
    const gltf = await info.loader.loadAsync(hash ? `${url}${separator}v=${encodeURIComponent(hash)}` : url);
    const defs: unknown[] = (texture ? gltf.parser.json.textures : gltf.parser.json.meshes) ?? [];
    const index = defs.findIndex((item) => {
      if (!item || typeof item !== "object" || !("extensions" in item)) return false;
      const extensions = item.extensions;
      if (!extensions || typeof extensions !== "object" || !(EXTENSION_NAME in extensions)) return false;
      const extension = extensions[EXTENSION_NAME];
      return (
        !!extension && typeof extension === "object" && "guid" in extension && extension.guid === info.extension.guid
      );
    });
    if (index < 0) return null;
    if (texture) return (await gltf.parser.getDependency("texture", index)) as Texture;
    const object = (await gltf.parser.getDependency("mesh", index)) as Object3D;
    if (object instanceof Mesh) return [object.geometry];
    return object.children.filter((child): child is Mesh => child instanceof Mesh).map((child) => child.geometry);
  }
}

export function useNeedleProgressive(
  loader: GLTFLoader,
  renderer: WebGLRenderer,
  options: ProgressiveOptions = {},
): LODsManager {
  if (!loader.dracoLoader) loader.setDRACOLoader(new DRACOLoader());
  if (!loader.ktx2Loader) loader.setKTX2Loader(new KTX2Loader().detectSupport(renderer));
  configureLoader(loader, { progressive: true, ...options.hints });
  const manager = LODsManager.get(renderer, loader, options.worker);
  activeRegistrationManager = new WeakRef(manager);
  loader.register((parser) => new NEEDLE_progressive(parser, manager, loader, options.worker));
  if (options.enableLODsManager !== false) manager.enable();
  return manager;
}
