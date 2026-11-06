import { expect, test, vi } from "vite-plus/test";
import { WebGLCapabilities } from "../src/renderers/webgl/WebGLCapabilities";

test("reversed depth takes precedence only when EXT_clip_control is available", () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const gl = { getShaderPrecisionFormat: () => ({ precision: 23 }), getParameter: () => 16 };
  try {
    for (const supported of [false, true]) {
      for (const requested of [false, true]) {
        const capabilities = WebGLCapabilities(
          gl,
          { has: (name: string) => name === "EXT_clip_control" && supported },
          { reversedDepthBuffer: requested, logarithmicDepthBuffer: true },
          {},
        );
        expect(capabilities.reversedDepthBuffer).toBe(requested && supported);
        expect(capabilities.logarithmicDepthBuffer).toBe(!(requested && supported));
      }
    }
  } finally {
    warning.mockRestore();
  }
});
