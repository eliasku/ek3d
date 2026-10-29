import { TextureFilter, Mapping, Wrapping, PixelFormat, TextureType } from "../constants";
import { Texture } from "./Texture";
/**
 * A texture for use with a video.
 *
 * ```ts
 * import { VideoTexture } from 'ek3d/textures/VideoTexture';
 *
 * // Assuming you have created an HTML video element with id="video".
 * const video = document.getElementById( 'video' );
 * if ( video instanceof HTMLVideoElement ) {
 * 	const texture = new VideoTexture( video );
 * }
 * ```
 *
 * Note: After the initial use of a texture, its dimensions, format, and type
 * cannot be changed. Instead, call {@link Texture#dispose} on the texture and instantiate a new one.
 *
 */
export class VideoTexture extends Texture {
  isVideoTexture: boolean;
  _requestVideoFrameCallbackId: number;

  /**
   * Constructs a new video texture.
   *
   * @param video - The video element to use as a data source for the texture.
   * @param [mapping=Texture.DEFAULT_MAPPING] - The texture mapping.
   * @param [wrapS=Wrapping.ClampToEdge] - The wrapS value.
   * @param [wrapT=Wrapping.ClampToEdge] - The wrapT value.
   * @param [magFilter=TextureFilter.Linear] - The mag filter value.
   * @param [minFilter=TextureFilter.Linear] - The min filter value.
   * @param [format=PixelFormat.RGBA] - The texture format.
   * @param [type=TextureType.UnsignedByte] - The texture type.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   */
  constructor(
    video: HTMLVideoElement,
    mapping?: Mapping,
    wrapS?: Wrapping,
    wrapT?: Wrapping,
    magFilter: TextureFilter = TextureFilter.Linear,
    minFilter: TextureFilter = TextureFilter.Linear,
    format?: PixelFormat,
    type?: TextureType,
    anisotropy?: number,
  ) {
    super(video, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isVideoTexture = true;
    /**
     * Whether to generate mipmaps (if possible) for a texture.
     *
     * Overwritten and set to `false` by default.
     *
     * @default false
     */
    this.generateMipmaps = false;
    /**
     * The video frame request callback identifier, which is a positive integer.
     *
     * Value of 0 represents no scheduled rVFC.
     *
     * @private
     */
    this._requestVideoFrameCallbackId = 0;
    const updateVideo = () => {
      this.needsUpdate = true;
      this._requestVideoFrameCallbackId = video.requestVideoFrameCallback(updateVideo);
    };
    if ("requestVideoFrameCallback" in video) {
      this._requestVideoFrameCallbackId = video.requestVideoFrameCallback(updateVideo);
    }
  }
  clone(): this {
    return new (this.constructor as any)(this.image).copy(this);
  }
  /**
   * This method is called automatically by the renderer and sets {@link Texture#needsUpdate}
   * to `true` every time a new frame is available.
   *
   * Only relevant if `requestVideoFrameCallback` is not supported in the browser.
   */
  update() {
    const video = this.image;
    const hasVideoFrameCallback = "requestVideoFrameCallback" in video;
    if (hasVideoFrameCallback === false && video.readyState >= video.HAVE_CURRENT_DATA) {
      this.needsUpdate = true;
    }
  }
  dispose() {
    if (this._requestVideoFrameCallbackId !== 0) {
      this.source.data.cancelVideoFrameCallback(this._requestVideoFrameCallbackId);
      this._requestVideoFrameCallbackId = 0;
    }
    super.dispose();
  }
}
