interface ZipRuntime {
  unzipSync(data: Uint8Array): Record<string, Uint8Array>;
}

/** Loads the example-owned fflate runtime without bundling it in the package. */
export async function loadZipRuntime(): Promise<ZipRuntime> {
  const response = await fetch("/examples/libs/fflate.module.js");
  if (!response.ok) throw new Error(`Unable to load fflate: HTTP ${response.status}`);
  const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  try {
    // Vite cannot statically import publicDir vendor assets.
    const runtime: unknown = await import(/* @vite-ignore */ url);
    if (
      typeof runtime !== "object" ||
      runtime === null ||
      !("unzipSync" in runtime) ||
      typeof runtime.unzipSync !== "function"
    ) {
      throw new Error("fflate runtime must export unzipSync");
    }
    return runtime as ZipRuntime;
  } finally {
    URL.revokeObjectURL(url);
  }
}
