import type { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { error } from "../../utils";
import { createGaussianSplatGeometry, writeCovariance } from "../utils/GaussianSplatUtils";

const ROW_SIZE_BYTES = 32;

/**
 * Loads fixed-width Gaussian splat data as a BufferGeometry.
 *
 * ```ts
 * import { SPLATLoader } from "ek3d/addons/loaders/SPLATLoader";
 * const geometry = await new SPLATLoader().loadAsync("model.splat");
 * ```
 */
export class SPLATLoader extends Loader<BufferGeometry> {
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  load(
    url: string,
    onLoad?: (geometry: BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (cause: unknown) => void,
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
      (buffer) => {
        try {
          if (!(buffer instanceof ArrayBuffer)) throw new Error("THREE.SPLATLoader: Expected an ArrayBuffer response.");
          onLoad?.(this.parse(buffer));
        } catch (cause) {
          if (onError) onError(cause);
          else error(cause);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  parse(buffer: ArrayBuffer): BufferGeometry {
    if (buffer.byteLength % ROW_SIZE_BYTES !== 0) throw new Error("THREE.SPLATLoader: Invalid .splat byte length.");
    const count = buffer.byteLength / ROW_SIZE_BYTES;
    const centers = new Float32Array(count * 3);
    const covariances = new Float32Array(count * 6);
    const colors = new Uint8Array(count * 4);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < count; i++) {
      const offset = i * ROW_SIZE_BYTES;
      const i3 = i * 3;
      const i4 = i * 4;
      centers[i3] = view.getFloat32(offset, true);
      centers[i3 + 1] = view.getFloat32(offset + 4, true);
      centers[i3 + 2] = view.getFloat32(offset + 8, true);
      const sx = view.getFloat32(offset + 12, true);
      const sy = view.getFloat32(offset + 16, true);
      const sz = view.getFloat32(offset + 20, true);
      colors[i4] = bytes[offset + 24];
      colors[i4 + 1] = bytes[offset + 25];
      colors[i4 + 2] = bytes[offset + 26];
      colors[i4 + 3] = bytes[offset + 27];
      const qw = (bytes[offset + 28] - 128) / 128;
      const qx = (bytes[offset + 29] - 128) / 128;
      const qy = (bytes[offset + 30] - 128) / 128;
      const qz = (bytes[offset + 31] - 128) / 128;
      writeCovariance(covariances, i * 6, sx, sy, sz, qx, qy, qz, qw);
    }
    return createGaussianSplatGeometry(centers, covariances, colors);
  }
}
