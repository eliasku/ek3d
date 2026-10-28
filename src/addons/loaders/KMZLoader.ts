import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { LoadingManager } from "../../loaders/LoadingManager";
import { Group } from "../../objects/Group";
import { ColladaLoader, type ColladaResult } from "./ColladaLoader";

/** ZIP decoder supplied by the application. */
export interface KMZZipRuntime {
  unzipSync(data: Uint8Array): Record<string, Uint8Array>;
}

/** Loads KMZ archives containing a Collada model and its textures. */
export class KMZLoader extends Loader<ColladaResult | null> {
  zipRuntime: KMZZipRuntime | null = null;

  setZipRuntime(runtime: KMZZipRuntime): this {
    this.zipRuntime = runtime;
    return this;
  }

  override load(
    url: string,
    onLoad?: (result: ColladaResult | null) => void,
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
          onLoad?.(this.parse(data as ArrayBuffer));
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

  parse(data: ArrayBuffer): ColladaResult | null {
    if (this.zipRuntime === null) throw new Error("KMZLoader: ZIP runtime is required.");
    const zip = this.zipRuntime.unzipSync(new Uint8Array(data));
    const urls: string[] = [];
    const manager = new LoadingManager(
      () => {
        for (const url of urls) URL.revokeObjectURL(url);
        urls.length = 0;
      },
      undefined,
      (url) => this.manager.itemError(url),
    );
    manager.setURLModifier((url) => {
      const path = Object.keys(zip).find((entry) => entry.endsWith(url));
      if (path === undefined) return url;
      const blob = new Blob([Uint8Array.from(zip[path])], { type: "application/octet-stream" });
      const objectURL = URL.createObjectURL(blob);
      urls.push(objectURL);
      return objectURL;
    });
    let model: Uint8Array | undefined;
    if (zip["doc.kml"] !== undefined) {
      const xml = new DOMParser().parseFromString(new TextDecoder().decode(zip["doc.kml"]), "application/xml");
      const href = xml.querySelector("Placemark Model Link href")?.textContent;
      if (href !== null && href !== undefined) model = zip[href];
    } else {
      console.warn("KMZLoader: Missing doc.kml file.");
      const path = Object.keys(zip).find((entry) => entry.split(".").pop()?.toLowerCase() === "dae");
      if (path !== undefined) model = zip[path];
    }
    if (model === undefined) {
      console.error("KMZLoader: Couldn't find .dae file.");
      return { scene: new Group() };
    }
    const loader = new ColladaLoader(manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    return loader.parse(new TextDecoder().decode(model));
  }
}
