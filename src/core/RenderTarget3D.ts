import type { RenderTargetOptions } from "./RenderTarget";
import { RenderTarget } from "./RenderTarget";
import { Data3DTexture } from "../textures/Data3DTexture";
/**
 * Represents a 3D render target.
 *
 */
export class RenderTarget3D extends RenderTarget {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isRenderTarget3D: boolean = true;

  /**
   * Constructs a new 3D render target.
   *
   * @param [width=1] - The width of the render target.
   * @param [height=1] - The height of the render target.
   * @param [depth=1] - The height of the render target.
   * @param [options] - The configuration object.
   */
  constructor(width: number = 1, height: number = 1, depth: number = 1, options: RenderTargetOptions = {}) {
    super(width, height, options);
    this.depth = depth;
    // overwrite attachments with 3D textures
    for (let i = 0; i < this.textures.length; i++) {
      const texture = new Data3DTexture(null, width, height, depth);
      texture.isRenderTargetTexture = true;
      texture.renderTarget = this;
      this.textures[i] = texture;
    }
    this._setTextureOptions(options);
  }

  override clone(): RenderTarget3D {
    return new RenderTarget3D().copy(this);
  }

  get texture(): Data3DTexture {
    // Construction replaces the base attachment with a 3D texture.
    return super.texture as Data3DTexture;
  }

  set texture(value: Data3DTexture) {
    super.texture = value;
  }
}
