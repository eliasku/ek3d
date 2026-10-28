export interface MaterialXZipRuntime {
  unzipSync(data: Uint8Array): Record<string, Uint8Array>;
}

const decoder = new TextDecoder();

function normalizePath(path: string): string {
  return path
    .split("\\")
    .join("/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "");
}

export function isZipBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function readMtlxArchive(
  buffer: ArrayBuffer | Uint8Array,
  zipRuntime: MaterialXZipRuntime,
): {
  text: string;
  mtlxPath: string;
  files: Map<string, Uint8Array>;
} {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const archive = zipRuntime.unzipSync(bytes);
  const files = new Map<string, Uint8Array>();
  let mtlxPath: string | null = null;
  for (const path in archive) {
    const normalized = normalizePath(path);
    files.set(normalized, archive[path]);
    if (normalized.toLowerCase().endsWith(".mtlx")) {
      if (mtlxPath !== null)
        throw new Error("THREE.MaterialXLoader: Invalid .mtlx.zip package. Exactly one .mtlx file is required.");
      mtlxPath = normalized;
    }
  }
  if (mtlxPath === null) throw new Error("THREE.MaterialXLoader: Invalid .mtlx.zip package. Missing .mtlx file.");
  return { text: decoder.decode(files.get(mtlxPath)), mtlxPath, files };
}

export function createArchiveResolver(files: Map<string, Uint8Array>): {
  resolve(uri: string): string | null;
  dispose(): void;
} {
  const cache = new Map<string, string>();
  function resolve(uri: string): string | null {
    const cached = cache.get(uri);
    if (cached !== undefined) return cached;
    const normalized = normalizePath(decodeURI(uri));
    let bytes = files.get(normalized);
    if (!bytes) {
      for (const [path, data] of files) {
        if (path.endsWith(normalized)) {
          bytes = data;
          break;
        }
      }
    }
    if (!bytes) return null;
    const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: "application/octet-stream" }));
    cache.set(uri, url);
    return url;
  }
  return {
    resolve,
    dispose() {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    },
  };
}
