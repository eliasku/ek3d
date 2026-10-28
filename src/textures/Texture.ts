import type { RenderTarget } from "../core/RenderTarget";
import type { WebGLRenderTarget } from "../renderers/WebGLRenderTarget";
import { EventDispatcher } from "../core/EventDispatcher";
import {
  MirroredRepeatWrapping,
  ClampToEdgeWrapping,
  RepeatWrapping,
  UnsignedByteType,
  RGBAFormat,
  LinearMipmapLinearFilter,
  LinearFilter,
  UVMapping,
  NoColorSpace,
} from "../constants";
import { generateUUID } from "../math/MathUtils";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";
import { Matrix3 } from "../math/Matrix3";
import { TextureSource } from "./TextureSource";
import { warn } from "../utils";
let _textureId = 0;
const _tempVec3 = /*@__PURE__*/ new Vector3();
/**
 * Base class for all textures.
 *
 * Note: After the initial use of a texture, its dimensions, format, and type
 * cannot be changed. Instead, call {@link Texture#dispose} on the texture and instantiate a new one.
 *
 */
export class Texture<TMipmap = any> extends EventDispatcher {
  isTexture: boolean;
  uuid: string;
  name: string;
  source: TextureSource;
  mipmaps: TMipmap[];
  mapping: number;
  channel: number;
  wrapS: number;
  wrapT: number;
  magFilter: number;
  minFilter: number;
  anisotropy: number;
  format: number;
  internalFormat: string | null;
  type: number;
  offset: Vector2;
  repeat: Vector2;
  center: Vector2;
  rotation: number;
  matrixAutoUpdate: boolean;
  matrix: Matrix3;
  generateMipmaps: boolean;
  mipmapsAutoUpdate: boolean;
  premultiplyAlpha: boolean;
  flipY: boolean;
  unpackAlignment: number;
  colorSpace: string;
  userData: any;
  updateRanges: { start: number; count: number }[];
  version: number;
  onUpdate: ((...args: any[]) => any) | null;
  renderTarget: (RenderTarget | WebGLRenderTarget) | null;
  isRenderTargetTexture: boolean;
  isArrayTexture: boolean;
  pmremVersion: number;
  isPMREMTexture: boolean;
  normalized: boolean;
  readonly id: number;
  static DEFAULT_IMAGE: null;
  static DEFAULT_MAPPING: number;
  static DEFAULT_ANISOTROPY: number;

  /**
   * Constructs a new texture.
   *
   * @param [image=Texture.DEFAULT_IMAGE] - The image holding the texture data.
   * @param [mapping=Texture.DEFAULT_MAPPING] - The texture mapping.
   * @param [wrapS=ClampToEdgeWrapping] - The wrapS value.
   * @param [wrapT=ClampToEdgeWrapping] - The wrapT value.
   * @param [magFilter=LinearFilter] - The mag filter value.
   * @param [minFilter=LinearMipmapLinearFilter] - The min filter value.
   * @param [format=RGBAFormat] - The texture format.
   * @param [type=UnsignedByteType] - The texture type.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param [colorSpace=NoColorSpace] - The color space.
   */
  constructor(
    image: any = Texture.DEFAULT_IMAGE,
    mapping: number = Texture.DEFAULT_MAPPING,
    wrapS: number = ClampToEdgeWrapping,
    wrapT: number = ClampToEdgeWrapping,
    magFilter: number = LinearFilter,
    minFilter: number = LinearMipmapLinearFilter,
    format: number = RGBAFormat,
    type: number = UnsignedByteType,
    anisotropy: number = Texture.DEFAULT_ANISOTROPY,
    colorSpace: string = NoColorSpace,
  ) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isTexture = true;
    /**
     * The ID of the texture.
     *
     * @name Texture#id
     * @readonly
     */
    Object.defineProperty(this, "id", {
      value: (this.id = _textureId++),
      writable: false,
      enumerable: false,
      configurable: false,
    });
    /**
     * The UUID of the texture.
     *
     * @readonly
     */
    this.uuid = generateUUID();
    /**
     * The name of the texture.
     *
     */
    this.name = "";
    /**
     * The data definition of a texture. A reference to the data source can be
     * shared across textures. This is often useful in context of spritesheets
     * where multiple textures render the same data but with different texture
     * transformations.
     *
     */
    this.source = new TextureSource(image);
    /**
     * An array holding user-defined mipmaps.
     *
     */
    this.mipmaps = [];
    /**
     * How the texture is applied to the object. The value `UVMapping`
     * is the default, where texture or uv coordinates are used to apply the map.
     *
     * @default UVMapping
     */
    this.mapping = mapping;
    /**
     * Lets you select the uv attribute to map the texture to. `0` for `uv`,
     * `1` for `uv1`, `2` for `uv2` and `3` for `uv3`.
     *
     * @default 0
     */
    this.channel = 0;
    /**
     * This defines how the texture is wrapped horizontally and corresponds to
     * *U* in UV mapping.
     *
     * @default ClampToEdgeWrapping
     */
    this.wrapS = wrapS;
    /**
     * This defines how the texture is wrapped horizontally and corresponds to
     * *V* in UV mapping.
     *
     * @default ClampToEdgeWrapping
     */
    this.wrapT = wrapT;
    /**
     * How the texture is sampled when a texel covers more than one pixel.
     *
     * @default LinearFilter
     */
    this.magFilter = magFilter;
    /**
     * How the texture is sampled when a texel covers less than one pixel.
     *
     * @default LinearMipmapLinearFilter
     */
    this.minFilter = minFilter;
    /**
     * The number of samples taken along the axis through the pixel that has the
     * highest density of texels. By default, this value is `1`. A higher value
     * gives a less blurry result than a basic mipmap, at the cost of more
     * texture samples being used.
     *
     * @default Texture.DEFAULT_ANISOTROPY
     */
    this.anisotropy = anisotropy;
    /**
     * The format of the texture.
     *
     * @default RGBAFormat
     */
    this.format = format;
    /**
     * The default internal format is derived from {@link Texture#format} and {@link Texture#type} and
     * defines how the texture data is going to be stored on the GPU.
     *
     * This property allows to overwrite the default format.
     *
     * @default null
     */
    this.internalFormat = null;
    /**
     * The data type of the texture.
     *
     * @default UnsignedByteType
     */
    this.type = type;
    /**
     * How much a single repetition of the texture is offset from the beginning,
     * in each direction U and V. Typical range is `0.0` to `1.0`.
     *
     * @default (0,0)
     */
    this.offset = new Vector2(0, 0);
    /**
     * How many times the texture is repeated across the surface, in each
     * direction U and V. If repeat is set greater than `1` in either direction,
     * the corresponding wrap parameter should also be set to `RepeatWrapping`
     * or `MirroredRepeatWrapping` to achieve the desired tiling effect.
     *
     * @default (1,1)
     */
    this.repeat = new Vector2(1, 1);
    /**
     * The point around which rotation occurs. A value of `(0.5, 0.5)` corresponds
     * to the center of the texture. Default is `(0, 0)`, the lower left.
     *
     * @default (0,0)
     */
    this.center = new Vector2(0, 0);
    /**
     * How much the texture is rotated around the center point, in radians.
     * Positive values are counter-clockwise.
     *
     * @default 0
     */
    this.rotation = 0;
    /**
     * Whether to update the texture's uv-transformation {@link Texture#matrix}
     * from the properties {@link Texture#offset}, {@link Texture#repeat},
     * {@link Texture#rotation}, and {@link Texture#center}.
     *
     * Set this to `false` if you are specifying the uv-transform matrix directly.
     *
     * @default true
     */
    this.matrixAutoUpdate = true;
    /**
     * The uv-transformation matrix of the texture.
     *
     */
    this.matrix = new Matrix3();
    /**
     * Whether to generate mipmaps (if possible) for a texture.
     *
     * Set this to `false` if you are creating mipmaps manually.
     *
     * @default true
     */
    this.generateMipmaps = true;
    /**
     * Whether the renderer regenerates the mipmaps automatically whenever the
     * texture is uploaded, rendered to or copied into. Set this to `false` to
     * pause the regeneration and write the mip levels yourself. Requires
     * {@link Texture#generateMipmaps}.
     *
     * @default true
     */
    this.mipmapsAutoUpdate = true;
    /**
     * If set to `true`, the alpha channel, if present, is multiplied into the
     * color channels when the texture is uploaded to the GPU.
     *
     * Note that this property has no effect when using `ImageBitmap`. You need to
     * configure premultiply alpha on bitmap creation instead.
     *
     * @default false
     */
    this.premultiplyAlpha = false;
    /**
     * If set to `true`, the texture is flipped along the vertical axis when
     * uploaded to the GPU.
     *
     * Note that this property has no effect when using `ImageBitmap`. You need to
     * configure the flip on bitmap creation instead.
     *
     * @default true
     */
    this.flipY = true;
    /**
     * Specifies the alignment requirements for the start of each pixel row in memory.
     * The allowable values are `1` (byte-alignment), `2` (rows aligned to even-numbered bytes),
     * `4` (word-alignment), and `8` (rows start on double-word boundaries).
     *
     * @default 4
     */
    this.unpackAlignment = 4; // valid values: 1, 2, 4, 8 (see http://www.khronos.org/opengles/sdk/docs/man/xhtml/glPixelStorei.xml)
    /**
     * Textures containing color data should be annotated with `SRGBColorSpace` or `LinearSRGBColorSpace`.
     *
     * @default NoColorSpace
     */
    this.colorSpace = colorSpace;
    /**
     * An object that can be used to store custom data about the texture. It
     * should not hold references to functions as these will not be cloned.
     *
     */
    this.userData = {};
    /**
     * This can be used to only update a subregion or specific rows of the texture (for example, just the
     * first 3 rows). Use the `addUpdateRange()` function to add ranges to this array.
     *
     */
    this.updateRanges = [];
    /**
     * This starts at `0` and counts how many times {@link Texture#needsUpdate} is set to `true`.
     *
     * @readonly
     * @default 0
     */
    this.version = 0;
    /**
     * A callback function, called when the texture is updated (e.g., when
     * {@link Texture#needsUpdate} has been set to true and then the texture is used).
     *
     * @default null
     */
    this.onUpdate = null;
    /**
     * An optional back reference to the textures render target.
     *
     * @default null
     */
    this.renderTarget = null;
    /**
     * Indicates whether a texture belongs to a render target or not.
     *
     * @readonly
     * @default false
     */
    this.isRenderTargetTexture = false;
    /**
     * Indicates if a texture should be handled like a texture array.
     *
     * @readonly
     * @default false
     */
    this.isArrayTexture = image && image.depth && image.depth > 1 ? true : false;
    /**
     * Indicates whether this texture should be processed by `PMREMGenerator` or not
     * (only relevant for render target textures).
     *
     * @readonly
     * @default 0
     */
    this.pmremVersion = 0;
    /**
     * Indicates whether this texture is a prefiltered cube environment map generated
     * by {@link PMREMGenerator}.
     *
     * @readonly
     * @default false
     */
    this.isPMREMTexture = false;
    /**
     * Whether the texture should use one of the 16 bit integer formats which are normalized
     * to [0, 1] or [-1, 1] (depending on signed/unsigned) when sampled.
     *
     * @default false
     */
    this.normalized = false;
  }
  /**
   * The width of the texture in pixels.
   */
  get width() {
    return this.source.getSize(_tempVec3).x;
  }
  /**
   * The height of the texture in pixels.
   */
  get height() {
    return this.source.getSize(_tempVec3).y;
  }
  /**
   * The depth of the texture in pixels.
   */
  get depth() {
    return this.source.getSize(_tempVec3).z;
  }
  /**
   * The image object holding the texture data.
   *
   */
  get image(): any {
    return this.source.data;
  }
  set image(value: any) {
    this.source.data = value;
  }
  /**
   * Updates the texture transformation matrix from the properties {@link Texture#offset},
   * {@link Texture#repeat}, {@link Texture#rotation}, and {@link Texture#center}.
   */
  updateMatrix() {
    this.matrix.setUvTransform(
      this.offset.x,
      this.offset.y,
      this.repeat.x,
      this.repeat.y,
      this.rotation,
      this.center.x,
      this.center.y,
    );
  }
  /**
   * Adds a range of data in the data texture to be updated on the GPU.
   *
   * @param start - Position at which to start update.
   * @param count - The number of components to update.
   */
  addUpdateRange(start: number, count: number) {
    this.updateRanges.push({ start, count });
  }
  /**
   * Clears the update ranges.
   */
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  /**
   * Returns a new texture with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): this {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Copies the values of the given texture to this instance.
   *
   * @param source - The texture to copy.
   * @return A reference to this instance.
   */
  copy(source: Texture & Pick<this, "image" | "mipmaps">): this {
    this.name = source.name;
    this.source = source.source;
    this.mipmaps = source.mipmaps.slice(0);
    this.mapping = source.mapping;
    this.channel = source.channel;
    this.wrapS = source.wrapS;
    this.wrapT = source.wrapT;
    this.magFilter = source.magFilter;
    this.minFilter = source.minFilter;
    this.anisotropy = source.anisotropy;
    this.format = source.format;
    this.internalFormat = source.internalFormat;
    this.type = source.type;
    this.normalized = source.normalized;
    this.offset.copy(source.offset);
    this.repeat.copy(source.repeat);
    this.center.copy(source.center);
    this.rotation = source.rotation;
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    this.matrix.copy(source.matrix);
    this.generateMipmaps = source.generateMipmaps;
    this.mipmapsAutoUpdate = source.mipmapsAutoUpdate;
    this.premultiplyAlpha = source.premultiplyAlpha;
    this.flipY = source.flipY;
    this.unpackAlignment = source.unpackAlignment;
    this.colorSpace = source.colorSpace;
    this.renderTarget = source.renderTarget;
    this.isRenderTargetTexture = source.isRenderTargetTexture;
    this.isPMREMTexture = source.isPMREMTexture;
    this.isArrayTexture = source.isArrayTexture;
    this.userData = JSON.parse(JSON.stringify(source.userData));
    this.needsUpdate = true;
    return this;
  }
  /**
   * Sets this texture's properties based on `values`.
   * @param values - A container with texture parameters.
   */
  setValues(values?: any) {
    for (const key in values) {
      const newValue = values[key];
      if (newValue === undefined) {
        warn(`Texture.setValues(): parameter '${key}' has value of undefined.`);
        continue;
      }
      const currentValue = (this as any)[key];
      if (currentValue === undefined) {
        warn(`Texture.setValues(): property '${key}' does not exist.`);
        continue;
      }
      if (currentValue && newValue && currentValue.isVector2 && newValue.isVector2) {
        currentValue.copy(newValue);
      } else if (currentValue && newValue && currentValue.isVector3 && newValue.isVector3) {
        currentValue.copy(newValue);
      } else if (currentValue && newValue && currentValue.isMatrix3 && newValue.isMatrix3) {
        currentValue.copy(newValue);
      } else {
        (this as any)[key] = newValue;
      }
    }
  }
  /**
   * Serializes the texture into JSON.
   *
   * @param meta - An optional value holding meta information about the serialization.
   * @return A JSON object representing the serialized texture.
   * @see {@link ObjectLoader#parse}
   */
  toJSON(meta?: any) {
    const isRootObject = meta === undefined || typeof meta === "string";
    if (!isRootObject && meta.textures[this.uuid] !== undefined) {
      return meta.textures[this.uuid];
    }
    const output: any = {
      metadata: {
        version: 4.7,
        type: "Texture",
        generator: "Texture.toJSON",
      },
      uuid: this.uuid,
      name: this.name,
      image: this.source.toJSON(meta).uuid,
      mapping: this.mapping,
      channel: this.channel,
      repeat: [this.repeat.x, this.repeat.y],
      offset: [this.offset.x, this.offset.y],
      center: [this.center.x, this.center.y],
      rotation: this.rotation,
      wrap: [this.wrapS, this.wrapT],
      format: this.format,
      internalFormat: this.internalFormat,
      type: this.type,
      normalized: this.normalized,
      colorSpace: this.colorSpace,
      minFilter: this.minFilter,
      magFilter: this.magFilter,
      anisotropy: this.anisotropy,
      flipY: this.flipY,
      generateMipmaps: this.generateMipmaps,
      mipmapsAutoUpdate: this.mipmapsAutoUpdate,
      premultiplyAlpha: this.premultiplyAlpha,
      unpackAlignment: this.unpackAlignment,
    };
    if (Object.keys(this.userData).length > 0) (output as any).userData = this.userData;
    if (!isRootObject) {
      meta.textures[this.uuid] = output;
    }
    return output;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   *
   * Textures that belong to a render target are managed by the render target.
   * Calling this method on such a texture only dispatches the dispose event but
   * does not free any GPU resources. Use {@link RenderTarget#dispose} instead.
   *
   * @fires Texture#dispose
   */
  dispose() {
    /**
     * Fires when the texture has been disposed of.
     *
     * @event Texture#dispose
     */
    this.dispatchEvent({ type: "dispose" });
  }
  /**
   * Transforms the given uv vector with the textures uv transformation matrix.
   *
   * @param uv - The uv vector.
   * @return The transformed uv vector.
   */
  transformUv(uv: Vector2): Vector2 {
    if (this.mapping !== UVMapping) return uv;
    uv.applyMatrix3(this.matrix);
    if (uv.x < 0 || uv.x > 1) {
      switch (this.wrapS) {
        case RepeatWrapping:
          uv.x = uv.x - Math.floor(uv.x);
          break;
        case ClampToEdgeWrapping:
          uv.x = uv.x < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          if (Math.abs(Math.floor(uv.x) % 2) === 1) {
            uv.x = Math.ceil(uv.x) - uv.x;
          } else {
            uv.x = uv.x - Math.floor(uv.x);
          }
          break;
      }
    }
    if (uv.y < 0 || uv.y > 1) {
      switch (this.wrapT) {
        case RepeatWrapping:
          uv.y = uv.y - Math.floor(uv.y);
          break;
        case ClampToEdgeWrapping:
          uv.y = uv.y < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          if (Math.abs(Math.floor(uv.y) % 2) === 1) {
            uv.y = Math.ceil(uv.y) - uv.y;
          } else {
            uv.y = uv.y - Math.floor(uv.y);
          }
          break;
      }
    }
    if (this.flipY) {
      uv.y = 1 - uv.y;
    }
    return uv;
  }
  /**
   * Setting this property to `true` indicates the engine the texture
   * must be updated in the next render. This triggers a texture upload
   * to the GPU and ensures correct texture parameter configuration.
   *
   * @default false
   * @param value
   */
  set needsUpdate(value: boolean) {
    if (value === true) {
      this.version++;
      this.source.needsUpdate = true;
    }
  }
  /**
   * Setting this property to `true` indicates the engine the PMREM
   * must be regenerated.
   *
   * @default false
   * @param value
   */
  set needsPMREMUpdate(value: boolean) {
    if (value === true) {
      this.pmremVersion++;
    }
  }
}
/**
 * The default image for all textures.
 *
 * @static
 * @default null
 */
Texture.DEFAULT_IMAGE = null;
/**
 * The default mapping for all textures.
 *
 * @static
 * @default UVMapping
 */
Texture.DEFAULT_MAPPING = UVMapping;
/**
 * The default anisotropy value for all textures.
 *
 * @static
 * @default 1
 */
Texture.DEFAULT_ANISOTROPY = 1;
