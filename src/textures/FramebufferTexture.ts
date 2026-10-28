import { Texture } from "./Texture";
import { TextureSource } from "./TextureSource";
import { NearestFilter } from "../constants";
/**
 * This class can only be used in combination with `copyFramebufferToTexture()` methods
 * of renderers. It extracts the contents of the current bound framebuffer and provides it
 * as a texture for further usage.
 *
 * ```typescript
 * import type { Camera } from 'ek3d/cameras/Camera';
 * import { Vector2 } from 'ek3d/math/Vector2';
 * import type { WebGLRenderer } from 'ek3d/renderers/WebGLRenderer';
 * import type { Scene } from 'ek3d/scenes/Scene';
 * import { FramebufferTexture } from 'ek3d/textures/FramebufferTexture';
 *
 * function copyFrame( renderer: WebGLRenderer, scene: Scene, camera: Camera ) {
 * 	const pixelRatio = renderer.getPixelRatio();
 * 	const textureSize = 128 * pixelRatio;
 * 	const frameTexture = new FramebufferTexture( textureSize, textureSize );
 *
 * 	// Calculate the start position for copying part of the frame data.
 * 	const size = renderer.getDrawingBufferSize( new Vector2() );
 * 	const vector = size.subScalar( textureSize ).multiplyScalar( 0.5 );
 *
 * 	renderer.render( scene, camera );
 *
 * 	// Copy part of the rendered frame into the framebuffer texture.
 * 	renderer.copyFramebufferToTexture( frameTexture, vector );
 * 	return frameTexture;
 * }
 * ```
 *
 */
export class FramebufferTexture extends Texture {
  isFramebufferTexture: boolean;

  /**
   * Constructs a new framebuffer texture.
   *
   * @param [width] - The width of the texture.
   * @param [height] - The height of the texture.
   */
  constructor(width?: number, height?: number) {
    super({ width, height });
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isFramebufferTexture = true;
    /**
     * How the texture is sampled when a texel covers more than one pixel.
     *
     * Overwritten and set to `NearestFilter` by default to disable filtering.
     *
     * @default NearestFilter
     */
    this.magFilter = NearestFilter;
    /**
     * How the texture is sampled when a texel covers less than one pixel.
     *
     * Overwritten and set to `NearestFilter` by default to disable filtering.
     *
     * @default NearestFilter
     */
    this.minFilter = NearestFilter;
    /**
     * Whether to generate mipmaps (if possible) for a texture.
     *
     * Overwritten and set to `false` by default.
     *
     * @default false
     */
    this.generateMipmaps = false;
    this.needsUpdate = true;
  }
  copy(source: FramebufferTexture & Pick<this, "image" | "mipmaps">): this {
    super.copy(source);
    this.source = new TextureSource(Object.assign({}, source.image));
    return this;
  }

  get image(): { width: number; height: number } {
    return this.source.data;
  }

  set image(value: FramebufferTexture["image"]) {
    this.source.data = value;
  }
}
