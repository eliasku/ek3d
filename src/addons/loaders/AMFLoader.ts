import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import { Color } from "../../math/Color";
import { Group } from "../../objects/Group";
import { Mesh } from "../../objects/Mesh";

/** ZIP decoder supplied by the application for compressed AMF files. */
export interface AMFZipRuntime {
  unzipSync(data: Uint8Array): Record<string, Uint8Array>;
}

interface AMFColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function color(node: Element): AMFColor {
  const component = (name: string): number => {
    const value = node.getElementsByTagName(name)[0];
    return value === undefined ? 1 : Number(value.textContent);
  };
  return { r: component("r"), g: component("g"), b: component("b"), a: component("a") };
}

function materialColor(material: MeshPhongMaterial, value: AMFColor): void {
  material.color = new Color(value.r, value.g, value.b);
  if (value.a !== 1) {
    material.transparent = true;
    material.opacity = value.a;
  }
}

function metadata(node: Element, type: string): string {
  for (const child of Array.from(node.children)) {
    if (child.localName === "metadata" && child.getAttribute("type") === type) return child.textContent ?? "";
  }
  return "";
}

/** Loads AMF meshes, colors, materials and units; constellations are not supported. */
export class AMFLoader extends Loader<Group, string> {
  zipRuntime: AMFZipRuntime | null = null;

  setZipRuntime(runtime: AMFZipRuntime): this {
    this.zipRuntime = runtime;
    return this;
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
    let bytes: Uint8Array = new Uint8Array(data);
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      if (this.zipRuntime === null) throw new Error("AMFLoader: ZIP runtime is required for compressed AMF files.");
      const entries = this.zipRuntime.unzipSync(bytes);
      const name = Object.keys(entries).find((entry) => entry.toLowerCase().endsWith(".amf"));
      if (name === undefined) throw new Error("AMFLoader: ZIP archive contains no AMF file.");
      bytes = entries[name];
    }
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(bytes), "application/xml");
    const root = xml.documentElement;
    if (root.localName.toLowerCase() !== "amf") throw new Error("AMFLoader: Invalid AMF document.");
    const scales: Record<string, number> = { millimeter: 1, inch: 25.4, feet: 304.8, meter: 1000, micron: 0.001 };
    const scale = scales[(root.getAttribute("unit") ?? "millimeter").toLowerCase()] ?? 1;
    const materials = new Map<string, MeshPhongMaterial>();
    for (const node of Array.from(root.children)) {
      if (node.localName !== "material") continue;
      const material = new MeshPhongMaterial({ name: metadata(node, "name") || "AMF Material", flatShading: true });
      const colorNode = Array.from(node.children).find((child) => child.localName === "color");
      if (colorNode !== undefined) materialColor(material, color(colorNode));
      materials.set(node.getAttribute("id") ?? "", material);
    }
    const result = new Group();
    result.name = metadata(root, "name");
    result.userData.author = metadata(root, "author");
    result.userData.loader = "AMF";
    const fallback = new MeshPhongMaterial({ name: Loader.DEFAULT_MATERIAL_NAME, color: 0xaaaaff, flatShading: true });
    for (const object of Array.from(root.children)) {
      if (object.localName !== "object") continue;
      const group = new Group();
      group.name = metadata(object, "name") || "amfobject";
      let objectColor: AMFColor | undefined;
      for (const child of Array.from(object.children)) {
        if (child.localName === "color") {
          objectColor = color(child);
          continue;
        }
        if (child.localName !== "mesh") continue;
        const vertexValues: number[] = [];
        const normalValues: number[] = [];
        const verticesNode = Array.from(child.children).find((entry) => entry.localName === "vertices");
        if (verticesNode !== undefined) {
          for (const vertex of Array.from(verticesNode.children)) {
            if (vertex.localName !== "vertex") continue;
            for (const entry of Array.from(vertex.children)) {
              const names =
                entry.localName === "coordinates"
                  ? ["x", "y", "z"]
                  : entry.localName === "normal"
                    ? ["nx", "ny", "nz"]
                    : [];
              const target = entry.localName === "normal" ? normalValues : vertexValues;
              for (const name of names) target.push(Number(entry.getElementsByTagName(name)[0]?.textContent));
            }
          }
        }
        const positions = new Float32BufferAttribute(vertexValues, 3);
        const normals = normalValues.length ? new Float32BufferAttribute(normalValues, 3) : null;
        const defaultMaterial = fallback.clone();
        if (objectColor !== undefined) materialColor(defaultMaterial, objectColor);
        for (const volume of Array.from(child.children)) {
          if (volume.localName !== "volume") continue;
          const indices: number[] = [];
          for (const triangle of Array.from(volume.children)) {
            if (triangle.localName !== "triangle") continue;
            for (const name of ["v1", "v2", "v3"])
              indices.push(Number(triangle.getElementsByTagName(name)[0]?.textContent));
          }
          const geometry = new BufferGeometry();
          geometry.setIndex(indices);
          geometry.setAttribute("position", positions.clone());
          if (normals !== null) geometry.setAttribute("normal", normals.clone());
          geometry.scale(scale, scale, scale);
          group.add(
            new Mesh(geometry, (materials.get(volume.getAttribute("materialid") ?? "") ?? defaultMaterial).clone()),
          );
        }
      }
      result.add(group);
    }
    return result;
  }
}
