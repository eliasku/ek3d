import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Vector2 } from "../../math/Vector2";
import { Vector4 } from "../../math/Vector4";
import { Wrapping } from "../../constants";
import { Mesh } from "../../objects/Mesh";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { TextureLoader } from "../../loaders/TextureLoader";
import { Timer } from "../../core/Timer";
import { fog as fogUniforms } from "../../renderers/shaders/UniformsLib";
import { mergeUniforms } from "../../renderers/shaders/UniformsUtils";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
import chunk_fog_pars_vertex from "../../renderers/shaders/ShaderChunk/fog_pars_vertex.glsl";
import chunk_fog_vertex from "../../renderers/shaders/ShaderChunk/fog_vertex.glsl";
import chunk_fog_pars_fragment from "../../renderers/shaders/ShaderChunk/fog_pars_fragment.glsl";
import chunk_fog_fragment from "../../renderers/shaders/ShaderChunk/fog_fragment.glsl";
import chunk_logdepthbuf_pars_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_logdepthbuf_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_logdepthbuf_pars_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_logdepthbuf_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_tonemapping_fragment from "../../renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "../../renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import { Reflector } from "./Reflector";
import { Refractor } from "./Refractor";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Camera } from "../../cameras/Camera";
import type { Object3D } from "../../core/Object3D";
import type { Texture } from "../../textures/Texture";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/** A shader uniform that also carries upstream's legacy `type` hint. */
interface TypedUniform {
  value: unknown;
  needsUpdate?: boolean;
  type?: string;
}

/** A shader definition accepted by {@link Water}. */
export interface Water2Shader {
  name?: string;
  uniforms: Record<string, TypedUniform>;
  vertexShader: string;
  fragmentShader: string;
}

/** Constructor options of `Water2`. */
export interface Water2Options {
  /** The water color. */
  color?: number | Color | string;
  /** The texture width. A higher value results in better quality but is also more expensive. */
  textureWidth?: number;
  /** The texture height. A higher value results in better quality but is also more expensive. */
  textureHeight?: number;
  /** The clip bias. */
  clipBias?: number;
  /** The water's flow direction. */
  flowDirection?: Vector2;
  /** The water's flow speed. */
  flowSpeed?: number;
  /** The water's reflectivity. */
  reflectivity?: number;
  /** The water's scale. */
  scale?: number;
  /** A custom water shader. */
  shader?: Water2Shader;
  /** The flow map. If no flow map is assigned, the water flow is defined by `flowDirection`. */
  flowMap?: Texture | null;
  /** The first water normal map. */
  normalMap0?: Texture;
  /** The second water normal map. */
  normalMap1?: Texture;
}

/**
 * An advanced water effect that supports reflections, refractions and flow maps.
 *
 * Note that this class can only be used with {@link WebGLRenderer}.
 *
 * References:
 *
 * - {@link https://alex.vlachos.com/graphics/Vlachos-SIGGRAPH10-WaterFlow.pdf}
 * - {@link http://graphicsrunner.blogspot.de/2010/08/water-using-flow-maps.html}
 *
 * ```ts
 * import { PlaneGeometry } from 'ek3d/geometries/PlaneGeometry';
 * import { Water } from 'ek3d/addons/objects/Water2';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const water = new Water( new PlaneGeometry( 100, 100 ), { textureWidth: 512, textureHeight: 512 } );
 * water.rotation.x = - Math.PI / 2;
 * scene.add( water );
 * ```
 *
 */
export class Water extends Mesh<ShaderMaterial> {
  /** Use this for type testing. */
  isWater: boolean = true;
  /** The static water shader definition. */
  static WaterShader: Water2Shader = {
    name: "WaterShader",

    uniforms: {
      color: { type: "c", value: null },
      reflectivity: { type: "f", value: 0 },
      tReflectionMap: { type: "t", value: null },
      tRefractionMap: { type: "t", value: null },
      tNormalMap0: { type: "t", value: null },
      tNormalMap1: { type: "t", value: null },
      textureMatrix: { type: "m4", value: null },
      config: { type: "v4", value: new Vector4() },
    },

    vertexShader: /* glsl */ `
${chunk_common}
${chunk_fog_pars_vertex}
${chunk_logdepthbuf_pars_vertex}

		uniform mat4 textureMatrix;

		varying vec4 vCoord;
		varying vec2 vUv;
		varying vec3 vToEye;

		void main() {

			vUv = uv;
			vCoord = textureMatrix * vec4( position, 1.0 );

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vToEye = cameraPosition - worldPosition.xyz;

			vec4 mvPosition =  viewMatrix * worldPosition; // used in fog_vertex
			gl_Position = projectionMatrix * mvPosition;

${chunk_logdepthbuf_vertex}
${chunk_fog_vertex}

		}`,

    fragmentShader: /* glsl */ `
${chunk_common}
${chunk_fog_pars_fragment}
${chunk_logdepthbuf_pars_fragment}

		uniform sampler2D tReflectionMap;
		uniform sampler2D tRefractionMap;
		uniform sampler2D tNormalMap0;
		uniform sampler2D tNormalMap1;

		#ifdef USE_FLOWMAP
			uniform sampler2D tFlowMap;
		#else
			uniform vec2 flowDirection;
		#endif

		uniform vec3 color;
		uniform float reflectivity;
		uniform vec4 config;

		varying vec4 vCoord;
		varying vec2 vUv;
		varying vec3 vToEye;

		void main() {

${chunk_logdepthbuf_fragment}

			float flowMapOffset0 = config.x;
			float flowMapOffset1 = config.y;
			float halfCycle = config.z;
			float scale = config.w;

			vec3 toEye = normalize( vToEye );

			// determine flow direction
			vec2 flow;
			#ifdef USE_FLOWMAP
				flow = texture2D( tFlowMap, vUv ).rg * 2.0 - 1.0;
			#else
				flow = flowDirection;
			#endif
			flow.x *= - 1.0;

			// sample normal maps (distort uvs with flowdata)
			vec4 normalColor0 = texture2D( tNormalMap0, ( vUv * scale ) + flow * flowMapOffset0 );
			vec4 normalColor1 = texture2D( tNormalMap1, ( vUv * scale ) + flow * flowMapOffset1 );

			// linear interpolate to get the final normal color
			float flowLerp = abs( halfCycle - flowMapOffset0 ) / halfCycle;
			vec4 normalColor = mix( normalColor0, normalColor1, flowLerp );

			// calculate normal vector
			vec3 normal = normalize( vec3( normalColor.r * 2.0 - 1.0, normalColor.b,  normalColor.g * 2.0 - 1.0 ) );

			// calculate the fresnel term to blend reflection and refraction maps
			float theta = max( dot( toEye, normal ), 0.0 );
			float reflectance = reflectivity + ( 1.0 - reflectivity ) * pow( ( 1.0 - theta ), 5.0 );

			// calculate final uv coords
			vec3 coord = vCoord.xyz / vCoord.w;
			vec2 uv = coord.xy + coord.z * normal.xz * 0.05;

			vec4 reflectColor = texture2D( tReflectionMap, vec2( 1.0 - uv.x, uv.y ) );
			vec4 refractColor = texture2D( tRefractionMap, uv );

			// multiply water color with the mix of both textures
			gl_FragColor = vec4( color, 1.0 ) * mix( refractColor, reflectColor, reflectance );

${chunk_tonemapping_fragment}
${chunk_colorspace_fragment}
${chunk_fog_fragment}

		}`,
  };

  /** The reflector rendering the reflection map. */
  _reflector: Reflector;
  /** The refractor rendering the refraction map. */
  _refractor: Refractor;
  /** Projective texture matrix used by the shader. */
  _textureMatrix: Matrix4;
  /** Drives the flow map offsets per frame. */
  _timer: Timer;
  /** Default-loaded maps are owned here; maps supplied in options remain caller-owned. */
  private _ownedNormalMap0: Texture | undefined;
  private _ownedNormalMap1: Texture | undefined;

  /**
   * Constructs a new water instance.
   *
   * @param geometry - The water's geometry.
   * @param [options] - The configuration options.
   */
  constructor(geometry: BufferGeometry, options: Water2Options = {}) {
    const color = options.color !== undefined ? new Color(options.color) : new Color(0xffffff);
    const textureWidth = options.textureWidth !== undefined ? options.textureWidth : 512;
    const textureHeight = options.textureHeight !== undefined ? options.textureHeight : 512;
    const clipBias = options.clipBias !== undefined ? options.clipBias : 0;
    const flowDirection = options.flowDirection !== undefined ? options.flowDirection : new Vector2(1, 0);
    const flowSpeed = options.flowSpeed !== undefined ? options.flowSpeed : 0.03;
    const reflectivity = options.reflectivity !== undefined ? options.reflectivity : 0.02;
    const scale = options.scale !== undefined ? options.scale : 1;
    const shader = options.shader !== undefined ? options.shader : Water.WaterShader;

    let textureLoader: TextureLoader | undefined;

    const flowMap = options.flowMap || undefined;
    const normalMap0 =
      options.normalMap0 || (textureLoader = new TextureLoader()).load("textures/water/Water_1_M_Normal.jpg");
    const normalMap1 =
      options.normalMap1 || (textureLoader ?? new TextureLoader()).load("textures/water/Water_2_M_Normal.jpg");

    const cycle = 0.15; // a cycle of a flow map phase
    const halfCycle = cycle * 0.5;
    const textureMatrix = new Matrix4();
    const timer = new Timer();

    const reflector = new Reflector(geometry, {
      textureWidth: textureWidth,
      textureHeight: textureHeight,
      clipBias: clipBias,
    });

    const refractor = new Refractor(geometry, {
      textureWidth: textureWidth,
      textureHeight: textureHeight,
      clipBias: clipBias,
    });

    reflector.matrixAutoUpdate = false;
    refractor.matrixAutoUpdate = false;

    // material

    const material = new ShaderMaterial({
      name: shader.name,
      uniforms: mergeUniforms([fogUniforms, shader.uniforms]),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      transparent: true,
      fog: true,
    });

    if (flowMap !== undefined) {
      material.defines.USE_FLOWMAP = "";
      const flowMapUniform: TypedUniform = {
        type: "t",
        value: flowMap,
      };

      material.uniforms["tFlowMap"] = flowMapUniform;
    } else {
      const flowDirectionUniform: TypedUniform = {
        type: "v2",
        value: flowDirection,
      };

      material.uniforms["flowDirection"] = flowDirectionUniform;
    }

    // maps

    normalMap0.wrapS = normalMap0.wrapT = Wrapping.Repeat;
    normalMap1.wrapS = normalMap1.wrapT = Wrapping.Repeat;

    material.uniforms["tReflectionMap"].value = reflector.getRenderTarget().texture;
    material.uniforms["tRefractionMap"].value = refractor.getRenderTarget().texture;
    material.uniforms["tNormalMap0"].value = normalMap0;
    material.uniforms["tNormalMap1"].value = normalMap1;

    // water

    material.uniforms["color"].value = color;
    material.uniforms["reflectivity"].value = reflectivity;
    material.uniforms["textureMatrix"].value = textureMatrix;

    // initial values

    const config = material.uniforms["config"].value as Vector4;
    config.x = 0; // flowMapOffset0
    config.y = halfCycle; // flowMapOffset1
    config.z = halfCycle; // halfCycle
    config.w = scale; // scale

    super(geometry, material);

    this.type = "Water";
    this._reflector = reflector;
    this._refractor = refractor;
    this._textureMatrix = textureMatrix;
    this._timer = timer;
    this._ownedNormalMap0 = options.normalMap0 ? undefined : normalMap0;
    this._ownedNormalMap1 = options.normalMap1 ? undefined : normalMap1;

    this._flowSpeed = flowSpeed;
    this._cycle = cycle;
    this._halfCycle = halfCycle;
  }

  /** The flow map speed per second. */
  _flowSpeed: number;
  /** A full flow map phase length. */
  _cycle: number;
  /** Half of the flow map phase, also the offset distance between the two maps. */
  _halfCycle: number;

  /**
   * Copies the scene camera transform into the projective texture matrix.
   *
   * @param camera - The scene's camera.
   */
  updateTextureMatrix(camera: Camera): void {
    const textureMatrix = this._textureMatrix;

    textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);

    textureMatrix.multiply(camera.projectionMatrix);
    textureMatrix.multiply(camera.matrixWorldInverse);
    textureMatrix.multiply(this.matrixWorld);
  }

  /**
   * Advances the two flow map offsets inside one cycle.
   */
  updateFlow(): void {
    const delta = this._timer.getDelta();
    const cycle = this._cycle;
    const halfCycle = this._halfCycle;
    const config = this.material.uniforms["config"].value as Vector4;

    config.x += this._flowSpeed * delta; // flowMapOffset0
    config.y = config.x + halfCycle; // flowMapOffset1

    // Important: The distance between offsets should be always the value of "halfCycle".
    // Moreover, both offsets should be in the range of [ 0, cycle ].
    // This approach ensures a smooth water flow and avoids "reset" effects.

    if (config.x >= cycle) {
      config.x = 0;
      config.y = halfCycle;
    } else if (config.y >= cycle) {
      config.y = config.y - cycle;
    }
  }

  /**
   * Renders the reflection and refraction maps before drawing the water surface.
   *
   * @param renderer - The renderer.
   * @param scene - The scene to render.
   * @param camera - The scene's camera.
   */
  override onBeforeRender(
    renderer: WebGLRenderer,
    scene: Object3D,
    camera: Camera,
    _geometry?: BufferGeometry,
    _material?: unknown,
    _group?: unknown,
  ): void {
    this._timer.update();

    this.updateTextureMatrix(camera);
    this.updateFlow();

    const visible = this.visible;

    this.visible = false;

    try {
      this._reflector.matrixWorld.copy(this.matrixWorld);
      this._refractor.matrixWorld.copy(this.matrixWorld);
      this._reflector.onBeforeRender(renderer, scene, camera);
      this._refractor.onBeforeRender(renderer, scene, camera);
    } finally {
      this.visible = visible;
    }
  }

  /**
   * Returns the reflector used for the reflection map.
   *
   * @return The internal reflector.
   */
  getReflector(): Reflector {
    return this._reflector;
  }

  /**
   * Returns the refractor used for the refraction map.
   *
   * @return The internal refractor.
   */
  getRefractor(): Refractor {
    return this._refractor;
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  override dispose(): void {
    this._timer.dispose();
    this._reflector.dispose();
    this._refractor.dispose();
    this.material.dispose();
    this._ownedNormalMap0?.dispose();
    this._ownedNormalMap1?.dispose();
  }
}
