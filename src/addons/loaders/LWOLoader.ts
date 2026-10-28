import type { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { TextureLoader } from "../../loaders/TextureLoader";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import type { Material } from "../../materials/Material";
import type { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import type { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import type { MeshPhysicalMaterial } from "../../materials/MeshPhysicalMaterial";
import { PointsMaterial } from "../../materials/PointsMaterial";
import { Vector3 } from "../../math/Vector3";
import { LineSegments } from "../../objects/LineSegments";
import { Mesh } from "../../objects/Mesh";
import { Points } from "../../objects/Points";
import { IFFParser } from "./lwo/IFFParser";
import type { LWOLayer, LWOTree } from "./lwo/IFFParser";
import { LWOGeometryParser } from "./lwo/LWOGeometryParser";
import { LWOMaterialParser } from "./lwo/LWOMaterialParser";

export type LWOObject = Mesh | LineSegments | Points;
export interface LWOResult {
  materials: (MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial)[];
  meshes: LWOObject[];
}

/** Loads LightWave LWO2 and LWO3 objects. Deprecated upstream since r185. */
export class LWOLoader extends Loader<LWOResult, string> {
  constructor(manager?: LoadingManager) {
    super(manager);
    console.warn(
      "THREE.LWOLoader: The loader has been deprecated and will be removed with r195. Export your LWO files to glTF before using them on the web.",
    );
  }

  override load(
    url: string,
    onLoad?: (result: LWOResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const path = this.path === "" ? extractParentUrl(url, "Objects") : this.path;
    const modelName = (url.split(path).pop() ?? "").split(".")[0];
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.load(
      url,
      (buffer: unknown) => {
        try {
          onLoad?.(this.parse(buffer as ArrayBuffer, path, modelName));
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

  parse(buffer: ArrayBuffer, path: string, modelName: string): LWOResult {
    const tree = new IFFParser().parse(buffer);
    if (!tree) throw new Error("LWOLoader: Unsupported or missing top-level FORM.");
    const textureLoader = new TextureLoader(this.manager)
      .setPath(this.resourcePath || path)
      .setCrossOrigin(this.crossOrigin);
    textureLoader.setPriority(this.priority);
    textureLoader.setCache(this.cache);
    return new LWOTreeParser(tree, textureLoader).parse(modelName);
  }
}

class LWOTreeParser {
  private tree: LWOTree;
  private textureLoader: TextureLoader;
  private materials: LWOResult["materials"] = [];
  private defaultLayerName: string = "";

  constructor(tree: LWOTree, textureLoader: TextureLoader) {
    this.tree = tree;
    this.textureLoader = textureLoader;
  }

  parse(modelName: string): LWOResult {
    this.materials = new LWOMaterialParser(this.tree, this.textureLoader).parse();
    this.defaultLayerName = modelName;
    const geometryParser = new LWOGeometryParser(this.tree);
    const meshes: LWOObject[] = [];
    const roots: LWOObject[] = [];
    for (const layer of this.tree.layers) {
      const geometry = geometryParser.parse(layer.geometry!, layer);
      const mesh = this.parseMesh(geometry, layer);
      meshes[layer.number!] = mesh;
      if (layer.parent === -1) roots.push(mesh);
      else meshes[layer.parent!].add(mesh);
    }
    return { materials: this.materials, meshes: roots };
  }

  private parseMesh(geometry: BufferGeometry, layer: LWOLayer): LWOObject {
    const materials = this.getMaterials(geometry.userData.matNames as string[], layer.geometry!.type);
    const mesh =
      layer.geometry!.type === "points"
        ? new Points(geometry, materials)
        : layer.geometry!.type === "lines"
          ? new LineSegments(geometry, materials)
          : new Mesh(geometry, materials);
    mesh.name = layer.name || this.defaultLayerName + "_layer_" + layer.number;
    const pivot = layer.pivot!;
    if (pivot[0] !== 0 || pivot[1] !== 0 || pivot[2] !== 0) mesh.pivot = new Vector3(pivot[0], pivot[1], pivot[2]);
    return mesh;
  }

  private getMaterials(names: string[], type: string): Material | Material[] {
    const materials = names.map((name) => this.materials.filter((material) => material.name === name)[0]);
    const result: Material[] =
      type === "points"
        ? materials.map((material) => new PointsMaterial({ color: material.color, size: 0.1, map: material.map }))
        : type === "lines"
          ? materials.map((material) => new LineBasicMaterial({ color: material.color }))
          : materials;
    const filtered = result.filter(Boolean);
    return filtered.length === 1 ? filtered[0] : result;
  }
}

function extractParentUrl(url: string, dir: string): string {
  const index = url.indexOf(dir);
  return index === -1 ? "./" : url.slice(0, index);
}
