import { AnimationClip } from "../../animation/AnimationClip";
import type { KeyframeTrack } from "../../animation/KeyframeTrack";
import { PropertyBinding } from "../../animation/PropertyBinding";
import { NumberKeyframeTrack } from "../../animation/tracks/NumberKeyframeTrack";
import { QuaternionKeyframeTrack } from "../../animation/tracks/QuaternionKeyframeTrack";
import { VectorKeyframeTrack } from "../../animation/tracks/VectorKeyframeTrack";
import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { Wrapping, Mapping, ColorSpace } from "../../constants";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Float32BufferAttribute, Uint16BufferAttribute } from "../../core/BufferAttribute";
import { Object3D } from "../../core/Object3D";
import { ShapeUtils } from "../../extras/ShapeUtils";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { LoaderUtils } from "../../loaders/LoaderUtils";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { TextureLoader } from "../../loaders/TextureLoader";
import { AmbientLight } from "../../lights/AmbientLight";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLight } from "../../lights/PointLight";
import { SpotLight } from "../../lights/SpotLight";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { MeshLambertMaterial } from "../../materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import { Color } from "../../math/Color";
import { ColorManagement } from "../../math/ColorManagement";
import { Euler } from "../../math/Euler";
import { Matrix3 } from "../../math/Matrix3";
import { Matrix4 } from "../../math/Matrix4";
import { degToRad } from "../../math/MathUtils";
import { Quaternion } from "../../math/Quaternion";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { Bone } from "../../objects/Bone";
import { Group } from "../../objects/Group";
import { Line } from "../../objects/Line";
import { Mesh } from "../../objects/Mesh";
import { Skeleton } from "../../objects/Skeleton";
import { SkinnedMesh } from "../../objects/SkinnedMesh";
import { Texture } from "../../textures/Texture";
import { NURBSCurve } from "../curves/NURBSCurve";

/** Structural zlib runtime the binary parser needs for compressed array properties. */
export interface FBXZlibRuntime {
  unzlibSync(data: Uint8Array): Uint8Array;
}

/** A decoded scalar FBX property value. */
export type FBXScalar = boolean | number | string;

/** A `Properties70` record: `P: "Name", "type", "type2", "flag", value`. */
export interface FBXPropertyRecord {
  type: string;
  type2: FBXScalar;
  flag: FBXScalar;
  value: FBXScalar | ArrayBufferLike | number[] | boolean[];
}

/** A property whose `value` the format defines as one number (factors, angles, enums). */
export interface FBXNumberProperty extends FBXPropertyRecord {
  value: number;
}

/** A property whose `value` the format defines as a number vector (colors, transforms). */
export interface FBXVectorProperty extends FBXPropertyRecord {
  value: number[];
}

/** A decoded binary property value. */
export type FBXValue = FBXScalar | ArrayBufferLike | boolean[] | number[];

/**
 * Shared fields of every parsed FBX node. Per-node interfaces below add the documented keys;
 * readers never index a node by a computed name.
 */
export interface FBXNode {
  id?: number | string;
  name?: string;
  attrName?: string;
  attrType?: string;
}

/** Any value a builder stores under a key discovered in the file. */
type FBXStoredValue = FBXValue | FBXPropertyRecord | FBXDynamicNode | FBXStoredValue[] | undefined;

/**
 * Node shape while the parsers build a tree: both write keys discovered in the file, so this
 * internal type carries the index signature readers never see. `id`, `attrName` and `attrType`
 * stay narrow to match the documented node header.
 */
interface FBXDynamicNode {
  id?: number | string;
  name?: string;
  attrName?: string;
  attrType?: string;
  PoseNode?: FBXDynamicNode[] | FBXDynamicNode;
  a?: number[] | string;
  propertyList?: FBXValue[];
  connections?: FBXStoredValue[][];
  singleProperty?: boolean;
  [key: string]: FBXStoredValue;
}

/** The dynamic node a binary reader returns; `propertyList` is always present. */
interface FBXBinaryNode extends FBXDynamicNode {
  name: string;
  propertyList: FBXValue[];
}

/** A node holding one buffered array in `a`, e.g. `Vertices: *12 { a: ... }`. */
export interface FBXArrayNode extends FBXNode {
  a: number[];
}

/** The `Connections` node, whose `connections` list is `[fromID, toID, relationship?]`. */
export interface FBXConnectionsNode extends FBXNode {
  connections: [number, number, string?][];
}

/** `GlobalSettings` properties the loader reads. */
export interface FBXGlobalSettings extends FBXNode {
  AmbientColor?: FBXVectorProperty;
  UnitScaleFactor?: FBXNumberProperty;
  UpAxis?: FBXNumberProperty;
}

/** `Objects.Model` node, which describes an object transform and its type. */
export interface FBXModelNode extends FBXNode {
  id: number;
  attrName?: string;
  attrType: string;
  InheritType?: FBXNumberProperty;
  RotationOrder?: FBXNumberProperty;
  Lcl_Translation?: FBXVectorProperty;
  Lcl_Rotation?: FBXVectorProperty;
  Lcl_Scaling?: FBXVectorProperty;
  PreRotation?: FBXVectorProperty;
  PostRotation?: FBXVectorProperty;
  GeometricTranslation?: FBXVectorProperty;
  GeometricRotation?: FBXVectorProperty;
  GeometricScaling?: FBXVectorProperty;
  RotationOffset?: FBXVectorProperty;
  RotationPivot?: FBXVectorProperty;
  ScalingOffset?: FBXVectorProperty;
  ScalingPivot?: FBXVectorProperty;
  LookAtProperty?: FBXPropertyRecord;
}

/** `Objects.Material` node: a Lambert or Phong shading model with its property records. */
export interface FBXMaterialNode extends FBXNode {
  id: number;
  attrName: string;
  ShadingModel: string | (FBXPropertyRecord & { value: string });
  BumpFactor?: FBXNumberProperty;
  Diffuse?: FBXVectorProperty;
  DiffuseColor?: FBXVectorProperty;
  DisplacementFactor?: FBXNumberProperty;
  Emissive?: FBXVectorProperty;
  EmissiveColor?: FBXVectorProperty;
  EmissiveFactor?: FBXNumberProperty;
  Opacity?: FBXNumberProperty;
  TransparencyFactor?: FBXNumberProperty;
  ReflectionFactor?: FBXNumberProperty;
  Shininess?: FBXNumberProperty;
  Specular?: FBXVectorProperty;
  SpecularColor?: FBXVectorProperty;
}

/** `Objects.Texture` node: UV wrapping, repeat and offset. */
export interface FBXTextureNode extends FBXNode {
  id: number;
  attrName: string;
  FileName: string;
  WrapModeU?: FBXNumberProperty;
  WrapModeV?: FBXNumberProperty;
  Scaling?: FBXVectorProperty;
  Translation?: FBXVectorProperty;
}

/** `Objects.Video` node: an external or embedded image. */
export interface FBXVideoNode extends FBXNode {
  Filename?: string;
  RelativeFilename?: string;
  Content?: string | ArrayBufferLike;
}

/** One `LayerElement*` node: a mapping description plus its buffer. */
export interface FBXLayerElementNode extends FBXNode {
  MappingInformationType: string;
  ReferenceInformationType: string;
  Normals?: FBXArrayNode;
  NormalsIndex?: FBXArrayNode;
  NormalIndex?: FBXArrayNode;
  UV?: FBXArrayNode;
  UVIndex?: FBXArrayNode;
  Colors?: FBXArrayNode;
  ColorIndex?: FBXArrayNode;
  Materials?: FBXArrayNode;
}

/** `Objects.Geometry` node: mesh vertex data, morph data or a NURBS curve. */
export interface FBXGeometryNode extends FBXNode {
  id: number;
  attrName?: string;
  attrType: string;
  Vertices?: FBXArrayNode;
  PolygonVertexIndex?: FBXArrayNode;
  Indexes?: FBXArrayNode;
  LayerElementColor?: FBXLayerElementNode[];
  LayerElementMaterial?: FBXLayerElementNode[];
  LayerElementNormal?: FBXLayerElementNode[];
  LayerElementUV?: FBXLayerElementNode[];
  Order?: string | number;
  Form?: string;
  KnotVector?: FBXArrayNode;
  Points?: FBXArrayNode;
}

/** `Objects.Deformer` node: a `Skin` cluster or a `BlendShape` channel. */
export interface FBXDeformerNode extends FBXNode {
  id: number;
  attrName: string;
  attrType: string;
  TransformLink?: FBXArrayNode;
  Indexes?: FBXArrayNode;
  Weights?: FBXArrayNode;
  DeformPercent?: FBXNumberProperty;
  FullWeights?: FBXArrayNode;
}

/** `Objects.NodeAttribute` node: camera and light settings. */
export interface FBXAttributeNode extends FBXNode {
  CameraProjectionType?: FBXNumberProperty;
  NearPlane?: FBXNumberProperty;
  FarPlane?: FBXNumberProperty;
  AspectWidth?: FBXNumberProperty;
  AspectHeight?: FBXNumberProperty;
  FieldOfView?: FBXNumberProperty;
  FocalLength?: FBXNumberProperty;
  LightType?: FBXNumberProperty;
  Color?: FBXVectorProperty;
  Intensity?: FBXNumberProperty;
  CastLightOnObject?: FBXNumberProperty;
  FarAttenuationEnd?: FBXNumberProperty;
  EnableFarAttenuation?: FBXNumberProperty;
  OuterAngle?: FBXNumberProperty;
  InnerAngle?: FBXNumberProperty;
  CastShadows?: FBXNumberProperty;
}

/** `Objects.Pose` node: the bind pose used as the rest pose. */
export interface FBXPoseNode extends FBXNode {
  attrType: string;
  NbPoseNodes: number;
  PoseNode: FBXPoseEntry | FBXPoseEntry[];
}

/** One `PoseNode` entry: the posed node's id and its bind matrix. */
export interface FBXPoseEntry extends FBXNode {
  Node: number;
  Matrix: FBXArrayNode;
}

/** `Objects.AnimationCurve` node: one animated axis. */
export interface FBXAnimationCurveNode extends FBXNode {
  id: number;
  KeyTime: FBXArrayNode;
  KeyValueFloat: FBXArrayNode;
}

/** `Objects.AnimationCurveNode` node: the transform channel a curve belongs to. */
export interface FBXAnimationChannelNode extends FBXNode {
  id: number;
  attrName: string;
}

/** `Objects.AnimationStack` node: one clip. */
export interface FBXAnimationStackNode extends FBXNode {
  attrName: string;
  LocalStart?: FBXNumberProperty;
  LocalStop?: FBXNumberProperty;
}

/** `Objects` table, keyed by node type then node id. */
export interface FBXObjectsTable extends FBXNode {
  Model?: Record<string, FBXModelNode>;
  Geometry?: Record<string, FBXGeometryNode>;
  Material?: Record<string, FBXMaterialNode>;
  Texture?: Record<string, FBXTextureNode>;
  Video?: Record<string, FBXVideoNode>;
  Deformer?: Record<string, FBXDeformerNode>;
  NodeAttribute?: Record<string, FBXAttributeNode>;
  Pose?: Record<string, FBXPoseNode>;
  AnimationCurve?: Record<string, FBXAnimationCurveNode>;
  AnimationCurveNode?: Record<string, FBXAnimationChannelNode>;
  AnimationLayer?: Record<string, FBXNode>;
  AnimationStack?: Record<string, FBXAnimationStackNode>;
  LayeredTexture?: Record<string, FBXNode>;
}

/** Top-level parsed file: the tables the loader consumes. */
export interface FBXRootTree extends FBXNode {
  Objects: FBXObjectsTable;
  Connections?: FBXConnectionsNode;
  GlobalSettings?: FBXGlobalSettings;
}

/** Material parameters assembled from FBX property nodes and textures. */
interface MaterialParameters {
  color?: Color;
  emissive?: Color;
  specular?: Color;
  bumpScale?: number;
  displacementScale?: number;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  reflectivity?: number;
  shininess?: number;
  map?: Texture;
  bumpMap?: Texture;
  aoMap?: Texture;
  displacementMap?: Texture;
  emissiveMap?: Texture;
  normalMap?: Texture;
  envMap?: Texture;
  specularMap?: Texture;
  alphaMap?: Texture;
}

interface FBXConnection {
  ID: number;
  relationship: string | undefined;
}

interface FBXConnectionMap {
  parents: FBXConnection[];
  children: FBXConnection[];
}

interface RawBone {
  ID: number;
  indices: number[];
  weights: number[];
  transformLink: Matrix4;
}

interface RawSkeleton {
  ID?: string;
  geometryID?: number;
  rawBones: RawBone[];
  bones: Bone[];
}

interface RawMorphTarget {
  name: string;
  initialWeight: FBXPropertyRecord | undefined;
  id: number;
  fullWeights: number[];
  geoID: number;
}

interface RawMorphTargetGroup {
  id: string;
  rawTargets: RawMorphTarget[];
}

interface Deformers {
  skeletons: Record<string, RawSkeleton>;
  morphTargets: Record<string, RawMorphTargetGroup>;
}

/** A layered attribute buffer (normals, UVs, colors, material indices). */
interface AttributeInfo {
  dataSize: number;
  buffer: number[];
  indices: number[];
  mappingType: string;
  referenceType: string;
}

interface GeoInfo {
  vertexPositions: ArrayLike<number>;
  vertexIndices: number[];
  baseVertexPositions?: ArrayLike<number>;
  material?: AttributeInfo;
  normal?: AttributeInfo;
  color?: AttributeInfo;
  uv?: AttributeInfo[];
  weightTable: Record<number, { id: number; weight: number }[]>;
  skeleton?: RawSkeleton | null;
}

interface GeoBuffers {
  vertex: number[];
  normal: number[];
  colors: number[];
  uvs: number[][];
  materialIndex: number[];
  vertexWeights: number[];
  weightsIndices: number[];
}

interface AnimationCurve {
  id: number;
  times: number[];
  values: number[];
}

interface CurveNode {
  id: number;
  attr: string;
  curves: Partial<Record<"x" | "y" | "z" | "morph", AnimationCurve>>;
}

/** One animated model as assembled by the animation layer parser. */
interface AnimationLayerNode {
  modelName: string;
  ID?: number;
  morphName?: string;
  initialPosition?: number[];
  initialRotation?: number[];
  initialScale?: number[];
  eulerOrder?: string;
  transform?: Matrix4;
  preRotation?: number[];
  postRotation?: number[];
  T?: CurveNode;
  R?: CurveNode;
  S?: CurveNode;
  DeformPercent?: CurveNode;
}

interface RawStack {
  name: string;
  layer: AnimationLayerNode[];
  localStart: number;
  localStop: number;
}

interface TransformData {
  inheritType?: number;
  eulerOrder?: string;
  translation?: number[];
  preRotation?: number[];
  rotation?: number[];
  postRotation?: number[];
  scale?: number[];
  scalingOffset?: number[];
  scalingPivot?: number[];
  rotationOffset?: number[];
  rotationPivot?: number[];
  parentMatrix?: Matrix4;
  parentMatrixWorld?: Matrix4;
}

interface TextParserAttributes {
  id: number | string;
  name: string;
  type: string;
}

/** Geometry carrying the raw skeleton the scene must bind after parsing. */
export interface FBXGeometry extends BufferGeometry {
  FBX_Deformer?: RawSkeleton;
}

let fbxTree: FBXRootTree = { Objects: {} };
let connections: Map<number, FBXConnectionMap> = new Map();
let sceneGraph: Group = new Group();

/**
 * A loader for the FBX format.
 *
 * Requires FBX file to be >= 7.0 and in ASCII or >= 6400 in Binary format.
 * Versions lower than this may load but will probably have errors.
 *
 * Needs Support:
 * - Morph normals / blend shape normals
 *
 * FBX format references:
 * - [C++ SDK reference](https://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_index_html)
 *
 * Binary format specification:
 * - [FBX binary file format specification](https://code.blender.org/2013/08/fbx-binary-file-format-specification/)
 *
 * Compressed binary array properties need an explicitly supplied zlib runtime, so the package
 * never bundles one. Supply any object exposing an fflate-compatible `unzlibSync`:
 *
 * ```ts
 * import { FBXLoader, type FBXZlibRuntime } from 'ek3d/addons/loaders/FBXLoader';
 *
 * async function loadFBX( url: string, runtime: FBXZlibRuntime ) {
 *   return new FBXLoader().setZlibDecoder( runtime ).loadAsync( url );
 * }
 * ```
 *
 * Uncompressed files load without a runtime.
 */
export class FBXLoader extends Loader<Group, string> {
  /**
   * Whether to trim animation clips to the time range of their
   * animation stacks and shift them to start at time zero. Useful
   * for assets that define multiple clips on a single timeline.
   *
   * @default false
   */
  trimAnimationClips: boolean;

  /**
   * Zlib runtime used for compressed array properties, supplied by the consumer.
   *
   * @default null
   */
  zlibDecoder: FBXZlibRuntime | null;

  /**
   * Constructs a new FBX loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);

    this.trimAnimationClips = false;
    this.zlibDecoder = null;
  }

  /**
   * Supplies the zlib runtime needed by binary files that store array properties compressed.
   * Uncompressed files load without a runtime.
   *
   * @param runtime - An object exposing an fflate-compatible `unzlibSync`.
   * @return A reference to this instance.
   */
  setZlibDecoder(runtime: FBXZlibRuntime): this {
    this.zlibDecoder = runtime;
    return this;
  }

  /**
   * Starts loading from the given URL and passes the loaded FBX asset
   * to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param [onProgress] - Executed while the loading is in progress.
   * @param [onError] - Executed when errors occur.
   */
  override load(
    url: string,
    onLoad?: (value: Group) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;

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
        try {
          const group = this.parse(buffer as ArrayBufferLike, path);
          if (onLoad !== undefined) onLoad(group);
        } catch (e) {
          if (onError !== undefined) {
            onError(e);
          } else {
            console.error(e);
          }

          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  /**
   * Parses the given FBX data and returns the resulting group.
   *
   * @param FBXBuffer - The raw FBX data as an array buffer.
   * @param [path] - The URL base path.
   * @return An object representing the parsed asset.
   */
  parse(FBXBuffer: ArrayBufferLike, path?: string): Group {
    if (isFbxFormatBinary(FBXBuffer)) {
      // The builder carries keys discovered in the file, which only the documented tables are read through.
      fbxTree = new BinaryParser(this.zlibDecoder).parse(FBXBuffer) as unknown as FBXRootTree;
    } else {
      const FBXText = convertArrayBufferToString(FBXBuffer);

      if (!isFbxFormatASCII(FBXText)) {
        throw new Error("THREE.FBXLoader: Unknown format.");
      }

      if (getFbxVersion(FBXText) < 7000) {
        throw new Error("THREE.FBXLoader: FBX version not supported, FileVersion: " + getFbxVersion(FBXText));
      }

      // The builder carries keys discovered in the file, which only the documented tables are read through.
      fbxTree = new TextParser().parse(FBXText) as unknown as FBXRootTree;
    }

    const textureLoader = new TextureLoader(this.manager)
      .setPath(this.resourcePath || (path ?? ""))
      .setCrossOrigin(this.crossOrigin);
    textureLoader.setPriority(this.priority);
    textureLoader.setCache(this.cache);

    return new FBXTreeParser(textureLoader, this.manager, this.trimAnimationClips).parse();
  }
}

// Parse the FBXTree object returned by the BinaryParser or TextParser and return a Group
class FBXTreeParser {
  textureLoader: TextureLoader;
  manager: LoadingManager;
  trimAnimationClips: boolean;

  constructor(textureLoader: TextureLoader, manager: LoadingManager, trimAnimationClips: boolean) {
    this.textureLoader = textureLoader;
    this.manager = manager;
    this.trimAnimationClips = trimAnimationClips;
  }

  parse(): Group {
    connections = this.parseConnections();

    const images = this.parseImages();
    const textures = this.parseTextures(images);
    const materials = this.parseMaterials(textures);
    const deformers = this.parseDeformers();
    const geometryMap = new GeometryParser().parse(deformers);

    this.parseScene(deformers, geometryMap, materials);

    return sceneGraph;
  }

  // Parses FBXTree.Connections which holds parent-child connections between objects (e.g. material -> texture, model->geometry )
  // and details the connection type
  parseConnections(): Map<number, FBXConnectionMap> {
    const connectionMap = new Map<number, FBXConnectionMap>();

    if (fbxTree.Connections !== undefined) {
      const rawConnections = fbxTree.Connections.connections;

      rawConnections.forEach((rawConnection) => {
        const fromID: number = rawConnection[0];
        const toID: number = rawConnection[1];
        const relationship: string | undefined = rawConnection[2];

        if (!connectionMap.has(fromID)) {
          connectionMap.set(fromID, { parents: [], children: [] });
        }

        const parentRelationship: FBXConnection = { ID: toID, relationship: relationship };
        connectionMap.get(fromID)!.parents.push(parentRelationship);

        if (!connectionMap.has(toID)) {
          connectionMap.set(toID, { parents: [], children: [] });
        }

        const childRelationship: FBXConnection = { ID: fromID, relationship: relationship };
        connectionMap.get(toID)!.children.push(childRelationship);
      });
    }

    return connectionMap;
  }

  // Parse FBXTree.Objects.Video for embedded image data
  // These images are connected to textures in FBXTree.Objects.Textures
  // via FBXTree.Connections.
  parseImages(): Record<number, string> {
    const images: Record<number, string> = {};
    const blobs: Record<string, string | undefined> = {};

    const videoNodes = fbxTree.Objects.Video;
    if (videoNodes !== undefined) {
      for (const nodeID in videoNodes) {
        const videoNode = videoNodes[nodeID];

        const id = parseInt(nodeID);
        const fileName = videoNode.RelativeFilename ?? videoNode.Filename ?? "";

        images[id] = fileName;

        // raw image data is in videoNode.Content
        const content = videoNode.Content;
        if (content !== undefined) {
          const arrayBufferContent = typeof content !== "string" && content.byteLength > 0;
          const base64Content = typeof content === "string" && content !== "";

          if (arrayBufferContent || base64Content) {
            blobs[fileName] = this.parseImage(videoNode);
          }
        }
      }
    }

    for (const id in images) {
      const filename = images[id];

      if (blobs[filename] !== undefined) images[id] = blobs[filename]!;
      else images[id] = images[id].split("\\").pop()!;
    }

    return images;
  }

  // Parse embedded image data in FBXTree.Video.Content
  parseImage(videoNode: FBXVideoNode): string | undefined {
    const content = videoNode.Content;
    if (content === undefined) return undefined;

    const fileName = videoNode.RelativeFilename ?? videoNode.Filename ?? "";
    const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();

    let type: string | undefined;

    switch (extension) {
      case "bmp":
        type = "image/bmp";
        break;

      case "jpg":
      case "jpeg":
        type = "image/jpeg";
        break;

      case "png":
        type = "image/png";
        break;

      case "tif":
        type = "image/tiff";
        break;

      case "tga":
        if (this.manager.getHandler(".tga") === null) {
          console.warn("FBXLoader: TGA loader not found, skipping ", fileName);
        }

        type = "image/tga";
        break;

      case "webp":
        type = "image/webp";
        break;

      default:
        console.warn('FBXLoader: Image type "' + extension + '" is not supported.');
        return undefined;
    }

    if (typeof content === "string") {
      // ASCII format
      return "data:" + type + ";base64," + content;
    } else {
      // Binary Format
      const array = new Uint8Array(content);
      return URL.createObjectURL(new Blob([array as Uint8Array<ArrayBuffer>], { type: type }));
    }
  }

  // Parse nodes in FBXTree.Objects.Texture
  // These contain details such as UV scaling, cropping, rotation etc and are connected
  // to images in FBXTree.Objects.Video
  parseTextures(images: Record<number, string>): Map<number, Texture> {
    const textureMap = new Map<number, Texture>();

    const textureNodes = fbxTree.Objects.Texture;
    if (textureNodes !== undefined) {
      for (const nodeID in textureNodes) {
        const texture = this.parseTexture(textureNodes[nodeID], images);
        textureMap.set(parseInt(nodeID), texture);
      }
    }

    return textureMap;
  }

  // Parse individual node in FBXTree.Objects.Texture
  parseTexture(textureNode: FBXTextureNode, images: Record<number, string>): Texture {
    const texture = this.loadTexture(textureNode, images);

    (texture as Texture & { ID: number }).ID = textureNode.id;

    texture.name = textureNode.attrName;

    const wrapModeU = textureNode.WrapModeU;
    const wrapModeV = textureNode.WrapModeV;

    const valueU: number = wrapModeU !== undefined ? wrapModeU.value : 0;
    const valueV: number = wrapModeV !== undefined ? wrapModeV.value : 0;

    // http://download.autodesk.com/us/fbx/SDKdocs/FBX_SDK_Help/files/fbxsdkref/class_k_fbx_texture.html#889640e63e2e681259ea81061b85143a
    // 0: repeat(default), 1: clamp

    texture.wrapS = valueU === 0 ? Wrapping.Repeat : Wrapping.ClampToEdge;
    texture.wrapT = valueV === 0 ? Wrapping.Repeat : Wrapping.ClampToEdge;

    if (textureNode.Scaling !== undefined) {
      const values = textureNode.Scaling.value;

      texture.repeat.x = values[0];
      texture.repeat.y = values[1];
    }

    if (textureNode.Translation !== undefined) {
      const values = textureNode.Translation.value;

      texture.offset.x = values[0];
      texture.offset.y = values[1];
    }

    return texture;
  }

  // load a texture specified as a blob or data URI, or via an external URL using TextureLoader
  loadTexture(textureNode: FBXTextureNode, images: Record<number, string>): Texture {
    const extension = (textureNode.FileName.split(".").pop() ?? "").toLowerCase();

    const loader: Loader = this.manager.getHandler(`.${extension}`) ?? this.textureLoader;

    const loaderPath = loader.path;

    if (!loaderPath) {
      loader.setPath(this.textureLoader.path);
    }

    const children = connections.get(textureNode.id)!.children;

    let fileName: string | undefined;

    if (children !== undefined && children.length > 0 && images[children[0].ID] !== undefined) {
      fileName = images[children[0].ID];

      if (fileName.indexOf("blob:") === 0 || fileName.indexOf("data:") === 0) {
        // An absolute blob/data URL must not be prefixed with the loader path.
        loader.setPath("");
      }
    }

    if (fileName === undefined) {
      console.warn("FBXLoader: Undefined filename, creating placeholder texture.");
      return new Texture();
    }

    // Handlers registered for the extension (e.g. TGA) also resolve to a texture.
    const texture = loader.load(fileName) as Texture;

    // revert to initial path
    loader.setPath(loaderPath);

    return texture;
  }

  // Parse nodes in FBXTree.Objects.Material
  parseMaterials(textureMap: Map<number, Texture>): Map<number, MeshPhongMaterial | MeshLambertMaterial> {
    const materialMap = new Map<number, MeshPhongMaterial | MeshLambertMaterial>();

    const materialNodes = fbxTree.Objects.Material;
    if (materialNodes !== undefined) {
      for (const nodeID in materialNodes) {
        const material = this.parseMaterial(materialNodes[nodeID], textureMap);

        if (material !== null) materialMap.set(parseInt(nodeID), material);
      }
    }

    return materialMap;
  }

  // Parse single node in FBXTree.Objects.Material
  // Materials are connected to texture maps in FBXTree.Objects.Textures
  // FBX format currently only supports Lambert and Phong shading models
  parseMaterial(
    materialNode: FBXMaterialNode,
    textureMap: Map<number, Texture>,
  ): MeshPhongMaterial | MeshLambertMaterial | null {
    const ID = materialNode.id;
    const name = materialNode.attrName;
    const shadingModel = materialNode.ShadingModel;

    // Some exporters wrap the shading model in a property object.
    const type = typeof shadingModel === "string" ? shadingModel : shadingModel.value;

    // Ignore unused materials which don't have any connections.
    if (!connections.has(ID)) return null;

    const parameters = this.parseParameters(materialNode, textureMap, ID);

    let material: MeshPhongMaterial | MeshLambertMaterial;

    switch (type.toLowerCase()) {
      case "phong":
        material = new MeshPhongMaterial();
        break;
      case "lambert":
        material = new MeshLambertMaterial();
        break;
      default:
        console.warn('THREE.FBXLoader: unknown material type "%s". Defaulting to MeshPhongMaterial.', type);
        material = new MeshPhongMaterial();
        break;
    }

    material.setValues(parameters);
    material.name = name;

    return material;
  }

  // Parse FBX material and return parameters suitable for a three.js material
  // Also parse the texture map and return any textures associated with the material
  parseParameters(materialNode: FBXMaterialNode, textureMap: Map<number, Texture>, ID: number): MaterialParameters {
    const parameters: MaterialParameters = {};

    if (materialNode.BumpFactor) {
      parameters.bumpScale = materialNode.BumpFactor.value;
    }

    if (materialNode.Diffuse) {
      parameters.color = ColorManagement.colorSpaceToWorking(
        new Color().fromArray(materialNode.Diffuse.value),
        ColorSpace.SRGB,
      );
    } else if (
      materialNode.DiffuseColor &&
      (materialNode.DiffuseColor.type === "Color" || materialNode.DiffuseColor.type === "ColorRGB")
    ) {
      // The blender exporter exports diffuse here instead of in materialNode.Diffuse
      parameters.color = ColorManagement.colorSpaceToWorking(
        new Color().fromArray(materialNode.DiffuseColor.value),
        ColorSpace.SRGB,
      );
    }

    if (materialNode.DisplacementFactor) {
      parameters.displacementScale = materialNode.DisplacementFactor.value;
    }

    if (materialNode.Emissive) {
      parameters.emissive = ColorManagement.colorSpaceToWorking(
        new Color().fromArray(materialNode.Emissive.value),
        ColorSpace.SRGB,
      );
    } else if (
      materialNode.EmissiveColor &&
      (materialNode.EmissiveColor.type === "Color" || materialNode.EmissiveColor.type === "ColorRGB")
    ) {
      // The blender exporter exports emissive color here instead of in materialNode.Emissive
      parameters.emissive = ColorManagement.colorSpaceToWorking(
        new Color().fromArray(materialNode.EmissiveColor.value),
        ColorSpace.SRGB,
      );
    }

    if (materialNode.EmissiveFactor !== undefined) {
      parameters.emissiveIntensity = materialNode.EmissiveFactor.value;
    }

    // the transparency handling is implemented based on Blender's approach:
    // https://github.com/blender/blender/blob/main/scripts/addons_core/io_scene_fbx/import_fbx.py

    let opacity = 1 - (materialNode.TransparencyFactor !== undefined ? materialNode.TransparencyFactor.value : 0);

    if (opacity === 1 || opacity === 0) {
      // Default to opaque. Some exporters (e.g. 3ds Max) define TransparentColor
      // as white (1,1,1) without intending transparency, which makes the Unity-style
      // fallback of `1 - TransparentColor.r` produce incorrect zero opacity.
      opacity = materialNode.Opacity !== undefined ? materialNode.Opacity.value : 1;
    }

    parameters.opacity = opacity;

    if (opacity < 1.0) {
      parameters.transparent = true;
    }

    if (materialNode.ReflectionFactor) {
      parameters.reflectivity = materialNode.ReflectionFactor.value;
    }

    if (materialNode.Shininess) {
      parameters.shininess = materialNode.Shininess.value;
    }

    if (materialNode.Specular) {
      parameters.specular = ColorManagement.colorSpaceToWorking(
        new Color().fromArray(materialNode.Specular.value),
        ColorSpace.SRGB,
      );
    } else if (materialNode.SpecularColor && materialNode.SpecularColor.type === "Color") {
      // The blender exporter exports specular color here instead of in materialNode.Specular
      parameters.specular = ColorManagement.colorSpaceToWorking(
        new Color().fromArray(materialNode.SpecularColor.value),
        ColorSpace.SRGB,
      );
    }

    connections.get(ID)!.children.forEach((child) => {
      const type = child.relationship;

      switch (type) {
        case "Bump":
          parameters.bumpMap = this.getTexture(textureMap, child.ID);
          break;

        case "Maya|TEX_ao_map":
          parameters.aoMap = this.getTexture(textureMap, child.ID);
          break;

        case "DiffuseColor":
        case "Maya|TEX_color_map":
          parameters.map = this.getTexture(textureMap, child.ID);
          if (parameters.map !== undefined) {
            parameters.map.colorSpace = ColorSpace.SRGB;
          }

          break;

        case "DisplacementColor":
          parameters.displacementMap = this.getTexture(textureMap, child.ID);
          break;

        case "EmissiveColor":
          parameters.emissiveMap = this.getTexture(textureMap, child.ID);
          if (parameters.emissiveMap !== undefined) {
            parameters.emissiveMap.colorSpace = ColorSpace.SRGB;
          }

          break;

        case "NormalMap":
        case "Maya|TEX_normal_map":
          parameters.normalMap = this.getTexture(textureMap, child.ID);
          break;

        case "ReflectionColor":
          parameters.envMap = this.getTexture(textureMap, child.ID);
          if (parameters.envMap !== undefined) {
            parameters.envMap.mapping = Mapping.EquirectangularReflection;
            parameters.envMap.colorSpace = ColorSpace.SRGB;
          }

          break;

        case "SpecularColor":
          parameters.specularMap = this.getTexture(textureMap, child.ID);
          if (parameters.specularMap !== undefined) {
            parameters.specularMap.colorSpace = ColorSpace.SRGB;
          }

          break;

        case "TransparentColor":
        case "TransparencyFactor":
          parameters.alphaMap = this.getTexture(textureMap, child.ID);
          parameters.transparent = true;
          break;

        case "AmbientColor":
        case "ShininessExponent": // AKA glossiness map
        case "SpecularFactor": // AKA specularLevel
        case "VectorDisplacementColor": // NOTE: Seems to be a copy of DisplacementColor
        default:
          console.warn("THREE.FBXLoader: %s map is not supported in three.js, skipping texture.", type);
          break;
      }
    });

    return parameters;
  }

  // get a texture from the textureMap for use by a material.
  getTexture(textureMap: Map<number, Texture>, id: number): Texture | undefined {
    // if the texture is a layered texture, just use the first layer and issue a warning
    if (fbxTree.Objects.LayeredTexture !== undefined && id in fbxTree.Objects.LayeredTexture) {
      console.warn("THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer.");
      id = connections.get(id)!.children[0].ID;
    }

    return textureMap.get(id);
  }

  // Parse nodes in FBXTree.Objects.Deformer
  // Deformer node can contain skinning or Vertex Cache animation data, however only skinning is supported here
  // Generates map of Skeleton-like objects for use later when generating and binding skeletons.
  parseDeformers(): Deformers {
    const skeletons: Record<string, RawSkeleton> = {};
    const morphTargets: Record<string, RawMorphTargetGroup> = {};

    const DeformerNodes = fbxTree.Objects.Deformer;
    if (DeformerNodes !== undefined) {
      for (const nodeID in DeformerNodes) {
        const deformerNode = DeformerNodes[nodeID];

        const relationships = connections.get(parseInt(nodeID))!;

        if (deformerNode.attrType === "Skin") {
          const skeleton = this.parseSkeleton(relationships, DeformerNodes);
          skeleton.ID = nodeID;

          if (relationships.parents.length > 1)
            console.warn("THREE.FBXLoader: skeleton attached to more than one geometry is not supported.");
          skeleton.geometryID = relationships.parents[0].ID;

          skeletons[nodeID] = skeleton;
        } else if (deformerNode.attrType === "BlendShape") {
          const morphTarget: RawMorphTargetGroup = {
            id: nodeID,
            rawTargets: this.parseMorphTargets(relationships, DeformerNodes),
          };

          if (relationships.parents.length > 1)
            console.warn("THREE.FBXLoader: morph target attached to more than one geometry is not supported.");

          morphTargets[nodeID] = morphTarget;
        }
      }
    }

    return {
      skeletons: skeletons,
      morphTargets: morphTargets,
    };
  }

  // Parse single nodes in FBXTree.Objects.Deformer
  // The top level skeleton node has type 'Skin' and sub nodes have type 'Cluster'
  // Each skin node represents a skeleton and each cluster node represents a bone
  parseSkeleton(relationships: FBXConnectionMap, deformerNodes: Record<string, FBXDeformerNode>): RawSkeleton {
    const rawBones: RawBone[] = [];

    relationships.children.forEach((child) => {
      const boneNode = deformerNodes[child.ID];

      if (boneNode.attrType !== "Cluster") return;

      const transformLink = boneNode.TransformLink;
      if (transformLink === undefined) {
        throw new Error("THREE.FBXLoader: Cluster deformer is missing TransformLink.");
      }

      const rawBone: RawBone = {
        ID: child.ID,
        indices: [],
        weights: [],
        transformLink: new Matrix4().fromArray(transformLink.a),
      };

      // A cluster with no painted vertices legitimately omits the weight arrays.
      if (boneNode.Indexes !== undefined) {
        rawBone.indices = boneNode.Indexes.a;
        rawBone.weights = boneNode.Weights !== undefined ? boneNode.Weights.a : [];
      }

      rawBones.push(rawBone);
    });

    return {
      rawBones: rawBones,
      bones: [],
    };
  }

  // The top level morph deformer node has type "BlendShape" and sub nodes have type "BlendShapeChannel"
  parseMorphTargets(relationships: FBXConnectionMap, deformerNodes: Record<string, FBXDeformerNode>): RawMorphTarget[] {
    const rawMorphTargets: RawMorphTarget[] = [];

    for (let i = 0; i < relationships.children.length; i++) {
      const child = relationships.children[i];

      const morphTargetNode = deformerNodes[child.ID];

      const fullWeights = morphTargetNode.FullWeights;
      if (fullWeights === undefined) {
        throw new Error("THREE.FBXLoader: BlendShapeChannel is missing FullWeights.");
      }

      const rawMorphTarget: RawMorphTarget = {
        name: morphTargetNode.attrName,
        initialWeight: morphTargetNode.DeformPercent,
        id: morphTargetNode.id,
        fullWeights: fullWeights.a,
        geoID: -1,
      };

      if (morphTargetNode.attrType !== "BlendShapeChannel") return rawMorphTargets;

      rawMorphTarget.geoID = connections.get(parseInt(String(child.ID)))!.children.filter((child) => {
        return child.relationship === undefined;
      })[0].ID;

      rawMorphTargets.push(rawMorphTarget);
    }

    return rawMorphTargets;
  }

  // create the main Group() to be returned by the loader
  parseScene(
    deformers: Deformers,
    geometryMap: Map<number, BufferGeometry | undefined>,
    materialMap: Map<number, MeshPhongMaterial | MeshLambertMaterial>,
  ): void {
    sceneGraph = new Group();

    const modelMap = this.parseModels(deformers.skeletons, geometryMap, materialMap);

    const modelNodes = fbxTree.Objects.Model;
    if (modelNodes === undefined) throw new Error("THREE.FBXLoader: Missing Objects.Model table.");

    modelMap.forEach((model) => {
      const modelNode = modelNodes[String(getFBXID(model))];
      this.setLookAtProperties(model, modelNode);

      const parentConnections = connections.get(getFBXID(model)!)!.parents;

      parentConnections.forEach((connection) => {
        const parent = modelMap.get(connection.ID);
        if (parent !== undefined) parent.add(model);
      });

      if (model.parent === null) {
        sceneGraph.add(model);
      }
    });

    this.addGlobalSceneSettings();

    sceneGraph.traverse((node) => {
      if (node.userData.transformData) {
        if (node.parent) {
          node.userData.transformData.parentMatrix = node.parent.matrix;
          node.userData.transformData.parentMatrixWorld = node.parent.matrixWorld;
        }

        const transform = generateTransform(node.userData.transformData as TransformData);

        node.applyMatrix4(transform);
        node.updateWorldMatrix();
      }
    });

    // Like Blender's FBX importer, use the BindPose section to set the
    // rest pose for bones that are not part of a skin cluster. The BindPose
    // provides a more authoritative rest pose than the Lcl properties which
    // may represent an animation frame rather than the true rest state.
    // Bones WITH clusters will get their bind pose from TransformLink
    // (set via bindSkeleton below), which takes priority.
    const bindPoseMatrices = this.parsePoseNodes();
    const clusterBoneIDs = new Set<number>();

    for (const ID in deformers.skeletons) {
      deformers.skeletons[ID].rawBones.forEach((_rawBone, i) => {
        const bone = deformers.skeletons[ID].bones[i];
        if (bone) clusterBoneIDs.add(getFBXID(bone)!);
      });
    }

    const tempMatrix = new Matrix4();

    sceneGraph.traverse((node) => {
      if (node instanceof Bone && getFBXID(node) !== undefined && !clusterBoneIDs.has(getFBXID(node)!)) {
        const bindPose = bindPoseMatrices[getFBXID(node)!];

        if (bindPose !== undefined) {
          if (node.parent) {
            tempMatrix.copy(node.parent.matrixWorld).invert();
            tempMatrix.multiply(bindPose);
          } else {
            tempMatrix.copy(bindPose);
          }

          tempMatrix.decompose(node.position, node.quaternion, node.scale);
          node.updateMatrix();
          node.matrixWorld.copy(bindPose);
        }
      }
    });

    // Bind skeletons after transforms are applied so that bind matrices
    // are computed from the final scene state. This ensures the rest pose
    // is correct even when the FBX file's Cluster TransformLink matrices
    // differ from the reconstructed bone transforms (common in files
    // without a BindPose section).
    this.bindSkeleton(deformers.skeletons, geometryMap, modelMap);

    const animations = new AnimationParser(this.trimAnimationClips).parse();

    // if all the models where already combined in a single group, just return that
    if (sceneGraph.children.length === 1 && sceneGraph.children[0] instanceof Group) {
      sceneGraph.children[0].animations = animations;
      Object.assign(sceneGraph.children[0].userData, sceneGraph.userData);
      sceneGraph = sceneGraph.children[0];
    }

    sceneGraph.animations = animations;

    // Apply coordinate system correction. FBX files can use different
    // up-axis conventions (Y-up or Z-up). Three.js uses Y-up, so rotate
    // the scene when the file uses Z-up (UpAxis === 2).

    const upAxisValue = fbxTree.GlobalSettings?.UpAxis?.value;

    if (upAxisValue !== undefined) {
      const upAxis = upAxisValue;

      if (upAxis === 2) {
        console.warn(
          "THREE.FBXLoader: You are loading an asset with a Z-UP coordinate system. The loader just rotates the asset to transform it into Y-UP. The vertex data are not converted.",
        );

        sceneGraph.rotation.set(-Math.PI / 2, 0, 0);
      }
    }
  }

  // parse nodes in FBXTree.Objects.Model
  parseModels(
    skeletons: Record<string, RawSkeleton>,
    geometryMap: Map<number, BufferGeometry | undefined>,
    materialMap: Map<number, MeshPhongMaterial | MeshLambertMaterial>,
  ): Map<number, Object3D> {
    const modelMap = new Map<number, Object3D>();
    const modelNodes = fbxTree.Objects.Model;
    if (modelNodes === undefined) throw new Error("THREE.FBXLoader: Missing Objects.Model table.");

    for (const nodeID in modelNodes) {
      const id = parseInt(nodeID);
      const node = modelNodes[nodeID];
      const relationships = connections.get(id)!;

      let model: Object3D | null = this.buildSkeleton(relationships, skeletons, id, node.attrName ?? "");

      if (!model) {
        switch (node.attrType) {
          case "Camera":
            model = this.createCamera(relationships);
            break;
          case "Light":
            model = this.createLight(relationships);
            break;
          case "Mesh":
            model = this.createMesh(relationships, geometryMap, materialMap);
            break;
          case "NurbsCurve":
            model = this.createCurve(relationships, geometryMap);
            break;
          case "LimbNode":
          case "Root":
            model = new Bone();
            break;
          case "Null":
          default:
            model = new Group();
            break;
        }

        model.name = node.attrName ? PropertyBinding.sanitizeNodeName(node.attrName) : "";
        model.userData.originalName = node.attrName;

        setFBXID(model, id);
      }

      this.getTransformData(model, node);
      modelMap.set(id, model);
    }

    return modelMap;
  }

  buildSkeleton(
    relationships: FBXConnectionMap,
    skeletons: Record<string, RawSkeleton>,
    id: number,
    name: string,
  ): Bone | null {
    let bone: Bone | null = null;

    relationships.parents.forEach((parent) => {
      for (const ID in skeletons) {
        const skeleton = skeletons[ID];

        skeleton.rawBones.forEach((rawBone, i) => {
          if (rawBone.ID === parent.ID) {
            const subBone = bone;
            bone = new Bone();

            bone.matrixWorld.copy(rawBone.transformLink);

            // set name and id here - otherwise in cases where "subBone" is created it will not have a name / id

            bone.name = name ? PropertyBinding.sanitizeNodeName(name) : "";
            bone.userData.originalName = name;
            setFBXID(bone, id);

            skeleton.bones[i] = bone;

            // In cases where a bone is shared between multiple meshes
            // duplicate the bone here and add it as a child of the first bone
            if (subBone !== null) {
              bone.add(subBone);
            }
          }
        });
      }
    });

    return bone;
  }

  // create a PerspectiveCamera or OrthographicCamera
  createCamera(relationships: FBXConnectionMap): Object3D {
    let model: Object3D;
    let cameraAttribute: FBXAttributeNode | undefined;

    relationships.children.forEach((child) => {
      const attr = fbxTree.Objects.NodeAttribute?.[child.ID];

      if (attr !== undefined) {
        cameraAttribute = attr;
      }
    });

    if (cameraAttribute === undefined) {
      model = new Object3D();
    } else {
      let type = 0;
      if (cameraAttribute.CameraProjectionType !== undefined && cameraAttribute.CameraProjectionType.value === 1) {
        type = 1;
      }

      let nearClippingPlane = 1;
      if (cameraAttribute.NearPlane !== undefined) {
        nearClippingPlane = cameraAttribute.NearPlane.value / 1000;
      }

      let farClippingPlane = 1000;
      if (cameraAttribute.FarPlane !== undefined) {
        farClippingPlane = cameraAttribute.FarPlane.value / 1000;
      }

      let width = typeof window === "undefined" ? 1 : window.innerWidth;
      let height = typeof window === "undefined" ? 1 : window.innerHeight;

      if (cameraAttribute.AspectWidth !== undefined && cameraAttribute.AspectHeight !== undefined) {
        width = cameraAttribute.AspectWidth.value;
        height = cameraAttribute.AspectHeight.value;
      }

      const aspect = width / height;

      let fov = 45;
      if (cameraAttribute.FieldOfView !== undefined) {
        fov = cameraAttribute.FieldOfView.value;
      }

      const focalLength: number | null = cameraAttribute.FocalLength ? cameraAttribute.FocalLength.value : null;

      switch (type) {
        case 0: // Perspective
          {
            const camera = new PerspectiveCamera(fov, aspect, nearClippingPlane, farClippingPlane);
            if (focalLength !== null) camera.setFocalLength(focalLength);
            model = camera;
          }
          break;

        case 1: // Orthographic
          console.warn("THREE.FBXLoader: Orthographic cameras not supported yet.");
          model = new Object3D();
          break;

        default:
          console.warn("THREE.FBXLoader: Unknown camera type " + type + ".");
          model = new Object3D();
          break;
      }
    }

    return model;
  }

  // Create a DirectionalLight, PointLight or SpotLight
  createLight(relationships: FBXConnectionMap): Object3D {
    let model: Object3D;
    let lightAttribute: FBXAttributeNode | undefined;

    relationships.children.forEach((child) => {
      const attr = fbxTree.Objects.NodeAttribute?.[child.ID];

      if (attr !== undefined) {
        lightAttribute = attr;
      }
    });

    if (lightAttribute === undefined) {
      model = new Object3D();
    } else {
      let type: number;

      // LightType can be undefined for Point lights
      if (lightAttribute.LightType === undefined) {
        type = 0;
      } else {
        type = lightAttribute.LightType.value;
      }

      let color: number | Color = 0xffffff;

      if (lightAttribute.Color !== undefined) {
        color = ColorManagement.colorSpaceToWorking(new Color().fromArray(lightAttribute.Color.value), ColorSpace.SRGB);
      }

      let intensity: number = lightAttribute.Intensity === undefined ? 1 : lightAttribute.Intensity.value / 100;

      // light disabled
      if (lightAttribute.CastLightOnObject !== undefined && lightAttribute.CastLightOnObject.value === 0) {
        intensity = 0;
      }

      let distance = 0;
      if (lightAttribute.FarAttenuationEnd !== undefined) {
        if (lightAttribute.EnableFarAttenuation !== undefined && lightAttribute.EnableFarAttenuation.value === 0) {
          distance = 0;
        } else {
          distance = lightAttribute.FarAttenuationEnd.value;
        }
      }

      // TODO: could this be calculated linearly from FarAttenuationStart to FarAttenuationEnd?
      const decay = 1;

      switch (type) {
        case 0: // Point
          model = new PointLight(color, intensity, distance, decay);
          break;

        case 1: // Directional
          model = new DirectionalLight(color, intensity);
          break;

        case 2: // Spot
          {
            let angle = Math.PI / 3;
            let penumbra = 0;

            if (lightAttribute.OuterAngle !== undefined) {
              angle = degToRad(lightAttribute.OuterAngle.value);

              if (lightAttribute.InnerAngle !== undefined) {
                penumbra = 1 - lightAttribute.InnerAngle.value / lightAttribute.OuterAngle.value;
                penumbra = Math.max(0, penumbra); // penumbra must be in the range [0,1]
              }
            } else if (lightAttribute.InnerAngle !== undefined) {
              // fallback if only InnerAngle is defined

              angle = degToRad(lightAttribute.InnerAngle.value);
            }

            model = new SpotLight(color, intensity, distance, angle, penumbra, decay);
          }
          break;

        default:
          console.warn("THREE.FBXLoader: Unknown light type " + type + ", defaulting to a PointLight.");
          model = new PointLight(color, intensity);
          break;
      }

      if (lightAttribute.CastShadows !== undefined && lightAttribute.CastShadows.value === 1) {
        model.castShadow = true;
      }
    }

    return model;
  }

  createMesh(
    relationships: FBXConnectionMap,
    geometryMap: Map<number, BufferGeometry | undefined>,
    materialMap: Map<number, MeshPhongMaterial | MeshLambertMaterial>,
  ): Mesh {
    let model: Mesh;
    let geometry: BufferGeometry | undefined;
    let material: MeshPhongMaterial | MeshLambertMaterial | (MeshPhongMaterial | MeshLambertMaterial)[] | undefined;
    const materials: (MeshPhongMaterial | MeshLambertMaterial)[] = [];

    // get geometry and materials(s) from connections
    relationships.children.forEach((child) => {
      const connectedGeometry = geometryMap.get(child.ID);
      if (connectedGeometry !== undefined) {
        geometry = connectedGeometry;
      }

      const connectedMaterial = materialMap.get(child.ID);
      if (connectedMaterial !== undefined) {
        materials.push(connectedMaterial);
      }
    });

    if (geometry === undefined) {
      throw new Error("THREE.FBXLoader: Mesh model has no connected geometry.");
    }

    if (materials.length > 1) {
      material = materials;
    } else if (materials.length > 0) {
      material = materials[0];
    } else {
      material = new MeshPhongMaterial({
        name: Loader.DEFAULT_MATERIAL_NAME,
        color: 0xcccccc,
      });
      materials.push(material);
    }

    if ("color" in geometry.attributes) {
      materials.forEach((material) => {
        material.vertexColors = true;
      });
    }

    // Sanitization: If geometry has groups, then it must match the provided material array.
    // If not, we need to clean up the `group.materialIndex` properties inside the groups and point at a (new) default material.
    // This isn't well defined; Unity creates default material, while Blender implicitly uses the previous material in the list.
    if (geometry.groups.length > 0) {
      let needsDefaultMaterial = false;

      for (let i = 0, il = geometry.groups.length; i < il; i++) {
        const group = geometry.groups[i];

        if (group.materialIndex < 0 || group.materialIndex >= materials.length) {
          group.materialIndex = materials.length;
          needsDefaultMaterial = true;
        }
      }

      if (needsDefaultMaterial) {
        const defaultMaterial = new MeshPhongMaterial();
        materials.push(defaultMaterial);
      }
    }

    if ((geometry as FBXGeometry).FBX_Deformer) {
      const skinned = new SkinnedMesh(geometry, material);
      skinned.normalizeSkinWeights();
      model = skinned;
    } else {
      model = new Mesh(geometry, material);
    }

    return model;
  }

  createCurve(relationships: FBXConnectionMap, geometryMap: Map<number, BufferGeometry | undefined>): Line {
    const geometry = relationships.children.reduce((geo: BufferGeometry | undefined, child) => {
      const connectedGeometry = geometryMap.get(child.ID);
      if (connectedGeometry !== undefined) geo = connectedGeometry;

      return geo;
    }, undefined);

    if (geometry === undefined) {
      throw new Error("THREE.FBXLoader: Nurbs curve model has no connected geometry.");
    }

    // FBX does not list materials for Nurbs lines, so we'll just put our own in here.
    const material = new LineBasicMaterial({
      name: Loader.DEFAULT_MATERIAL_NAME,
      color: 0x3300ff,
      linewidth: 1,
    });
    return new Line(geometry, material);
  }

  // parse the model node for transform data
  getTransformData(model: Object3D, modelNode: FBXModelNode): void {
    const transformData: TransformData = {};

    if (modelNode.InheritType !== undefined) transformData.inheritType = modelNode.InheritType.value;

    if (modelNode.RotationOrder !== undefined) transformData.eulerOrder = getEulerOrder(modelNode.RotationOrder.value);
    else transformData.eulerOrder = getEulerOrder(0);

    if (modelNode.Lcl_Translation !== undefined) transformData.translation = modelNode.Lcl_Translation.value;

    if (modelNode.PreRotation !== undefined) transformData.preRotation = modelNode.PreRotation.value;
    if (modelNode.Lcl_Rotation !== undefined) transformData.rotation = modelNode.Lcl_Rotation.value;
    if (modelNode.PostRotation !== undefined) transformData.postRotation = modelNode.PostRotation.value;

    if (modelNode.Lcl_Scaling !== undefined) transformData.scale = modelNode.Lcl_Scaling.value;

    if (modelNode.ScalingOffset !== undefined) transformData.scalingOffset = modelNode.ScalingOffset.value;
    if (modelNode.ScalingPivot !== undefined) transformData.scalingPivot = modelNode.ScalingPivot.value;

    if (modelNode.RotationOffset !== undefined) transformData.rotationOffset = modelNode.RotationOffset.value;
    if (modelNode.RotationPivot !== undefined) transformData.rotationPivot = modelNode.RotationPivot.value;

    model.userData.transformData = transformData;
  }

  setLookAtProperties(model: Object3D, modelNode: FBXModelNode): void {
    if (modelNode.LookAtProperty !== undefined) {
      const children = connections.get(getFBXID(model)!)!.children;

      children.forEach((child) => {
        if (child.relationship === "LookAtProperty") {
          const lookAtTarget = fbxTree.Objects.Model?.[String(child.ID)];
          if (lookAtTarget === undefined) return;

          if (lookAtTarget.Lcl_Translation !== undefined) {
            const pos = lookAtTarget.Lcl_Translation.value;

            // DirectionalLight, SpotLight
            if ("target" in model) {
              const light = model as Object3D & { target: Object3D };
              light.target.position.fromArray(pos);
              sceneGraph.add(light.target);
            } else {
              // Cameras and other Object3Ds

              model.lookAt(new Vector3().fromArray(pos));
            }
          }
        }
      });
    }
  }

  bindSkeleton(
    skeletons: Record<string, RawSkeleton>,
    geometryMap: Map<number, BufferGeometry | undefined>,
    modelMap: Map<number, Object3D>,
  ): void {
    for (const ID in skeletons) {
      const skeleton = skeletons[ID];

      // Compute bone inverses from TransformLink rather than from the
      // bones' current matrixWorld. The TransformLink matrices represent
      // each bone's global transform at the time the skin weights were
      // painted, which may differ from the scene-reconstructed transforms.
      const boneInverses: Matrix4[] = [];

      for (let i = 0, l = skeleton.bones.length; i < l; i++) {
        const inverse = new Matrix4();

        if (skeleton.bones[i] && skeleton.rawBones[i]) {
          inverse.copy(skeleton.rawBones[i].transformLink).invert();
        }

        boneInverses.push(inverse);
      }

      const parents = connections.get(parseInt(skeleton.ID!))!.parents;

      parents.forEach((parent) => {
        if (geometryMap.has(parent.ID)) {
          const geoID = parent.ID;
          const geoRelationships = connections.get(geoID)!;

          geoRelationships.parents.forEach((geoConnParent) => {
            const model = modelMap.get(geoConnParent.ID);

            if (model === undefined) return;

            // A skin cluster can only bind to a skinned mesh; report instead of silently skipping a malformed file.
            if (!(model instanceof SkinnedMesh)) {
              console.warn(
                "THREE.FBXLoader: A skin deformer is connected to a model that is not a SkinnedMesh; skipping bind.",
              );
              return;
            }

            // Use the mesh's current matrixWorld as bind matrix.
            // The BindPose section is intentionally not used here
            // since it may contain scale/rotation from the model
            // hierarchy that is inconsistent with the TransformLink-
            // based bone inverses. Always provide a bind matrix to
            // prevent bind() from calling calculateInverses() which
            // would overwrite the bone inverses computed above.
            model.updateMatrixWorld(true);

            model.bind(new Skeleton(skeleton.bones, boneInverses), model.matrixWorld);
          });
        }
      });
    }
  }

  // Parse BindPose nodes and return a map of node ID to bind matrix.
  parsePoseNodes(): Record<number, Matrix4> {
    const bindMatrices: Record<number, Matrix4> = {};

    const BindPoseNode = fbxTree.Objects.Pose;
    if (BindPoseNode !== undefined) {
      for (const nodeID in BindPoseNode) {
        if (BindPoseNode[nodeID].attrType === "BindPose" && BindPoseNode[nodeID].NbPoseNodes > 0) {
          const poseNodes = BindPoseNode[nodeID].PoseNode;

          if (Array.isArray(poseNodes)) {
            poseNodes.forEach((poseNode) => {
              bindMatrices[poseNode.Node] = new Matrix4().fromArray(poseNode.Matrix.a);
            });
          } else {
            bindMatrices[poseNodes.Node] = new Matrix4().fromArray(poseNodes.Matrix.a);
          }
        }
      }
    }

    return bindMatrices;
  }

  addGlobalSceneSettings(): void {
    const settings = fbxTree.GlobalSettings;
    if (settings === undefined) return;

    const ambient = settings.AmbientColor?.value;

    if (ambient !== undefined) {
      // Parse ambient color - if it's not set to black (default), create an ambient light
      const r = ambient[0];
      const g = ambient[1];
      const b = ambient[2];

      if (r !== 0 || g !== 0 || b !== 0) {
        const color = new Color().setRGB(r, g, b, ColorSpace.SRGB);
        sceneGraph.add(new AmbientLight(color, 1));
      }
    }

    const unitScaleFactor = settings.UnitScaleFactor?.value;

    if (unitScaleFactor !== undefined) {
      sceneGraph.userData.unitScaleFactor = unitScaleFactor;
    }
  }
}

// parse Geometry data from FBXTree and return map of BufferGeometries
class GeometryParser {
  negativeMaterialIndices: boolean;

  constructor() {
    this.negativeMaterialIndices = false;
  }

  // Parse nodes in FBXTree.Objects.Geometry
  parse(deformers: Deformers): Map<number, BufferGeometry | undefined> {
    const geometryMap = new Map<number, BufferGeometry | undefined>();

    const geoNodes = fbxTree.Objects.Geometry;
    if (geoNodes !== undefined) {
      for (const nodeID in geoNodes) {
        const relationships = connections.get(parseInt(nodeID))!;
        const geo = this.parseGeometry(relationships, geoNodes[nodeID], deformers);

        geometryMap.set(parseInt(nodeID), geo);
      }
    }

    // report warnings

    if (this.negativeMaterialIndices === true) {
      console.warn(
        "THREE.FBXLoader: The FBX file contains invalid (negative) material indices. The asset might not render as expected.",
      );
    }

    return geometryMap;
  }

  // Parse single node in FBXTree.Objects.Geometry
  parseGeometry(
    relationships: FBXConnectionMap,
    geoNode: FBXGeometryNode,
    deformers: Deformers,
  ): BufferGeometry | undefined {
    switch (geoNode.attrType) {
      case "Mesh":
        return this.parseMeshGeometry(relationships, geoNode, deformers);

      case "NurbsCurve":
        return this.parseNurbsGeometry(geoNode);
    }

    return undefined;
  }

  // Parse single node mesh geometry in FBXTree.Objects.Geometry
  parseMeshGeometry(
    relationships: FBXConnectionMap,
    geoNode: FBXGeometryNode,
    deformers: Deformers,
  ): BufferGeometry | undefined {
    const skeletons = deformers.skeletons;
    const morphTargets: RawMorphTargetGroup[] = [];

    const modelTable = fbxTree.Objects.Model;
    if (modelTable === undefined) throw new Error("THREE.FBXLoader: Missing Objects.Model table.");

    const modelNodes = relationships.parents.map((parent) => modelTable[String(parent.ID)]);

    // don't create geometry if it is not associated with any models
    if (modelNodes.length === 0) return undefined;

    const modelNode = modelNodes[0];

    const skeleton = relationships.children.reduce((skeleton: RawSkeleton | null, child) => {
      if (skeletons[child.ID] !== undefined) skeleton = skeletons[child.ID];

      return skeleton;
    }, null);

    relationships.children.forEach((child) => {
      if (deformers.morphTargets[child.ID] !== undefined) {
        morphTargets.push(deformers.morphTargets[child.ID]);
      }
    });

    // Assume one model and get the preRotation from that
    // if there is more than one model associated with the geometry this may cause problems
    const transformData: TransformData = {};

    if (modelNode.RotationOrder !== undefined) transformData.eulerOrder = getEulerOrder(modelNode.RotationOrder.value);
    if (modelNode.InheritType !== undefined) transformData.inheritType = modelNode.InheritType.value;

    if (modelNode.GeometricTranslation !== undefined) transformData.translation = modelNode.GeometricTranslation.value;
    if (modelNode.GeometricRotation !== undefined) transformData.rotation = modelNode.GeometricRotation.value;
    if (modelNode.GeometricScaling !== undefined) transformData.scale = modelNode.GeometricScaling.value;

    const transform = generateTransform(transformData);

    return this.genGeometry(geoNode, skeleton, morphTargets, transform);
  }

  // Generate a BufferGeometry from a node in FBXTree.Objects.Geometry
  genGeometry(
    geoNode: FBXGeometryNode,
    skeleton: RawSkeleton | null,
    morphTargets: RawMorphTargetGroup[],
    preTransform: Matrix4,
  ): BufferGeometry {
    const geo = new BufferGeometry() as FBXGeometry;
    if (geoNode.attrName) geo.name = geoNode.attrName;

    const geoInfo = this.parseGeoNode(geoNode, skeleton);
    const buffers = this.genBuffers(geoInfo);

    const positionAttribute = new Float32BufferAttribute(buffers.vertex, 3);

    positionAttribute.applyMatrix4(preTransform);

    geo.setAttribute("position", positionAttribute);

    if (buffers.colors.length > 0) {
      geo.setAttribute("color", new Float32BufferAttribute(buffers.colors, 3));
    }

    if (skeleton) {
      geo.setAttribute("skinIndex", new Uint16BufferAttribute(buffers.weightsIndices, 4));
      geo.setAttribute("skinWeight", new Float32BufferAttribute(buffers.vertexWeights, 4));

      // used later to bind the skeleton to the model
      geo.FBX_Deformer = skeleton;
    }

    if (buffers.normal.length > 0) {
      const normalMatrix = new Matrix3().getNormalMatrix(preTransform);

      const normalAttribute = new Float32BufferAttribute(buffers.normal, 3);
      normalAttribute.applyNormalMatrix(normalMatrix);

      geo.setAttribute("normal", normalAttribute);
    }

    buffers.uvs.forEach((_uvBuffer, i) => {
      const name = i === 0 ? "uv" : `uv${i}`;

      geo.setAttribute(name, new Float32BufferAttribute(buffers.uvs[i], 2));
    });

    if (geoInfo.material && geoInfo.material.mappingType !== "AllSame") {
      // Convert the material indices of each vertex into rendering groups on the geometry.
      let prevMaterialIndex = buffers.materialIndex[0];
      let startIndex = 0;

      buffers.materialIndex.forEach((currentIndex, i) => {
        if (currentIndex !== prevMaterialIndex) {
          geo.addGroup(startIndex, i - startIndex, prevMaterialIndex);

          prevMaterialIndex = currentIndex;
          startIndex = i;
        }
      });

      // the loop above doesn't add the last group, do that here.
      if (geo.groups.length > 0) {
        const lastGroup = geo.groups[geo.groups.length - 1];
        const lastIndex = lastGroup.start + lastGroup.count;

        if (lastIndex !== buffers.materialIndex.length) {
          geo.addGroup(lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex);
        }
      }

      // case where there are multiple materials but the whole geometry is only
      // using one of them
      if (geo.groups.length === 0) {
        geo.addGroup(0, buffers.materialIndex.length, buffers.materialIndex[0]);
      }
    }

    this.addMorphTargets(geo, geoNode, morphTargets, preTransform);

    return geo;
  }

  parseGeoNode(geoNode: FBXGeometryNode, skeleton: RawSkeleton | null): GeoInfo {
    const geoInfo: GeoInfo = {
      vertexPositions: [],
      vertexIndices: [],
      weightTable: {},
    };

    geoInfo.vertexPositions = geoNode.Vertices !== undefined ? geoNode.Vertices.a : [];
    geoInfo.vertexIndices = geoNode.PolygonVertexIndex !== undefined ? geoNode.PolygonVertexIndex.a : [];

    if (geoNode.LayerElementColor && geoNode.LayerElementColor[0].Colors) {
      geoInfo.color = this.parseVertexColors(geoNode.LayerElementColor[0]);
    }

    if (geoNode.LayerElementMaterial) {
      geoInfo.material = this.parseMaterialIndices(geoNode.LayerElementMaterial[0]);
    }

    if (geoNode.LayerElementNormal) {
      geoInfo.normal = this.parseNormals(geoNode.LayerElementNormal[0]);
    }

    if (geoNode.LayerElementUV) {
      geoInfo.uv = [];

      let i = 0;
      while (geoNode.LayerElementUV[i]) {
        if (geoNode.LayerElementUV[i].UV) {
          geoInfo.uv.push(this.parseUVs(geoNode.LayerElementUV[i]));
        }

        i++;
      }
    }

    if (skeleton !== null) {
      geoInfo.skeleton = skeleton;

      skeleton.rawBones.forEach((rawBone, i) => {
        // loop over the bone's vertex indices and weights
        rawBone.indices.forEach((index, j) => {
          if (geoInfo.weightTable[index] === undefined) geoInfo.weightTable[index] = [];

          geoInfo.weightTable[index].push({
            id: i,
            weight: rawBone.weights[j],
          });
        });
      });
    }

    return geoInfo;
  }

  genBuffers(geoInfo: GeoInfo): GeoBuffers {
    const buffers: GeoBuffers = {
      vertex: [],
      normal: [],
      colors: [],
      uvs: [],
      materialIndex: [],
      vertexWeights: [],
      weightsIndices: [],
    };

    let polygonIndex = 0;
    let faceLength = 0;
    let displayedWeightsWarning = false;

    // these will hold data for a single face
    let facePositionIndexes: number[] = [];
    let faceNormals: number[] = [];
    let faceColors: number[] = [];
    let faceUVs: number[][] = [];
    let faceWeights: number[] = [];
    let faceWeightIndices: number[] = [];

    geoInfo.vertexIndices.forEach((vertexIndex: number, polygonVertexIndex: number) => {
      let materialIndex: number | undefined;
      let endOfFace = false;

      // Face index and vertex index arrays are combined in a single array
      // A cube with quad faces looks like this:
      // PolygonVertexIndex: *24 {
      //  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
      //  }
      // Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
      // to find index of last vertex bit shift the index: ^ - 1
      if (vertexIndex < 0) {
        vertexIndex = vertexIndex ^ -1; // equivalent to ( x * -1 ) - 1
        endOfFace = true;
      }

      let weightIndices: number[] = [];
      let weights: number[] = [];

      facePositionIndexes.push(vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2);

      if (geoInfo.color) {
        const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color);

        faceColors.push(data[0], data[1], data[2]);
      }

      if (geoInfo.skeleton) {
        if (geoInfo.weightTable[vertexIndex] !== undefined) {
          geoInfo.weightTable[vertexIndex].forEach((wt) => {
            weights.push(wt.weight);
            weightIndices.push(wt.id);
          });
        }

        if (weights.length > 4) {
          if (!displayedWeightsWarning) {
            console.warn(
              "THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.",
            );
            displayedWeightsWarning = true;
          }

          const wIndex = [0, 0, 0, 0];
          const Weight = [0, 0, 0, 0];

          weights.forEach((weight, weightIndex) => {
            let currentWeight = weight;
            let currentIndex = weightIndices[weightIndex];

            Weight.forEach((comparedWeight, comparedWeightIndex, comparedWeightArray) => {
              if (currentWeight > comparedWeight) {
                comparedWeightArray[comparedWeightIndex] = currentWeight;
                currentWeight = comparedWeight;

                const tmp = wIndex[comparedWeightIndex];
                wIndex[comparedWeightIndex] = currentIndex;
                currentIndex = tmp;
              }
            });
          });

          weightIndices = wIndex;
          weights = Weight;
        }

        // if the weight array is shorter than 4 pad with 0s
        while (weights.length < 4) {
          weights.push(0);
          weightIndices.push(0);
        }

        for (let i = 0; i < 4; ++i) {
          faceWeights.push(weights[i]);
          faceWeightIndices.push(weightIndices[i]);
        }
      }

      if (geoInfo.normal) {
        const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal);

        faceNormals.push(data[0], data[1], data[2]);
      }

      if (geoInfo.material && geoInfo.material.mappingType !== "AllSame") {
        materialIndex = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.material)[0];

        if (materialIndex < 0) {
          this.negativeMaterialIndices = true;
          materialIndex = 0; // fallback
        }
      }

      if (geoInfo.uv) {
        geoInfo.uv.forEach((uv, i) => {
          const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, uv);

          if (faceUVs[i] === undefined) {
            faceUVs[i] = [];
          }

          faceUVs[i].push(data[0]);
          faceUVs[i].push(data[1]);
        });
      }

      faceLength++;

      if (endOfFace) {
        this.genFace(
          buffers,
          geoInfo,
          facePositionIndexes,
          materialIndex,
          faceNormals,
          faceColors,
          faceUVs,
          faceWeights,
          faceWeightIndices,
          faceLength,
        );

        polygonIndex++;
        faceLength = 0;

        // reset arrays for the next face
        facePositionIndexes = [];
        faceNormals = [];
        faceColors = [];
        faceUVs = [];
        faceWeights = [];
        faceWeightIndices = [];
      }
    });

    return buffers;
  }

  // See https://www.khronos.org/opengl/wiki/Calculating_a_Surface_Normal
  getNormalNewell(vertices: Vector3[]): Vector3 {
    const normal = new Vector3(0.0, 0.0, 0.0);

    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];

      normal.x += (current.y - next.y) * (current.z + next.z);
      normal.y += (current.z - next.z) * (current.x + next.x);
      normal.z += (current.x - next.x) * (current.y + next.y);
    }

    normal.normalize();

    return normal;
  }

  getNormalTangentAndBitangent(vertices: Vector3[]): { normal: Vector3; tangent: Vector3; bitangent: Vector3 } {
    const normalVector = this.getNormalNewell(vertices);
    // Avoid up being equal or almost equal to normalVector
    const up = Math.abs(normalVector.z) > 0.5 ? new Vector3(0.0, 1.0, 0.0) : new Vector3(0.0, 0.0, 1.0);
    const tangent = up.cross(normalVector).normalize();
    const bitangent = normalVector.clone().cross(tangent).normalize();

    return {
      normal: normalVector,
      tangent: tangent,
      bitangent: bitangent,
    };
  }

  flattenVertex(vertex: Vector3, normalTangent: Vector3, normalBitangent: Vector3): Vector2 {
    return new Vector2(vertex.dot(normalTangent), vertex.dot(normalBitangent));
  }

  // Generate data for a single face in a geometry. If the face is a quad then split it into 2 tris
  genFace(
    buffers: GeoBuffers,
    geoInfo: GeoInfo,
    facePositionIndexes: number[],
    materialIndex: number | undefined,
    faceNormals: number[],
    faceColors: number[],
    faceUVs: number[][],
    faceWeights: number[],
    faceWeightIndices: number[],
    faceLength: number,
  ): void {
    let triangles: number[][];

    if (faceLength > 3) {
      // Triangulate n-gon using earcut

      const vertices: Vector3[] = [];
      // in morphing scenario vertexPositions represent morphPositions
      // while baseVertexPositions represent the original geometry's positions
      const positions = geoInfo.baseVertexPositions || geoInfo.vertexPositions;
      for (let i = 0; i < facePositionIndexes.length; i += 3) {
        vertices.push(
          new Vector3(
            positions[facePositionIndexes[i]],
            positions[facePositionIndexes[i + 1]],
            positions[facePositionIndexes[i + 2]],
          ),
        );
      }

      const { tangent, bitangent } = this.getNormalTangentAndBitangent(vertices);
      const triangulationInput: Vector2[] = [];

      for (const vertex of vertices) {
        triangulationInput.push(this.flattenVertex(vertex, tangent, bitangent));
      }

      // When vertices is an array of [0,0,0] elements (which is the case for vertices not participating in morph)
      // the triangulationInput will be an array of [0,0] elements
      // resulting in an array of 0 triangles being returned from ShapeUtils.triangulateShape
      // leading to not pushing into buffers.vertex the redundant vertices (the vertices that are not morphed).
      // That's why, in order to support morphing scenario, "positions" is looking first for baseVertexPositions,
      // so that we don't end up with an array of 0 triangles for the faces not participating in morph.
      triangles = ShapeUtils.triangulateShape(triangulationInput, []);
    } else {
      // Regular triangle, skip earcut triangulation step
      triangles = [[0, 1, 2]];
    }

    for (const [i0, i1, i2] of triangles) {
      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i0 * 3]]);
      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i0 * 3 + 1]]);
      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i0 * 3 + 2]]);

      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i1 * 3]]);
      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i1 * 3 + 1]]);
      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i1 * 3 + 2]]);

      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i2 * 3]]);
      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i2 * 3 + 1]]);
      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i2 * 3 + 2]]);

      if (geoInfo.skeleton) {
        buffers.vertexWeights.push(faceWeights[i0 * 4]);
        buffers.vertexWeights.push(faceWeights[i0 * 4 + 1]);
        buffers.vertexWeights.push(faceWeights[i0 * 4 + 2]);
        buffers.vertexWeights.push(faceWeights[i0 * 4 + 3]);

        buffers.vertexWeights.push(faceWeights[i1 * 4]);
        buffers.vertexWeights.push(faceWeights[i1 * 4 + 1]);
        buffers.vertexWeights.push(faceWeights[i1 * 4 + 2]);
        buffers.vertexWeights.push(faceWeights[i1 * 4 + 3]);

        buffers.vertexWeights.push(faceWeights[i2 * 4]);
        buffers.vertexWeights.push(faceWeights[i2 * 4 + 1]);
        buffers.vertexWeights.push(faceWeights[i2 * 4 + 2]);
        buffers.vertexWeights.push(faceWeights[i2 * 4 + 3]);

        buffers.weightsIndices.push(faceWeightIndices[i0 * 4]);
        buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 1]);
        buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 2]);
        buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 3]);

        buffers.weightsIndices.push(faceWeightIndices[i1 * 4]);
        buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 1]);
        buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 2]);
        buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 3]);

        buffers.weightsIndices.push(faceWeightIndices[i2 * 4]);
        buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 1]);
        buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 2]);
        buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 3]);
      }

      if (geoInfo.color) {
        buffers.colors.push(faceColors[i0 * 3]);
        buffers.colors.push(faceColors[i0 * 3 + 1]);
        buffers.colors.push(faceColors[i0 * 3 + 2]);

        buffers.colors.push(faceColors[i1 * 3]);
        buffers.colors.push(faceColors[i1 * 3 + 1]);
        buffers.colors.push(faceColors[i1 * 3 + 2]);

        buffers.colors.push(faceColors[i2 * 3]);
        buffers.colors.push(faceColors[i2 * 3 + 1]);
        buffers.colors.push(faceColors[i2 * 3 + 2]);
      }

      if (geoInfo.material && geoInfo.material.mappingType !== "AllSame") {
        buffers.materialIndex.push(materialIndex!);
        buffers.materialIndex.push(materialIndex!);
        buffers.materialIndex.push(materialIndex!);
      }

      if (geoInfo.normal) {
        buffers.normal.push(faceNormals[i0 * 3]);
        buffers.normal.push(faceNormals[i0 * 3 + 1]);
        buffers.normal.push(faceNormals[i0 * 3 + 2]);

        buffers.normal.push(faceNormals[i1 * 3]);
        buffers.normal.push(faceNormals[i1 * 3 + 1]);
        buffers.normal.push(faceNormals[i1 * 3 + 2]);

        buffers.normal.push(faceNormals[i2 * 3]);
        buffers.normal.push(faceNormals[i2 * 3 + 1]);
        buffers.normal.push(faceNormals[i2 * 3 + 2]);
      }

      if (geoInfo.uv) {
        geoInfo.uv.forEach((_uv, j) => {
          if (buffers.uvs[j] === undefined) buffers.uvs[j] = [];

          buffers.uvs[j].push(faceUVs[j][i0 * 2]);
          buffers.uvs[j].push(faceUVs[j][i0 * 2 + 1]);

          buffers.uvs[j].push(faceUVs[j][i1 * 2]);
          buffers.uvs[j].push(faceUVs[j][i1 * 2 + 1]);

          buffers.uvs[j].push(faceUVs[j][i2 * 2]);
          buffers.uvs[j].push(faceUVs[j][i2 * 2 + 1]);
        });
      }
    }
  }

  addMorphTargets(
    parentGeo: BufferGeometry,
    parentGeoNode: FBXGeometryNode,
    morphTargets: RawMorphTargetGroup[],
    preTransform: Matrix4,
  ): void {
    if (morphTargets.length === 0) return;

    parentGeo.morphTargetsRelative = true;

    parentGeo.morphAttributes.position = [];
    // parentGeo.morphAttributes.normal = []; // not implemented

    // Morph attribute positions are stored as deltas (morphTargetsRelative = true), so the
    // translation component of the geometric transform must not be applied to them — only the
    // rotation/scale part. Otherwise every delta gets the geometric translation added, which
    // shifts morphed vertices away from their intended position by `weight * translation` as
    // the influence increases.
    const morphPreTransform = preTransform.clone().setPosition(0, 0, 0);

    morphTargets.forEach((morphTarget) => {
      morphTarget.rawTargets.forEach((rawTarget) => {
        const morphGeoNode = fbxTree.Objects.Geometry?.[String(rawTarget.geoID)];

        if (morphGeoNode !== undefined) {
          this.genMorphGeometry(parentGeo, parentGeoNode, morphGeoNode, morphPreTransform, rawTarget.name);
        }
      });
    });
  }

  // a morph geometry node is similar to a standard  node, and the node is also contained
  // in FBXTree.Objects.Geometry, however it can only have attributes for position, normal
  // and a special attribute Index defining which vertices of the original geometry are affected
  // Normal and position attributes only have data for the vertices that are affected by the morph
  genMorphGeometry(
    parentGeo: BufferGeometry,
    parentGeoNode: FBXGeometryNode,
    morphGeoNode: FBXGeometryNode,
    preTransform: Matrix4,
    name: string,
  ): void {
    const basePositions: number[] = parentGeoNode.Vertices !== undefined ? parentGeoNode.Vertices.a : [];
    const baseIndices: number[] =
      parentGeoNode.PolygonVertexIndex !== undefined ? parentGeoNode.PolygonVertexIndex.a : [];

    const morphPositionsSparse: number[] = morphGeoNode.Vertices !== undefined ? morphGeoNode.Vertices.a : [];
    const morphIndices: number[] = morphGeoNode.Indexes !== undefined ? morphGeoNode.Indexes.a : [];

    const length = parentGeo.attributes.position.count * 3;
    const morphPositions = new Float32Array(length);

    for (let i = 0; i < morphIndices.length; i++) {
      const morphIndex = morphIndices[i] * 3;

      morphPositions[morphIndex] = morphPositionsSparse[i * 3];
      morphPositions[morphIndex + 1] = morphPositionsSparse[i * 3 + 1];
      morphPositions[morphIndex + 2] = morphPositionsSparse[i * 3 + 2];
    }

    // TODO: add morph normal support
    const morphGeoInfo: GeoInfo = {
      vertexIndices: baseIndices,
      vertexPositions: morphPositions,
      baseVertexPositions: basePositions,
      weightTable: {},
    };

    const morphBuffers = this.genBuffers(morphGeoInfo);

    const positionAttribute = new Float32BufferAttribute(morphBuffers.vertex, 3);
    positionAttribute.name = name || morphGeoNode.attrName || "";

    positionAttribute.applyMatrix4(preTransform);

    parentGeo.morphAttributes.position.push(positionAttribute);
  }

  // Parse normal from FBXTree.Objects.Geometry.LayerElementNormal if it exists
  parseNormals(NormalNode: FBXLayerElementNode): AttributeInfo {
    const mappingType: string = NormalNode.MappingInformationType;
    const referenceType: string = NormalNode.ReferenceInformationType;
    const normals = NormalNode.Normals;
    if (normals === undefined) throw new Error("THREE.FBXLoader: LayerElementNormal is missing Normals.");

    const buffer = normals.a;
    let indexBuffer: number[] = [];
    if (referenceType === "IndexToDirect") {
      const normalIndex = NormalNode.NormalIndex ?? NormalNode.NormalsIndex;
      indexBuffer = normalIndex !== undefined ? normalIndex.a : [];
    }

    return {
      dataSize: 3,
      buffer: buffer,
      indices: indexBuffer,
      mappingType: mappingType,
      referenceType: referenceType,
    };
  }

  // Parse UVs from FBXTree.Objects.Geometry.LayerElementUV if it exists
  parseUVs(UVNode: FBXLayerElementNode): AttributeInfo {
    const mappingType: string = UVNode.MappingInformationType;
    const referenceType: string = UVNode.ReferenceInformationType;
    const uv = UVNode.UV;
    if (uv === undefined) throw new Error("THREE.FBXLoader: LayerElementUV is missing UV.");

    const buffer = uv.a;
    let indexBuffer: number[] = [];
    if (referenceType === "IndexToDirect" && UVNode.UVIndex !== undefined) {
      indexBuffer = UVNode.UVIndex.a;
    }

    return {
      dataSize: 2,
      buffer: buffer,
      indices: indexBuffer,
      mappingType: mappingType,
      referenceType: referenceType,
    };
  }

  // Parse Vertex Colors from FBXTree.Objects.Geometry.LayerElementColor if it exists
  parseVertexColors(ColorNode: FBXLayerElementNode): AttributeInfo {
    const mappingType: string = ColorNode.MappingInformationType;
    const referenceType: string = ColorNode.ReferenceInformationType;
    const colors = ColorNode.Colors;
    if (colors === undefined) throw new Error("THREE.FBXLoader: LayerElementColor is missing Colors.");

    const buffer = colors.a;
    let indexBuffer: number[] = [];
    if (referenceType === "IndexToDirect" && ColorNode.ColorIndex !== undefined) {
      indexBuffer = ColorNode.ColorIndex.a;
    }

    for (let i = 0, c = new Color(); i < buffer.length; i += 4) {
      c.fromArray(buffer, i);
      ColorManagement.colorSpaceToWorking(c, ColorSpace.SRGB);
      c.toArray(buffer, i);
    }

    return {
      dataSize: 4,
      buffer: buffer,
      indices: indexBuffer,
      mappingType: mappingType,
      referenceType: referenceType,
    };
  }

  // Parse mapping and material data in FBXTree.Objects.Geometry.LayerElementMaterial if it exists
  parseMaterialIndices(MaterialNode: FBXLayerElementNode): AttributeInfo {
    const mappingType: string = MaterialNode.MappingInformationType;
    const referenceType: string = MaterialNode.ReferenceInformationType;

    if (mappingType === "NoMappingInformation") {
      return {
        dataSize: 1,
        buffer: [0],
        indices: [0],
        mappingType: "AllSame",
        referenceType: referenceType,
      };
    }

    const materials = MaterialNode.Materials;
    if (materials === undefined) throw new Error("THREE.FBXLoader: LayerElementMaterial is missing Materials.");

    const materialIndexBuffer = materials.a;

    // Since materials are stored as indices, there's a bit of a mismatch between FBX and what
    // we expect.So we create an intermediate buffer that points to the index in the buffer,
    // for conforming with the other functions we've written for other data.
    const materialIndices: number[] = [];

    for (let i = 0; i < materialIndexBuffer.length; ++i) {
      materialIndices.push(i);
    }

    return {
      dataSize: 1,
      buffer: materialIndexBuffer,
      indices: materialIndices,
      mappingType: mappingType,
      referenceType: referenceType,
    };
  }

  // Generate a NurbGeometry from a node in FBXTree.Objects.Geometry
  parseNurbsGeometry(geoNode: FBXGeometryNode): BufferGeometry {
    const knotVector = geoNode.KnotVector;
    const pointArray = geoNode.Points;

    if (knotVector === undefined || pointArray === undefined) {
      throw new Error(`THREE.FBXLoader: NurbsCurve geometry ${geoNode.id} is missing KnotVector or Points.`);
    }

    const order = parseInt(String(geoNode.Order));

    if (isNaN(order)) {
      console.error("THREE.FBXLoader: Invalid Order %s given for geometry ID: %s", geoNode.Order, geoNode.id);
      return new BufferGeometry();
    }

    const degree = order - 1;

    const knots = knotVector.a;
    const controlPoints: Vector4[] = [];
    const pointsValues = pointArray.a;

    for (let i = 0, l = pointsValues.length; i < l; i += 4) {
      controlPoints.push(new Vector4().fromArray(pointsValues, i));
    }

    let startKnot: number | undefined, endKnot: number | undefined;

    if (geoNode.Form === "Closed") {
      controlPoints.push(controlPoints[0]);
    } else if (geoNode.Form === "Periodic") {
      startKnot = degree;
      endKnot = knots.length - 1 - startKnot;

      for (let i = 0; i < degree; ++i) {
        controlPoints.push(controlPoints[i]);
      }
    }

    const curve = new NURBSCurve(degree, knots, controlPoints, startKnot, endKnot);
    const points = curve.getPoints(controlPoints.length * 12);

    return new BufferGeometry().setFromPoints(points);
  }
}

// parse animation data from FBXTree
class AnimationParser {
  trimAnimationClips: boolean;

  constructor(trimAnimationClips: boolean) {
    this.trimAnimationClips = trimAnimationClips;
  }

  // take raw animation clips and turn them into three.js animation clips
  parse(): AnimationClip[] {
    const animationClips: AnimationClip[] = [];

    const rawClips = this.parseClips();

    if (rawClips !== undefined) {
      for (const key in rawClips) {
        const rawClip = rawClips[key];

        const clip = this.addClip(rawClip);

        animationClips.push(clip);
      }
    }

    return animationClips;
  }

  parseClips(): Record<string, RawStack> | undefined {
    // since the actual transformation data is stored in FBXTree.Objects.AnimationCurve,
    // if this is undefined we can safely assume there are no animations
    if (fbxTree.Objects.AnimationCurve === undefined) return undefined;

    const curveNodesMap = this.parseAnimationCurveNodes();

    this.parseAnimationCurves(curveNodesMap);

    const layersMap = this.parseAnimationLayers(curveNodesMap);
    const rawClips = this.parseAnimStacks(layersMap);

    return rawClips;
  }

  // parse nodes in FBXTree.Objects.AnimationCurveNode
  // each AnimationCurveNode holds data for an animation transform for a model (e.g. left arm rotation )
  // and is referenced by an AnimationLayer
  parseAnimationCurveNodes(): Map<number, CurveNode> {
    const rawCurveNodes = fbxTree.Objects.AnimationCurveNode;

    const curveNodesMap = new Map<number, CurveNode>();

    if (rawCurveNodes === undefined) return curveNodesMap;

    for (const nodeID in rawCurveNodes) {
      const rawCurveNode = rawCurveNodes[nodeID];

      if (typeof rawCurveNode.attrName === "string" && rawCurveNode.attrName.match(/S|R|T|DeformPercent/) !== null) {
        const curveNode: CurveNode = {
          id: rawCurveNode.id,
          attr: rawCurveNode.attrName,
          curves: {},
        };

        curveNodesMap.set(curveNode.id, curveNode);
      }
    }

    return curveNodesMap;
  }

  // parse nodes in FBXTree.Objects.AnimationCurve and connect them up to
  // previously parsed AnimationCurveNodes. Each AnimationCurve holds data for a single animated
  // axis ( e.g. times and values of x rotation)
  parseAnimationCurves(curveNodesMap: Map<number, CurveNode>): void {
    const rawCurves = fbxTree.Objects.AnimationCurve;

    if (rawCurves === undefined) return;

    // TODO: Many values are identical up to roundoff error, but won't be optimised
    // e.g. position times: [0, 0.4, 0. 8]
    // position values: [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.235384487103147e-7, 93.67520904541016, -0.9982695579528809]
    // clearly, this should be optimised to
    // times: [0], positions [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809]
    // this shows up in nearly every FBX file, and generally time array is length > 100

    for (const nodeID in rawCurves) {
      const animationCurve: AnimationCurve = {
        id: rawCurves[nodeID].id,
        times: (rawCurves[nodeID].KeyTime.a as number[]).map(convertFBXTimeToSeconds),
        values: rawCurves[nodeID].KeyValueFloat.a,
      };

      const relationships = connections.get(animationCurve.id);

      if (relationships !== undefined) {
        const animationCurveID = relationships.parents[0].ID;
        const animationCurveRelationship = relationships.parents[0].relationship!;

        const curveNode = curveNodesMap.get(animationCurveID);

        if (animationCurveRelationship.match(/X/)) {
          curveNode!.curves.x = animationCurve;
        } else if (animationCurveRelationship.match(/Y/)) {
          curveNode!.curves.y = animationCurve;
        } else if (animationCurveRelationship.match(/Z/)) {
          curveNode!.curves.z = animationCurve;
        } else if (animationCurveRelationship.match(/DeformPercent/) && curveNode !== undefined) {
          curveNode.curves.morph = animationCurve;
        }
      }
    }
  }

  // parse nodes in FBXTree.Objects.AnimationLayer. Each layers holds references
  // to various AnimationCurveNodes and is referenced by an AnimationStack node
  // note: theoretically a stack can have multiple layers, however in practice there always seems to be one per stack
  parseAnimationLayers(curveNodesMap: Map<number, CurveNode>): Map<number, AnimationLayerNode[]> {
    const modelTable = fbxTree.Objects.Model;
    const deformerTable = fbxTree.Objects.Deformer;
    if (modelTable === undefined) throw new Error("THREE.FBXLoader: Missing Objects.Model table.");

    const rawLayers = fbxTree.Objects.AnimationLayer;

    const layersMap = new Map<number, AnimationLayerNode[]>();

    if (rawLayers === undefined) return layersMap;

    for (const nodeID in rawLayers) {
      const layerCurveNodes: AnimationLayerNode[] = [];

      const connection = connections.get(parseInt(nodeID));

      if (connection !== undefined) {
        // all the animationCurveNodes used in the layer
        const children = connection.children;

        children.forEach((child, i) => {
          if (curveNodesMap.has(child.ID)) {
            const curveNode = curveNodesMap.get(child.ID)!;

            // check that the curves are defined for at least one axis, otherwise ignore the curveNode
            if (
              curveNode.curves.x !== undefined ||
              curveNode.curves.y !== undefined ||
              curveNode.curves.z !== undefined
            ) {
              if (layerCurveNodes[i] === undefined) {
                const filteredParents = connections.get(child.ID)!.parents.filter((parent) => {
                  return parent.relationship !== undefined;
                });

                if (filteredParents.length === 0) return;

                const modelID = filteredParents[0].ID;

                if (modelID !== undefined) {
                  const rawModel = modelTable[modelID.toString()];

                  if (rawModel === undefined) {
                    console.warn("THREE.FBXLoader: Encountered a unused curve.", child);
                    return;
                  }

                  const node: AnimationLayerNode = {
                    modelName: rawModel.attrName ? PropertyBinding.sanitizeNodeName(rawModel.attrName) : "",
                    ID: rawModel.id,
                    initialPosition: [0, 0, 0],
                    initialRotation: [0, 0, 0],
                    initialScale: [1, 1, 1],
                  };

                  sceneGraph.traverse((object) => {
                    if (getFBXID(object) === rawModel.id) {
                      node.transform = object.matrix;

                      if (object.userData.transformData) {
                        node.eulerOrder = object.userData.transformData.eulerOrder;

                        if (object.userData.transformData.rotation)
                          node.initialRotation = object.userData.transformData.rotation;
                      }
                    }
                  });

                  if (!node.transform) node.transform = new Matrix4();

                  // if the animated model is pre rotated, we'll have to apply the pre rotations to every
                  // animation value as well
                  if (rawModel.PreRotation !== undefined) node.preRotation = rawModel.PreRotation.value;
                  if (rawModel.PostRotation !== undefined) node.postRotation = rawModel.PostRotation.value;

                  layerCurveNodes[i] = node;
                }
              }

              if (layerCurveNodes[i]) setLayerChannel(layerCurveNodes[i], curveNode.attr, curveNode);
            } else if (curveNode.curves.morph !== undefined) {
              if (layerCurveNodes[i] === undefined) {
                const filteredParents = connections.get(child.ID)!.parents.filter((parent) => {
                  return parent.relationship !== undefined;
                });

                if (filteredParents.length === 0) return;

                const deformerID = filteredParents[0].ID;

                const morpherID = connections.get(deformerID)!.parents[0].ID;
                const geoID = connections.get(morpherID)!.parents[0].ID;

                // assuming geometry is not used in more than one model
                const modelID = connections.get(geoID)!.parents[0].ID;

                const rawModel = modelTable[String(modelID)];

                if (rawModel === undefined) {
                  console.warn("THREE.FBXLoader: Encountered a morph curve for a missing model.", child);
                  return;
                }

                const node: AnimationLayerNode = {
                  modelName: rawModel.attrName ? PropertyBinding.sanitizeNodeName(rawModel.attrName) : "",
                  morphName: deformerTable?.[String(deformerID)]?.attrName,
                };

                layerCurveNodes[i] = node;
              }

              setLayerChannel(layerCurveNodes[i], curveNode.attr, curveNode);
            }
          }
        });

        layersMap.set(parseInt(nodeID), layerCurveNodes);
      }
    }

    return layersMap;
  }

  // parse nodes in FBXTree.Objects.AnimationStack. These are the top level node in the animation
  // hierarchy. Each Stack node will be used to create an AnimationClip
  parseAnimStacks(layersMap: Map<number, AnimationLayerNode[]>): Record<string, RawStack> {
    const rawStacks = fbxTree.Objects.AnimationStack;

    // connect the stacks (clips) up to the layers
    const rawClips: Record<string, RawStack> = {};

    if (rawStacks === undefined) return rawClips;

    for (const nodeID in rawStacks) {
      const children = connections.get(parseInt(nodeID))!.children;

      if (children.length > 1) {
        // it seems like stacks will always be associated with a single layer. But just in case there are files
        // where there are multiple layers per stack, we'll display a warning
        console.warn(
          "THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.",
        );
      }

      const layer = layersMap.get(children[0].ID)!;
      const rawStack = rawStacks[nodeID];

      rawClips[nodeID] = {
        name: rawStack.attrName,
        layer: layer,
        localStart: rawStack.LocalStart !== undefined ? convertFBXTimeToSeconds(Number(rawStack.LocalStart.value)) : 0,
        localStop: rawStack.LocalStop !== undefined ? convertFBXTimeToSeconds(Number(rawStack.LocalStop.value)) : 0,
      };
    }

    return rawClips;
  }

  addClip(rawClip: RawStack): AnimationClip {
    let tracks: KeyframeTrack[] = [];

    rawClip.layer.forEach((rawTracks) => {
      tracks = tracks.concat(this.generateTracks(rawTracks));
    });

    if (this.trimAnimationClips === true && rawClip.localStop > rawClip.localStart) {
      tracks = this.trimTracks(tracks, rawClip.localStart, rawClip.localStop);
    }

    return new AnimationClip(rawClip.name, -1, tracks);
  }

  // trims the given tracks to the time range [ startTime, endTime ] and shifts
  // them so they start at time zero. tracks without keyframes in the range are discarded
  trimTracks(tracks: KeyframeTrack[], startTime: number, endTime: number): KeyframeTrack[] {
    // track times are stored as float32 so compare against float32 boundaries
    // to keep keyframes lying exactly on the range limits

    const start = Math.fround(startTime);
    const end = Math.fround(endTime);

    const trimmedTracks: KeyframeTrack[] = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const stride = track.getValueSize();

      const times: number[] = [];
      const values: number[] = [];

      for (let j = 0; j < track.times.length; j++) {
        const time = track.times[j];

        if (time < start || time > end) continue;

        times.push(time - start);

        for (let k = 0; k < stride; k++) {
          values.push((track.values as ArrayLike<number>)[j * stride + k]);
        }
      }

      if (times.length === 0) continue;

      track.times = new Float32Array(times);
      track.values = new Float32Array(values);

      trimmedTracks.push(track);
    }

    return trimmedTracks;
  }

  generateTracks(rawTracks: AnimationLayerNode): KeyframeTrack[] {
    const tracks: KeyframeTrack[] = [];

    let initialPosition = new Vector3();
    let initialScale = new Vector3();

    if (rawTracks.transform) rawTracks.transform.decompose(initialPosition, new Quaternion(), initialScale);

    const initialPositionArray = initialPosition.toArray();
    const initialScaleArray = initialScale.toArray();

    if (rawTracks.T !== undefined && Object.keys(rawTracks.T.curves).length > 0) {
      const positionTrack = this.generateVectorTrack(
        rawTracks.modelName,
        rawTracks.T.curves,
        initialPositionArray,
        "position",
      );
      if (positionTrack !== undefined) tracks.push(positionTrack);
    }

    if (rawTracks.R !== undefined && Object.keys(rawTracks.R.curves).length > 0) {
      const rotationTrack = this.generateRotationTrack(
        rawTracks.modelName,
        rawTracks.R.curves,
        rawTracks.preRotation,
        rawTracks.postRotation,
        rawTracks.eulerOrder ?? Euler.DEFAULT_ORDER,
        rawTracks.initialRotation,
      );
      if (rotationTrack !== undefined) tracks.push(rotationTrack);
    }

    if (rawTracks.S !== undefined && Object.keys(rawTracks.S.curves).length > 0) {
      const scaleTrack = this.generateVectorTrack(rawTracks.modelName, rawTracks.S.curves, initialScaleArray, "scale");
      if (scaleTrack !== undefined) tracks.push(scaleTrack);
    }

    if (rawTracks.DeformPercent !== undefined) {
      const morphTrack = this.generateMorphTrack(rawTracks);
      if (morphTrack !== undefined) tracks.push(morphTrack);
    }

    return tracks;
  }

  generateVectorTrack(
    modelName: string,
    curves: CurveNode["curves"],
    initialValue: number[],
    type: string,
  ): VectorKeyframeTrack {
    const times = this.getTimesForAllAxes(curves);
    const values = this.getKeyframeTrackValues(times, curves, initialValue);

    return new VectorKeyframeTrack(modelName + "." + type, times, values);
  }

  generateRotationTrack(
    modelName: string,
    curves: CurveNode["curves"],
    preRotationInput: number[] | undefined,
    postRotationInput: number[] | undefined,
    eulerOrder: string,
    initialRotation: number[] | undefined,
  ): QuaternionKeyframeTrack | undefined {
    let times: number[] | undefined;
    let values: number[] | undefined;

    if (curves.x !== undefined || curves.y !== undefined || curves.z !== undefined) {
      // Get merged, sorted, unique times from all available curves
      const mergedTimes = this.getTimesForAllAxes(curves);

      if (mergedTimes.length > 0) {
        const initialRot = initialRotation || [0, 0, 0];

        // Synchronize all curves to the merged time array.
        // Missing axes are filled with constant values from the initial rotation (Lcl Rotation).
        // Existing curves at different times are linearly interpolated.
        const syncX = this.synchronizeCurve(curves.x, mergedTimes, initialRot[0]);
        const syncY = this.synchronizeCurve(curves.y, mergedTimes, initialRot[1]);
        const syncZ = this.synchronizeCurve(curves.z, mergedTimes, initialRot[2]);

        const result = this.interpolateRotations(syncX, syncY, syncZ, eulerOrder);

        times = result[0];
        values = result[1];
      }
    }

    // For Maya models using "Joint Orient", Euler order only applies to rotation, not pre/post-rotations
    const defaultEulerOrder = getEulerOrder(0);

    let preRotation: Quaternion | undefined;
    let postRotation: Quaternion | undefined;

    if (preRotationInput !== undefined) {
      const array: (number | string)[] = preRotationInput.map(degToRad);
      array.push(defaultEulerOrder);

      const euler = new Euler().fromArray(array);
      preRotation = new Quaternion().setFromEuler(euler);
    }

    if (postRotationInput !== undefined) {
      const array: (number | string)[] = postRotationInput.map(degToRad);
      array.push(defaultEulerOrder);

      const euler = new Euler().fromArray(array);
      postRotation = new Quaternion().setFromEuler(euler).invert();
    }

    const quaternion = new Quaternion();
    const euler = new Euler();

    const quaternionValues: number[] = [];

    if (!values || !times) return undefined;

    for (let i = 0; i < values.length; i += 3) {
      euler.set(values[i], values[i + 1], values[i + 2], eulerOrder);
      quaternion.setFromEuler(euler);

      if (preRotation !== undefined) quaternion.premultiply(preRotation);
      if (postRotation !== undefined) quaternion.multiply(postRotation);

      // Check unroll
      if (i > 2) {
        const prevQuat = new Quaternion().fromArray(quaternionValues, ((i - 3) / 3) * 4);

        if (prevQuat.dot(quaternion) < 0) {
          quaternion.set(-quaternion.x, -quaternion.y, -quaternion.z, -quaternion.w);
        }
      }

      quaternion.toArray(quaternionValues, (i / 3) * 4);
    }

    return new QuaternionKeyframeTrack(modelName + ".quaternion", times, quaternionValues);
  }

  generateMorphTrack(rawTracks: AnimationLayerNode): NumberKeyframeTrack {
    const curves = rawTracks.DeformPercent?.curves.morph;
    if (curves === undefined) {
      throw new Error(`THREE.FBXLoader: Morph channel for "${rawTracks.modelName}" has no curve.`);
    }

    const values = curves.values.map((val) => {
      return val / 100;
    });

    const target = sceneGraph.getObjectByName(rawTracks.modelName);

    if (!(target instanceof Mesh) || target.morphTargetDictionary === undefined) {
      throw new Error(
        `THREE.FBXLoader: Morph target "${rawTracks.morphName}" has no matching mesh named "${rawTracks.modelName}".`,
      );
    }

    const morphName = rawTracks.morphName;
    if (morphName === undefined) {
      throw new Error(`THREE.FBXLoader: Morph channel for "${rawTracks.modelName}" has no morph name.`);
    }

    const morphNum = target.morphTargetDictionary[morphName];
    if (morphNum === undefined) {
      throw new Error(`THREE.FBXLoader: Morph target "${morphName}" is not part of mesh "${rawTracks.modelName}".`);
    }

    return new NumberKeyframeTrack(
      rawTracks.modelName + ".morphTargetInfluences[" + morphNum + "]",
      curves.times,
      values,
    );
  }

  // For all animated objects, times are defined separately for each axis
  // Here we'll combine the times into one sorted array without duplicates
  getTimesForAllAxes(curves: CurveNode["curves"]): number[] {
    let times: number[] = [];

    // first join together the times for each axis, if defined
    if (curves.x !== undefined) times = times.concat(curves.x.times);
    if (curves.y !== undefined) times = times.concat(curves.y.times);
    if (curves.z !== undefined) times = times.concat(curves.z.times);

    // then sort them
    times = times.sort((a, b) => {
      return a - b;
    });

    // and remove duplicates
    if (times.length > 1) {
      let targetIndex = 1;
      let lastValue = times[0];
      for (let i = 1; i < times.length; i++) {
        const currentValue = times[i];
        if (currentValue !== lastValue) {
          times[targetIndex] = currentValue;
          lastValue = currentValue;
          targetIndex++;
        }
      }

      times = times.slice(0, targetIndex);
    }

    return times;
  }

  getKeyframeTrackValues(times: number[], curves: CurveNode["curves"], initialValue: number[]): number[] {
    const prevValue = initialValue;

    const values: number[] = [];

    let xIndex = -1;
    let yIndex = -1;
    let zIndex = -1;

    times.forEach((time) => {
      if (curves.x) xIndex = curves.x.times.indexOf(time);
      if (curves.y) yIndex = curves.y.times.indexOf(time);
      if (curves.z) zIndex = curves.z.times.indexOf(time);

      // if there is an x value defined for this frame, use that
      if (xIndex !== -1) {
        const xValue = curves.x!.values[xIndex];
        values.push(xValue);
        prevValue[0] = xValue;
      } else {
        // otherwise use the x value from the previous frame
        values.push(prevValue[0]);
      }

      if (yIndex !== -1) {
        const yValue = curves.y!.values[yIndex];
        values.push(yValue);
        prevValue[1] = yValue;
      } else {
        values.push(prevValue[1]);
      }

      if (zIndex !== -1) {
        const zValue = curves.z!.values[zIndex];
        values.push(zValue);
        prevValue[2] = zValue;
      } else {
        values.push(prevValue[2]);
      }
    });

    return values;
  }

  // Synchronize a curve to a target time array using linear interpolation.
  // If the curve is undefined (axis not animated), returns constant values from initialValue.
  synchronizeCurve(
    curve: AnimationCurve | undefined,
    targetTimes: number[],
    initialValue: number,
  ): { times: number[]; values: number[] } {
    if (curve === undefined) {
      return { times: targetTimes, values: targetTimes.map(() => initialValue) };
    }

    // If the curve already has the same number of keyframes as the target, assume times match
    if (curve.times.length === targetTimes.length) return curve;

    // Linearly interpolate curve values at each target time
    const values: number[] = [];

    for (let i = 0; i < targetTimes.length; i++) {
      values.push(this.sampleCurveValue(curve, targetTimes[i], initialValue));
    }

    return { times: targetTimes, values: values };
  }

  // Sample a single value from a curve at a given time using linear interpolation
  sampleCurveValue(curve: AnimationCurve, time: number, initialValue: number): number {
    const times = curve.times;
    const values = curve.values;

    // Before first keyframe
    if (time <= times[0]) return values[0];

    // After last keyframe
    if (time >= times[times.length - 1]) return values[values.length - 1];

    // Find surrounding keyframes and linearly interpolate
    for (let i = 0; i < times.length - 1; i++) {
      if (time >= times[i] && time <= times[i + 1]) {
        if (times[i] === time) return values[i];

        const alpha = (time - times[i]) / (times[i + 1] - times[i]);
        return values[i] * (1 - alpha) + values[i + 1] * alpha;
      }
    }

    return initialValue;
  }

  // Rotations are defined as Euler angles which can have values  of any size
  // These will be converted to quaternions which don't support values greater than
  // PI, so we'll interpolate large rotations
  interpolateRotations(
    curvex: { times: number[]; values: number[] },
    curvey: { times: number[]; values: number[] },
    curvez: { times: number[]; values: number[] },
    eulerOrder: string,
  ): [number[], number[]] {
    const times: number[] = [];
    const values: number[] = [];

    // Add first frame
    times.push(curvex.times[0]);
    values.push(degToRad(curvex.values[0]));
    values.push(degToRad(curvey.values[0]));
    values.push(degToRad(curvez.values[0]));

    for (let i = 1; i < curvex.values.length; i++) {
      const initialValue = [curvex.values[i - 1], curvey.values[i - 1], curvez.values[i - 1]];

      if (isNaN(initialValue[0]) || isNaN(initialValue[1]) || isNaN(initialValue[2])) {
        continue;
      }

      const initialValueRad = initialValue.map(degToRad);

      const currentValue = [curvex.values[i], curvey.values[i], curvez.values[i]];

      if (isNaN(currentValue[0]) || isNaN(currentValue[1]) || isNaN(currentValue[2])) {
        continue;
      }

      const currentValueRad = currentValue.map(degToRad);

      const valuesSpan = [
        currentValue[0] - initialValue[0],
        currentValue[1] - initialValue[1],
        currentValue[2] - initialValue[2],
      ];

      const absoluteSpan = [Math.abs(valuesSpan[0]), Math.abs(valuesSpan[1]), Math.abs(valuesSpan[2])];

      if (absoluteSpan[0] >= 180 || absoluteSpan[1] >= 180 || absoluteSpan[2] >= 180) {
        const maxAbsSpan = Math.max(...absoluteSpan);

        const numSubIntervals = maxAbsSpan / 180;

        const E1 = new Euler(initialValueRad[0], initialValueRad[1], initialValueRad[2], eulerOrder);
        const E2 = new Euler(currentValueRad[0], currentValueRad[1], currentValueRad[2], eulerOrder);

        const Q1 = new Quaternion().setFromEuler(E1);
        const Q2 = new Quaternion().setFromEuler(E2);

        // Check unroll
        if (Q1.dot(Q2) < 0) {
          Q2.set(-Q2.x, -Q2.y, -Q2.z, -Q2.w);
        }

        // Interpolate
        const initialTime = curvex.times[i - 1];
        const timeSpan = curvex.times[i] - initialTime;

        const Q = new Quaternion();
        const E = new Euler();
        for (let t = 0; t < 1; t += 1 / numSubIntervals) {
          Q.copy(Q1.clone().slerp(Q2.clone(), t));

          times.push(initialTime + t * timeSpan);
          E.setFromQuaternion(Q, eulerOrder);

          values.push(E.x);
          values.push(E.y);
          values.push(E.z);
        }
      } else {
        times.push(curvex.times[i]);
        values.push(degToRad(curvex.values[i]));
        values.push(degToRad(curvey.values[i]));
        values.push(degToRad(curvez.values[i]));
      }
    }

    return [times, values];
  }
}

// parse an FBX file in ASCII format
class TextParser {
  currentIndent: number;
  allNodes: FBXTree;
  nodeStack: FBXDynamicNode[];

  constructor() {
    this.currentIndent = 0;
    this.allNodes = new FBXTree();
    this.nodeStack = [];
  }

  getPrevNode(): FBXDynamicNode {
    return this.nodeStack[this.currentIndent - 2];
  }

  getCurrentNode(): FBXDynamicNode {
    return this.nodeStack[this.currentIndent - 1];
  }

  pushStack(node: FBXDynamicNode): void {
    this.nodeStack.push(node);
    this.currentIndent += 1;
  }

  popStack(): void {
    this.nodeStack.pop();
    this.currentIndent -= 1;
  }

  parse(text: string): FBXTree {
    this.currentIndent = 0;

    this.allNodes = new FBXTree();
    this.nodeStack = [];

    const split = text.split(/[\r\n]+/);

    split.forEach((line, i) => {
      const matchComment = line.match(/^[\s\t]*;/);
      const matchEmpty = line.match(/^[\s\t]*$/);

      if (matchComment || matchEmpty) return;

      const matchBeginning = line.match("^\\t{" + this.currentIndent + "}(\\w+):(.*){");
      const matchProperty = line.match("^\\t{" + this.currentIndent + "}(\\w+):[\\s\\t\\r\\n](.*)");
      const matchEnd = line.match("^\\t{" + (this.currentIndent - 1) + "}}");

      if (matchBeginning) {
        this.parseNodeBegin(line, matchBeginning);
      } else if (matchProperty) {
        this.parseNodeProperty(matchProperty, split[++i]);
      } else if (matchEnd) {
        this.popStack();
      } else if (line.match(/^[^\s\t}]/)) {
        // large arrays are split over multiple lines terminated with a ',' character
        // if this is encountered the line needs to be joined to the previous line
        this.parseNodePropertyContinued(line);
      }
    });

    return this.allNodes;
  }

  parseNodeBegin(line: string, property: RegExpMatchArray): void {
    const nodeName = property[1].trim().replace(/^"/, "").replace(/"$/, "");

    const nodeAttrs = property[2].split(",").map((attr) => {
      return attr.trim().replace(/^"/, "").replace(/"$/, "");
    });

    const node: FBXDynamicNode = { name: nodeName };
    const attrs = this.parseNodeAttr(nodeAttrs);

    const currentNode = this.getCurrentNode();

    // a top node
    if (this.currentIndent === 0) {
      this.allNodes.add(nodeName, node);
    } else {
      // a subnode

      // if the subnode already exists, append it
      if (nodeName in currentNode) {
        const existing = currentNode[nodeName];

        // special case Pose needs PoseNodes as an array
        if (nodeName === "PoseNode") {
          const poseNodes = currentNode.PoseNode;

          if (Array.isArray(poseNodes)) poseNodes.push(node);
          else currentNode.PoseNode = [node];
        } else if (isNodeRecord(existing) && existing.id !== undefined) {
          const existingID = existing.id;
          const table: FBXDynamicNode = {};
          table[existingID] = existing;
          currentNode[nodeName] = table;
        }

        const container = currentNode[nodeName];

        if (attrs.id !== "" && isNodeRecord(container)) container[attrs.id] = node;
      } else if (typeof attrs.id === "number") {
        const table: FBXDynamicNode = {};
        table[attrs.id] = node;
        currentNode[nodeName] = table;
      } else if (nodeName !== "Properties70") {
        if (nodeName === "PoseNode") currentNode[nodeName] = [node];
        else currentNode[nodeName] = node;
      }
    }

    if (typeof attrs.id === "number") node.id = attrs.id;
    if (attrs.name !== "") node.attrName = attrs.name;
    if (attrs.type !== "") node.attrType = attrs.type;

    this.pushStack(node);
  }

  parseNodeAttr(attrs: string[]): TextParserAttributes {
    let id: number | string = attrs[0];

    if (attrs[0] !== "") {
      id = parseInt(attrs[0]);

      if (isNaN(id)) {
        id = attrs[0];
      }
    }

    let name = "",
      type = "";

    if (attrs.length > 1) {
      name = attrs[1].replace(/^(\w+)::/, "");
      type = attrs[2];
    }

    return { id: id, name: name, type: type };
  }

  parseNodeProperty(property: RegExpMatchArray, contentLine: string): void {
    let propName = property[1].replace(/^"/, "").replace(/"$/, "").trim();
    let propValue: FBXStoredValue = property[2].replace(/^"/, "").replace(/"$/, "").trim();

    // for special case: base64 image data follows "Content: ," line
    //	Content: ,
    //	 "/9j/4RDaRXhpZgAATU0A..."
    if (propName === "Content" && propValue === ",") {
      propValue = contentLine.replace(/"/g, "").replace(/,$/, "").trim();
    }

    const currentNode = this.getCurrentNode();
    const parentName = currentNode.name;

    if (parentName === "Properties70") {
      this.parseNodeSpecialProperty(propValue);
      return;
    }

    // Connections
    if (propName === "C") {
      const connProps = (propValue as string).split(",").slice(1);
      const from = parseInt(connProps[0]);
      const to = parseInt(connProps[1]);

      let rest = (propValue as string).split(",").slice(3);

      rest = rest.map((elem) => {
        return elem.trim().replace(/^"/, "");
      });

      propName = "connections";
      propValue = [from, to] as FBXStoredValue[];
      append(propValue as (number | string)[], rest);

      if (currentNode[propName] === undefined) {
        currentNode[propName] = [];
      }
    }

    // Node
    if (propName === "Node") currentNode.id = propValue as string;

    // connections
    const existing = currentNode[propName];
    if (Array.isArray(existing)) {
      (existing as FBXStoredValue[]).push(propValue);
    } else {
      if (propName !== "a") currentNode[propName] = propValue;
      else currentNode.a = propValue as string;
    }

    // convert string to array, unless it ends in ',' in which case more will be added to it
    if (propName === "a" && typeof propValue === "string" && propValue.slice(-1) !== ",") {
      currentNode.a = parseNumberArray(propValue);
    }
  }

  parseNodePropertyContinued(line: string): void {
    const currentNode = this.getCurrentNode();

    const accumulated = currentNode.a;

    if (typeof accumulated !== "string") {
      throw new Error("THREE.FBXLoader: Continued array property without an open string buffer.");
    }

    const buffer = accumulated + line;
    currentNode.a = buffer;

    // if the line doesn't end in ',' we have reached the end of the property value
    // so convert the string to an array
    if (line.slice(-1) !== ",") {
      currentNode.a = parseNumberArray(buffer);
    }
  }

  // parse "Property70"
  parseNodeSpecialProperty(propValue: string): void {
    // split this
    // P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
    // into array like below
    // ["Lcl Scaling", "Lcl Scaling", "", "A", "1,1,1" ]
    const props = propValue.split('",').map((prop) => {
      return prop.trim().replace(/^"/, "").replace(/\s/, "_");
    });

    const innerPropName = props[0];
    const innerPropType1 = props[1];
    const innerPropType2 = props[2];
    const innerPropFlag = props[3];
    let innerPropValue: string | number | number[] = props[4];

    // cast values where needed, otherwise leave as strings
    switch (innerPropType1) {
      case "int":
      case "enum":
      case "bool":
      case "ULongLong":
      case "double":
      case "Number":
      case "FieldOfView":
        innerPropValue = parseFloat(innerPropValue as string);
        break;

      case "Color":
      case "ColorRGB":
      case "Vector3D":
      case "Lcl_Translation":
      case "Lcl_Rotation":
      case "Lcl_Scaling":
        innerPropValue = parseNumberArray(innerPropValue as string);
        break;
    }

    // CAUTION: these props must append to parent's parent
    this.getPrevNode()[innerPropName] = {
      type: innerPropType1,
      type2: innerPropType2,
      flag: innerPropFlag,
      value: innerPropValue,
    };
  }
}

// Parse an FBX file in Binary format
class BinaryParser {
  zlibDecoder: FBXZlibRuntime | null;

  constructor(zlibDecoder: FBXZlibRuntime | null) {
    this.zlibDecoder = zlibDecoder;
  }

  parse(buffer: ArrayBufferLike): FBXTree {
    const reader = new BinaryReader(buffer);
    reader.skip(23); // skip magic 23 bytes

    const version = reader.getUint32();

    if (version < 6400) {
      throw new Error("THREE.FBXLoader: FBX version not supported, FileVersion: " + version);
    }

    const allNodes = new FBXTree();

    while (!this.endOfContent(reader)) {
      const node = this.parseNode(reader, version);
      if (node !== null) allNodes.add(node.name, node);
    }

    return allNodes;
  }

  // Check if reader has reached the end of content.
  endOfContent(reader: BinaryReader): boolean {
    // footer size: 160bytes + 16-byte alignment padding
    // - 16bytes: magic
    // - padding til 16-byte alignment (at least 1byte?)
    //	(seems like some exporters embed fixed 15 or 16bytes?)
    // - 4bytes: magic
    // - 4bytes: version
    // - 120bytes: zero
    // - 16bytes: magic
    if (reader.size() % 16 === 0) {
      return ((reader.getOffset() + 160 + 16) & ~0xf) >= reader.size();
    } else {
      return reader.getOffset() + 160 + 16 >= reader.size();
    }
  }

  // recursively parse nodes until the end of the file is reached
  parseNode(reader: BinaryReader, version: number): FBXBinaryNode | null {
    const node: FBXBinaryNode = { name: "", propertyList: [] };

    // The first three data sizes depends on version.
    const endOffset = version >= 7500 ? reader.getUint64() : reader.getUint32();
    const numProperties = version >= 7500 ? reader.getUint64() : reader.getUint32();

    if (version >= 7500) reader.getUint64();
    else reader.getUint32(); // the returned propertyListLen is not used

    const nameLen = reader.getUint8();
    const name = reader.getString(nameLen);

    // Regards this node as NULL-record if endOffset is zero
    if (endOffset === 0) return null;

    const propertyList: FBXValue[] = [];

    for (let i = 0; i < numProperties; i++) {
      propertyList.push(this.parseProperty(reader));
    }

    // Regards the first three elements in propertyList as id, attrName, and attrType
    const id = propertyList.length > 0 ? propertyList[0] : "";
    const attrName = propertyList.length > 1 ? propertyList[1] : "";
    const attrType = propertyList.length > 2 ? propertyList[2] : "";

    // check if this node represents just a single property
    // like (name, 0) set or (name2, [0, 1, 2]) set of {name: 0, name2: [0, 1, 2]}
    node.singleProperty = numProperties === 1 && reader.getOffset() === endOffset;

    while (endOffset > reader.getOffset()) {
      const subNode = this.parseNode(reader, version);

      if (subNode !== null) this.parseSubNode(name, node, subNode);
    }

    node.propertyList = propertyList; // raw property list used by parent

    if (typeof id === "number") node.id = id;
    if (typeof attrName === "string" && attrName !== "") node.attrName = attrName;
    if (typeof attrType === "string" && attrType !== "") node.attrType = attrType;
    if (name !== "") node.name = name;

    return node;
  }

  parseSubNode(name: string, node: FBXBinaryNode, subNode: FBXBinaryNode): void {
    // special case: child node is single property
    if (subNode.singleProperty === true) {
      const value = subNode.propertyList[0];

      if (Array.isArray(value)) {
        node[subNode.name] = subNode;

        subNode.a = value as number[];
      } else {
        node[subNode.name] = value;
      }
    } else if (name === "Connections" && subNode.name === "C") {
      const array: FBXValue[] = [];

      subNode.propertyList.forEach((property, i) => {
        // first Connection is FBX type (OO, OP, etc.). We'll discard these
        if (i !== 0) array.push(property);
      });

      if (node.connections === undefined) {
        node.connections = [];
      }

      (node.connections as FBXStoredValue[][]).push(array);
    } else if (subNode.name === "Properties70") {
      const keys = Object.keys(subNode);

      keys.forEach((key) => {
        const stored = subNode[key];
        if (key !== "name" && key !== "propertyList") node[key] = stored;
      });
    } else if (name === "Properties70" && subNode.name === "P") {
      const [nameValue, ...rest] = subNode.propertyList;
      if (typeof nameValue !== "string") throw new Error("THREE.FBXLoader: Malformed property name.");
      const typeValue = rest[0];
      if (typeof typeValue !== "string") throw new Error("THREE.FBXLoader: Malformed property type.");

      let innerPropName: string = nameValue;
      let innerPropType1: string = typeValue;
      const innerPropType2 = rest[1];
      const innerPropFlag = rest[2];
      let innerPropValue: FBXValue;

      if (innerPropName.indexOf("Lcl ") === 0) innerPropName = innerPropName.replace("Lcl ", "Lcl_");
      if (innerPropType1.indexOf("Lcl ") === 0) innerPropType1 = innerPropType1.replace("Lcl ", "Lcl_");

      if (
        innerPropType1 === "Color" ||
        innerPropType1 === "ColorRGB" ||
        innerPropType1 === "Vector" ||
        innerPropType1 === "Vector3D" ||
        innerPropType1.indexOf("Lcl_") === 0
      ) {
        innerPropValue = [rest[3], rest[4], rest[5]] as number[];
      } else {
        innerPropValue = rest[3];
      }

      // this will be copied to parent, see above
      node[innerPropName] = {
        type: innerPropType1,
        type2: innerPropType2,
        flag: innerPropFlag,
        value: innerPropValue,
      };
    } else if (node[subNode.name] === undefined) {
      if (typeof subNode.id === "number") {
        const table: FBXDynamicNode = {};
        table[subNode.id] = subNode;
        node[subNode.name] = table;
      } else {
        node[subNode.name] = subNode;
      }
    } else {
      const existing = node[subNode.name];

      if (subNode.name === "PoseNode") {
        if (Array.isArray(existing)) (existing as FBXDynamicNode[]).push(subNode);
        else node[subNode.name] = [existing as FBXDynamicNode, subNode];
      } else if (isNodeRecord(existing) && subNode.id !== undefined && existing[subNode.id] === undefined) {
        existing[subNode.id] = subNode;
      }
    }
  }

  parseProperty(reader: BinaryReader): FBXValue {
    const type = reader.getString(1);
    let length: number;

    switch (type) {
      case "C":
        return reader.getBoolean();

      case "D":
        return reader.getFloat64();

      case "F":
        return reader.getFloat32();

      case "I":
        return reader.getInt32();

      case "L":
        return reader.getInt64();

      case "R":
        length = reader.getUint32();
        return reader.getArrayBuffer(length);

      case "S":
        length = reader.getUint32();
        return reader.getString(length);

      case "Y":
        return reader.getInt16();

      case "b":
      case "c":
      case "d":
      case "f":
      case "i":
      case "l": {
        const arrayLength = reader.getUint32();
        const encoding = reader.getUint32(); // 0: non-compressed, 1: compressed
        const compressedLength = reader.getUint32();

        if (encoding === 0) {
          switch (type) {
            case "b":
            case "c":
              return reader.getBooleanArray(arrayLength);

            case "d":
              return reader.getFloat64Array(arrayLength);

            case "f":
              return reader.getFloat32Array(arrayLength);

            case "i":
              return reader.getInt32Array(arrayLength);

            case "l":
              return reader.getInt64Array(arrayLength);
          }
        }

        if (this.zlibDecoder === null) {
          throw new Error(
            "THREE.FBXLoader: This FBX file stores array properties compressed. Call setZlibDecoder( runtime ) with an fflate-compatible unzlibSync before parsing.",
          );
        }

        const data = this.zlibDecoder.unzlibSync(new Uint8Array(reader.getArrayBuffer(compressedLength)));
        const reader2 = new BinaryReader(data.buffer);

        switch (type) {
          case "b":
          case "c":
            return reader2.getBooleanArray(arrayLength);

          case "d":
            return reader2.getFloat64Array(arrayLength);

          case "f":
            return reader2.getFloat32Array(arrayLength);

          case "i":
            return reader2.getInt32Array(arrayLength);

          case "l":
            return reader2.getInt64Array(arrayLength);
        }

        throw new Error("THREE.FBXLoader: Compressed property type " + type + " is not supported.");
      }

      default:
        throw new Error("THREE.FBXLoader: Unknown property type " + type);
    }
  }
}

class BinaryReader {
  dv: DataView;
  offset: number;
  littleEndian: boolean;
  _textDecoder: TextDecoder;

  constructor(buffer: ArrayBufferLike, littleEndian?: boolean) {
    this.dv = new DataView(buffer);
    this.offset = 0;
    this.littleEndian = littleEndian !== undefined ? littleEndian : true;
    this._textDecoder = new TextDecoder();
  }

  getOffset(): number {
    return this.offset;
  }

  size(): number {
    return this.dv.buffer.byteLength;
  }

  skip(length: number): void {
    this.offset += length;
  }

  // seems like true/false representation depends on exporter.
  // true: 1 or 'Y'(=0x59), false: 0 or 'T'(=0x54)
  // then sees LSB.
  getBoolean(): boolean {
    return (this.getUint8() & 1) === 1;
  }

  getBooleanArray(size: number): boolean[] {
    const a: boolean[] = [];

    for (let i = 0; i < size; i++) {
      a.push(this.getBoolean());
    }

    return a;
  }

  getUint8(): number {
    const value = this.dv.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  getInt16(): number {
    const value = this.dv.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  getInt32(): number {
    const value = this.dv.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  getInt32Array(size: number): number[] {
    const a: number[] = [];

    for (let i = 0; i < size; i++) {
      a.push(this.getInt32());
    }

    return a;
  }

  getUint32(): number {
    const value = this.dv.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  // JavaScript doesn't support 64-bit integer so calculate this here
  // 1 << 32 will return 1 so using multiply operation instead here.
  // There's a possibility that this method returns wrong value if the value
  // is out of the range between Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER.
  // TODO: safely handle 64-bit integer
  getInt64(): number {
    let low, high;

    if (this.littleEndian) {
      low = this.getUint32();
      high = this.getUint32();
    } else {
      high = this.getUint32();
      low = this.getUint32();
    }

    // calculate negative value
    if (high & 0x80000000) {
      high = ~high & 0xffffffff;
      low = ~low & 0xffffffff;

      if (low === 0xffffffff) high = (high + 1) & 0xffffffff;

      low = (low + 1) & 0xffffffff;

      return -(high * 0x100000000 + low);
    }

    return high * 0x100000000 + low;
  }

  getInt64Array(size: number): number[] {
    const a: number[] = [];

    for (let i = 0; i < size; i++) {
      a.push(this.getInt64());
    }

    return a;
  }

  // Note: see getInt64() comment
  getUint64(): number {
    let low, high;

    if (this.littleEndian) {
      low = this.getUint32();
      high = this.getUint32();
    } else {
      high = this.getUint32();
      low = this.getUint32();
    }

    return high * 0x100000000 + low;
  }

  getFloat32(): number {
    const value = this.dv.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  getFloat32Array(size: number): number[] {
    const a: number[] = [];

    for (let i = 0; i < size; i++) {
      a.push(this.getFloat32());
    }

    return a;
  }

  getFloat64(): number {
    const value = this.dv.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  getFloat64Array(size: number): number[] {
    const a: number[] = [];

    for (let i = 0; i < size; i++) {
      a.push(this.getFloat64());
    }

    return a;
  }

  getArrayBuffer(size: number): ArrayBufferLike {
    const value = this.dv.buffer.slice(this.offset, this.offset + size);
    this.offset += size;
    return value;
  }

  getString(size: number): string {
    const start = this.offset;
    let a = new Uint8Array(this.dv.buffer, start, size);

    this.skip(size);

    const nullByte = a.indexOf(0);
    if (nullByte >= 0) a = new Uint8Array(this.dv.buffer, start, nullByte);

    return this._textDecoder.decode(a);
  }
}

// FBXTree holds a representation of the FBX data, returned by the TextParser ( FBX ASCII format)
// and BinaryParser( FBX Binary format)
/** Root builder shared by both parsers; `add()` records top-level nodes by name. */
/** Root builder shared by both parsers; `add()` records a top-level section by name. */
class FBXTree implements FBXRootTree {
  Objects: FBXObjectsTable = {};
  Connections?: FBXConnectionsNode;
  GlobalSettings?: FBXGlobalSettings;
  /** Sections the loader does not read (Definitions, Takes, Documents, header) are kept as-is. */
  extra: Record<string, FBXNode> = {};

  add(key: string, val: FBXDynamicNode): void {
    switch (key) {
      case "Objects":
        // The parser fills Objects from file-discovered keys; `FBXObjectsTable` names the tables the loader reads.
        this.Objects = val as unknown as FBXObjectsTable;
        return;
      case "Connections":
        this.Connections = val as unknown as FBXConnectionsNode;
        return;
      case "GlobalSettings":
        this.GlobalSettings = val as unknown as FBXGlobalSettings;
        return;
      default:
        this.extra[key] = val as FBXNode;
        return;
    }
  }
}

// ************** UTILITY FUNCTIONS **************

function isFbxFormatBinary(buffer: ArrayBufferLike): boolean {
  const CORRECT = "Kaydara\u0020FBX\u0020Binary\u0020\u0020\0";

  return buffer.byteLength >= CORRECT.length && CORRECT === convertArrayBufferToString(buffer, 0, CORRECT.length);
}

function isFbxFormatASCII(text: string): boolean {
  const CORRECT = [
    "K",
    "a",
    "y",
    "d",
    "a",
    "r",
    "a",
    "\\",
    "F",
    "B",
    "X",
    "\\",
    "B",
    "i",
    "n",
    "a",
    "r",
    "y",
    "\\",
    "\\",
  ];

  // A binary file's magic matches this escaped prefix at some position, so no match means ASCII FBX.
  return CORRECT.every((character, i) => text[i] !== character);
}

function getFbxVersion(text: string): number {
  const versionRegExp = /FBXVersion: (\d+)/;
  const match = text.match(versionRegExp);

  if (match) {
    const version = parseInt(match[1]);
    return version;
  }

  throw new Error("THREE.FBXLoader: Cannot find the version number for the file given.");
}

// Converts FBX ticks into real time seconds.
function convertFBXTimeToSeconds(time: number): number {
  return time / 46186158000;
}

const dataArray: number[] = [];

// extracts the data from the correct position in the FBX array based on indexing type
function getData(
  polygonVertexIndex: number,
  polygonIndex: number,
  vertexIndex: number,
  infoObject: AttributeInfo,
): number[] {
  let index: number;

  switch (infoObject.mappingType) {
    case "ByPolygonVertex":
      index = polygonVertexIndex;
      break;
    case "ByPolygon":
      index = polygonIndex;
      break;
    case "ByVertice":
      index = vertexIndex;
      break;
    case "AllSame":
      index = infoObject.indices[0];
      break;
    default:
      console.warn("THREE.FBXLoader: unknown attribute mapping type " + infoObject.mappingType);
      index = Number.NaN;
  }

  if (infoObject.referenceType === "IndexToDirect") index = infoObject.indices[index];

  const from = index * infoObject.dataSize;
  const to = from + infoObject.dataSize;

  return slice(dataArray, infoObject.buffer, from, to);
}

const tempEuler = new Euler();
const tempVec = new Vector3();

// generate transformation from FBX transform data
// ref: https://help.autodesk.com/view/FBX/2017/ENU/?guid=__files_GUID_10CDD63C_79C1_4F2D_BB28_AD2BE65A02ED_htm
// ref: http://docs.autodesk.com/FBX/2014/ENU/FBX-SDK-Documentation/index.html?url=cpp_ref/_transformations_2main_8cxx-example.html,topicNumber=cpp_ref__transformations_2main_8cxx_example_htmlfc10a1e1-b18d-4e72-9dc0-70d0f1959f5e
function generateTransform(transformData: TransformData): Matrix4 {
  const lTranslationM = new Matrix4();
  const lPreRotationM = new Matrix4();
  const lRotationM = new Matrix4();
  const lPostRotationM = new Matrix4();

  const lScalingM = new Matrix4();
  const lScalingPivotM = new Matrix4();
  const lScalingOffsetM = new Matrix4();
  const lRotationOffsetM = new Matrix4();
  const lRotationPivotM = new Matrix4();

  const lParentGX = new Matrix4();
  const lParentLX = new Matrix4();
  const lGlobalT = new Matrix4();

  const inheritType = transformData.inheritType ? transformData.inheritType : 0;

  if (transformData.translation) lTranslationM.setPosition(tempVec.fromArray(transformData.translation));

  // For Maya models using "Joint Orient", Euler order only applies to rotation, not pre/post-rotations
  const defaultEulerOrder = getEulerOrder(0);

  if (transformData.preRotation) {
    const array = transformData.preRotation.map(degToRad);

    tempEuler.set(array[0], array[1], array[2], defaultEulerOrder);
    lPreRotationM.makeRotationFromEuler(tempEuler);
  }

  if (transformData.rotation) {
    const array = transformData.rotation.map(degToRad);

    tempEuler.set(array[0], array[1], array[2], transformData.eulerOrder || defaultEulerOrder);
    lRotationM.makeRotationFromEuler(tempEuler);
  }

  if (transformData.postRotation) {
    const array = transformData.postRotation.map(degToRad);

    tempEuler.set(array[0], array[1], array[2], defaultEulerOrder);
    lPostRotationM.makeRotationFromEuler(tempEuler);
    lPostRotationM.invert();
  }

  if (transformData.scale) lScalingM.scale(tempVec.fromArray(transformData.scale));

  // Pivots and offsets
  if (transformData.scalingOffset) lScalingOffsetM.setPosition(tempVec.fromArray(transformData.scalingOffset));
  if (transformData.scalingPivot) lScalingPivotM.setPosition(tempVec.fromArray(transformData.scalingPivot));
  if (transformData.rotationOffset) lRotationOffsetM.setPosition(tempVec.fromArray(transformData.rotationOffset));
  if (transformData.rotationPivot) lRotationPivotM.setPosition(tempVec.fromArray(transformData.rotationPivot));

  // parent transform
  if (transformData.parentMatrixWorld && transformData.parentMatrix) {
    lParentLX.copy(transformData.parentMatrix);
    lParentGX.copy(transformData.parentMatrixWorld);
  }

  const lLRM = lPreRotationM.clone().multiply(lRotationM).multiply(lPostRotationM);
  // Global Rotation
  const lParentGRM = new Matrix4();
  lParentGRM.extractRotation(lParentGX);

  // Global Shear*Scaling
  const lParentTM = new Matrix4();
  lParentTM.copyPosition(lParentGX);

  const lParentGRSM = lParentTM.clone().invert().multiply(lParentGX);
  const lParentGSM = lParentGRM.clone().invert().multiply(lParentGRSM);
  const lLSM = lScalingM;

  const lGlobalRS = new Matrix4();

  if (inheritType === 0) {
    lGlobalRS.copy(lParentGRM).multiply(lLRM).multiply(lParentGSM).multiply(lLSM);
  } else if (inheritType === 1) {
    lGlobalRS.copy(lParentGRM).multiply(lParentGSM).multiply(lLRM).multiply(lLSM);
  } else {
    const lParentLSM = new Matrix4().scale(new Vector3().setFromMatrixScale(lParentLX));
    const lParentLSM_inv = lParentLSM.clone().invert();
    const lParentGSM_noLocal = lParentGSM.clone().multiply(lParentLSM_inv);

    lGlobalRS.copy(lParentGRM).multiply(lLRM).multiply(lParentGSM_noLocal).multiply(lLSM);
  }

  const lRotationPivotM_inv = lRotationPivotM.clone().invert();
  const lScalingPivotM_inv = lScalingPivotM.clone().invert();
  // Calculate the local transform matrix
  let lTransform = lTranslationM
    .clone()
    .multiply(lRotationOffsetM)
    .multiply(lRotationPivotM)
    .multiply(lPreRotationM)
    .multiply(lRotationM)
    .multiply(lPostRotationM)
    .multiply(lRotationPivotM_inv)
    .multiply(lScalingOffsetM)
    .multiply(lScalingPivotM)
    .multiply(lScalingM)
    .multiply(lScalingPivotM_inv);

  const lLocalTWithAllPivotAndOffsetInfo = new Matrix4().copyPosition(lTransform);

  const lGlobalTranslation = lParentGX.clone().multiply(lLocalTWithAllPivotAndOffsetInfo);
  lGlobalT.copyPosition(lGlobalTranslation);

  lTransform = lGlobalT.clone().multiply(lGlobalRS);

  // from global to local
  lTransform.premultiply(lParentGX.invert());

  return lTransform;
}

// Returns the three.js intrinsic Euler order corresponding to FBX extrinsic Euler order
// ref: http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_class_fbx_euler_html
function getEulerOrder(order: number): string {
  order = order || 0;

  const enums = [
    "ZYX", // -> XYZ extrinsic
    "YZX", // -> XZY extrinsic
    "XZY", // -> YZX extrinsic
    "ZXY", // -> YXZ extrinsic
    "YXZ", // -> ZXY extrinsic
    "XYZ", // -> ZYX extrinsic
    //'SphericXYZ', // not possible to support
  ];

  if (order === 6) {
    console.warn("THREE.FBXLoader: unsupported Euler Order: Spherical XYZ. Animations and rotations may be incorrect.");
    return enums[0];
  }

  const eulerOrder = enums[order];

  if (eulerOrder === undefined) {
    console.warn("THREE.FBXLoader: unknown Euler Order " + order + ", defaulting to ZYX.");
    return enums[0];
  }

  return eulerOrder;
}

// Parses comma separated list of numbers and returns them an array.
// Used internally by the TextParser
function parseNumberArray(value: string): number[] {
  const array = value.split(",").map((val) => {
    return parseFloat(val);
  });

  return array;
}

function convertArrayBufferToString(buffer: ArrayBufferLike, from?: number, to?: number): string {
  if (from === undefined) from = 0;
  if (to === undefined) to = buffer.byteLength;

  return new TextDecoder().decode(new Uint8Array(buffer, from, to));
}

function append(a: (number | string)[], b: string[]): void {
  for (let i = 0, j = a.length, l = b.length; i < l; i++, j++) {
    a[j] = b[i];
  }
}

function slice(a: number[], b: ArrayLike<number>, from: number, to: number): number[] {
  for (let i = from, j = 0; i < to; i++, j++) {
    a[j] = b[i];
  }

  return a;
}

/** Narrows a stored value to a child node record (not an array or scalar). */
function isNodeRecord(value: FBXStoredValue): value is FBXDynamicNode {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(value)
  );
}

/**
 * Records one animation channel on a layer node. The FBX curve node name (`T`, `R`, `S`,
 * `DeformPercent`) selects the channel the track generator reads.
 */
function setLayerChannel(node: AnimationLayerNode, attr: string, curveNode: CurveNode): void {
  switch (attr) {
    case "T":
      node.T = curveNode;
      return;
    case "R":
      node.R = curveNode;
      return;
    case "S":
      node.S = curveNode;
      return;
    case "DeformPercent":
      node.DeformPercent = curveNode;
      return;
    default:
      // Other channels (visibility, lock weights) are not animatable through this loader.
      return;
  }
}

/** Reads the FBX node id stored on parsed scene objects. */
function getFBXID(object: Object3D): number | undefined {
  return (object as Object3D & { ID?: number }).ID;
}

/** Stores the FBX node id on parsed scene objects. */
function setFBXID(object: Object3D, id: number): void {
  (object as Object3D & { ID?: number }).ID = id;
}
