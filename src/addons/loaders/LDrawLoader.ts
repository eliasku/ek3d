import { Loader } from "../../loaders/Loader";
import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Ray } from "../../math/Ray";
import { Vector3 } from "../../math/Vector3";
import { FileLoader } from "../../loaders/FileLoader";
import { Group } from "../../objects/Group";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { LineSegments } from "../../objects/LineSegments";
import { Mesh } from "../../objects/Mesh";
import { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import { ColorSpace } from "../../constants";

// Special surface finish tag types.
// Note: "MATERIAL" tag (e.g. GLITTER, SPECKLE) is not implemented
const FINISH_TYPE_DEFAULT = 0;
const FINISH_TYPE_CHROME = 1;
const FINISH_TYPE_PEARLESCENT = 2;
const FINISH_TYPE_RUBBER = 3;
const FINISH_TYPE_MATTE_METALLIC = 4;
const FINISH_TYPE_METAL = 5;

// State machine to search a subobject path.
// The LDraw standard establishes these various possible subfolders.
const FILE_LOCATION_TRY_PARTS = 0;
const FILE_LOCATION_TRY_P = 1;
const FILE_LOCATION_TRY_MODELS = 2;
const FILE_LOCATION_AS_IS = 3;
const FILE_LOCATION_TRY_RELATIVE = 4;
const FILE_LOCATION_TRY_ABSOLUTE = 5;
const FILE_LOCATION_NOT_FOUND = 6;

const MAIN_COLOUR_CODE = "16";
const MAIN_EDGE_COLOUR_CODE = "24";

const COLOR_SPACE_LDRAW = ColorSpace.SRGB;

const _tempVec0 = new Vector3();
const _tempVec1 = new Vector3();

class ConditionalLineSegments extends LineSegments {
  isConditionalLine: true;

  constructor(
    geometry: import("../../core/BufferGeometry").BufferGeometry,
    material:
      | import("../../materials/LineBasicMaterial").LineBasicMaterial
      | import("../../materials/LineBasicMaterial").LineBasicMaterial[],
  ) {
    super(geometry as never, material as never);

    this.isConditionalLine = true;
  }
}

/* Data structures shared between the parse cache, the geometry cache and the loader. */

interface ConditionalLineSegmentsLike extends LineSegments {
  isConditionalLine: boolean;
}

/** One triangle or quad before geometry conversion. */
interface LDrawFace {
  colorCode: string;
  material: unknown;
  vertices: Vector3[];
  normals: (NormalWrapper | null)[];
  faceNormal: Vector3 | null;
  doubleSided: boolean;
}

/** One line segment before geometry conversion. */
interface LDrawSegment {
  colorCode: string;
  material: unknown;
  vertices: Vector3[];
  controlPoints?: Vector3[];
}

/** One subobject reference before loading. */
interface LDrawSubobject {
  material: unknown;
  colorCode: string;
  matrix: Matrix4;
  fileName: string;
  inverted: boolean;
  startingBuildingStep: boolean;
}

/** Parsed intermediate representation of an LDraw file. */
interface LDrawData {
  faces: LDrawFace[];
  lineSegments: LDrawSegment[];
  conditionalSegments: LDrawSegment[];
  subobjects: LDrawSubobject[];
  materials: Record<string, unknown>;
  type: string;
  category: string | null;
  keywords: string[] | null;
  author: string | null;
  fileName: string | null;
  totalFaces: number;
  startingBuildingStep: boolean;
  group: Group | null;
}

/** Shared normal accumulator used by the smoothing pass. */
interface NormalWrapper {
  norm: Vector3;
}

function generateFaceNormals(faces: LDrawFace[]): void {
  for (let i = 0, l = faces.length; i < l; i++) {
    const face = faces[i]!;
    const vertices = face.vertices;
    const v0 = vertices[0]!;
    const v1 = vertices[1]!;
    const v2 = vertices[2]!;

    _tempVec0.subVectors(v1, v0);
    _tempVec1.subVectors(v2, v1);
    face.faceNormal = new Vector3().crossVectors(_tempVec0, _tempVec1).normalize();
  }
}

const _ray = new Ray();

function smoothNormals(faces: LDrawFace[], lineSegments: LDrawSegment[], checkSubSegments: boolean = false): void {
  // NOTE: 1e2 is pretty coarse but was chosen to quantize the resulting value because
  // it allows edges to be smoothed as expected (see minifig arms).
  // --
  // And the vector values are initialize multiplied by 1 + 1e-10 to account for floating
  // point errors on vertices along quantization boundaries. Ie after matrix multiplication
  // vertices that should be merged might be set to "1.7" and "1.6999..." meaning they won't
  // get merged. This added epsilon attempts to push these error values to the same quantized
  // value for the sake of hashing. See "AT-ST mini" dishes. See three.js#23169.

  const hashMultiplier = (1 + 1e-10) * 1e2;
  function hashVertex(v: Vector3): string {
    const x = ~~(v.x * hashMultiplier);
    const y = ~~(v.y * hashMultiplier);
    const z = ~~(v.z * hashMultiplier);

    return `${x},${y},${z}`;
  }

  function hashEdge(v0: Vector3, v1: Vector3): string {
    return `${hashVertex(v0)}_${hashVertex(v1)}`;
  }

  // converts the two vertices to a ray with a normalized direction and origin of 0, 0, 0 projected
  // onto the original line.
  function toNormalizedRay(v0: Vector3, v1: Vector3, targetRay: Ray): Ray {
    targetRay.direction.subVectors(v1, v0).normalize();

    const scalar = v0.dot(targetRay.direction);
    targetRay.origin.copy(v0).addScaledVector(targetRay.direction, -scalar);

    return targetRay;
  }

  function hashRay(ray: Ray): string {
    return hashEdge(ray.origin, ray.direction);
  }

  const hardEdges = new Set<string>();
  const hardEdgeRays = new Map<string, { ray: Ray; distances: number[] }>();
  const halfEdgeList = new Map<string, { index: number; tri: LDrawFace }>();
  const normals: Vector3[] = [];

  // Save the list of hard edges by hash
  for (let i = 0, l = lineSegments.length; i < l; i++) {
    const ls = lineSegments[i]!;
    const vertices = ls.vertices;
    const v0 = vertices[0]!;
    const v1 = vertices[1]!;
    hardEdges.add(hashEdge(v0, v1));
    hardEdges.add(hashEdge(v1, v0));

    // only generate the hard edge ray map if we're checking subsegments because it's more expensive to check
    // and requires more memory.
    if (checkSubSegments) {
      // add both ray directions to the map
      const ray = toNormalizedRay(v0, v1, new Ray());
      const rh1 = hashRay(ray);
      if (!hardEdgeRays.has(rh1)) {
        toNormalizedRay(v1, v0, ray);
        const rh2 = hashRay(ray);

        const info = {
          ray,
          distances: [],
        };

        hardEdgeRays.set(rh1, info);
        hardEdgeRays.set(rh2, info);
      }

      // store both segments ends in min, max order in the distances array to check if a face edge is a
      // subsegment later.
      const info = hardEdgeRays.get(rh1)!;
      let d0 = info.ray.direction.dot(v0);
      let d1 = info.ray.direction.dot(v1);
      if (d0 > d1) {
        [d0, d1] = [d1, d0];
      }

      info.distances.push(d0, d1);
    }
  }

  // track the half edges associated with each triangle
  for (let i = 0, l = faces.length; i < l; i++) {
    const tri = faces[i]!;
    const vertices = tri.vertices;
    const vertCount = vertices.length;
    for (let i2 = 0; i2 < vertCount; i2++) {
      const index = i2;
      const next = (i2 + 1) % vertCount;
      const v0 = vertices[index]!;
      const v1 = vertices[next]!;
      const hash = hashEdge(v0, v1);

      // don't add the triangle if the edge is supposed to be hard
      if (hardEdges.has(hash)) {
        continue;
      }

      // if checking subsegments then check to see if this edge lies on a hard edge ray and whether its within any ray bounds
      if (checkSubSegments) {
        toNormalizedRay(v0, v1, _ray);

        const rayHash = hashRay(_ray);
        if (hardEdgeRays.has(rayHash)) {
          const info = hardEdgeRays.get(rayHash)!;
          const { ray, distances } = info;
          let d0 = ray.direction.dot(v0);
          let d1 = ray.direction.dot(v1);

          if (d0 > d1) {
            [d0, d1] = [d1, d0];
          }

          // return early if the face edge is found to be a subsegment of a line edge meaning the edge will have "hard" normals
          let found = false;
          for (let i3 = 0, l3 = distances.length; i3 < l3; i3 += 2) {
            if (d0 >= distances[i3]! && d1 <= distances[i3 + 1]!) {
              found = true;
              break;
            }
          }

          if (found) {
            continue;
          }
        }
      }

      const info = {
        index: index,
        tri: tri,
      };
      halfEdgeList.set(hash, info);
    }
  }

  // Iterate until we've tried to connect all faces to share normals
  // Map iterators skip entries deleted during iteration, so each face is visited once
  for (const halfEdge of halfEdgeList.values()) {
    // Exhaustively find all connected faces
    const queue = [halfEdge];
    while (queue.length > 0) {
      // initialize all vertex normals in this triangle
      const tri = queue.pop()!.tri;
      const vertices = tri.vertices;
      const vertNormals = tri.normals;
      const faceNormal = tri.faceNormal!;

      // Check if any edge is connected to another triangle edge
      const vertCount = vertices.length;
      for (let i2 = 0; i2 < vertCount; i2++) {
        const index = i2;
        const next = (i2 + 1) % vertCount;
        const v0 = vertices[index]!;
        const v1 = vertices[next]!;

        // delete this triangle from the list so it won't be found again
        const hash = hashEdge(v0, v1);
        halfEdgeList.delete(hash);

        const reverseHash = hashEdge(v1, v0);
        const otherInfo = halfEdgeList.get(reverseHash);
        if (otherInfo) {
          const otherTri = otherInfo.tri;
          const otherIndex = otherInfo.index;
          const otherNormals = otherTri.normals;
          const otherVertCount = otherNormals.length;
          const otherFaceNormal = otherTri.faceNormal!;

          // NOTE: If the angle between faces is > 67.5 degrees then assume it's
          // hard edge. There are some cases where the line segments do not line up exactly
          // with or span multiple triangle edges (see Lunar Vehicle wheels).
          if (Math.abs(otherTri.faceNormal!.dot(tri.faceNormal!)) < 0.25) {
            continue;
          }

          // if this triangle has already been traversed then it won't be in
          // the halfEdgeList. If it has not then add it to the queue and delete
          // it so it won't be found again.
          if (halfEdgeList.has(reverseHash)) {
            queue.push(otherInfo);
            halfEdgeList.delete(reverseHash);
          }

          // share the first normal
          const otherNext = (otherIndex + 1) % otherVertCount;
          if (vertNormals[index] && otherNormals[otherNext] && vertNormals[index] !== otherNormals[otherNext]) {
            otherNormals[otherNext]!.norm.add(vertNormals[index]!.norm);
            vertNormals[index]!.norm = otherNormals[otherNext]!.norm;
          }

          let sharedNormal1: NormalWrapper | null = vertNormals[index] ?? otherNormals[otherNext] ?? null;
          if (sharedNormal1 === null) {
            // it's possible to encounter an edge of a triangle that has already been traversed meaning
            // both edges already have different normals defined and shared. To work around this we create
            // a wrapper object so when those edges are merged the normals can be updated everywhere.
            sharedNormal1 = { norm: new Vector3() };
            normals.push(sharedNormal1.norm);
          }

          if (vertNormals[index] === null) {
            vertNormals[index] = sharedNormal1;
            sharedNormal1.norm.add(faceNormal);
          }

          if (otherNormals[otherNext] === null) {
            otherNormals[otherNext] = sharedNormal1;
            sharedNormal1.norm.add(otherFaceNormal);
          }

          // share the second normal
          if (vertNormals[next] && otherNormals[otherIndex] && vertNormals[next] !== otherNormals[otherIndex]) {
            otherNormals[otherIndex]!.norm.add(vertNormals[next]!.norm);
            vertNormals[next]!.norm = otherNormals[otherIndex]!.norm;
          }

          let sharedNormal2: NormalWrapper | null = vertNormals[next] ?? otherNormals[otherIndex] ?? null;
          if (sharedNormal2 === null) {
            sharedNormal2 = { norm: new Vector3() };
            normals.push(sharedNormal2.norm);
          }

          if (vertNormals[next] === null) {
            vertNormals[next] = sharedNormal2;
            sharedNormal2.norm.add(faceNormal);
          }

          if (otherNormals[otherIndex] === null) {
            otherNormals[otherIndex] = sharedNormal2;
            sharedNormal2.norm.add(otherFaceNormal);
          }
        }
      }
    }
  }

  // The normals of each face have been added up so now we average them by normalizing the vector.
  for (let i = 0, l = normals.length; i < l; i++) {
    normals[i]!.normalize();
  }
}

function isPartType(type: string): boolean {
  return type === "Part" || type === "Unofficial_Part";
}

function isPrimitiveType(type: string): boolean {
  return /primitive/i.test(type) || type === "Subpart";
}

class LineParser {
  line: string;
  lineLength: number;
  currentCharIndex: number;
  currentChar: string;
  lineNumber: number;

  constructor(line: string, lineNumber: number = -1) {
    this.line = line;
    this.lineLength = line.length;
    this.currentCharIndex = 0;
    this.currentChar = " ";
    this.lineNumber = lineNumber;
  }

  seekNonSpace(): void {
    while (this.currentCharIndex < this.lineLength) {
      this.currentChar = this.line.charAt(this.currentCharIndex);

      if (this.currentChar !== " " && this.currentChar !== "\t") {
        return;
      }

      this.currentCharIndex++;
    }
  }

  getToken(): string {
    const pos0 = this.currentCharIndex++;

    // Seek space
    while (this.currentCharIndex < this.lineLength) {
      this.currentChar = this.line.charAt(this.currentCharIndex);

      if (this.currentChar === " " || this.currentChar === "\t") {
        break;
      }

      this.currentCharIndex++;
    }

    const pos1 = this.currentCharIndex;

    this.seekNonSpace();

    return this.line.substring(pos0, pos1);
  }

  getVector(): Vector3 {
    return new Vector3(parseFloat(this.getToken()), parseFloat(this.getToken()), parseFloat(this.getToken()));
  }

  getRemainingString(): string {
    return this.line.substring(this.currentCharIndex, this.lineLength);
  }

  isAtTheEnd(): boolean {
    return this.currentCharIndex >= this.lineLength;
  }

  setToEnd(): void {
    this.currentCharIndex = this.lineLength;
  }

  getLineNumberString(): string {
    return this.lineNumber >= 0 ? " at line " + this.lineNumber : "";
  }
}

// Fetches and parses an intermediate representation of LDraw parts files.
class LDrawParsedCache {
  loader: LDrawLoader;
  _cache: Record<string, LDrawData | Promise<LDrawData>>;

  constructor(loader: LDrawLoader) {
    this.loader = loader;
    this._cache = {};
  }

  cloneResult(original: LDrawData): LDrawData {
    const result: LDrawData = {} as LDrawData;

    // vertices are transformed and normals computed before being converted to geometry
    // so these pieces must be cloned.
    result.faces = original.faces.map((face: LDrawFace) => {
      return {
        colorCode: face.colorCode,
        material: face.material,
        vertices: face.vertices.map((v: Vector3) => v.clone()),
        normals: face.normals.map(() => null),
        faceNormal: null,
        doubleSided: face.doubleSided,
      };
    });

    result.conditionalSegments = original.conditionalSegments.map((face: LDrawSegment) => {
      return {
        colorCode: face.colorCode,
        material: face.material,
        vertices: face.vertices.map((v: Vector3) => v.clone()),
        controlPoints: face.controlPoints!.map((v: Vector3) => v.clone()),
      };
    });

    result.lineSegments = original.lineSegments.map((face: LDrawSegment) => {
      return {
        colorCode: face.colorCode,
        material: face.material,
        vertices: face.vertices.map((v: Vector3) => v.clone()),
      };
    });

    // none if this is subsequently modified
    result.type = original.type;
    result.category = original.category;
    result.keywords = original.keywords;
    result.author = original.author;
    result.subobjects = original.subobjects;
    result.fileName = original.fileName;
    result.totalFaces = original.totalFaces;
    result.startingBuildingStep = original.startingBuildingStep;
    result.materials = original.materials;
    result.group = null;
    return result;
  }

  async fetchData(fileName: string): Promise<string> {
    let triedLowerCase = false;
    let locationState = FILE_LOCATION_TRY_PARTS;
    while (locationState !== FILE_LOCATION_NOT_FOUND) {
      let subobjectURL = fileName;
      switch (locationState) {
        case FILE_LOCATION_AS_IS:
          locationState = locationState + 1;
          break;

        case FILE_LOCATION_TRY_PARTS:
          subobjectURL = "parts/" + subobjectURL;
          locationState = locationState + 1;
          break;

        case FILE_LOCATION_TRY_P:
          subobjectURL = "p/" + subobjectURL;
          locationState = locationState + 1;
          break;

        case FILE_LOCATION_TRY_MODELS:
          subobjectURL = "models/" + subobjectURL;
          locationState = locationState + 1;
          break;

        case FILE_LOCATION_TRY_RELATIVE:
          subobjectURL = fileName.substring(0, fileName.lastIndexOf("/") + 1) + subobjectURL;
          locationState = locationState + 1;
          break;

        case FILE_LOCATION_TRY_ABSOLUTE:
          if (triedLowerCase) {
            // Try absolute path
            locationState = FILE_LOCATION_NOT_FOUND;
          } else {
            // Next attempt is lower case
            fileName = fileName.toLowerCase();
            subobjectURL = fileName;
            triedLowerCase = true;
            locationState = FILE_LOCATION_TRY_PARTS;
          }

          break;
      }

      const loader = this.loader;
      const fileLoader = new FileLoader(loader.manager as never);
      fileLoader.setPriority(loader.priority);
      fileLoader.setCache(loader.cache);
      fileLoader.setPath(loader.partsLibraryPath);
      fileLoader.setRequestHeader(loader.requestHeader);
      fileLoader.setWithCredentials(loader.withCredentials);

      try {
        const text = (await fileLoader.loadAsync(subobjectURL)) as string;
        return text;
      } catch {
        continue;
      }
    }

    throw new Error('THREE.LDrawLoader: Subobject "' + fileName + '" could not be loaded.');
  }

  parse(text: string, fileName: string | null = null): LDrawData {
    const loader = this.loader;

    // final results
    const faces: LDrawFace[] = [];
    const lineSegments: LDrawSegment[] = [];
    const conditionalSegments: LDrawSegment[] = [];
    const subobjects: LDrawSubobject[] = [];
    const materials: Record<string, unknown> = {};

    const getLocalMaterial = (colorCode: string): unknown => {
      return materials[colorCode] ?? null;
    };

    let type = "Model";
    let category: string | null = null;
    let keywords: string[] | null = null;
    let author: string | null = null;
    let totalFaces = 0;

    // split into lines
    if (text.indexOf("\r\n") !== -1) {
      // This is faster than String.split with regex that splits on both
      text = text.replace(/\r\n/g, "\n");
    }

    const lines = text.split("\n");
    const numLines = lines.length;

    let parsingEmbeddedFiles = false;
    let currentEmbeddedFileName: string | null = null;
    let currentEmbeddedText: string | null = null;

    let bfcCertified = false;
    let bfcCCW = true;
    let bfcInverted = false;
    let bfcCull = true;

    let startingBuildingStep = false;

    // Parse all line commands
    for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
      const line = lines[lineIndex]!;

      if (line.length === 0) continue;

      if (parsingEmbeddedFiles) {
        if (line.startsWith("0 FILE ")) {
          // Save previous embedded file in the cache
          this.setData(currentEmbeddedFileName!, currentEmbeddedText!);

          // New embedded text file
          currentEmbeddedFileName = line.substring(7);
          currentEmbeddedText = "";
        } else {
          currentEmbeddedText += line + "\n";
        }

        continue;
      }

      const lp = new LineParser(line, lineIndex + 1);
      lp.seekNonSpace();

      if (lp.isAtTheEnd()) {
        // Empty line
        continue;
      }

      // Parse the line type
      const lineType = lp.getToken();

      let material: unknown = null;
      let colorCode: string = "";
      let segment: LDrawSegment | undefined;
      let v0: Vector3, v1: Vector3, v2: Vector3, v3: Vector3, c0: Vector3, c1: Vector3;

      switch (lineType) {
        // Line type 0: Comment or META
        case "0": {
          // Parse meta directive
          const meta = lp.getToken();

          if (meta) {
            switch (meta) {
              case "!LDRAW_ORG":
                type = lp.getToken();
                break;

              case "!COLOUR":
                material = loader.parseColorMetaDirective(lp);
                if (material) {
                  materials[(material as { userData: { code: string } }).userData.code] = material;
                } else {
                  console.warn("LDrawLoader: Error parsing material" + lp.getLineNumberString());
                }

                break;

              case "!CATEGORY":
                category = lp.getToken();
                break;

              case "!KEYWORDS": {
                const newKeywords = lp.getRemainingString().split(",");
                if (newKeywords.length > 0) {
                  if (!keywords) {
                    keywords = [];
                  }

                  newKeywords.forEach(function (keyword) {
                    keywords!.push(keyword.trim());
                  });
                }

                break;
              }

              case "FILE":
                if (lineIndex > 0) {
                  // Start embedded text files parsing
                  parsingEmbeddedFiles = true;
                  currentEmbeddedFileName = lp.getRemainingString();
                  currentEmbeddedText = "";

                  bfcCertified = false;
                  bfcCCW = true;
                }

                break;

              case "BFC": {
                // Changes to the backface culling state
                while (!lp.isAtTheEnd()) {
                  const token = lp.getToken();

                  switch (token) {
                    case "CERTIFY":
                    case "NOCERTIFY":
                      bfcCertified = token === "CERTIFY";
                      bfcCCW = true;

                      break;

                    case "CW":
                    case "CCW":
                      bfcCCW = token === "CCW";

                      break;

                    case "INVERTNEXT":
                      bfcInverted = true;

                      break;

                    case "CLIP":
                    case "NOCLIP":
                      bfcCull = token === "CLIP";

                      break;

                    default:
                      console.warn('THREE.LDrawLoader: BFC directive "' + token + '" is unknown.');

                      break;
                  }
                }

                break;
              }

              case "STEP":
                startingBuildingStep = true;

                break;

              case "Author:":
                author = lp.getToken();

                break;

              default:
                // Other meta directives are not implemented
                break;
            }
          }

          break;
        }

        // Line type 1: Sub-object file
        case "1": {
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);

          const posX = parseFloat(lp.getToken());
          const posY = parseFloat(lp.getToken());
          const posZ = parseFloat(lp.getToken());
          const m0 = parseFloat(lp.getToken());
          const m1 = parseFloat(lp.getToken());
          const m2 = parseFloat(lp.getToken());
          const m3 = parseFloat(lp.getToken());
          const m4 = parseFloat(lp.getToken());
          const m5 = parseFloat(lp.getToken());
          const m6 = parseFloat(lp.getToken());
          const m7 = parseFloat(lp.getToken());
          const m8 = parseFloat(lp.getToken());

          const matrix = new Matrix4().set(m0, m1, m2, posX, m3, m4, m5, posY, m6, m7, m8, posZ, 0, 0, 0, 1);

          let fileName = lp.getRemainingString().trim().replace(/\\/g, "/");

          if (fileName in loader.fileMap) {
            // Found the subobject path in the preloaded file path map
            fileName = loader.fileMap[fileName];
          } else {
            // Standardized subfolders
            if (fileName.startsWith("s/")) {
              fileName = "parts/" + fileName;
            } else if (fileName.startsWith("48/")) {
              fileName = "p/" + fileName;
            }
          }

          subobjects.push({
            material: material,
            colorCode: colorCode,
            matrix: matrix,
            fileName: fileName,
            inverted: bfcInverted,
            startingBuildingStep: startingBuildingStep,
          });

          startingBuildingStep = false;
          bfcInverted = false;

          break;
        }

        // Line type 2: Line segment
        case "2": {
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          v0 = lp.getVector();
          v1 = lp.getVector();

          segment = {
            material: material,
            colorCode: colorCode,
            vertices: [v0, v1],
          };

          lineSegments.push(segment);

          break;
        }

        // Line type 5: Conditional Line segment
        case "5": {
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          v0 = lp.getVector();
          v1 = lp.getVector();
          c0 = lp.getVector();
          c1 = lp.getVector();

          segment = {
            material: material,
            colorCode: colorCode,
            vertices: [v0, v1],
            controlPoints: [c0, c1],
          };

          conditionalSegments.push(segment);

          break;
        }

        // Line type 3: Triangle
        case "3": {
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          const ccw = bfcCCW;
          const doubleSided = !bfcCertified || !bfcCull;

          if (ccw === true) {
            v0 = lp.getVector();
            v1 = lp.getVector();
            v2 = lp.getVector();
          } else {
            v2 = lp.getVector();
            v1 = lp.getVector();
            v0 = lp.getVector();
          }

          faces.push({
            material: material,
            colorCode: colorCode,
            faceNormal: null,
            vertices: [v0, v1, v2],
            normals: [null, null, null],
            doubleSided: doubleSided,
          });
          totalFaces += doubleSided ? 2 : 1;

          break;
        }

        // Line type 4: Quadrilateral
        case "4": {
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          const ccw = bfcCCW;
          const doubleSided = !bfcCertified || !bfcCull;

          if (ccw === true) {
            v0 = lp.getVector();
            v1 = lp.getVector();
            v2 = lp.getVector();
            v3 = lp.getVector();
          } else {
            v3 = lp.getVector();
            v2 = lp.getVector();
            v1 = lp.getVector();
            v0 = lp.getVector();
          }

          // specifically place the triangle diagonal in the v0 and v1 slots so we can
          // account for the doubling of vertices later when smoothing normals.
          faces.push({
            material: material,
            colorCode: colorCode,
            faceNormal: null,
            vertices: [v0, v1, v2, v3],
            normals: [null, null, null, null],
            doubleSided: doubleSided,
          });
          totalFaces += doubleSided ? 4 : 2;

          break;
        }

        default:
          throw new Error('THREE.LDrawLoader: Unknown line type "' + lineType + '"' + lp.getLineNumberString() + ".");
      }
    }

    if (parsingEmbeddedFiles) {
      this.setData(currentEmbeddedFileName!, currentEmbeddedText!);
    }

    return {
      faces,
      conditionalSegments,
      lineSegments,
      type,
      category,
      keywords,
      author,
      subobjects,
      totalFaces,
      startingBuildingStep,
      materials,
      fileName,
      group: null,
    };
  }

  // returns an (optionally cloned) instance of the data
  getData(fileName: string, clone: boolean = true): LDrawData | null {
    const key = fileName.toLowerCase();
    const result = this._cache[key] as LDrawData | Promise<LDrawData> | undefined;
    if (result === null || result instanceof Promise || result === undefined) {
      return null;
    }

    if (clone) {
      return this.cloneResult(result);
    } else {
      return result;
    }
  }

  // kicks off a fetch and parse of the requested data if it hasn't already been loaded. Returns when
  // the data is ready to use and can be retrieved synchronously with "getData".
  async ensureDataLoaded(fileName: string): Promise<void> {
    const key = fileName.toLowerCase();
    if (!(key in this._cache)) {
      // replace the promise with a copy of the parsed data for immediate processing
      this._cache[key] = this.fetchData(fileName).then((text: string) => {
        const info = this.parse(text, fileName);
        this._cache[key] = info;
        return info;
      });
    }

    const pending = this._cache[key];
    if (pending instanceof Promise) await pending;
  }

  // sets the data in the cache from parsed data
  setData(fileName: string, text: string): void {
    const key = fileName.toLowerCase();
    this._cache[key] = this.parse(text, fileName);
  }
}

// returns the material for an associated color code. If the color code is 16 for a face or 24 for
// an edge then the passthroughColorCode is used.
function getMaterialFromCode(
  colorCode: string,
  parentColorCode: string,
  materialHierarchy: Record<string, unknown>,
  forEdge: boolean,
): unknown {
  const isPassthrough =
    (!forEdge && colorCode === MAIN_COLOUR_CODE) || (forEdge && colorCode === MAIN_EDGE_COLOUR_CODE);
  if (isPassthrough) {
    colorCode = parentColorCode;
  }

  return materialHierarchy[colorCode] ?? null;
}

// Class used to parse and build LDraw parts as objects and cache them if they're a "Part" type.
class LDrawPartsGeometryCache {
  loader: LDrawLoader;
  parseCache: LDrawParsedCache;
  _cache: Record<string, Promise<Group>>;

  constructor(loader: LDrawLoader) {
    this.loader = loader;
    this.parseCache = new LDrawParsedCache(loader);
    this._cache = {};
  }

  // Convert the given file information into a mesh by processing subobjects.
  async processIntoMesh(info: LDrawData): Promise<Group> {
    const loader = this.loader;
    const parseCache = this.parseCache;
    const faceMaterials = new Set<string>();

    // Processes the part subobject information to load child parts and merge geometry onto part
    // piece object.
    const processInfoSubobjects = async (
      info: LDrawData,
      subobject: LDrawSubobject | null = null,
    ): Promise<LDrawData> => {
      const subobjects = info.subobjects;
      const promises: Promise<unknown>[] = [];

      // Trigger load of all subobjects. If a subobject isn't a primitive then load it as a separate
      // group which lets instruction steps apply correctly.
      for (let i = 0, l = subobjects.length; i < l; i++) {
        const subobject = subobjects[i]!;
        const promise = parseCache.ensureDataLoaded(subobject.fileName).then(async (): Promise<unknown> => {
          const unclonedInfo = parseCache.getData(subobject.fileName, false);
          if (unclonedInfo !== null && !isPrimitiveType(unclonedInfo.type)) {
            return this.loadModel(subobject.fileName).catch((error: unknown) => {
              console.warn(error);
              return null;
            });
          }

          // process a CLONE: processing mutates vertices in place; the cached info stays pristine
          return processInfoSubobjects(parseCache.getData(subobject.fileName) as LDrawData, subobject);
        });

        promises.push(promise);
      }

      const group = new Group();
      (group.userData as Record<string, unknown>).category = info.category;
      (group.userData as Record<string, unknown>).keywords = info.keywords;
      (group.userData as Record<string, unknown>).author = info.author;
      (group.userData as Record<string, unknown>).type = info.type;
      (group.userData as Record<string, unknown>).fileName = info.fileName;
      info.group = group;

      const subobjectInfos = (await Promise.all(promises)) as unknown as (Group | LDrawData | null)[];
      for (let i = 0, l = subobjectInfos.length; i < l; i++) {
        const subobject = info.subobjects[i]!;
        const subobjectInfo = subobjectInfos[i];

        if (subobjectInfo === null || subobjectInfo === undefined) {
          // the subobject failed to load
          continue;
        }

        // if the subobject was loaded as a separate group then apply the parent scopes materials
        if ((subobjectInfo as Group).isGroup) {
          const subobjectGroup = subobjectInfo as Group;
          subobject.matrix.decompose(subobjectGroup.position, subobjectGroup.quaternion, subobjectGroup.scale);
          (subobjectGroup.userData as Record<string, unknown>).startingBuildingStep = subobject.startingBuildingStep;
          subobjectGroup.name = subobject.fileName;

          loader.applyMaterialsToMesh(subobjectGroup, subobject.colorCode, info.materials);
          (subobjectGroup.userData as Record<string, unknown>).colorCode = subobject.colorCode;

          group.add(subobjectGroup);
          continue;
        }

        const subobjectData = subobjectInfo as unknown as LDrawData;

        // add the subobject group if it has children in case it has both children and primitives
        if (subobjectData.group!.children.length) {
          group.add(subobjectData.group!);
        }

        // transform the primitives into the local space of the parent piece and append them to
        // to the parent primitives list.
        const parentLineSegments = info.lineSegments;
        const parentConditionalSegments = info.conditionalSegments;
        const parentFaces = info.faces;

        const lineSegments = subobjectData.lineSegments;
        const conditionalSegments = subobjectData.conditionalSegments;

        const faces = subobjectData.faces;
        const matrix = subobject.matrix;
        const inverted = subobject.inverted;
        const matrixScaleInverted = matrix.determinant() < 0;
        const colorCode = subobject.colorCode;

        const lineColorCode = colorCode === MAIN_COLOUR_CODE ? MAIN_EDGE_COLOUR_CODE : colorCode;
        for (let i2 = 0, l2 = lineSegments.length; i2 < l2; i2++) {
          const ls = lineSegments[i2]!;
          const vertices = ls.vertices;
          vertices[0]!.applyMatrix4(matrix);
          vertices[1]!.applyMatrix4(matrix);
          ls.colorCode = ls.colorCode === MAIN_EDGE_COLOUR_CODE ? lineColorCode : ls.colorCode;
          ls.material = ls.material ?? getMaterialFromCode(ls.colorCode, ls.colorCode, info.materials, true);

          parentLineSegments.push(ls);
        }

        for (let i3 = 0, l3 = conditionalSegments.length; i3 < l3; i3++) {
          const os = conditionalSegments[i3]!;
          const vertices = os.vertices;
          const controlPoints = os.controlPoints!;
          vertices[0]!.applyMatrix4(matrix);
          vertices[1]!.applyMatrix4(matrix);
          controlPoints[0]!.applyMatrix4(matrix);
          controlPoints[1]!.applyMatrix4(matrix);
          os.colorCode = os.colorCode === MAIN_EDGE_COLOUR_CODE ? lineColorCode : os.colorCode;
          os.material = os.material ?? getMaterialFromCode(os.colorCode, os.colorCode, info.materials, true);

          parentConditionalSegments.push(os);
        }

        for (let i4 = 0, l4 = faces.length; i4 < l4; i4++) {
          const tri = faces[i4]!;
          const vertices = tri.vertices;
          for (let i5 = 0, l5 = vertices.length; i5 < l5; i5++) {
            vertices[i5]!.applyMatrix4(matrix);
          }

          tri.colorCode = tri.colorCode === MAIN_COLOUR_CODE ? colorCode : tri.colorCode;
          tri.material = tri.material ?? getMaterialFromCode(tri.colorCode, colorCode, info.materials, false);
          faceMaterials.add(tri.colorCode);

          // If the scale of the object is negated then the triangle winding order
          // needs to be flipped.
          if (matrixScaleInverted !== inverted) {
            vertices.reverse();
          }

          parentFaces.push(tri);
        }

        info.totalFaces += subobjectData.totalFaces;
      }

      // Apply the parent subobjects pass through material code to this object. This is done several times due
      // to material scoping.
      if (subobject) {
        loader.applyMaterialsToMesh(group, subobject.colorCode, info.materials);
        (group.userData as Record<string, unknown>).colorCode = subobject.colorCode;
      }

      return info;
    };

    // Track material use to see if we need to use the normal smooth slow path for hard edges.
    for (let i = 0, l = info.faces.length; i < l; i++) {
      faceMaterials.add(info.faces[i]!.colorCode);
    }

    await processInfoSubobjects(info);

    if (loader.smoothNormals) {
      const checkSubSegments = faceMaterials.size > 1;
      generateFaceNormals(info.faces);
      smoothNormals(info.faces, info.lineSegments, checkSubSegments);
    }

    // Add the primitive objects and metadata.
    const group = info.group!;
    if (info.faces.length > 0) {
      group.add(createObject(this.loader, info.faces, 3, false, info.totalFaces));
    }

    if (info.lineSegments.length > 0) {
      group.add(createObject(this.loader, info.lineSegments, 2));
    }

    if (info.conditionalSegments.length > 0) {
      group.add(createObject(this.loader, info.conditionalSegments, 2, true));
    }

    return group;
  }

  hasCachedModel(fileName: string): boolean {
    return fileName !== null && fileName.toLowerCase() in this._cache;
  }

  async getCachedModel(fileName: string): Promise<Group | null> {
    if (fileName !== null && this.hasCachedModel(fileName)) {
      const key = fileName.toLowerCase();
      const group = await this._cache[key]!;
      return group.clone();
    } else {
      return null;
    }
  }

  // Loads and parses the model with the given file name. Returns a cached copy if available.
  async loadModel(fileName: string): Promise<Group | null> {
    const parseCache = this.parseCache;
    const key = fileName.toLowerCase();
    if (this.hasCachedModel(fileName)) {
      // Return cached model if available.
      return this.getCachedModel(fileName);
    } else {
      // Otherwise parse a new model.
      // Ensure the file data is loaded and pre parsed.
      await parseCache.ensureDataLoaded(fileName);

      const info = parseCache.getData(fileName) as LDrawData;
      const promise = this.processIntoMesh(info);

      // Now that the file has loaded it's possible that another part parse has been waiting in parallel
      // so check the cache again to see if it's been added since the last async operation so we don't
      // do unnecessary work.
      if (this.hasCachedModel(fileName)) {
        return this.getCachedModel(fileName);
      }

      // Cache object if it's a part so it can be reused later.
      if (isPartType(info.type)) {
        this._cache[key] = promise;
      }

      // return a copy
      const group = await promise;
      return group.clone();
    }
  }

  // parses the given model text into a renderable object. Returns cached copy if available.
  async parseModel(text: string): Promise<Group> {
    const parseCache = this.parseCache;
    const info = parseCache.parse(text);
    if (isPartType(info.type) && info.fileName !== null && this.hasCachedModel(info.fileName)) {
      return this.getCachedModel(info.fileName) as Promise<Group>;
    }

    return this.processIntoMesh(info);
  }
}

function sortByMaterial(a: LDrawSegment | LDrawFace, b: LDrawSegment | LDrawFace): number {
  if (a.colorCode === b.colorCode) {
    return 0;
  }

  if (a.colorCode < b.colorCode) {
    return -1;
  }

  return 1;
}

function createObject(
  loader: LDrawLoader,
  elements: LDrawSegment[] | LDrawFace[],
  elementSize: 2 | 3,
  isConditionalSegments: boolean = false,
  totalElements: number | null = null,
): Mesh | ConditionalLineSegments | LineSegments {
  // Creates a LineSegments (elementSize = 2) or a Mesh (elementSize = 3)
  // With per face / segment material, implemented with mesh groups and materials array

  // Sort the faces or line segments by color code to make later the mesh groups
  elements.sort(sortByMaterial as never);

  if (totalElements === null) {
    totalElements = elements.length;
  }

  const positions = new Float32Array(elementSize * totalElements * 3);
  const normals: Float32Array | null = elementSize === 3 ? new Float32Array(elementSize * totalElements * 3) : null;
  const materials: unknown[] = [];

  const quadArray: unknown[] = [undefined, undefined, undefined, undefined, undefined, undefined];
  const bufferGeometry = new BufferGeometry();
  let prevMaterial: string | null = null;
  let index0 = 0;
  let numGroupVerts = 0;
  let offset = 0;

  for (let iElem = 0, nElem = elements.length; iElem < nElem; iElem++) {
    const elem = elements[iElem] as LDrawFace;
    let vertices = elem.vertices as unknown as Vector3[];
    if (vertices.length === 4) {
      quadArray[0] = vertices[0];
      quadArray[1] = vertices[1];
      quadArray[2] = vertices[2];
      quadArray[3] = vertices[0];
      quadArray[4] = vertices[2];
      quadArray[5] = vertices[3];
      vertices = quadArray as unknown as Vector3[];
    }

    const sideCount = elementSize === 3 && elem.doubleSided ? 2 : 1;
    const sideVertCount = vertices.length;
    const totalVertCount = sideVertCount * sideCount;

    for (let s = 0; s < sideCount; s++) {
      for (let j = 0; j < sideVertCount; j++) {
        // front side: original order; back side: reversed winding
        const v = vertices[s === 0 ? j : sideVertCount - 1 - j]!;
        const index = offset + (s * sideVertCount + j) * 3;
        positions[index] = v.x;
        positions[index + 1] = v.y;
        positions[index + 2] = v.z;
      }
    }

    // create the normals array if this is a set of faces
    if (elementSize === 3) {
      if (!elem.faceNormal) {
        const v0 = vertices[0]!;
        const v1 = vertices[1]!;
        const v2 = vertices[2]!;
        _tempVec0.subVectors(v1, v0);
        _tempVec1.subVectors(v2, v1);
        elem.faceNormal = new Vector3().crossVectors(_tempVec0, _tempVec1).normalize();
      }

      let elemNormals: (NormalWrapper | null)[] = elem.normals as never;
      if (elemNormals.length === 4) {
        quadArray[0] = elemNormals[0];
        quadArray[1] = elemNormals[1];
        quadArray[2] = elemNormals[2];
        quadArray[3] = elemNormals[0];
        quadArray[4] = elemNormals[2];
        quadArray[5] = elemNormals[3];
        elemNormals = quadArray as unknown as (NormalWrapper | null)[];
      }

      const normalCount = elemNormals.length;
      for (let s = 0; s < sideCount; s++) {
        const sign = s === 0 ? 1 : -1;
        for (let j = 0; j < normalCount; j++) {
          // back side reuses the front normals in reversed order, with negated direction
          const idx = s === 0 ? j : normalCount - 1 - j;
          let n = elem.faceNormal!;
          if (elemNormals[idx]) {
            n = (elemNormals[idx] as NormalWrapper).norm;
          }

          const index = offset + (s * normalCount + j) * 3;
          normals![index] = sign * n.x;
          normals![index + 1] = sign * n.y;
          normals![index + 2] = sign * n.z;
        }
      }
    }

    if (prevMaterial !== elem.colorCode) {
      if (prevMaterial !== null) {
        bufferGeometry.addGroup(index0, numGroupVerts, materials.length - 1);
      }

      const material = elem.material as { uuid?: string } | string;

      if (material !== null) {
        if (elementSize === 3) {
          materials.push(material);
        } else if (elementSize === 2) {
          if (isConditionalSegments) {
            const edgeMaterial = loader.edgeMaterialCache.get(material as never) as LDrawSegment | undefined;
            materials.push(loader.conditionalEdgeMaterialCache.get(edgeMaterial as never));
          } else {
            materials.push(loader.edgeMaterialCache.get(material as never));
          }
        }
      } else {
        // If a material has not been made available yet then keep the color code string in the material array
        // to save the spot for the material once a parent scopes materials are being applied to the object.
        materials.push(elem.colorCode);
      }

      prevMaterial = elem.colorCode;
      index0 = offset / 3;
      numGroupVerts = totalVertCount;
    } else {
      numGroupVerts += totalVertCount;
    }

    offset += 3 * totalVertCount;
  }

  if (numGroupVerts > 0) {
    bufferGeometry.addGroup(index0, numGroupVerts, materials.length - 1);
  }

  bufferGeometry.setAttribute("position", new BufferAttribute(positions, 3));

  if (normals !== null) {
    bufferGeometry.setAttribute("normal", new BufferAttribute(normals, 3));
  }

  let object3d: Mesh | ConditionalLineSegments | LineSegments;

  if (elementSize === 2) {
    if (isConditionalSegments) {
      object3d = new ConditionalLineSegments(
        bufferGeometry,
        materials.length === 1 ? (materials[0] as never) : (materials as never),
      );
    } else {
      object3d = new LineSegments(
        bufferGeometry as never,
        materials.length === 1 ? (materials[0] as never) : (materials as never),
      );
    }
  } else {
    object3d = new Mesh(
      bufferGeometry as never,
      materials.length === 1 ? (materials[0] as never) : (materials as never),
    );
  }

  if (isConditionalSegments) {
    (object3d as ConditionalLineSegmentsLike).isConditionalLine = true;

    const controlArray0 = new Float32Array(elements.length * 3 * 2);
    const controlArray1 = new Float32Array(elements.length * 3 * 2);
    const directionArray = new Float32Array(elements.length * 3 * 2);
    for (let i = 0, l = elements.length; i < l; i++) {
      const os = elements[i] as LDrawSegment;
      const vertices = os.vertices;
      const controlPoints = os.controlPoints!;
      const c0 = controlPoints[0]!;
      const c1 = controlPoints[1]!;
      const v0 = vertices[0]!;
      const v1 = vertices[1]!;
      const index = i * 3 * 2;
      controlArray0[index] = c0.x;
      controlArray0[index + 1] = c0.y;
      controlArray0[index + 2] = c0.z;
      controlArray0[index + 3] = c0.x;
      controlArray0[index + 4] = c0.y;
      controlArray0[index + 5] = c0.z;

      controlArray1[index] = c1.x;
      controlArray1[index + 1] = c1.y;
      controlArray1[index + 2] = c1.z;
      controlArray1[index + 3] = c1.x;
      controlArray1[index + 4] = c1.y;
      controlArray1[index + 5] = c1.z;

      directionArray[index] = v1.x - v0.x;
      directionArray[index + 1] = v1.y - v0.y;
      directionArray[index + 2] = v1.z - v0.z;
      directionArray[index + 3] = v1.x - v0.x;
      directionArray[index + 4] = v1.y - v0.y;
      directionArray[index + 5] = v1.z - v0.z;
    }

    bufferGeometry.setAttribute("control0", new BufferAttribute(controlArray0, 3, false));
    bufferGeometry.setAttribute("control1", new BufferAttribute(controlArray1, 3, false));
    bufferGeometry.setAttribute("direction", new BufferAttribute(directionArray, 3, false));
  }

  return object3d;
}

/**
 * A loader for the LDraw format.
 *
 * [LDraw](https://ldraw.org/} (LEGO Draw) is an [open format specification](https://ldraw.org/article/218.html)
 * for describing LEGO and other construction set 3D models.
 *
 * An LDraw asset (a text file usually with extension .ldr, .dat or .txt) can describe just a single construction
 * piece, or an entire model. In the case of a model the LDraw file can reference other LDraw files, which are
 * loaded from a library path set with `setPartsLibraryPath`. You usually download the LDraw official parts library,
 * extract to a folder and point setPartsLibraryPath to it.
 *
 * Library parts will be loaded by trial and error in subfolders 'parts', 'p' and 'models'. These file accesses
 * are not optimal for web environment, so a script tool has been made to pack an LDraw file with all its dependencies
 * into a single file, which loads much faster. See section 'Packing LDraw models'. The LDrawLoader example loads
 * several packed files. The official parts library is not included due to its large size.
 *
 * `LDrawLoader` supports the following extensions:
 * - !COLOUR: Color and surface finish declarations.
 * - BFC: Back Face Culling specification.
 * - !CATEGORY: Model/part category declarations.
 * - !KEYWORDS: Model/part keywords declarations.
 *
 * ```typescript
 * const loader = new LDrawLoader();
 * loader.setConditionalLineMaterial( LDrawConditionalLineMaterial ); // the type of line material depends on the used renderer
 * const object = await loader.loadAsync( 'models/ldraw/officialLibrary/models/car.ldr_Packed.mpd' );
 * scene.add( object );
 * ```
 *
 * @augments Loader
 * @demo examples/webgl_loader_ldraw.html
 * @three_import import { LDrawLoader } from 'ek3d/addons/loaders/LDrawLoader';
 */
/** Material surface the LDraw material library relies on. */
interface LDrawMaterialLike {
  name: string;
  userData: { code: string | null };
  color?: { copy(x: unknown): unknown; setStyle(x: string, cs?: string): unknown };
}

export class LDrawLoader extends Loader<Group, string> {
  /** Array of materials. */
  materials: LDrawMaterialLike[];
  materialLibrary: Record<string, LDrawMaterialLike>;
  edgeMaterialCache: WeakMap<LDrawMaterialLike, LDrawMaterialLike>;
  conditionalEdgeMaterialCache: WeakMap<LDrawMaterialLike, LDrawMaterialLike | null>;
  partsCache: LDrawPartsGeometryCache;
  fileMap: Record<string, string>;
  smoothNormals: boolean;
  partsLibraryPath: string;
  ConditionalLineMaterial: (new (parameters?: Record<string, unknown>) => LDrawMaterialLike) | null;
  missingColorMaterial: MeshStandardMaterial;
  missingEdgeColorMaterial: LineBasicMaterial;
  missingConditionalEdgeColorMaterial: LDrawMaterialLike | null;

  /**
   * Constructs a new LDraw loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: import("../../loaders/LoadingManager").LoadingManager) {
    super(manager);

    // Array of materials
    this.materials = [];
    this.materialLibrary = {};
    this.edgeMaterialCache = new WeakMap();
    this.conditionalEdgeMaterialCache = new WeakMap();

    // This also allows to handle the embedded text files ("0 FILE" lines)
    this.partsCache = new LDrawPartsGeometryCache(this);

    // This object is a map from file names to paths. It agilizes the paths search. If it is not set then files will be searched by trial and error.
    this.fileMap = {};

    // If this flag is set to true the vertex normals will be smoothed.
    this.smoothNormals = true;

    // The path to load parts from the LDraw parts library from.
    this.partsLibraryPath = "";

    // this material type must be injected via setConditionalLineMaterial()
    this.ConditionalLineMaterial = null;

    // Material assigned to not available colors for meshes and edges
    this.missingColorMaterial = new MeshStandardMaterial({
      name: Loader.DEFAULT_MATERIAL_NAME,
      color: 0xff00ff,
      roughness: 0.3,
      metalness: 0,
    });
    this.missingEdgeColorMaterial = new LineBasicMaterial({ name: Loader.DEFAULT_MATERIAL_NAME, color: 0xff00ff });
    this.missingConditionalEdgeColorMaterial = null;
    this.edgeMaterialCache.set(this.missingColorMaterial, this.missingEdgeColorMaterial);
    this.conditionalEdgeMaterialCache.set(this.missingEdgeColorMaterial, this.missingConditionalEdgeColorMaterial);
  }

  /**
   * This method must be called prior to `load()` unless the model to load does not reference
   * library parts (usually it will be a model with all its parts packed in a single file).
   *
   * @param path - Path to library parts files to load referenced parts from.
   * This is different from Loader.setPath, which indicates the path to load the main asset from.
   * @return A reference to this loader.
   */
  setPartsLibraryPath(path: string): this {
    this.partsLibraryPath = path;
    return this;
  }

  /**
   * Sets the conditional line material type which depends on the used renderer.
   * Use {@link LDrawConditionalLineMaterial} when using `WebGLRenderer`.
   *
   * @param type - The conditional line material type.
   * @return A reference to this loader.
   */
  setConditionalLineMaterial(type: new (parameters?: Record<string, unknown>) => LDrawMaterialLike): this {
    this.ConditionalLineMaterial = type;
    this.missingConditionalEdgeColorMaterial = new this.ConditionalLineMaterial({
      name: Loader.DEFAULT_MATERIAL_NAME,
      fog: true,
      color: 0xff00ff,
    });
    this.conditionalEdgeMaterialCache.set(this.missingEdgeColorMaterial, this.missingConditionalEdgeColorMaterial);
    return this;
  }

  /**
   * This async method preloads materials from a single LDraw file. In the official
   * parts library there is a special file which is loaded always the first (LDConfig.ldr)
   * and contains all the standard color codes. This method is intended to be used with
   * not packed files, for example in an editor where materials are preloaded and parts
   * are loaded on demand.
   *
   * @param url - Path of the LDraw materials asset.
   * @return A Promise that resolves when the preload has finished.
   */
  async preloadMaterials(url: string): Promise<void> {
    const fileLoader = new FileLoader(this.manager as never);
    fileLoader.setPriority(this.priority);
    fileLoader.setCache(this.cache);
    fileLoader.setPath(this.path);
    fileLoader.setRequestHeader(this.requestHeader);
    fileLoader.setWithCredentials(this.withCredentials);

    const text = (await fileLoader.loadAsync(url)) as string;
    const colorLineRegex = /^0 !COLOUR/;
    const lines = text.split(/[\n\r]/g);
    const materials: LDrawMaterialLike[] = [];
    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i]!;
      if (colorLineRegex.test(line)) {
        const directive = line.replace(colorLineRegex, "");
        const material = this.parseColorMetaDirective(new LineParser(directive));
        materials.push(material);
      }
    }

    this.addMaterials(materials);
  }

  /**
   * Starts loading from the given URL and passes the loaded LDraw asset
   * to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  load(
    url: string,
    onLoad?: (group: Group) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): this {
    const fileLoader = new FileLoader(this.manager as never);
    fileLoader.setPriority(this.priority);
    fileLoader.setCache(this.cache);
    fileLoader.setPath(this.path);
    fileLoader.setRequestHeader(this.requestHeader);
    fileLoader.setWithCredentials(this.withCredentials);
    fileLoader.load(
      url,
      (text) => {
        // Initializes the materials library with default materials
        this.addDefaultMaterials();

        this.partsCache
          .parseModel(text as string)
          .then((group: Group) => {
            this.applyMaterialsToMesh(group, MAIN_COLOUR_CODE, this.materialLibrary, true);
            this.computeBuildingSteps(group);
            (group.userData as Record<string, unknown>).fileName = url;
            onLoad?.(group);
          })
          .catch((error: unknown) => onError?.(error));
      },
      onProgress,
      onError,
    );

    return this;
  }

  /**
   * Parses the given LDraw data and returns the resulting group.
   *
   * @param text - The raw LDraw data as a string.
   * @param onLoad - Executed when the loading/parsing process has been finished.
   * @param onError - Executed when errors occur.
   */
  parse(text: string, onLoad?: (group: Group) => void, onError?: (error: unknown) => void): void {
    this.partsCache
      .parseModel(text)
      .then((group: Group) => {
        this.applyMaterialsToMesh(group, MAIN_COLOUR_CODE, this.materialLibrary, true);
        this.computeBuildingSteps(group);
        (group.userData as Record<string, unknown>).fileName = "";
        onLoad?.(group);
      })
      .catch((error: unknown) => onError?.(error));
  }

  /**
   * Sets the loader's material library. This method clears existing
   * material definitions.
   *
   * @param materials - The materials to set.
   * @return A reference to this loader.
   */
  setMaterials(materials: LDrawMaterialLike[]): this {
    this.clearMaterials();
    this.addMaterials(materials);

    return this;
  }

  /**
   * Clears the loader's material library.
   *
   * @return A reference to this loader.
   */
  clearMaterials(): this {
    this.materialLibrary = {};
    this.materials = [];

    return this;
  }

  /**
   * Adds a list of materials to the loader's material library.
   *
   * @param materials - The materials to add.
   * @return A reference to this loader.
   */
  addMaterials(materials: LDrawMaterialLike[]): this {
    for (let i = 0, l = materials.length; i < l; i++) {
      this.addMaterial(materials[i]!);
    }

    return this;
  }

  /**
   * Initializes the loader with default materials.
   *
   * @return A reference to this loader.
   */
  addDefaultMaterials(): this {
    // Add default main triangle and line edge materials (used in pieces that can be colored with a main color)
    this.addMaterial(this.parseColorMetaDirective(new LineParser("Main_Colour CODE 16 VALUE #FF8080 EDGE #333333")));
    this.addMaterial(this.parseColorMetaDirective(new LineParser("Edge_Colour CODE 24 VALUE #A0A0A0 EDGE #333333")));

    return this;
  }

  /**
   * Sets a map which maps referenced library filenames to new filenames.
   * If a fileMap is not specified (the default), library parts will be accessed by trial and
   * error in subfolders 'parts', 'p' and 'models'.
   *
   * @param fileMap - The file map to set.
   * @return A reference to this loader.
   */
  setFileMap(fileMap: Record<string, string>): this {
    this.fileMap = fileMap;

    return this;
  }

  /**
   * Adds a single material to the loader's material library.
   *
   * @param material - The material to add.
   * @return A reference to this loader.
   */
  addMaterial(material: LDrawMaterialLike): this {
    // Adds a material to the material library which is on top of the parse scopes stack. And also to the materials array

    const matLib = this.materialLibrary;
    const code = material.userData.code as string; // may be null: mirrors the upstream 'null' key path
    if (!matLib[code]) {
      this.materials.push(material);
      matLib[code] = material;
    }

    return this;
  }

  /**
   * Returns a material for the given color code.
   *
   * @param colorCode - The color code.
   * @return The material. Returns `null` if no material has been found.
   */
  getMaterial(colorCode: string): LDrawMaterialLike | null {
    if (colorCode.startsWith("0x2")) {
      // Special 'direct' material value (RGB color)
      const color = colorCode.substring(3);

      return this.parseColorMetaDirective(
        new LineParser("Direct_Color_" + color + " CODE -1 VALUE #" + color + " EDGE #" + color + ""),
      );
    }

    return this.materialLibrary[colorCode] ?? null;
  }

  // Applies the appropriate materials to a prebuilt hierarchy of geometry. Assumes that color codes are present
  // in the material array if they need to be filled in.
  applyMaterialsToMesh(
    group: Group,
    parentColorCode: string,
    materialHierarchy: Record<string, unknown>,
    finalMaterialPass: boolean = false,
  ): void {
    // find any missing materials as indicated by a color code string and replace it with a material from the current material lib
    // oxlint-disable-next-line typescript/no-this-alias -- the nested getMaterial closure reads `loader` like upstream
    const loader = this;
    const parentIsPassthrough = parentColorCode === MAIN_COLOUR_CODE;
    group.traverse((c) => {
      const holder = c as unknown as { isMesh?: boolean; isLineSegments?: boolean; material?: unknown };
      if (holder.isMesh || holder.isLineSegments) {
        if (Array.isArray(holder.material)) {
          for (let i = 0, l = holder.material.length; i < l; i++) {
            if (!(holder.material[i] as { isMaterial?: boolean }).isMaterial) {
              holder.material[i] = getMaterial(holder, holder.material[i] as string);
            }
          }
        } else if (!(holder.material as { isMaterial?: boolean }).isMaterial) {
          holder.material = getMaterial(holder, holder.material as string);
        }
      }
    });

    // Returns the appropriate material for the object (line or face) given color code. If the code is "pass through"
    // (24 for lines, 16 for edges) then the pass through color code is used. If that is also pass through then it's
    // simply returned for the subsequent material application.
    function getMaterial(
      holder: { isLineSegments?: boolean; isConditionalLine?: boolean },
      colorCode: string,
    ): unknown {
      // if our parent is a passthrough color code and we don't have the current material color available then
      // return early.
      if (parentIsPassthrough && !(colorCode in materialHierarchy) && !finalMaterialPass) {
        return colorCode;
      }

      const forEdge = holder.isLineSegments === true || holder.isConditionalLine === true;
      const isPassthrough =
        (!forEdge && colorCode === MAIN_COLOUR_CODE) || (forEdge && colorCode === MAIN_EDGE_COLOUR_CODE);
      if (isPassthrough) {
        colorCode = parentColorCode;
      }

      let material: unknown = null;
      if (colorCode in materialHierarchy) {
        material = materialHierarchy[colorCode];
      } else if (finalMaterialPass) {
        // see if we can get the final material from the "getMaterial" function which will attempt to
        // parse the "direct" colors
        material = loader.getMaterial(colorCode);
        if (material === null) {
          // otherwise throw a warning if this is final opportunity to set the material
          console.warn(`LDrawLoader: Material properties for code ${colorCode} not available.`);

          // And return the 'missing color' material
          material = loader.missingColorMaterial;
        }
      } else {
        return colorCode;
      }

      if (holder.isLineSegments) {
        material = loader.edgeMaterialCache.get(material as LDrawMaterialLike) as unknown;
        if (holder.isConditionalLine) {
          material = loader.conditionalEdgeMaterialCache.get(material as LDrawMaterialLike) as unknown;
        }
      }

      return material;
    }
  }

  /**
   * Returns the Material for the main LDraw color.
   *
   * For an already loaded LDraw asset, returns the Material associated with the main color code.
   * This method can be useful to modify the main material of a model or part that exposes it.
   *
   * The main color code is the standard way to color an LDraw part. It is '16' for triangles and
   * '24' for edges. Usually a complete model will not expose the main color (that is, no part
   * uses the code '16' at the top level, because they are assigned other specific colors) An LDraw
   * part file on the other hand will expose the code '16' to be colored, and can have additional
   * fixed colors.
   *
   * @return The material. Returns `null` if no material has been found.
   */
  getMainMaterial(): LDrawMaterialLike | null {
    return this.getMaterial(MAIN_COLOUR_CODE);
  }

  /**
   * Returns the material for the edges main LDraw color.
   *
   * @return The material. Returns `null` if no material has been found.
   */
  getMainEdgeMaterial(): LDrawMaterialLike {
    const mat = this.getMaterial(MAIN_EDGE_COLOUR_CODE) as LDrawMaterialLike;
    return this.edgeMaterialCache.get(mat) as LDrawMaterialLike;
  }

  parseColorMetaDirective(lineParser: LineParser): LDrawMaterialLike {
    // Parses a color definition and returns a Material

    let code: string | null = null;

    // Triangle and line colors
    let fillColor = "#FF00FF";
    let edgeColor = "#FF00FF";

    // Transparency
    let alpha = 1;
    let isTransparent = false;

    // Self-illumination:
    let luminance = 0;

    let finishType = FINISH_TYPE_DEFAULT;

    let edgeMaterial: LDrawMaterialLike | null = null;

    const name = lineParser.getToken();
    if (!name) {
      throw new Error(
        'THREE.LDrawLoader: Material name was expected after "!COLOUR tag' + lineParser.getLineNumberString() + ".",
      );
    }

    // Parse tag tokens and their parameters
    let token: string | null = null;
    while (true) {
      token = lineParser.getToken();

      if (!token) {
        break;
      }

      if (!this._parseLuminance(token, (lum) => (luminance = lum))) {
        switch (token.toUpperCase()) {
          case "CODE":
            code = lineParser.getToken();
            break;

          case "VALUE":
            fillColor = lineParser.getToken();
            if (fillColor.startsWith("0x")) {
              fillColor = "#" + fillColor.substring(2);
            } else if (!fillColor.startsWith("#")) {
              throw new Error(
                "THREE.LDrawLoader: Invalid color while parsing material" + lineParser.getLineNumberString() + ".",
              );
            }

            break;

          case "EDGE": {
            edgeColor = lineParser.getToken();
            if (edgeColor.startsWith("0x")) {
              edgeColor = "#" + edgeColor.substring(2);
            } else if (!edgeColor.startsWith("#")) {
              // Try to see if edge color is a color code
              edgeMaterial = this.getMaterial(edgeColor) as never;
              if (!edgeMaterial) {
                throw new Error(
                  "THREE.LDrawLoader: Invalid edge color while parsing material" +
                    lineParser.getLineNumberString() +
                    ".",
                );
              }

              // Get the edge material for this triangle material
              edgeMaterial = this.edgeMaterialCache.get(edgeMaterial) as never;
            }

            break;
          }

          case "ALPHA": {
            alpha = Number.parseInt(lineParser.getToken());

            if (Number.isNaN(alpha)) {
              throw new Error(
                "THREE.LDrawLoader: Invalid alpha value in material definition" +
                  lineParser.getLineNumberString() +
                  ".",
              );
            }

            alpha = Math.max(0, Math.min(1, alpha / 255));

            if (alpha < 1) {
              isTransparent = true;
            }

            break;
          }

          case "LUMINANCE":
            if (!this._parseLuminance(lineParser.getToken(), (lum) => (luminance = lum))) {
              throw new Error(
                "THREE.LDrawLoader: Invalid luminance value in material definition" +
                  lineParser.getLineNumberString() +
                  ".",
              );
            }

            break;

          case "CHROME":
            finishType = FINISH_TYPE_CHROME;
            break;

          case "PEARLESCENT":
            finishType = FINISH_TYPE_PEARLESCENT;
            break;

          case "RUBBER":
            finishType = FINISH_TYPE_RUBBER;
            break;

          case "MATTE_METALLIC":
            finishType = FINISH_TYPE_MATTE_METALLIC;
            break;

          case "METAL":
            finishType = FINISH_TYPE_METAL;
            break;

          case "MATERIAL":
            // Not implemented
            lineParser.setToEnd();
            break;

          default:
            throw new Error(
              'THREE.LDrawLoader: Unknown token "' +
                token +
                '" while parsing material' +
                lineParser.getLineNumberString() +
                ".",
            );
        }
      }
    }

    let material: import("../../materials/MeshStandardMaterial").MeshStandardMaterial;

    switch (finishType) {
      case FINISH_TYPE_DEFAULT:
        material = new MeshStandardMaterial({ roughness: 0.3, metalness: 0 });
        break;

      case FINISH_TYPE_PEARLESCENT:
        // Try to imitate pearlescency by making the surface glossy
        material = new MeshStandardMaterial({ roughness: 0.3, metalness: 0.25 });
        break;

      case FINISH_TYPE_CHROME:
        // Mirror finish surface
        material = new MeshStandardMaterial({ roughness: 0, metalness: 1 });
        break;

      case FINISH_TYPE_RUBBER:
        // Rubber finish
        material = new MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
        break;

      case FINISH_TYPE_MATTE_METALLIC:
        // Brushed metal finish
        material = new MeshStandardMaterial({ roughness: 0.8, metalness: 0.4 });
        break;

      case FINISH_TYPE_METAL:
        // Average metal finish
        material = new MeshStandardMaterial({ roughness: 0.2, metalness: 0.85 });
        break;

      default:
        // Should not happen
        material = new MeshStandardMaterial({ roughness: 0.3, metalness: 0 });
        break;
    }

    material.color.setStyle(fillColor, COLOR_SPACE_LDRAW);
    material.transparent = isTransparent;
    material.opacity = alpha;
    material.depthWrite = !isTransparent;

    material.polygonOffset = true;
    material.polygonOffsetFactor = 1;

    if (luminance !== 0) {
      material.emissive.setStyle(fillColor, COLOR_SPACE_LDRAW).multiplyScalar(luminance);
    }

    if (!edgeMaterial) {
      // This is the material used for edges
      const newEdgeMaterial = new LineBasicMaterial({
        color: new Color().setStyle(edgeColor, COLOR_SPACE_LDRAW),
        transparent: isTransparent,
        opacity: alpha,
        depthWrite: !isTransparent,
      });
      newEdgeMaterial.userData.code = code;
      newEdgeMaterial.name = name + " - Edge";

      if (this.ConditionalLineMaterial === null) {
        throw new Error(
          "THREE.LDrawLoader: ConditionalLineMaterial type must be specified via .setConditionalLineMaterial().",
        );
      }

      // This is the material used for conditional edges
      const conditionalEdgeMaterial = new this.ConditionalLineMaterial({
        fog: true,
        transparent: isTransparent,
        depthWrite: !isTransparent,
        color: new Color().setStyle(edgeColor, COLOR_SPACE_LDRAW),
        opacity: alpha,
      });

      (conditionalEdgeMaterial as { userData: { code: string | null } }).userData.code = code;
      (conditionalEdgeMaterial as { name: string }).name = name + " - Conditional Edge";

      this.conditionalEdgeMaterialCache.set(newEdgeMaterial, conditionalEdgeMaterial);
      this.edgeMaterialCache.set(material, newEdgeMaterial);

      material.userData.code = code;
      material.name = name;

      // keep parsed code bookkeeping for the material library
      void edgeMaterial;

      return material;
    }

    material.userData.code = code;
    material.name = name;

    this.edgeMaterialCache.set(material, edgeMaterial);

    this.addMaterial(material);

    return material;
  }

  /** Parses a `LUMINANCE` token into 0..1, storing through the setter; returns success. */
  private _parseLuminance(token: string, set: (lum: number) => void): boolean {
    let lum: number;

    if (token.startsWith("LUMINANCE")) {
      lum = Number.parseInt(token.substring(9));
    } else {
      lum = Number.parseInt(token);
    }

    if (Number.isNaN(lum)) {
      return false;
    }

    set(Math.max(0, Math.min(1, lum / 255)));

    return true;
  }

  computeBuildingSteps(model: Group): void {
    // Sets userdata.buildingStep number in Group objects and userData.numBuildingSteps number in the root Group object.

    let stepNumber = 0;

    model.traverse((c) => {
      const holder = c as unknown as Group;
      if (holder.isGroup) {
        if ((holder.userData as { startingBuildingStep?: boolean }).startingBuildingStep) {
          stepNumber++;
        }

        (holder.userData as { buildingStep?: number }).buildingStep = stepNumber;
      }
    });

    (model.userData as { numBuildingSteps: number }).numBuildingSteps = stepNumber + 1;
  }
}
