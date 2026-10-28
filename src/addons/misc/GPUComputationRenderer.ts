import { Wrapping, TextureType, TextureFilter, PixelFormat } from "../../constants";
import { DataTexture } from "../../textures/DataTexture";
import type { Texture } from "../../textures/Texture";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import type { Material } from "../../materials/Material";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { FullScreenQuad } from "../postprocessing/Pass";

export interface GPUComputationVariable {
  name: string;
  initialValueTexture: Texture;
  material: ShaderMaterial;
  dependencies: GPUComputationVariable[] | null;
  renderTargets: WebGLRenderTarget[];
  wrapS: Wrapping | null;
  wrapT: Wrapping | null;
  minFilter: TextureFilter;
  magFilter: TextureFilter;
}

/** Computes variables in float textures using ping-pong render targets. */
export class GPUComputationRenderer {
  variables: GPUComputationVariable[];
  currentTextureIndex: number;
  private sizeX: number;
  private sizeY: number;
  private renderer: WebGLRenderer;
  private dataType: TextureType;
  private passThruUniforms: { passThruTexture: { value: Texture | null } };
  private passThruShader: ShaderMaterial;
  private quad: FullScreenQuad;

  constructor(sizeX: number, sizeY: number, renderer: WebGLRenderer) {
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.renderer = renderer;
    this.variables = [];
    this.currentTextureIndex = 0;
    this.dataType = TextureType.Float;
    this.passThruUniforms = { passThruTexture: { value: null } };
    this.passThruShader = this.createShaderMaterial(
      `
uniform sampler2D passThruTexture;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  gl_FragColor = texture2D( passThruTexture, uv );
}`,
      this.passThruUniforms,
    );
    this.quad = new FullScreenQuad(this.passThruShader);
  }

  setDataType(type: number): this {
    this.dataType = type;
    return this;
  }

  addVariable(name: string, computeFragmentShader: string, initialValueTexture: Texture): GPUComputationVariable {
    const variable: GPUComputationVariable = {
      name,
      initialValueTexture,
      material: this.createShaderMaterial(computeFragmentShader),
      dependencies: null,
      renderTargets: [],
      wrapS: null,
      wrapT: null,
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
    };
    this.variables.push(variable);
    return variable;
  }

  setVariableDependencies(variable: GPUComputationVariable, dependencies: GPUComputationVariable[]): void {
    variable.dependencies = dependencies;
  }

  init(): string | null {
    if (this.renderer.capabilities.maxVertexTextures === 0) return "No support for vertex shader textures.";
    for (const variable of this.variables) {
      variable.renderTargets[0] = this.createRenderTarget(
        this.sizeX,
        this.sizeY,
        variable.wrapS,
        variable.wrapT,
        variable.minFilter,
        variable.magFilter,
      );
      variable.renderTargets[1] = this.createRenderTarget(
        this.sizeX,
        this.sizeY,
        variable.wrapS,
        variable.wrapT,
        variable.minFilter,
        variable.magFilter,
      );
      this.renderTexture(variable.initialValueTexture, variable.renderTargets[0]);
      this.renderTexture(variable.initialValueTexture, variable.renderTargets[1]);
      if (variable.dependencies !== null) {
        for (const dependency of variable.dependencies) {
          if (
            dependency.name !== variable.name &&
            !this.variables.some((candidate) => candidate.name === dependency.name)
          ) {
            return `Variable dependency not found. Variable=${variable.name}, dependency=${dependency.name}`;
          }
          variable.material.uniforms[dependency.name] = { value: null };
          variable.material.fragmentShader =
            `\nuniform sampler2D ${dependency.name};\n` + variable.material.fragmentShader;
        }
      }
    }
    this.currentTextureIndex = 0;
    return null;
  }

  compute(): void {
    const current = this.currentTextureIndex;
    const next = current === 0 ? 1 : 0;
    for (const variable of this.variables) {
      if (variable.dependencies !== null) {
        for (const dependency of variable.dependencies) {
          variable.material.uniforms[dependency.name].value = dependency.renderTargets[current].texture;
        }
      }
      this.doRenderTarget(variable.material, variable.renderTargets[next]);
    }
    this.currentTextureIndex = next;
  }

  getCurrentRenderTarget(variable: GPUComputationVariable): WebGLRenderTarget {
    return variable.renderTargets[this.currentTextureIndex];
  }

  getAlternateRenderTarget(variable: GPUComputationVariable): WebGLRenderTarget {
    return variable.renderTargets[this.currentTextureIndex === 0 ? 1 : 0];
  }

  dispose(): void {
    this.quad.dispose();
    this.passThruShader.dispose();
    for (const variable of this.variables) {
      variable.initialValueTexture.dispose();
      for (const target of variable.renderTargets) target.dispose();
      variable.material.dispose();
    }
  }

  addResolutionDefine(material: ShaderMaterial): void {
    material.defines.resolution = `vec2( ${this.sizeX.toFixed(1)}, ${this.sizeY.toFixed(1)} )`;
  }

  createShaderMaterial(fragmentShader: string, uniforms: Record<string, { value: unknown }> = {}): ShaderMaterial {
    const material = new ShaderMaterial({
      name: "GPUComputationShader",
      uniforms,
      vertexShader: "void main() { gl_Position = vec4( position, 1.0 ); }",
      fragmentShader,
    });
    this.addResolutionDefine(material);
    return material;
  }

  createRenderTarget(
    width: number = this.sizeX,
    height: number = this.sizeY,
    wrapS: Wrapping | null = Wrapping.ClampToEdge,
    wrapT: Wrapping | null = Wrapping.ClampToEdge,
    minFilter: TextureFilter = TextureFilter.Nearest,
    magFilter: TextureFilter = TextureFilter.Nearest,
  ): WebGLRenderTarget {
    return new WebGLRenderTarget(width || this.sizeX, height || this.sizeY, {
      wrapS: wrapS || Wrapping.ClampToEdge,
      wrapT: wrapT || Wrapping.ClampToEdge,
      minFilter: minFilter || TextureFilter.Nearest,
      magFilter: magFilter || TextureFilter.Nearest,
      format: PixelFormat.RGBA,
      type: this.dataType,
      depthBuffer: false,
    });
  }

  createTexture(): DataTexture {
    const texture = new DataTexture(
      new Float32Array(this.sizeX * this.sizeY * 4),
      this.sizeX,
      this.sizeY,
      PixelFormat.RGBA,
      TextureType.Float,
    );
    texture.needsUpdate = true;
    return texture;
  }

  renderTexture(input: Texture, output: WebGLRenderTarget): void {
    this.passThruUniforms.passThruTexture.value = input;
    try {
      this.doRenderTarget(this.passThruShader, output);
    } finally {
      this.passThruUniforms.passThruTexture.value = null;
    }
  }

  doRenderTarget(material: Material, output: WebGLRenderTarget): void {
    const renderer = this.renderer;
    const currentTarget = renderer.getRenderTarget();
    const shadowMap = renderer.shadowMap;
    const shadowAutoUpdate = shadowMap?.autoUpdate;
    if (shadowMap) shadowMap.autoUpdate = false;
    this.quad.material = material;
    try {
      renderer.setRenderTarget(output);
      this.quad.render(renderer);
    } finally {
      this.quad.material = this.passThruShader;
      if (shadowMap && shadowAutoUpdate !== undefined) shadowMap.autoUpdate = shadowAutoUpdate;
      renderer.setRenderTarget(currentTarget);
    }
  }
}
