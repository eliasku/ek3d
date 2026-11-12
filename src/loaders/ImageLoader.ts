import type { LoadingManager } from "./LoadingManager";
import { Loader } from "./Loader";
import { createElementNS } from "../utils";
/**
 * A loader for loading images. The class loads images with the HTML `Image` API.
 *
 * ```typescript
 * import { ImageLoader } from 'ek3d/loaders/ImageLoader';
 *
 * const loader = new ImageLoader();
 * const image = await loader.loadAsync( 'image.png' );
 * ```
 * Please note that `ImageLoader` has dropped support for progress
 * events in `r84`. For an `ImageLoader` that supports progress events, see
 * [this thread](https://github.com/mrdoob/three.js/issues/10439#issuecomment-275785639).
 *
 */
export class ImageLoader extends Loader<HTMLImageElement, string> {
  /**
   * Constructs a new image loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }
  /**
   * Starts loading from the given URL and passes the loaded image
   * to the `onLoad()` callback. The method also returns a new `Image` object which can
   * directly be used for texture creation. If you do it this way, the texture
   * may pop up in your scene once the respective loading process is finished.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Unsupported in this loader.
   * @param onError - Executed when errors occur.
   * @return The image.
   */
  load(
    url: string,
    onLoad?: (value: HTMLImageElement) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): HTMLImageElement {
    const _loading = this.manager.imageRequests;
    if (this.path !== undefined) url = this.path + url;
    url = this.manager.resolveURL(url);
    const cached = this.manager.cache.get<HTMLImageElement>(`image:${url}`);
    if (cached !== undefined) {
      if (cached.complete === true) {
        this.manager.itemStart(url);
        setTimeout(() => {
          if (onLoad) onLoad(cached);
          this.manager.itemEnd(url);
        }, 0);
      } else {
        let arr = _loading.get(cached);
        if (arr === undefined) {
          arr = [];
          _loading.set(cached, arr);
        }
        arr.push({ onLoad, onError });
      }
      return cached;
    }
    const image = createElementNS("img") as HTMLImageElement;
    const onImageLoad = () => {
      removeEventListeners();
      if (onLoad) onLoad(image);
      //
      const callbacks = _loading.get(image) || [];
      for (let i = 0; i < callbacks.length; i++) {
        const callback = callbacks[i];
        if (callback.onLoad) callback.onLoad(image);
      }
      _loading.delete(image);
      this.manager.itemEnd(url);
    };
    const onImageError = (event: Event) => {
      removeEventListeners();
      if (onError) onError(event);
      this.manager.cache.remove(`image:${url}`);
      //
      const callbacks = _loading.get(image) || [];
      for (let i = 0; i < callbacks.length; i++) {
        const callback = callbacks[i];
        if (callback.onError) callback.onError(event);
      }
      _loading.delete(image);
      this.manager.itemError(url);
      this.manager.itemEnd(url);
    };
    function removeEventListeners() {
      image.removeEventListener("load", onImageLoad, false);
      image.removeEventListener("error", onImageError, false);
    }
    image.addEventListener("load", onImageLoad, false);
    image.addEventListener("error", onImageError, false);
    if (url.slice(0, 5) !== "data:") {
      if (this.crossOrigin !== undefined) (image as any).crossOrigin = this.crossOrigin;
    }
    this.manager.cache.add(`image:${url}`, image);
    this.manager.itemStart(url);
    (image as any).fetchPriority = this.priority;
    (image as any).src = url;
    return image;
  }
}
