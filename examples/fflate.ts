/** Example-owned vendor runtime; package loaders never import or bundle it. */
export async function loadZlibDecoder(): Promise<{ unzlibSync(data: Uint8Array): Uint8Array }> {
  const response = await fetch("/examples/libs/fflate.module.js");
  if (!response.ok) throw new Error(`Unable to load fflate: HTTP ${response.status}`);
  const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  try {
    // Vite cannot statically import publicDir vendor assets; this Blob URL exists only at runtime.
    const runtime: unknown = await import(/* @vite-ignore */ url);
    if (
      typeof runtime !== "object" ||
      runtime === null ||
      !("unzlibSync" in runtime) ||
      typeof runtime.unzlibSync !== "function"
    ) {
      throw new Error("fflate runtime must export unzlibSync");
    }
    return runtime as { unzlibSync(data: Uint8Array): Uint8Array };
  } finally {
    URL.revokeObjectURL(url);
  }
}
