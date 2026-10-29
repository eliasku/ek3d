import { ColorSpace } from "../../constants";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { Color } from "../../math/Color";

/**
 * Loads XYZ point clouds, with optional RGB colors in the sRGB 0–255 range.
 *
 * ```ts
 * import { XYZLoader } from "ek3d/addons/loaders/XYZLoader";
 * import { PointsMaterial } from "ek3d/materials/PointsMaterial";
 * import { Points } from "ek3d/objects/Points";
 *
 * const geometry = await new XYZLoader().loadAsync("models/xyz/helix_201.xyz");
 * geometry.center();
 * const material = new PointsMaterial({ size: 0.1, vertexColors: geometry.hasAttribute("color") });
 * const points = new Points(geometry, material);
 * ```
 */
export class XYZLoader extends Loader<BufferGeometry, string> {
  override load(
    url: string,
    onLoad?: (geometry: BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
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
          if (typeof text !== "string") throw new TypeError("XYZLoader requires text data");
          const geometry = this.parse(text);
          onLoad?.(geometry);
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

  /** Parses XYZ or XYZRGB rows; comments and other row widths are ignored. */
  parse(text: string): BufferGeometry {
    const vertices: number[] = [];
    const colors: number[] = [];
    const color = new Color();
    for (let line of text.split("\n")) {
      line = line.trim();
      if (line.charAt(0) === "#") continue;
      const values = line.split(/\s+/);
      if (values.length === 3 || values.length === 6) {
        vertices.push(parseFloat(values[0]), parseFloat(values[1]), parseFloat(values[2]));
      }
      if (values.length === 6) {
        color.setRGB(
          parseFloat(values[3]) / 255,
          parseFloat(values[4]) / 255,
          parseFloat(values[5]) / 255,
          ColorSpace.SRGB,
        );
        colors.push(color.r, color.g, color.b);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    if (colors.length > 0) geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geometry;
  }
}
