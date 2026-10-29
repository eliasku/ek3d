import type { Loader } from "./Loader";
import { Cache } from "./Cache";
/**
 * Owns loading progress, the optional resource cache, and in-flight requests.
 * Loaders share state only when explicitly supplied the same manager.
 *
 * In general that should be sufficient, however there are times when it can
 * be useful to have separate loaders - for example if you want to show
 * separate loading bars for objects and textures.
 *
 * ```ts
 * import { FileLoader } from 'ek3d/loaders/FileLoader';
 * import { LoadingManager } from 'ek3d/loaders/LoadingManager';
 * import { TextureLoader } from 'ek3d/loaders/TextureLoader';
 *
 * const manager = new LoadingManager();
 * manager.onLoad = () => console.log( 'Loading complete!' );
 *
 * const loader1 = new FileLoader( manager );
 * const loader2 = new TextureLoader( manager );
 * ```
 */
export class LoadingManager {
  cache: Cache;
  fileRequests: Record<
    string,
    {
      onLoad?: (value: unknown) => void;
      onProgress?: (event: ProgressEvent) => void;
      onError?: (error: unknown) => void;
    }[]
  >;
  imageRequests: WeakMap<
    HTMLImageElement,
    { onLoad?: (image: HTMLImageElement) => void; onError?: (error: Event) => void }[]
  >;
  bitmapErrors: WeakMap<Promise<unknown>, unknown>;
  onStart: ((url: string, loaded: number, total: number) => void) | undefined;
  onLoad: (() => void) | undefined;
  onProgress: ((url: string, loaded: number, total: number) => void) | undefined;
  onError: ((url: string) => void) | undefined;
  _abortController: AbortController | null;
  itemStart: (url: string) => void;
  itemEnd: (url: string) => void;
  itemError: (url: string) => void;
  resolveURL: (url: string) => string;
  setURLModifier: (transform: (url: string) => string) => LoadingManager;
  addHandler: (regex: RegExp, loader: Loader) => LoadingManager;
  removeHandler: (regex: RegExp) => LoadingManager;
  getHandler: (file: string) => Loader | null;
  abort: () => LoadingManager;

  /**
   * Constructs a new loading manager.
   *
   * @param [onLoad] - Executes when all items have been loaded.
   * @param [onProgress] - Executes when single items have been loaded.
   * @param [onError] - Executes when an error occurs.
   */
  constructor(
    onLoad?: () => void,
    onProgress?: (url: string, loaded: number, total: number) => void,
    onError?: (url: string) => void,
  ) {
    this.cache = new Cache();
    this.fileRequests = Object.create(null);
    this.imageRequests = new WeakMap();
    this.bitmapErrors = new WeakMap();
    let isLoading = false;
    let itemsLoaded = 0;
    let itemsTotal = 0;
    let urlModifier: ((url: string) => string) | undefined = undefined;
    const handlers: any[] = [];
    // Refer to #5689 for the reason why we don't set .onStart
    // in the constructor
    /**
     * Executes when an item starts loading.
     *
     * @default undefined
     */
    this.onStart = undefined;
    /**
     * Executes when all items have been loaded.
     *
     * @default undefined
     */
    this.onLoad = onLoad;
    /**
     * Executes when single items have been loaded.
     *
     * @default undefined
     */
    this.onProgress = onProgress;
    /**
     * Executes when an error occurs.
     *
     * @default undefined
     */
    this.onError = onError;
    /**
     * Used for aborting ongoing requests in loaders using this manager.
     *
     * @private
     */
    this._abortController = null;
    /**
     * This should be called by any loader using the manager when the loader
     * starts loading an item.
     *
     * @param url - The URL to load.
     */
    this.itemStart = (url: string) => {
      itemsTotal++;
      if (isLoading === false) {
        if (this.onStart !== undefined) {
          this.onStart(url, itemsLoaded, itemsTotal);
        }
      }
      isLoading = true;
    };
    /**
     * This should be called by any loader using the manager when the loader
     * ended loading an item.
     *
     * @param url - The URL of the loaded item.
     */
    this.itemEnd = (url: string) => {
      itemsLoaded++;
      if (this.onProgress !== undefined) {
        this.onProgress(url, itemsLoaded, itemsTotal);
      }
      if (itemsLoaded === itemsTotal) {
        isLoading = false;
        if (this.onLoad !== undefined) {
          this.onLoad();
        }
      }
    };
    /**
     * This should be called by any loader using the manager when the loader
     * encounters an error when loading an item.
     *
     * @param url - The URL of the item that produces an error.
     */
    this.itemError = (url: string) => {
      if (this.onError !== undefined) {
        this.onError(url);
      }
    };
    /**
     * Given a URL, uses the URL modifier callback (if any) and returns a
     * resolved URL. If no URL modifier is set, returns the original URL.
     *
     * @param url - The URL to load.
     * @return The resolved URL.
     */
    this.resolveURL = function (url: string): string {
      // Normalize to NFC so that Unicode URIs (e.g. from glTF)
      // are percent-encoded correctly per RFC 3987.
      url = url.normalize("NFC");
      if (urlModifier) {
        return urlModifier(url);
      }
      return url;
    };
    /**
     * If provided, the callback will be passed each resource URL before a
     * request is sent. The callback may return the original URL, or a new URL to
     * override loading behavior. This behavior can be used to load assets from
     * .ZIP files, drag-and-drop APIs, and Data URIs.
     *
     * ```ts
     * import { FileLoader } from 'ek3d/loaders/FileLoader';
     * import { LoadingManager } from 'ek3d/loaders/LoadingManager';
     *
     * const blobs: Record<string, Blob> = {
     *   'message.txt': new Blob( [ 'Hello from an in-memory asset.' ], { type: 'text/plain' } ),
     * };
     * const manager = new LoadingManager();
     * const objectURLs: string[] = [];
     * manager.setURLModifier( ( url ) => {
     *   const blob = blobs[ url ];
     *   if ( blob === undefined ) return url;
     *   const objectURL = URL.createObjectURL( blob );
     *   objectURLs.push( objectURL );
     *   return objectURL;
     * } );
     *
     * try {
     *   const text = await new FileLoader( manager ).loadAsync( 'message.txt' );
     *   console.log( text );
     * } finally {
     *   objectURLs.forEach( ( url ) => URL.revokeObjectURL( url ) );
     * }
     * ```
     *
     * @param transform - URL modifier callback. Called with an URL and must return a resolved URL.
     * @return A reference to this loading manager.
     */
    this.setURLModifier = function (this: LoadingManager, transform: (url: string) => string): LoadingManager {
      urlModifier = transform;
      return this;
    };
    /**
     * Registers a loader with the given regular expression. Can be used to
     * define what loader should be used in order to load specific files. A
     * typical use case is to overwrite the default loader for textures.
     *
     * ```ts
     * import { LoadingManager } from 'ek3d/loaders/LoadingManager';
     * import { TextureLoader } from 'ek3d/loaders/TextureLoader';
     *
     * const manager = new LoadingManager();
     * manager.addHandler( /\.png$/i, new TextureLoader( manager ) );
     * ```
     *
     * @param regex - A regular expression.
     * @param loader - A loader that should handle matched cases.
     * @return A reference to this loading manager.
     */
    this.addHandler = function (this: LoadingManager, regex: RegExp, loader: Loader): LoadingManager {
      handlers.push(regex, loader);
      return this;
    };
    /**
     * Removes the loader for the given regular expression.
     *
     * @param regex - A regular expression.
     * @return A reference to this loading manager.
     */
    this.removeHandler = function (this: LoadingManager, regex: RegExp): LoadingManager {
      const index = handlers.indexOf(regex);
      if (index !== -1) {
        handlers.splice(index, 2);
      }
      return this;
    };
    /**
     * Can be used to retrieve the registered loader for the given file path.
     *
     * @param file - The file path.
     * @return The registered loader. Returns `null` if no loader was found.
     */
    this.getHandler = function (file: string): Loader | null {
      for (let i = 0, l = handlers.length; i < l; i += 2) {
        const regex = handlers[i];
        const loader = handlers[i + 1];
        if (regex.global) regex.lastIndex = 0; // see #17920
        if (regex.test(file)) {
          return loader;
        }
      }
      return null;
    };
    /**
     * Can be used to abort ongoing loading requests in loaders using this manager.
     * The abort only works if the loaders implement {@link Loader#abort} and `AbortSignal.any()`
     * is supported in the browser.
     *
     * @return A reference to this loading manager.
     */
    this.abort = function (this: any): LoadingManager {
      (this as any).abortController.abort();
      this._abortController = null;
      return this;
    };
  }
  // TODO: Revert this back to a single member variable once this issue has been fixed
  // https://github.com/cloudflare/workerd/issues/3657
  /**
   * Used for aborting ongoing requests in loaders using this manager.
   *
   */
  get abortController() {
    if (!this._abortController) {
      this._abortController = new AbortController();
    }
    return this._abortController;
  }
}
