import type { UniformsGroup } from "../../core/UniformsGroup";
import type { Texture } from "../../textures/Texture";
import type { ShaderMaterial } from "../../materials/ShaderMaterial";
import { ColorManagement } from "../../math/ColorManagement";
import { warn } from "../../utils";

type ClonedUniformProperty<T> = T extends Texture ? T | null : T;

/** Cloned uniform properties retain their types; render-target textures become null. */
export type ClonedUniforms<T> = {
  [U in keyof T]: { [P in keyof T[U]]: ClonedUniformProperty<T[U][P]> };
};

type CloneableUniformValue = {
  clone(): unknown;
  isRenderTargetTexture?: boolean;
  isColor?: boolean;
  isMatrix3?: boolean;
  isMatrix4?: boolean;
  isVector2?: boolean;
  isVector3?: boolean;
  isVector4?: boolean;
  isTexture?: boolean;
  isQuaternion?: boolean;
};
/**
 * Provides utility functions for managing uniforms.
 *
 * @module UniformsUtils
 */
/**
 * Clones recognized math values and textures, and copies arrays.
 * Direct render-target texture properties become null; texture arrays are cloned normally.
 * Other nested objects and typed arrays remain shared.
 *
 * @param src - An object representing uniform definitions.
 * @return The cloned uniforms.
 */
export function cloneUniforms<T extends Record<string, object> = Record<string, never>>(src?: T): ClonedUniforms<T> {
  const dst: Record<string, Record<string, unknown>> = {};
  for (const u in src) {
    const target: Record<string, unknown> = {};
    dst[u] = target;
    const source = src[u] as Record<string, unknown>;
    for (const p in source) {
      const property = source[p];
      if (isThreeObject(property)) {
        if (property.isRenderTargetTexture) {
          warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().");
          target[p] = null;
        } else {
          target[p] = property.clone();
        }
      } else if (Array.isArray(property)) {
        if (isThreeObject(property[0])) {
          const values = property as CloneableUniformValue[];
          const clonedProperty: unknown[] = [];
          for (let i = 0, l = values.length; i < l; i++) {
            clonedProperty[i] = values[i].clone();
          }
          target[p] = clonedProperty;
        } else {
          target[p] = property.slice();
        }
      } else {
        target[p] = property;
      }
    }
  }
  return dst as ClonedUniforms<T>;
}
/**
 * Merges the given uniform definitions into a single object. Since the
 * method internally uses cloneUniforms(), it performs a deep-copy when
 * producing the merged uniform definitions.
 *
 * @param uniforms - An array of objects containing uniform definitions.
 * @return The merged uniforms.
 */
export function mergeUniforms(uniforms: ShaderMaterial["uniforms"][]): ShaderMaterial["uniforms"] {
  const merged: ShaderMaterial["uniforms"] = {};
  for (let u = 0; u < uniforms.length; u++) {
    const tmp = cloneUniforms(uniforms[u]);
    for (const p in tmp) {
      merged[p] = tmp[p];
    }
  }
  return merged;
}
function isThreeObject(property: unknown): property is CloneableUniformValue {
  const value = property as CloneableUniformValue | null | undefined;
  return !!(
    value &&
    (value.isColor ||
      value.isMatrix3 ||
      value.isMatrix4 ||
      value.isVector2 ||
      value.isVector3 ||
      value.isVector4 ||
      value.isTexture ||
      value.isQuaternion)
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
