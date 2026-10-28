import { FrontSide, HalfFloatType } from "../../constants";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Plane } from "../../math/Plane";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { Mesh } from "../../objects/Mesh";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { fog as fogUniforms, lights as lightsUniforms } from "../../renderers/shaders/UniformsLib";
import { mergeUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
import chunk_packing from "../../renderers/shaders/ShaderChunk/packing.glsl";
import chunk_bsdfs from "../../renderers/shaders/ShaderChunk/bsdfs.glsl";
import chunk_lightprobes_pars_fragment from "../../renderers/shaders/ShaderChunk/lightprobes_pars_fragment.glsl";
import chunk_lights_pars_begin from "../../renderers/shaders/ShaderChunk/lights_pars_begin.glsl";
import chunk_shadowmap_pars_vertex from "../../renderers/shaders/ShaderChunk/shadowmap_pars_vertex.glsl";
import chunk_shadowmap_vertex from "../../renderers/shaders/ShaderChunk/shadowmap_vertex.glsl";
import chunk_shadowmap_pars_fragment from "../../renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl";
import chunk_shadowmask_pars_fragment from "../../renderers/shaders/ShaderChunk/shadowmask_pars_fragment.glsl";
import chunk_fog_pars_vertex from "../../renderers/shaders/ShaderChunk/fog_pars_vertex.glsl";
import chunk_fog_vertex from "../../renderers/shaders/ShaderChunk/fog_vertex.glsl";
import chunk_fog_pars_fragment from "../../renderers/shaders/ShaderChunk/fog_pars_fragment.glsl";
import chunk_fog_fragment from "../../renderers/shaders/ShaderChunk/fog_fragment.glsl";
import chunk_beginnormal_vertex from "../../renderers/shaders/ShaderChunk/beginnormal_vertex.glsl";
import chunk_defaultnormal_vertex from "../../renderers/shaders/ShaderChunk/defaultnormal_vertex.glsl";
import chunk_logdepthbuf_pars_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_logdepthbuf_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_logdepthbuf_pars_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_logdepthbuf_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_tonemapping_fragment from "../../renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "../../renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import type { Camera } from "../../cameras/Camera";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Object3D } from "../../core/Object3D";
import type { Texture } from "../../textures/Texture";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/** Constructor options of `Water`. */
export interface WaterOptions {
  /** The texture width. A higher value results in more clear reflections but is also more expensive. */
  textureWidth?: number;
  /** The texture height. A higher value results in more clear reflections but is also more expensive. */
  textureHeight?: number;
  /** The clip bias. */
  clipBias?: number;
  /** The alpha value. */
  alpha?: number;
  /** The time value. */
  time?: number;
  /** The water's normal map. */
  waterNormals?: Texture | null;
  /** The sun direction. */
  sunDirection?: Vector3;
  /** The sun color. */
  sunColor?: number | Color | string;
  /** The water color. */
  waterColor?: number | Color | string;
  /** The eye vector. */
  eye?: Vector3;
  /** The distortion scale. */
  distortionScale?: number;
  /** The water material's `side` property. */
  side?: number;
  /** Whether the water should be affected by fog or not. */
  fog?: boolean;
}

/**
 * A basic flat, reflective water effect.
 *
 * Note that this class can only be used with {@link WebGLRenderer}.
 *
 * References:
 *
 * - [Flat mirror for three.js](https://github.com/Slayvin)
 * - [An implementation of water shader based on the flat mirror](https://home.adelphi.edu/~stemkoski/)
 * - [Water shader explanations in WebGL](http://29a.ch/slides/2012/webglwater/ )
 *
 * ```typescript
 * import { PlaneGeometry } from 'ek3d/geometries/PlaneGeometry';
 * import { Water } from 'ek3d/addons/objects/Water';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const water = new Water( new PlaneGeometry( 10000, 10000 ), { textureWidth: 512, textureHeight: 512 } );
 * water.rotation.x = - Math.PI / 2;
 * scene.add( water );
 * ```
 *
 * @three_import import { Water } from 'ek3d/addons/objects/Water';
 */
export class Water extends Mesh<ShaderMaterial> {
  /** Use this for type testing. */
  isWater: boolean = true;
  /** Scratch vector for the mirror's world position. */
  _mirrorWorldPosition: Vector3 = new Vector3();
  /** Scratch vector for the camera's world position. */
  _cameraWorldPosition: Vector3 = new Vector3();
  /** Rotation-only part of the mirror and camera world matrices. */
  _rotationMatrix: Matrix4 = new Matrix4();
  /** Scratch vector for the reflected look-at position. */
  _lookAtPosition: Vector3 = new Vector3(0, 0, -1);
  /** Scratch vector for the oblique clipping plane. */
  _clipPlane: Vector4 = new Vector4();
  /** Scratch vector for the mirror camera position. */
  _view: Vector3 = new Vector3();
  /** Scratch vector for the mirror camera target. */
  _target: Vector3 = new Vector3();
  /** Scratch vector for the oblique near-plane corner point. */
  _q: Vector4 = new Vector4();
  /** The mirror plane in world space. */
  _mirrorPlane: Plane = new Plane();
  /** The mirror's world-space normal. */
  _normal: Vector3 = new Vector3();
  /** Projective texture matrix used by the shader. */
  _textureMatrix: Matrix4;
  /** The virtual camera used to render the reflection. */
  _mirrorCamera: PerspectiveCamera = new PerspectiveCamera();
  /** The reflection render target. */
  _renderTarget: WebGLRenderTarget;
  /** The clip bias applied to the oblique near plane. */
  _clipBias: number;
  /** The eye position uniform, updated from the camera each frame. */
  _eye: Vector3;

  /**
   * Constructs a new water instance.
   *
   * @param geometry - The water's geometry.
   * @param [options] - The configuration options.
   */
  constructor(geometry: BufferGeometry, options: WaterOptions = {}) {
    const textureWidth = options.textureWidth !== undefined ? options.textureWidth : 512;
    const textureHeight = options.textureHeight !== undefined ? options.textureHeight : 512;

    const clipBias = options.clipBias !== undefined ? options.clipBias : 0.0;
    const alpha = options.alpha !== undefined ? options.alpha : 1.0;
    const time = options.time !== undefined ? options.time : 0.0;
    const normalSampler = options.waterNormals !== undefined ? options.waterNormals : null;
    const sunDirection = options.sunDirection !== undefined ? options.sunDirection : new Vector3(0.70707, 0.70707, 0.0);
    const sunColor = new Color(options.sunColor !== undefined ? options.sunColor : 0xffffff);
    const waterColor = new Color(options.waterColor !== undefined ? options.waterColor : 0x7f7f7f);
    const eye = options.eye !== undefined ? options.eye : new Vector3(0, 0, 0);
    const distortionScale = options.distortionScale !== undefined ? options.distortionScale : 20.0;
    const side = options.side !== undefined ? options.side : FrontSide;
    const fog = options.fog !== undefined ? options.fog : false;

    const textureMatrix = new Matrix4();
    const renderTarget = new WebGLRenderTarget(textureWidth, textureHeight, { type: HalfFloatType });

    const mirrorShader = {
      name: "MirrorShader",

      uniforms: mergeUniforms([
        fogUniforms,
        lightsUniforms,
        {
          normalSampler: { value: null },
          mirrorSampler: { value: null },
          alpha: { value: 1.0 },
          time: { value: 0.0 },
          size: { value: 1.0 },
          distortionScale: { value: 20.0 },
          textureMatrix: { value: new Matrix4() },
          sunColor: { value: new Color(0x7f7f7f) },
          sunDirection: { value: new Vector3(0.70707, 0.70707, 0) },
          eye: { value: new Vector3() },
          waterColor: { value: new Color(0x555555) },
        },
      ]),

      vertexShader: /* glsl */ `
				uniform mat4 textureMatrix;
				uniform float time;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

${chunk_common}
${chunk_fog_pars_vertex}
${chunk_shadowmap_pars_vertex}
${chunk_logdepthbuf_pars_vertex}

				void main() {
					mirrorCoord = modelMatrix * vec4( position, 1.0 );
					worldPosition = mirrorCoord.xyzw;
					mirrorCoord = textureMatrix * mirrorCoord;
					vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );
					gl_Position = projectionMatrix * mvPosition;

${chunk_beginnormal_vertex}
${chunk_defaultnormal_vertex}
${chunk_logdepthbuf_vertex}
${chunk_fog_vertex}
${chunk_shadowmap_vertex}
			}`,

      fragmentShader: /* glsl */ `
				uniform sampler2D mirrorSampler;
				uniform float alpha;
				uniform float time;
				uniform float size;
				uniform float distortionScale;
				uniform sampler2D normalSampler;
				uniform vec3 sunColor;
				uniform vec3 sunDirection;
				uniform vec3 eye;
				uniform vec3 waterColor;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				vec4 getNoise( vec2 uv ) {
					vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
					vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
					vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
					vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
					vec4 noise = texture2D( normalSampler, uv0 ) +
						texture2D( normalSampler, uv1 ) +
						texture2D( normalSampler, uv2 ) +
						texture2D( normalSampler, uv3 );
					return noise * 0.5 - 1.0;
				}

				void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
					vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
					float direction = max( 0.0, dot( eyeDirection, reflection ) );
					specularColor += pow( direction, shiny ) * sunColor * spec;
					diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
				}

${chunk_common}
${chunk_packing}
${chunk_bsdfs}
${chunk_fog_pars_fragment}
${chunk_logdepthbuf_pars_fragment}
${chunk_lights_pars_begin.replace("#include <lightprobes_pars_fragment>", chunk_lightprobes_pars_fragment)}
${chunk_shadowmap_pars_fragment}
${chunk_shadowmask_pars_fragment}

				void main() {

${chunk_logdepthbuf_fragment}
					vec4 noise = getNoise( worldPosition.xz * size );
					vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

					vec3 diffuseLight = vec3(0.0);
					vec3 specularLight = vec3(0.0);

					vec3 worldToEye = eye-worldPosition.xyz;
					vec3 eyeDirection = normalize( worldToEye );
					sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );

					float distance = length(worldToEye);

					vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
					vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );

					float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
					float rf0 = 0.02;
					float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
					vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
					vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), reflectionSample + specularLight, reflectance );
					vec3 outgoingLight = albedo;
					gl_FragColor = vec4( outgoingLight, alpha );

${chunk_tonemapping_fragment}
${chunk_colorspace_fragment}
${chunk_fog_fragment}
				}`,
    };

    const material = new ShaderMaterial({
      name: mirrorShader.name,
      uniforms: mirrorShader.uniforms,
      vertexShader: mirrorShader.vertexShader,
      fragmentShader: mirrorShader.fragmentShader,
      lights: true,
      side: side,
      fog: fog,
    });

    material.uniforms["mirrorSampler"].value = renderTarget.texture;
    material.uniforms["textureMatrix"].value = textureMatrix;
    material.uniforms["alpha"].value = alpha;
    material.uniforms["time"].value = time;
    material.uniforms["normalSampler"].value = normalSampler;
    material.uniforms["sunColor"].value = sunColor;
    material.uniforms["waterColor"].value = waterColor;
    material.uniforms["sunDirection"].value = sunDirection;
    material.uniforms["distortionScale"].value = distortionScale;

    material.uniforms["eye"].value = eye;

    super(geometry, material);

    this.type = "Water";
    this._textureMatrix = textureMatrix;
    this._renderTarget = renderTarget;
    this._clipBias = clipBias;
    this._eye = eye;
  }

  /**
   * Renders the reflection into the internal render target.
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
    const mirrorWorldPosition = this._mirrorWorldPosition.setFromMatrixPosition(this.matrixWorld);
    const cameraWorldPosition = this._cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

    const rotationMatrix = this._rotationMatrix.extractRotation(this.matrixWorld);

    const normal = this._normal.set(0, 0, 1);
    normal.applyMatrix4(rotationMatrix);

    const view = this._view.subVectors(mirrorWorldPosition, cameraWorldPosition);

    // Avoid rendering when mirror is facing away

    if (view.dot(normal) > 0) return;

    view.reflect(normal).negate();
    view.add(mirrorWorldPosition);

    rotationMatrix.extractRotation(camera.matrixWorld);

    const lookAtPosition = this._lookAtPosition.set(0, 0, -1);
    lookAtPosition.applyMatrix4(rotationMatrix);
    lookAtPosition.add(cameraWorldPosition);

    const target = this._target.subVectors(mirrorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(mirrorWorldPosition);

    const mirrorCamera = this._mirrorCamera;
    const textureMatrix = this._textureMatrix;

    mirrorCamera.position.copy(view);
    mirrorCamera.up.set(0, 1, 0);
    mirrorCamera.up.applyMatrix4(rotationMatrix);
    mirrorCamera.up.reflect(normal);
    mirrorCamera.lookAt(target);

    mirrorCamera.far = (camera as Camera & { far: number }).far; // Used in WebGLBackground

    mirrorCamera.updateMatrixWorld();
    mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);

    // Update the texture matrix
    textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
    textureMatrix.multiply(mirrorCamera.projectionMatrix);
    textureMatrix.multiply(mirrorCamera.matrixWorldInverse);

    // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
    // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
    const mirrorPlane = this._mirrorPlane.setFromNormalAndCoplanarPoint(normal, mirrorWorldPosition);
    mirrorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);

    const clipPlane = this._clipPlane.set(
      mirrorPlane.normal.x,
      mirrorPlane.normal.y,
      mirrorPlane.normal.z,
      mirrorPlane.constant,
    );

    const projectionMatrix = mirrorCamera.projectionMatrix;
    const q = this._q;

    q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

    // Calculate the scaled plane vector
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

    // Replacing the third row of the projection matrix
    projectionMatrix.elements[2] = clipPlane.x;
    projectionMatrix.elements[6] = clipPlane.y;
    projectionMatrix.elements[10] = clipPlane.z + 1.0 - this._clipBias;
    projectionMatrix.elements[14] = clipPlane.w;

    this._eye.setFromMatrixPosition(camera.matrixWorld);

    // Render

    const currentRenderTarget = renderer.getRenderTarget();
    const currentShadowAutoUpdate = renderer.shadowMap?.autoUpdate;
    const visible = this.visible;
    this.visible = false;
    try {
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this._renderTarget);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, mirrorCamera);
    } finally {
      this.visible = visible;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = currentShadowAutoUpdate === true;
      renderer.setRenderTarget(currentRenderTarget);
      const viewport = (camera as Camera & { viewport?: Vector4 }).viewport;
      if (viewport !== undefined) renderer.state.viewport(viewport);
    }
  }

  /**
   * Returns the water's internal render target.
   *
   * @return The internal render target.
   */
  getRenderTarget(): WebGLRenderTarget {
    return this._renderTarget;
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  override dispose(): void {
    this._renderTarget.dispose();
    this.material.dispose();
  }
}
