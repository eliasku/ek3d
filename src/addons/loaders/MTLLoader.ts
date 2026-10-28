import { Side, Wrapping, ColorSpace, Mapping } from "../../constants";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { LoaderUtils } from "../../loaders/LoaderUtils";
import { LoadingManager } from "../../loaders/LoadingManager";
import { TextureLoader } from "../../loaders/TextureLoader";
import { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import type { MeshPhongMaterialParameters } from "../../materials/MeshPhongMaterial";
import { Color } from "../../math/Color";
import { ColorManagement } from "../../math/ColorManagement";
import { Vector2 } from "../../math/Vector2";
import { Texture } from "../../textures/Texture";

export interface MaterialOptions {
  side?: Side;
  wrap?: number;
  normalizeRGB?: boolean;
  ignoreZeroRGBs?: boolean;
  invertTrProperty?: boolean;
}

export interface MaterialInfo {
  [property: string]: string | number[];
}

type MapType = "map" | "specularMap" | "emissiveMap" | "normalMap" | "bumpMap" | "displacementMap" | "alphaMap";

/** MTL companion materials for OBJLoader. */
export class MTLLoader extends Loader<MaterialCreator> {
  materialOptions: MaterialOptions | undefined;

  load(
    url: string,
    onLoad?: (value: MaterialCreator) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (text) => {
        try {
          if (typeof text !== "string") throw new TypeError("MTLLoader: expected text data");
          onLoad?.(this.parse(text, path));
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

  setMaterialOptions(value: MaterialOptions): this {
    this.materialOptions = value;
    return this;
  }

  parse(text: string, path: string): MaterialCreator {
    const materialsInfo: Record<string, MaterialInfo> = {};
    let info: MaterialInfo = {};
    for (let line of text.split("\n")) {
      line = line.trim();
      if (line.length === 0 || line.charAt(0) === "#") continue;
      const pos = line.indexOf(" ");
      const key = (pos >= 0 ? line.substring(0, pos) : line).toLowerCase();
      const value = (pos >= 0 ? line.substring(pos + 1) : "").trim();
      if (key === "newmtl") {
        info = { name: value };
        materialsInfo[value] = info;
      } else if (key === "ka" || key === "kd" || key === "ks" || key === "ke") {
        info[key] = value.split(/\s+/, 3).map(Number.parseFloat);
      } else {
        info[key] = value;
      }
    }
    const creator = new MaterialCreator(this.resourcePath || path, this.materialOptions);
    creator.setCrossOrigin(this.crossOrigin);
    creator.setManager(this.manager);
    creator.priority = this.priority;
    creator.cache = this.cache;
    creator.setMaterials(materialsInfo);
    return creator;
  }
}

/** Creates and caches Phong materials and their textures from parsed MTL records. */
export class MaterialCreator {
  baseUrl: string;
  options: MaterialOptions;
  materialsInfo: Record<string, MaterialInfo> = {};
  materials: Record<string, MeshPhongMaterial> = {};
  materialsArray: MeshPhongMaterial[] = [];
  nameLookup: Record<string, number> = {};
  crossOrigin: string = "anonymous";
  priority: "high" | "low" | "auto" = "auto";
  cache: RequestCache = "default";
  side: Side;
  wrap: number;
  manager: LoadingManager | undefined;

  constructor(baseUrl: string = "", options: MaterialOptions = {}) {
    this.baseUrl = baseUrl;
    this.options = options;
    this.side = options.side !== undefined ? options.side : Side.Front;
    this.wrap = options.wrap !== undefined ? options.wrap : Wrapping.Repeat;
  }

  setCrossOrigin(value: string): this {
    this.crossOrigin = value;
    return this;
  }

  setManager(value: LoadingManager): void {
    this.manager = value;
  }

  setMaterials(materialsInfo: Record<string, MaterialInfo>): void {
    this.materialsInfo = this.convert(materialsInfo);
    this.materials = {};
    this.materialsArray = [];
    this.nameLookup = {};
  }

  convert(materialsInfo: Record<string, MaterialInfo>): Record<string, MaterialInfo> {
    const converted: Record<string, MaterialInfo> = {};
    for (const name in materialsInfo) {
      const material = materialsInfo[name];
      const result: MaterialInfo = {};
      converted[name] = result;
      for (const property in material) {
        let value = material[property];
        const key = property.toLowerCase();
        if ((key === "kd" || key === "ka" || key === "ks") && Array.isArray(value)) {
          if (this.options.normalizeRGB) value = [value[0] / 255, value[1] / 255, value[2] / 255];
          if (this.options.ignoreZeroRGBs && value[0] === 0 && value[1] === 0 && value[2] === 0) continue;
        }
        result[key] = value;
      }
    }
    return converted;
  }

  preload(): void {
    for (const name in this.materialsInfo) this.create(name);
  }

  getIndex(materialName: string): number | undefined {
    return this.nameLookup[materialName];
  }

  getAsArray(): MeshPhongMaterial[] {
    let index = 0;
    for (const name in this.materialsInfo) {
      this.materialsArray[index] = this.create(name);
      this.nameLookup[name] = index++;
    }
    return this.materialsArray;
  }

  create(materialName: string): MeshPhongMaterial {
    if (this.materials[materialName] === undefined) this.createMaterial_(materialName);
    return this.materials[materialName];
  }

  createMaterial_(materialName: string): MeshPhongMaterial {
    const params: MeshPhongMaterialParameters = { name: materialName, side: this.side };
    const setMapForType = (mapType: MapType, value: string): void => {
      if (params[mapType]) return;
      const textureParams = this.getTextureParams(value, params);
      const url = textureParams.url;
      const map = this.loadTexture(url === "" || /^https?:\/\//i.test(url) ? url : this.baseUrl + url);
      map.repeat.copy(textureParams.scale);
      map.offset.copy(textureParams.offset);
      map.wrapS = this.wrap;
      map.wrapT = this.wrap;
      if (mapType === "map" || mapType === "emissiveMap") map.colorSpace = ColorSpace.SRGB;
      params[mapType] = map;
    };
    const material = this.materialsInfo[materialName];
    for (const property in material) {
      const value = material[property];
      if (value === "") continue;
      const key = property.toLowerCase();
      if (Array.isArray(value)) {
        if (key !== "kd" && key !== "ks" && key !== "ke") continue;
        const color = ColorManagement.colorSpaceToWorking(new Color().fromArray(value), ColorSpace.SRGB);
        if (key === "kd") params.color = color;
        else if (key === "ks") params.specular = color;
        else if (key === "ke") params.emissive = color;
        continue;
      }
      switch (key) {
        case "map_kd":
          setMapForType("map", value);
          break;
        case "map_ks":
          setMapForType("specularMap", value);
          break;
        case "map_ke":
          setMapForType("emissiveMap", value);
          break;
        case "norm":
          setMapForType("normalMap", value);
          break;
        case "map_bump":
        case "bump":
          setMapForType("bumpMap", value);
          break;
        case "disp":
          setMapForType("displacementMap", value);
          break;
        case "map_d":
          setMapForType("alphaMap", value);
          params.transparent = true;
          break;
        case "ns":
          params.shininess = parseFloat(value);
          break;
        case "d": {
          const opacity = parseFloat(value);
          if (opacity < 1) {
            params.opacity = opacity;
            params.transparent = true;
          }
          break;
        }
        case "tr": {
          let transparency = parseFloat(value);
          if (this.options.invertTrProperty) transparency = 1 - transparency;
          if (transparency > 0) {
            params.opacity = 1 - transparency;
            params.transparent = true;
          }
          break;
        }
      }
    }
    const result = new MeshPhongMaterial(params);
    this.materials[materialName] = result;
    return result;
  }

  getTextureParams(
    value: string,
    matParams: MeshPhongMaterialParameters,
  ): { scale: Vector2; offset: Vector2; url: string } {
    const scale = new Vector2(1, 1);
    const offset = new Vector2(0, 0);
    const items = value.split(/\s+/);
    let pos = items.indexOf("-bm");
    if (pos >= 0) {
      matParams.bumpScale = parseFloat(items[pos + 1]);
      items.splice(pos, 2);
    }
    pos = items.indexOf("-mm");
    if (pos >= 0) {
      matParams.displacementBias = parseFloat(items[pos + 1]);
      matParams.displacementScale = parseFloat(items[pos + 2]);
      items.splice(pos, 3);
    }
    pos = items.indexOf("-s");
    if (pos >= 0) {
      scale.set(parseFloat(items[pos + 1]), parseFloat(items[pos + 2]));
      items.splice(pos, 4);
    }
    pos = items.indexOf("-o");
    if (pos >= 0) {
      offset.set(parseFloat(items[pos + 1]), parseFloat(items[pos + 2]));
      items.splice(pos, 4);
    }
    return { scale, offset, url: items.join(" ").trim() };
  }

  loadTexture(
    url: string,
    mapping?: Mapping,
    onLoad?: (texture: Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): Texture {
    const manager = (this.manager ??= new LoadingManager());
    const handler = manager.getHandler(url);
    const loader = handler ?? new TextureLoader(manager).setPriority(this.priority).setCache(this.cache);
    loader.setCrossOrigin(this.crossOrigin);
    const texture: unknown = loader.load(
      url,
      (value: unknown) => {
        if (!(value instanceof Texture)) throw new TypeError("MTLLoader: texture handler must load a Texture");
        onLoad?.(value);
      },
      onProgress,
      onError,
    );
    if (!(texture instanceof Texture)) throw new TypeError("MTLLoader: texture handler must return a Texture");
    if (mapping !== undefined) texture.mapping = mapping;
    return texture;
  }
}
