import { warnOnce } from "../../utils";
export function WebGLExtensions(gl?: any) {
  const extensions: any = {};
  function getExtension(name?: any) {
    if ((extensions as any)[name] !== undefined) {
      return (extensions as any)[name];
    }
    const extension = gl.getExtension(name);
    (extensions as any)[name] = extension;
    return extension;
  }
  return {
    has: function (name?: any) {
      return getExtension(name) !== null;
    },
    init: function () {
      getExtension("EXT_color_buffer_float");
      getExtension("WEBGL_clip_cull_distance");
      getExtension("OES_texture_float_linear");
      getExtension("EXT_color_buffer_half_float");
      getExtension("WEBGL_multisampled_render_to_texture");
      getExtension("WEBGL_render_shared_exponent");
    },
    get: function (name?: any) {
      const extension = getExtension(name);
      if (extension === null) {
        warnOnce("WebGLRenderer: " + name + " extension not supported.");
      }
      return extension;
    },
  };
}
