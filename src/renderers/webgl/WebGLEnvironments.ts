import type { Texture } from "../../textures/Texture";
import type { WebGLEnvironmentProvider } from "./WebGLEnvironmentAccess";
import type { WebGLRenderer } from "../WebGLRenderer";
import {
  CubeReflectionMapping,
  CubeRefractionMapping,
  EquirectangularReflectionMapping,
  EquirectangularRefractionMapping,
} from "../../constants";
import { PMREMGenerator } from "../../extras/PMREMGenerator";
import { WebGLCubeRenderTarget } from "../WebGLCubeRenderTarget";
export function WebGLEnvironments(renderer: WebGLRenderer): WebGLEnvironmentProvider & { dispose(): void } {
  let cubeMaps = new WeakMap<any, any>();
  let pmremMaps = new WeakMap<any, any>();
  let pmremGenerator: any = null;
  const sources = new Set<any>();
  const sourceRefs = new WeakMap<any, any>();
  const registry = new FinalizationRegistry((ref?: any) => sources.delete(ref));
  function track(texture: Texture) {
    if (sourceRefs.has(texture)) return;
    const ref = new WeakRef<any>(texture);
    sourceRefs.set(texture, ref);
    sources.add(ref);
    registry.register(texture, ref, ref);
    texture.addEventListener("dispose", onTextureDispose);
  }
  function get(texture: Texture | null | undefined, usePMREM: boolean = false): Texture | null {
    if (texture === null || texture === undefined) return null;
    if (usePMREM) {
      return getPMREM(texture);
    }
    return getCube(texture);
  }
  function getCube(texture: Texture): Texture | null {
    if (texture && texture.isTexture) {
      const mapping = texture.mapping;
      if (mapping === EquirectangularReflectionMapping || mapping === EquirectangularRefractionMapping) {
        if (cubeMaps.has(texture)) {
          const cubemap = cubeMaps.get(texture).texture;
          return mapTextureMapping(cubemap, texture.mapping);
        } else {
          const image = texture.image;
          if (image && image.height > 0) {
            const renderTarget = new WebGLCubeRenderTarget(image.height);
            try {
              renderTarget.fromEquirectangularTexture(renderer, texture);
            } catch (error: any) {
              renderTarget.dispose();
              throw error;
            }
            cubeMaps.set(texture, renderTarget);
            track(texture);
            return mapTextureMapping(renderTarget.texture, texture.mapping);
          } else {
            // image not yet ready. try the conversion next frame
            return null;
          }
        }
      }
    }
    return texture;
  }
  function getPMREM(texture: Texture): Texture | null {
    if (texture && texture.isTexture && texture.isPMREMTexture !== true) {
      const mapping = texture.mapping;
      const isEquirectMap =
        mapping === EquirectangularReflectionMapping || mapping === EquirectangularRefractionMapping;
      const isCubeMap = mapping === CubeReflectionMapping || mapping === CubeRefractionMapping;
      // equirect/cube map to PMREM conversion
      if (isEquirectMap || isCubeMap) {
        let renderTarget = pmremMaps.get(texture);
        const currentPMREMVersion = renderTarget !== undefined ? renderTarget.texture.pmremVersion : 0;
        if (texture.isRenderTargetTexture && texture.pmremVersion !== currentPMREMVersion) {
          if (pmremGenerator === null) pmremGenerator = new PMREMGenerator(renderer);
          renderTarget = isEquirectMap
            ? pmremGenerator.fromEquirectangular(texture, renderTarget)
            : pmremGenerator.fromCubemap(texture, renderTarget);
          renderTarget.texture.pmremVersion = texture.pmremVersion;
          pmremMaps.set(texture, renderTarget);
          track(texture);
          return renderTarget.texture;
        } else {
          if (renderTarget !== undefined) {
            return renderTarget.texture;
          } else {
            const image = texture.image;
            if ((isEquirectMap && image && image.height > 0) || (isCubeMap && image && isCubeTextureComplete(image))) {
              if (pmremGenerator === null) pmremGenerator = new PMREMGenerator(renderer);
              renderTarget = isEquirectMap
                ? pmremGenerator.fromEquirectangular(texture)
                : pmremGenerator.fromCubemap(texture);
              renderTarget.texture.pmremVersion = texture.pmremVersion;
              pmremMaps.set(texture, renderTarget);
              track(texture);
              return renderTarget.texture;
            } else {
              // image not yet ready. try the conversion next frame
              return null;
            }
          }
        }
      }
    }
    return texture;
  }
  function mapTextureMapping(texture: Texture, mapping: number) {
    if (mapping === EquirectangularReflectionMapping) {
      texture.mapping = CubeReflectionMapping;
    } else if (mapping === EquirectangularRefractionMapping) {
      texture.mapping = CubeRefractionMapping;
    }
    return texture;
  }
  function isCubeTextureComplete(image?: any) {
    let count = 0;
    const length = 6;
    for (let i = 0; i < length; i++) {
      if (image[i] !== undefined) count++;
    }
    return count === length;
  }
  function onTextureDispose(event?: any) {
    const texture = event.target;
    texture.removeEventListener("dispose", onTextureDispose);
    const ref = sourceRefs.get(texture);
    if (ref !== undefined) {
      sources.delete(ref);
      registry.unregister(ref);
      sourceRefs.delete(texture);
    }
    const cube = cubeMaps.get(texture);
    if (cube !== undefined) {
      cubeMaps.delete(texture);
      cube.dispose();
    }
    const pmrem = pmremMaps.get(texture);
    if (pmrem !== undefined) {
      pmremMaps.delete(texture);
      pmrem.dispose();
    }
  }
  function dispose() {
    for (const ref of sources) {
      const texture = ref.deref();
      if (texture !== undefined) onTextureDispose({ target: texture });
    }
    sources.clear();
    cubeMaps = new WeakMap();
    pmremMaps = new WeakMap();
    if (pmremGenerator !== null) {
      pmremGenerator.dispose();
      pmremGenerator = null;
    }
  }
  return {
    get: get,
    dispose: dispose,
  };
}
