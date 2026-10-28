import { GL } from "../../GL";
import { PixelFormat, TextureType, ColorSpace, Transfer } from "../../constants";
import { ColorManagement } from "../../math/ColorManagement";
export function WebGLUtils(gl?: any, extensions?: any) {
  function convert(p?: any, colorSpace: string = ColorSpace.No) {
    let extension: any;
    const transfer = ColorManagement.getTransfer(colorSpace);
    if (p === TextureType.UnsignedByte) return GL.UNSIGNED_BYTE;
    if (p === TextureType.UnsignedShort4444) return GL.UNSIGNED_SHORT_4_4_4_4;
    if (p === TextureType.UnsignedShort5551) return GL.UNSIGNED_SHORT_5_5_5_1;
    if (p === TextureType.UnsignedInt5999) return GL.UNSIGNED_INT_5_9_9_9_REV;
    if (p === TextureType.UnsignedInt101111) return GL.UNSIGNED_INT_10F_11F_11F_REV;
    if (p === TextureType.Byte) return GL.BYTE;
    if (p === TextureType.Short) return GL.SHORT;
    if (p === TextureType.UnsignedShort) return GL.UNSIGNED_SHORT;
    if (p === TextureType.Int) return GL.INT;
    if (p === TextureType.UnsignedInt) return GL.UNSIGNED_INT;
    if (p === TextureType.Float) return GL.FLOAT;
    if (p === TextureType.HalfFloat) return GL.HALF_FLOAT;
    if (p === PixelFormat.Alpha) return GL.ALPHA;
    if (p === PixelFormat.RGB) return GL.RGB;
    if (p === PixelFormat.RGBA) return GL.RGBA;
    if (p === PixelFormat.Depth) return GL.DEPTH_COMPONENT;
    if (p === PixelFormat.DepthStencil) return GL.DEPTH_STENCIL;
    // WebGL2 formats.
    if (p === PixelFormat.Red) return GL.RED;
    if (p === PixelFormat.RedInteger) return GL.RED_INTEGER;
    if (p === PixelFormat.RG) return GL.RG;
    if (p === PixelFormat.RGInteger) return GL.RG_INTEGER;
    if (p === PixelFormat.RGBAInteger) return GL.RGBA_INTEGER;
    // S3TC
    if (
      p === PixelFormat.RGB_S3TC_DXT1 ||
      p === PixelFormat.RGBA_S3TC_DXT1 ||
      p === PixelFormat.RGBA_S3TC_DXT3 ||
      p === PixelFormat.RGBA_S3TC_DXT5
    ) {
      if (transfer === Transfer.SRGB) {
        extension = extensions.get("WEBGL_compressed_texture_s3tc_srgb");
        if (extension !== null) {
          if (p === PixelFormat.RGB_S3TC_DXT1) return extension.COMPRESSED_SRGB_S3TC_DXT1_EXT;
          if (p === PixelFormat.RGBA_S3TC_DXT1) return extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
          if (p === PixelFormat.RGBA_S3TC_DXT3) return extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
          if (p === PixelFormat.RGBA_S3TC_DXT5) return extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
        } else {
          return null;
        }
      } else {
        extension = extensions.get("WEBGL_compressed_texture_s3tc");
        if (extension !== null) {
          if (p === PixelFormat.RGB_S3TC_DXT1) return extension.COMPRESSED_RGB_S3TC_DXT1_EXT;
          if (p === PixelFormat.RGBA_S3TC_DXT1) return extension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
          if (p === PixelFormat.RGBA_S3TC_DXT3) return extension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
          if (p === PixelFormat.RGBA_S3TC_DXT5) return extension.COMPRESSED_RGBA_S3TC_DXT5_EXT;
        } else {
          return null;
        }
      }
    }
    // PVRTC
    if (
      p === PixelFormat.RGB_PVRTC_4BPPV1 ||
      p === PixelFormat.RGB_PVRTC_2BPPV1 ||
      p === PixelFormat.RGBA_PVRTC_4BPPV1 ||
      p === PixelFormat.RGBA_PVRTC_2BPPV1
    ) {
      extension = extensions.get("WEBGL_compressed_texture_pvrtc");
      if (extension !== null) {
        if (p === PixelFormat.RGB_PVRTC_4BPPV1) return extension.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
        if (p === PixelFormat.RGB_PVRTC_2BPPV1) return extension.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
        if (p === PixelFormat.RGBA_PVRTC_4BPPV1) return extension.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
        if (p === PixelFormat.RGBA_PVRTC_2BPPV1) return extension.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
      } else {
        return null;
      }
    }
    // ETC
    if (
      p === PixelFormat.RGB_ETC1 ||
      p === PixelFormat.RGB_ETC2 ||
      p === PixelFormat.RGBA_ETC2_EAC ||
      p === PixelFormat.R11_EAC ||
      p === PixelFormat.SIGNED_R11_EAC ||
      p === PixelFormat.RG11_EAC ||
      p === PixelFormat.SIGNED_RG11_EAC
    ) {
      extension = extensions.get("WEBGL_compressed_texture_etc");
      if (extension !== null) {
        if (p === PixelFormat.RGB_ETC1 || p === PixelFormat.RGB_ETC2)
          return transfer === Transfer.SRGB ? extension.COMPRESSED_SRGB8_ETC2 : extension.COMPRESSED_RGB8_ETC2;
        if (p === PixelFormat.RGBA_ETC2_EAC)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC
            : extension.COMPRESSED_RGBA8_ETC2_EAC;
        if (p === PixelFormat.R11_EAC) return extension.COMPRESSED_R11_EAC;
        if (p === PixelFormat.SIGNED_R11_EAC) return extension.COMPRESSED_SIGNED_R11_EAC;
        if (p === PixelFormat.RG11_EAC) return extension.COMPRESSED_RG11_EAC;
        if (p === PixelFormat.SIGNED_RG11_EAC) return extension.COMPRESSED_SIGNED_RG11_EAC;
      } else {
        return null;
      }
    }
    // ASTC
    if (
      p === PixelFormat.RGBA_ASTC_4x4 ||
      p === PixelFormat.RGBA_ASTC_5x4 ||
      p === PixelFormat.RGBA_ASTC_5x5 ||
      p === PixelFormat.RGBA_ASTC_6x5 ||
      p === PixelFormat.RGBA_ASTC_6x6 ||
      p === PixelFormat.RGBA_ASTC_8x5 ||
      p === PixelFormat.RGBA_ASTC_8x6 ||
      p === PixelFormat.RGBA_ASTC_8x8 ||
      p === PixelFormat.RGBA_ASTC_10x5 ||
      p === PixelFormat.RGBA_ASTC_10x6 ||
      p === PixelFormat.RGBA_ASTC_10x8 ||
      p === PixelFormat.RGBA_ASTC_10x10 ||
      p === PixelFormat.RGBA_ASTC_12x10 ||
      p === PixelFormat.RGBA_ASTC_12x12
    ) {
      extension = extensions.get("WEBGL_compressed_texture_astc");
      if (extension !== null) {
        if (p === PixelFormat.RGBA_ASTC_4x4)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
            : extension.COMPRESSED_RGBA_ASTC_4x4_KHR;
        if (p === PixelFormat.RGBA_ASTC_5x4)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR
            : extension.COMPRESSED_RGBA_ASTC_5x4_KHR;
        if (p === PixelFormat.RGBA_ASTC_5x5)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR
            : extension.COMPRESSED_RGBA_ASTC_5x5_KHR;
        if (p === PixelFormat.RGBA_ASTC_6x5)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR
            : extension.COMPRESSED_RGBA_ASTC_6x5_KHR;
        if (p === PixelFormat.RGBA_ASTC_6x6)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR
            : extension.COMPRESSED_RGBA_ASTC_6x6_KHR;
        if (p === PixelFormat.RGBA_ASTC_8x5)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR
            : extension.COMPRESSED_RGBA_ASTC_8x5_KHR;
        if (p === PixelFormat.RGBA_ASTC_8x6)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR
            : extension.COMPRESSED_RGBA_ASTC_8x6_KHR;
        if (p === PixelFormat.RGBA_ASTC_8x8)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR
            : extension.COMPRESSED_RGBA_ASTC_8x8_KHR;
        if (p === PixelFormat.RGBA_ASTC_10x5)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR
            : extension.COMPRESSED_RGBA_ASTC_10x5_KHR;
        if (p === PixelFormat.RGBA_ASTC_10x6)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR
            : extension.COMPRESSED_RGBA_ASTC_10x6_KHR;
        if (p === PixelFormat.RGBA_ASTC_10x8)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR
            : extension.COMPRESSED_RGBA_ASTC_10x8_KHR;
        if (p === PixelFormat.RGBA_ASTC_10x10)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR
            : extension.COMPRESSED_RGBA_ASTC_10x10_KHR;
        if (p === PixelFormat.RGBA_ASTC_12x10)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR
            : extension.COMPRESSED_RGBA_ASTC_12x10_KHR;
        if (p === PixelFormat.RGBA_ASTC_12x12)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR
            : extension.COMPRESSED_RGBA_ASTC_12x12_KHR;
      } else {
        return null;
      }
    }
    // BPTC
    if (p === PixelFormat.RGBA_BPTC || p === PixelFormat.RGB_BPTC_SIGNED || p === PixelFormat.RGB_BPTC_UNSIGNED) {
      extension = extensions.get("EXT_texture_compression_bptc");
      if (extension !== null) {
        if (p === PixelFormat.RGBA_BPTC)
          return transfer === Transfer.SRGB
            ? extension.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT
            : extension.COMPRESSED_RGBA_BPTC_UNORM_EXT;
        if (p === PixelFormat.RGB_BPTC_SIGNED) return extension.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
        if (p === PixelFormat.RGB_BPTC_UNSIGNED) return extension.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
      } else {
        return null;
      }
    }
    // RGTC
    if (
      p === PixelFormat.RED_RGTC1 ||
      p === PixelFormat.SIGNED_RED_RGTC1 ||
      p === PixelFormat.RED_GREEN_RGTC2 ||
      p === PixelFormat.SIGNED_RED_GREEN_RGTC2
    ) {
      extension = extensions.get("EXT_texture_compression_rgtc");
      if (extension !== null) {
        if (p === PixelFormat.RED_RGTC1) return extension.COMPRESSED_RED_RGTC1_EXT;
        if (p === PixelFormat.SIGNED_RED_RGTC1) return extension.COMPRESSED_SIGNED_RED_RGTC1_EXT;
        if (p === PixelFormat.RED_GREEN_RGTC2) return extension.COMPRESSED_RED_GREEN_RGTC2_EXT;
        if (p === PixelFormat.SIGNED_RED_GREEN_RGTC2) return extension.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT;
      } else {
        return null;
      }
    }
    //
    if (p === TextureType.UnsignedInt248) return GL.UNSIGNED_INT_24_8;
    // if "p" can't be resolved, assume the user defines a WebGL constant as a string (fallback/workaround for packed RGB formats)
    return gl[p] !== undefined ? gl[p] : null;
  }
  return { convert: convert };
}
