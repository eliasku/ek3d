import { expect, test, vi } from "vite-plus/test";
import { WebGLCapabilities } from "../src/renderers/webgl/WebGLCapabilities";
import { WebGLExtensions } from "../src/renderers/webgl/WebGLExtensions";
import { WebGLUtils } from "../src/renderers/webgl/WebGLUtils";

test("reversed depth takes precedence only when EXT_clip_control is available", () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    for (const supported of [false, true]) {
      const gl = {
        getShaderPrecisionFormat: (_shaderType: GLenum, _precisionType: GLenum) => ({
          rangeMin: 127,
          rangeMax: 127,
          precision: 23,
        }),
        getParameter: (_pname: GLenum) => 16,
        getExtension: (name: string) => (name === "EXT_clip_control" && supported ? {} : null),
      } as WebGL2RenderingContext;
      const extensions = new WebGLExtensions(gl);
      const utils = new WebGLUtils(gl, extensions);
      for (const requested of [false, true]) {
        const capabilities = new WebGLCapabilities(
          gl,
          extensions,
          { reversedDepthBuffer: requested, logarithmicDepthBuffer: true },
          utils,
        );
        expect(capabilities.reversedDepthBuffer).toBe(requested && supported);
        expect(capabilities.logarithmicDepthBuffer).toBe(!(requested && supported));
      }
    }
  } finally {
    warning.mockRestore();
  }
});
