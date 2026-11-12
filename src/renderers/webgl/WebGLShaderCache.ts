import type { Material } from "../../materials/Material";
import type { ShaderMaterial } from "../../materials/ShaderMaterial";

let _id = 0;
export class WebGLShaderCache {
  shaderCache: Map<string, WebGLShaderStage>;
  materialCache: Map<Material, Set<WebGLShaderStage>>;

  constructor() {
    this.shaderCache = new Map();
    this.materialCache = new Map();
  }
  update(material: Material, vertexShaderStage: WebGLShaderStage, fragmentShaderStage: WebGLShaderStage) {
    const materialShaders = this._getShaderCacheForMaterial(material);
    if (materialShaders.has(vertexShaderStage) === false) {
      materialShaders.add(vertexShaderStage);
      vertexShaderStage.usedTimes++;
    }
    if (materialShaders.has(fragmentShaderStage) === false) {
      materialShaders.add(fragmentShaderStage);
      fragmentShaderStage.usedTimes++;
    }
    return this;
  }
  remove(material: Material) {
    const materialShaders = this.materialCache.get(material)!;
    for (const shaderStage of materialShaders) {
      shaderStage.usedTimes--;
      if (shaderStage.usedTimes === 0) this.shaderCache.delete(shaderStage.code);
    }
    this.materialCache.delete(material);
    return this;
  }
  getVertexShaderStage(material: Pick<ShaderMaterial, "vertexShader">) {
    return this._getShaderStage(material.vertexShader);
  }
  getFragmentShaderStage(material: Pick<ShaderMaterial, "fragmentShader">) {
    return this._getShaderStage(material.fragmentShader);
  }
  dispose() {
    this.shaderCache.clear();
    this.materialCache.clear();
  }
  _getShaderCacheForMaterial(material: Material) {
    const cache = this.materialCache;
    let set = cache.get(material);
    if (set === undefined) {
      set = new Set();
      cache.set(material, set);
    }
    return set;
  }
  _getShaderStage(code: string) {
    const cache = this.shaderCache;
    let stage = cache.get(code);
    if (stage === undefined) {
      stage = new WebGLShaderStage(code);
      cache.set(code, stage);
    }
    return stage;
  }
}
class WebGLShaderStage {
  id: number;
  code: string;
  usedTimes: number;

  constructor(code: string) {
    this.id = _id++;
    this.code = code;
    this.usedTimes = 0;
  }
}
