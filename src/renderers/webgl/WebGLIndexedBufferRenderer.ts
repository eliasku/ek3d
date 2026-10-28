export function WebGLIndexedBufferRenderer(this: any, gl?: any, extensions?: any, info?: any) {
  let mode: any;
  function setMode(value?: any) {
    mode = value;
  }
  let type: any, bytesPerElement: any;
  function setIndex(value?: any) {
    type = value.type;
    bytesPerElement = value.bytesPerElement;
  }
  function render(start?: any, count?: any) {
    gl.drawElements(mode, count, type, start * bytesPerElement);
    info.update(count, mode, 1);
  }
  function renderInstances(start?: any, count?: any, primcount?: any) {
    if (primcount === 0) return;
    gl.drawElementsInstanced(mode, count, type, start * bytesPerElement, primcount);
    info.update(count, mode, primcount);
  }
  function renderMultiDraw(starts?: any, counts?: any, drawCount?: any) {
    if (drawCount === 0) return;
    const extension = extensions.get("WEBGL_multi_draw");
    extension.multiDrawElementsWEBGL(mode, counts, 0, type, starts, 0, drawCount);
    let elementCount = 0;
    for (let i = 0; i < drawCount; i++) {
      elementCount += counts[i];
    }
    info.update(elementCount, mode, 1);
  }
  //
  this.setMode = setMode;
  this.setIndex = setIndex;
  this.render = render;
  this.renderInstances = renderInstances;
  this.renderMultiDraw = renderMultiDraw;
}
