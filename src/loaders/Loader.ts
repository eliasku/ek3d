import { LoadingManager } from "./LoadingManager";
/**
 * Abstract base class for loaders.
 *
 * @abstract
 */
export abstract class Loader<T = unknown, U = string> {
  manager: LoadingManager;
  crossOrigin: string;
  withCredentials: boolean;
  path: string;
  resourcePath: string;
  requestHeader: Record<string, string>;
  priority: "high" | "low" | "auto";
  cache: RequestCache;
  /**
   * The default material name used when creating materials for loaded objects.
   * Not all loaders honor this setting.
   */
  static DEFAULT_MATERIAL_NAME: string = "__DEFAULT";

  /**
   * Constructs a new loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    /**
     * The loading manager.
     *
     * @default A new LoadingManager instance
     */
    this.manager = manager !== undefined ? manager : new LoadingManager();
    /**
     * The crossOrigin string to implement CORS for loading the url from a
     * different domain that allows CORS.
     *
     * @default 'anonymous'
     */
    this.crossOrigin = "anonymous";
    /**
     * Whether the XMLHttpRequest uses credentials.
     *
     * @default false
     */
    this.withCredentials = false;
    /**
     * The base path from which the asset will be loaded.
     *
     */
    this.path = "";
    /**
     * The base path from which additional resources like textures will be loaded.
     *
     */
    this.resourcePath = "";
    /**
     * The [request header](https://developer.mozilla.org/en-US/docs/Glossary/Request_header)
     * used in HTTP request.
     *
     */
    this.requestHeader = {};
    /**
     * The request priority hint. Image loaders use `HTMLImageElement.fetchPriority`.
     *
     * @default 'auto'
     */
    this.priority = "auto";
    /**
     * The HTTP cache mode passed to `fetch()`. This does not affect {@link Cache}
     * or loaders using `HTMLImageElement`.
     *
     * @default 'default'
     */
    this.cache = "default";
  }
  /**
   * This method needs to be implemented by all concrete loaders. It holds the
   * logic for loading assets from the backend.
   *
   * @abstract
   * @param url - The path/URL of the file to be loaded.
   * @param onLoad - Executed when the loading process has been finished.
   * @param [onProgress] - Executed while the loading is in progress.
   * @param [onError] - Executed when errors occur.
   */
  abstract load(
    url: U,
    onLoad?: (value: T) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): unknown;
  /**
   * A async version of {@link Loader#load}.
   *
   * @param url - The path/URL of the file to be loaded.
   * @param [onProgress] - Executed while the loading is in progress.
   * @return A Promise that resolves when the asset has been loaded.
   */
  loadAsync(url: U, onProgress?: (event: ProgressEvent) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.load(url, resolve, onProgress, reject);
    });
  }
  /**
   * Sets the `crossOrigin` String to implement CORS for loading the URL
   * from a different domain that allows CORS.
   *
   * @param crossOrigin - The `crossOrigin` value.
   * @return A reference to this instance.
   */
  setCrossOrigin(crossOrigin: string): this {
    this.crossOrigin = crossOrigin;
    return this;
  }
  /**
   * Whether the XMLHttpRequest uses credentials such as cookies, authorization
   * headers or TLS client certificates, see [XMLHttpRequest.withCredentials](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials).
   *
   * Note: This setting has no effect if you are loading files locally or from the same domain.
   *
   * @param value - The `withCredentials` value.
   * @return A reference to this instance.
   */
  setWithCredentials(value: boolean): this {
    this.withCredentials = value;
    return this;
  }
  /**
   * Sets the base path for the asset.
   *
   * @param path - The base path.
   * @return A reference to this instance.
   */
  setPath(path: string): this {
    this.path = path;
    return this;
  }
  /**
   * Sets the base path for dependent resources like textures.
   *
   * @param resourcePath - The resource path.
   * @return A reference to this instance.
   */
  setResourcePath(resourcePath: string): this {
    this.resourcePath = resourcePath;
    return this;
  }
  /**
   * Sets the given request header.
   *
   * @param requestHeader - A [request header](https://developer.mozilla.org/en-US/docs/Glossary/Request_header)
   * for configuring the HTTP request.
   * @return A reference to this instance.
   */
  setRequestHeader(requestHeader: Record<string, string>): this {
    this.requestHeader = requestHeader;
    return this;
  }
  /**
   * Sets a browser scheduling hint. Browsers may ignore this hint.
   * Internally created loaders inherit it. Loaders supplied by the application
   * (for example decoder loaders or loading manager handlers) retain their own settings.
   *
   * @param value - The request priority hint.
   * @return A reference to this instance.
   */
  setPriority(value: "high" | "low" | "auto"): this {
    this.priority = value;
    return this;
  }
  /**
   * Sets the HTTP cache mode for fetch requests. `no-cache` revalidates cached
   * responses; `no-store` bypasses the HTTP cache. This does not affect
   * {@link Cache} or image element requests.
   *
   * @param value - The HTTP cache mode.
   * @return A reference to this instance.
   */
  setCache(value: RequestCache): this {
    this.cache = value;
    return this;
  }
  /**
   * This method can be implemented in loaders for aborting ongoing requests.
   *
   * @abstract
   * @return A reference to this instance.
   */
  abort(): this {
    return this;
  }
}
