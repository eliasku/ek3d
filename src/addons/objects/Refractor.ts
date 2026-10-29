import { TextureType } from "../../constants";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Plane } from "../../math/Plane";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { Mesh } from "../../objects/Mesh";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import chunk_tonemapping_fragment from "../../renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "../../renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import type { Camera } from "../../cameras/Camera";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Object3D } from "../../core/Object3D";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/** A shader definition accepted by {@link Refractor}. */
export interface RefractorShader {
  name?: string;
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

/** Constructor options of `Refractor`. */
export interface RefractorOptions {
  /** The refractor's color. */
  color?: number | Color | string;
  /** The texture width. A higher value results in more clear refractions but is also more expensive. */
  textureWidth?: number;
  /** The texture height. A higher value results in more clear refractions but is also more expensive. */
  textureHeight?: number;
  /** The clip bias. */
  clipBias?: number;
  /** Can be used to pass in a custom shader that defines how the refractive view is projected onto the refractor's geometry. */
  shader?: RefractorShader;
  /** How many samples to use for MSAA. `0` disables MSAA. */
  multisample?: number;
}

/**
 * Can be used to create a flat, refractive surface like for special
 * windows or water effects.
 *
 * Note that this class can only be used with {@link WebGLRenderer}.
 *
 * ```ts
 * import { PlaneGeometry } from 'ek3d/geometries/PlaneGeometry';
 * import { Refractor } from 'ek3d/addons/objects/Refractor';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const geometry = new PlaneGeometry( 100, 100 );
 *
 * const refractor = new Refractor( geometry, {
 * 	color: 0xcbcbcb,
 * 	textureWidth: 1024,
 * 	textureHeight: 1024
 * } );
 *
 * scene.add( refractor );
 * ```
 *
 */
export class Refractor extends Mesh<ShaderMaterial> {
  /** Use this for type testing. */
  isRefractor: boolean = true;
  /** The refractor's virtual camera. */
  camera: PerspectiveCamera = new PerspectiveCamera();
  /** The shader used to build the refractor material. */
  static RefractorShader: RefractorShader = {
    name: "RefractorShader",

    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
    },

    vertexShader: /* glsl */ `
		uniform mat4 textureMatrix;

		varying vec4 vUv;

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

    fragmentShader: /* glsl */ `
		uniform vec3 color;
		uniform sampler2D tDiffuse;

		varying vec4 vUv;

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

${chunk_tonemapping_fragment}
${chunk_colorspace_fragment}

		}`,
  };

  /** The refractor's plane in world space, flipped to cull everything above it. */
  _refractorPlane: Plane = new Plane();
  /** Projective texture matrix used by the shader. */
  _textureMatrix: Matrix4;
  /** The refraction render target. */
  _renderTarget: WebGLRenderTarget;
  /** The clip bias applied to the oblique near plane. */
  _clipBias: number;
  /** Scratch vector for the refractor's world position. */
  _refractorWorldPosition: Vector3 = new Vector3();
  /** Scratch vector for the camera's world position. */
  _cameraWorldPosition: Vector3 = new Vector3();
  /** Scratch vector for the view direction test. */
  _view: Vector3 = new Vector3();
  /** Scratch vector for the plane normal. */
  _normal: Vector3 = new Vector3();
  /** Rotation-only part of the refractor world matrix. */
  _rotationMatrix: Matrix4 = new Matrix4();
  /** Scratch quaternion for decomposing the world matrix. */
  _quaternion: Quaternion = new Quaternion();
  /** Scratch scale vector for decomposing the world matrix. */
  _scale: Vector3 = new Vector3();
  /** Scratch plane for the oblique clipping test. */
  _clipPlane: Plane = new Plane();
  /** Scratch vector for the oblique clipping plane. */
  _clipVector: Vector4 = new Vector4();
  /** Scratch vector for the oblique near-plane corner point. */
  _q: Vector4 = new Vector4();

  /**
   * Constructs a new refractor.
   *
   * @param geometry - The refractor's geometry.
   * @param [options] - The configuration options.
   */
  constructor(geometry: BufferGeometry, options: RefractorOptions = {}) {
    const color = options.color !== undefined ? new Color(options.color) : new Color(0x7f7f7f);
    const textureWidth = options.textureWidth || 512;
    const textureHeight = options.textureHeight || 512;
    const clipBias = options.clipBias || 0;
    const shader = options.shader || Refractor.RefractorShader;
    const multisample = options.multisample !== undefined ? options.multisample : 4;

    const textureMatrix = new Matrix4();

    // render target

    const renderTarget = new WebGLRenderTarget(textureWidth, textureHeight, {
      samples: multisample,
      type: TextureType.HalfFloat,
    });

    // material

    const material = new ShaderMaterial({
      name: shader.name !== undefined ? shader.name : "unspecified",
      uniforms: cloneUniforms(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      transparent: true, // ensures, refractors are drawn from farthest to closest
    });

    material.uniforms["color"].value = color;
    material.uniforms["tDiffuse"].value = renderTarget.texture;
    material.uniforms["textureMatrix"].value = textureMatrix;

    super(geometry, material);

    this.type = "Refractor";
    this._textureMatrix = textureMatrix;
    this._renderTarget = renderTarget;
    this._clipBias = clipBias;

    const virtualCamera = this.camera;
    virtualCamera.matrixAutoUpdate = false;
    virtualCamera.userData.refractor = true;
  }

  /**
   * Renders the refraction into the internal render target.
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
    // ensure refractors are rendered only once per frame

    if (camera.userData.refractor === true) return;

    // avoid rendering when the refractor is viewed from behind

    if (!this.isVisibleFrom(camera)) return;

    // update

    this.updateRefractorPlane();

    const textureMatrix = this._textureMatrix;
    const virtualCamera = this.camera;

    // this matrix does range mapping to [ 0, 1 ]

    textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);

    // we use "Object Linear Texgen", so we need to multiply the texture matrix T
    // (matrix above) with the projection and view matrix of the virtual camera
    // and the model matrix of the refractor

    textureMatrix.multiply(camera.projectionMatrix);
    textureMatrix.multiply(camera.matrixWorldInverse);
    textureMatrix.multiply(this.matrixWorld);

    this.updateVirtualCamera(camera);

    const currentRenderTarget = renderer.getRenderTarget();
    const currentShadowAutoUpdate = renderer.shadowMap?.autoUpdate;
    const visible = this.visible;
    this.visible = false;
    try {
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this._renderTarget);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, virtualCamera);
    } finally {
      this.visible = visible;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = currentShadowAutoUpdate === true;
      renderer.setRenderTarget(currentRenderTarget);
      const viewport = (camera as Camera & { viewport?: Vector4 }).viewport;
      if (viewport !== undefined) renderer.state.viewport(viewport);
    }
  }

  /**
   * Returns whether the refractor's front side faces the given camera.
   *
   * @param camera - The camera to test.
   * @return Whether the refractor is visible from the camera.
   */
  isVisibleFrom(camera: Camera): boolean {
    const refractorWorldPosition = this._refractorWorldPosition.setFromMatrixPosition(this.matrixWorld);
    const cameraWorldPosition = this._cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

    const view = this._view.subVectors(refractorWorldPosition, cameraWorldPosition);

    this._rotationMatrix.extractRotation(this.matrixWorld);

    const normal = this._normal.set(0, 0, 1).applyMatrix4(this._rotationMatrix);

    return view.dot(normal) < 0;
  }

  /**
   * Updates the world-space refractor plane from the current world matrix.
   */
  updateRefractorPlane(): void {
    const position = this._refractorWorldPosition;
    const normal = this._normal;

    this.matrixWorld.decompose(position, this._quaternion, this._scale);
    normal.set(0, 0, 1).applyQuaternion(this._quaternion).normalize();

    // flip the normal because we want to cull everything above the plane

    normal.negate();

    this._refractorPlane.setFromNormalAndCoplanarPoint(normal, position);
  }

  /**
   * Copies the camera transform and replaces the projection with an oblique clipped frustum.
   *
   * @param camera - The scene's camera.
   */
  updateVirtualCamera(camera: Camera): void {
    const virtualCamera = this.camera;
    const clipPlane = this._clipPlane;
    const clipVector = this._clipVector;
    const q = this._q;

    virtualCamera.matrixWorld.copy(camera.matrixWorld);
    virtualCamera.matrixWorldInverse.copy(virtualCamera.matrixWorld).invert();
    virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
    virtualCamera.far = (camera as Camera & { far: number }).far; // used in WebGLBackground

    // The following code creates an oblique view frustum for clipping.
    // see: Lengyel, Eric. “Oblique View Frustum Depth Projection and Clipping”.
    // Journal of Game Development, Vol. 1, No. 2 (2005), Charles River Media, pp. 5–16

    clipPlane.copy(this._refractorPlane);
    clipPlane.applyMatrix4(virtualCamera.matrixWorldInverse);

    clipVector.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);

    // calculate the clip-space corner point opposite the clipping plane and
    // transform it into camera space by multiplying it by the inverse of the projection matrix

    const projectionMatrix = virtualCamera.projectionMatrix;

    q.x = (Math.sign(clipVector.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    q.y = (Math.sign(clipVector.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

    // calculate the scaled plane vector

    clipVector.multiplyScalar(2.0 / clipVector.dot(q));

    // replacing the third row of the projection matrix

    projectionMatrix.elements[2] = clipVector.x;
    projectionMatrix.elements[6] = clipVector.y;
    projectionMatrix.elements[10] = clipVector.z + 1.0 - this._clipBias;
    projectionMatrix.elements[14] = clipVector.w;
  }

  /**
   * Returns the refractor's internal render target.
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
