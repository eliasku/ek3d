import { ColorSpace } from "../../constants";
import { BufferAttribute, Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { Loader } from "../../loaders/Loader";
import { Color } from "../../math/Color";
import { Vector3 } from "../../math/Vector3";

/**
 * Non-indexed STL geometry with optional binary "Magics" color metadata.
 */
export class STLGeometry extends BufferGeometry {
  /**
   * Whether the binary file declared per-facet colors via a `COLOR=` header.
   */
  hasColors: boolean | undefined = undefined;

  /**
   * Opacity declared by the binary header's `COLOR=rgba` default, when present.
   */
  alpha: number | undefined = undefined;
}

/** US-ASCII ordinal values for 's', 'o', 'l', 'i', 'd' */
const SOLID_BYTES = [115, 111, 108, 105, 100];

interface BinaryColorState {
  /** Allocated only when the header declared a `COLOR=` default. */
  colors: Float32Array | null;
  defaultR: number;
  defaultG: number;
  defaultB: number;
  alpha: number;
}

function isBinary(data: ArrayBufferLike): boolean {
  const reader = new DataView(data);
  const face_size = (32 / 8) * 3 + (32 / 8) * 3 * 3 + 16 / 8;
  const n_faces = reader.getUint32(80, true);
  const expect = 80 + 32 / 8 + n_faces * face_size;

  if (expect === reader.byteLength) {
    return true;
  }

  // An ASCII STL data must begin with 'solid ' as the first six bytes.
  // However, ASCII STLs lacking the SPACE after the 'd' are known to be
  // plentiful. So, check the first 5 bytes for 'solid'.

  // Several encodings, such as UTF-8, precede the text with up to 5 bytes:
  // https://en.wikipedia.org/wiki/Byte_order_mark#Byte_order_marks_by_encoding
  // Search for "solid" to start anywhere after those prefixes.

  for (let off = 0; off < 5; off++) {
    // If "solid" text is matched to the current offset, declare it to be an ASCII STL.

    if (matchDataViewAt(SOLID_BYTES, reader, off)) return false;
  }

  // Couldn't find "solid" text at the beginning; it is binary STL.

  return true;
}

function matchDataViewAt(query: number[], reader: DataView, offset: number): boolean {
  // Check if each byte in query matches the corresponding byte from the current offset

  for (let i = 0, il = query.length; i < il; i++) {
    if (query[i] !== reader.getUint8(offset + i)) return false;
  }

  return true;
}

function readHeaderColors(reader: DataView, faces: number): BinaryColorState {
  const state: BinaryColorState = {
    colors: null,
    defaultR: 1,
    defaultG: 1,
    defaultB: 1,
    alpha: 1,
  };

  // process STL header
  // check for default color in header ("COLOR=rgba" sequence).

  for (let index = 0; index <= 80 - 10; index++) {
    if (
      reader.getUint32(index, false) === 0x434f4c4f /*COLO*/ &&
      reader.getUint8(index + 4) === 0x52 /*'R'*/ &&
      reader.getUint8(index + 5) === 0x3d /*'='*/
    ) {
      state.colors = new Float32Array(faces * 3 * 3);

      state.defaultR = reader.getUint8(index + 6) / 255;
      state.defaultG = reader.getUint8(index + 7) / 255;
      state.defaultB = reader.getUint8(index + 8) / 255;
      state.alpha = reader.getUint8(index + 9) / 255;
    }
  }

  return state;
}

function parseBinary(data: ArrayBufferLike): STLGeometry {
  const reader = new DataView(data);
  const faces = reader.getUint32(80, true);

  let r = 0;
  let g = 0;
  let b = 0;

  const { colors, defaultR, defaultG, defaultB, alpha } = readHeaderColors(reader, faces);
  const dataOffset = 84;
  const faceLength = 12 * 4 + 2;

  const geometry = new STLGeometry();

  const vertices = new Float32Array(faces * 3 * 3);
  const normals = new Float32Array(faces * 3 * 3);

  const color = new Color();

  for (let face = 0; face < faces; face++) {
    const start = dataOffset + face * faceLength;
    const normalX = reader.getFloat32(start, true);
    const normalY = reader.getFloat32(start + 4, true);
    const normalZ = reader.getFloat32(start + 8, true);

    if (colors !== null) {
      const packedColor = reader.getUint16(start + 48, true);

      if ((packedColor & 0x8000) === 0) {
        // facet has its own unique color

        r = (packedColor & 0x1f) / 31;
        g = ((packedColor >> 5) & 0x1f) / 31;
        b = ((packedColor >> 10) & 0x1f) / 31;
      } else {
        r = defaultR;
        g = defaultG;
        b = defaultB;
      }
    }

    for (let i = 1; i <= 3; i++) {
      const vertexstart = start + i * 12;
      const componentIdx = face * 3 * 3 + (i - 1) * 3;

      vertices[componentIdx] = reader.getFloat32(vertexstart, true);
      vertices[componentIdx + 1] = reader.getFloat32(vertexstart + 4, true);
      vertices[componentIdx + 2] = reader.getFloat32(vertexstart + 8, true);

      normals[componentIdx] = normalX;
      normals[componentIdx + 1] = normalY;
      normals[componentIdx + 2] = normalZ;

      if (colors !== null) {
        color.setRGB(r, g, b, ColorSpace.SRGB);

        colors[componentIdx] = color.r;
        colors[componentIdx + 1] = color.g;
        colors[componentIdx + 2] = color.b;
      }
    }
  }

  geometry.setAttribute("position", new BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));

  if (colors !== null) {
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.hasColors = true;
    geometry.alpha = alpha;
  }

  return geometry;
}

function parseASCII(data: string): STLGeometry {
  const geometry = new STLGeometry();
  const patternSolid = /solid([\s\S]*?)endsolid/g;
  const patternFace = /facet([\s\S]*?)endfacet/g;
  const patternName = /solid\s(.+)/;
  let faceCounter = 0;

  const patternFloat = /[\s]+([+-]?(?:\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)/.source;
  const patternVertex = new RegExp("vertex" + patternFloat + patternFloat + patternFloat, "g");
  const patternNormal = new RegExp("normal" + patternFloat + patternFloat + patternFloat, "g");

  const vertices: number[] = [];
  const normals: number[] = [];
  const groupNames: string[] = [];

  const normal = new Vector3();

  let result: RegExpExecArray | null;

  let groupCount = 0;
  let startVertex = 0;
  let endVertex = 0;

  while ((result = patternSolid.exec(data)) !== null) {
    startVertex = endVertex;

    const solid = result[0];

    const nameResult = patternName.exec(solid);
    const name = nameResult !== null ? nameResult[1] : "";
    groupNames.push(name);

    while ((result = patternFace.exec(solid)) !== null) {
      let vertexCountPerFace = 0;
      let normalCountPerFace = 0;

      const text = result[0];

      while ((result = patternNormal.exec(text)) !== null) {
        normal.x = parseFloat(result[1]);
        normal.y = parseFloat(result[2]);
        normal.z = parseFloat(result[3]);
        normalCountPerFace++;
      }

      while ((result = patternVertex.exec(text)) !== null) {
        vertices.push(parseFloat(result[1]), parseFloat(result[2]), parseFloat(result[3]));
        normals.push(normal.x, normal.y, normal.z);
        vertexCountPerFace++;
        endVertex++;
      }

      // every face have to own ONE valid normal

      if (normalCountPerFace !== 1) {
        console.error("THREE.STLLoader: Something isn't right with the normal of face number " + faceCounter);
      }

      // each face have to own THREE valid vertices

      if (vertexCountPerFace !== 3) {
        console.error("THREE.STLLoader: Something isn't right with the vertices of face number " + faceCounter);
      }

      faceCounter++;
    }

    const start = startVertex;
    const count = endVertex - startVertex;

    geometry.userData.groupNames = groupNames;

    geometry.addGroup(start, count, groupCount);
    groupCount++;
  }

  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));

  return geometry;
}

function ensureString(buffer: ArrayBufferLike | string): string {
  if (typeof buffer !== "string") {
    return new TextDecoder().decode(buffer);
  }

  return buffer;
}

function ensureBinary(buffer: ArrayBufferLike | string): ArrayBufferLike {
  if (typeof buffer === "string") {
    const arrayBuffer = new Uint8Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      arrayBuffer[i] = buffer.charCodeAt(i) & 0xff; // implicitly assumes little-endian
    }

    return arrayBuffer.buffer;
  } else {
    return buffer;
  }
}

/**
 * A loader for the STL format, as created by Solidworks and other CAD programs.
 *
 * Supports both binary and ASCII encoded files. The loader returns a non-indexed buffer geometry.
 *
 * Limitations:
 * - Binary decoding supports "Magics" color format (http://en.wikipedia.org/wiki/STL_(file_format)#Color_in_binary_STL).
 * - There is perhaps some question as to how valid it is to always assume little-endian-ness.
 * - ASCII decoding assumes file is UTF-8.
 *
 * For binary STLs geometry might contain colors for vertices. To use it:
 * ```typescript
 * import { STLLoader } from "ek3d/addons/loaders/STLLoader";
 * import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
 * import { Mesh } from "ek3d/objects/Mesh";
 * import { Scene } from "ek3d/scenes/Scene";
 *
 * const scene = new Scene();
 * const geometry = await new STLLoader().loadAsync("./models/stl/binary/colored.stl");
 * const material = geometry.hasColors
 *   ? new MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: true })
 *   : new MeshPhongMaterial();
 * scene.add(new Mesh(geometry, material));
 * ```
 * For ASCII STLs containing multiple solids, each solid is assigned to a different group.
 * Groups can be used to assign a different color by defining an array of materials with the same length of
 * geometry.groups and passing it to the Mesh constructor:
 *
 * ```typescript
 * import { STLLoader } from "ek3d/addons/loaders/STLLoader";
 * import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
 * import { Mesh } from "ek3d/objects/Mesh";
 * import { Scene } from "ek3d/scenes/Scene";
 *
 * const scene = new Scene();
 * const geometry = await new STLLoader().loadAsync("./models/stl/ascii/multiple-solids.stl");
 * const colorMap = [0xff0000, 0x00ff00];
 * const materials = geometry.groups.map((_, i) => new MeshPhongMaterial({ color: colorMap[i] }));
 * scene.add(new Mesh(geometry, materials));
 * ```
 */
export class STLLoader extends Loader<STLGeometry, string> {
  /**
   * Constructs a new STL loader.
   *
   * @param manager - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  /**
   * Starts loading from the given URL and passes the loaded STL asset
   * to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  override load(
    url: string,
    onLoad?: (value: STLGeometry) => void,
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
      (text: unknown) => {
        try {
          const geometry = this.parse(text as ArrayBufferLike);
          if (onLoad !== undefined) onLoad(geometry);
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
   * Parses the given STL data and returns the resulting geometry.
   *
   * @param data - The raw STL data as an array buffer or, for ASCII files, a string.
   * @return The parsed geometry.
   */
  parse(data: ArrayBufferLike | string): STLGeometry {
    // start

    const binData = ensureBinary(data);

    return isBinary(binData) ? parseBinary(binData) : parseASCII(ensureString(data));
  }
}
