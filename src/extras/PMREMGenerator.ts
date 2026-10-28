import type { Material } from "../materials/Material";
import type { Object3D } from "../core/Object3D";
import type { Texture } from "../textures/Texture";
import type { WebGLRenderer } from "../renderers/WebGLRenderer";
import chunk_common from "../renderers/shaders/ShaderChunk/common.glsl";
import chunk_begin_vertex from "../renderers/shaders/ShaderChunk/begin_vertex.glsl";
import chunk_project_vertex from "../renderers/shaders/ShaderChunk/project_vertex.glsl";
import { Mapping, TextureFilter, Blending, TextureType, Side, ColorSpace } from "../constants";
import { Mesh } from "../objects/Mesh";
import { BoxGeometry } from "../geometries/BoxGeometry";
import { CubeCamera } from "../cameras/CubeCamera";
import { ShaderMaterial } from "../materials/ShaderMaterial";
import { Color } from "../math/Color";
import { floorPowerOfTwo } from "../math/MathUtils";
import { Vector3 } from "../math/Vector3";
import { WebGLCubeRenderTarget } from "../renderers/WebGLCubeRenderTarget";

export interface PMREMGeneratorOptions {
  size?: number;
  position?: Vector3;
}
// Smaller inputs are upsampled so that every PMREM has enough mip levels.
const MIN_SIZE = 256;
// Log2 of the face size of the roughest mip level. Smaller faces can't
// represent the diffuse irradiance that is stored in this level.
const LOD_MIN = 3;
// Spiral samples per pass of the initial fromScene() blur.
const BLUR_SAMPLES = 20;
// GGX VNDF samples for the sharp mip levels.
const GGX_SAMPLES = 256;
// Integrate a small source mip for the rough levels to avoid sampling noise.
const INTEGRATION_SIZE = 16;
const INTEGRATION_LEVELS = 3;
const _origin = /*@__PURE__*/ new Vector3();
const _clearColor = /*@__PURE__*/ new Color();
/**
 * Generates a Prefiltered, Mipmapped Radiance Environment Map (PMREM) for
 * image-based lighting. The result is a cube render target whose mip levels
 * store GGX-filtered radiance at increasing roughness, from a mirror at level 0
 * to roughness 1. See {@link PMREMGenerator.lodToRoughness} for the mapping.
 *
 * Filtering assumes the view direction equals the surface normal. Sharp levels
 * use GGX visible normal sampling (Heitz, 2018), while rough levels integrate a
 * lower-resolution source cubemap.
 *
 * @see {@link https://jcgt.org/published/0007/04/01/ | Sampling the GGX Distribution of Visible Normals}
 */
export class PMREMGenerator {
  _renderer: any;
  _cubeSize: number;
  _sourceTarget: WebGLCubeRenderTarget | null;
  _cubeCamera: CubeCamera;
  _boxMesh: Mesh;
  _cubemapMaterial: ShaderMaterial | null;
  _equirectMaterial: ShaderMaterial | null;
  _blurMaterial: ShaderMaterial | null;
  _ggxMaterial: ShaderMaterial | null;
  _integrationMaterial: ShaderMaterial | null;

  /**
   * Constructs a new PMREM generator.
   *
   * @param renderer - The renderer.
   */
  constructor(renderer: WebGLRenderer) {
    this._renderer = renderer;
    this._cubeSize = 0;
    this._sourceTarget = null;
    this._cubeCamera = new CubeCamera(1, 10, null as unknown as WebGLCubeRenderTarget);
    this._boxMesh = new Mesh(new BoxGeometry(5, 5, 5), null as unknown as Material);
    this._cubemapMaterial = null;
    this._equirectMaterial = null;
    this._blurMaterial = null;
    this._ggxMaterial = null;
    this._integrationMaterial = null;
  }
  /**
   * Generates a PMREM from a scene, optionally applying a Gaussian blur before
   * GGX filtering.
   *
   * @param scene - The scene to be captured.
   * @param [sigma=0] - The blur radius in radians.
   * @param [near=0.1] - The near plane distance.
   * @param [far=100] - The far plane distance.
   * @param [options={}] - The configuration options.
   * @return The resulting PMREM.
   */
  fromScene(
    scene: Object3D,
    sigma: number = 0,
    near: number = 0.1,
    far: number = 100,
    options: PMREMGeneratorOptions = {},
  ): WebGLCubeRenderTarget {
    const { size = 256, position = _origin } = options;
    const renderer = this._renderer;
    this._setSize(size);
    const pmremTarget = this._allocateTarget();
    const sourceTarget = this._getSourceTarget(true);
    if (sigma > 0) {
      sourceTarget.texture.mipmapsAutoUpdate = false;
    }
    const autoClear = renderer.autoClear;
    const autoClearColor = renderer.autoClearColor;
    const autoClearDepth = renderer.autoClearDepth;
    const autoClearStencil = renderer.autoClearStencil;
    const sceneWithBackground = scene as unknown as SceneLike;
    const background = sceneWithBackground.background;
    try {
      try {
        renderer.autoClear = true;
        renderer.autoClearColor = true;
        renderer.autoClearDepth = true;
        renderer.autoClearStencil = true;
        if (background === null) sceneWithBackground.background = renderer.getClearColor(_clearColor);
        const cubeCamera = new CubeCamera(near, far, sourceTarget);
        (cubeCamera.position as unknown as { copy(v: unknown): void }).copy(position);
        cubeCamera.update(renderer, scene);
      } finally {
        renderer.autoClear = autoClear;
        renderer.autoClearColor = autoClearColor;
        renderer.autoClearDepth = autoClearDepth;
        renderer.autoClearStencil = autoClearStencil;
        sceneWithBackground.background = background;
        sourceTarget.texture.mipmapsAutoUpdate = true;
      }
      if (sigma > 0) {
        sourceTarget.texture.mipmapsAutoUpdate = true;
        this._blur(pmremTarget, sigma);
      }
      this._applyPMREM(pmremTarget);
    } catch (error: any) {
      pmremTarget.dispose();
      throw error;
    }
    return pmremTarget;
  }
  /**
   * Generates a PMREM from an LDR or HDR equirectangular texture. The cube face
   * size is one quarter of the image width, rounded down to a power of two and
   * at least 256.
   *
   * @param equirectangular - The equirectangular texture to be converted.
   * @param [renderTarget=null] - The render target to use.
   * @return The resulting PMREM.
   */
  fromEquirectangular(equirectangular: Texture, renderTarget?: WebGLCubeRenderTarget | null): WebGLCubeRenderTarget;
  fromEquirectangular(equirectangular: Texture, renderTarget: any = null): WebGLCubeRenderTarget {
    return this._fromTexture(equirectangular, renderTarget);
  }
  /**
   * Generates a PMREM from an LDR or HDR cubemap. The cube face size matches
   * the input, rounded down to a power of two and at least 256.
   *
   * @param cubemap - The cubemap texture to be converted.
   * @param [renderTarget=null] - The render target to use.
   * @return The resulting PMREM.
   */
  fromCubemap(cubemap: Texture, renderTarget?: WebGLCubeRenderTarget | null): WebGLCubeRenderTarget;
  fromCubemap(cubemap: Texture, renderTarget: any = null): WebGLCubeRenderTarget {
    return this._fromTexture(cubemap, renderTarget);
  }
  /**
   * Pre-compiles the cubemap shader. You can get faster start-up by invoking this method during
   * your texture's network fetch for increased concurrency.
   */
  compileCubemapShader() {
    if (this._cubemapMaterial === null) {
      this._cubemapMaterial = _getCubemapMaterial();
      this._compileMaterial(this._cubemapMaterial);
    }
  }
  /**
   * Pre-compiles the equirectangular shader. You can get faster start-up by invoking this method during
   * your texture's network fetch for increased concurrency.
   */
  compileEquirectangularShader() {
    if (this._equirectMaterial === null) {
      this._equirectMaterial = _getEquirectMaterial();
      this._compileMaterial(this._equirectMaterial);
    }
  }
  /**
   * Disposes of the PMREMGenerator's internal memory. The PMREMs it returned
   * belong to the caller and are not disposed.
   */
  dispose() {
    if (this._sourceTarget !== null) this._sourceTarget.dispose();
    if (this._cubemapMaterial !== null) this._cubemapMaterial.dispose();
    if (this._equirectMaterial !== null) this._equirectMaterial.dispose();
    if (this._blurMaterial !== null) this._blurMaterial.dispose();
    if (this._ggxMaterial !== null) this._ggxMaterial.dispose();
    if (this._integrationMaterial !== null) this._integrationMaterial.dispose();
    this._boxMesh.geometry.dispose();
  }
  /**
   * Returns the roughness a mip level of a PMREM has been prefiltered for.
   * The inverse mapping is used by the renderers when sampling a PMREM.
   *
   * @param lod - The mip level.
   * @param maxLod - The last mip level of the PMREM.
   * @return The roughness.
   */
  static lodToRoughness(lod: number, maxLod: number): number {
    return maxLod > 0 ? 1 - Math.sqrt(1 - lod / maxLod) : 0;
  }
  // private interface
  _setSize(cubeSize?: any) {
    this._cubeSize = Math.max(MIN_SIZE, floorPowerOfTwo(cubeSize));
  }
  _fromTexture(texture: any, renderTarget?: any) {
    if (texture.mapping === Mapping.CubeReflection || texture.mapping === Mapping.CubeRefraction) {
      this._setSize(texture.image.length === 0 ? MIN_SIZE : texture.image[0].width || texture.image[0].image.width);
    } else {
      // Equirectangular
      this._setSize(texture.image.width / 4);
    }
    const pmremTarget = renderTarget || this._allocateTarget();
    try {
      this._textureToCubemap(texture);
      this._applyPMREM(pmremTarget);
    } catch (error: any) {
      if (!renderTarget) pmremTarget.dispose();
      throw error;
    }
    return pmremTarget;
  }
  _allocateTarget() {
    const size = this._cubeSize;
    const pmremTarget = _createRenderTarget(size, false, false);
    // Allocate only the prefiltered mip levels without automatic mipmap generation.
    const maxLod = Math.log2(size) - LOD_MIN;
    for (let lod = 0; lod <= maxLod; lod++) {
      pmremTarget.texture.mipmaps.push({ width: size >> lod, height: size >> lod });
    }
    pmremTarget.texture.name = "PMREM";
    pmremTarget.texture.isPMREMTexture = true;
    return pmremTarget;
  }
  _getSourceTarget(depthBuffer: boolean = false): WebGLCubeRenderTarget {
    const size = this._cubeSize;
    const sourceTarget = this._sourceTarget;
    if (sourceTarget === null || sourceTarget.width !== size || (depthBuffer && sourceTarget.depthBuffer === false)) {
      if (sourceTarget !== null) sourceTarget.dispose();
      this._sourceTarget = _createRenderTarget(size, true, depthBuffer);
    }
    return this._sourceTarget!;
  }
  _compileMaterial(material?: any) {
    this._boxMesh.material = material;
    this._renderer.compile(this._boxMesh, this._cubeCamera.children[0]);
  }
  /**
   * Renders the box mesh with the given material into all six faces of a cube render target.
   *
   * @private
   * @param target - The render target.
   * @param lod - The mip level to render into.
   * @param material - The material.
   */
  _renderCube(target: WebGLCubeRenderTarget, lod: number, material: ShaderMaterial) {
    const boxMesh = this._boxMesh;
    const cubeCamera = this._cubeCamera;
    boxMesh.material = material;
    cubeCamera.renderTarget = target;
    cubeCamera.activeMipmapLevel = lod;
    const size = target.width >> lod;
    try {
      target.viewport.set(0, 0, size, size);
      cubeCamera.update(this._renderer, boxMesh);
    } finally {
      target.viewport.set(0, 0, target.width, target.height);
    }
  }
  _textureToCubemap(texture?: any) {
    let material: any;
    if (texture.mapping === Mapping.CubeReflection || texture.mapping === Mapping.CubeRefraction) {
      if (this._cubemapMaterial === null) {
        this._cubemapMaterial = _getCubemapMaterial();
      }
      material = this._cubemapMaterial;
      material.uniforms.flipEnvMap.value = texture.isRenderTargetTexture === false ? -1 : 1;
    } else {
      if (this._equirectMaterial === null) {
        this._equirectMaterial = _getEquirectMaterial();
      }
      material = this._equirectMaterial;
    }
    material.uniforms.envMap.value = texture;
    this._renderCube(this._getSourceTarget(), 0, material);
  }
  /**
   * Prefilters the source cubemap into the mip levels of the PMREM. The sharp levels
   * integrate the GGX lobe of their roughness with VNDF importance sampling, reading the
   * mip level of the source that matches the solid angle of each sample. The rough
   * levels weight every texel of a small source mip with the GGX lobe instead.
   *
   * @private
   * @param pmremTarget - The PMREM.
   */
  _applyPMREM(pmremTarget: WebGLCubeRenderTarget) {
    if (this._ggxMaterial === null) {
      this._ggxMaterial = _getGGXMaterial();
      this._integrationMaterial = _getIntegrationMaterial();
    }
    const size = this._cubeSize;
    const maxLod = pmremTarget.texture.mipmaps.length - 1;
    const ggxUniforms = this._ggxMaterial.uniforms;
    ggxUniforms.envMap.value = this._sourceTarget!.texture;
    const integrationUniforms = this._integrationMaterial!.uniforms;
    integrationUniforms.envMap.value = this._sourceTarget!.texture;
    integrationUniforms.sourceLod.value = Math.log2(size / INTEGRATION_SIZE);
    for (let lod = 0; lod <= maxLod; lod++) {
      const roughness = PMREMGenerator.lodToRoughness(lod, maxLod);
      if (lod > maxLod - INTEGRATION_LEVELS) {
        integrationUniforms.roughness.value = roughness;
        this._renderCube(pmremTarget, lod, this._integrationMaterial!);
      } else {
        // For V = N, pdf( L ) = D( H ) / 4. Match the source texel solid angle to
        // 1 / ( GGX_SAMPLES * pdf ), with a half-mip bias to reduce sampling noise.
        // The shader supplies log2 of the GGX denominator.
        const lodBias =
          roughness > 0 ? Math.log2(size) + 0.5 * Math.log2(6 / (GGX_SAMPLES * Math.pow(roughness, 4))) + 0.5 : 0;
        ggxUniforms.roughness.value = roughness;
        ggxUniforms.lodBias.value = lodBias;
        this._renderCube(pmremTarget, lod, this._ggxMaterial);
      }
    }
  }
  /**
   * Applies the initial fromScene() blur in two passes using a golden-angle
   * spiral kernel. Level 0 of the PMREM serves as the intermediate target.
   *
   * @private
   * @param pmremTarget - The PMREM.
   * @param sigma - The blur radius in radians.
   */
  _blur(pmremTarget: WebGLCubeRenderTarget, sigma: number) {
    if (this._blurMaterial === null) {
      this._blurMaterial = _getBlurMaterial();
    }
    const material = this._blurMaterial;
    const uniforms = material.uniforms;
    const sourceTarget = this._sourceTarget!;
    // Split the blur variance between two passes. Clamp sigma to the sphere's
    // maximum angular distance.
    uniforms.sigma.value = Math.min(sigma, Math.PI) / Math.SQRT2;
    uniforms.envMap.value = sourceTarget.texture;
    this._renderCube(pmremTarget, 0, material);
    uniforms.envMap.value = pmremTarget.texture;
    this._renderCube(sourceTarget, 0, material);
  }
}
function _createRenderTarget(size?: any, generateMipmaps?: any, depthBuffer?: any) {
  return new WebGLCubeRenderTarget(size, {
    minFilter: TextureFilter.LinearMipmapLinear,
    generateMipmaps: generateMipmaps,
    type: TextureType.HalfFloat,
    colorSpace: ColorSpace.LinearSRGB,
    depthBuffer: depthBuffer,
  });
}
function _getMaterial(name?: any, uniforms?: any, fragmentShader?: any) {
  return new ShaderMaterial({
    name: name,
    uniforms: uniforms,
    vertexShader:
      "\nvarying vec3 vWorldDirection;\n\n" +
      chunk_common +
      "\n\nvoid main() {\n\n\tvWorldDirection = transformDirection( position, modelMatrix );\n\n" +
      chunk_begin_vertex +
      "\n" +
      chunk_project_vertex +
      "\n\n\tgl_Position.z = gl_Position.w; // set z to camera.far\n\n}\n",
    fragmentShader: fragmentShader,
    side: Side.Back,
    blending: Blending.No,
    depthTest: false,
    depthWrite: false,
  });
}
function _getGGXMaterial() {
  return _getMaterial(
    "PMREMGGXConvolution",
    {
      envMap: { value: null },
      roughness: { value: 0 },
      lodBias: { value: 0 },
    },
    /* glsl */ "\n\n\t\t#define GGX_SAMPLES " +
      GGX_SAMPLES +
      "u\n\n\t\tvarying vec3 vWorldDirection;\n\n\t\tuniform samplerCube envMap;\n\t\tuniform float roughness;\n\t\tuniform float lodBias;\n\n" +
      chunk_common +
      "\n\n\t\t// Van der Corput radical inverse\n\t\tfloat radicalInverse_VdC( uint bits ) {\n\n\t\t\tbits = ( bits << 16u ) | ( bits >> 16u );\n\t\t\tbits = ( ( bits & 0x55555555u ) << 1u ) | ( ( bits & 0xAAAAAAAAu ) >> 1u );\n\t\t\tbits = ( ( bits & 0x33333333u ) << 2u ) | ( ( bits & 0xCCCCCCCCu ) >> 2u );\n\t\t\tbits = ( ( bits & 0x0F0F0F0Fu ) << 4u ) | ( ( bits & 0xF0F0F0F0u ) >> 4u );\n\t\t\tbits = ( ( bits & 0x00FF00FFu ) << 8u ) | ( ( bits & 0xFF00FF00u ) >> 8u );\n\t\t\treturn float( bits ) * 2.3283064365386963e-10; // / 0x100000000\n\n\t\t}\n\n\t\t// Hammersley sequence\n\t\tvec2 hammersley( uint i, uint N ) {\n\n\t\t\treturn vec2( float( i ) / float( N ), radicalInverse_VdC( i ) );\n\n\t\t}\n\n\t\tvoid main() {\n\n\t\t\tvec3 N = normalize( vWorldDirection );\n\n\t\t\t// For very low roughness, just sample the environment directly\n\t\t\tif ( roughness < 0.001 ) {\n\n\t\t\t\tgl_FragColor = vec4( textureLod( envMap, N, 0.0 ).rgb, 1.0 );\n\t\t\t\treturn;\n\n\t\t\t}\n\n\t\t\tfloat alpha = roughness * roughness;\n\t\t\tfloat alpha2 = alpha * alpha;\n\n\t\t\t// Tangent space basis for VNDF sampling\n\t\t\tvec3 up = abs( N.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );\n\t\t\tvec3 tangent = normalize( cross( up, N ) );\n\t\t\tvec3 bitangent = cross( N, tangent );\n\n\t\t\tvec3 prefilteredColor = vec3( 0.0 );\n\t\t\tfloat totalWeight = 0.0;\n\n\t\t\tfor ( uint i = 0u; i < GGX_SAMPLES; i ++ ) {\n\n\t\t\t\tvec2 Xi = hammersley( i, GGX_SAMPLES );\n\n\t\t\t\t// With V = N, sample the reflected direction directly.\n\t\t\t\tfloat invQ = 1.0 / ( 1.0 - Xi.x + alpha2 * Xi.x );\n\t\t\t\tfloat NdotL = ( 1.0 - Xi.x - alpha2 * Xi.x ) * invQ;\n\n\t\t\t\tif ( NdotL > 0.0 ) {\n\n\t\t\t\t\tfloat phi = 2.0 * PI * Xi.y;\n\t\t\t\t\tfloat sinTheta = 2.0 * alpha * sqrt( Xi.x * ( 1.0 - Xi.x ) ) * invQ;\n\t\t\t\t\tvec3 L = N * NdotL + ( tangent * cos( phi ) + bitangent * sin( phi ) ) * sinTheta;\n\n\t\t\t\t\t// Match the source mip to the sample's solid angle. The terms\n\t\t\t\t\t// independent of the sample are precomputed in lodBias.\n\t\t\t\t\tfloat d = alpha2 * invQ;\n\t\t\t\t\tfloat lod = max( log2( d ) + lodBias, 0.0 );\n\n\t\t\t\t\t// Weight by NdotL for the split-sum approximation\n\t\t\t\t\tprefilteredColor += textureLod( envMap, L, lod ).rgb * NdotL;\n\t\t\t\t\ttotalWeight += NdotL;\n\n\t\t\t\t}\n\n\t\t\t}\n\n\t\t\tgl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );\n\n\t\t}\n\t",
  );
}
function _getIntegrationMaterial() {
  return _getMaterial(
    "PMREMGGXIntegration",
    {
      envMap: { value: null },
      roughness: { value: 0 },
      sourceLod: { value: 0 },
      sourceSize: { value: INTEGRATION_SIZE }, // a uniform so the loops aren't unrolled
    },
    /* glsl */ `

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float sourceLod;
		uniform int sourceSize;

		void main() {

			vec3 N = normalize( vWorldDirection );

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			float texelSize = 2.0 / float( sourceSize );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			// Pair opposite texels: only the one in N's hemisphere contributes.
			for ( int face = 0; face < 3; face ++ ) {

				for ( int y = 0; y < sourceSize; y ++ ) {

					for ( int x = 0; x < sourceSize; x ++ ) {

						vec2 uv = ( vec2( x, y ) + 0.5 ) * texelSize - 1.0;
						vec3 texelDirection = face == 0 ? vec3( 1.0, uv ) : ( face == 1 ? vec3( uv.x, 1.0, uv.y ) : vec3( uv, 1.0 ) );

						float invDistance = inversesqrt( 1.0 + dot( uv, uv ) );
						float NdotL = dot( N, texelDirection );
						texelDirection *= NdotL < 0.0 ? - 1.0 : 1.0;
						NdotL = abs( NdotL ) * invDistance;

						// With V = N, NdotH squared is ( 1 + NdotL ) / 2. Common factors
						// in the GGX distribution and texel solid angle cancel when normalized.
						float d = 1.0 + alpha2 + ( alpha2 - 1.0 ) * NdotL;
						float weight = NdotL * invDistance * invDistance * invDistance / ( d * d );

						prefilteredColor += textureLod( envMap, texelDirection, sourceLod ).rgb * weight;
						totalWeight += weight;

					}

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`,
  );
}
function _getBlurMaterial() {
  return _getMaterial(
    "PMREMSphericalGaussianBlur",
    {
      envMap: { value: null },
      sigma: { value: 0 },
    },
    /* glsl */ "\n\n\t\t#define SAMPLES " +
      BLUR_SAMPLES +
      "\n\t\t#define GOLDEN_ANGLE 2.39996322973\n\n\t\tvarying vec3 vWorldDirection;\n\n\t\tuniform samplerCube envMap;\n\t\tuniform float sigma;\n\n" +
      chunk_common +
      "\n\n\t\tvoid main() {\n\n\t\t\tvec3 outputDirection = normalize( vWorldDirection );\n\n\t\t\tvec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );\n\t\t\tvec3 tangent = normalize( cross( up, outputDirection ) );\n\t\t\tvec3 bitangent = cross( outputDirection, tangent );\n\n\t\t\t// Truncate the kernel at three standard deviations or at the antipode.\n\t\t\tfloat thetaMax = min( 3.0 * sigma, PI );\n\t\t\tfloat truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );\n\n\t\t\tvec3 accumColor = vec3( 0.0 );\n\t\t\tfloat accumWeight = 0.0;\n\n\t\t\tfor ( int i = 0; i < SAMPLES; i ++ ) {\n\n\t\t\t\t// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.\n\t\t\t\tfloat stratum = ( float( i ) + 0.5 ) / float( SAMPLES );\n\t\t\t\tfloat theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );\n\t\t\t\tfloat phi = float( i ) * GOLDEN_ANGLE;\n\n\t\t\t\tvec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;\n\t\t\t\tvec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;\n\n\t\t\t\t// Correct the planar sample density to solid angle.\n\t\t\t\tfloat weight = sin( theta ) / theta;\n\n\t\t\t\taccumColor += weight * textureLod( envMap, sampleDirection, 0.0 ).rgb;\n\t\t\t\taccumWeight += weight;\n\n\t\t\t}\n\n\t\t\tgl_FragColor = vec4( accumColor / accumWeight, 1.0 );\n\n\t\t}\n\t",
  );
}
function _getEquirectMaterial() {
  return _getMaterial(
    "PMREMEquirectangularToCubemap",
    {
      envMap: { value: null },
    },
    /* glsl */ "\n\n\t\tvarying vec3 vWorldDirection;\n\n\t\tuniform sampler2D envMap;\n\n" +
      chunk_common +
      "\n\n\t\tvoid main() {\n\n\t\t\t// Average four subpixel samples to preserve small, bright features.\n\t\t\tvec3 direction = normalize( vWorldDirection );\n\t\t\tvec3 dx = dFdx( direction ) * 0.25;\n\t\t\tvec3 dy = dFdy( direction ) * 0.25;\n\n\t\t\tvec3 color = textureLod( envMap, equirectUv( normalize( direction - dx - dy ) ), 0.0 ).rgb;\n\t\t\tcolor += textureLod( envMap, equirectUv( normalize( direction + dx - dy ) ), 0.0 ).rgb;\n\t\t\tcolor += textureLod( envMap, equirectUv( normalize( direction - dx + dy ) ), 0.0 ).rgb;\n\t\t\tcolor += textureLod( envMap, equirectUv( normalize( direction + dx + dy ) ), 0.0 ).rgb;\n\t\t\tgl_FragColor = vec4( color * 0.25, 1.0 );\n\n\t\t}\n\t",
  );
}
function _getCubemapMaterial() {
  return _getMaterial(
    "PMREMCubemapToCubemap",
    {
      envMap: { value: null },
      flipEnvMap: { value: -1 },
    },
    /* glsl */ `

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float flipEnvMap;

		void main() {

			gl_FragColor = vec4( textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) ).rgb, 1.0 );

		}
	`,
  );
}

/** The scene surface fromScene reads background state from; Sky passes as Object3D. */
interface SceneLike {
  background: unknown;
}
