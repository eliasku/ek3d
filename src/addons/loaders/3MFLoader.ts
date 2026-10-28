import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "../../constants";
import { BufferAttribute, Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { CylinderGeometry } from "../../geometries/CylinderGeometry";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { TextureLoader } from "../../loaders/TextureLoader";
import { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";
import { Group } from "../../objects/Group";
import { Mesh } from "../../objects/Mesh";
import type { Texture } from "../../textures/Texture";
import { mergeGeometries } from "../utils/BufferGeometryUtils";

export interface ThreeMFZipRuntime {
  unzipSync(data: Uint8Array): Record<string, Uint8Array>;
}
export interface ThreeMFTriangle {
  v1: number;
  v2: number;
  v3: number;
  pid?: string;
  p1?: number;
  p2?: number;
  p3?: number;
}
export interface ThreeMFBeamLattice {
  radius: number;
  minLength: number;
  cap: string;
  ballMode: string;
  ballRadius: number;
  beams: { v1: number; v2: number; r1?: number; r2?: number }[];
  balls: { vindex: number; r?: number }[];
}
export interface ThreeMFMeshData {
  vertices: Float32Array;
  triangles: Uint32Array;
  triangleProperties: ThreeMFTriangle[];
  beamlattice?: ThreeMFBeamLattice;
}
export interface ThreeMFExtension {
  ns: string;
  apply(model: Element, prefix: string, mesh: ThreeMFMeshData): void;
}

const BEAM = "http://schemas.microsoft.com/3dmanufacturing/beamlattice/2017/02";
const BALL = "http://schemas.microsoft.com/3dmanufacturing/beamlattice/balls/2020/07";

function number(node: Element, name: string, fallback = NaN): number {
  const value = node.getAttribute(name);
  return value === null ? fallback : parseFloat(value);
}
function required(node: Element, name: string): string {
  const value = node.getAttribute(name);
  if (value === null) throw new Error(`ThreeMFLoader: Missing ${name} attribute.`);
  return value;
}
type ImplicitPorts = Record<string, Record<string, string>>;
interface ImplicitFunction {
  id: string | null;
  displayname: string | null;
  operations: Record<string, ImplicitPorts | Record<string, string | null | ImplicitPorts>>;
}
function implicitPorts(node: Element): ImplicitPorts {
  const result: ImplicitPorts = {};
  for (const port of Array.from(node.children)) {
    const args: Record<string, string> = { type: port.nodeName.substring(2) };
    for (const attribute of Array.from(port.attributes))
      if (attribute.specified) args[attribute.name] = attribute.value;
    result[port.getAttribute("identifier") ?? "null"] = args;
  }
  return result;
}
function implicitFunctions(resources: Element): Record<string, ImplicitFunction> {
  const result: Record<string, ImplicitFunction> = {};
  for (const node of Array.from(resources.querySelectorAll("implicitfunction"))) {
    const entry: ImplicitFunction = {
      id: node.getAttribute("id"),
      displayname: node.getAttribute("displayname"),
      operations: {},
    };
    for (const operation of Array.from(node.children)) {
      if (operation.nodeName === "i:in" || operation.nodeName === "i:out") {
        entry.operations[operation.nodeName === "i:in" ? "inputs" : "outputs"] = implicitPorts(operation);
      } else {
        const args: Record<string, string | null | ImplicitPorts> = {
          op: operation.nodeName.substring(2),
          identifier: operation.getAttribute("identifier"),
        };
        for (const child of Array.from(operation.children)) args[child.nodeName.substring(2)] = implicitPorts(child);
        entry.operations[operation.getAttribute("identifier") ?? "null"] = args;
      }
    }
    result[entry.id ?? "null"] = entry;
  }
  return result;
}
function transform(value: string | null): Matrix4 | undefined {
  if (value === null) return undefined;
  const t = value.trim().split(/\s+/).map(Number);
  if (t.length !== 12 || t.some((v) => !Number.isFinite(v))) throw new Error("ThreeMFLoader: Invalid transform.");
  return new Matrix4().set(t[0], t[3], t[6], t[9], t[1], t[4], t[7], t[10], t[2], t[5], t[8], t[11], 0, 0, 0, 1);
}
function parseMesh(node: Element): ThreeMFMeshData {
  const vertices: number[] = [];
  for (const vertex of Array.from(node.querySelectorAll("vertices vertex")))
    vertices.push(number(vertex, "x"), number(vertex, "y"), number(vertex, "z"));
  const indices: number[] = [];
  const triangleProperties: ThreeMFTriangle[] = [];
  for (const triangle of Array.from(node.querySelectorAll("triangles triangle"))) {
    const item: ThreeMFTriangle = {
      v1: number(triangle, "v1"),
      v2: number(triangle, "v2"),
      v3: number(triangle, "v3"),
    };
    indices.push(item.v1, item.v2, item.v3);
    const pid = triangle.getAttribute("pid");
    if (pid !== null) item.pid = pid;
    for (const key of ["p1", "p2", "p3"] as const) if (triangle.hasAttribute(key)) item[key] = number(triangle, key);
    triangleProperties.push(item);
  }
  const mesh: ThreeMFMeshData = {
    vertices: new Float32Array(vertices),
    triangles: new Uint32Array(indices),
    triangleProperties,
  };
  const lattice = node.getElementsByTagNameNS(BEAM, "beamlattice")[0];
  if (lattice !== undefined) {
    const clip = lattice.getAttribute("clippingmode") ?? lattice.getAttribute("clipping");
    if (clip !== null && clip !== "none") console.warn("ThreeMFLoader: Beam lattice clipping is not supported.");
    const beams: ThreeMFBeamLattice["beams"] = [];
    const balls: ThreeMFBeamLattice["balls"] = [];
    for (const beam of Array.from(lattice.getElementsByTagNameNS(BEAM, "beam"))) {
      const item: ThreeMFBeamLattice["beams"][number] = { v1: number(beam, "v1"), v2: number(beam, "v2") };
      if (beam.hasAttribute("r1")) item.r1 = number(beam, "r1");
      if (beam.hasAttribute("r2")) item.r2 = number(beam, "r2");
      beams.push(item);
    }
    for (const ball of Array.from(lattice.getElementsByTagNameNS(BALL, "ball"))) {
      const item: ThreeMFBeamLattice["balls"][number] = { vindex: number(ball, "vindex") };
      if (ball.hasAttribute("r")) item.r = number(ball, "r");
      balls.push(item);
    }
    mesh.beamlattice = {
      radius: number(lattice, "radius"),
      minLength: number(lattice, "minlength"),
      cap: lattice.getAttribute("cap") || "sphere",
      ballMode: lattice.getAttributeNS(BALL, "ballmode") || "none",
      ballRadius: parseFloat(lattice.getAttributeNS(BALL, "ballradius") ?? "NaN"),
      beams,
      balls,
    };
  }
  return mesh;
}
function latticeMesh(data: ThreeMFMeshData): Mesh | undefined {
  const lattice = data.beamlattice;
  if (lattice === undefined) return undefined;
  const geometries: BufferGeometry[] = [];
  const radii = new Map<number, number>();
  const a = new Vector3(),
    b = new Vector3(),
    direction = new Vector3();
  const up = new Vector3(0, 1, 0),
    rotation = new Quaternion(),
    matrix = new Matrix4();
  const addRadius = (index: number, radius: number) => radii.set(index, Math.max(radius, radii.get(index) ?? 0));
  for (const beam of lattice.beams) {
    a.fromArray(data.vertices, beam.v1 * 3);
    b.fromArray(data.vertices, beam.v2 * 3);
    const length = a.distanceTo(b);
    if (length < lattice.minLength || length === 0) continue;
    const r1 = beam.r1 ?? lattice.radius,
      r2 = beam.r2 ?? r1;
    const open = lattice.cap !== "butt";
    const geometry = new CylinderGeometry(r2, r1, length, 8, 1, open);
    rotation.setFromUnitVectors(up, direction.subVectors(b, a).divideScalar(length));
    matrix.makeRotationFromQuaternion(rotation).setPosition(a.add(b).multiplyScalar(0.5));
    geometry.applyMatrix4(matrix);
    geometries.push(geometry);
    if (open) {
      addRadius(beam.v1, r1);
      addRadius(beam.v2, r2);
    }
    if (lattice.ballMode === "all") {
      addRadius(beam.v1, lattice.ballRadius);
      addRadius(beam.v2, lattice.ballRadius);
    }
  }
  for (const ball of lattice.balls) addRadius(ball.vindex, ball.r ?? lattice.ballRadius);
  for (const [index, radius] of radii) {
    const geometry = new SphereGeometry(radius, 8, 6);
    a.fromArray(data.vertices, index * 3);
    geometry.translate(a.x, a.y, a.z);
    geometries.push(geometry);
  }
  if (geometries.length === 0) return undefined;
  const geometry = mergeGeometries(geometries);
  for (const item of geometries) item.dispose();
  if (geometry === null) throw new Error("ThreeMFLoader: Cannot merge lattice geometry.");
  return new Mesh(geometry, new MeshPhongMaterial({ name: Loader.DEFAULT_MATERIAL_NAME, color: 0xffffff }));
}

/** 3MF loader. ZIP decompression is supplied by the consumer. */
export class ThreeMFLoader extends Loader<Group, string> {
  zipRuntime: ThreeMFZipRuntime | null = null;
  availableExtensions: ThreeMFExtension[] = [];

  setZipRuntime(runtime: ThreeMFZipRuntime): this {
    this.zipRuntime = runtime;
    return this;
  }
  addExtension(extension: ThreeMFExtension): void {
    this.availableExtensions.push(extension);
  }
  override load(
    url: string,
    onLoad?: (group: Group) => void,
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
          onLoad?.(this.parse(data as ArrayBuffer));
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

  parse(data: ArrayBuffer): Group {
    if (this.zipRuntime === null) throw new Error("ThreeMFLoader: ZIP runtime is required.");
    const zip = this.zipRuntime.unzipSync(new Uint8Array(data));
    const decoder = new TextDecoder();
    const xml = (path: string): Document => {
      const bytes = zip[path];
      if (bytes === undefined) throw new Error(`ThreeMFLoader: Missing archive part ${path}.`);
      const document = new DOMParser().parseFromString(decoder.decode(bytes), "application/xml");
      if (document.documentElement.localName === "parsererror")
        throw new Error(`ThreeMFLoader: Invalid XML in ${path}.`);
      return document;
    };
    const relName = Object.keys(zip).find((name) => /_rels\/.rels$/.test(name));
    if (relName === undefined) throw new Error("ThreeMFLoader: Cannot find relationship file `rels` in 3MF archive.");
    const rels = Array.from(xml(relName).querySelectorAll("Relationship"));
    const modelRel = rels.find((rel) => (rel.getAttribute("Target") ?? "").toLowerCase().endsWith(".model"));
    if (modelRel === undefined) throw new Error("ThreeMFLoader: Cannot find model relationship.");
    const rootPath = required(modelRel, "Target").replace(/^\//, "");
    const modelPaths = Object.keys(zip).filter((name) => /^3D\/.*\.model$/i.test(name) && name !== rootPath);
    modelPaths.push(rootPath);
    const models = new Map<string, Element>();
    for (const path of modelPaths) {
      const root = xml(path).documentElement;
      if (root.localName.toLowerCase() !== "model") throw new Error(`ThreeMFLoader: Invalid model ${path}.`);
      models.set(path, root);
    }
    const textureLoader = new TextureLoader(this.manager);
    textureLoader.setPriority(this.priority);
    textureLoader.setCache(this.cache);
    const objects = new Map<string, Group>();
    const textures = new Map<Element, Texture>();
    const materials = new Map<Element, MeshPhongMaterial | MeshStandardMaterial>();

    const buildTexture = (node: Element, resources: Element): Texture | null => {
      const texid = required(node, "texid");
      const textureNode = Array.from(resources.querySelectorAll("texture2d")).find(
        (item) => item.getAttribute("id") === texid,
      );
      if (textureNode === undefined) return null;
      const cached = textures.get(textureNode);
      if (cached !== undefined) return cached;
      const path = required(textureNode, "path").replace(/^\//, "");
      const bytes = zip[path];
      if (bytes === undefined) throw new Error(`ThreeMFLoader: Missing texture ${path}.`);
      const uri = URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: required(textureNode, "contenttype") }),
      );
      const texture = textureLoader.load(
        uri,
        () => URL.revokeObjectURL(uri),
        undefined,
        () => URL.revokeObjectURL(uri),
      );
      texture.colorSpace = SRGBColorSpace;
      const wrap = (value: string | null) =>
        value === "mirror"
          ? MirroredRepeatWrapping
          : value === "none" || value === "clamp"
            ? ClampToEdgeWrapping
            : RepeatWrapping;
      texture.wrapS = wrap(textureNode.getAttribute("tilestyleu"));
      texture.wrapT = wrap(textureNode.getAttribute("tilestylev"));
      const filter = textureNode.getAttribute("filter");
      texture.magFilter = filter === "nearest" ? NearestFilter : LinearFilter;
      texture.minFilter =
        filter === "nearest" ? NearestFilter : filter === "linear" ? LinearFilter : LinearMipmapLinearFilter;
      if (filter === "nearest" || filter === "linear") texture.generateMipmaps = false;
      textures.set(textureNode, texture);
      return texture;
    };
    const baseMaterial = (
      base: Element,
      index: number,
      resources: Element,
    ): MeshPhongMaterial | MeshStandardMaterial => {
      const cached = materials.get(base);
      if (cached !== undefined) return cached;
      const displayId = base.getAttribute("displaypropertiesid");
      const display = Array.from(resources.querySelectorAll("pbmetallicdisplayproperties")).find(
        (item) => item.getAttribute("id") === displayId,
      );
      const metallic = display?.querySelectorAll("pbmetallic")[index];
      const material =
        metallic === undefined
          ? new MeshPhongMaterial({ flatShading: true })
          : new MeshStandardMaterial({
              flatShading: true,
              metalness: number(metallic, "metallicness"),
              roughness: number(metallic, "roughness"),
            });
      material.name = base.getAttribute("name") ?? "";
      const value = required(base, "displaycolor");
      material.color.setStyle(value.substring(0, 7), SRGBColorSpace);
      if (value.length === 9) material.opacity = parseInt(value.substring(7, 9), 16) / 255;
      materials.set(base, material);
      return material;
    };
    const buildMesh = (mesh: ThreeMFMeshData, object: Element, resources: Element): Group => {
      const group = new Group();
      const resourceMap = new Map<string, ThreeMFTriangle[]>();
      for (const triangle of mesh.triangleProperties) {
        const pid = triangle.pid ?? object.getAttribute("pid") ?? "default";
        const list = resourceMap.get(pid) ?? [];
        list.push(triangle);
        resourceMap.set(pid, list);
      }
      const resourcesById = Array.from(resources.children);
      for (const [pid, triangles] of resourceMap) {
        const resource = resourcesById.find((item) => item.getAttribute("id") === pid);
        if (pid === "default") {
          const geometry = new BufferGeometry();
          geometry.setIndex(new BufferAttribute(mesh.triangles, 1));
          geometry.setAttribute("position", new BufferAttribute(mesh.vertices, 3));
          const item = new Mesh(
            geometry,
            new MeshPhongMaterial({ name: Loader.DEFAULT_MATERIAL_NAME, color: 0xffffff, flatShading: true }),
          );
          item.name = object.getAttribute("name") ?? "";
          group.add(item);
          continue;
        }
        if (resource === undefined) {
          console.error("ThreeMFLoader: Unsupported resource type.");
          continue;
        }
        const kind = resource.localName;
        const partitions = new Map<number, ThreeMFTriangle[]>();
        for (const triangle of triangles) {
          const key = kind === "basematerials" ? (triangle.p1 ?? number(object, "pindex", 0)) : 0;
          const list = partitions.get(key) ?? [];
          list.push(triangle);
          partitions.set(key, list);
        }
        const props = Array.from(resource.children);
        const colorValues: number[] = [];
        const uvValues: number[] = [];
        if (kind === "colorgroup") {
          const color = new Color();
          for (const prop of props) {
            color.setStyle(required(prop, "color").substring(0, 7), SRGBColorSpace);
            colorValues.push(color.r, color.g, color.b);
          }
        } else if (kind === "texture2dgroup") {
          for (const prop of props) uvValues.push(number(prop, "u"), number(prop, "v"));
        }
        for (const [index, part] of partitions) {
          const positions: number[] = [],
            values: number[] = [];
          for (const triangle of part) {
            const indices = [triangle.v1, triangle.v2, triangle.v3];
            const p1 = triangle.p1 ?? number(object, "pindex", 0);
            const properties = [p1, triangle.p2 ?? p1, triangle.p3 ?? p1];
            for (let i = 0; i < 3; i++) {
              const offset = indices[i] * 3;
              positions.push(mesh.vertices[offset], mesh.vertices[offset + 1], mesh.vertices[offset + 2]);
              if (kind === "colorgroup") {
                const property = properties[i] * 3;
                values.push(colorValues[property], colorValues[property + 1], colorValues[property + 2]);
              } else if (kind === "texture2dgroup") {
                const property = properties[i] * 2;
                values.push(uvValues[property], uvValues[property + 1]);
              }
            }
          }
          const geometry = new BufferGeometry();
          geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
          let material: MeshPhongMaterial | MeshStandardMaterial;
          if (kind === "basematerials") material = baseMaterial(props[index], index, resources);
          else if (kind === "colorgroup") {
            geometry.setAttribute("color", new Float32BufferAttribute(values, 3));
            material = new MeshPhongMaterial({ vertexColors: true, flatShading: true });
          } else if (kind === "texture2dgroup") {
            geometry.setAttribute("uv", new Float32BufferAttribute(values, 2));
            material = new MeshPhongMaterial({ map: buildTexture(resource, resources), flatShading: true });
          } else {
            geometry.dispose();
            console.error("ThreeMFLoader: Unsupported resource type.");
            continue;
          }
          const item = new Mesh(geometry, material);
          item.name = object.getAttribute("name") ?? "";
          group.add(item);
        }
      }
      const lattice = latticeMesh(mesh);
      if (lattice !== undefined) {
        lattice.name = object.getAttribute("name") ?? "";
        group.add(lattice);
      }
      return group;
    };
    for (const [, model] of models) {
      const resources = model.querySelector("resources");
      if (resources === null) throw new Error("ThreeMFLoader: Model has no resources.");
      const objectNodes = Array.from(resources.querySelectorAll("object"));
      const building = new Set<string>();
      const built = new Set<string>();
      const buildObject = (id: string): Group => {
        const object = objectNodes.find((node) => node.getAttribute("id") === id);
        const existing = objects.get(id);
        if (existing !== undefined && (built.has(id) || object === undefined)) return existing;
        if (building.has(id)) throw new Error("ThreeMFLoader: Circular component reference.");
        if (object === undefined) throw new Error(`ThreeMFLoader: Missing object ${id}.`);
        building.add(id);
        const meshNode = object.querySelector("mesh");
        let group: Group;
        if (meshNode !== null) {
          const mesh = parseMesh(meshNode);
          for (const attr of Array.from(model.attributes)) {
            if (!attr.name.startsWith("xmlns:")) continue;
            for (const extension of this.availableExtensions) {
              if (attr.value === extension.ns) extension.apply(model, attr.name.substring(6), mesh);
            }
          }
          group = buildMesh(mesh, object, resources);
        } else {
          group = new Group();
          for (const component of Array.from(object.querySelectorAll("components component"))) {
            const child = buildObject(required(component, "objectid")).clone();
            const matrix = transform(component.getAttribute("transform"));
            if (matrix !== undefined) child.applyMatrix4(matrix);
            group.add(child);
          }
        }
        group.name = object.getAttribute("name") ?? "";
        building.delete(id);
        built.add(id);
        objects.set(id, group);
        return group;
      };
      for (const object of objectNodes) buildObject(required(object, "id"));
      const implicit = implicitFunctions(resources);
      if (Object.keys(implicit).length > 0) console.warn("ThreeMFLoader: Implicit functions are data-only.", implicit);
    }
    const root = models.get(rootPath);
    if (root === undefined) throw new Error("ThreeMFLoader: Missing root model.");
    const group = new Group();
    for (const item of Array.from(root.querySelectorAll("build item"))) {
      const id = required(item, "objectid");
      const object = objects.get(id);
      if (object === undefined) throw new Error(`ThreeMFLoader: Missing build object ${id}.`);
      const child = object.clone();
      const matrix = transform(item.getAttribute("transform"));
      if (matrix !== undefined) child.applyMatrix4(matrix);
      group.add(child);
    }
    return group;
  }
}
