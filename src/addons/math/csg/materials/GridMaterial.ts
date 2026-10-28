import { MeshPhongMaterial } from "../../../../materials/MeshPhongMaterial";
import type { MeshPhongMaterialParameters } from "../../../../materials/MeshPhongMaterial";
import type { WebGLShaderDescriptor } from "../../../../renderers/WebGLRenderer";
import { csgGridShaderMixin } from "./shaderUtils";

export class GridMaterial extends MeshPhongMaterial {
  private _enableGrid: boolean = false;

  get enableGrid() {
    return Boolean(this._enableGrid);
  }

  set enableGrid(v: boolean) {
    if (this._enableGrid !== v) {
      this._enableGrid = v;
      this.needsUpdate = true;
    }
  }

  constructor(parameters?: MeshPhongMaterialParameters) {
    super(parameters);
    this.enableGrid = true;
  }

  onBeforeCompile(descriptor: WebGLShaderDescriptor) {
    const shader = descriptor as WebGLShaderDescriptor & { defines: Record<string, number> };

    csgGridShaderMixin(shader);
    shader.defines.CSG_GRID = Number(this.enableGrid);
  }

  customProgramCacheKey() {
    return this.enableGrid.toString();
  }
}
