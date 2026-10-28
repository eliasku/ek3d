import type { CompressedTextureMipmap } from "./CompressedTexture";

import { Wrapping, PixelFormat, TextureType } from "../constants";
import { CompressedTexture } from "./CompressedTexture";
/**
 * Creates a texture 2D array based on data in compressed form.
 *
 * These texture are usually loaded with {@link CompressedTextureLoader}.
 *
 */
export class CompressedArrayTexture extends CompressedTexture {
  isCompressedArrayTexture: boolean;
  wrapR: Wrapping;
  layerUpdates: Set<number>;

  /**
   * Constructs a new compressed array texture.
   *
   * @param mipmaps - This array holds for all mipmaps (including the bases mip)
   * the data and dimensions.
   * @param width - The width of the texture.
   * @param height - The height of the texture.
   * @param depth - The depth of the texture.
   * @param [format=PixelFormat.RGBA] - The min filter value.
   * @param [type=TextureType.UnsignedByte] - The min filter value.
   */
  constructor(
    mipmaps: CompressedTextureMipmap[],
    width: number,
    height: number,
    depth: number,
    format?: PixelFormat,
    type?: TextureType,
  ) {
    super(mipmaps, width, height, format, type);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCompressedArrayTexture = true;
    /**
     * The image property of a compressed texture just defines its dimensions.
     *
     * @name CompressedArrayTexture#image
     */
    this.image.depth = depth;
    /**
     * This defines how the texture is wrapped in the depth and corresponds to
     * *W* in UVW mapping.
     *
     * @default Wrapping.ClampToEdge
     */
    this.wrapR = Wrapping.ClampToEdge;
    /**
     * A set of all layers which need to be updated in the texture.
     *
     */
    this.layerUpdates = new Set();
  }
  /**
   * Copies the values of the given texture to this instance.
   *
   * @param source - The texture to copy.
   * @return A reference to this instance.
   */
  copy(source: CompressedArrayTexture & Pick<this, "image" | "mipmaps">): this {
    super.copy(source);
    this.wrapR = source.wrapR;
    return this;
  }
  /**
   * Describes that a specific layer of the texture needs to be updated.
   * Normally when {@link Texture#needsUpdate} is set to `true`, the
   * entire compressed texture array is sent to the GPU. Marking specific
   * layers will only transmit subsets of all mipmaps associated with a
   * specific depth in the array which is often much more performant.
   *
   * @param layerIndex - The layer index that should be updated.
   */
  addLayerUpdate(layerIndex: number) {
    this.layerUpdates.add(layerIndex);
  }
  /**
   * Resets the layer updates registry.
   */
  clearLayerUpdates() {
    this.layerUpdates.clear();
  }

  get image(): { width: number; height: number; depth: number } {
    return this.source.data;
  }

  set image(value: CompressedArrayTexture["image"]) {
    this.source.data = value;
  }
}
