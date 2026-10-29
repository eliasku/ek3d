import type { LoadingManager } from "./LoadingManager";
import { AnimationClip } from "../animation/AnimationClip";
import { FileLoader } from "./FileLoader";
import { Loader } from "./Loader";
import { error } from "../utils";
/**
 * Class for loading animation clips in the JSON format. The files are internally
 * loaded via {@link FileLoader}.
 *
 * ```ts
 * import { AnimationLoader } from 'ek3d/loaders/AnimationLoader';
 *
 * const loader = new AnimationLoader();
 * const animations = await loader.loadAsync( 'animations/animation.js' );
 * ```
 *
 */
export class AnimationLoader extends Loader<AnimationClip[]> {
  /**
   * Constructs a new animation loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }
  /**
   * Starts loading from the given URL and pass the loaded animations as an array
   * holding instances of {@link AnimationClip} to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  load(
    url: string,
    onLoad: (value: AnimationClip[]) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ) {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (text?: any) => {
        try {
          onLoad(this.parse(JSON.parse(text as string)));
        } catch (e: any) {
          if (onError) {
            onError(e);
          } else {
            error(e);
          }
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }
  /**
   * Parses the given JSON object and returns an array of animation clips.
   *
   * @param json - The serialized animation clips.
   * @return The parsed animation clips.
   */
  parse(json?: any): AnimationClip[] {
    const animations: any[] = [];
    for (let i = 0; i < json.length; i++) {
      const clip = AnimationClip.parse(json[i]);
      animations.push(clip);
    }
    return animations;
  }
}
