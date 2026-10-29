import { TextureType, TextureFilter } from "../../constants";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Plane } from "../../math/Plane";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Mesh } from "../../objects/Mesh";
import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { DepthTexture } from "../../textures/DepthTexture";
import type { Texture } from "../../textures/Texture";
import chunk_packing from "../../renderers/shaders/ShaderChunk/packing.glsl";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { PerspectiveCamera as CameraOf } from "../../cameras/PerspectiveCamera";

/**
 * A special version of {@link Reflector} for usage with {@link SSRPass}.
 *
 * ```ts
 * const groundReflector = new ReflectorForSSRPass( geometry, { useDepthTexture: true } );
 * ```
 *
 */
export class ReflectorForSSRPass extends Mesh<ShaderMaterial> {
  /** Use this for type testing. */
  isReflectorForSSRPass: boolean = true;
  needsUpdate: boolean = false;
  maxDistance: number = 180;
  opacity: number = 0.5;
  color: Color = new Color(0x7f7f7f);
  resolution: Vector2 = new Vector2(window.innerWidth, window.innerHeight);
  /** Internal distance attenuation state. */
  _distanceAttenuation: boolean = true;
  /** Internal fresnel state. */
  _fresnel: boolean = true;

  /** The static reflector shader. */
  static ReflectorShader: {
    name?: string;
    defines: Record<string, any>;
    uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
    vertexShader: string;
    fragmentShader: string;
  } = {
    name: "ReflectorShader",

    defines: {
      DISTANCE_ATTENUATION: true,
      FRESNEL: true,
    },

    uniforms: {
      color: { value: null as Color | null },
      tDiffuse: { value: null as Texture | null },
      tDepth: { value: null as Texture | null },
      textureMatrix: { value: new Matrix4() },
      maxDistance: { value: 180 },
      opacity: { value: 0.5 },
      fresnelCoe: { value: null as number | null },
      virtualCameraNear: { value: null as number | null },
      virtualCameraFar: { value: null as number | null },
      virtualCameraProjectionMatrix: { value: new Matrix4() },
      virtualCameraMatrixWorld: { value: new Matrix4() },
      virtualCameraProjectionMatrixInverse: { value: new Matrix4() },
      resolution: { value: new Vector2() },
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
		uniform sampler2D tDepth;
		uniform float maxDistance;
		uniform float opacity;
		uniform float fresnelCoe;
		uniform float virtualCameraNear;
		uniform float virtualCameraFar;
		uniform mat4 virtualCameraProjectionMatrix;
		uniform mat4 virtualCameraProjectionMatrixInverse;
		uniform mat4 virtualCameraMatrixWorld;
		uniform vec2 resolution;
		varying vec4 vUv;
${chunk_packing}
		float blendOverlay( float base, float blend ) {
			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
		}
		vec3 blendOverlay( vec3 base, vec3 blend ) {
			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
		}
		float getDepth( const in vec2 uv ) {
			return texture2D( tDepth, uv ).x;
		}
		float getViewZ( const in float depth ) {
			return perspectiveDepthToViewZ( depth, virtualCameraNear, virtualCameraFar );
		}
		vec3 getViewPosition( const in vec2 uv, const in float depth, const in float clipW ) {
			vec4 clipPosition = vec4( ( vec3( uv, depth ) - 0.5 ) * 2.0, 1.0 );
			clipPosition *= clipW;
			return ( virtualCameraProjectionMatrixInverse * clipPosition ).xyz;
		}
		void main() {
			vec4 base = texture2DProj( tDiffuse, vUv );
			#ifdef useDepthTexture
				vec2 uv=(gl_FragCoord.xy-.5)/resolution.xy;
				uv.x=1.-uv.x;
				float depth = texture2DProj( tDepth, vUv ).r;
				float viewZ = getViewZ( depth );
				float clipW = virtualCameraProjectionMatrix[2][3] * viewZ+virtualCameraProjectionMatrix[3][3];
				vec3 viewPosition=getViewPosition( uv, depth, clipW );
				vec3 worldPosition=(virtualCameraMatrixWorld*vec4(viewPosition,1)).xyz;
				if(worldPosition.y>maxDistance) discard;
				float op=opacity;
				#ifdef DISTANCE_ATTENUATION
					float ratio=1.-(worldPosition.y/maxDistance);
					float attenuation=ratio*ratio;
					op=opacity*attenuation;
				#endif
				#ifdef FRESNEL
					op*=fresnelCoe;
				#endif
				gl_FragColor = vec4( blendOverlay( base.rgb, color ), op );
			#else
				gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );
			#endif
		}
	`,
  };

  /**
   * Constructs a new reflector.
   *
   * @param geometry - The reflector's geometry.
   * @param options - The configuration options.
   */
  constructor(geometry: BufferGeometry, options: ReflectorForSSRPassOptions = {} as ReflectorForSSRPassOptions) {
    const shader = options.shader || ReflectorForSSRPass.ReflectorShader;
    const useDepthTexture = options.useDepthTexture === true;
    const material = new ShaderMaterial({
      name: shader.name !== undefined ? shader.name : "unspecified",
      transparent: useDepthTexture,
      defines: { ...ReflectorForSSRPass.ReflectorShader.defines, useDepthTexture },
      uniforms: cloneUniforms(shader.uniforms),
      fragmentShader: shader.fragmentShader,
      vertexShader: shader.vertexShader,
    });
    super(geometry, material);

    this.type = "ReflectorForSSRPass";

    const color = options.color !== undefined ? new Color(options.color) : new Color(0x7f7f7f);
    const textureWidth = options.textureWidth || 512;
    const textureHeight = options.textureHeight || 512;
    const clipBias = options.clipBias || 0;
    const yAxis = new Vector3(0, 1, 0);
    const vecTemp0 = new Vector3();
    const vecTemp1 = new Vector3();

    //

    this.needsUpdate = false;
    this.maxDistance = (ReflectorForSSRPass.ReflectorShader.uniforms.maxDistance as { value: number }).value;
    this.opacity = (ReflectorForSSRPass.ReflectorShader.uniforms.opacity as { value: number }).value;
    this.color = color;
    this.resolution = options.resolution || new Vector2(window.innerWidth, window.innerHeight);

    this._distanceAttenuation = ReflectorForSSRPass.ReflectorShader.defines.DISTANCE_ATTENUATION;
    Object.defineProperty(this, "distanceAttenuation", {
      get() {
        return this._distanceAttenuation;
      },
      set(val: boolean) {
        if (this._distanceAttenuation === val) return;
        this._distanceAttenuation = val;
        this.material.defines.DISTANCE_ATTENUATION = val;
        this.material.needsUpdate = true;
      },
    });

    this._fresnel = ReflectorForSSRPass.ReflectorShader.defines.FRESNEL;
    Object.defineProperty(this, "fresnel", {
      get() {
        return this._fresnel;
      },
      set(val: boolean) {
        if (this._fresnel === val) return;
        this._fresnel = val;
        this.material.defines.FRESNEL = val;
        this.material.needsUpdate = true;
      },
    });

    const normal = new Vector3();
    const reflectorWorldPosition = new Vector3();
    const cameraWorldPosition = new Vector3();
    const rotationMatrix = new Matrix4();
    const lookAtPosition = new Vector3(0, 0, -1);

    const view = new Vector3();
    const target = new Vector3();

    const textureMatrix = new Matrix4();
    const virtualCamera = new PerspectiveCamera();

    let depthTexture: DepthTexture | undefined;

    if (useDepthTexture) {
      depthTexture = new DepthTexture(
        1,
        1,
        TextureType.UnsignedShort,
        undefined,
        undefined,
        undefined,
        TextureFilter.Nearest,
        TextureFilter.Nearest,
      );
    }

    const parameters = {
      depthTexture: useDepthTexture ? depthTexture : null,
      type: TextureType.HalfFloat,
    };

    const renderTarget = new WebGLRenderTarget(textureWidth, textureHeight, parameters);

    material.uniforms["tDiffuse"].value = renderTarget.texture;
    material.uniforms["color"].value = this.color;
    material.uniforms["textureMatrix"].value = textureMatrix;
    if (useDepthTexture) {
      material.uniforms["tDepth"].value = renderTarget.depthTexture;
    }

    const globalPlane = new Plane(new Vector3(0, 1, 0), clipBias);
    const globalPlanes = [globalPlane];

    /**
     * Renders the reflection into the internal render target.
     *
     * @param renderer - The renderer.
     * @param scene - The scene to render.
     * @param camera - The camera.
     */
    this.doRender = function (renderer: WebGLRenderer, scene: Scene, camera: CameraOf): void {
      material.uniforms["maxDistance"].value = this.maxDistance;
      material.uniforms["color"].value = this.color;
      material.uniforms["opacity"].value = this.opacity;

      vecTemp0.copy(camera.position).normalize();
      vecTemp1.copy(vecTemp0).reflect(yAxis);
      material.uniforms["fresnelCoe"].value = (vecTemp0.dot(vecTemp1) + 1.0) / 2.0; // TODO: Also need to use glsl viewPosition and viewNormal per pixel.

      reflectorWorldPosition.setFromMatrixPosition(this.matrixWorld);
      cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

      rotationMatrix.extractRotation(this.matrixWorld);

      normal.set(0, 0, 1);
      normal.applyMatrix4(rotationMatrix);

      view.subVectors(reflectorWorldPosition, cameraWorldPosition);

      // Avoid rendering when reflector is facing away

      if (view.dot(normal) > 0) return;

      view.reflect(normal).negate();
      view.add(reflectorWorldPosition);

      rotationMatrix.extractRotation(camera.matrixWorld);

      lookAtPosition.set(0, 0, -1);
      lookAtPosition.applyMatrix4(rotationMatrix);
      lookAtPosition.add(cameraWorldPosition);

      target.subVectors(reflectorWorldPosition, lookAtPosition);
      target.reflect(normal).negate();
      target.add(reflectorWorldPosition);

      virtualCamera.position.copy(view);
      virtualCamera.up.set(0, 1, 0);
      virtualCamera.up.applyMatrix4(rotationMatrix);
      virtualCamera.up.reflect(normal);
      virtualCamera.lookAt(target);

      virtualCamera.far = camera.far; // Used in WebGLBackground

      virtualCamera.updateMatrixWorld();
      virtualCamera.projectionMatrix.copy(camera.projectionMatrix);

      material.uniforms["virtualCameraNear"].value = camera.near;
      material.uniforms["virtualCameraFar"].value = camera.far;
      material.uniforms["virtualCameraMatrixWorld"].value = virtualCamera.matrixWorld;
      material.uniforms["virtualCameraProjectionMatrix"].value = camera.projectionMatrix;
      material.uniforms["virtualCameraProjectionMatrixInverse"].value = camera.projectionMatrixInverse;
      material.uniforms["resolution"].value = this.resolution;

      // Update the texture matrix
      textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
      textureMatrix.multiply(virtualCamera.projectionMatrix);
      textureMatrix.multiply(virtualCamera.matrixWorldInverse);
      textureMatrix.multiply(this.matrixWorld);

      const currentRenderTarget = renderer.getRenderTarget();

      const currentShadowAutoUpdate = renderer.shadowMap?.autoUpdate;
      const currentClippingPlanes = renderer.clippingPlanes;

      // Avoid camera modification and re-computing shadows
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
      renderer.clippingPlanes = globalPlanes;

      renderer.setRenderTarget(renderTarget);

      renderer.state.buffers.depth.setMask(true); // make sure the depth buffer is writable so it can be properly cleared, see #18897

      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, virtualCamera);

      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = currentShadowAutoUpdate === true;
      renderer.clippingPlanes = currentClippingPlanes;

      renderer.setRenderTarget(currentRenderTarget);

      // Restore viewport

      const viewport = (camera as CameraOf & { viewport?: { x: number; y: number; width: number; height: number } })
        .viewport;

      if (viewport !== undefined) {
        renderer.state.viewport(viewport as never);
      }
    };

    /**
     * Returns the reflector's internal render target.
     *
     * @return The internal render target.
     */
    this.getRenderTarget = function (): WebGLRenderTarget {
      return renderTarget;
    };
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  override dispose(): void {
    this.getRenderTarget().dispose();

    this.material.dispose();
  }

  /**
   * Renders the reflection into the internal render target.
   */
  doRender: (renderer: WebGLRenderer, scene: Scene, camera: CameraOf) => void = () => {};

  /**
   * Returns the reflector's internal render target.
   */
  getRenderTarget: () => WebGLRenderTarget = () => {
    throw new Error("THREE.ReflectorForSSRPass: render target is initialized in the constructor.");
  };
}

/** Constructor options of `ReflectorForSSRPass`. */
export interface ReflectorForSSRPassOptions {
  /** The reflector's color. */
  color?: number | Color | string;
  /** The texture width. A higher value results in more clear reflections but is also more expensive. */
  textureWidth?: number;
  /** The texture height. A higher value results in more clear reflections but is also more expensive. */
  textureHeight?: number;
  /** The clip bias. */
  clipBias?: number;
  /** Can be used to pass in a custom shader that defines how the reflective view is projected onto the reflector's geometry. */
  shader?: {
    name?: string;
    defines?: Record<string, any>;
    uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
    vertexShader: string;
    fragmentShader: string;
  };
  /** Whether to store depth values in a texture or not. */
  useDepthTexture?: boolean;
  /** Resolution for the Reflector Pass. */
  resolution?: Vector2;
}
