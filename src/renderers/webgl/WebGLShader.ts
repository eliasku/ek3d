export function WebGLShader(gl: WebGL2RenderingContext, type: number, string: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, string);
  gl.compileShader(shader);
  return shader;
}
