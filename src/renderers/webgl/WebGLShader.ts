export function WebGLShader(gl?: any, type?: any, string?: any) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, string);
  gl.compileShader(shader);
  return shader;
}
