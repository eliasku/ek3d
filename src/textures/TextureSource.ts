import type { Vector2 } from "../math/Vector2";
import type { Vector3 } from "../math/Vector3";
import { ImageUtils } from "../extras/ImageUtils";
import { generateUUID } from "../math/MathUtils";
import { warn, warnOnce } from "../utils";
let _sourceId = 0;
/**
 * Represents the data source of a texture.
 *
 * The main purpose of this class is to decouple the data definition from the texture
 * definition so the same data can be used with multiple texture instances.
 */
export class TextureSource {
  isTextureSource: boolean;
  uuid: string;
  data: any;
  dataReady: boolean;
  version: number;
  readonly id: number;

  /**
   * Constructs a new texture source.
   *
   * @param [data=null] - The data definition of a texture.
   */
  constructor(data: any = null) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isTextureSource = true;
    /**
     * The ID of the source.
     *
     * @name TextureSource#id
     * @readonly
     */
    Object.defineProperty(this, "id", {
      value: (this.id = _sourceId++),
      writable: false,
      enumerable: false,
      configurable: false,
    });
    /**
     * The UUID of the source.
     *
     * @readonly
     */
    this.uuid = generateUUID();
    /**
     * The data definition of a texture.
     *
     */
    this.data = data;
    /**
     * This property is only relevant when {@link TextureSource#needsUpdate} is set to `true` and
     * provides more control on how texture data should be processed. When `dataReady` is set
     * to `false`, the engine performs the memory allocation (if necessary) but does not transfer
     * the data into the GPU memory.
     *
     * @default true
     */
    this.dataReady = true;
    /**
     * This starts at `0` and counts how many times {@link TextureSource#needsUpdate} is set to `true`.
     *
     * @readonly
     * @default 0
     */
    this.version = 0;
  }
  /**
   * Returns the dimensions of the source into the given target vector.
   *
   * @param target - The target object the result is written into.
   * @return The dimensions of the source.
   */
  getSize<T extends Vector2 | Vector3>(target: T): T;
  getSize(target?: any): any {
    const data = this.data;
    if (typeof HTMLVideoElement !== "undefined" && data instanceof HTMLVideoElement) {
      target.set(data.videoWidth, data.videoHeight, 0);
    } else if (typeof VideoFrame !== "undefined" && data instanceof VideoFrame) {
      target.set(data.displayWidth, data.displayHeight, 0);
    } else if (data !== null) {
      target.set(data.width || 0, data.height || 0, data.depth || 0);
    } else {
      target.set(0, 0, 0);
    }
    return target;
  }
  /**
   * When the property is set to `true`, the engine allocates the memory
   * for the texture (if necessary) and triggers the actual texture upload
   * to the GPU next time the source is used.
   *
   * @default false
   * @param value
   */
  set needsUpdate(value: boolean) {
    if (value === true) this.version++;
  }
  /**
   * Serializes the source into JSON.
   *
   * @param meta - An optional value holding meta information about the serialization.
   * @return A JSON object representing the serialized source.
   * @see {@link ObjectLoader#parse}
   */
  toJSON(meta?: any) {
    const isRootObject = meta === undefined || typeof meta === "string";
    if (!isRootObject && meta.images[this.uuid] !== undefined) {
      return meta.images[this.uuid];
    }
    const output: any = {
      uuid: this.uuid,
      url: "",
    };
    const data = this.data;
    if (data !== null) {
      let url: any;
      if (Array.isArray(data)) {
        // cube texture
        url = [];
        for (let i = 0, l = data.length; i < l; i++) {
          if (data[i].isDataTexture) {
            url.push(serializeImage(data[i].image));
          } else {
            url.push(serializeImage(data[i]));
          }
        }
      } else {
        // texture
        url = serializeImage(data);
      }
      output.url = url;
    }
    if (!isRootObject) {
      meta.images[this.uuid] = output;
    }
    return output;
  }
}
function serializeImage(image?: any) {
  if (
    (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) ||
    (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
  ) {
    // default images
    return ImageUtils.getDataURL(image);
  } else {
    if (image.data) {
      // images of DataTexture
      return {
        data: Array.from(image.data),
        width: image.width,
        height: image.height,
        type: image.data.constructor.name,
      };
    } else {
      warn("Texture: Unable to serialize Texture.");
      return {};
    }
  }
}
/**
 * @deprecated since r186. Use {@link TextureSource} instead. `Source` has been renamed to `TextureSource`.
 */
export class Source extends TextureSource {
  isSource: boolean;

  /**
   * Constructs a new texture source.
   *
   * @param [data=null] - The data definition of a texture.
   * @deprecated since r186. Use {@link TextureSource} instead.
   */
  constructor(data: any = null) {
    warnOnce(
      'Source: "Source" has been renamed to "TextureSource". Please update your code to use "THREE.TextureSource" instead.',
    ); // @deprecated, r186
    super(data);
    /**
     * This flag can be used for type testing.
     *
     * @deprecated since r186. Use {@link TextureSource#isTextureSource} instead.
     * @readonly
     * @default true
     */
    this.isSource = true;
  }
}
