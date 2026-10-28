import type { Texture } from "../textures/Texture";
import { PixelFormat, TextureType } from "../constants";
/**
 * Scales the texture as large as possible within its surface without cropping
 * or stretching the texture. The method preserves the original aspect ratio of
 * the texture. Akin to CSS `object-fit: contain`
 *
 * @param texture - The texture.
 * @param aspect - The texture's aspect ratio.
 * @return The updated texture.
 */
export function contain(texture: Texture, aspect: number): Texture {
  const imageAspect = texture.image && texture.image.width ? texture.image.width / texture.image.height : 1;
  if (imageAspect > aspect) {
    texture.repeat.x = 1;
    texture.repeat.y = imageAspect / aspect;
    texture.offset.x = 0;
    texture.offset.y = (1 - texture.repeat.y) / 2;
  } else {
    texture.repeat.x = aspect / imageAspect;
    texture.repeat.y = 1;
    texture.offset.x = (1 - texture.repeat.x) / 2;
    texture.offset.y = 0;
  }
  return texture;
}
/**
 * Scales the texture to the smallest possible size to fill the surface, leaving
 * no empty space. The method preserves the original aspect ratio of the texture.
 * Akin to CSS `object-fit: cover`.
 *
 * @param texture - The texture.
 * @param aspect - The texture's aspect ratio.
 * @return The updated texture.
 */
export function cover(texture: Texture, aspect: number): Texture {
  const imageAspect = texture.image && texture.image.width ? texture.image.width / texture.image.height : 1;
  if (imageAspect > aspect) {
    texture.repeat.x = aspect / imageAspect;
    texture.repeat.y = 1;
    texture.offset.x = (1 - texture.repeat.x) / 2;
    texture.offset.y = 0;
  } else {
    texture.repeat.x = 1;
    texture.repeat.y = imageAspect / aspect;
    texture.offset.x = 0;
    texture.offset.y = (1 - texture.repeat.y) / 2;
  }
  return texture;
}
/**
 * Configures the texture to the default transformation. Akin to CSS `object-fit: fill`.
 *
 * @param texture - The texture.
 * @return The updated texture.
 */
export function fill(texture: Texture): Texture {
  texture.repeat.x = 1;
  texture.repeat.y = 1;
  texture.offset.x = 0;
  texture.offset.y = 0;
  return texture;
}
/**
 * Determines how many bytes must be used to represent the texture.
 *
 * @param width - The width of the texture.
 * @param height - The height of the texture.
 * @param format - The texture's format.
 * @param type - The texture's type.
 * @return The byte length.
 */
export function getByteLength(width: number, height: number, format: number, type: number): number {
  const typeByteLength = getTextureTypeByteLength(type);
  switch (format) {
    // https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glTexImage2D.xhtml
    case PixelFormat.Alpha:
      return width * height;
    case PixelFormat.Red:
      return ((width * height) / typeByteLength.components) * typeByteLength.byteLength;
    case PixelFormat.RedInteger:
      return ((width * height) / typeByteLength.components) * typeByteLength.byteLength;
    case PixelFormat.RG:
      return ((width * height * 2) / typeByteLength.components) * typeByteLength.byteLength;
    case PixelFormat.RGInteger:
      return ((width * height * 2) / typeByteLength.components) * typeByteLength.byteLength;
    case PixelFormat.RGB:
      return ((width * height * 3) / typeByteLength.components) * typeByteLength.byteLength;
    case PixelFormat.RGBA:
      return ((width * height * 4) / typeByteLength.components) * typeByteLength.byteLength;
    case PixelFormat.RGBAInteger:
      return ((width * height * 4) / typeByteLength.components) * typeByteLength.byteLength;
    // https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_s3tc_srgb/
    case PixelFormat.RGB_S3TC_DXT1:
    case PixelFormat.RGBA_S3TC_DXT1:
      return Math.floor((width + 3) / 4) * Math.floor((height + 3) / 4) * 8;
    case PixelFormat.RGBA_S3TC_DXT3:
    case PixelFormat.RGBA_S3TC_DXT5:
      return Math.floor((width + 3) / 4) * Math.floor((height + 3) / 4) * 16;
    // https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_pvrtc/
    case PixelFormat.RGB_PVRTC_2BPPV1:
    case PixelFormat.RGBA_PVRTC_2BPPV1:
      return (Math.max(width, 16) * Math.max(height, 8)) / 4;
    case PixelFormat.RGB_PVRTC_4BPPV1:
    case PixelFormat.RGBA_PVRTC_4BPPV1:
      return (Math.max(width, 8) * Math.max(height, 8)) / 2;
    // https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_etc/
    case PixelFormat.RGB_ETC1:
    case PixelFormat.RGB_ETC2:
    case PixelFormat.R11_EAC:
    case PixelFormat.SIGNED_R11_EAC:
      return Math.floor((width + 3) / 4) * Math.floor((height + 3) / 4) * 8;
    case PixelFormat.RGBA_ETC2_EAC:
    case PixelFormat.RG11_EAC:
    case PixelFormat.SIGNED_RG11_EAC:
      return Math.floor((width + 3) / 4) * Math.floor((height + 3) / 4) * 16;
    // https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_astc/
    case PixelFormat.RGBA_ASTC_4x4:
      return Math.floor((width + 3) / 4) * Math.floor((height + 3) / 4) * 16;
    case PixelFormat.RGBA_ASTC_5x4:
      return Math.floor((width + 4) / 5) * Math.floor((height + 3) / 4) * 16;
    case PixelFormat.RGBA_ASTC_5x5:
      return Math.floor((width + 4) / 5) * Math.floor((height + 4) / 5) * 16;
    case PixelFormat.RGBA_ASTC_6x5:
      return Math.floor((width + 5) / 6) * Math.floor((height + 4) / 5) * 16;
    case PixelFormat.RGBA_ASTC_6x6:
      return Math.floor((width + 5) / 6) * Math.floor((height + 5) / 6) * 16;
    case PixelFormat.RGBA_ASTC_8x5:
      return Math.floor((width + 7) / 8) * Math.floor((height + 4) / 5) * 16;
    case PixelFormat.RGBA_ASTC_8x6:
      return Math.floor((width + 7) / 8) * Math.floor((height + 5) / 6) * 16;
    case PixelFormat.RGBA_ASTC_8x8:
      return Math.floor((width + 7) / 8) * Math.floor((height + 7) / 8) * 16;
    case PixelFormat.RGBA_ASTC_10x5:
      return Math.floor((width + 9) / 10) * Math.floor((height + 4) / 5) * 16;
    case PixelFormat.RGBA_ASTC_10x6:
      return Math.floor((width + 9) / 10) * Math.floor((height + 5) / 6) * 16;
    case PixelFormat.RGBA_ASTC_10x8:
      return Math.floor((width + 9) / 10) * Math.floor((height + 7) / 8) * 16;
    case PixelFormat.RGBA_ASTC_10x10:
      return Math.floor((width + 9) / 10) * Math.floor((height + 9) / 10) * 16;
    case PixelFormat.RGBA_ASTC_12x10:
      return Math.floor((width + 11) / 12) * Math.floor((height + 9) / 10) * 16;
    case PixelFormat.RGBA_ASTC_12x12:
      return Math.floor((width + 11) / 12) * Math.floor((height + 11) / 12) * 16;
    // https://registry.khronos.org/webgl/extensions/EXT_texture_compression_bptc/
    case PixelFormat.RGBA_BPTC:
    case PixelFormat.RGB_BPTC_SIGNED:
    case PixelFormat.RGB_BPTC_UNSIGNED:
      return Math.ceil(width / 4) * Math.ceil(height / 4) * 16;
    // https://registry.khronos.org/webgl/extensions/EXT_texture_compression_rgtc/
    case PixelFormat.RED_RGTC1:
    case PixelFormat.SIGNED_RED_RGTC1:
      return Math.ceil(width / 4) * Math.ceil(height / 4) * 8;
    case PixelFormat.RED_GREEN_RGTC2:
    case PixelFormat.SIGNED_RED_GREEN_RGTC2:
      return Math.ceil(width / 4) * Math.ceil(height / 4) * 16;
  }
  throw new Error(`Unable to determine texture byte length for ${format} format.`);
}
function getTextureTypeByteLength(type?: any) {
  switch (type) {
    case TextureType.UnsignedByte:
    case TextureType.Byte:
      return { byteLength: 1, components: 1 };
    case TextureType.UnsignedShort:
    case TextureType.Short:
    case TextureType.HalfFloat:
      return { byteLength: 2, components: 1 };
    case TextureType.UnsignedShort4444:
    case TextureType.UnsignedShort5551:
      return { byteLength: 2, components: 4 };
    case TextureType.UnsignedInt:
    case TextureType.Int:
    case TextureType.Float:
      return { byteLength: 4, components: 1 };
    case TextureType.UnsignedInt5999:
    case TextureType.UnsignedInt101111:
      return { byteLength: 4, components: 3 };
  }
  throw new Error(`THREE.TextureUtils: Unknown texture type ${type}.`);
}
/**
 * A class containing utility functions for textures.
 *
 * @hideconstructor
 */
export class TextureUtils {
  /**
   * Scales the texture as large as possible within its surface without cropping
   * or stretching the texture. The method preserves the original aspect ratio of
   * the texture. Akin to CSS `object-fit: contain`
   *
   * @param texture - The texture.
   * @param aspect - The texture's aspect ratio.
   * @return The updated texture.
   */
  static contain(texture: Texture, aspect: number): Texture {
    return contain(texture, aspect);
  }
  /**
   * Scales the texture to the smallest possible size to fill the surface, leaving
   * no empty space. The method preserves the original aspect ratio of the texture.
   * Akin to CSS `object-fit: cover`.
   *
   * @param texture - The texture.
   * @param aspect - The texture's aspect ratio.
   * @return The updated texture.
   */
  static cover(texture: Texture, aspect: number): Texture {
    return cover(texture, aspect);
  }
  /**
   * Configures the texture to the default transformation. Akin to CSS `object-fit: fill`.
   *
   * @param texture - The texture.
   * @return The updated texture.
   */
  static fill(texture: Texture): Texture {
    return fill(texture);
  }
  /**
   * Determines how many bytes must be used to represent the texture.
   *
   * @param width - The width of the texture.
   * @param height - The height of the texture.
   * @param format - The texture's format.
   * @param type - The texture's type.
   * @return The byte length.
   */
  static getByteLength(width: number, height: number, format: number, type: number): number {
    return getByteLength(width, height, format, type);
  }
}
