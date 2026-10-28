import type { ZSTDDecoderLike } from "ek3d/addons/loaders/KTX2Loader";

/** Example-owned vendor runtime; package loaders never import or bundle it. */
export async function loadZstdDecoder(): Promise<ZSTDDecoderLike> {
  const response = await fetch("/examples/libs/zstddec.module.js");
  if (!response.ok) throw new Error(`Unable to load zstddec: HTTP ${response.status}`);
  const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  try {
    // Vite cannot statically import publicDir vendor assets; this Blob URL exists only at runtime.
    const runtime: unknown = await import(/* @vite-ignore */ url);
    if (
      typeof runtime !== "object" ||
      runtime === null ||
      !("ZSTDDecoder" in runtime) ||
      typeof runtime.ZSTDDecoder !== "function"
    ) {
      throw new Error("zstddec runtime must export ZSTDDecoder");
    }
    // The runtime is the unmodified upstream wrapper, so its constructor matches the loader contract
    // (same unchecked boundary cast as the fflate helper).
    const zstd = runtime as { ZSTDDecoder: new () => ZSTDDecoderLike };
    return new zstd.ZSTDDecoder();
  } finally {
    URL.revokeObjectURL(url);
  }
}
