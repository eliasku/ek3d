import type { UniformsGroup } from "../../core/UniformsGroup";
import type { WebGLRenderer } from "../WebGLRenderer";
import type { Texture } from "../../textures/Texture";
import type { ShaderMaterial } from "../../materials/ShaderMaterial";
import type { Color } from "../../math/Color";
import type { Matrix3 } from "../../math/Matrix3";
import type { Matrix4 } from "../../math/Matrix4";
import type { Quaternion } from "../../math/Quaternion";
import type { Vector2 } from "../../math/Vector2";
import type { Vector3 } from "../../math/Vector3";
import type { Vector4 } from "../../math/Vector4";
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
          target[p] = cloneUniformValue(property);
        }
      } else if (Array.isArray(property)) {
        if (isThreeObject(property[0])) {
          const values = property as CloneableUniformValue[];
          const clonedProperty: unknown[] = [];
          for (let i = 0, l = values.length; i < l; i++) {
            clonedProperty[i] = cloneUniformValue(values[i]);
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
function cloneUniformValue(value: CloneableUniformValue): unknown {
  if (value.isColor) return (value as Color).clone();
  if (value.isMatrix3) return (value as Matrix3).clone();
  if (value.isMatrix4) return (value as Matrix4).clone();
  if (value.isVector2) return (value as Vector2).clone();
  if (value.isVector3) return (value as Vector3).clone();
  if (value.isVector4) return (value as Vector4).clone();
  if (value.isQuaternion) return (value as Quaternion).clone();
  if (value.isTexture) return (value as Texture).clone();
  // Recognized arrays can also contain custom cloneable values.
  return value.clone();
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
export function getUnlitUniformColorSpace(renderer: WebGLRenderer) {
  const currentRenderTarget = renderer.getRenderTarget();
  if (currentRenderTarget === null) {
    // https://github.com/mrdoob/three.js/pull/23937#issuecomment-1111067398
    return renderer.outputColorSpace;
  }
  return ColorManagement.workingColorSpace;
}
