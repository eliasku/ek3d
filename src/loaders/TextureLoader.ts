import type { LoadingManager } from "./LoadingManager";
import { ImageLoader } from "./ImageLoader";
import { Texture } from "../textures/Texture";
import { Loader } from "./Loader";
/**
 * Class for loading textures. Images are internally
 * loaded via {@link ImageLoader}.
 *
 * ```typescript
 * import { TextureLoader } from 'ek3d/loaders/TextureLoader';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 *
 * const loader = new TextureLoader();
 * const texture = await loader.loadAsync( 'textures/land_ocean_ice_cloud_2048.jpg' );
 *
 * const material = new MeshBasicMaterial( { map:texture } );
 * ```
 * Please note that `TextureLoader` has dropped support for progress
 * events in `r84`. For a `TextureLoader` that supports progress events, see
 * [this thread](https://github.com/mrdoob/three.js/issues/10439#issuecomment-293260145).
 *
 */
export class TextureLoader extends Loader<Texture, string> {
  /**
   * Constructs a new texture loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }
  /**
   * Starts loading from the given URL and pass the fully loaded texture
   * to the `onLoad()` callback. The method also returns a new texture object which can
   * directly be used for material creation. If you do it this way, the texture
   * may pop up in your scene once the respective loading process is finished.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param [onLoad] - Executed when the loading process has been finished.
   * @param [onProgress] - Unsupported in this loader.
   * @param [onError] - Executed when errors occur.
   * @return The texture.
   */
  load(
    url: string,
    onLoad?: (value: Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): Texture {
    const texture = new Texture();
    const loader = new ImageLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setCrossOrigin(this.crossOrigin);
    loader.setPath(this.path);
    loader.load(
      url,
      function (image?: any) {
        texture.image = image;
        texture.needsUpdate = true;
        if (onLoad !== undefined) {
          onLoad(texture);
        }
      },
      onProgress,
      onError,
    );
    return texture;
  }
}
