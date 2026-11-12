import type { AttributeBuffer } from "./WebGLAttributes";
import type { WebGLExtensions } from "./WebGLExtensions";
import type { WebGLInfoState } from "./WebGLInfo";

export class WebGLIndexedBufferRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly extensions: WebGLExtensions;
  private readonly info: WebGLInfoState;
  private mode: number = undefined!;
  private type: number = undefined!;
  private bytesPerElement: number = undefined!;

  constructor(gl: WebGL2RenderingContext, extensions: WebGLExtensions, info: WebGLInfoState) {
    this.gl = gl;
    this.extensions = extensions;
    this.info = info;
    this.setMode = this.setMode.bind(this);
    this.setIndex = this.setIndex.bind(this);
    this.render = this.render.bind(this);
    this.renderInstances = this.renderInstances.bind(this);
    this.renderMultiDraw = this.renderMultiDraw.bind(this);
  }

  setMode(value: number): void {
    this.mode = value;
  }

  setIndex(value: Pick<AttributeBuffer, "type" | "bytesPerElement">): void {
    this.type = value.type;
    this.bytesPerElement = value.bytesPerElement;
  }

  render(start: number, count: number): void {
    this.gl.drawElements(this.mode, count, this.type, start * this.bytesPerElement);
    this.info.update(count, this.mode, 1);
  }

  renderInstances(start: number, count: number, primcount: number): void {
    if (primcount === 0) return;
    this.gl.drawElementsInstanced(this.mode, count, this.type, start * this.bytesPerElement, primcount);
    this.info.update(count, this.mode, primcount);
  }

  renderMultiDraw(starts: Int32Array | number[], counts: Int32Array | number[], drawCount: number): void {
    if (drawCount === 0) return;
    const extension = this.extensions.get("WEBGL_multi_draw")!;
    extension.multiDrawElementsWEBGL(this.mode, counts, 0, this.type, starts, 0, drawCount);
    let elementCount = 0;
    for (let i = 0; i < drawCount; i++) {
      elementCount += counts[i];
    }
    this.info.update(elementCount, this.mode, 1);
  }
}
