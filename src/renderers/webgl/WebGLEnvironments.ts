import type { Texture } from "../../textures/Texture";
import type { WebGLEnvironmentProvider } from "./WebGLEnvironmentAccess";
import type { WebGLRenderer } from "../WebGLRenderer";
import { Mapping } from "../../constants";
import { PMREMGenerator } from "../../extras/PMREMGenerator";
import { WebGLCubeRenderTarget } from "../WebGLCubeRenderTarget";
export class WebGLEnvironments implements WebGLEnvironmentProvider {
  private readonly renderer: WebGLRenderer;
  private cubeMaps: WeakMap<Texture, WebGLCubeRenderTarget> = new WeakMap();
  private pmremMaps: WeakMap<Texture, WebGLCubeRenderTarget> = new WeakMap();
  private pmremGenerator: PMREMGenerator | null = null;
  private readonly sources: Set<WeakRef<Texture>> = new Set();
  private readonly sourceRefs: WeakMap<Texture, WeakRef<Texture>> = new WeakMap();
  private readonly registry: FinalizationRegistry<WeakRef<Texture>>;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.onSourceFinalize = this.onSourceFinalize.bind(this);
    this.registry = new FinalizationRegistry(this.onSourceFinalize);
    this.onTextureDispose = this.onTextureDispose.bind(this);
    this.get = this.get.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  private onSourceFinalize(ref: WeakRef<Texture>): void {
    this.sources.delete(ref);
  }

  private track(texture: Texture): void {
    if (this.sourceRefs.has(texture)) return;
    const ref = new WeakRef(texture);
    this.sourceRefs.set(texture, ref);
    this.sources.add(ref);
    this.registry.register(texture, ref, ref);
    texture.addEventListener("dispose", this.onTextureDispose);
  }

  get(texture: Texture | null | undefined, usePMREM: boolean = false): Texture | null {
    if (texture === null || texture === undefined) return null;
    if (usePMREM) {
      return this.getPMREM(texture);
    }
    return this.getCube(texture);
  }

  private getCube(texture: Texture): Texture | null {
    if (texture && texture.isTexture) {
      const mapping = texture.mapping;
      if (mapping === Mapping.EquirectangularReflection || mapping === Mapping.EquirectangularRefraction) {
        if (this.cubeMaps.has(texture)) {
          const cubemap = this.cubeMaps.get(texture)!.texture;
          return this.mapTextureMapping(cubemap, texture.mapping);
        } else {
          const image = texture.image;
          if (image && image.height > 0) {
            const renderTarget = new WebGLCubeRenderTarget(image.height);
            try {
              renderTarget.fromEquirectangularTexture(this.renderer, texture);
            } catch (error: unknown) {
              renderTarget.dispose();
              throw error;
            }
            this.cubeMaps.set(texture, renderTarget);
            this.track(texture);
            return this.mapTextureMapping(renderTarget.texture, texture.mapping);
          } else {
            // image not yet ready. try the conversion next frame
            return null;
          }
        }
      }
    }
    return texture;
  }

  private getPMREM(texture: Texture): Texture | null {
    if (texture && texture.isTexture && texture.isPMREMTexture !== true) {
      const mapping = texture.mapping;
      const isEquirectMap =
        mapping === Mapping.EquirectangularReflection || mapping === Mapping.EquirectangularRefraction;
      const isCubeMap = mapping === Mapping.CubeReflection || mapping === Mapping.CubeRefraction;
      // equirect/cube map to PMREM conversion
      if (isEquirectMap || isCubeMap) {
        let renderTarget = this.pmremMaps.get(texture);
        const currentPMREMVersion = renderTarget !== undefined ? renderTarget.texture.pmremVersion : 0;
        if (texture.isRenderTargetTexture && texture.pmremVersion !== currentPMREMVersion) {
          if (this.pmremGenerator === null) this.pmremGenerator = new PMREMGenerator(this.renderer);
          renderTarget = isEquirectMap
            ? this.pmremGenerator.fromEquirectangular(texture, renderTarget)
            : this.pmremGenerator.fromCubemap(texture, renderTarget);
          renderTarget.texture.pmremVersion = texture.pmremVersion;
          this.pmremMaps.set(texture, renderTarget);
          this.track(texture);
          return renderTarget.texture;
        } else {
          if (renderTarget !== undefined) {
            return renderTarget.texture;
          } else {
            const image = texture.image;
            if (
              (isEquirectMap && image && image.height > 0) ||
              (isCubeMap && image && this.isCubeTextureComplete(image))
            ) {
              if (this.pmremGenerator === null) this.pmremGenerator = new PMREMGenerator(this.renderer);
              renderTarget = isEquirectMap
                ? this.pmremGenerator.fromEquirectangular(texture)
                : this.pmremGenerator.fromCubemap(texture);
              renderTarget.texture.pmremVersion = texture.pmremVersion;
              this.pmremMaps.set(texture, renderTarget);
              this.track(texture);
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

  private mapTextureMapping(texture: Texture, mapping: Mapping): Texture {
    if (mapping === Mapping.EquirectangularReflection) {
      texture.mapping = Mapping.CubeReflection;
    } else if (mapping === Mapping.EquirectangularRefraction) {
      texture.mapping = Mapping.CubeRefraction;
    }
    return texture;
  }

  private isCubeTextureComplete(image: ArrayLike<unknown>): boolean {
    let count = 0;
    const length = 6;
    for (let i = 0; i < length; i++) {
      if (image[i] !== undefined) count++;
    }
    return count === length;
  }

  private onTextureDispose(event: { target: Texture }): void {
    const texture = event.target;
    texture.removeEventListener("dispose", this.onTextureDispose);
    const ref = this.sourceRefs.get(texture);
    if (ref !== undefined) {
      this.sources.delete(ref);
      this.registry.unregister(ref);
      this.sourceRefs.delete(texture);
    }
    const cube = this.cubeMaps.get(texture);
    if (cube !== undefined) {
      this.cubeMaps.delete(texture);
      cube.dispose();
    }
    const pmrem = this.pmremMaps.get(texture);
    if (pmrem !== undefined) {
      this.pmremMaps.delete(texture);
      pmrem.dispose();
    }
  }

  dispose(): void {
    for (const ref of this.sources) {
      const texture = ref.deref();
      if (texture !== undefined) this.onTextureDispose({ target: texture });
    }
    this.sources.clear();
    this.cubeMaps = new WeakMap();
    this.pmremMaps = new WeakMap();
    if (this.pmremGenerator !== null) {
      this.pmremGenerator.dispose();
      this.pmremGenerator = null;
    }
  }
}
