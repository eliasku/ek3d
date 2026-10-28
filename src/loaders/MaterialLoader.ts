import type { Texture } from "../textures/Texture";
import type { LoadingManager } from "./LoadingManager";
import type { Material } from "../materials/Material";
import { FileLoader } from "./FileLoader";
import { Loader } from "./Loader";
import { error } from "../utils";
export type MaterialConstructors = Readonly<Record<string, new () => Material>>;
/**
 * Class for loading materials. The files are internally
 * loaded via {@link FileLoader}.
 *
 * ```typescript
 * import { MaterialLoader } from 'ek3d/loaders/MaterialLoader';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 *
 * const loader = new MaterialLoader( undefined, { MeshBasicMaterial } );
 * const material = await loader.loadAsync( 'material.json' );
 * ```
 * Supply the material constructors required by the serialized data explicitly.
 *
 */
export class MaterialLoader extends Loader<Material> {
  textures: Record<string, Texture>;
  constructors: MaterialConstructors;

  /**
   * Constructs a new material loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager, constructors: MaterialConstructors = {}) {
    super(manager);
    this.textures = {};
    this.constructors = constructors;
  }
  /**
   * Starts loading from the given URL and pass the loaded material to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  load(
    url: string,
    onLoad: (value: Material) => void,
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
   * Parses the given JSON object and returns a material.
   *
   * @param json - The serialized material.
   * @return The parsed material.
   */
  parse(json?: any): Material {
    const material = this.createMaterialFromType(json.type);
    material.fromJSON(json, this.textures);
    return material;
  }
  /**
   * Textures are not embedded in the material JSON so they have
   * to be injected before the loading process starts.
   *
   * @param value - A dictionary holding textures for material properties.
   * @return A reference to this material loader.
   */
  setTextures(value: Record<string, Texture>): MaterialLoader {
    this.textures = value;
    return this;
  }
  /**
   * Creates a material for the given type.
   *
   * @param type - The material type.
   * @return The new material.
   */
  createMaterialFromType(type: string): Material {
    if (!Object.hasOwn(this.constructors, type))
      throw new Error('MaterialLoader: Unknown material type "' + type + '".');
    return new (this.constructors as any)[type]();
  }
}
