import { Side } from "../../constants";
import { BoxGeometry } from "../../geometries/BoxGeometry";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { Mesh } from "../../objects/Mesh";
import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { Scene } from "../../scenes/Scene";
import { Pass } from "./Pass";
import type { CubeTexture } from "../../textures/CubeTexture";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
import chunk_begin_vertex from "../../renderers/shaders/ShaderChunk/begin_vertex.glsl";
import chunk_project_vertex from "../../renderers/shaders/ShaderChunk/project_vertex.glsl";
import chunk_tonemapping_fragment from "../../renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "../../renderers/shaders/ShaderChunk/colorspace_fragment.glsl";

// The upstream `ShaderLib.cube` shader, inlined because this package has no ShaderLib barrel.
const cubeShader = {
  uniforms: {
    tCube: { value: null },
    tFlip: { value: -1 },
    opacity: { value: 1.0 },
  },

  vertexShader: /* glsl */ `
varying vec3 vWorldDirection;

${chunk_common}

void main() {

	vWorldDirection = transformDirection( position, modelMatrix );

	${chunk_begin_vertex}
	${chunk_project_vertex}

	gl_Position.z = gl_Position.w; // set z to camera.far

}
`,

  fragmentShader: /* glsl */ `
uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;

varying vec3 vWorldDirection;

void main() {

	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );

	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;

	${chunk_tonemapping_fragment}
	${chunk_colorspace_fragment}

}
`,
};

/**
 * This pass can be used to render a cube texture over the entire screen.
 *
 * ```ts
 * const cubeMap = new CubeTextureLoader().load( urls );
 *
 * const cubeTexturePass = new CubeTexturePass( camera, cubemap );
 * composer.addPass( cubeTexturePass );
 * ```
 *
 */
export class CubeTexturePass extends Pass {
  camera: PerspectiveCamera;
  tCube: CubeTexture | null;
  opacity: number;
  needsSwap: boolean;
  _cubeMesh: Mesh<ShaderMaterial>;
  _cubeScene: Scene;
  _cubeCamera: PerspectiveCamera;

  /**
   * Constructs a new cube texture pass.
   *
   * @param camera - The camera.
   * @param tCube - The cube texture to render.
   * @param opacity - The opacity.
   */
  constructor(camera: PerspectiveCamera, tCube: CubeTexture | null, opacity: number = 1) {
    super();
    /**
     * The camera.
     */
    this.camera = camera;

    /**
     * The cube texture to render.
     */
    this.tCube = tCube;

    /**
     * The opacity.
     *
     * @default 1
     */
    this.opacity = opacity;

    /**
     * Overwritten to disable the swap.
     *
     * @default false
     */
    this.needsSwap = false;

    // internals

    const material = new ShaderMaterial({
      uniforms: cloneUniforms(cubeShader.uniforms),
      vertexShader: cubeShader.vertexShader,
      fragmentShader: cubeShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
      side: Side.Back,
    });

    // The renderer samples the envMap uniform for background-like materials.
    Object.defineProperty(material, "envMap", {
      get: function () {
        return material.uniforms.tCube.value;
      },
    });

    // The mesh's envMap getter keeps upstream naming.
    this._cubeMesh = new Mesh(new BoxGeometry(10, 10, 10), material);

    this._cubeScene = new Scene();
    this._cubeCamera = new PerspectiveCamera();
    this._cubeScene.add(this._cubeMesh);
  }

  /**
   * Performs the cube texture pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    _deltaTime: number,
    _maskActive: boolean,
  ): void {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    this._cubeCamera.projectionMatrix.copy(this.camera.projectionMatrix);
    this._cubeCamera.quaternion.setFromRotationMatrix(this.camera.matrixWorld);

    const material = this._cubeMesh.material;
    material.uniforms.tCube.value = this.tCube;
    material.uniforms.tFlip.value =
      this.tCube !== null && this.tCube.isCubeTexture === true && this.tCube.isRenderTargetTexture === false ? -1 : 1;
    material.uniforms.opacity.value = this.opacity;
    material.transparent = this.opacity < 1.0;

    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear) renderer.clear();
    renderer.render(this._cubeScene, this._cubeCamera);

    renderer.autoClear = oldAutoClear;
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this._cubeMesh.geometry.dispose();
    this._cubeMesh.material.dispose();
  }
}
