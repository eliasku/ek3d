import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { LoaderUtils } from "../../loaders/LoaderUtils";
import type { Group } from "../../objects/Group";
import { USDAParser, type USDAData } from "./usd/USDAParser";
import { USDCParser, type USDCData } from "./usd/USDCParser";
import { USDComposer } from "./usd/USDComposer";

/** ZIP decoder supplied by the application. */
export interface USDZipRuntime {
  unzipSync(data: Uint8Array): Record<string, Uint8Array>;
}

/** Loads USD, USDA, USDC and USDZ assets. */
export class USDLoader extends Loader<Group> {
  zipRuntime: USDZipRuntime | null = null;

  setZipRuntime(runtime: USDZipRuntime): this {
    this.zipRuntime = runtime;
    return this;
  }

  override load(
    url: string,
    onLoad?: (group: Group) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;
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
          this.parse(data as ArrayBuffer, path, onLoad, onError);
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

  parse(
    buffer: ArrayBuffer | string,
    path = "",
    onLoad?: (group: Group) => void,
    onError?: (error: unknown) => void,
  ): Group {
    const usda = new USDAParser();
    const usdc = new USDCParser();
    const decoder = new TextDecoder();
    const isCrate = (bytes: Uint8Array): boolean =>
      bytes.length >= 8 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x58 &&
      bytes[2] === 0x52 &&
      bytes[3] === 0x2d &&
      bytes[4] === 0x55 &&
      bytes[5] === 0x53 &&
      bytes[6] === 0x44 &&
      bytes[7] === 0x43;
    const composer = new USDComposer(this.manager);
    composer.imageLoader.setCrossOrigin(this.crossOrigin);
    composer.imageLoader.setPriority(this.priority);
    composer.imageLoader.setCache(this.cache);
    const finalize = (group: Group): Group => {
      if (onLoad !== undefined)
        Promise.all(composer.texturePromises)
          .then(() => onLoad(group))
          .catch((error: unknown) => {
            if (onError !== undefined) onError(error);
            else console.error(error);
          });
      return group;
    };
    if (typeof buffer === "string") return finalize(composer.compose(usda.parseData(buffer), {}, {}, path));
    const bytes = new Uint8Array(buffer);
    if (isCrate(bytes)) return finalize(composer.compose(usdc.parseData(buffer), {}, {}, path));
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      return finalize(composer.compose(usda.parseData(decoder.decode(bytes)), {}, {}, path));
    if (this.zipRuntime === null) throw new Error("USDLoader: ZIP runtime is required.");
    const zip = this.zipRuntime.unzipSync(bytes);
    const assets: Record<string, USDAData | USDCData | Uint8Array> = {};
    const extension = (filename: string): string => {
      const dot = filename.lastIndexOf(".");
      return dot < 0 || filename.lastIndexOf("/") > dot ? "" : filename.slice(dot + 1).toLowerCase();
    };
    for (const filename in zip) {
      const file = zip[filename];
      const ext = extension(filename);
      if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "avif") assets[filename] = file;
      else if (ext === "usd" || ext === "usda" || ext === "usdc") {
        assets[filename] = isCrate(file)
          ? usdc.parseData(Uint8Array.from(file).buffer)
          : usda.parseData(decoder.decode(file));
      }
    }
    const filename = Object.keys(zip)[0];
    if (filename === undefined || !["usd", "usda", "usdc"].includes(extension(filename))) {
      throw new Error(
        "THREE.USDLoader: Invalid USDZ package. The first ZIP entry must be a USD layer (.usd/.usda/.usdc).",
      );
    }
    const data = assets[filename];
    if (data === undefined || data instanceof Uint8Array)
      throw new Error(`THREE.USDLoader: Failed to parse root layer "${filename}".`);
    const slash = filename.lastIndexOf("/");
    return finalize(composer.compose(data, assets, {}, slash >= 0 ? filename.slice(0, slash) : ""));
  }
}
