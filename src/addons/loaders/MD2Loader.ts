import { AnimationClip } from "../../animation/AnimationClip";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";

const normalData = [
  [-0.525731, 0.0, 0.850651],
  [-0.442863, 0.238856, 0.864188],
  [-0.295242, 0.0, 0.955423],
  [-0.309017, 0.5, 0.809017],
  [-0.16246, 0.262866, 0.951056],
  [0.0, 0.0, 1.0],
  [0.0, 0.850651, 0.525731],
  [-0.147621, 0.716567, 0.681718],
  [0.147621, 0.716567, 0.681718],
  [0.0, 0.525731, 0.850651],
  [0.309017, 0.5, 0.809017],
  [0.525731, 0.0, 0.850651],
  [0.295242, 0.0, 0.955423],
  [0.442863, 0.238856, 0.864188],
  [0.16246, 0.262866, 0.951056],
  [-0.681718, 0.147621, 0.716567],
  [-0.809017, 0.309017, 0.5],
  [-0.587785, 0.425325, 0.688191],
  [-0.850651, 0.525731, 0.0],
  [-0.864188, 0.442863, 0.238856],
  [-0.716567, 0.681718, 0.147621],
  [-0.688191, 0.587785, 0.425325],
  [-0.5, 0.809017, 0.309017],
  [-0.238856, 0.864188, 0.442863],
  [-0.425325, 0.688191, 0.587785],
  [-0.716567, 0.681718, -0.147621],
  [-0.5, 0.809017, -0.309017],
  [-0.525731, 0.850651, 0.0],
  [0.0, 0.850651, -0.525731],
  [-0.238856, 0.864188, -0.442863],
  [0.0, 0.955423, -0.295242],
  [-0.262866, 0.951056, -0.16246],
  [0.0, 1.0, 0.0],
  [0.0, 0.955423, 0.295242],
  [-0.262866, 0.951056, 0.16246],
  [0.238856, 0.864188, 0.442863],
  [0.262866, 0.951056, 0.16246],
  [0.5, 0.809017, 0.309017],
  [0.238856, 0.864188, -0.442863],
  [0.262866, 0.951056, -0.16246],
  [0.5, 0.809017, -0.309017],
  [0.850651, 0.525731, 0.0],
  [0.716567, 0.681718, 0.147621],
  [0.716567, 0.681718, -0.147621],
  [0.525731, 0.850651, 0.0],
  [0.425325, 0.688191, 0.587785],
  [0.864188, 0.442863, 0.238856],
  [0.688191, 0.587785, 0.425325],
  [0.809017, 0.309017, 0.5],
  [0.681718, 0.147621, 0.716567],
  [0.587785, 0.425325, 0.688191],
  [0.955423, 0.295242, 0.0],
  [1.0, 0.0, 0.0],
  [0.951056, 0.16246, 0.262866],
  [0.850651, -0.525731, 0.0],
  [0.955423, -0.295242, 0.0],
  [0.864188, -0.442863, 0.238856],
  [0.951056, -0.16246, 0.262866],
  [0.809017, -0.309017, 0.5],
  [0.681718, -0.147621, 0.716567],
  [0.850651, 0.0, 0.525731],
  [0.864188, 0.442863, -0.238856],
  [0.809017, 0.309017, -0.5],
  [0.951056, 0.16246, -0.262866],
  [0.525731, 0.0, -0.850651],
  [0.681718, 0.147621, -0.716567],
  [0.681718, -0.147621, -0.716567],
  [0.850651, 0.0, -0.525731],
  [0.809017, -0.309017, -0.5],
  [0.864188, -0.442863, -0.238856],
  [0.951056, -0.16246, -0.262866],
  [0.147621, 0.716567, -0.681718],
  [0.309017, 0.5, -0.809017],
  [0.425325, 0.688191, -0.587785],
  [0.442863, 0.238856, -0.864188],
  [0.587785, 0.425325, -0.688191],
  [0.688191, 0.587785, -0.425325],
  [-0.147621, 0.716567, -0.681718],
  [-0.309017, 0.5, -0.809017],
  [0.0, 0.525731, -0.850651],
  [-0.525731, 0.0, -0.850651],
  [-0.442863, 0.238856, -0.864188],
  [-0.295242, 0.0, -0.955423],
  [-0.16246, 0.262866, -0.951056],
  [0.0, 0.0, -1.0],
  [0.295242, 0.0, -0.955423],
  [0.16246, 0.262866, -0.951056],
  [-0.442863, -0.238856, -0.864188],
  [-0.309017, -0.5, -0.809017],
  [-0.16246, -0.262866, -0.951056],
  [0.0, -0.850651, -0.525731],
  [-0.147621, -0.716567, -0.681718],
  [0.147621, -0.716567, -0.681718],
  [0.0, -0.525731, -0.850651],
  [0.309017, -0.5, -0.809017],
  [0.442863, -0.238856, -0.864188],
  [0.16246, -0.262866, -0.951056],
  [0.238856, -0.864188, -0.442863],
  [0.5, -0.809017, -0.309017],
  [0.425325, -0.688191, -0.587785],
  [0.716567, -0.681718, -0.147621],
  [0.688191, -0.587785, -0.425325],
  [0.587785, -0.425325, -0.688191],
  [0.0, -0.955423, -0.295242],
  [0.0, -1.0, 0.0],
  [0.262866, -0.951056, -0.16246],
  [0.0, -0.850651, 0.525731],
  [0.0, -0.955423, 0.295242],
  [0.238856, -0.864188, 0.442863],
  [0.262866, -0.951056, 0.16246],
  [0.5, -0.809017, 0.309017],
  [0.716567, -0.681718, 0.147621],
  [0.525731, -0.850651, 0.0],
  [-0.238856, -0.864188, -0.442863],
  [-0.5, -0.809017, -0.309017],
  [-0.262866, -0.951056, -0.16246],
  [-0.850651, -0.525731, 0.0],
  [-0.716567, -0.681718, -0.147621],
  [-0.716567, -0.681718, 0.147621],
  [-0.525731, -0.850651, 0.0],
  [-0.5, -0.809017, 0.309017],
  [-0.238856, -0.864188, 0.442863],
  [-0.262866, -0.951056, 0.16246],
  [-0.864188, -0.442863, 0.238856],
  [-0.809017, -0.309017, 0.5],
  [-0.688191, -0.587785, 0.425325],
  [-0.681718, -0.147621, 0.716567],
  [-0.442863, -0.238856, 0.864188],
  [-0.587785, -0.425325, 0.688191],
  [-0.309017, -0.5, 0.809017],
  [-0.147621, -0.716567, 0.681718],
  [-0.425325, -0.688191, 0.587785],
  [-0.16246, -0.262866, 0.951056],
  [0.442863, -0.238856, 0.864188],
  [0.16246, -0.262866, 0.951056],
  [0.309017, -0.5, 0.809017],
  [0.147621, -0.716567, 0.681718],
  [0.0, -0.525731, 0.850651],
  [0.425325, -0.688191, 0.587785],
  [0.587785, -0.425325, 0.688191],
  [0.688191, -0.587785, 0.425325],
  [-0.955423, 0.295242, 0.0],
  [-0.951056, 0.16246, 0.262866],
  [-1.0, 0.0, 0.0],
  [-0.850651, 0.0, 0.525731],
  [-0.955423, -0.295242, 0.0],
  [-0.951056, -0.16246, 0.262866],
  [-0.864188, 0.442863, -0.238856],
  [-0.951056, 0.16246, -0.262866],
  [-0.809017, 0.309017, -0.5],
  [-0.864188, -0.442863, -0.238856],
  [-0.951056, -0.16246, -0.262866],
  [-0.809017, -0.309017, -0.5],
  [-0.681718, 0.147621, -0.716567],
  [-0.681718, -0.147621, -0.716567],
  [-0.850651, 0.0, -0.525731],
  [-0.688191, 0.587785, -0.425325],
  [-0.587785, 0.425325, -0.688191],
  [-0.425325, 0.688191, -0.587785],
  [-0.425325, -0.688191, -0.587785],
  [-0.587785, -0.425325, -0.688191],
  [-0.688191, -0.587785, -0.425325],
];

export class MD2Geometry extends BufferGeometry {
  animations: AnimationClip[] = [];
}

/** Loads Quake II MD2 geometry and named morph animation clips. */
export class MD2Loader extends Loader<MD2Geometry> {
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  override load(
    url: string,
    onLoad?: (geometry: MD2Geometry) => void,
    onProgress?: (event: ProgressEvent) => void,
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
      (data) => {
        try {
          if (!(data instanceof ArrayBuffer)) throw new TypeError("MD2Loader requires binary data");
          onLoad?.(this.parse(data));
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  parse(buffer: ArrayBuffer): MD2Geometry {
    if (buffer.byteLength < 68) throw new Error("Invalid MD2 header");
    const data = new DataView(buffer);
    const h = Array.from({ length: 17 }, (_, i) => data.getInt32(i * 4, true));
    const [
      ident,
      version,
      width,
      height,
      frameSize,
      skins,
      vertices,
      texcoords,
      triangles,
      commands,
      frameCount,
      skinOffset,
      uvOffset,
      triangleOffset,
      frameOffset,
      commandOffset,
      end,
    ] = h;
    if (
      ident !== 844121161 ||
      version !== 8 ||
      end !== buffer.byteLength ||
      width <= 0 ||
      height <= 0 ||
      vertices <= 0 ||
      texcoords <= 0 ||
      triangles <= 0 ||
      frameCount <= 0 ||
      skins < 0 ||
      commands < 0 ||
      frameSize < 40 + vertices * 4
    )
      throw new Error("Invalid MD2 header");
    const section = (offset: number, size: number): boolean => offset >= 68 && size >= 0 && offset + size <= end;
    if (
      !section(skinOffset, skins * 64) ||
      !section(uvOffset, texcoords * 4) ||
      !section(triangleOffset, triangles * 12) ||
      !section(frameOffset, frameCount * frameSize) ||
      !section(commandOffset, commands * 4)
    )
      throw new Error("Invalid MD2 section");
    const uv: number[] = [];
    for (let i = 0; i < texcoords; i++)
      uv.push(data.getInt16(uvOffset + i * 4, true) / width, 1 - data.getInt16(uvOffset + i * 4 + 2, true) / height);
    const indices: number[] = [],
      uvIndices: number[] = [];
    for (let i = 0; i < triangles; i++) {
      const offset = triangleOffset + i * 12;
      for (let j = 0; j < 3; j++) {
        const vertex = data.getUint16(offset + j * 2, true),
          texture = data.getUint16(offset + 6 + j * 2, true);
        if (vertex >= vertices || texture >= texcoords) throw new Error("Invalid MD2 triangle index");
        indices.push(vertex);
        uvIndices.push(texture);
      }
    }
    const geometry = new MD2Geometry();
    const morphPositions: Float32BufferAttribute[] = [],
      morphNormals: Float32BufferAttribute[] = [];
    const frames: { name: string }[] = [];
    for (let i = 0; i < frameCount; i++) {
      const offset = frameOffset + i * frameSize;
      const scale = [0, 1, 2].map((j) => data.getFloat32(offset + j * 4, true));
      const translation = [0, 1, 2].map((j) => data.getFloat32(offset + 12 + j * 4, true));
      let name = "";
      for (let j = 0; j < 16; j++) {
        const c = data.getUint8(offset + 24 + j);
        if (c === 0) break;
        name += String.fromCharCode(c);
      }
      frames.push({ name });
      const positions: number[] = [],
        normals: number[] = [];
      for (const index of indices) {
        const vertex = offset + 40 + index * 4;
        const x = data.getUint8(vertex) * scale[0] + translation[0];
        const y = data.getUint8(vertex + 1) * scale[1] + translation[1];
        const z = data.getUint8(vertex + 2) * scale[2] + translation[2];
        const normal = normalData[data.getUint8(vertex + 3)];
        if (!normal) throw new Error("Invalid MD2 normal index");
        positions.push(x, z, y);
        normals.push(normal[0], normal[2], normal[1]);
      }
      const position = new Float32BufferAttribute(positions, 3),
        normal = new Float32BufferAttribute(normals, 3);
      position.name = name;
      normal.name = name;
      morphPositions.push(position);
      morphNormals.push(normal);
    }
    geometry.setAttribute("position", morphPositions[0].clone());
    geometry.setAttribute("normal", morphNormals[0].clone());
    geometry.setAttribute(
      "uv",
      new Float32BufferAttribute(
        uvIndices.flatMap((index) => [uv[index * 2], uv[index * 2 + 1]]),
        2,
      ),
    );
    geometry.morphAttributes.position = morphPositions;
    geometry.morphAttributes.normal = morphNormals;
    geometry.animations = AnimationClip.CreateClipsFromMorphTargetSequences(frames, 10, false);
    return geometry;
  }
}
