import type { LoadingManager } from "./LoadingManager";
import { Loader } from "./Loader";
import { warn } from "../utils";
class HttpError extends Error {
  response: Response;

  constructor(message: string, response: Response) {
    super(message);
    this.response = response;
  }
}
/**
 * A low level class for loading resources with the Fetch API, used internally by
 * most loaders. It can also be used directly to load any file type that does
 * not have a loader.
 *
 * This loader supports caching. If you want to use it, set `manager.cache.enabled = true;`
 * once to your application.
 *
 * ```ts
 * import { FileLoader } from 'ek3d/loaders/FileLoader';
 *
 * const loader = new FileLoader();
 * const data = await loader.loadAsync( 'example.txt' );
 * ```
 *
 */
export class FileLoader extends Loader<unknown, string> {
  mimeType: string;
  responseType: string;
  _abortController: AbortController;

  /**
   * Constructs a new file loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
    /**
     * The expected mime type. Valid values can be found
     * [here](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString#mimetype)
     *
     */
    this.mimeType = "";
    /**
     * The expected response type.
     *
     * @default ''
     */
    this.responseType = "";
    /**
     * Used for aborting requests.
     *
     * @private
     */
    this._abortController = new AbortController();
  }
  /**
   * Starts loading from the given URL and pass the loaded response to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param [onProgress] - Executed while the loading is in progress.
   * @param [onError] - Executed when errors occur.
   */
  load(
    url: string,
    onLoad?: (value: unknown) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loading = this.manager.fileRequests;
    if (url === undefined) url = "";
    if (this.path !== undefined) url = this.path + url;
    url = this.manager.resolveURL(url);
    const cached = this.manager.cache.get(`file:${url}`);
    if (cached !== undefined) {
      this.manager.itemStart(url);
      setTimeout(() => {
        if (onLoad) onLoad(cached);
        this.manager.itemEnd(url);
      }, 0);
      return;
    }
    // Check if request is duplicate
    if (loading[url] !== undefined) {
      loading[url].push({
        onLoad: onLoad,
        onProgress: onProgress,
        onError: onError,
      });
      return;
    }
    // Initialise array for duplicate requests
    loading[url] = [];
    loading[url].push({
      onLoad: onLoad,
      onProgress: onProgress,
      onError: onError,
    });
    // create request
    const req = new Request(url, {
      headers: new Headers(this.requestHeader),
      credentials: this.withCredentials ? "include" : "same-origin",
      priority: this.priority,
      cache: this.cache,
      signal:
        typeof AbortSignal.any === "function"
          ? AbortSignal.any([this._abortController.signal, this.manager.abortController.signal])
          : this._abortController.signal,
    });
    // record states ( avoid data race )
    const mimeType = this.mimeType;
    const responseType = this.responseType;
    // start the fetch
    fetch(req)
      .then((response?: any) => {
        if (response.status === 200 || response.status === 0) {
          // Some browsers return HTTP Status 0 when using non-http protocol
          // e.g. 'file://' or 'data://'. Handle as success.
          if (response.status === 0) {
            warn("FileLoader: HTTP Status 0 received.");
          }
          // Workaround: Checking if response.body === undefined for Alipay browser #23548
          if (
            typeof ReadableStream === "undefined" ||
            response.body === undefined ||
            response.body.getReader === undefined
          ) {
            return response;
          }
          const callbacks = loading[url];
          const reader = response.body.getReader();
          // Nginx needs X-File-Size check
          // https://serverfault.com/questions/482875/why-does-nginx-remove-content-length-header-for-chunked-content
          const contentLength = response.headers.get("X-File-Size") || response.headers.get("Content-Length");
          const total = contentLength ? parseInt(contentLength) : 0;
          const lengthComputable = total !== 0;
          let loaded = 0;
          // periodically read data into the new stream tracking while download progress
          const stream = new ReadableStream({
            start(controller?: any) {
              readData();
              function readData() {
                reader.read().then(
                  ({ done, value }: any) => {
                    if (done) {
                      controller.close();
                    } else {
                      loaded += value.byteLength;
                      const event = new ProgressEvent("progress", { lengthComputable, loaded, total });
                      for (let i = 0, il = callbacks.length; i < il; i++) {
                        const callback = callbacks[i];
                        if (callback.onProgress) callback.onProgress(event);
                      }
                      controller.enqueue(value);
                      readData();
                    }
                  },
                  (e?: any) => {
                    controller.error(e);
                  },
                );
              }
            },
          });
          return new Response(stream);
        } else {
          throw new HttpError(
            `fetch for "${response.url}" responded with ${response.status}: ${response.statusText}`,
            response,
          );
        }
      })
      .then((response?: any) => {
        switch (responseType) {
          case "arraybuffer":
            return response.arrayBuffer();
          case "blob":
            return response.blob();
          case "document":
            return response.text().then((text: string) => {
              const parser = new DOMParser();
              return parser.parseFromString(text, mimeType as DOMParserSupportedType);
            });
          case "json":
            return response.json();
          default:
            if (mimeType === "") {
              return response.text();
            } else {
              // sniff encoding
              const re = /charset="?([^;"\s]*)"?/i;
              const exec = re.exec(mimeType);
              const label = exec && (exec as any)[1] ? (exec as any)[1].toLowerCase() : undefined;
              const decoder = new TextDecoder(label);
              return response.arrayBuffer().then((ab: ArrayBuffer) => decoder.decode(ab));
            }
        }
      })
      .then((data?: any) => {
        // Add to cache only on HTTP success, so that we do not cache
        // error response bodies as proper responses to requests.
        this.manager.cache.add(`file:${url}`, data);
        const callbacks = loading[url];
        delete loading[url];
        for (let i = 0, il = callbacks.length; i < il; i++) {
          const callback = callbacks[i];
          if (callback.onLoad) callback.onLoad(data);
        }
      })
      .catch((err?: any) => {
        // Abort errors and other errors are handled the same
        const callbacks = loading[url];
        if (callbacks === undefined) {
          // When onLoad was called and url was deleted in `loading`
          this.manager.itemError(url);
          throw err;
        }
        delete loading[url];
        for (let i = 0, il = callbacks.length; i < il; i++) {
          const callback = callbacks[i];
          if (callback.onError) callback.onError(err);
        }
        this.manager.itemError(url);
      })
      .finally(() => {
        this.manager.itemEnd(url);
      });
    this.manager.itemStart(url);
  }
  /**
   * Sets the expected response type.
   *
   * @param value - The response type.
   * @return A reference to this file loader.
   */
  setResponseType(value?: any): this {
    this.responseType = value;
    return this;
  }
  /**
   * Sets the expected mime type of the loaded file.
   *
   * @param value - The mime type.
   * @return A reference to this file loader.
   */
  setMimeType(value: string): this {
    this.mimeType = value;
    return this;
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
