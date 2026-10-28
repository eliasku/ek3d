import type { UniformsGroup } from "../core/UniformsGroup";
import { Material } from "./Material";
import { cloneUniforms, cloneUniformsGroups } from "../renderers/shaders/UniformsUtils";
import { Color } from "../math/Color";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";
import { Vector4 } from "../math/Vector4";
import { Matrix3 } from "../math/Matrix3";
import { Matrix4 } from "../math/Matrix4";
import default_vertex from "../renderers/shaders/ShaderChunk/default_vertex.glsl";
import default_fragment from "../renderers/shaders/ShaderChunk/default_fragment.glsl";

export type ShaderMaterialParameters = Partial<ShaderMaterial>;
/**
 * A material rendered with custom shaders. A shader is a small program written in GLSL.
 * that runs on the GPU. You may want to use a custom shader if you need to implement an
 * effect not included with any of the built-in materials.
 *
 * There are the following notes to bear in mind when using a `ShaderMaterial`:
 *
 * - `ShaderMaterial` can only be used with {@link WebGLRenderer}.
 * - Built in attributes and uniforms are passed to the shaders along with your code. If
 * you don't want that, use {@link RawShaderMaterial} instead.
 * - You can use the directive `#pragma unroll_loop_start` and `#pragma unroll_loop_end`
 * in order to unroll a `for` loop in GLSL by the shader preprocessor. The directive has
 * to be placed right above the loop. The loop formatting has to correspond to a defined standard.
 *   - The loop has to be [normalized](https://en.wikipedia.org/wiki/Normalized_loop).
 *   - The loop variable has to be *i*.
 *   - The value `UNROLLED_LOOP_INDEX` will be replaced with the explicitly
 * value of *i* for the given iteration and can be used in preprocessor
 * statements.
 *
 * ```typescript
 * import { ShaderMaterial } from 'ek3d/materials/ShaderMaterial';
 * import { Vector2 } from 'ek3d/math/Vector2';
 *
 * const material = new ShaderMaterial( {
 * 	uniforms: {
 * 		time: { value: 1.0 },
 * 		resolution: { value: new Vector2() }
 * 	},
 * 	vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
 * 	fragmentShader: 'void main() { gl_FragColor = vec4( 1.0 ); }'
 * } );
 * ```
 *
 */
export class ShaderMaterial extends Material {
  isShaderMaterial: boolean;

  defines: Record<string, string | number | boolean>;
  uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  uniformsGroups: UniformsGroup[];
  vertexShader: string;
  fragmentShader: string;
  lights: boolean;
  clipping: boolean;
  extensions: { clipCullDistance: boolean; multiDraw: boolean };
  defaultAttributeValues: Record<string, number[]>;
  index0AttributeName: string | undefined;
  uniformsNeedUpdate: boolean;
  glslVersion: "100" | "300 es" | null;
  linewidth: number;
  wireframe: boolean;
  wireframeLinewidth: number;
  fog: boolean;

  /**
   * Constructs a new shader material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: ShaderMaterialParameters) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isShaderMaterial = true;
    this.type = "ShaderMaterial";
    /**
     * Defines custom constants using `#define` directives within the GLSL code
     * for both the vertex shader and the fragment shader; each key/value pair
     * yields another directive.
     * ```typescript
     * const defines = {
     *   FOO: 15,
     *   BAR: true
     * };
     * ```
     * Yields the lines:
     * ```glsl
     * #define FOO 15
     * #define BAR true
     * ```
     *
     */
    this.defines = {};
    /**
     * An object of the form:
     * ```typescript
     * const uniforms = {
     *   uniform1: { value: 1.0 },
     *   uniform2: { value: 2 }
     * };
     * ```
     * specifying the uniforms to be passed to the shader code; keys are uniform
     * names, values are definitions of the form
     * ```typescript
     * const uniform = { value: 1.0 };
     * ```
     * where `value` is the value of the uniform. Names must match the name of
     * the uniform, as defined in the GLSL code. Note that uniforms are refreshed
     * on every frame, so updating the value of the uniform will immediately
     * update the value available to the GLSL code.
     *
     */
    this.uniforms = {};
    /**
     * An array holding uniforms groups for configuring UBOs.
     *
     */
    this.uniformsGroups = [];
    /**
     * Vertex shader GLSL code. This is the actual code for the shader.
     *
     */
    this.vertexShader = default_vertex;
    /**
     * Fragment shader GLSL code. This is the actual code for the shader.
     *
     */
    this.fragmentShader = default_fragment;
    /**
     * Controls line thickness or lines.
     *
     * WebGL ignores this setting and always render line primitives with a
     * width of one pixel.
     *
     * @default 1
     */
    this.linewidth = 1;
    /**
     * Renders the geometry as a wireframe.
     *
     * @default false
     */
    this.wireframe = false;
    /**
     * Controls the thickness of the wireframe.
     *
     * WebGL ignores this property and always render
     * 1 pixel wide lines.
     *
     * @default 1
     */
    this.wireframeLinewidth = 1;
    /**
     * Defines whether the material color is affected by global fog settings; `true`
     * to pass fog uniforms to the shader.
     *
     * Supply the fog uniforms used by your shader (`fogColor` and either
     * `fogNear`/`fogFar` or `fogDensity`) and implement the matching GLSL.
     * Enabling this flag alone does not add fog calculations to custom shaders.
     *
     * @default false
     */
    this.fog = false;
    /**
     * Defines whether this material uses lighting; `true` to pass uniform data
     * related to lighting to this shader.
     *
     * @default false
     */
    this.lights = false;
    /**
     * Defines whether this material supports clipping; `true` to let the renderer
     * pass the clippingPlanes uniform.
     *
     * @default false
     */
    this.clipping = false;
    /**
     * Overwritten and set to `true` by default.
     *
     * @default true
     */
    this.forceSinglePass = true;
    /**
     * This object allows to enable certain WebGL 2 extensions.
     *
     * - clipCullDistance: set to `true` to use vertex shader clipping
     * - multiDraw: set to `true` to use vertex shader multi_draw / enable gl_DrawID
     *
     */
    this.extensions = {
      clipCullDistance: false, // set to use vertex shader clipping
      multiDraw: false, // set to use vertex shader multi_draw / enable gl_DrawID
    };
    /**
     * When the rendered geometry doesn't include these attributes but the
     * material does, these default values will be passed to the shaders. This
     * avoids errors when buffer data is missing.
     *
     * - color: [ 1, 1, 1 ]
     * - uv: [ 0, 0 ]
     * - uv1: [ 0, 0 ]
     *
     */
    this.defaultAttributeValues = {
      color: [1, 1, 1],
      uv: [0, 0],
      uv1: [0, 0],
    };
    /**
     * If set, this calls [gl.bindAttribLocation](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/bindAttribLocation)
     * to bind a generic vertex index to an attribute variable.
     *
     * @default undefined
     */
    this.index0AttributeName = undefined;
    /**
     * Can be used to force a uniform update while changing uniforms in
     * {@link Object3D#onBeforeRender}.
     *
     * @default false
     */
    this.uniformsNeedUpdate = false;
    /**
     * Defines the GLSL version of custom shader code.
     *
     * @default null
     */
    this.glslVersion = null;
    if (parameters !== undefined) {
      this.setValues(parameters);
    }
  }
  copy(source: ShaderMaterial): this {
    super.copy(source);
    this.fragmentShader = source.fragmentShader;
    this.vertexShader = source.vertexShader;
    this.uniforms = cloneUniforms(source.uniforms);
    this.uniformsGroups = cloneUniformsGroups(source.uniformsGroups);
    this.defines = Object.assign({}, source.defines);
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.fog = source.fog;
    this.lights = source.lights;
    this.clipping = source.clipping;
    this.extensions = Object.assign({}, source.extensions);
    this.glslVersion = source.glslVersion;
    this.defaultAttributeValues = Object.assign({}, source.defaultAttributeValues);
    this.index0AttributeName = source.index0AttributeName;
    this.uniformsNeedUpdate = source.uniformsNeedUpdate;
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.glslVersion = this.glslVersion;
    data.uniforms = {};
    for (const name in this.uniforms) {
      const uniform = this.uniforms[name];
      const value = uniform.value;
      if (value && value.isTexture) {
        data.uniforms[name] = {
          type: "t",
          value: value.toJSON(meta).uuid,
        };
      } else if (value && value.isColor) {
        data.uniforms[name] = {
          type: "c",
          value: value.getHex(),
        };
      } else if (value && value.isVector2) {
        data.uniforms[name] = {
          type: "v2",
          value: value.toArray(),
        };
      } else if (value && value.isVector3) {
        data.uniforms[name] = {
          type: "v3",
          value: value.toArray(),
        };
      } else if (value && value.isVector4) {
        data.uniforms[name] = {
          type: "v4",
          value: value.toArray(),
        };
      } else if (value && value.isMatrix3) {
        data.uniforms[name] = {
          type: "m3",
          value: value.toArray(),
        };
      } else if (value && value.isMatrix4) {
        data.uniforms[name] = {
          type: "m4",
          value: value.toArray(),
        };
      } else {
        data.uniforms[name] = {
          value: value,
        };
        // note: the array variants v2v, v3v, v4v, m4v and tv are not supported so far
      }
    }
    if (Object.keys(this.defines).length > 0) data.defines = this.defines;
    data.vertexShader = this.vertexShader;
    data.fragmentShader = this.fragmentShader;
    data.lights = this.lights;
    data.clipping = this.clipping;
    const extensions: any = {};
    for (const key in this.extensions) {
      if ((this.extensions as any)[key] === true) (extensions as any)[key] = true;
    }
    if (Object.keys(extensions).length > 0) data.extensions = extensions;
    return data;
  }
  /**
   * Deserializes the material from the given JSON.
   *
   * @param json - The JSON holding the serialized material.
   * @param textures - A dictionary holding textures referenced by the material.
   * @return A reference to this material.
   */
  fromJSON(json: any, textures?: any): this {
    super.fromJSON(json, textures);
    if (json.uniforms !== undefined) {
      for (const name in json.uniforms) {
        const uniform = json.uniforms[name];
        this.uniforms[name] = {} as ShaderMaterial["uniforms"][string];
        switch (uniform.type) {
          case "t":
            this.uniforms[name].value = textures[uniform.value] || null;
            break;
          case "c":
            this.uniforms[name].value = new Color().setHex(uniform.value);
            break;
          case "v2":
            this.uniforms[name].value = new Vector2().fromArray(uniform.value);
            break;
          case "v3":
            this.uniforms[name].value = new Vector3().fromArray(uniform.value);
            break;
          case "v4":
            this.uniforms[name].value = new Vector4().fromArray(uniform.value);
            break;
          case "m3":
            this.uniforms[name].value = new Matrix3().fromArray(uniform.value);
            break;
          case "m4":
            this.uniforms[name].value = new Matrix4().fromArray(uniform.value);
            break;
          default:
            this.uniforms[name].value = uniform.value;
        }
      }
    }
    if (json.defines !== undefined) this.defines = json.defines;
    if (json.vertexShader !== undefined) this.vertexShader = json.vertexShader;
    if (json.fragmentShader !== undefined) this.fragmentShader = json.fragmentShader;
    if (json.glslVersion !== undefined) this.glslVersion = json.glslVersion;
    if (json.extensions !== undefined) {
      for (const key in json.extensions) {
        (this.extensions as any)[key] = json.extensions[key];
      }
    }
    if (json.lights !== undefined) this.lights = json.lights;
    if (json.clipping !== undefined) this.clipping = json.clipping;
    return this;
  }
}
/** The fields required to store and run shader code. */
export type Shader = Pick<ShaderMaterial, "name" | "uniforms" | "defines" | "vertexShader" | "fragmentShader">;
