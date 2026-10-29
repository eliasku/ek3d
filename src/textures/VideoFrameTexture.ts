import { Mapping, Wrapping, TextureFilter, PixelFormat, TextureType } from "../constants";
import { VideoTexture } from "./VideoTexture";
/**
 * This class can be used as an alternative way to define video data. Instead of using
 * an instance of `HTMLVideoElement` like with `VideoTexture`, `VideoFrameTexture` expects each frame is
 * defined manually via {@link VideoFrameTexture#setFrame}. A typical use case for this module is when
 * video frames are decoded with the WebCodecs API.
 *
 * ```ts
 * import { VideoFrameTexture } from 'ek3d/textures/VideoFrameTexture';
 *
 * const texture = new VideoFrameTexture();
 * function updateFrame( frame: VideoFrame ) {
 * 	texture.setFrame( frame );
 * }
 * ```
 *
 */
export class VideoFrameTexture extends VideoTexture {
  isVideoFrameTexture: boolean;

  /**
   * Constructs a new video frame texture.
   *
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
    mapping?: Mapping,
    wrapS?: Wrapping,
    wrapT?: Wrapping,
    magFilter?: TextureFilter,
    minFilter?: TextureFilter,
    format?: PixelFormat,
    type?: TextureType,
    anisotropy?: number,
  ) {
    super({} as HTMLVideoElement, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isVideoFrameTexture = true;
  }
  /**
   * This method overwritten with an empty implementation since
   * this type of texture is updated via `setFrame()`.
   */
  update() {}
  clone(): this {
    return new (this.constructor as any)().copy(this); // restoring Texture.clone()
  }
  /**
   * Sets the current frame of the video. This will automatically update the texture
   * so the data can be used for rendering.
   *
   * @param frame - The video frame.
   */
  setFrame(frame?: VideoFrame) {
    this.image = frame;
    this.needsUpdate = true;
  }
}
