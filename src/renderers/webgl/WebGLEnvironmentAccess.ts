import type { Texture } from "../../textures/Texture";
import {
  CubeReflectionMapping,
  CubeRefractionMapping,
  EquirectangularReflectionMapping,
  EquirectangularRefractionMapping,
} from "../../constants";

export interface WebGLEnvironmentProvider {
  get(texture: Texture | null | undefined, usePMREM?: boolean): Texture | null;
}
/** Preserve native textures; conversion is an explicitly injected capability. */
export function getEnvironment(
  environments: WebGLEnvironmentProvider | null,
  texture: Texture | null | undefined,
  usePMREM: boolean = false,
): Texture | null {
  if (texture === null || texture === undefined) return null;
  if (environments !== null) return environments.get(texture, usePMREM);
  if (texture.isTexture && !(usePMREM && texture.isPMREMTexture === true)) {
    const mapping = texture.mapping;
    const equirectangular =
      mapping === EquirectangularReflectionMapping || mapping === EquirectangularRefractionMapping;
    const cube = mapping === CubeReflectionMapping || mapping === CubeRefractionMapping;
    if (equirectangular || (usePMREM && cube)) throw new Error("Environment maps require createEnvironments.");
  }
  return texture;
}
