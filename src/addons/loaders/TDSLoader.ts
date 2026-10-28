import { AdditiveBlending, DoubleSide } from "../../constants";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { LoaderUtils } from "../../loaders/LoaderUtils";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { TextureLoader } from "../../loaders/TextureLoader";
import { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Group } from "../../objects/Group";
import { Mesh } from "../../objects/Mesh";
import type { Texture } from "../../textures/Texture";

type TDSMesh = Mesh<MeshPhongMaterial | MeshPhongMaterial[]>;

/**
 * A loader for the 3DS format, based on lib3ds.
 *
 * Loads geometry with uv and materials basic properties with texture support.
 *
 * ```typescript
 * import { TDSLoader } from "ek3d/addons/loaders/TDSLoader";
 *
 * const loader = new TDSLoader();
 * loader.setResourcePath("models/3ds/portalgun/textures/");
 * const object = await loader.loadAsync("models/3ds/portalgun/portalgun.3ds");
 * scene.add(object);
 * ```
 */
export class TDSLoader extends Loader<Group, string> {
  /** Whether loader-level diagnostics are logged. Chunk-level diagnostics stay silent, matching upstream. */
  debug: boolean = false;

  private group: Group = new Group();
  private materials: Record<string, MeshPhongMaterial> = {};
  private meshes: TDSMesh[] = [];

  constructor(manager?: LoadingManager) {
    super(manager);
  }

  override load(
    url: string,
    onLoad?: (group: Group) => void,
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
      (data: unknown) => {
        try {
          onLoad?.(this.parse(data as ArrayBuffer, path));
        } catch (error) {
          if (onError !== undefined) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  /**
   * Parses the given 3DS data and returns the resulting object graph.
   *
   * @param arraybuffer - The raw 3DS data as an array buffer.
   * @param path - The asset path.
   * @return The parsed asset represented as a group.
   */
  parse(arraybuffer: ArrayBuffer, path: string): Group {
    this.group = new Group();
    this.materials = {};
    this.meshes = [];

    this.readFile(arraybuffer, path);

    const group = this.group;
    for (const mesh of this.meshes) group.add(mesh);

    return group;
  }

  /** Reads the top-level 3DS chunks. */
  private readFile(arraybuffer: ArrayBuffer, path: string): void {
    const data = new DataView(arraybuffer);
    const chunk = new Chunk(data, 0);

    if (chunk.id === MLIBMAGIC || chunk.id === CMAGIC || chunk.id === M3DMAGIC) {
      let next = chunk.readChunk();

      while (next !== null) {
        if (next.id === M3D_VERSION) {
          const version = next.readDWord();
          this.debugMessage("3DS file version: " + version);
        } else if (next.id === MDATA) {
          this.readMeshData(next, path);
        } else {
          this.debugMessage("Unknown main chunk: " + next.hexId);
        }

        next = chunk.readChunk();
      }
    }

    this.debugMessage("Parsed " + this.meshes.length + " meshes");
  }

  private readMeshData(chunk: Chunk, path: string): void {
    let next = chunk.readChunk();

    while (next !== null) {
      if (next.id === MESH_VERSION) {
        const version = +next.readDWord();
        this.debugMessage("Mesh Version: " + version);
      } else if (next.id === MASTER_SCALE) {
        const scale = next.readFloat();
        this.debugMessage("Master scale: " + scale);
        this.group.scale.set(scale, scale, scale);
      } else if (next.id === NAMED_OBJECT) {
        this.debugMessage("Named Object");
        this.readNamedObject(next);
      } else if (next.id === MAT_ENTRY) {
        this.debugMessage("Material");
        this.readMaterialEntry(next, path);
      } else {
        this.debugMessage("Unknown MDATA chunk: " + next.hexId);
      }

      next = chunk.readChunk();
    }
  }

  private readNamedObject(chunk: Chunk): void {
    const name = chunk.readString();

    let next = chunk.readChunk();
    while (next !== null) {
      if (next.id === N_TRI_OBJECT) {
        const mesh = this.readMesh(next);
        mesh.name = name;
        this.meshes.push(mesh);
      } else {
        this.debugMessage("Unknown named objet chunk: " + next.hexId);
      }

      next = chunk.readChunk();
    }
  }

  private readMaterialEntry(chunk: Chunk, path: string): void {
    let next = chunk.readChunk();
    const material = new MeshPhongMaterial();

    while (next !== null) {
      if (next.id === MAT_NAME) {
        material.name = next.readString();
        this.debugMessage("   Name: " + material.name);
      } else if (next.id === MAT_WIRE) {
        this.debugMessage("   Wireframe");
        material.wireframe = true;
      } else if (next.id === MAT_WIRE_SIZE) {
        const value = next.readByte();
        material.wireframeLinewidth = value;
        this.debugMessage("   Wireframe Thickness: " + value);
      } else if (next.id === MAT_TWO_SIDE) {
        material.side = DoubleSide;
        this.debugMessage("   DoubleSided");
      } else if (next.id === MAT_ADDITIVE) {
        this.debugMessage("   Additive Blending");
        material.blending = AdditiveBlending;
      } else if (next.id === MAT_DIFFUSE) {
        this.debugMessage("   Diffuse Color");
        material.color = this.readColor(next);
      } else if (next.id === MAT_SPECULAR) {
        this.debugMessage("   Specular Color");
        material.specular = this.readColor(next);
      } else if (next.id === MAT_AMBIENT) {
        this.debugMessage("   Ambient color");
        material.color = this.readColor(next);
      } else if (next.id === MAT_SHININESS) {
        const shininess = this.readPercentage(next);
        material.shininess = shininess * 100;
        this.debugMessage("   Shininess : " + shininess);
      } else if (next.id === MAT_TRANSPARENCY) {
        const transparency = this.readPercentage(next);
        material.opacity = 1 - transparency;
        this.debugMessage("  Transparency : " + transparency);
        material.transparent = material.opacity < 1;
      } else if (next.id === MAT_TEXMAP) {
        this.debugMessage("   ColorMap");
        material.map = this.readMap(next, path);
      } else if (next.id === MAT_BUMPMAP) {
        this.debugMessage("   BumpMap");
        material.bumpMap = this.readMap(next, path);
      } else if (next.id === MAT_OPACMAP) {
        this.debugMessage("   OpacityMap");
        material.alphaMap = this.readMap(next, path);
      } else if (next.id === MAT_SPECMAP) {
        this.debugMessage("   SpecularMap");
        material.specularMap = this.readMap(next, path);
      } else {
        this.debugMessage("   Unknown material chunk: " + next.hexId);
      }

      next = chunk.readChunk();
    }

    this.materials[material.name] = material;
  }

  private readMesh(chunk: Chunk): TDSMesh {
    let next = chunk.readChunk();

    const geometry = new BufferGeometry();

    const material = new MeshPhongMaterial();
    const mesh = new Mesh<MeshPhongMaterial | MeshPhongMaterial[]>(geometry, material);
    mesh.name = "mesh";

    while (next !== null) {
      if (next.id === POINT_ARRAY) {
        const points = next.readWord();
        this.debugMessage("   Vertex: " + points);

        const vertices: number[] = [];

        for (let i = 0; i < points; i++) {
          vertices.push(next.readFloat(), next.readFloat(), next.readFloat());
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      } else if (next.id === FACE_ARRAY) {
        this.readFaceArray(next, mesh);
      } else if (next.id === TEX_VERTS) {
        const texels = next.readWord();
        this.debugMessage("   UV: " + texels);

        const uvs: number[] = [];

        for (let i = 0; i < texels; i++) {
          uvs.push(next.readFloat(), next.readFloat());
        }

        geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      } else if (next.id === MESH_MATRIX) {
        this.debugMessage("   Transformation Matrix (TODO)");
        const values: number[] = [];
        for (let i = 0; i < 12; i++) values[i] = next.readFloat();

        const matrix = new Matrix4();

        // X Line
        matrix.elements[0] = values[0];
        matrix.elements[1] = values[6];
        matrix.elements[2] = values[3];
        matrix.elements[3] = values[9];

        // Y Line
        matrix.elements[4] = values[2];
        matrix.elements[5] = values[8];
        matrix.elements[6] = values[5];
        matrix.elements[7] = values[11];

        // Z Line
        matrix.elements[8] = values[1];
        matrix.elements[9] = values[7];
        matrix.elements[10] = values[4];
        matrix.elements[11] = values[10];

        // W Line
        matrix.elements[12] = 0;
        matrix.elements[13] = 0;
        matrix.elements[14] = 0;
        matrix.elements[15] = 1;

        matrix.transpose();

        const inverse = new Matrix4();
        inverse.copy(matrix).invert();
        geometry.applyMatrix4(inverse);

        matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
      } else {
        this.debugMessage("   Unknown mesh chunk: " + next.hexId);
      }

      next = chunk.readChunk();
    }

    geometry.computeVertexNormals();

    return mesh;
  }

  private readFaceArray(chunk: Chunk, mesh: TDSMesh): void {
    const faces = chunk.readWord();
    this.debugMessage("   Faces: " + faces);

    const index: number[] = [];

    for (let i = 0; i < faces; ++i) {
      index.push(chunk.readWord(), chunk.readWord(), chunk.readWord());
      chunk.readWord(); // visibility
    }

    mesh.geometry.setIndex(index);

    // The rest of the FACE_ARRAY chunk is subchunks.

    let materialIndex = 0;
    let start = 0;

    while (!chunk.endOfChunk) {
      // A FACE_ARRAY sub-chunk header that cannot be read means the index table is corrupt.
      const subchunk = chunk.readChunk();
      if (subchunk === null) throw new Error("THREE.TDSLoader: unable to read a FACE_ARRAY sub-chunk.");

      if (subchunk.id === MSH_MAT_GROUP) {
        this.debugMessage("      Material Group");

        const group = this.readMaterialGroup(subchunk);
        const count = group.index.length * 3; // assuming successive indices

        mesh.geometry.addGroup(start, count, materialIndex);

        start += count;
        materialIndex++;

        const material = this.materials[group.name];
        const materials = Array.isArray(mesh.material) ? mesh.material : (mesh.material = []);
        if (material !== undefined) materials.push(material);
      } else {
        this.debugMessage("      Unknown face array chunk: " + subchunk.hexId);
      }
    }

    // For backwards compatibility a single material group yields a plain material.
    if (Array.isArray(mesh.material) && mesh.material.length === 1) mesh.material = mesh.material[0];
  }

  private readMap(chunk: Chunk, path: string): Texture | null {
    let next = chunk.readChunk();
    let texture: Texture | null = null;

    const loader = new TextureLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);

    // A transform before MAT_MAPNAME is malformed; upstream threw when it mutated its placeholder.
    const mapped = (): Texture => {
      if (texture === null) throw new Error("THREE.TDSLoader: map transform before MAT_MAPNAME.");
      return texture;
    };

    while (next !== null) {
      if (next.id === MAT_MAPNAME) {
        const name = next.readString();
        texture = loader.load(name);
        this.debugMessage("      File: " + path + name);
      } else if (next.id === MAT_MAP_UOFFSET) {
        const offset = next.readFloat();
        mapped().offset.x = offset;
        this.debugMessage("      OffsetX: " + offset);
      } else if (next.id === MAT_MAP_VOFFSET) {
        const offset = next.readFloat();
        mapped().offset.y = offset;
        this.debugMessage("      OffsetY: " + offset);
      } else if (next.id === MAT_MAP_USCALE) {
        const scale = next.readFloat();
        mapped().repeat.x = scale;
        this.debugMessage("      RepeatX: " + scale);
      } else if (next.id === MAT_MAP_VSCALE) {
        const scale = next.readFloat();
        mapped().repeat.y = scale;
        this.debugMessage("      RepeatY: " + scale);
      } else {
        this.debugMessage("      Unknown map chunk: " + next.hexId);
      }

      next = chunk.readChunk();
    }

    return texture;
  }

  private readMaterialGroup(chunk: Chunk): { name: string; index: number[] } {
    const name = chunk.readString();
    const numFaces = chunk.readWord();

    this.debugMessage("         Name: " + name);
    this.debugMessage("         Faces: " + numFaces);

    const index: number[] = [];
    for (let i = 0; i < numFaces; ++i) index.push(chunk.readWord());

    return { name, index };
  }

  private readColor(chunk: Chunk): Color {
    const subChunk = chunk.readChunk();
    const color = new Color();
    if (subChunk === null) return color;

    if (subChunk.id === COLOR_24 || subChunk.id === LIN_COLOR_24) {
      const r = subChunk.readByte();
      const g = subChunk.readByte();
      const b = subChunk.readByte();

      color.setRGB(r / 255, g / 255, b / 255);
      this.debugMessage("      Color: " + color.r + ", " + color.g + ", " + color.b);
    } else if (subChunk.id === COLOR_F || subChunk.id === LIN_COLOR_F) {
      const r = subChunk.readFloat();
      const g = subChunk.readFloat();
      const b = subChunk.readFloat();

      color.setRGB(r, g, b);
      this.debugMessage("      Color: " + color.r + ", " + color.g + ", " + color.b);
    } else {
      this.debugMessage("      Unknown color chunk: " + subChunk.hexId);
    }

    return color;
  }

  private readPercentage(chunk: Chunk): number {
    const subChunk = chunk.readChunk();
    if (subChunk === null) return 0;

    switch (subChunk.id) {
      case INT_PERCENTAGE:
        return subChunk.readShort() / 100;
      case FLOAT_PERCENTAGE:
        return subChunk.readFloat();
      default:
        this.debugMessage("      Unknown percentage chunk: " + subChunk.hexId);
        return 0;
    }
  }

  private debugMessage(message: string): void {
    if (this.debug) console.log(message);
  }
}

/**
 * Reads data and sub-chunks from a 3DS chunk.
 *
 * Upstream replaced its own diagnostics callback with a no-op, so chunk-level
 * messages never reach the console; this port drops them instead of keeping dead plumbing.
 */
class Chunk {
  data: DataView;
  /** The offset of the beginning of this chunk. */
  offset: number;
  /** The current reading position. */
  position: number;
  id: number;
  size: number;
  end: number;

  constructor(data: DataView, position: number) {
    this.data = data;
    this.offset = position;
    this.position = position;

    this.id = this.readWord();
    this.size = this.readDWord();
    this.end = this.offset + this.size;
  }

  /** Reads and advances over the next sub-chunk, or returns `null` when none can be read. */
  readChunk(): Chunk | null {
    if (this.endOfChunk) return null;

    try {
      const next = new Chunk(this.data, this.position);
      this.position += next.size;
      return next;
    } catch {
      return null;
    }
  }

  get hexId(): string {
    return this.id.toString(16);
  }

  get endOfChunk(): boolean {
    return this.position >= this.end;
  }

  readByte(): number {
    const v = this.data.getUint8(this.position);
    this.position += 1;
    return v;
  }

  readFloat(): number {
    try {
      const v = this.data.getFloat32(this.position, true);
      this.position += 4;
      return v;
    } catch {
      return 0;
    }
  }

  readShort(): number {
    const v = this.data.getInt16(this.position, true);
    this.position += 2;
    return v;
  }

  readDWord(): number {
    const v = this.data.getUint32(this.position, true);
    this.position += 4;
    return v;
  }

  readWord(): number {
    const v = this.data.getUint16(this.position, true);
    this.position += 2;
    return v;
  }

  /** Reads a NULL terminated ASCII string from the current position. */
  readString(): string {
    let s = "";
    let c = this.readByte();
    while (c) {
      s += String.fromCharCode(c);
      c = this.readByte();
    }
    return s;
  }
}

const M3DMAGIC = 0x4d4d;
const MLIBMAGIC = 0x3daa;
const CMAGIC = 0xc23d;
const M3D_VERSION = 0x0002;
const COLOR_F = 0x0010;
const COLOR_24 = 0x0011;
const LIN_COLOR_24 = 0x0012;
const LIN_COLOR_F = 0x0013;
const INT_PERCENTAGE = 0x0030;
const FLOAT_PERCENTAGE = 0x0031;
const MDATA = 0x3d3d;
const MESH_VERSION = 0x3d3e;
const MASTER_SCALE = 0x0100;
const MAT_ENTRY = 0xafff;
const MAT_NAME = 0xa000;
const MAT_AMBIENT = 0xa010;
const MAT_DIFFUSE = 0xa020;
const MAT_SPECULAR = 0xa030;
const MAT_SHININESS = 0xa040;
const MAT_TRANSPARENCY = 0xa050;
const MAT_TWO_SIDE = 0xa081;
const MAT_ADDITIVE = 0xa083;
const MAT_WIRE = 0xa085;
const MAT_WIRE_SIZE = 0xa087;
const MAT_TEXMAP = 0xa200;
const MAT_OPACMAP = 0xa210;
const MAT_BUMPMAP = 0xa230;
const MAT_SPECMAP = 0xa204;
const MAT_MAPNAME = 0xa300;
const MAT_MAP_USCALE = 0xa354;
const MAT_MAP_VSCALE = 0xa356;
const MAT_MAP_UOFFSET = 0xa358;
const MAT_MAP_VOFFSET = 0xa35a;
const NAMED_OBJECT = 0x4000;
const N_TRI_OBJECT = 0x4100;
const POINT_ARRAY = 0x4110;
const FACE_ARRAY = 0x4120;
const MSH_MAT_GROUP = 0x4130;
const TEX_VERTS = 0x4140;
const MESH_MATRIX = 0x4160;
