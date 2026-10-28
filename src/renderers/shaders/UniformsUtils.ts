import type { UniformsGroup } from "../../core/UniformsGroup";
import { ColorManagement } from "../../math/ColorManagement";
import { warn } from "../../utils";
/**
 * Provides utility functions for managing uniforms.
 *
 * @module UniformsUtils
 */
/**
 * Clones the given uniform definitions by performing a deep-copy. That means
 * if the value of a uniform refers to an object like a Vector3 or Texture,
 * the cloned uniform will refer to a new object reference.
 *
 * @param src - An object representing uniform definitions.
 * @return The cloned uniforms.
 */
export function cloneUniforms(src?: any) {
  const dst: any = {};
  for (const u in src) {
    (dst as any)[u] = {};
    for (const p in src[u]) {
      const property = src[u][p];
      if (isThreeObject(property)) {
        if (property.isRenderTargetTexture) {
          warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().");
          (dst as any)[u][p] = null;
        } else {
          (dst as any)[u][p] = property.clone();
        }
      } else if (Array.isArray(property)) {
        if (isThreeObject(property[0])) {
          const clonedProperty: any[] = [];
          for (let i = 0, l = property.length; i < l; i++) {
            clonedProperty[i] = property[i].clone();
          }
          (dst as any)[u][p] = clonedProperty;
        } else {
          (dst as any)[u][p] = property.slice();
        }
      } else {
        (dst as any)[u][p] = property;
      }
    }
  }
  return dst;
}
/**
 * Merges the given uniform definitions into a single object. Since the
 * method internally uses cloneUniforms(), it performs a deep-copy when
 * producing the merged uniform definitions.
 *
 * @param uniforms - An array of objects containing uniform definitions.
 * @return The merged uniforms.
 */
export function mergeUniforms(uniforms: any[]) {
  const merged: any = {};
  for (let u = 0; u < uniforms.length; u++) {
    const tmp = cloneUniforms(uniforms[u]);
    for (const p in tmp) {
      (merged as any)[p] = tmp[p];
    }
  }
  return merged;
}
function isThreeObject(property?: any) {
  return (
    property &&
    (property.isColor ||
      property.isMatrix3 ||
      property.isMatrix4 ||
      property.isVector2 ||
      property.isVector3 ||
      property.isVector4 ||
      property.isTexture ||
      property.isQuaternion)
  );
}
export function cloneUniformsGroups(src: UniformsGroup[]): UniformsGroup[] {
  const dst: UniformsGroup[] = [];
  for (let u = 0; u < src.length; u++) {
    dst.push(src[u].clone());
  }
  return dst;
}
export function getUnlitUniformColorSpace(renderer?: any) {
  const currentRenderTarget = renderer.getRenderTarget();
  if (currentRenderTarget === null) {
    // https://github.com/mrdoob/three.js/pull/23937#issuecomment-1111067398
    return renderer.outputColorSpace;
  }
  return ColorManagement.workingColorSpace;
}
