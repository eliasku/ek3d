import { Wrapping, TextureType, TextureFilter } from "../../constants";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { Vector3 } from "../../math/Vector3";
import { Data3DTexture } from "../../textures/Data3DTexture";

/** Parsed Cube LUT, including its declared input domain. */
export interface LUTCube {
  title: string | null;
  size: number;
  domainMin: Vector3;
  domainMax: Vector3;
  texture3D: Data3DTexture;
}

/** Loads Adobe Cube color lookup tables. */
export class LUTCubeLoader extends Loader<LUTCube> {
  type: TextureType.UnsignedByte | TextureType.Float = TextureType.UnsignedByte;

  setType(type: TextureType.UnsignedByte | TextureType.Float): this {
    this.type = type;
    return this;
  }

  override load(
    url: string,
    onLoad?: (result: LUTCube) => void,
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
          if (typeof text !== "string") throw new TypeError("LUTCubeLoader requires text data");
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

  parse(input: string): LUTCube {
    const title = /TITLE +"([^"]*)"/.exec(input)?.[1] ?? null;
    const sizeMatch = /LUT_3D_SIZE +(\d+)/.exec(input);
    if (sizeMatch === null) throw new Error("LUTCubeLoader: Missing LUT_3D_SIZE information");
    const size = Number(sizeMatch[1]);
    const data =
      this.type === TextureType.UnsignedByte ? new Uint8Array(size ** 3 * 4) : new Float32Array(size ** 3 * 4);
    const domainMin = new Vector3(0, 0, 0);
    const domainMax = new Vector3(1, 1, 1);
    const min = /DOMAIN_MIN +([\d.e+-]+) +([\d.e+-]+) +([\d.e+-]+)/.exec(input);
    const max = /DOMAIN_MAX +([\d.e+-]+) +([\d.e+-]+) +([\d.e+-]+)/.exec(input);
    if (min) domainMin.set(Number(min[1]), Number(min[2]), Number(min[3]));
    if (max) domainMax.set(Number(max[1]), Number(max[2]), Number(max[3]));
    if (domainMin.x > domainMax.x || domainMin.y > domainMax.y || domainMin.z > domainMax.z)
      throw new Error("LUTCubeLoader: Invalid input domain");
    const scale = this.type === TextureType.UnsignedByte ? 255 : 1;
    const points = /^([\d.e+-]+) +([\d.e+-]+) +([\d.e+-]+) *$/gm;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = points.exec(input)) !== null) {
      data[i++] = Number(match[1]) * scale;
      data[i++] = Number(match[2]) * scale;
      data[i++] = Number(match[3]) * scale;
      data[i++] = scale;
    }
    const texture3D = new Data3DTexture(data, size, size, size);
    texture3D.type = this.type;
    texture3D.magFilter = texture3D.minFilter = TextureFilter.Linear;
    texture3D.wrapS = texture3D.wrapT = texture3D.wrapR = Wrapping.ClampToEdge;
    texture3D.generateMipmaps = false;
    texture3D.needsUpdate = true;
    return { title, size, domainMin, domainMax, texture3D };
  }
}
