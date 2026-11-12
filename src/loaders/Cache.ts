/**
 * @class
 * @classdesc A simple caching system, used internally by {@link FileLoader}.
 * Each LoadingManager owns a cache. Enable it with `manager.cache.enabled = true`; clear it explicitly when releasing assets. Clearing does not close shared ImageBitmaps.
 */
export class Cache {
  enabled: boolean = false;
  files: Record<string, unknown> = Object.create(null);

  constructor() {}
  add(key: string, file: unknown): void {
    if (this.enabled === false) return;
    if (isBlobURL(key)) return;
    // log( 'Cache', 'Adding key:', key );
    this.files[key] = file;
  }
  get<T = unknown>(key: string): T | undefined {
    if (this.enabled === false) return;
    if (isBlobURL(key)) return;
    // log( 'Cache', 'Checking key:', key );
    return this.files[key] as T | undefined;
  }
  remove(key: string): void {
    delete this.files[key];
  }
  clear() {
    this.files = Object.create(null);
  }
}
/**
 * Returns true if the given cache key contains the blob: scheme.
 *
 * @private
 * @param key - The cache key.
 * @return Whether the given cache key contains the blob: scheme or not.
 */
function isBlobURL(key: string): boolean {
  try {
    const urlString = key.slice(key.indexOf(":") + 1); // remove type identifier
    const url = new URL(urlString);
    return url.protocol === "blob:";
  } catch {
    // If the string is not a valid URL, it throws an error
    return false;
  }
}
