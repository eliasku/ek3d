import type { RenderTargetOptions } from "../core/RenderTarget";
import type { Texture } from "../textures/Texture";
import type { WebGLRenderer } from "./WebGLRenderer";
import chunk_begin_vertex from "./shaders/ShaderChunk/begin_vertex.glsl";
import chunk_project_vertex from "./shaders/ShaderChunk/project_vertex.glsl";
import chunk_common from "./shaders/ShaderChunk/common.glsl";
import { Side, TextureFilter, Blending } from "../constants";
import { Mesh } from "../objects/Mesh";
import { BoxGeometry } from "../geometries/BoxGeometry";
import { ShaderMaterial } from "../materials/ShaderMaterial";
import { cloneUniforms } from "./shaders/UniformsUtils";
import { WebGLRenderTarget } from "./WebGLRenderTarget";
import { CubeCamera } from "../cameras/CubeCamera";
import { CubeTexture } from "../textures/CubeTexture";
/**
 * A cube render target used in context of {@link WebGLRenderer}.
 *
 */
export class WebGLCubeRenderTarget extends WebGLRenderTarget {
  isWebGLCubeRenderTarget: boolean;

  /**
   * Constructs a new cube render target.
   *
   * @param [size=1] - The size of the render target.
   * @param [options] - The configuration object.
   */
  constructor(size: number = 1, options: RenderTargetOptions = {}) {
    super(size, size, options);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isWebGLCubeRenderTarget = true;
    const image: any = { width: size, height: size, depth: 1 };
    const images = [image, image, image, image, image, image];
    /**
     * Overwritten with a different texture type.
     *
     */
    this.texture = new CubeTexture(images);
    this._setTextureOptions(options);
    // By convention -- likely based on the RenderMan spec from the 1990's -- cube maps are specified by WebGL (and three.js)
    // in a coordinate system in which positive-x is to the right when looking up the positive-z axis -- in other words,
    // in a left-handed coordinate system. By continuing this convention, preexisting cube maps continued to render correctly.
    // three.js uses a right-handed coordinate system. So environment maps used in three.js appear to have px and nx swapped
    // and the flag isRenderTargetTexture controls this conversion. The flip is not required when using WebGLCubeRenderTarget.texture
    // as a cube texture (this is detected when isRenderTargetTexture is set to true for cube textures).
    this.texture.isRenderTargetTexture = true;
  }

  override get texture(): CubeTexture {
    return super.texture as CubeTexture;
  }

  override set texture(value: CubeTexture) {
    super.texture = value;
  }

  /**
   * Converts the given equirectangular texture to a cube map.
   *
   * @param renderer - The renderer.
   * @param texture - The equirectangular texture.
   * @return A reference to this cube render target.
   */
  fromEquirectangularTexture(renderer: WebGLRenderer, texture: Texture): this {
    this.texture.type = texture.type;
    this.texture.colorSpace = texture.colorSpace;
    this.texture.generateMipmaps = texture.generateMipmaps;
    this.texture.minFilter = texture.minFilter;
    this.texture.magFilter = texture.magFilter;
    const shader: any = {
      uniforms: {
        tEquirect: { value: null },
      },
      vertexShader:
        /* glsl */ "\n\n\t\t\t\tvarying vec3 vWorldDirection;\n\n\t\t\t\tvec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n\n\t\t\t\t\treturn normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n\n\t\t\t\t}\n\n\t\t\t\tvoid main() {\n\n\t\t\t\t\tvWorldDirection = transformDirection( position, modelMatrix );\n\n" +
        chunk_begin_vertex +
        "\n" +
        chunk_project_vertex +
        "\n\n\t\t\t\t}\n\t\t\t",
      fragmentShader:
        /* glsl */ "\n\n\t\t\t\tuniform sampler2D tEquirect;\n\n\t\t\t\tvarying vec3 vWorldDirection;\n\n" +
        chunk_common +
        "\n\n\t\t\t\tvoid main() {\n\n\t\t\t\t\tvec3 direction = normalize( vWorldDirection );\n\n\t\t\t\t\tvec2 sampleUV = equirectUv( direction );\n\n\t\t\t\t\tgl_FragColor = texture2D( tEquirect, sampleUV );\n\n\t\t\t\t}\n\t\t\t",
    };
    const geometry = new BoxGeometry(5, 5, 5);
    const material = new ShaderMaterial({
      name: "CubemapFromEquirect",
      uniforms: cloneUniforms(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      side: Side.Back,
      blending: Blending.No,
    });
    material.uniforms.tEquirect.value = texture;
    const mesh = new Mesh(geometry, material) as Mesh & { material: ShaderMaterial };
    const currentMinFilter = texture.minFilter;
    try {
      if (texture.minFilter === TextureFilter.LinearMipmapLinear) texture.minFilter = TextureFilter.Linear;
      const camera = new CubeCamera(1, 10, this);
      camera.update(renderer, mesh);
    } finally {
      texture.minFilter = currentMinFilter;
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    return this;
  }
  /**
   * Clears this cube render target.
   *
   * @param renderer - The renderer.
   * @param [color=true] - Whether the color buffer should be cleared or not.
   * @param [depth=true] - Whether the depth buffer should be cleared or not.
   * @param [stencil=true] - Whether the stencil buffer should be cleared or not.
   */
  clear(renderer: WebGLRenderer, color: boolean = true, depth: boolean = true, stencil: boolean = true) {
    const currentRenderTarget = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace();
    const mip = renderer.getActiveMipmapLevel();
    try {
      for (let i = 0; i < 6; i++) {
        renderer.setRenderTarget(this, i);
        renderer.clear(color, depth, stencil);
      }
    } finally {
      renderer.setRenderTarget(currentRenderTarget, face, mip);
    }
  }
}
