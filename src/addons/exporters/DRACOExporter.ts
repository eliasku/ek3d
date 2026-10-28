import { SRGBColorSpace } from "../../constants";
import type { BufferAttribute } from "../../core/BufferAttribute";
import { Color } from "../../math/Color";
import { ColorManagement } from "../../math/ColorManagement";
import type { Mesh } from "../../objects/Mesh";
import type { Points } from "../../objects/Points";

export interface DracoEncoderOptions {
  decodeSpeed?: number;
  encodeSpeed?: number;
  encoderMethod?: number;
  quantization?: number[];
  exportUvs?: boolean;
  exportNormals?: boolean;
  exportColor?: boolean;
}

interface DracoArray {
  GetValue(index: number): number;
}
interface DracoMeshBuilder {
  AddFloatAttributeToMesh(mesh: object, type: number, count: number, size: number, values: ArrayLike<number>): void;
  AddFacesToMesh(mesh: object, count: number, values: ArrayLike<number>): void;
}
interface DracoPointCloudBuilder {
  AddFloatAttribute(cloud: object, type: number, count: number, size: number, values: ArrayLike<number>): void;
}
interface DracoEncoder {
  SetSpeedOptions(encode: number, decode: number): void;
  SetEncodingMethod(method: number): void;
  SetAttributeQuantization(attribute: number, bits: number): void;
  EncodeMeshToDracoBuffer(mesh: object, data: DracoArray): number;
  EncodePointCloudToDracoBuffer(cloud: object, deduplicate: boolean, data: DracoArray): number;
}
/** An initialized Draco encoder module supplied by the consumer. */
export interface DracoEncoderModule {
  Encoder: new () => DracoEncoder;
  MeshBuilder: new () => DracoMeshBuilder;
  PointCloudBuilder: new () => DracoPointCloudBuilder;
  Mesh: new () => object;
  PointCloud: new () => object;
  DracoInt8Array: new () => DracoArray;
  POSITION: number;
  NORMAL: number;
  TEX_COORD: number;
  COLOR: number;
  destroy(value: object): void;
}

/** Compresses a mesh or point cloud using an initialized Draco encoder module. */
export class DRACOExporter {
  static MESH_EDGEBREAKER_ENCODING: number = 1;
  static MESH_SEQUENTIAL_ENCODING: number = 0;
  static POINT_CLOUD: number = 0;
  static TRIANGULAR_MESH: number = 1;
  static INVALID: number = -1;
  static POSITION: number = 0;
  static NORMAL: number = 1;
  static COLOR: number = 2;
  static TEX_COORD: number = 3;
  static GENERIC: number = 4;
  private readonly module: DracoEncoderModule;

  constructor(module: DracoEncoderModule) {
    this.module = module;
  }

  async parseAsync(object: Mesh | Points, options: DracoEncoderOptions = {}): Promise<Int8Array> {
    const settings = {
      decodeSpeed: 5,
      encodeSpeed: 5,
      encoderMethod: DRACOExporter.MESH_EDGEBREAKER_ENCODING,
      quantization: [16, 8, 8, 8, 8],
      exportUvs: true,
      exportNormals: true,
      exportColor: false,
      ...options,
    };
    const draco = this.module;
    const geometry = object.geometry;
    const vertices = geometry.getAttribute("position") as BufferAttribute;
    let encoder: DracoEncoder | undefined;
    let builder: DracoMeshBuilder | DracoPointCloudBuilder | undefined;
    let dracoObject: object | undefined;
    let encoded: DracoArray | undefined;
    try {
      encoder = new draco.Encoder();
      const isMesh = "isMesh" in object && object.isMesh === true;
      if (isMesh) {
        const meshBuilder = new draco.MeshBuilder();
        builder = meshBuilder;
        dracoObject = new draco.Mesh();
        meshBuilder.AddFloatAttributeToMesh(
          dracoObject,
          draco.POSITION,
          vertices.count,
          vertices.itemSize,
          vertices.array,
        );
        const index = geometry.getIndex();
        if (index !== null) meshBuilder.AddFacesToMesh(dracoObject, index.count / 3, index.array);
        else {
          const faces = new (vertices.count > 65535 ? Uint32Array : Uint16Array)(vertices.count);
          for (let i = 0; i < faces.length; i++) faces[i] = i;
          // The builder expects a triangle count, not the vertex count used upstream.
          meshBuilder.AddFacesToMesh(dracoObject, vertices.count / 3, faces);
        }
        const normals = geometry.getAttribute("normal") as BufferAttribute | undefined;
        if (settings.exportNormals && normals)
          meshBuilder.AddFloatAttributeToMesh(
            dracoObject,
            draco.NORMAL,
            normals.count,
            normals.itemSize,
            normals.array,
          );
        const uvs = geometry.getAttribute("uv") as BufferAttribute | undefined;
        if (settings.exportUvs && uvs)
          meshBuilder.AddFloatAttributeToMesh(dracoObject, draco.TEX_COORD, uvs.count, uvs.itemSize, uvs.array);
        const colors = geometry.getAttribute("color") as BufferAttribute | undefined;
        if (settings.exportColor && colors)
          meshBuilder.AddFloatAttributeToMesh(
            dracoObject,
            draco.COLOR,
            colors.count,
            colors.itemSize,
            vertexColors(colors),
          );
      } else if ("isPoints" in object && object.isPoints === true) {
        const pointBuilder = new draco.PointCloudBuilder();
        builder = pointBuilder;
        dracoObject = new draco.PointCloud();
        pointBuilder.AddFloatAttribute(dracoObject, draco.POSITION, vertices.count, vertices.itemSize, vertices.array);
        const colors = geometry.getAttribute("color") as BufferAttribute | undefined;
        if (settings.exportColor && colors)
          pointBuilder.AddFloatAttribute(dracoObject, draco.COLOR, colors.count, colors.itemSize, vertexColors(colors));
      } else {
        throw new Error("THREE.DRACOExporter: Unsupported object type.");
      }
      encoded = new draco.DracoInt8Array();
      encoder.SetSpeedOptions(settings.encodeSpeed ?? 5, settings.decodeSpeed ?? 5);
      if (settings.encoderMethod !== undefined) encoder.SetEncodingMethod(settings.encoderMethod);
      if (settings.quantization !== undefined)
        for (let i = 0; i < 5; i++) {
          if (settings.quantization[i] !== undefined) encoder.SetAttributeQuantization(i, settings.quantization[i]);
        }
      const length = isMesh
        ? encoder.EncodeMeshToDracoBuffer(dracoObject, encoded)
        : encoder.EncodePointCloudToDracoBuffer(dracoObject, true, encoded);
      if (length === 0) throw new Error("THREE.DRACOExporter: Draco encoding failed.");
      const output = new Int8Array(length);
      for (let i = 0; i < length; i++) output[i] = encoded.GetValue(i);
      return output;
    } finally {
      if (dracoObject !== undefined) draco.destroy(dracoObject);
      if (encoded !== undefined) draco.destroy(encoded);
      if (encoder !== undefined) draco.destroy(encoder);
      if (builder !== undefined) draco.destroy(builder);
    }
  }

  parse(): never {
    throw new Error("THREE.DRACOExporter: parse() has been replaced by parseAsync().");
  }
}

function vertexColors(attribute: BufferAttribute): Float32Array {
  const color = new Color();
  const array = new Float32Array(attribute.count * attribute.itemSize);
  for (let i = 0; i < attribute.count; i++) {
    color.fromBufferAttribute(attribute, i);
    ColorManagement.workingToColorSpace(color, SRGBColorSpace);
    const offset = i * attribute.itemSize;
    array[offset] = color.r;
    array[offset + 1] = color.g;
    array[offset + 2] = color.b;
    if (attribute.itemSize === 4) array[offset + 3] = attribute.getW(i);
  }
  return array;
}
