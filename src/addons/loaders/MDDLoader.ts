import { AnimationClip } from "../../animation/AnimationClip";
import { NumberKeyframeTrack } from "../../animation/tracks/NumberKeyframeTrack";
import { BufferAttribute } from "../../core/BufferAttribute";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";

/** The morph targets and animation clip produced by {@link MDDLoader#parse}. */
export interface MDDLoaderResult {
  morphTargets: BufferAttribute[];
  clip: AnimationClip;
}

/**
 * A loader for the MDD format.
 *
 * MDD stores a position for every vertex in a model for every frame in an animation,
 * in big endian binary layout: frame count (uint32), vertex count (uint32), one
 * float32 time per frame, then vertex positions for each frame.
 *
 * ```ts
 * import { MDDLoader } from "ek3d/addons/loaders/MDDLoader";
 * import { AnimationMixer } from "ek3d/animation/AnimationMixer";
 * import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
 * import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
 * import { Mesh } from "ek3d/objects/Mesh";
 *
 * const result = await new MDDLoader().loadAsync( "models/mdd/cube.mdd" );
 * const geometry = new BoxGeometry();
 * geometry.morphAttributes.position = result.morphTargets;
 *
 * const mesh = new Mesh( geometry, new MeshBasicMaterial() );
 * const mixer = new AnimationMixer( mesh );
 * mixer.clipAction( result.clip ).play();
 * ```
 */
export class MDDLoader extends Loader<MDDLoaderResult> {
  /**
   * Constructs a new MDD loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  /**
   * Starts loading from the given URL and passes the parsed result to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  override load(
    url: string,
    onLoad?: (result: MDDLoaderResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (data) => {
        try {
          if (!(data instanceof ArrayBuffer)) throw new TypeError("MDDLoader requires binary data");
          onLoad?.(this.parse(data));
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  /**
   * Parses the given MDD data and returns the animation clip and the respective morph targets.
   *
   * @param data - The raw MDD data as an array buffer.
   * @return The parsed morph targets and clip.
   */
  parse(data: ArrayBuffer): MDDLoaderResult {
    const view = new DataView(data);

    const totalFrames = view.getUint32(0);
    const totalPoints = view.getUint32(4);

    let offset = 8;

    // animation clip: one discrete influence per frame
    const times = new Float32Array(totalFrames);
    const values = new Float32Array(totalFrames * totalFrames).fill(0);

    for (let i = 0; i < totalFrames; i++) {
      times[i] = view.getFloat32(offset);
      offset += 4;
      values[totalFrames * i + i] = 1;
    }

    const track = new NumberKeyframeTrack(".morphTargetInfluences", times, values);
    const clip = new AnimationClip("default", times[times.length - 1], [track]);

    // morph targets
    const morphTargets: BufferAttribute[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const morphTarget = new Float32Array(totalPoints * 3);

      for (let j = 0; j < totalPoints; j++) {
        const stride = j * 3;
        morphTarget[stride + 0] = view.getFloat32(offset);
        offset += 4; // x
        morphTarget[stride + 1] = view.getFloat32(offset);
        offset += 4; // y
        morphTarget[stride + 2] = view.getFloat32(offset);
        offset += 4; // z
      }

      const attribute = new BufferAttribute(morphTarget, 3);
      attribute.name = "morph_" + i;
      morphTargets.push(attribute);
    }

    return {
      morphTargets: morphTargets,
      clip: clip,
    };
  }
}
