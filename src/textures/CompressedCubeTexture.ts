import type { CompressedTextureFace } from "./CompressedTexture";

import { Mapping } from "../constants";
import { CompressedTexture } from "./CompressedTexture";
/**
 * Creates a cube texture based on data in compressed form.
 *
 * These texture are usually loaded with {@link CompressedTextureLoader}.
 *
 */
export class CompressedCubeTexture extends CompressedTexture {
  isCompressedCubeTexture: boolean;
  isCubeTexture: boolean;

  /**
   * Constructs a new compressed texture.
   *
   * @param images - An array of compressed textures.
   * @param [format=PixelFormat.RGBA] - The texture format.
   * @param [type=TextureType.UnsignedByte] - The texture type.
   */
  constructor(images: CompressedTextureFace[], format?: number, type?: number) {
    super(undefined, images[0].width, images[0].height, format, type, Mapping.CubeReflection);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCompressedCubeTexture = true;
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCubeTexture = true;
    this.image = images;
  }

  get image(): CompressedTextureFace[] {
    return this.source.data;
  }

  set image(value: CompressedCubeTexture["image"]) {
    this.source.data = value;
  }
}
