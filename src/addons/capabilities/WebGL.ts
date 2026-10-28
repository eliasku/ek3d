/** Basic WebGL 2 capability testing. */
export class WebGL {
  static isWebGL2Available(): boolean {
    try {
      const canvas = document.createElement("canvas");
      return !!(window.WebGL2RenderingContext && canvas.getContext("webgl2"));
    } catch {
      return false;
    }
  }

  /** Tests drawing-buffer color space support, not display hardware gamut. */
  static isColorSpaceAvailable(colorSpace: string): boolean {
    try {
      const ctx = window.WebGL2RenderingContext && document.createElement("canvas").getContext("webgl2");
      if (!ctx) return false;
      ctx.drawingBufferColorSpace = colorSpace as PredefinedColorSpace;
      return ctx.drawingBufferColorSpace === colorSpace;
    } catch {
      return false;
    }
  }

  static getWebGL2ErrorMessage(): HTMLDivElement {
    return this._getErrorMessage(2);
  }

  static _getErrorMessage(version: 1 | 2): HTMLDivElement {
    const name = version === 1 ? "WebGL" : "WebGL 2";
    const context = version === 1 ? window.WebGLRenderingContext : window.WebGL2RenderingContext;
    const element = document.createElement("div");
    element.id = "webglmessage";
    Object.assign(element.style, {
      fontFamily: "monospace",
      fontSize: "13px",
      fontWeight: "normal",
      textAlign: "center",
      background: "#fff",
      color: "#000",
      padding: "1.5em",
      width: "400px",
      margin: "5em auto 0",
    });
    element.innerHTML = `Your ${context ? "graphics card" : "browser"} does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">${name}</a>`;
    return element;
  }
}
