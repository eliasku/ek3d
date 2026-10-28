import type { AnimationClip } from "../../animation/AnimationClip";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { LoaderUtils } from "../../loaders/LoaderUtils";
import { TextureLoader } from "../../loaders/TextureLoader";
import type { Group } from "../../objects/Group";
import { Scene } from "../../scenes/Scene";
import { TGALoader } from "./TGALoader";
import { ColladaParser, type ColladaLibrary } from "./collada/ColladaParser";
import { ColladaComposer, type ColladaKinematics } from "./collada/ColladaComposer";

export interface ColladaResult {
  scene: Scene | Group;
  readonly animations?: AnimationClip[];
  kinematics?: ColladaKinematics;
  library?: ColladaLibrary;
}

/** Loads Collada scenes, animations and kinematics. */
export class ColladaLoader extends Loader<ColladaResult | null> {
  override load(
    url: string,
    onLoad?: (result: ColladaResult | null) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (text) => {
        try {
          onLoad?.(this.parse(text as string, path));
        } catch (error) {
          if (onError !== undefined) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  parse(text: string, path = ""): ColladaResult | null {
    if (text.length === 0) return { scene: new Scene() };
    const result = new ColladaParser().parse(text);
    if (result === null) return null;
    const { library, asset, collada } = result;
    const textureLoader = new TextureLoader(this.manager);
    textureLoader.setPriority(this.priority);
    textureLoader.setCache(this.cache);
    textureLoader.setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);
    const tgaLoader = new TGALoader(this.manager);
    tgaLoader.setPriority(this.priority);
    tgaLoader.setCache(this.cache);
    tgaLoader.setPath(this.resourcePath || path);
    tgaLoader.setRequestHeader(this.requestHeader);
    tgaLoader.setWithCredentials(this.withCredentials);
    const { scene, animations, kinematics } = new ColladaComposer(library, collada, textureLoader, tgaLoader).compose();
    scene.animations = animations;
    if (asset.upAxis === "Z_UP") {
      console.warn(
        "THREE.ColladaLoader: You are loading an asset with a Z-UP coordinate system. The loader just rotates the asset to transform it into Y-UP. The vertex data are not converted, see #24289.",
      );
      scene.rotation.set(-Math.PI / 2, 0, 0);
    }
    scene.scale.multiplyScalar(asset.unit);
    return {
      get animations() {
        console.warn("THREE.ColladaLoader: Please access animations over scene.animations now.");
        return animations;
      },
      kinematics,
      library,
      scene,
    };
  }
}
