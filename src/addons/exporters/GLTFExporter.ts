import type { MeshPhysicalMaterial } from "../../materials/MeshPhysicalMaterial";
import type { DirectionalLight } from "../../lights/DirectionalLight";
import type { PointLight } from "../../lights/PointLight";
import type { SpotLight } from "../../lights/SpotLight";
import type { InstancedMesh } from "../../objects/InstancedMesh";
import type { KeyframeTrack } from "../../animation/KeyframeTrack";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Material } from "../../materials/Material";
import type { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import type { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import type { Mesh } from "../../objects/Mesh";
import type { Line } from "../../objects/Line";
import type { Points } from "../../objects/Points";
import type { Camera } from "../../cameras/Camera";
import type { OrthographicCamera } from "../../cameras/OrthographicCamera";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { BufferAttribute } from "../../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import {
  ClampToEdgeWrapping,
  DoubleSide,
  InterpolateDiscrete,
  InterpolateLinear,
  NoColorSpace,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipmapLinearFilter,
  NearestMipmapNearestFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  REVISION,
} from "../../constants";
import { Color } from "../../math/Color";
import * as MathUtils from "../../math/MathUtils";
import { Matrix4 } from "../../math/Matrix4";
import { Vector3 } from "../../math/Vector3";
import { Quaternion } from "../../math/Quaternion";
import { PropertyBinding } from "../../animation/PropertyBinding";
import type { AnimationClip } from "../../animation/AnimationClip";
import type { Object3D } from "../../core/Object3D";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";
import type { Texture } from "../../textures/Texture";
import { TextureSource } from "../../textures/TextureSource";
import { CompressedTexture } from "../../textures/CompressedTexture";
import { Scene } from "../../scenes/Scene";
import { ImageUtils } from "../../extras/ImageUtils";

export interface GLTFWriterOptions {
  binary?: boolean;
  trs?: boolean;
  onlyVisible?: boolean;
  maxTextureSize?: number;
  animations?: AnimationClip[] | AnimationClip[][];
  includeCustomExtensions?: boolean;
  copyright?: string | null;
}
export interface GLTFTextureUtils {
  decompress(texture: CompressedTexture, maxTextureSize?: number): Texture | Promise<Texture>;
}
export interface GLTFExporterPlugin {
  beforeParse?(input: Object3D[]): void | Promise<void>;
  afterParse?(input: Object3D[]): void | Promise<void>;
  writeNode?(object: Object3D, node: GLTFNodeDef): void | Promise<void>;
  writeMesh?(mesh: GLTFExportMesh, definition: GLTFMeshDef): void | Promise<void>;
  writeTexture?(texture: Texture, definition: GLTFTextureDef): void | Promise<void>;
  writeMaterialAsync?(material: GLTFMaterial, definition: GLTFMaterialDef): void | Promise<void>;
}

/**
 * The KHR_mesh_quantization extension allows these extra attribute component types
 *
 * @see https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_mesh_quantization/README.md#extending-mesh-attributes
 */
const KHR_mesh_quantization_ExtraAttrTypes = {
  POSITION: [
    "byte",
    "byte normalized",
    "unsigned byte",
    "unsigned byte normalized",
    "short",
    "short normalized",
    "unsigned short",
    "unsigned short normalized",
  ],
  NORMAL: ["byte normalized", "short normalized"],
  TANGENT: ["byte normalized", "short normalized"],
  TEXCOORD: ["byte", "byte normalized", "unsigned byte", "short", "short normalized", "unsigned short"],
};
const WEBGL_CONSTANTS = {
  POINTS: 0x0000,
  LINES: 0x0001,
  LINE_LOOP: 0x0002,
  LINE_STRIP: 0x0003,
  TRIANGLES: 0x0004,
  TRIANGLE_STRIP: 0x0005,
  TRIANGLE_FAN: 0x0006,

  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  INT: 0x1404,
  UNSIGNED_INT: 0x1405,
  FLOAT: 0x1406,

  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,

  NEAREST: 0x2600,
  LINEAR: 0x2601,
  NEAREST_MIPMAP_NEAREST: 0x2700,
  LINEAR_MIPMAP_NEAREST: 0x2701,
  NEAREST_MIPMAP_LINEAR: 0x2702,
  LINEAR_MIPMAP_LINEAR: 0x2703,

  CLAMP_TO_EDGE: 33071,
  MIRRORED_REPEAT: 33648,
  REPEAT: 10497,
};

const KHR_MESH_QUANTIZATION = "KHR_mesh_quantization";

const THREE_TO_WEBGL: Record<number, number> = {};

THREE_TO_WEBGL[NearestFilter] = WEBGL_CONSTANTS.NEAREST;
THREE_TO_WEBGL[NearestMipmapNearestFilter] = WEBGL_CONSTANTS.NEAREST_MIPMAP_NEAREST;
THREE_TO_WEBGL[NearestMipmapLinearFilter] = WEBGL_CONSTANTS.NEAREST_MIPMAP_LINEAR;
THREE_TO_WEBGL[LinearFilter] = WEBGL_CONSTANTS.LINEAR;
THREE_TO_WEBGL[LinearMipmapNearestFilter] = WEBGL_CONSTANTS.LINEAR_MIPMAP_NEAREST;
THREE_TO_WEBGL[LinearMipmapLinearFilter] = WEBGL_CONSTANTS.LINEAR_MIPMAP_LINEAR;

THREE_TO_WEBGL[ClampToEdgeWrapping] = WEBGL_CONSTANTS.CLAMP_TO_EDGE;
THREE_TO_WEBGL[RepeatWrapping] = WEBGL_CONSTANTS.REPEAT;
THREE_TO_WEBGL[MirroredRepeatWrapping] = WEBGL_CONSTANTS.MIRRORED_REPEAT;

const PATH_PROPERTIES: Record<string, string> = {
  scale: "scale",
  position: "translation",
  quaternion: "rotation",
  morphTargetInfluences: "weights",
};

const DEFAULT_SPECULAR_COLOR = new Color();

// GLB constants
// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#glb-file-format-specification

const GLB_HEADER_BYTES = 12;
const GLB_HEADER_MAGIC = 0x46546c67;
const GLB_VERSION = 2;

const GLB_CHUNK_PREFIX_BYTES = 8;
const GLB_CHUNK_TYPE_JSON = 0x4e4f534a;
const GLB_CHUNK_TYPE_BIN = 0x004e4942;

function equalArray(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function stringToArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

function isIdentityMatrix(matrix: Matrix4): boolean {
  return equalArray(matrix.elements, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function getMinMax(attribute: GLTFAttribute, start: number, count: number): { min: number[]; max: number[] } {
  const min: number[] = [];
  const max: number[] = [];
  min.length = max.length = attribute.itemSize;
  min.fill(Infinity);
  max.fill(-Infinity);
  for (let i = start; i < start + count; i++) {
    for (let component = 0; component < attribute.itemSize; component++) {
      let value =
        attribute.itemSize > 4
          ? attribute.array[i * attribute.itemSize + component]
          : component === 0
            ? attribute.getX(i)
            : component === 1
              ? attribute.getY(i)
              : component === 2
                ? attribute.getZ(i)
                : attribute.getW(i);
      if (attribute.itemSize <= 4 && attribute.normalized) value = MathUtils.normalize(value, attribute.array);
      min[component] = Math.min(min[component], value);
      max[component] = Math.max(max[component], value);
    }
  }
  return { min, max };
}

function getPaddedBufferSize(size: number): number {
  return Math.ceil(size / 4) * 4;
}

function getPaddedArrayBuffer(buffer: ArrayBuffer, paddingByte = 0): ArrayBuffer {
  const length = getPaddedBufferSize(buffer.byteLength);
  if (length === buffer.byteLength) return buffer;
  const padded = new Uint8Array(length);
  padded.set(new Uint8Array(buffer));
  if (paddingByte !== 0) padded.fill(paddingByte, buffer.byteLength);
  return padded.buffer;
}

function getCanvas(): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document === "undefined" && typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(1, 1);
  return document.createElement("canvas");
}

function getToBlobPromise(canvas: HTMLCanvasElement | OffscreenCanvas, mimeType: string): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    const quality = mimeType === "image/jpeg" ? 0.92 : mimeType === "image/webp" ? 0.8 : undefined;
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("THREE.GLTFExporter: Canvas encoding failed."))),
      mimeType,
    );
  });
}

export interface GLTFNodeDef {
  rotation?: number[];
  translation?: number[];
  scale?: number[];
  matrix?: number[];
  name?: string;
  extras?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
  mesh?: number;
  camera?: number;
  skin?: number;
  children?: number[];
}

export interface GLTFMaterialDef {
  pbrMetallicRoughness: {
    baseColorFactor?: number[];
    baseColorTexture?: GLTFTextureInfo;
    metallicFactor?: number;
    roughnessFactor?: number;
    metallicRoughnessTexture?: GLTFTextureInfo;
  };
  name?: string;
  normalTexture?: GLTFTextureInfo;
  occlusionTexture?: GLTFTextureInfo;
  emissiveTexture?: GLTFTextureInfo;
  emissiveFactor?: number[];
  alphaMode?: string;
  alphaCutoff?: number;
  doubleSided?: boolean;
  extras?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface GLTFDocument {
  asset: { version: string; generator: string; copyright?: string };
  buffers?: { byteLength: number; uri?: string }[];
  bufferViews?: GLTFBufferViewDef[];
  accessors?: GLTFAccessorDef[];
  images?: GLTFImageDef[];
  samplers?: { magFilter: number; minFilter: number; wrapS: number; wrapT: number }[];
  textures?: GLTFTextureDef[];
  materials?: GLTFMaterialDef[];
  meshes?: GLTFMeshDef[];
  cameras?: GLTFCameraDef[];
  nodes?: GLTFNodeDef[];
  scenes?: GLTFSceneDef[];
  scene?: number;
  animations?: GLTFAnimationDef[];
  skins?: GLTFSkinDef[];
  extensions?: Record<string, unknown>;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
}

type GLTFBufferViewDef = {
  buffer: number;
  byteOffset: number;
  byteLength: number;
  target?: number;
  byteStride?: number;
};
type GLTFAccessorDef = {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  max: number[];
  min: number[];
  type: string;
  normalized?: boolean;
};
type GLTFImageDef = { mimeType: string; bufferView?: number; uri?: string };
type GLTFTextureDef = { sampler: number; source?: number; name?: string; extensions?: Record<string, unknown> };
type GLTFTextureInfo = {
  index: number;
  texCoord?: number;
  scale?: number;
  strength?: number;
  extensions?: Record<string, unknown>;
};
type GLTFImageSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | OffscreenCanvas
  | { width: number; height: number; data: ArrayLike<number> };
type GLTFMaterial = Material & MeshStandardMaterial & MeshBasicMaterial & { isShaderMaterial?: boolean };

type GLTFAttribute = BufferAttribute | InterleavedBufferAttribute;
type GLTFExportMesh = (Mesh | Line | Points) & {
  isLineSegments?: boolean;
  isLineLoop?: boolean;
  isLine?: boolean;
  isPoints?: boolean;
};
type GLTFExportCamera = Camera & { isOrthographicCamera?: boolean; near: number; far: number };
interface GLTFPrimitiveDef {
  mode: number;
  attributes: Record<string, number | null>;
  targets?: Record<string, number | null>[];
  indices?: number | null;
  material?: number;
  extras?: unknown;
  extensions?: Record<string, unknown>;
}
interface GLTFMeshDef {
  weights?: number[];
  extras?: { targetNames: string[] };
  primitives?: GLTFPrimitiveDef[];
}
interface GLTFCameraDef {
  type: "orthographic" | "perspective";
  orthographic?: { xmag: number; ymag: number; zfar: number; znear: number };
  perspective?: { aspectRatio: number; yfov: number; zfar: number; znear: number };
  name?: string;
}

type GLTFAnimationDef = {
  name: string;
  samplers: { input: number | null; output: number | null; interpolation: string }[];
  channels: { sampler: number; target: { node: number | undefined; path: string } }[];
  extras?: unknown;
  extensions?: Record<string, unknown>;
};
type GLTFSkinDef = {
  inverseBindMatrices: number | null;
  joints: (number | undefined)[];
  skeleton: number | undefined;
};
type GLTFNodeObject = Object3D & {
  isMesh?: boolean;
  isLine?: boolean;
  isPoints?: boolean;
  isCamera?: boolean;
  isSkinnedMesh?: boolean;
};

type GLTFSceneDef = { name?: string; nodes?: number[]; extras?: unknown; extensions?: Record<string, unknown> };

export class GLTFWriter {
  plugins: GLTFExporterPlugin[] = [];
  options: Required<GLTFWriterOptions> = {
    binary: false,
    trs: false,
    onlyVisible: true,
    maxTextureSize: Infinity,
    animations: [],
    includeCustomExtensions: false,
    copyright: null,
  };
  pending: Promise<unknown>[] = [];
  buffers: ArrayBuffer[] = [];
  byteOffset: number = 0;
  nodeMap: Map<Object3D, number> = new Map();
  skins: SkinnedMesh[] = [];
  extensionsUsed: Record<string, boolean> = {};
  extensionsRequired: Record<string, boolean> = {};
  uids: Map<object, Map<boolean, number>> = new Map();
  uid: number = 0;
  json: GLTFDocument = { asset: { version: "2.0", generator: "THREE.GLTFExporter r" + REVISION } };
  cache: {
    meshes: Map<string, number>;
    attributes: Map<number | string, number | null>;
    attributesNormalized: Map<GLTFAttribute, GLTFAttribute>;
    materials: Map<string, number>;
    textures: Map<Texture, number>;
    images: Map<GLTFImageSource, Record<string, number>>;
    normalMaps: Map<Texture, Record<string, Texture>>;
  } = {
    meshes: new Map<string, number>(),
    attributes: new Map<number | string, number | null>(),
    attributesNormalized: new Map<GLTFAttribute, GLTFAttribute>(),
    materials: new Map<string, number>(),
    textures: new Map<Texture, number>(),
    images: new Map<GLTFImageSource, Record<string, number>>(),
    normalMaps: new Map<Texture, Record<string, Texture>>(),
  };
  textureUtils: GLTFTextureUtils | null = null;

  setPlugins(plugins: GLTFExporterPlugin[]): void {
    this.plugins = plugins;
  }
  setTextureUtils(utils: GLTFTextureUtils | null): void {
    this.textureUtils = utils;
  }

  async writeAsync(
    input: Object3D | Object3D[],
    onDone: (result: GLTFDocument | ArrayBuffer) => void,
    options: GLTFWriterOptions = {},
  ): Promise<void> {
    this.options = { ...this.options, ...options };
    if (this.options.animations.length > 0) this.options.trs = true;
    await this.processInputAsync(input);
    await Promise.all(this.pending);
    const json = this.json;
    const blob = new Blob(this.buffers, { type: "application/octet-stream" });
    const used = Object.keys(this.extensionsUsed);
    const required = Object.keys(this.extensionsRequired);
    if (used.length) json.extensionsUsed = used;
    if (required.length) json.extensionsRequired = required;
    if (json.buffers?.length) json.buffers[0].byteLength = blob.size;
    if (this.options.copyright) json.asset.copyright = this.options.copyright;
    if (this.options.binary) {
      const binary = getPaddedArrayBuffer(await blob.arrayBuffer());
      const binaryPrefix = new DataView(new ArrayBuffer(GLB_CHUNK_PREFIX_BYTES));
      binaryPrefix.setUint32(0, binary.byteLength, true);
      binaryPrefix.setUint32(4, GLB_CHUNK_TYPE_BIN, true);
      const jsonChunk = getPaddedArrayBuffer(stringToArrayBuffer(JSON.stringify(json)), 0x20);
      const jsonPrefix = new DataView(new ArrayBuffer(GLB_CHUNK_PREFIX_BYTES));
      jsonPrefix.setUint32(0, jsonChunk.byteLength, true);
      jsonPrefix.setUint32(4, GLB_CHUNK_TYPE_JSON, true);
      const header = new ArrayBuffer(GLB_HEADER_BYTES);
      const view = new DataView(header);
      view.setUint32(0, GLB_HEADER_MAGIC, true);
      view.setUint32(4, GLB_VERSION, true);
      view.setUint32(
        8,
        GLB_HEADER_BYTES + jsonPrefix.byteLength + jsonChunk.byteLength + binaryPrefix.byteLength + binary.byteLength,
        true,
      );
      onDone(await new Blob([header, jsonPrefix, jsonChunk, binaryPrefix, binary]).arrayBuffer());
    } else if (json.buffers?.length) {
      const uri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("THREE.GLTFExporter: Failed to read buffer."));
        reader.onabort = () => reject(new Error("THREE.GLTFExporter: Buffer read aborted."));
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("THREE.GLTFExporter: Invalid buffer data URL."));
        reader.readAsDataURL(blob);
      });
      json.buffers[0].uri = uri;
      onDone(json);
    } else {
      onDone(json);
    }
  }

  serializeUserData(
    object: { userData: unknown; name: string },
    definition: { extras?: unknown; extensions?: Record<string, unknown> },
  ): void {
    if (!object.userData || Object.keys(object.userData).length === 0) return;
    try {
      const data = JSON.parse(JSON.stringify(object.userData)) as Record<string, unknown>;
      if (this.options.includeCustomExtensions && data.gltfExtensions && typeof data.gltfExtensions === "object") {
        definition.extensions ??= {};
        for (const [name, value] of Object.entries(data.gltfExtensions)) {
          definition.extensions[name] = value;
          this.extensionsUsed[name] = true;
        }
        delete data.gltfExtensions;
      }
      if (Object.keys(data).length > 0) definition.extras = data;
    } catch (error) {
      console.warn(
        "THREE.GLTFExporter: userData of '" +
          object.name +
          "' won't be serialized because of JSON.stringify error - " +
          String(error),
      );
    }
  }

  getUID(attribute: object, isRelativeCopy = false): number {
    let ids = this.uids.get(attribute);
    if (!ids) {
      ids = new Map([
        [true, this.uid++],
        [false, this.uid++],
      ]);
      this.uids.set(attribute, ids);
    }
    return ids.get(isRelativeCopy)!;
  }

  isNormalizedNormalAttribute(normal: GLTFAttribute): boolean {
    if (this.cache.attributesNormalized.has(normal)) return false;
    const v = new Vector3();
    for (let i = 0; i < normal.count; i++) {
      if (Math.abs(v.fromBufferAttribute(normal, i).length() - 1) > 0.0005) return false;
    }
    return true;
  }

  createNormalizedNormalAttribute(normal: GLTFAttribute): GLTFAttribute {
    const cached = this.cache.attributesNormalized.get(normal);
    if (cached) return cached;
    const attribute = normal.clone();
    const v = new Vector3();
    for (let i = 0; i < attribute.count; i++) {
      v.fromBufferAttribute(attribute, i);
      if (v.x === 0 && v.y === 0 && v.z === 0) v.setX(1);
      else v.normalize();
      attribute.setXYZ(i, v.x, v.y, v.z);
    }
    this.cache.attributesNormalized.set(normal, attribute);
    return attribute;
  }

  applyTextureTransform(map: GLTFTextureInfo, texture: Texture): void {
    const transform: { offset?: number[]; rotation?: number; scale?: number[] } = {};
    if (texture.offset.x !== 0 || texture.offset.y !== 0) transform.offset = texture.offset.toArray();
    if (texture.rotation !== 0) transform.rotation = texture.rotation;
    if (texture.repeat.x !== 1 || texture.repeat.y !== 1) transform.scale = texture.repeat.toArray();
    if (Object.keys(transform).length) {
      map.extensions ??= {};
      map.extensions.KHR_texture_transform = transform;
      this.extensionsUsed.KHR_texture_transform = true;
    }
  }

  async buildMetalRoughTextureAsync(metalnessMap: Texture | null, roughnessMap: Texture | null): Promise<Texture> {
    if (metalnessMap && metalnessMap === roughnessMap) return metalnessMap;
    const conversion = (map: Texture) =>
      map.colorSpace === SRGBColorSpace
        ? (c: number) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4))
        : (c: number) => c;
    if (metalnessMap instanceof CompressedTexture) metalnessMap = await this.decompressTextureAsync(metalnessMap);
    if (roughnessMap instanceof CompressedTexture) roughnessMap = await this.decompressTextureAsync(roughnessMap);
    const reference = metalnessMap || roughnessMap;
    if (!reference) throw new Error("THREE.GLTFExporter: Missing metalness and roughness maps.");
    const metalness = metalnessMap?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
    const roughness = roughnessMap?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
    const width = Math.max(metalness?.width ?? 0, roughness?.width ?? 0);
    const height = Math.max(metalness?.height ?? 0, roughness?.height ?? 0);
    const canvas = getCanvas();
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!context) throw new Error("THREE.GLTFExporter: Could not create canvas context.");
    context.fillStyle = "#00ffff";
    context.fillRect(0, 0, width, height);
    const composite = context.getImageData(0, 0, width, height);
    if (metalness && metalnessMap) {
      context.drawImage(metalness, 0, 0, width, height);
      const convert = conversion(metalnessMap);
      const data = context.getImageData(0, 0, width, height).data;
      for (let i = 2; i < data.length; i += 4) composite.data[i] = convert(data[i] / 256) * 256;
    }
    if (roughness && roughnessMap) {
      context.drawImage(roughness, 0, 0, width, height);
      const convert = conversion(roughnessMap);
      const data = context.getImageData(0, 0, width, height).data;
      for (let i = 1; i < data.length; i += 4) composite.data[i] = convert(data[i] / 256) * 256;
    }
    context.putImageData(composite, 0, 0);
    const texture = reference.clone();
    texture.source = new TextureSource(canvas);
    texture.colorSpace = NoColorSpace;
    texture.channel = reference.channel;
    if (metalnessMap && roughnessMap && metalnessMap.channel !== roughnessMap.channel) {
      console.warn("THREE.GLTFExporter: UV channels for metalnessMap and roughnessMap textures must match.");
    }
    console.warn("THREE.GLTFExporter: Merged metalnessMap and roughnessMap textures.");
    return texture;
  }

  async buildNormalMapTextureAsync(normalMap: Texture, flipX: boolean, flipY: boolean): Promise<Texture> {
    if (normalMap instanceof CompressedTexture) normalMap = await this.decompressTextureAsync(normalMap);
    const image = normalMap.image as CanvasImageSource & { width: number; height: number };
    const canvas = getCanvas();
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!context) throw new Error("THREE.GLTFExporter: Could not create canvas context.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (flipX) imageData.data[i] = 255 - imageData.data[i];
      if (flipY) imageData.data[i + 1] = 255 - imageData.data[i + 1];
    }
    context.putImageData(imageData, 0, 0);
    const texture = normalMap.clone();
    texture.source = new TextureSource(canvas);
    return texture;
  }

  async decompressTextureAsync(texture: CompressedTexture, maxTextureSize = Infinity): Promise<Texture> {
    if (!this.textureUtils)
      throw new Error("THREE.GLTFExporter: setTextureUtils() must be called to process compressed textures.");
    return this.textureUtils.decompress(texture, maxTextureSize);
  }

  /**
   * Process a buffer to append to the default one.
   */
  processBuffer(buffer: ArrayBuffer): 0 {
    const json = this.json;
    const buffers = this.buffers;

    if (!json.buffers) json.buffers = [{ byteLength: 0 }];

    // All buffers are merged before export.
    buffers.push(buffer);

    return 0;
  }

  /**
   * Process and generate a BufferView
   * @param target Target usage of the BufferView
   */
  processBufferView(
    attribute: BufferAttribute | InterleavedBufferAttribute,
    componentType: number,
    start: number,
    count: number,
    target?: number,
  ): { id: number; byteLength: number; byteOffset?: number } {
    const json = this.json;

    if (!json.bufferViews) json.bufferViews = [];

    // Create a new dataview and dump the attribute's array into it

    let componentSize;

    switch (componentType) {
      case WEBGL_CONSTANTS.BYTE:
      case WEBGL_CONSTANTS.UNSIGNED_BYTE:
        componentSize = 1;

        break;

      case WEBGL_CONSTANTS.SHORT:
      case WEBGL_CONSTANTS.UNSIGNED_SHORT:
        componentSize = 2;

        break;

      default:
        componentSize = 4;
    }

    let byteStride = attribute.itemSize * componentSize;

    if (target === WEBGL_CONSTANTS.ARRAY_BUFFER) {
      // Each element of a vertex attribute MUST be aligned to 4-byte boundaries
      // inside a bufferView
      byteStride = Math.ceil(byteStride / 4) * 4;
    }

    const byteLength = getPaddedBufferSize(count * byteStride);
    const dataView = new DataView(new ArrayBuffer(byteLength));
    let offset = 0;

    for (let i = start; i < start + count; i++) {
      for (let a = 0; a < attribute.itemSize; a++) {
        let value = 0;

        if (attribute.itemSize > 4) {
          // no support for interleaved data for itemSize > 4

          value = attribute.array[i * attribute.itemSize + a];
        } else {
          if (a === 0) value = attribute.getX(i);
          else if (a === 1) value = attribute.getY(i);
          else if (a === 2) value = attribute.getZ(i);
          else if (a === 3) value = attribute.getW(i);

          if (attribute.normalized === true) {
            value = MathUtils.normalize(value, attribute.array);
          }
        }

        if (componentType === WEBGL_CONSTANTS.FLOAT) {
          dataView.setFloat32(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.INT) {
          dataView.setInt32(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_INT) {
          dataView.setUint32(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.SHORT) {
          dataView.setInt16(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT) {
          dataView.setUint16(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.BYTE) {
          dataView.setInt8(offset, value);
        } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_BYTE) {
          dataView.setUint8(offset, value);
        }

        offset += componentSize;
      }

      if (offset % byteStride !== 0) {
        offset += byteStride - (offset % byteStride);
      }
    }

    const bufferViewDef: GLTFBufferViewDef = {
      buffer: this.processBuffer(dataView.buffer),
      byteOffset: this.byteOffset,
      byteLength: byteLength,
    };

    if (target !== undefined) bufferViewDef.target = target;

    if (target === WEBGL_CONSTANTS.ARRAY_BUFFER) {
      // Only define byteStride for vertex attributes.
      bufferViewDef.byteStride = byteStride;
    }

    this.byteOffset += byteLength;

    json.bufferViews!.push(bufferViewDef);

    // @TODO Merge bufferViews where possible.
    const output = {
      id: json.bufferViews.length - 1,
      byteLength: 0,
    };

    return output;
  }

  /**
   * Process and generate a BufferView from an image Blob.
   * @returns The buffer view index.
   */
  async processBufferViewImage(blob: Blob): Promise<number> {
    const buffer = getPaddedArrayBuffer(await blob.arrayBuffer());
    const views = (this.json.bufferViews ??= []);
    const view: GLTFBufferViewDef = {
      buffer: this.processBuffer(buffer),
      byteOffset: this.byteOffset,
      byteLength: buffer.byteLength,
    };
    this.byteOffset += buffer.byteLength;
    return views.push(view) - 1;
  }

  /**
   * Process attribute to generate an accessor
   * @param attribute Attribute to process.
   * @param geometry Geometry used for truncated draw range.
   * @returns Index of the processed accessor in the accessors array.
   */
  processAccessor(
    attribute: BufferAttribute | InterleavedBufferAttribute,
    geometry?: BufferGeometry,
    start?: number,
    count?: number,
  ): number | null {
    const json = this.json;

    const types: Record<number, string> = {
      1: "SCALAR",
      2: "VEC2",
      3: "VEC3",
      4: "VEC4",
      9: "MAT3",
      16: "MAT4",
    };

    let componentType;

    // Detect the component type of the attribute array
    if (attribute.array.constructor === Float32Array) {
      componentType = WEBGL_CONSTANTS.FLOAT;
    } else if (attribute.array.constructor === Int32Array) {
      componentType = WEBGL_CONSTANTS.INT;
    } else if (attribute.array.constructor === Uint32Array) {
      componentType = WEBGL_CONSTANTS.UNSIGNED_INT;
    } else if (attribute.array.constructor === Int16Array) {
      componentType = WEBGL_CONSTANTS.SHORT;
    } else if (attribute.array.constructor === Uint16Array) {
      componentType = WEBGL_CONSTANTS.UNSIGNED_SHORT;
    } else if (attribute.array.constructor === Int8Array) {
      componentType = WEBGL_CONSTANTS.BYTE;
    } else if (attribute.array.constructor === Uint8Array) {
      componentType = WEBGL_CONSTANTS.UNSIGNED_BYTE;
    } else {
      throw new Error(
        "THREE.GLTFExporter: Unsupported bufferAttribute component type: " + attribute.array.constructor.name,
      );
    }

    if (start === undefined) start = 0;
    if (count === undefined || count === Infinity) count = attribute.count;

    // Skip creating an accessor if the attribute doesn't have data to export
    if (count === 0) return null;

    const minMax = getMinMax(attribute, start, count);
    let bufferViewTarget;

    // If geometry isn't provided, don't infer the target usage of the bufferView. For
    // animation samplers, target must not be set.
    if (geometry !== undefined) {
      bufferViewTarget =
        attribute === geometry.index ? WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER : WEBGL_CONSTANTS.ARRAY_BUFFER;
    }

    const bufferView = this.processBufferView(attribute, componentType, start, count, bufferViewTarget);

    const accessorDef: GLTFAccessorDef = {
      bufferView: bufferView.id,
      byteOffset: bufferView.byteOffset,
      componentType: componentType,
      count: count,
      max: minMax.max,
      min: minMax.min,
      type: types[attribute.itemSize],
    };

    if (attribute.normalized === true) accessorDef.normalized = true;
    if (!json.accessors) json.accessors = [];

    return json.accessors.push(accessorDef) - 1;
  }

  /**
   * Process image
   * @param image Image to process.
   * @param format Identifier of the format (RGBAFormat).
   * @param flipY Whether to flip the image before writing.
   * @param mimeType Export format.
   * @returns Index of the processed image.
   */
  processImage(image: GLTFImageSource | null, format: number, flipY: boolean, mimeType = "image/png"): number {
    if (image !== null) {
      const cache = this.cache;
      const json = this.json;
      const options = this.options;
      const pending = this.pending;

      if (!cache.images.has(image)) cache.images.set(image, {});

      const cachedImages = cache.images.get(image)!;

      const key = mimeType + ":flipY/" + flipY.toString();

      if (cachedImages[key] !== undefined) return cachedImages[key];

      if (!json.images) json.images = [];

      const imageDef: GLTFImageDef = { mimeType: mimeType };

      const canvas = getCanvas();

      canvas.width = Math.min(image.width, options.maxTextureSize);
      canvas.height = Math.min(image.height, options.maxTextureSize);

      const ctx = canvas.getContext("2d", {
        willReadFrequently: true,
      })!;

      if (flipY === true) {
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
      }

      if ("data" in image && image.data !== undefined) {
        // THREE.DataTexture

        if (format !== RGBAFormat) {
          console.error("GLTFExporter: Only RGBAFormat is supported.", format);
        }

        if (image.width > options.maxTextureSize || image.height > options.maxTextureSize) {
          console.warn("GLTFExporter: Image size is bigger than maxTextureSize", image);
        }

        const data = new Uint8ClampedArray(image.height * image.width * 4);

        for (let i = 0; i < data.length; i += 4) {
          data[i + 0] = image.data[i + 0];
          data[i + 1] = image.data[i + 1];
          data[i + 2] = image.data[i + 2];
          data[i + 3] = image.data[i + 3];
        }

        ctx.putImageData(new ImageData(data, image.width, image.height), 0, 0);
      } else {
        if (
          (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) ||
          (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) ||
          (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) ||
          (typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas)
        ) {
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        } else {
          throw new Error(
            "THREE.GLTFExporter: Invalid image type. Use HTMLImageElement, HTMLCanvasElement, ImageBitmap or OffscreenCanvas.",
          );
        }
      }

      if (options.binary === true) {
        pending.push(
          getToBlobPromise(canvas, mimeType)
            .then((blob) => this.processBufferViewImage(blob))
            .then((bufferViewIndex) => {
              imageDef.bufferView = bufferViewIndex;
            }),
        );
      } else {
        imageDef.uri = ImageUtils.getDataURL(canvas as HTMLCanvasElement, mimeType);
      }

      const index = json.images.push(imageDef) - 1;
      cachedImages[key] = index;
      return index;
    } else {
      throw new Error("THREE.GLTFExporter: No valid image data found. Unable to process texture.");
    }
  }

  /**
   * Process sampler
   * @param map Texture to process.
   * @returns Index of the processed sampler.
   */
  processSampler(map: Texture): number {
    const json = this.json;

    if (!json.samplers) json.samplers = [];

    const samplerDef = {
      magFilter: THREE_TO_WEBGL[map.magFilter],
      minFilter: THREE_TO_WEBGL[map.minFilter],
      wrapS: THREE_TO_WEBGL[map.wrapS],
      wrapT: THREE_TO_WEBGL[map.wrapT],
    };

    return json.samplers.push(samplerDef) - 1;
  }

  /**
   * Process texture
   * @param map Map to process.
   * @returns Index of the processed texture.
   */
  async processTextureAsync(map: Texture): Promise<number> {
    const options = this.options;
    const cache = this.cache;
    const json = this.json;

    if (cache.textures.has(map)) return cache.textures.get(map)!;

    if (!json.textures) json.textures = [];

    // make non-readable textures (e.g. CompressedTexture) readable by blitting them into a new texture
    if (map instanceof CompressedTexture) {
      map = await this.decompressTextureAsync(map, options.maxTextureSize);
    }

    const mimeType = (map.userData as { mimeType?: string }).mimeType;

    const imageIndex = this.processImage(map.image, map.format, map.flipY, mimeType);

    const textureDef: GLTFTextureDef = {
      sampler: this.processSampler(map),
    };

    if (mimeType === "image/webp") {
      textureDef.extensions = textureDef.extensions || {};
      textureDef.extensions["EXT_texture_webp"] = {
        source: imageIndex,
      };

      this.extensionsUsed["EXT_texture_webp"] = true;
      this.extensionsRequired["EXT_texture_webp"] = true;
    } else {
      textureDef.source = imageIndex;
    }

    if (map.name) textureDef.name = map.name;

    await this._invokeAllAsync((ext) => ext.writeTexture?.(map, textureDef));

    const index = json.textures.push(textureDef) - 1;
    cache.textures.set(map, index);
    return index;
  }

  /**
   * Process material
   * @param inputMaterial Material to process.
   * @param geometry Geometry the material is used with.
   * @returns Index of the processed material.
   */
  async processMaterialAsync(inputMaterial: Material, geometry?: BufferGeometry): Promise<number | null> {
    const material = inputMaterial as GLTFMaterial;

    const cache = this.cache;
    const json = this.json;

    // Whether the geometry provides explicit tangents. The exported normal map depends on
    // this, so it is part of the material cache key.
    const hasTangent = geometry !== undefined && geometry.hasAttribute("tangent");
    const cacheKey = material.normalMap ? material.uuid + ":" + hasTangent : material.uuid;

    if (cache.materials.has(cacheKey)) return cache.materials.get(cacheKey)!;

    if (material.isShaderMaterial) {
      console.warn("GLTFExporter: THREE.ShaderMaterial not supported.");
      return null;
    }

    if (!json.materials) json.materials = [];

    // @QUESTION Should we avoid including any attribute that has the default value?
    const materialDef: GLTFMaterialDef = { pbrMetallicRoughness: {} };

    if (material.isMeshStandardMaterial !== true && material.isMeshBasicMaterial !== true) {
      console.warn("GLTFExporter: Use MeshStandardMaterial or MeshBasicMaterial for best results.");
    }

    // pbrMetallicRoughness.baseColorFactor
    const color = material.color.toArray().concat([material.opacity]);

    if (!equalArray(color, [1, 1, 1, 1])) {
      materialDef.pbrMetallicRoughness.baseColorFactor = color;
    }

    if (material.isMeshStandardMaterial) {
      materialDef.pbrMetallicRoughness.metallicFactor = material.metalness;
      materialDef.pbrMetallicRoughness.roughnessFactor = material.roughness;
    } else {
      materialDef.pbrMetallicRoughness.metallicFactor = 0;
      materialDef.pbrMetallicRoughness.roughnessFactor = 1;
    }

    // pbrMetallicRoughness.metallicRoughnessTexture
    if (material.metalnessMap || material.roughnessMap) {
      const metalRoughTexture = await this.buildMetalRoughTextureAsync(material.metalnessMap, material.roughnessMap);

      const metalRoughMapDef = {
        index: await this.processTextureAsync(metalRoughTexture),
        texCoord: metalRoughTexture.channel,
      };
      this.applyTextureTransform(metalRoughMapDef, metalRoughTexture);
      materialDef.pbrMetallicRoughness.metallicRoughnessTexture = metalRoughMapDef;
    }

    // pbrMetallicRoughness.baseColorTexture
    if (material.map) {
      const baseColorMapDef = {
        index: await this.processTextureAsync(material.map),
        texCoord: material.map.channel,
      };
      this.applyTextureTransform(baseColorMapDef, material.map);
      materialDef.pbrMetallicRoughness.baseColorTexture = baseColorMapDef;
    }

    if (material.emissive) {
      const emissive = material.emissive;
      const maxEmissiveComponent = Math.max(emissive.r, emissive.g, emissive.b);

      if (maxEmissiveComponent > 0) {
        materialDef.emissiveFactor = material.emissive.toArray();
      }

      // emissiveTexture
      if (material.emissiveMap) {
        const emissiveMapDef = {
          index: await this.processTextureAsync(material.emissiveMap),
          texCoord: material.emissiveMap.channel,
        };
        this.applyTextureTransform(emissiveMapDef, material.emissiveMap);
        materialDef.emissiveTexture = emissiveMapDef;
      }
    }

    // normalTexture
    if (material.normalMap) {
      const normalScale = material.normalScale;

      // glTF only supports OpenGL-style normal maps with a univariate, positive scale.
      // A negative `normalScale` component is baked into the texture by inverting the
      // corresponding channel. Meshes without explicit tangents use the opposite
      // green-channel convention, so the green channel is inverted in that case too.
      //
      // The no-tangent green flip is the counterpart of GLTFLoader, which negates
      // `normalScale.y` on import for the same case.
      const flipX = normalScale.x < 0;
      const flipY = hasTangent ? normalScale.y < 0 : normalScale.y > 0;

      let normalMap = material.normalMap;

      if (flipX || flipY) {
        if (cache.normalMaps.has(material.normalMap) === false) cache.normalMaps.set(material.normalMap, {});

        const cachedVariants = cache.normalMaps.get(material.normalMap)!;
        const cacheKey = `${flipX}:${flipY}`;

        if (cachedVariants[cacheKey] === undefined) {
          cachedVariants[cacheKey] = await this.buildNormalMapTextureAsync(material.normalMap, flipX, flipY);
        }

        normalMap = cachedVariants[cacheKey];
      }

      const normalMapDef: GLTFTextureInfo = {
        index: await this.processTextureAsync(normalMap),
        texCoord: material.normalMap.channel,
      };

      if (Math.abs(normalScale.x) !== 1) {
        // glTF normal scale is univariate. The magnitude of `x` is used; the sign of
        // both components has already been baked into the texture above.
        normalMapDef.scale = Math.abs(normalScale.x);
      }

      this.applyTextureTransform(normalMapDef, material.normalMap);
      materialDef.normalTexture = normalMapDef;
    }

    // occlusionTexture
    if (material.aoMap) {
      const occlusionMapDef: GLTFTextureInfo = {
        index: await this.processTextureAsync(material.aoMap),
        texCoord: material.aoMap.channel,
      };

      if (material.aoMapIntensity !== 1.0) {
        occlusionMapDef.strength = material.aoMapIntensity;
      }

      this.applyTextureTransform(occlusionMapDef, material.aoMap);
      materialDef.occlusionTexture = occlusionMapDef;
    }

    // alphaMode
    if (material.transparent) {
      materialDef.alphaMode = "BLEND";
    } else {
      if (material.alphaTest > 0.0) {
        materialDef.alphaMode = "MASK";
        materialDef.alphaCutoff = material.alphaTest;
      }
    }

    // doubleSided
    if (material.side === DoubleSide) materialDef.doubleSided = true;
    if (material.name !== "") materialDef.name = material.name;

    this.serializeUserData(material, materialDef);

    await this._invokeAllAsync((ext) => ext.writeMaterialAsync?.(material, materialDef));

    const index = json.materials.push(materialDef) - 1;
    cache.materials.set(cacheKey, index);
    return index;
  }

  /**
   * Process mesh
   * @param mesh Mesh to process.
   * @returns Index of the processed mesh.
   */
  async processMeshAsync(mesh: GLTFExportMesh): Promise<number | null> {
    const cache = this.cache;
    const json = this.json;

    const meshCacheKeyParts = [mesh.geometry.uuid];

    if (Array.isArray(mesh.material)) {
      for (let i = 0, l = mesh.material.length; i < l; i++) {
        meshCacheKeyParts.push(mesh.material[i].uuid);
      }
    } else {
      meshCacheKeyParts.push(mesh.material.uuid);
    }

    const meshCacheKey = meshCacheKeyParts.join(":");

    if (cache.meshes.has(meshCacheKey)) return cache.meshes.get(meshCacheKey)!;

    const geometry = mesh.geometry;

    let mode;

    // Use the correct mode
    if (mesh.isLineSegments) {
      mode = WEBGL_CONSTANTS.LINES;
    } else if (mesh.isLineLoop) {
      mode = WEBGL_CONSTANTS.LINE_LOOP;
    } else if (mesh.isLine) {
      mode = WEBGL_CONSTANTS.LINE_STRIP;
    } else if (mesh.isPoints) {
      mode = WEBGL_CONSTANTS.POINTS;
    } else {
      mode = (mesh.material as Material & { wireframe?: boolean }).wireframe
        ? WEBGL_CONSTANTS.LINES
        : WEBGL_CONSTANTS.TRIANGLES;
    }

    const meshDef: GLTFMeshDef = {};
    const attributes: Record<string, number | null> = {};
    const primitives: GLTFPrimitiveDef[] = [];
    const targets: Record<string, number | null>[] = [];

    // Conversion between attributes names in threejs and gltf spec
    const nameConversion: Record<string, string> = {
      uv: "TEXCOORD_0",
      uv1: "TEXCOORD_1",
      uv2: "TEXCOORD_2",
      uv3: "TEXCOORD_3",
      color: "COLOR_0",
      skinWeight: "WEIGHTS_0",
      skinIndex: "JOINTS_0",
    };

    const originalNormal = geometry.getAttribute("normal") as GLTFAttribute | undefined;
    let exportNormal = originalNormal;
    if (originalNormal !== undefined && !this.isNormalizedNormalAttribute(originalNormal)) {
      console.warn("THREE.GLTFExporter: Creating normalized normal attribute from the non-normalized one.");
      exportNormal = this.createNormalizedNormalAttribute(originalNormal);
    }

    // @QUESTION Detect if .vertexColors = true?
    // For every attribute create an accessor
    let modifiedAttribute: GLTFAttribute | null = null;

    for (let attributeName in geometry.attributes) {
      // Ignore morph target attributes, which are exported later.
      if (attributeName.slice(0, 5) === "morph") continue;

      const attribute =
        attributeName === "normal" ? exportNormal! : (geometry.attributes[attributeName] as GLTFAttribute);
      attributeName = nameConversion[attributeName] || attributeName.toUpperCase();

      // Prefix all geometry attributes except the ones specifically
      // listed in the spec; non-spec attributes are considered custom.
      const validVertexAttributes = /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+|COLOR_\d+|JOINTS_\d+|WEIGHTS_\d+)$/;

      if (!validVertexAttributes.test(attributeName) && !attributeName.startsWith("_"))
        attributeName = "_" + attributeName;

      if (cache.attributes.has(this.getUID(attribute))) {
        attributes[attributeName] = cache.attributes.get(this.getUID(attribute))!;
        continue;
      }

      // Enforce glTF vertex attribute requirements:
      // - JOINTS_0 must be UNSIGNED_BYTE or UNSIGNED_SHORT
      // - Only custom attributes may be INT or UNSIGNED_INT
      modifiedAttribute = null;
      const array = attribute.array;

      if (attributeName === "JOINTS_0" && !(array instanceof Uint16Array) && !(array instanceof Uint8Array)) {
        console.warn('GLTFExporter: Attribute "skinIndex" converted to type UNSIGNED_SHORT.');
        modifiedAttribute = GLTFExporter.Utils.toTypedBufferAttribute(attribute, Uint16Array);
      } else if ((array instanceof Uint32Array || array instanceof Int32Array) && !attributeName.startsWith("_")) {
        console.warn(`GLTFExporter: Attribute "${attributeName}" converted to type FLOAT.`);
        modifiedAttribute = GLTFExporter.Utils.toTypedBufferAttribute(attribute, Float32Array);
      }

      const accessor = this.processAccessor(modifiedAttribute || attribute, geometry);

      if (accessor !== null) {
        if (!attributeName.startsWith("_")) {
          this.detectMeshQuantization(attributeName, attribute);
        }

        attributes[attributeName] = accessor;
        cache.attributes.set(this.getUID(attribute), accessor);
      }
    }

    // Skip if no exportable attributes found
    if (Object.keys(attributes).length === 0) return null;

    // Morph targets
    if (mesh.morphTargetInfluences !== undefined && mesh.morphTargetInfluences.length > 0) {
      const weights: number[] = [];
      const targetNames: string[] = [];
      const reverseDictionary: Record<number, string> = {};

      if (mesh.morphTargetDictionary !== undefined) {
        for (const key in mesh.morphTargetDictionary) {
          reverseDictionary[mesh.morphTargetDictionary[key]] = key;
        }
      }

      for (let i = 0; i < mesh.morphTargetInfluences.length; ++i) {
        const target: Record<string, number | null> = {};
        let warned = false;

        for (const attributeName in geometry.morphAttributes) {
          // glTF 2.0 morph supports only POSITION/NORMAL/TANGENT.
          // Three.js doesn't support TANGENT yet.

          if (attributeName !== "position" && attributeName !== "normal") {
            if (!warned) {
              console.warn("GLTFExporter: Only POSITION and NORMAL morph are supported.");
              warned = true;
            }

            continue;
          }

          const attribute = (geometry.morphAttributes as Record<string, GLTFAttribute[]>)[attributeName][i];
          const gltfAttributeName = attributeName.toUpperCase();

          // Three.js morph attribute has absolute values while the one of glTF has relative values.
          //
          // glTF 2.0 Specification:
          // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#morph-targets

          const baseAttribute = geometry.attributes[attributeName] as GLTFAttribute;

          if (cache.attributes.has(this.getUID(attribute, true))) {
            target[gltfAttributeName] = cache.attributes.get(this.getUID(attribute, true))!;
            continue;
          }

          // Clones attribute not to override
          const relativeAttribute = attribute.clone() as GLTFAttribute;

          if (!geometry.morphTargetsRelative) {
            for (let j = 0, jl = attribute.count; j < jl; j++) {
              for (let a = 0; a < attribute.itemSize; a++) {
                if (a === 0) relativeAttribute.setX(j, attribute.getX(j) - baseAttribute.getX(j));
                if (a === 1) relativeAttribute.setY(j, attribute.getY(j) - baseAttribute.getY(j));
                if (a === 2) relativeAttribute.setZ(j, attribute.getZ(j) - baseAttribute.getZ(j));
                if (a === 3) relativeAttribute.setW(j, attribute.getW(j) - baseAttribute.getW(j));
              }
            }
          }

          target[gltfAttributeName] = this.processAccessor(relativeAttribute, geometry);
          cache.attributes.set(this.getUID(baseAttribute, true), target[gltfAttributeName]);
        }

        targets.push(target);

        weights.push(mesh.morphTargetInfluences[i]);

        if (mesh.morphTargetDictionary !== undefined) targetNames.push(reverseDictionary[i]);
      }

      meshDef.weights = weights;

      if (targetNames.length > 0) {
        meshDef.extras = { targetNames };
      }
    }

    const isMultiMaterial = Array.isArray(mesh.material);

    if (isMultiMaterial && geometry.groups.length === 0) return null;

    let didForceIndices = false;

    if (isMultiMaterial && geometry.index === null) {
      const indices: number[] = [];

      for (let i = 0, il = geometry.attributes.position.count; i < il; i++) {
        indices[i] = i;
      }

      geometry.setIndex(indices);

      didForceIndices = true;
    }

    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups: { materialIndex: number; start: number | undefined; count: number | undefined }[] = isMultiMaterial
      ? geometry.groups
      : [{ materialIndex: 0, start: undefined, count: undefined }];

    try {
      for (let i = 0, il = groups.length; i < il; i++) {
        const primitive: GLTFPrimitiveDef = {
          mode: mode,
          attributes: attributes,
        };

        this.serializeUserData(geometry, primitive);

        if (targets.length > 0) primitive.targets = targets;

        if (geometry.index !== null) {
          let cacheKey: number | string = this.getUID(geometry.index);

          if (groups[i].start !== undefined || groups[i].count !== undefined) {
            cacheKey = cacheKey + ":" + groups[i].start + ":" + groups[i].count;
          }

          if (cache.attributes.has(cacheKey)) {
            primitive.indices = cache.attributes.get(cacheKey)!;
          } else {
            primitive.indices = this.processAccessor(geometry.index, geometry, groups[i].start, groups[i].count);
            cache.attributes.set(cacheKey, primitive.indices);
          }

          if (primitive.indices === null) delete primitive.indices;
        }

        const material = await this.processMaterialAsync(materials[groups[i].materialIndex], geometry);

        if (material !== null) primitive.material = material;

        primitives.push(primitive);
      }
    } finally {
      if (didForceIndices) geometry.index = null;
    }

    meshDef.primitives = primitives;

    if (!json.meshes) json.meshes = [];

    await this._invokeAllAsync(function (ext) {
      return ext.writeMesh?.(mesh, meshDef);
    });

    const index = json.meshes.push(meshDef) - 1;
    cache.meshes.set(meshCacheKey, index);
    return index;
  }

  /**
   * If a vertex attribute with a
   * [non-standard data type](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview)
   * is used, it is checked whether it is a valid data type according to the
   * [KHR_mesh_quantization](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_mesh_quantization/README.md)
   * extension.
   * In this case the extension is automatically added to the list of used extensions.
   *
   */
  detectMeshQuantization(attributeName: string, attribute: GLTFAttribute): void {
    if (this.extensionsUsed[KHR_MESH_QUANTIZATION]) return;

    let attrType: string | undefined = undefined;

    switch (attribute.array.constructor) {
      case Int8Array:
        attrType = "byte";

        break;

      case Uint8Array:
        attrType = "unsigned byte";

        break;

      case Int16Array:
        attrType = "short";

        break;

      case Uint16Array:
        attrType = "unsigned short";

        break;

      default:
        return;
    }

    if (attribute.normalized) attrType += " normalized";

    const attrNamePrefix = attributeName.split("_", 1)[0];

    if ((KHR_mesh_quantization_ExtraAttrTypes as Record<string, string[]>)[attrNamePrefix]?.includes(attrType)) {
      this.extensionsUsed[KHR_MESH_QUANTIZATION] = true;
      this.extensionsRequired[KHR_MESH_QUANTIZATION] = true;
    }
  }

  /**
   * Process camera
   * @param camera Camera to process.
   * @returns Index of the processed camera.
   */
  processCamera(camera: GLTFExportCamera): number {
    const json = this.json;

    if (!json.cameras) json.cameras = [];

    const isOrtho = camera.isOrthographicCamera;
    const orthographic = camera as OrthographicCamera;
    const perspective = camera as PerspectiveCamera;

    const cameraDef: GLTFCameraDef = {
      type: isOrtho ? "orthographic" : "perspective",
    };

    if (isOrtho) {
      cameraDef.orthographic = {
        xmag: orthographic.right,
        ymag: orthographic.top,
        zfar: camera.far <= 0 ? 0.001 : camera.far,
        znear: camera.near < 0 ? 0 : camera.near,
      };
    } else {
      cameraDef.perspective = {
        aspectRatio: perspective.aspect,
        yfov: MathUtils.degToRad(perspective.fov),
        zfar: camera.far <= 0 ? 0.001 : camera.far,
        znear: camera.near < 0 ? 0 : camera.near,
      };
    }

    // Question: Is saving "type" as name intentional?
    if (camera.name !== "") cameraDef.name = camera.type;

    return json.cameras.push(cameraDef) - 1;
  }

  processAnimation(clip: AnimationClip, root: Object3D): number {
    const json = this.json;
    const nodeMap = this.nodeMap;

    if (!json.animations) json.animations = [];

    clip = GLTFExporter.Utils.mergeMorphTargetTracks(clip.clone(), root);

    const tracks = clip.tracks;
    const channels: GLTFAnimationDef["channels"] = [];
    const samplers: GLTFAnimationDef["samplers"] = [];

    for (let i = 0; i < tracks.length; ++i) {
      const track = tracks[i];
      const trackBinding = PropertyBinding.parseTrackName(track.name);
      let trackNode: Object3D | null | undefined = PropertyBinding.findNode(root, trackBinding.nodeName);
      const trackProperty = PATH_PROPERTIES[trackBinding.propertyName];

      if (trackBinding.objectName === "bones") {
        if (trackNode && (trackNode as SkinnedMesh).isSkinnedMesh === true) {
          trackNode = (trackNode as SkinnedMesh).skeleton.getBoneByName(trackBinding.objectIndex as string);
        } else {
          trackNode = undefined;
        }
      }

      if (!trackNode || !trackProperty) {
        console.warn('THREE.GLTFExporter: Could not export animation track "%s".', track.name);
        continue;
      }

      const inputItemSize = 1;
      let outputItemSize = track.values.length / track.times.length;

      if (trackProperty === PATH_PROPERTIES.morphTargetInfluences) {
        outputItemSize /= (trackNode as Mesh).morphTargetInfluences!.length;
      }

      let interpolation: string;

      // glTF cubic spline interpolants carry their own factory marker.
      if (track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline === true) {
        interpolation = "CUBICSPLINE";
        outputItemSize /= 3;
      } else if (track.getInterpolation() === InterpolateDiscrete) {
        interpolation = "STEP";
      } else {
        interpolation = "LINEAR";
      }

      samplers.push({
        input: this.processAccessor(
          new BufferAttribute(track.times as ConstructorParameters<typeof BufferAttribute>[0], inputItemSize),
        ),
        output: this.processAccessor(
          new BufferAttribute(track.values as ConstructorParameters<typeof BufferAttribute>[0], outputItemSize),
        ),
        interpolation: interpolation,
      });

      channels.push({
        sampler: samplers.length - 1,
        target: {
          node: nodeMap.get(trackNode),
          path: trackProperty,
        },
      });
    }

    const animationDef: GLTFAnimationDef = {
      name: clip.name || "clip_" + json.animations.length,
      samplers: samplers,
      channels: channels,
    };

    this.serializeUserData(clip, animationDef);
    json.animations.push(animationDef);
    return json.animations.length - 1;
  }

  processSkin(object: SkinnedMesh): number | null {
    const json = this.json;
    const nodeMap = this.nodeMap;
    const node = json.nodes![nodeMap.get(object)!];
    const skeleton = object.skeleton;

    if (skeleton === undefined) return null;

    const rootJoint = object.skeleton.bones[0];
    if (rootJoint === undefined) return null;

    const joints: (number | undefined)[] = [];
    const inverseBindMatrices = new Float32Array(skeleton.bones.length * 16);
    const temporaryBoneInverse = new Matrix4();

    for (let i = 0; i < skeleton.bones.length; ++i) {
      joints.push(nodeMap.get(skeleton.bones[i]));
      temporaryBoneInverse.copy(skeleton.boneInverses[i]);
      temporaryBoneInverse.multiply(object.bindMatrix).toArray(inverseBindMatrices, i * 16);
    }

    if (json.skins === undefined) json.skins = [];

    json.skins.push({
      inverseBindMatrices: this.processAccessor(new BufferAttribute(inverseBindMatrices, 16)),
      joints: joints,
      skeleton: nodeMap.get(rootJoint),
    });

    const skinIndex = (node.skin = json.skins.length - 1);
    return skinIndex;
  }

  async processNodeAsync(object: Object3D): Promise<number> {
    const json = this.json;
    const options = this.options;
    const nodeMap = this.nodeMap;
    const typedObject = object as GLTFNodeObject;

    if (!json.nodes) json.nodes = [];

    if (object.pivot !== null) {
      return await this._processNodeWithPivotAsync(object);
    }

    const nodeDef: GLTFNodeDef = {};

    if (options.trs) {
      const rotation = object.quaternion.toArray();
      const position = object.position.toArray();
      const scale = object.scale.toArray();

      if (!equalArray(rotation, [0, 0, 0, 1])) nodeDef.rotation = rotation;
      if (!equalArray(position, [0, 0, 0])) nodeDef.translation = position;
      if (!equalArray(scale, [1, 1, 1])) nodeDef.scale = scale;
    } else {
      if (object.matrixAutoUpdate) object.updateMatrix();
      if (isIdentityMatrix(object.matrix) === false) nodeDef.matrix = object.matrix.elements;
    }

    if (object.name !== "") nodeDef.name = String(object.name);
    this.serializeUserData(object, nodeDef);

    if (typedObject.isMesh || typedObject.isLine || typedObject.isPoints) {
      const meshIndex = await this.processMeshAsync(object as GLTFExportMesh);
      if (meshIndex !== null) nodeDef.mesh = meshIndex;
    } else if (typedObject.isCamera) {
      nodeDef.camera = this.processCamera(object as GLTFExportCamera);
    }

    if (typedObject.isSkinnedMesh) this.skins.push(object as SkinnedMesh);

    const nodeIndex = json.nodes.push(nodeDef) - 1;
    nodeMap.set(object, nodeIndex);

    if (object.children.length > 0) {
      const children: number[] = [];

      for (let i = 0, l = object.children.length; i < l; i++) {
        const child = object.children[i];

        if (child.visible || options.onlyVisible === false) {
          const childNodeIndex = await this.processNodeAsync(child);
          if (childNodeIndex !== null) children.push(childNodeIndex);
        }
      }

      if (children.length > 0) nodeDef.children = children;
    }

    await this._invokeAllAsync(function (ext) {
      return ext.writeNode && ext.writeNode(object, nodeDef);
    });

    return nodeIndex;
  }

  async _processNodeWithPivotAsync(object: Object3D): Promise<number> {
    const json = this.json;
    const options = this.options;
    const nodeMap = this.nodeMap;
    const pivot = object.pivot!;
    const containerDef: GLTFNodeDef = {};

    const rotation = object.quaternion.toArray();
    const position = [object.position.x + pivot.x, object.position.y + pivot.y, object.position.z + pivot.z];
    const scale = object.scale.toArray();

    if (!equalArray(rotation, [0, 0, 0, 1])) containerDef.rotation = rotation;
    if (!equalArray(position, [0, 0, 0])) containerDef.translation = position;
    if (!equalArray(scale, [1, 1, 1])) containerDef.scale = scale;

    containerDef.extras = { pivot: pivot.toArray() };
    if (object.name !== "") containerDef.name = String(object.name);
    this.serializeUserData(object, containerDef);

    const containerIndex = json.nodes!.push(containerDef) - 1;
    nodeMap.set(object, containerIndex);

    const childDef: GLTFNodeDef = {};
    const childPosition = [-pivot.x, -pivot.y, -pivot.z];
    if (!equalArray(childPosition, [0, 0, 0])) childDef.translation = childPosition;

    const flags = object as Object3D & {
      isMesh?: boolean;
      isLine?: boolean;
      isPoints?: boolean;
      isCamera?: boolean;
      isSkinnedMesh?: boolean;
    };
    if (flags.isMesh || flags.isLine || flags.isPoints) {
      const meshIndex = await this.processMeshAsync(object as GLTFExportMesh);
      if (meshIndex !== null) childDef.mesh = meshIndex;
    } else if (flags.isCamera) {
      childDef.camera = this.processCamera(object as GLTFExportCamera);
    }

    if (flags.isSkinnedMesh) this.skins.push(object as SkinnedMesh);

    const childIndex = json.nodes!.push(childDef) - 1;
    const containerChildren = [childIndex];

    if (object.children.length > 0) {
      const grandchildren: number[] = [];
      for (let i = 0, l = object.children.length; i < l; i++) {
        const child = object.children[i];
        if (child.visible || options.onlyVisible === false) {
          const childNodeIndex = await this.processNodeAsync(child);
          if (childNodeIndex !== null) grandchildren.push(childNodeIndex);
        }
      }

      if (grandchildren.length > 0) childDef.children = grandchildren;
    }

    containerDef.children = containerChildren;
    await this._invokeAllAsync(function (ext) {
      return ext.writeNode?.(object, containerDef);
    });
    return containerIndex;
  }

  async processSceneAsync(scene: Scene): Promise<void> {
    const json = this.json;
    const options = this.options;

    if (!json.scenes) {
      json.scenes = [];
      json.scene = 0;
    }

    const sceneDef: GLTFSceneDef = {};
    if (scene.name !== "") sceneDef.name = scene.name;
    json.scenes.push(sceneDef);

    const nodes: number[] = [];
    for (let i = 0, l = scene.children.length; i < l; i++) {
      const child = scene.children[i];
      if (child.visible || options.onlyVisible === false) {
        const nodeIndex = await this.processNodeAsync(child);
        if (nodeIndex !== null) nodes.push(nodeIndex);
      }
    }

    if (nodes.length > 0) sceneDef.nodes = nodes;
    this.serializeUserData(scene, sceneDef);
  }

  async processObjectsAsync(objects: Object3D[]): Promise<void> {
    const scene = new Scene();
    scene.name = "AuxScene";

    for (let i = 0; i < objects.length; i++) {
      // Avoid changing the objects' original parents.
      scene.children.push(objects[i]);
    }

    await this.processSceneAsync(scene);
  }

  async processInputAsync(input: Object3D | Object3D[]): Promise<void> {
    const options = this.options;
    const inputs = input instanceof Array ? input : [input];

    await this._invokeAllAsync(function (ext) {
      return ext.beforeParse?.(inputs);
    });

    const objectsWithoutScene: Object3D[] = [];
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i] instanceof Scene) {
        await this.processSceneAsync(inputs[i] as Scene);
      } else {
        objectsWithoutScene.push(inputs[i]);
      }
    }

    if (objectsWithoutScene.length > 0) await this.processObjectsAsync(objectsWithoutScene);

    for (let i = 0; i < this.skins.length; ++i) this.processSkin(this.skins[i]);

    if (inputs.length === 1) {
      const animations = options.animations as AnimationClip[];
      for (let i = 0; i < animations.length; ++i) this.processAnimation(animations[i], inputs[0]);
    } else {
      const animationGroups = options.animations as AnimationClip[][];
      for (let i = 0; i < inputs.length; i++) {
        const animations = animationGroups[i] || [];
        for (let j = 0; j < animations.length; ++j) this.processAnimation(animations[j], inputs[i]);
      }
    }

    await this._invokeAllAsync(function (ext) {
      return ext.afterParse?.(inputs);
    });
  }

  async _invokeAllAsync(func: (ext: GLTFExporterPlugin) => void | Promise<void>): Promise<void> {
    for (let i = 0, il = this.plugins.length; i < il; i++) {
      await func(this.plugins[i]);
    }
  }
}

type GLTFLightDef = {
  name?: string;
  color?: number[];
  intensity?: number;
  type?: string;
  range?: number;
  spot?: { innerConeAngle?: number; outerConeAngle?: number };
};

/**
 * Punctual Lights Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual
 *
 * @private
 */
export class GLTFLightExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_lights_punctual";
  }

  writeNode(object: Object3D, nodeDef: GLTFNodeDef): void {
    const light = object as DirectionalLight & PointLight & SpotLight;

    if (!light.isLight) return;

    if (!light.isDirectionalLight && !light.isPointLight && !light.isSpotLight) {
      console.warn("THREE.GLTFExporter: Only directional, point, and spot lights are supported.", light);
      return;
    }

    const writer = this.writer;
    const json = writer.json;
    const extensionsUsed = writer.extensionsUsed;

    const lightDef: GLTFLightDef = {};

    if (light.name) lightDef.name = light.name;

    lightDef.color = light.color.toArray();

    lightDef.intensity = light.intensity;

    if (light.isDirectionalLight) {
      lightDef.type = "directional";
    } else if (light.isPointLight) {
      lightDef.type = "point";

      if (light.distance > 0) lightDef.range = light.distance;
    } else if (light.isSpotLight) {
      lightDef.type = "spot";

      if (light.distance > 0) lightDef.range = light.distance;

      lightDef.spot = {};
      lightDef.spot.innerConeAngle = (1.0 - light.penumbra) * light.angle;
      lightDef.spot.outerConeAngle = light.angle;
    }

    if (light.decay !== undefined && light.decay !== 2) {
      console.warn(
        "THREE.GLTFExporter: Light decay may be lost. glTF is physically-based, " + "and expects light.decay=2.",
      );
    }

    if (
      light.target &&
      (light.target.parent !== light ||
        light.target.position.x !== 0 ||
        light.target.position.y !== 0 ||
        light.target.position.z !== -1)
    ) {
      console.warn(
        "THREE.GLTFExporter: Light direction may be lost. For best results, " +
          "make light.target a child of the light with position 0,0,-1.",
      );
    }

    if (!extensionsUsed[this.name]) {
      json.extensions = json.extensions || {};
      json.extensions[this.name] = { lights: [] };
      extensionsUsed[this.name] = true;
    }

    const lightExtension = json.extensions![this.name] as { lights: GLTFLightDef[] };
    const lights = lightExtension.lights;
    lights.push(lightDef);

    nodeDef.extensions = nodeDef.extensions || {};
    nodeDef.extensions[this.name] = { light: lights.length - 1 };
  }
}

/**
 * Unlit Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
 *
 * @private
 */
export class GLTFMaterialsUnlitExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_unlit";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshBasicMaterial) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = {};

    extensionsUsed[this.name] = true;

    materialDef.pbrMetallicRoughness.metallicFactor = 0.0;
    materialDef.pbrMetallicRoughness.roughnessFactor = 0.9;
  }
}

/**
 * Clearcoat Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_clearcoat
 *
 * @private
 */
export class GLTFMaterialsClearcoatExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_clearcoat";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshPhysicalMaterial || material.clearcoat === 0) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    extensionDef.clearcoatFactor = material.clearcoat;

    if (material.clearcoatMap) {
      const clearcoatMapDef = {
        index: await writer.processTextureAsync(material.clearcoatMap),
        texCoord: material.clearcoatMap.channel,
      };
      writer.applyTextureTransform(clearcoatMapDef, material.clearcoatMap);
      extensionDef.clearcoatTexture = clearcoatMapDef;
    }

    extensionDef.clearcoatRoughnessFactor = material.clearcoatRoughness;

    if (material.clearcoatRoughnessMap) {
      const clearcoatRoughnessMapDef = {
        index: await writer.processTextureAsync(material.clearcoatRoughnessMap),
        texCoord: material.clearcoatRoughnessMap.channel,
      };
      writer.applyTextureTransform(clearcoatRoughnessMapDef, material.clearcoatRoughnessMap);
      extensionDef.clearcoatRoughnessTexture = clearcoatRoughnessMapDef;
    }

    if (material.clearcoatNormalMap) {
      const clearcoatNormalMapDef: GLTFTextureInfo = {
        index: await writer.processTextureAsync(material.clearcoatNormalMap),
        texCoord: material.clearcoatNormalMap.channel,
      };

      if (material.clearcoatNormalScale.x !== 1) clearcoatNormalMapDef.scale = material.clearcoatNormalScale.x;

      writer.applyTextureTransform(clearcoatNormalMapDef, material.clearcoatNormalMap);
      extensionDef.clearcoatNormalTexture = clearcoatNormalMapDef;
    }

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Materials dispersion Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_dispersion
 *
 * @private
 */
export class GLTFMaterialsDispersionExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_dispersion";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshPhysicalMaterial || material.dispersion === 0) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    extensionDef.dispersion = material.dispersion;

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Iridescence Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_iridescence
 *
 * @private
 */
export class GLTFMaterialsIridescenceExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_iridescence";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshPhysicalMaterial || material.iridescence === 0) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    extensionDef.iridescenceFactor = material.iridescence;

    if (material.iridescenceMap) {
      const iridescenceMapDef = {
        index: await writer.processTextureAsync(material.iridescenceMap),
        texCoord: material.iridescenceMap.channel,
      };
      writer.applyTextureTransform(iridescenceMapDef, material.iridescenceMap);
      extensionDef.iridescenceTexture = iridescenceMapDef;
    }

    extensionDef.iridescenceIor = material.iridescenceIOR;
    extensionDef.iridescenceThicknessMinimum = material.iridescenceThicknessMinimum;
    extensionDef.iridescenceThicknessMaximum = material.iridescenceThicknessMaximum;

    if (material.iridescenceThicknessMap) {
      const iridescenceThicknessMapDef = {
        index: await writer.processTextureAsync(material.iridescenceThicknessMap),
        texCoord: material.iridescenceThicknessMap.channel,
      };
      writer.applyTextureTransform(iridescenceThicknessMapDef, material.iridescenceThicknessMap);
      extensionDef.iridescenceThicknessTexture = iridescenceThicknessMapDef;
    }

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Transmission Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
 *
 * @private
 */
export class GLTFMaterialsTransmissionExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_transmission";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshPhysicalMaterial || material.transmission === 0) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    extensionDef.transmissionFactor = material.transmission;

    if (material.transmissionMap) {
      const transmissionMapDef = {
        index: await writer.processTextureAsync(material.transmissionMap),
        texCoord: material.transmissionMap.channel,
      };
      writer.applyTextureTransform(transmissionMapDef, material.transmissionMap);
      extensionDef.transmissionTexture = transmissionMapDef;
    }

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Materials Volume Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_volume
 *
 * @private
 */
export class GLTFMaterialsVolumeExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_volume";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshPhysicalMaterial || material.transmission === 0) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    extensionDef.thicknessFactor = material.thickness;

    if (material.thicknessMap) {
      const thicknessMapDef = {
        index: await writer.processTextureAsync(material.thicknessMap),
        texCoord: material.thicknessMap.channel,
      };
      writer.applyTextureTransform(thicknessMapDef, material.thicknessMap);
      extensionDef.thicknessTexture = thicknessMapDef;
    }

    if (material.attenuationDistance !== Infinity) {
      extensionDef.attenuationDistance = material.attenuationDistance;
    }

    extensionDef.attenuationColor = material.attenuationColor.toArray();

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Materials ior Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_ior
 *
 * @private
 */
export class GLTFMaterialsIorExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_ior";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshPhysicalMaterial || material.ior === 1.5) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    extensionDef.ior = material.ior;

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Materials specular Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_specular
 *
 * @private
 */
export class GLTFMaterialsSpecularExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_specular";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (
      !material.isMeshPhysicalMaterial ||
      (material.specularIntensity === 1.0 &&
        material.specularColor.equals(DEFAULT_SPECULAR_COLOR) &&
        !material.specularIntensityMap &&
        !material.specularColorMap)
    )
      return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    if (material.specularIntensityMap) {
      const specularIntensityMapDef = {
        index: await writer.processTextureAsync(material.specularIntensityMap),
        texCoord: material.specularIntensityMap.channel,
      };
      writer.applyTextureTransform(specularIntensityMapDef, material.specularIntensityMap);
      extensionDef.specularTexture = specularIntensityMapDef;
    }

    if (material.specularColorMap) {
      const specularColorMapDef = {
        index: await writer.processTextureAsync(material.specularColorMap),
        texCoord: material.specularColorMap.channel,
      };
      writer.applyTextureTransform(specularColorMapDef, material.specularColorMap);
      extensionDef.specularColorTexture = specularColorMapDef;
    }

    extensionDef.specularFactor = material.specularIntensity;
    extensionDef.specularColorFactor = material.specularColor.toArray();

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Sheen Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen
 *
 * @private
 */
export class GLTFMaterialsSheenExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_sheen";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshPhysicalMaterial || material.sheen == 0.0) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    if (material.sheenRoughnessMap) {
      const sheenRoughnessMapDef = {
        index: await writer.processTextureAsync(material.sheenRoughnessMap),
        texCoord: material.sheenRoughnessMap.channel,
      };
      writer.applyTextureTransform(sheenRoughnessMapDef, material.sheenRoughnessMap);
      extensionDef.sheenRoughnessTexture = sheenRoughnessMapDef;
    }

    if (material.sheenColorMap) {
      const sheenColorMapDef = {
        index: await writer.processTextureAsync(material.sheenColorMap),
        texCoord: material.sheenColorMap.channel,
      };
      writer.applyTextureTransform(sheenColorMapDef, material.sheenColorMap);
      extensionDef.sheenColorTexture = sheenColorMapDef;
    }

    extensionDef.sheenRoughnessFactor = material.sheenRoughness;
    extensionDef.sheenColorFactor = material.sheenColor.toArray();

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Anisotropy Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_anisotropy
 *
 * @private
 */
export class GLTFMaterialsAnisotropyExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_anisotropy";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshPhysicalMaterial || material.anisotropy == 0.0) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    if (material.anisotropyMap) {
      const anisotropyMapDef = { index: await writer.processTextureAsync(material.anisotropyMap) };
      writer.applyTextureTransform(anisotropyMapDef, material.anisotropyMap);
      extensionDef.anisotropyTexture = anisotropyMapDef;
    }

    extensionDef.anisotropyStrength = material.anisotropy;
    extensionDef.anisotropyRotation = material.anisotropyRotation;

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Materials Emissive Strength Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/blob/5768b3ce0ef32bc39cdf1bef10b948586635ead3/extensions/2.0/Khronos/KHR_materials_emissive_strength/README.md
 *
 * @private
 */
export class GLTFMaterialsEmissiveStrengthExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "KHR_materials_emissive_strength";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshStandardMaterial || material.emissiveIntensity === 1.0) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    extensionDef.emissiveStrength = material.emissiveIntensity;

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * Materials bump Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/EXT_materials_bump
 *
 * @private
 */
export class GLTFMaterialsBumpExtension {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "EXT_materials_bump";
  }

  async writeMaterialAsync(source: Material, materialDef: GLTFMaterialDef): Promise<void> {
    const material = source as MeshPhysicalMaterial & MeshBasicMaterial;

    if (!material.isMeshStandardMaterial || (material.bumpScale === 1 && !material.bumpMap)) return;

    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;

    const extensionDef: Record<string, number | number[] | GLTFTextureInfo> = {};

    if (material.bumpMap) {
      const bumpMapDef = {
        index: await writer.processTextureAsync(material.bumpMap),
        texCoord: material.bumpMap.channel,
      };
      writer.applyTextureTransform(bumpMapDef, material.bumpMap);
      extensionDef.bumpTexture = bumpMapDef;
    }

    extensionDef.bumpFactor = material.bumpScale;

    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;

    extensionsUsed[this.name] = true;
  }
}

/**
 * GPU Instancing Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
 *
 * @private
 */
export class GLTFMeshGpuInstancing {
  readonly writer: GLTFWriter;
  readonly name: string;

  constructor(writer: GLTFWriter) {
    this.writer = writer;
    this.name = "EXT_mesh_gpu_instancing";
  }

  writeNode(object: Object3D, nodeDef: GLTFNodeDef): void {
    if (!(object as InstancedMesh).isInstancedMesh) return;

    const writer = this.writer;

    const mesh = object as InstancedMesh;

    const translationAttr = new Float32Array(mesh.count * 3);
    const rotationAttr = new Float32Array(mesh.count * 4);
    const scaleAttr = new Float32Array(mesh.count * 3);

    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();

    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);

      position.toArray(translationAttr, i * 3);
      quaternion.toArray(rotationAttr as unknown as number[], i * 4);
      scale.toArray(scaleAttr, i * 3);
    }

    const attributes: Record<string, number | null> = {
      TRANSLATION: writer.processAccessor(new BufferAttribute(translationAttr, 3)),
      ROTATION: writer.processAccessor(new BufferAttribute(rotationAttr, 4)),
      SCALE: writer.processAccessor(new BufferAttribute(scaleAttr, 3)),
    };

    if (mesh.instanceColor) attributes._COLOR_0 = writer.processAccessor(mesh.instanceColor);

    nodeDef.extensions = nodeDef.extensions || {};
    nodeDef.extensions[this.name] = { attributes };

    writer.extensionsUsed[this.name] = true;
    writer.extensionsRequired[this.name] = true;
  }
}

/**
 * Static utility functions
 *
 * @private
 */
export const GLTFExporterUtils = {
  insertKeyframe: function (track: KeyframeTrack, time: number): number | undefined {
    const tolerance = 0.001; // 1ms
    const valueSize = track.getValueSize();

    const times = new (track.TimeBufferType as unknown as Float32ArrayConstructor)(track.times.length + 1);
    const values = new (track.ValueBufferType as unknown as Float32ArrayConstructor)(track.values.length + valueSize);
    const interpolant = track.createInterpolant(
      new (track.ValueBufferType as unknown as Float32ArrayConstructor)(valueSize),
    );

    let index;

    if (track.times.length === 0) {
      times[0] = time;

      for (let i = 0; i < valueSize; i++) {
        values[i] = 0;
      }

      index = 0;
    } else if (time < track.times[0]) {
      if (Math.abs(track.times[0] - time) < tolerance) return 0;

      times[0] = time;
      times.set(track.times as ArrayLike<number>, 1);

      values.set(interpolant.evaluate(time) as ArrayLike<number>, 0);
      values.set(track.values as ArrayLike<number>, valueSize);

      index = 0;
    } else if (time > track.times[track.times.length - 1]) {
      if (Math.abs(track.times[track.times.length - 1] - time) < tolerance) {
        return track.times.length - 1;
      }

      times[times.length - 1] = time;
      times.set(track.times as ArrayLike<number>, 0);

      values.set(track.values as ArrayLike<number>, 0);
      values.set(interpolant.evaluate(time) as ArrayLike<number>, track.values.length);

      index = times.length - 1;
    } else {
      for (let i = 0; i < track.times.length; i++) {
        if (Math.abs(track.times[i] - time) < tolerance) return i;

        if (track.times[i] < time && track.times[i + 1] > time) {
          times.set(
            (track.times as ArrayLike<number> & { slice(start: number, end?: number): ArrayLike<number> }).slice(
              0,
              i + 1,
            ),
            0,
          );
          times[i + 1] = time;
          times.set(
            (track.times as ArrayLike<number> & { slice(start: number, end?: number): ArrayLike<number> }).slice(i + 1),
            i + 2,
          );

          values.set(
            (track.values as ArrayLike<number> & { slice(start: number, end?: number): ArrayLike<number> }).slice(
              0,
              (i + 1) * valueSize,
            ),
            0,
          );
          values.set(interpolant.evaluate(time) as ArrayLike<number>, (i + 1) * valueSize);
          values.set(
            (track.values as ArrayLike<number> & { slice(start: number, end?: number): ArrayLike<number> }).slice(
              (i + 1) * valueSize,
            ),
            (i + 2) * valueSize,
          );

          index = i + 1;

          break;
        }
      }
    }

    track.times = times;
    track.values = values;

    return index;
  },

  mergeMorphTargetTracks: function (clip: AnimationClip, root: Object3D): AnimationClip {
    const tracks: KeyframeTrack[] = [];
    const mergedTracks: Record<string, KeyframeTrack> = {};
    const sourceTracks = clip.tracks;

    for (let i = 0; i < sourceTracks.length; ++i) {
      let sourceTrack = sourceTracks[i];
      const sourceTrackBinding = PropertyBinding.parseTrackName(sourceTrack.name);
      const sourceTrackNode = PropertyBinding.findNode(root, sourceTrackBinding.nodeName) as Mesh;

      if (
        sourceTrackBinding.propertyName !== "morphTargetInfluences" ||
        sourceTrackBinding.propertyIndex === undefined
      ) {
        // Tracks that don't affect morph targets, or that affect all morph targets together, can be left as-is.
        tracks.push(sourceTrack);
        continue;
      }

      if (
        sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodDiscrete &&
        sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodLinear
      ) {
        if (sourceTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) {
          // This should never happen, because glTF morph target animations
          // affect all targets already.
          throw new Error("THREE.GLTFExporter: Cannot merge tracks with glTF CUBICSPLINE interpolation.");
        }

        console.warn("THREE.GLTFExporter: Morph target interpolation mode not yet supported. Using LINEAR instead.");

        sourceTrack = sourceTrack.clone();
        sourceTrack.setInterpolation(InterpolateLinear);
      }

      const targetCount = sourceTrackNode.morphTargetInfluences!.length;
      const targetIndex = sourceTrackNode.morphTargetDictionary![sourceTrackBinding.propertyIndex];

      if (targetIndex === undefined) {
        throw new Error("THREE.GLTFExporter: Morph target name not found: " + sourceTrackBinding.propertyIndex);
      }

      let mergedTrack;

      // If this is the first time we've seen this object, create a new
      // track to store merged keyframe data for each morph target.
      if (mergedTracks[sourceTrackNode.uuid] === undefined) {
        mergedTrack = sourceTrack.clone();

        const values = new (mergedTrack.ValueBufferType as unknown as Float32ArrayConstructor)(
          targetCount * mergedTrack.times.length,
        );

        for (let j = 0; j < mergedTrack.times.length; j++) {
          values[j * targetCount + targetIndex] = mergedTrack.values[j] as number;
        }

        // We need to take into consideration the intended target node
        // of our original un-merged morphTarget animation.
        mergedTrack.name = (sourceTrackBinding.nodeName || "") + ".morphTargetInfluences";
        mergedTrack.values = values;

        mergedTracks[sourceTrackNode.uuid] = mergedTrack;
        tracks.push(mergedTrack);

        continue;
      }

      const sourceInterpolant = sourceTrack.createInterpolant(
        new (sourceTrack.ValueBufferType as unknown as Float32ArrayConstructor)(1),
      );

      mergedTrack = mergedTracks[sourceTrackNode.uuid];

      // For every existing keyframe of the merged track, write a (possibly
      // interpolated) value from the source track.
      for (let j = 0; j < mergedTrack.times.length; j++) {
        (mergedTrack.values as Float32Array)[j * targetCount + targetIndex] = sourceInterpolant.evaluate(
          mergedTrack.times[j],
        ) as unknown as number;
      }

      // For every existing keyframe of the source track, write a (possibly
      // new) keyframe to the merged track. Values from the previous loop may
      // be written again, but keyframes are de-duplicated.
      for (let j = 0; j < sourceTrack.times.length; j++) {
        const keyframeIndex = this.insertKeyframe(mergedTrack, sourceTrack.times[j]);
        (mergedTrack.values as Float32Array)[keyframeIndex! * targetCount + targetIndex] = sourceTrack.values[
          j
        ] as number;
      }
    }

    clip.tracks = tracks;

    return clip;
  },

  toTypedBufferAttribute: function (
    srcAttribute: BufferAttribute | InterleavedBufferAttribute,
    TypedArray: { new (length: number): BufferAttribute["array"] },
  ): BufferAttribute {
    const dstAttribute = new BufferAttribute(
      new TypedArray(srcAttribute.count * srcAttribute.itemSize),
      srcAttribute.itemSize,
      false,
    );

    if (
      !srcAttribute.normalized &&
      !("isInterleavedBufferAttribute" in srcAttribute && srcAttribute.isInterleavedBufferAttribute)
    ) {
      dstAttribute.array.set(srcAttribute.array);

      return dstAttribute;
    }

    for (let i = 0, il = srcAttribute.count; i < il; i++) {
      for (let j = 0; j < srcAttribute.itemSize; j++) {
        dstAttribute.setComponent(i, j, srcAttribute.getComponent(i, j));
      }
    }

    return dstAttribute;
  },
};

export class GLTFExporter {
  static Utils: typeof GLTFExporterUtils = GLTFExporterUtils;
  textureUtils: GLTFTextureUtils | null = null;
  pluginCallbacks: ((writer: GLTFWriter) => GLTFExporterPlugin)[] = [];

  constructor() {
    this.register((writer) => new GLTFLightExtension(writer));
    this.register((writer) => new GLTFMaterialsUnlitExtension(writer));
    this.register((writer) => new GLTFMaterialsTransmissionExtension(writer));
    this.register((writer) => new GLTFMaterialsVolumeExtension(writer));
    this.register((writer) => new GLTFMaterialsIorExtension(writer));
    this.register((writer) => new GLTFMaterialsSpecularExtension(writer));
    this.register((writer) => new GLTFMaterialsClearcoatExtension(writer));
    this.register((writer) => new GLTFMaterialsDispersionExtension(writer));
    this.register((writer) => new GLTFMaterialsIridescenceExtension(writer));
    this.register((writer) => new GLTFMaterialsSheenExtension(writer));
    this.register((writer) => new GLTFMaterialsAnisotropyExtension(writer));
    this.register((writer) => new GLTFMaterialsEmissiveStrengthExtension(writer));
    this.register((writer) => new GLTFMaterialsBumpExtension(writer));
    this.register((writer) => new GLTFMeshGpuInstancing(writer));
  }

  register(callback: (writer: GLTFWriter) => GLTFExporterPlugin): this {
    if (!this.pluginCallbacks.includes(callback)) this.pluginCallbacks.push(callback);
    return this;
  }

  unregister(callback: (writer: GLTFWriter) => GLTFExporterPlugin): this {
    const index = this.pluginCallbacks.indexOf(callback);
    if (index !== -1) this.pluginCallbacks.splice(index, 1);
    return this;
  }

  setTextureUtils(utils: GLTFTextureUtils): this {
    this.textureUtils = utils;
    return this;
  }

  parse(
    input: Object3D | Object3D[],
    onDone: (result: GLTFDocument | ArrayBuffer) => void,
    onError?: ((error: unknown) => void) | null,
    options: GLTFWriterOptions = {},
  ): void {
    const run = async (): Promise<void> => {
      const writer = new GLTFWriter();
      writer.setPlugins(this.pluginCallbacks.map((callback) => callback(writer)));
      writer.setTextureUtils(this.textureUtils);
      await writer.writeAsync(input, onDone, options);
    };
    void run().catch(onError ?? undefined);
  }

  parseAsync(input: Object3D | Object3D[], options: GLTFWriterOptions = {}): Promise<GLTFDocument | ArrayBuffer> {
    return new Promise((resolve, reject) => this.parse(input, resolve, reject, options));
  }
}
