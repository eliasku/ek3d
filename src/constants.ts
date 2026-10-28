export const REVISION = "187dev";

/**
 * Represents mouse buttons and interaction types in context of controls.
 *
 */
/* oxlint-disable typescript/no-duplicate-enum-values -- API aliases share the same value. */
export const enum MOUSE {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,

  ROTATE = 0,

  DOLLY = 1,

  PAN = 2,
}
/* oxlint-enable typescript/no-duplicate-enum-values */

/**
 * Represents touch interaction types in context of controls.
 *
 */
export const enum TOUCH {
  ROTATE = 0,
  PAN = 1,
  DOLLY_PAN = 2,
  DOLLY_ROTATE = 3,
}

export const enum CullFace {
  /**
   * Disables face culling.
   *
   */
  None = 0,

  /**
   * Culls back faces.
   *
   */
  Back = 1,

  /**
   * Culls front faces.
   *
   */
  Front = 2,

  /**
   * Culls both front and back faces.
   *
   */
  FrontBack = 3,
}

export const enum ShadowMap {
  /**
   * Gives unfiltered shadow maps - fastest, but lowest quality.
   *
   */
  Basic = 0,

  /**
   * Filters shadow maps using the Percentage-Closer Filtering (PCF) algorithm.
   *
   */
  PCF = 1,

  /**
   * Filters shadow maps using the Percentage-Closer Filtering (PCF) algorithm with
   * better soft shadows especially when using low-resolution shadow maps.
   *
   * @deprecated since r186. Use `ShadowMap.PCF` instead.
   */
  PCFSoft = 2,

  /**
   * Filters shadow maps using the Variance Shadow Map (VSM) algorithm.
   * When using ShadowMap.VSM all shadow receivers will also cast shadows.
   *
   */
  VSM = 3,
}

export const enum Side {
  /**
   * Only front faces are rendered.
   *
   */
  Front = 0,

  /**
   * Only back faces are rendered.
   *
   */
  Back = 1,

  /**
   * Both front and back faces are rendered.
   *
   */
  Double = 2,
}

export const enum Blending {
  /**
   * No blending is performed which effectively disables
   * alpha transparency.
   *
   */
  No = 0,

  /**
   * The default blending.
   *
   */
  Normal = 1,

  /**
   * Represents additive blending.
   *
   */
  Additive = 2,

  /**
   * Represents subtractive blending.
   *
   */
  Subtractive = 3,

  /**
   * Represents multiply blending.
   *
   */
  Multiply = 4,

  /**
   * Represents custom blending.
   *
   */
  Custom = 5,

  /**
   * Represents material blending.
   *
   */
  Material = 6,
}

export const enum Equation {
  /**
   * A `source + destination` blending equation.
   *
   */
  Add = 100,

  /**
   * A `source - destination` blending equation.
   *
   */
  Subtract = 101,

  /**
   * A `destination - source` blending equation.
   *
   */
  ReverseSubtract = 102,

  /**
   * A blend equation that uses the minimum of source and destination.
   *
   */
  Min = 103,

  /**
   * A blend equation that uses the maximum of source and destination.
   *
   */
  Max = 104,
}

export const enum Factor {
  /**
   * Multiplies all colors by `0`.
   *
   */
  Zero = 200,

  /**
   * Multiplies all colors by `1`.
   *
   */
  One = 201,

  /**
   * Multiplies all colors by the source colors.
   *
   */
  SrcColor = 202,

  /**
   * Multiplies all colors by `1` minus each source color.
   *
   */
  OneMinusSrcColor = 203,

  /**
   * Multiplies all colors by the source alpha value.
   *
   */
  SrcAlpha = 204,

  /**
   * Multiplies all colors by 1 minus the source alpha value.
   *
   */
  OneMinusSrcAlpha = 205,

  /**
   * Multiplies all colors by the destination alpha value.
   *
   */
  DstAlpha = 206,

  /**
   * Multiplies all colors by `1` minus the destination alpha value.
   *
   */
  OneMinusDstAlpha = 207,

  /**
   * Multiplies all colors by the destination color.
   *
   */
  DstColor = 208,

  /**
   * Multiplies all colors by `1` minus each destination color.
   *
   */
  OneMinusDstColor = 209,

  /**
   * Multiplies the RGB colors by the smaller of either the source alpha
   * value or the value of `1` minus the destination alpha value. The alpha
   * value is multiplied by `1`.
   *
   */
  SrcAlphaSaturate = 210,

  /**
   * Multiplies all colors by a constant color.
   *
   */
  ConstantColor = 211,

  /**
   * Multiplies all colors by `1` minus a constant color.
   *
   */
  OneMinusConstantColor = 212,

  /**
   * Multiplies all colors by a constant alpha value.
   *
   */
  ConstantAlpha = 213,

  /**
   * Multiplies all colors by 1 minus a constant alpha value.
   *
   */
  OneMinusConstantAlpha = 214,
}

export const enum DepthFunc {
  /**
   * Never pass.
   *
   */
  Never = 0,

  /**
   * Always pass.
   *
   */
  Always = 1,

  /**
   * Pass if the incoming value is less than the depth buffer value.
   *
   */
  Less = 2,

  /**
   * Pass if the incoming value is less than or equal to the depth buffer value.
   *
   */
  LessEqual = 3,

  /**
   * Pass if the incoming value equals the depth buffer value.
   *
   */
  Equal = 4,

  /**
   * Pass if the incoming value is greater than or equal to the depth buffer value.
   *
   */
  GreaterEqual = 5,

  /**
   * Pass if the incoming value is greater than the depth buffer value.
   *
   */
  Greater = 6,

  /**
   * Pass if the incoming value is not equal to the depth buffer value.
   *
   */
  NotEqual = 7,
}

export const enum Combine {
  /**
   * Multiplies the environment map color with the surface color.
   *
   */
  Multiply = 0,

  /**
   * Uses reflectivity to blend between the two colors.
   *
   */
  Mix = 1,

  /**
   * Adds the two colors.
   *
   */
  Add = 2,
}

export const enum ToneMapping {
  /**
   * No tone mapping is applied.
   *
   */
  No = 0,

  /**
   * Linear tone mapping.
   *
   */
  Linear = 1,

  /**
   * Reinhard tone mapping.
   *
   */
  Reinhard = 2,

  /**
   * Cineon tone mapping.
   *
   */
  Cineon = 3,

  /**
   * ACES Filmic tone mapping.
   *
   */
  ACESFilmic = 4,

  /**
   * Custom tone mapping.
   *
   * Expects a custom implementation by modifying shader code of the material's fragment shader.
   *
   */
  Custom = 5,

  /**
   * AgX tone mapping.
   *
   */
  AgX = 6,

  /**
   * Neutral tone mapping.
   *
   * Implementation based on the Khronos 3D Commerce Group standard tone mapping.
   *
   */
  Neutral = 7,
}

export const enum BindMode {
  /**
   * The skinned mesh shares the same world space as the skeleton.
   *
   */
  Attached = "attached",

  /**
   * The skinned mesh does not share the same world space as the skeleton.
   * This is useful when a skeleton is shared across multiple skinned meshes.
   *
   */
  Detached = "detached",
}

export const enum Mapping {
  /**
   * Maps textures using the geometry's UV coordinates.
   *
   */
  UV = 300,

  /**
   * Reflection mapping for cube textures.
   *
   */
  CubeReflection = 301,

  /**
   * Refraction mapping for cube textures.
   *
   */
  CubeRefraction = 302,

  /**
   * Reflection mapping for equirectangular textures.
   *
   */
  EquirectangularReflection = 303,

  /**
   * Refraction mapping for equirectangular textures.
   *
   */
  EquirectangularRefraction = 304,
}

export const enum Wrapping {
  /**
   * The texture will simply repeat to infinity.
   *
   */
  Repeat = 1000,

  /**
   * The last pixel of the texture stretches to the edge of the mesh.
   *
   */
  ClampToEdge = 1001,

  /**
   * The texture will repeats to infinity, mirroring on each repeat.
   *
   */
  MirroredRepeat = 1002,
}

/* oxlint-disable typescript/no-duplicate-enum-values -- API aliases share the same value. */
export const enum TextureFilter {
  /**
   * Returns the value of the texture element that is nearest (in Manhattan distance)
   * to the specified texture coordinates.
   *
   */
  Nearest = 1003,

  /**
   * Chooses the mipmap that most closely matches the size of the pixel being textured
   * and uses the `TextureFilter.Nearest` criterion (the texel nearest to the center of the pixel)
   * to produce a texture value.
   *
   */
  NearestMipmapNearest = 1004,

  NearestMipMapNearest = 1004,
  // legacy
  /**
   * Chooses the two mipmaps that most closely match the size of the pixel being textured and
   * uses the `TextureFilter.Nearest` criterion to produce a texture value from each mipmap.
   * The final texture value is a weighted average of those two values.
   *
   */
  NearestMipmapLinear = 1005,

  NearestMipMapLinear = 1005,
  // legacy
  /**
   * Returns the weighted average of the four texture elements that are closest to the specified
   * texture coordinates, and can include items wrapped or repeated from other parts of a texture,
   * depending on the values of `wrapS` and `wrapT`, and on the exact mapping.
   *
   */
  Linear = 1006,

  /**
   * Chooses the mipmap that most closely matches the size of the pixel being textured and uses
   * the `TextureFilter.Linear` criterion (a weighted average of the four texels that are closest to the
   * center of the pixel) to produce a texture value.
   *
   */
  LinearMipmapNearest = 1007,

  LinearMipMapNearest = 1007,
  // legacy
  /**
   * Chooses the two mipmaps that most closely match the size of the pixel being textured and uses
   * the `TextureFilter.Linear` criterion to produce a texture value from each mipmap. The final texture value
   * is a weighted average of those two values.
   *
   */
  LinearMipmapLinear = 1008,

  LinearMipMapLinear = 1008,
}
/* oxlint-enable typescript/no-duplicate-enum-values */

export const enum TextureType {
  // legacy
  /**
   * An unsigned byte data type for textures.
   *
   */
  UnsignedByte = 1009,

  /**
   * A byte data type for textures.
   *
   */
  Byte = 1010,

  /**
   * A short data type for textures.
   *
   */
  Short = 1011,

  /**
   * An unsigned short data type for textures.
   *
   */
  UnsignedShort = 1012,

  /**
   * An int data type for textures.
   *
   */
  Int = 1013,

  /**
   * An unsigned int data type for textures.
   *
   */
  UnsignedInt = 1014,

  /**
   * A float data type for textures.
   *
   */
  Float = 1015,

  /**
   * A half float data type for textures.
   *
   */
  HalfFloat = 1016,

  /**
   * An unsigned short 4_4_4_4 (packed) data type for textures.
   *
   */
  UnsignedShort4444 = 1017,

  /**
   * An unsigned short 5_5_5_1 (packed) data type for textures.
   *
   */
  UnsignedShort5551 = 1018,

  /**
   * An unsigned int 24_8 data type for textures.
   *
   */
  UnsignedInt248 = 1020,

  /**
   * An unsigned int 5_9_9_9 (packed) data type for textures.
   *
   */
  UnsignedInt5999 = 35902,

  /**
   * An unsigned int 10_11_11 (packed) data type for textures.
   *
   */
  UnsignedInt101111 = 35899,
}

export const enum PixelFormat {
  /**
   * Discards the red, green and blue components and reads just the alpha component.
   *
   */
  Alpha = 1021,

  /**
   * Discards the alpha component and reads the red, green and blue component.
   *
   */
  RGB = 1022,

  /**
   * Reads the red, green, blue and alpha components.
   *
   */
  RGBA = 1023,

  /**
   * Reads each element as a single depth value, converts it to floating point, and clamps to the range `[0,1]`.
   *
   */
  Depth = 1026,

  /**
   * Reads each element is a pair of depth and stencil values. The depth component of the pair is interpreted as
   * in `PixelFormat.Depth`. The stencil component is interpreted based on the depth + stencil internal format.
   *
   */
  DepthStencil = 1027,

  /**
   * Discards the green, blue and alpha components and reads just the red component.
   *
   */
  Red = 1028,

  /**
   * Discards the green, blue and alpha components and reads just the red component. The texels are read as integers instead of floating point.
   *
   */
  RedInteger = 1029,

  /**
   * Discards the alpha, and blue components and reads the red, and green components.
   *
   */
  RG = 1030,

  /**
   * Discards the alpha, and blue components and reads the red, and green components. The texels are read as integers instead of floating point.
   *
   */
  RGInteger = 1031,

  /**
   * Discards the alpha component and reads the red, green and blue component. The texels are read as integers instead of floating point.
   *
   */
  RGBInteger = 1032,

  /**
   * Reads the red, green, blue and alpha components. The texels are read as integers instead of floating point.
   *
   */
  RGBAInteger = 1033,

  /**
   * A DXT1-compressed image in an RGB image format.
   *
   */
  RGB_S3TC_DXT1 = 33776,

  /**
   * A DXT1-compressed image in an RGB image format with a simple on/off alpha value.
   *
   */
  RGBA_S3TC_DXT1 = 33777,

  /**
   * A DXT3-compressed image in an RGBA image format. Compared to a 32-bit RGBA texture, it offers 4:1 compression.
   *
   */
  RGBA_S3TC_DXT3 = 33778,

  /**
   * A DXT5-compressed image in an RGBA image format. It also provides a 4:1 compression, but differs to the DXT3
   * compression in how the alpha compression is done.
   *
   */
  RGBA_S3TC_DXT5 = 33779,

  /**
   * PVRTC RGB compression in 4-bit mode. One block for each 4×4 pixels.
   *
   */
  RGB_PVRTC_4BPPV1 = 35840,

  /**
   * PVRTC RGB compression in 2-bit mode. One block for each 8×4 pixels.
   *
   */
  RGB_PVRTC_2BPPV1 = 35841,

  /**
   * PVRTC RGBA compression in 4-bit mode. One block for each 4×4 pixels.
   *
   */
  RGBA_PVRTC_4BPPV1 = 35842,

  /**
   * PVRTC RGBA compression in 2-bit mode. One block for each 8×4 pixels.
   *
   */
  RGBA_PVRTC_2BPPV1 = 35843,

  /**
   * ETC1 RGB format.
   *
   */
  RGB_ETC1 = 36196,

  /**
   * ETC2 RGB format.
   *
   */
  RGB_ETC2 = 37492,

  /**
   * ETC2 RGBA format.
   *
   */
  RGBA_ETC2_EAC = 37496,

  /**
   * EAC R11 UNORM format.
   *
   */
  R11_EAC = 37488,
  // 0x9270
  /**
   * EAC R11 SNORM format.
   *
   */
  SIGNED_R11_EAC = 37489,
  // 0x9271
  /**
   * EAC RG11 UNORM format.
   *
   */
  RG11_EAC = 37490,
  // 0x9272
  /**
   * EAC RG11 SNORM format.
   *
   */
  SIGNED_RG11_EAC = 37491,
  // 0x9273
  /**
   * ASTC RGBA 4x4 format.
   *
   */
  RGBA_ASTC_4x4 = 37808,

  /**
   * ASTC RGBA 5x4 format.
   *
   */
  RGBA_ASTC_5x4 = 37809,

  /**
   * ASTC RGBA 5x5 format.
   *
   */
  RGBA_ASTC_5x5 = 37810,

  /**
   * ASTC RGBA 6x5 format.
   *
   */
  RGBA_ASTC_6x5 = 37811,

  /**
   * ASTC RGBA 6x6 format.
   *
   */
  RGBA_ASTC_6x6 = 37812,

  /**
   * ASTC RGBA 8x5 format.
   *
   */
  RGBA_ASTC_8x5 = 37813,

  /**
   * ASTC RGBA 8x6 format.
   *
   */
  RGBA_ASTC_8x6 = 37814,

  /**
   * ASTC RGBA 8x8 format.
   *
   */
  RGBA_ASTC_8x8 = 37815,

  /**
   * ASTC RGBA 10x5 format.
   *
   */
  RGBA_ASTC_10x5 = 37816,

  /**
   * ASTC RGBA 10x6 format.
   *
   */
  RGBA_ASTC_10x6 = 37817,

  /**
   * ASTC RGBA 10x8 format.
   *
   */
  RGBA_ASTC_10x8 = 37818,

  /**
   * ASTC RGBA 10x10 format.
   *
   */
  RGBA_ASTC_10x10 = 37819,

  /**
   * ASTC RGBA 12x10 format.
   *
   */
  RGBA_ASTC_12x10 = 37820,

  /**
   * ASTC RGBA 12x12 format.
   *
   */
  RGBA_ASTC_12x12 = 37821,

  /**
   * BPTC RGBA format.
   *
   */
  RGBA_BPTC = 36492,

  /**
   * BPTC Signed RGB format.
   *
   */
  RGB_BPTC_SIGNED = 36494,

  /**
   * BPTC Unsigned RGB format.
   *
   */
  RGB_BPTC_UNSIGNED = 36495,

  /**
   * RGTC1 Red format.
   *
   */
  RED_RGTC1 = 36283,

  /**
   * RGTC1 Signed Red format.
   *
   */
  SIGNED_RED_RGTC1 = 36284,

  /**
   * RGTC2 Red Green format.
   *
   */
  RED_GREEN_RGTC2 = 36285,

  /**
   * RGTC2 Signed Red Green format.
   *
   */
  SIGNED_RED_GREEN_RGTC2 = 36286,
}

export const enum Loop {
  /**
   * Animations are played once.
   *
   */
  Once = 2200,

  /**
   * Animations are played with a chosen number of repetitions, each time jumping from
   * the end of the clip directly to its beginning.
   *
   */
  Repeat = 2201,

  /**
   * Animations are played with a chosen number of repetitions, alternately playing forward
   * and backward.
   *
   */
  PingPong = 2202,
}

export const enum Interpolation {
  /**
   * Discrete interpolation mode for keyframe tracks.
   *
   */
  Discrete = 2300,

  /**
   * Linear interpolation mode for keyframe tracks.
   *
   */
  Linear = 2301,

  /**
   * Smooth interpolation mode for keyframe tracks.
   *
   */
  Smooth = 2302,

  /**
   * Bezier interpolation mode for keyframe tracks.
   *
   * Uses cubic Bezier curves with explicit 2D control points.
   * Requires tangent data to be set on the track.
   *
   */
  Bezier = 2303,
}

export const enum EndingMode {
  /**
   * Zero curvature ending for animations.
   *
   */
  ZeroCurvature = 2400,

  /**
   * Zero slope ending for animations.
   *
   */
  ZeroSlope = 2401,

  /**
   * Wrap around ending for animations.
   *
   */
  WrapAround = 2402,
}

export const enum AnimationBlendMode {
  /**
   * Default animation blend mode.
   *
   */
  Normal = 2500,

  /**
   * Additive animation blend mode. Can be used to layer motions on top of
   * each other to build complex performances from smaller re-usable assets.
   *
   */
  Additive = 2501,
}

export const enum DrawMode {
  /**
   * For every three vertices draw a single triangle.
   *
   */
  Triangles = 0,

  /**
   * For each vertex draw a triangle from the last three vertices.
   *
   */
  TriangleStrip = 1,

  /**
   * For each vertex draw a triangle from the first vertex and the last two vertices.
   *
   */
  TriangleFan = 2,
}

export const enum DepthPacking {
  /**
   * The depth value is inverted (1.0 - z) for visualization purposes.
   *
   */
  Basic = 3200,

  /**
   * The depth value is packed into 32 bit RGBA.
   *
   */
  RGBA = 3201,

  /**
   * The depth value is packed into 24 bit RGB.
   *
   */
  RGB = 3202,

  /**
   * The depth value is packed into 16 bit RG.
   *
   */
  RG = 3203,
}

export const enum NormalMap {
  /**
   * Normal information is relative to the underlying surface.
   *
   */
  TangentSpace = 0,

  /**
   * Normal information is relative to the object orientation.
   *
   */
  ObjectSpace = 1,
}

export const enum ColorSpace {
  // Color space string identifiers, matching CSS Color Module Level 4.
  /**
   * No color space.
   *
   */
  No = "",

  /**
   * sRGB color space.
   *
   */
  SRGB = "srgb",

  /**
   * sRGB-linear color space.
   *
   */
  LinearSRGB = "srgb-linear",
}

export const enum Transfer {
  /**
   * Linear transfer function.
   *
   */
  Linear = "linear",

  /**
   * sRGB transfer function.
   *
   */
  SRGB = "srgb",
}

export const enum NormalPacking {
  /**
   * No normal map packing.
   *
   */
  No = "",

  /**
   * Normal RG packing.
   *
   */
  RG = "rg",

  /**
   * Normal GA packing.
   *
   */
  GA = "ga",
}

export const enum StencilOp {
  /**
   * Sets the stencil buffer value to `0`.
   *
   */
  Zero = 0,

  /**
   * Keeps the current value.
   *
   */
  Keep = 7680,

  /**
   * Sets the stencil buffer value to the specified reference value.
   *
   */
  Replace = 7681,

  /**
   * Increments the current stencil buffer value. Clamps to the maximum representable unsigned value.
   *
   */
  Increment = 7682,

  /**
   * Decrements the current stencil buffer value. Clamps to `0`.
   *
   */
  Decrement = 7683,

  /**
   * Increments the current stencil buffer value. Wraps stencil buffer value to zero when incrementing
   * the maximum representable unsigned value.
   *
   */
  IncrementWrap = 34055,

  /**
   * Decrements the current stencil buffer value. Wraps stencil buffer value to the maximum representable
   * unsigned value when decrementing a stencil buffer value of `0`.
   *
   */
  DecrementWrap = 34056,

  /**
   * Inverts the current stencil buffer value bitwise.
   *
   */
  Invert = 5386,
}

export const enum StencilFunc {
  /**
   * Will never return true.
   *
   */
  Never = 512,

  /**
   * Will return true if the stencil reference value is less than the current stencil value.
   *
   */
  Less = 513,

  /**
   * Will return true if the stencil reference value is equal to the current stencil value.
   *
   */
  Equal = 514,

  /**
   * Will return true if the stencil reference value is less than or equal to the current stencil value.
   *
   */
  LessEqual = 515,

  /**
   * Will return true if the stencil reference value is greater than the current stencil value.
   *
   */
  Greater = 516,

  /**
   * Will return true if the stencil reference value is not equal to the current stencil value.
   *
   */
  NotEqual = 517,

  /**
   * Will return true if the stencil reference value is greater than or equal to the current stencil value.
   *
   */
  GreaterEqual = 518,

  /**
   * Will always return true.
   *
   */
  Always = 519,
}

export const enum Compare {
  /**
   * Never pass.
   *
   */
  Never = 512,

  /**
   * Pass if the incoming value is less than the texture value.
   *
   */
  Less = 513,

  /**
   * Pass if the incoming value equals the texture value.
   *
   */
  Equal = 514,

  /**
   * Pass if the incoming value is less than or equal to the texture value.
   *
   */
  LessEqual = 515,

  /**
   * Pass if the incoming value is greater than the texture value.
   *
   */
  Greater = 516,

  /**
   * Pass if the incoming value is not equal to the texture value.
   *
   */
  NotEqual = 517,

  /**
   * Pass if the incoming value is greater than or equal to the texture value.
   *
   */
  GreaterEqual = 518,

  /**
   * Always pass.
   *
   */
  Always = 519,
}

export const enum BufferUsage {
  /**
   * The contents are intended to be specified once by the application, and used many
   * times as the source for drawing and image specification commands.
   *
   */
  StaticDraw = 35044,

  /**
   * The contents are intended to be respecified repeatedly by the application, and
   * used many times as the source for drawing and image specification commands.
   *
   */
  DynamicDraw = 35048,

  /**
   * The contents are intended to be specified once by the application, and used at most
   * a few times as the source for drawing and image specification commands.
   *
   */
  StreamDraw = 35040,

  /**
   * The contents are intended to be specified once by reading data from the 3D API, and queried
   * many times by the application.
   *
   */
  StaticRead = 35045,

  /**
   * The contents are intended to be respecified repeatedly by reading data from the 3D API, and queried
   * many times by the application.
   *
   */
  DynamicRead = 35049,

  /**
   * The contents are intended to be specified once by reading data from the 3D API, and queried at most
   * a few times by the application
   *
   */
  StreamRead = 35041,

  /**
   * The contents are intended to be specified once by reading data from the 3D API, and used many times as
   * the source for WebGL drawing and image specification commands.
   *
   */
  StaticCopy = 35046,

  /**
   * The contents are intended to be respecified repeatedly by reading data from the 3D API, and used many times
   * as the source for WebGL drawing and image specification commands.
   *
   */
  DynamicCopy = 35050,

  /**
   * The contents are intended to be specified once by reading data from the 3D API, and used at most a few times
   * as the source for WebGL drawing and image specification commands.
   *
   */
  StreamCopy = 35042,
}

export const enum GLSL {
  /**
   * GLSL 1 shader code.
   *
   */
  GLSL1 = "100",

  /**
   * GLSL 3 shader code.
   *
   */
  GLSL3 = "300 es",
}

export const enum CoordinateSystem {
  /**
   * WebGL coordinate system.
   *
   */
  WebGL = 2000,
}

/**
 * Represents mouse buttons and interaction types in context of controls.
 *
 */
export const enum InterpolationSamplingType {
  PERSPECTIVE = "perspective",
  LINEAR = "linear",
  FLAT = "flat",
}

/**
 * Represents the different interpolation sampling modes.
 *
 */
export const enum InterpolationSamplingMode {
  NORMAL = "normal",
  CENTROID = "centroid",
  SAMPLE = "sample",
  FIRST = "first",
  EITHER = "either",
}

/**
 * Compatibility flags for features that may not be supported across all platforms.
 *
 */
export const enum Compatibility {
  TEXTURE_COMPARE = "depthTextureCompare",
}

/**
 * Represents the refresh types of render objects.
 *
 */
export const enum RenderObjectRefreshType {
  NONE = 0,
  SHARED = 1,
  FULL = 2,
}
