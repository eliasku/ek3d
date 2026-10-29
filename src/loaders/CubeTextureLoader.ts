import type { LoadingManager } from "./LoadingManager";
import { ImageLoader } from "./ImageLoader";
import { CubeTexture } from "../textures/CubeTexture";
import { Loader } from "./Loader";
import { ColorSpace } from "../constants";
/**
 * Class for loading cube textures. Images are internally loaded via {@link ImageLoader}.
 *
 * The loader returns an instance of {@link CubeTexture} and expects the cube map to
 * be defined as six separate images representing the sides of a cube. Other cube map definitions
 * like vertical and horizontal cross, column and row layouts are not supported.
 *
 * Note that, by convention, cube maps are specified in a coordinate system
 * in which positive-x is to the right when looking up the positive-z axis --
 * in other words, using a left-handed coordinate system. Since three.js uses
 * a right-handed coordinate system, environment maps used in three.js will
 * have pos-x and neg-x swapped.
 *
 * The loaded cube texture is in sRGB color space. Meaning {@link Texture#colorSpace}
 * is set to `ColorSpace.SRGB` by default.
 *
 * ```ts
 * import { CubeTextureLoader } from 'ek3d/loaders/CubeTextureLoader';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const loader = new CubeTextureLoader().setPath( 'textures/cubeMaps/' );
 * const cubeTexture = await loader.loadAsync( [
 * 	'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'
 * ] );
 * scene.background = cubeTexture;
 * ```
 *
 */
export class CubeTextureLoader extends Loader<CubeTexture, string[]> {
  /**
   * Constructs a new cube texture loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }
  /**
   * Starts loading from the given URL and pass the fully loaded cube texture
   * to the `onLoad()` callback. The method also returns a new cube texture object which can
   * directly be used for material creation. If you do it this way, the cube texture
   * may pop up in your scene once the respective loading process is finished.
   *
   * @param urls - Array of 6 URLs to images, one for each side of the
   * cube texture. The urls should be specified in the following order: pos-x,
   * neg-x, pos-y, neg-y, pos-z, neg-z. An array of data URIs are allowed as well.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Unsupported in this loader.
   * @param onError - Executed when errors occur.
   * @return The cube texture.
   */
  load(
    urls: string[],
    onLoad?: (value: CubeTexture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): CubeTexture {
    const texture = new CubeTexture();
    texture.colorSpace = ColorSpace.SRGB;
    const loader = new ImageLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setCrossOrigin(this.crossOrigin);
    loader.setPath(this.path);
    let loaded = 0;
    function loadTexture(i?: any) {
      loader.load(
        urls[i],
        function (image?: any) {
          texture.images[i] = image;
          loaded++;
          if (loaded === 6) {
            texture.needsUpdate = true;
            if (onLoad) onLoad(texture);
          }
        },
        undefined,
        onError,
      );
    }
    for (let i = 0; i < urls.length; ++i) {
      loadTexture(i);
    }
    return texture;
  }
}
