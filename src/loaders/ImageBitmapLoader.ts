import type { LoadingManager } from "./LoadingManager";
import { Loader } from "./Loader";
import { warn } from "../utils";
/**
 * A loader for loading images as an [ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap).
 * An `ImageBitmap` provides an asynchronous and resource efficient pathway to prepare
 * textures for rendering.
 *
 * Note that {@link Texture#flipY} and {@link Texture#premultiplyAlpha} are ignored with image bitmaps.
 * These options need to be configured via {@link ImageBitmapLoader#setOptions} prior to loading,
 * unlike regular images which can be configured on the Texture to set these options on GPU upload instead.
 *
 * To match the default behaviour of {@link Texture}, the following options are needed:
 *
 * ```typescript
 * const options: ImageBitmapOptions = { imageOrientation: 'flipY', premultiplyAlpha: 'none' };
 * ```
 *
 * Also note that unlike {@link FileLoader}, this loader will only avoid multiple concurrent requests to the same URL if {@link Cache} is enabled.
 *
 * ```typescript
 * import { ImageBitmapLoader } from 'ek3d/loaders/ImageBitmapLoader';
 * import { Texture } from 'ek3d/textures/Texture';
 *
 * const loader = new ImageBitmapLoader();
 * loader.setOptions( { imageOrientation: 'flipY' } ); // set options if needed
 * const imageBitmap = await loader.loadAsync( 'image.png' );
 *
 * const texture = new Texture( imageBitmap );
 * texture.needsUpdate = true;
 * ```
 *
 */
export class ImageBitmapLoader extends Loader<ImageBitmap, string> {
  isImageBitmapLoader: boolean;
  options: ImageBitmapOptions;
  _abortController: AbortController;

  /**
   * Constructs a new image bitmap loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isImageBitmapLoader = true;
    if (typeof createImageBitmap === "undefined") {
      warn("ImageBitmapLoader: createImageBitmap() not supported.");
    }
    if (typeof fetch === "undefined") {
      warn("ImageBitmapLoader: fetch() not supported.");
    }
    /**
     * Represents the loader options.
     *
     * @default {premultiplyAlpha:'none'}
     */
    this.options = { premultiplyAlpha: "none" };
    /**
     * Used for aborting requests.
     *
     * @private
     */
    this._abortController = new AbortController();
  }
  /**
   * Sets the given loader options. The structure of the object must match the `options` parameter of
   * [createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap).
   *
   * Note: When caching is enabled, the cache key is based on the URL only. Loading the same URL with
   * different options will return the cached result of the first request.
   *
   * @param options - The loader options to set.
   * @return A reference to this image bitmap loader.
   */
  setOptions(options: ImageBitmapOptions): this {
    this.options = options;
    return this;
  }
  /**
   * Starts loading from the given URL and pass the loaded image bitmap to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Unsupported in this loader.
   * @param onError - Executed when errors occur.
   */
  load(
    url: string,
    onLoad?: (value: ImageBitmap) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const _errorMap = this.manager.bitmapErrors;
    if (url === undefined) url = "";
    if (this.path !== undefined) url = this.path + url;
    url = this.manager.resolveURL(url);
    const cached = this.manager.cache.get<ImageBitmap | Promise<ImageBitmap | void>>(`image-bitmap:${url}`);
    if (cached !== undefined) {
      this.manager.itemStart(url);
      // If cached is a promise, wait for it to resolve
      if ("then" in cached) {
        cached.then(
          (imageBitmap) => {
            // check if there is an error for the cached promise
            if (_errorMap.has(cached) === true) {
              if (onError) onError(_errorMap.get(cached));
              this.manager.itemError(url);
              this.manager.itemEnd(url);
            } else {
              if (onLoad) onLoad(imageBitmap as ImageBitmap);
              this.manager.itemEnd(url);
            }
          },
          (error: unknown) => {
            this.manager.cache.remove(`image-bitmap:${url}`);
            if (onError) onError(error);
            this.manager.itemError(url);
            this.manager.itemEnd(url);
          },
        );
        return;
      }
      // If cached is not a promise (i.e., it's already an imageBitmap)
      setTimeout(() => {
        if (onLoad) onLoad(cached);
        this.manager.itemEnd(url);
      }, 0);
      return;
    }
    const fetchOptions: RequestInit = {};
    fetchOptions.credentials = this.withCredentials || this.crossOrigin !== "anonymous" ? "include" : "same-origin";
    fetchOptions.headers = this.requestHeader;
    fetchOptions.priority = this.priority;
    fetchOptions.cache = this.cache;
    fetchOptions.signal =
      typeof AbortSignal.any === "function"
        ? AbortSignal.any([this._abortController.signal, this.manager.abortController.signal])
        : this._abortController.signal;
    const promise = fetch(url, fetchOptions)
      .then(function (res?: any) {
        return res.blob();
      })
      .then((blob: Blob) => {
        return createImageBitmap(blob, Object.assign({}, this.options, { colorSpaceConversion: "none" }));
      })
      .then((imageBitmap: ImageBitmap) => {
        this.manager.cache.add(`image-bitmap:${url}`, imageBitmap);
        if (onLoad) onLoad(imageBitmap as ImageBitmap);
        this.manager.itemEnd(url);
        return imageBitmap; // see #34150
      })
      .catch((e: unknown) => {
        if (onError) onError(e);
        _errorMap.set(promise, e);
        this.manager.cache.remove(`image-bitmap:${url}`);
        this.manager.itemError(url);
        this.manager.itemEnd(url);
      });
    this.manager.cache.add(`image-bitmap:${url}`, promise);
    this.manager.itemStart(url);
  }
  /**
   * Aborts ongoing fetch requests.
   *
   * @return A reference to this instance.
   */
  abort(): this {
    this._abortController.abort();
    this._abortController = new AbortController();
    return this;
  }
}
