/**
 * A class with loader utility functions.
 */
export class LoaderUtils {
  /**
   * Extracts the base URL from the given URL.
   *
   * @param url -The URL to extract the base URL from.
   * @return The extracted base URL.
   */
  static extractUrlBase(url: string): string {
    const index = url.lastIndexOf("/");
    if (index === -1) return "./";
    return url.slice(0, index + 1);
  }
  /**
   * Resolves relative URLs against the given path. Absolute paths, data urls,
   * and blob URLs will be returned as is. Invalid URLs will return an empty
   * string.
   *
   * @param url -The URL to resolve.
   * @param path - The base path for relative URLs to be resolved against.
   * @return The resolved URL.
   */
  static resolveURL(url: string, path: string): string {
    // Invalid URL
    if (typeof url !== "string" || url === "") return "";
    // Host Relative URL
    if (/^https?:\/\//i.test(path) && url.startsWith("/")) {
      path = path.replace(/(^https?:\/\/[^/]+).*/i, "$1");
    }
    // Absolute URL http://,https://,//
    if (/^(https?:)?\/\//i.test(url)) return url;
    // Data URI
    if (/^data:.*,.*$/i.test(url)) return url;
    // Blob URL
    if (/^blob:.*$/i.test(url)) return url;
    // Relative URL
    return path + url;
  }
}
