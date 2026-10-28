export async function loadExporterRuntime<T>(path: string, required: string[]): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load exporter runtime: HTTP ${response.status}`);
  const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  try {
    // Public vendor assets are loaded at runtime rather than bundled by Vite.
    const runtime: unknown = await import(/* @vite-ignore */ url);
    if (typeof runtime !== "object" || runtime === null || required.some((name) => !(name in runtime))) {
      throw new Error(`Invalid exporter runtime: ${path}`);
    }
    return runtime as T;
  } finally {
    URL.revokeObjectURL(url);
  }
}
