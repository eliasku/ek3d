import { Wrapping, TextureType, TextureFilter, PixelFormat } from "../../constants";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { Data3DTexture } from "../../textures/Data3DTexture";

/** Loads Autodesk 3DL color lookup tables. */
export class LUT3dlLoader extends Loader<{ size: number; texture3D: Data3DTexture }> {
  type: TextureType.UnsignedByte | TextureType.Float = TextureType.UnsignedByte;

  setType(type: TextureType.UnsignedByte | TextureType.Float): this {
    this.type = type;
    return this;
  }

  override load(
    url: string,
    onLoad?: (result: { size: number; texture3D: Data3DTexture }) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader
      .setPriority(this.priority)
      .setCache(this.cache)
      .setRequestHeader(this.requestHeader)
      .setWithCredentials(this.withCredentials)
      .setPath(this.path)
      .setResponseType("text");
    loader.load(
      url,
      (text) => {
        try {
          if (typeof text !== "string") throw new TypeError("LUT3dlLoader requires text data");
          onLoad?.(this.parse(text));
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

  parse(input: string): { size: number; texture3D: Data3DTexture } {
    const grid = /^[\d ]+$/m.exec(input);
    if (grid === null) throw new Error("LUT3dlLoader: Missing grid information");
    const gridLines = grid[0].trim().split(/\s+/).map(Number);
    const size = gridLines.length;
    const step = gridLines[1] - gridLines[0];
    for (let i = 1; i < size; i++) {
      if (gridLines[i] - gridLines[i - 1] !== step) throw new Error("LUT3dlLoader: Inconsistent grid size");
    }
    const floats = new Float32Array(size ** 3 * 4);
    const points = /^([\d.e+-]+) +([\d.e+-]+) +([\d.e+-]+) *$/gm;
    let match: RegExpExecArray | null;
    let max = 0;
    let index = 0;
    while ((match = points.exec(input)) !== null) {
      const r = Number(match[1]),
        g = Number(match[2]),
        b = Number(match[3]);
      max = Math.max(max, r, g, b);
      const offset =
        ((index % size) * size ** 2 +
          (Math.floor(index / size) % size) * size +
          (Math.floor(index / size ** 2) % size)) *
        4;
      floats[offset] = r;
      floats[offset + 1] = g;
      floats[offset + 2] = b;
      index++;
    }
    const maxBitValue = 2 ** Math.max(0, Math.ceil(Math.log2(max)));
    const data = this.type === TextureType.UnsignedByte ? new Uint8Array(floats.length) : floats;
    const scale = this.type === TextureType.UnsignedByte ? 255 : 1;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (floats[i] / maxBitValue) * scale;
      data[i + 1] = (floats[i + 1] / maxBitValue) * scale;
      data[i + 2] = (floats[i + 2] / maxBitValue) * scale;
      data[i + 3] = scale;
    }
    const texture3D = new Data3DTexture(data, size, size, size);
    texture3D.format = PixelFormat.RGBA;
    texture3D.type = this.type;
    texture3D.magFilter = texture3D.minFilter = TextureFilter.Linear;
    texture3D.wrapS = texture3D.wrapT = texture3D.wrapR = Wrapping.ClampToEdge;
    texture3D.generateMipmaps = false;
    texture3D.needsUpdate = true;
    return { size, texture3D };
  }
}
