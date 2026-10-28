export function WebGLBufferRenderer(this: any, gl?: any, extensions?: any, info?: any) {
  let mode: any;
  function setMode(value?: any) {
    mode = value;
  }
  function render(start?: any, count?: any) {
    gl.drawArrays(mode, start, count);
    info.update(count, mode, 1);
  }
  function renderInstances(start?: any, count?: any, primcount?: any) {
    if (primcount === 0) return;
    gl.drawArraysInstanced(mode, start, count, primcount);
    info.update(count, mode, primcount);
  }
  function renderMultiDraw(starts?: any, counts?: any, drawCount?: any) {
    if (drawCount === 0) return;
    const extension = extensions.get("WEBGL_multi_draw");
    extension.multiDrawArraysWEBGL(mode, starts, 0, counts, 0, drawCount);
    let elementCount = 0;
    for (let i = 0; i < drawCount; i++) {
      elementCount += counts[i];
    }
    info.update(elementCount, mode, 1);
  }
  //
  this.setMode = setMode;
  this.render = render;
  this.renderInstances = renderInstances;
  this.renderMultiDraw = renderMultiDraw;
}
