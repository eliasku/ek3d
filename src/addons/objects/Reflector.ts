import { TextureType } from "../../constants";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Plane } from "../../math/Plane";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { Mesh } from "../../objects/Mesh";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
import chunk_logdepthbuf_pars_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_logdepthbuf_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_logdepthbuf_pars_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_logdepthbuf_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_tonemapping_fragment from "../../renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "../../renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import type { Camera } from "../../cameras/Camera";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Object3D } from "../../core/Object3D";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/** A shader definition accepted by {@link Reflector}. */
export interface ReflectorShader {
  name?: string;
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

/** Constructor options of `Reflector`. */
export interface ReflectorOptions {
  /** The reflector's color. */
  color?: number | Color | string;
  /** The texture width. A higher value results in more clear reflections but is also more expensive. */
  textureWidth?: number;
  /** The texture height. A higher value results in more clear reflections but is also more expensive. */
  textureHeight?: number;
  /** The clip bias. */
  clipBias?: number;
  /** Can be used to pass in a custom shader that defines how the reflective view is projected onto the reflector's geometry. */
  shader?: ReflectorShader;
  /** How many samples to use for MSAA. `0` disables MSAA. */
  multisample?: number;
}

/**
 * Can be used to create a flat, reflective surface like a mirror.
 *
 * Note that this class can only be used with {@link WebGLRenderer}.
 *
 * ```ts
 * import { PlaneGeometry } from 'ek3d/geometries/PlaneGeometry';
 * import { Reflector } from 'ek3d/addons/objects/Reflector';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const geometry = new PlaneGeometry( 100, 100 );
 *
 * const reflector = new Reflector( geometry, {
 * 	clipBias: 0.003,
 * 	textureWidth: window.innerWidth * window.devicePixelRatio,
 * 	textureHeight: window.innerHeight * window.devicePixelRatio,
 * 	color: 0xc1cbcb
 * } );
 *
 * scene.add( reflector );
 * ```
 *
 */
export class Reflector extends Mesh<ShaderMaterial> {
  /** Use this for type testing. */
  isReflector: boolean = true;
  /** Whether to force an update, no matter if the reflector is in view or not. */
  forceUpdate: boolean = false;
  /** Weak map for managing reflection cameras. */
  _reflectionCameras: WeakMap<Camera, Camera> = new WeakMap();
  /** The shader used to build the reflector material. */
  static ReflectorShader: ReflectorShader = {
    name: "ReflectorShader",

    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
    },

    vertexShader: /* glsl */ `
		uniform mat4 textureMatrix;
		varying vec4 vUv;

${chunk_common}
${chunk_logdepthbuf_pars_vertex}

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

${chunk_logdepthbuf_vertex}

		}`,

    fragmentShader: /* glsl */ `
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;

${chunk_logdepthbuf_pars_fragment}

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

${chunk_logdepthbuf_fragment}

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

${chunk_tonemapping_fragment}
${chunk_colorspace_fragment}

		}`,
  };

  /** The reflector's plane in world space. */
  _reflectorPlane: Plane = new Plane();
  /** The reflector's world-space normal. */
  _normal: Vector3 = new Vector3();
  /** Scratch vector for the reflection camera position. */
  _view: Vector3 = new Vector3();
  /** Scratch vector for the reflection camera target. */
  _target: Vector3 = new Vector3();
  /** Scratch vector for the oblique clipping plane. */
  _clipPlane: Vector4 = new Vector4();
  /** Scratch vector for the oblique near-plane corner point. */
  _q: Vector4 = new Vector4();
  /** Scratch vector for the reflector's world position. */
  _reflectorWorldPosition: Vector3 = new Vector3();
  /** Scratch vector for the camera's world position. */
  _cameraWorldPosition: Vector3 = new Vector3();
  /** Scratch vector for the reflected look-at position. */
  _lookAtPosition: Vector3 = new Vector3();
  /** Rotation-only part of the reflector and camera world matrices. */
  _rotationMatrix: Matrix4 = new Matrix4();
  /** Projective texture matrix used by the shader. */
  _textureMatrix: Matrix4;
  /** The reflection render target. */
  _renderTarget: WebGLRenderTarget;
  /** The clip bias applied to the oblique near plane. */
  _clipBias: number;

  /**
   * Constructs a new reflector.
   *
   * @param geometry - The reflector's geometry.
   * @param [options] - The configuration options.
   */
  constructor(geometry: BufferGeometry, options: ReflectorOptions = {}) {
    const color = options.color !== undefined ? new Color(options.color) : new Color(0x7f7f7f);
    const textureWidth = options.textureWidth || 512;
    const textureHeight = options.textureHeight || 512;
    const clipBias = options.clipBias || 0;
    const shader = options.shader || Reflector.ReflectorShader;
    const multisample = options.multisample !== undefined ? options.multisample : 4;

    const textureMatrix = new Matrix4();

    const renderTarget = new WebGLRenderTarget(textureWidth, textureHeight, {
      samples: multisample,
      type: TextureType.HalfFloat,
    });

    const material = new ShaderMaterial({
      name: shader.name !== undefined ? shader.name : "unspecified",
      uniforms: cloneUniforms(shader.uniforms),
      fragmentShader: shader.fragmentShader,
      vertexShader: shader.vertexShader,
    });

    material.uniforms["tDiffuse"].value = renderTarget.texture;
    material.uniforms["color"].value = color;
    material.uniforms["textureMatrix"].value = textureMatrix;

    super(geometry, material);

    this.type = "Reflector";
    this._textureMatrix = textureMatrix;
    this._renderTarget = renderTarget;
    this._clipBias = clipBias;
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
    const reflectionCamera = this.getReflectionCamera(camera);

    const reflectorPlane = this._reflectorPlane;
    const normal = this._normal;
    const rotationMatrix = this._rotationMatrix;
    const clipPlane = this._clipPlane;
    const view = this._view;
    const target = this._target;
    const q = this._q;
    const textureMatrix = this._textureMatrix;

    const reflectorWorldPosition = this._reflectorWorldPosition.setFromMatrixPosition(this.matrixWorld);
    const cameraWorldPosition = this._cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

    rotationMatrix.extractRotation(this.matrixWorld);

    normal.set(0, 0, 1);
    normal.applyMatrix4(rotationMatrix);

    view.subVectors(reflectorWorldPosition, cameraWorldPosition);

    // Avoid rendering when reflector is facing away unless forcing an update
    const isFacingAway = view.dot(normal) > 0;

    if (isFacingAway === true && this.forceUpdate === false) return;

    view.reflect(normal).negate();
    view.add(reflectorWorldPosition);

    rotationMatrix.extractRotation(camera.matrixWorld);

    const lookAtPosition = this._lookAtPosition.set(0, 0, -1);
    lookAtPosition.applyMatrix4(rotationMatrix);
    lookAtPosition.add(cameraWorldPosition);

    target.subVectors(reflectorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(reflectorWorldPosition);

    reflectionCamera.position.copy(view);
    reflectionCamera.up.set(0, 1, 0);
    reflectionCamera.up.applyMatrix4(rotationMatrix);
    reflectionCamera.up.reflect(normal);
    reflectionCamera.lookAt(target);

    (reflectionCamera as Camera & { far: number }).far = (camera as Camera & { far: number }).far; // Used in WebGLBackground

    reflectionCamera.updateMatrixWorld();
    reflectionCamera.projectionMatrix.copy(camera.projectionMatrix);

    // The reflection is mirrored horizontally, so the view offset must be mirrored as well.

    reflectionCamera.projectionMatrix.elements[8] *= -1;
    reflectionCamera.projectionMatrix.elements[12] *= -1;

    // Update the texture matrix
    textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
    textureMatrix.multiply(reflectionCamera.projectionMatrix);
    textureMatrix.multiply(reflectionCamera.matrixWorldInverse);
    textureMatrix.multiply(this.matrixWorld);

    // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
    // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
    reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    reflectorPlane.applyMatrix4(reflectionCamera.matrixWorldInverse);

    clipPlane.set(reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant);

    const projectionMatrix = reflectionCamera.projectionMatrix;

    const isOrthographicCamera = (reflectionCamera as Camera & { isOrthographicCamera?: boolean }).isOrthographicCamera;

    if (isOrthographicCamera === true) {
      q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
      q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
      q.z = -(camera as Camera & { far: number }).far; // actual view-space z at the far plane, no normalization needed
      q.w = 1.0; // w_clip = 1 in orthographic (no perspective division)
    } else {
      q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
      q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
      q.z = -1.0;
      q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
    }

    // Calculate the scaled plane vector
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

    // Replacing the third row of the projection matrix
    projectionMatrix.elements[2] = clipPlane.x;
    projectionMatrix.elements[6] = clipPlane.y;

    if (isOrthographicCamera === true) {
      // For orthographic cameras, w_clip = 1 always (no perspective division),
      // so the -1 near-plane offset must go into the constant term (elements[14])
      // rather than the z coefficient (elements[10]).
      projectionMatrix.elements[10] = clipPlane.z - this._clipBias;
      projectionMatrix.elements[14] = clipPlane.w - 1.0;
    } else {
      projectionMatrix.elements[10] = clipPlane.z + 1.0 - this._clipBias;
      projectionMatrix.elements[14] = clipPlane.w;
    }

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
      renderer.render(scene, reflectionCamera);
      this.forceUpdate = false;
    } finally {
      this.visible = visible;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = currentShadowAutoUpdate === true;
      renderer.setRenderTarget(currentRenderTarget);
      const viewport = (camera as Camera & { viewport?: Vector4 }).viewport;
      if (viewport !== undefined) renderer.state.viewport(viewport);
    }
  }

  /**
   * Returns a reflection camera for the given camera. The reflection camera is used to
   * render the scene from the reflector's view so correct reflections can be produced.
   *
   * @param camera - The scene's camera.
   * @return The corresponding reflection camera.
   */
  getReflectionCamera(camera: Camera): Camera {
    let reflectionCamera = this._reflectionCameras.get(camera);

    if (reflectionCamera === undefined) {
      reflectionCamera = camera.clone();
      this._reflectionCameras.set(camera, reflectionCamera);
    }

    return reflectionCamera;
  }

  /**
   * Returns the reflector's internal render target.
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
