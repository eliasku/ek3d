import type { MaterialConstructors } from "./MaterialLoader";
import type { CurveFactory } from "../extras/core/Curve";
import type { Vector2 } from "../math/Vector2";
import type { BufferGeometry } from "../core/BufferGeometry";
import { Mapping, Wrapping, TextureFilter } from "../constants";
import { InstancedBufferAttribute } from "../core/InstancedBufferAttribute";
import { Color } from "../math/Color";
import { Vector3 } from "../math/Vector3";
import { Object3D } from "../core/Object3D";
import { Skeleton } from "../objects/Skeleton";
import { Shape } from "../extras/core/Shape";
import { Fog } from "../scenes/Fog";
import { FogExp2 } from "../scenes/FogExp2";
import { CubeTexture } from "../textures/CubeTexture";
import { Texture } from "../textures/Texture";
import { TextureSource } from "../textures/TextureSource";
import { DataTexture } from "../textures/DataTexture";
import { ImageLoader } from "./ImageLoader";
import { LoadingManager } from "./LoadingManager";
import { AnimationClip } from "../animation/AnimationClip";
import { MaterialLoader } from "./MaterialLoader";
import { LoaderUtils } from "./LoaderUtils";
import { BufferGeometryLoader } from "./BufferGeometryLoader";
import { Loader } from "./Loader";
import { FileLoader } from "./FileLoader";
import { getTypedArray, error, warn } from "../utils";
import { Box3 } from "../math/Box3";
import { Sphere } from "../math/Sphere";
import { SphericalHarmonics3 } from "../math/SphericalHarmonics3";

export interface ObjectLoaderFactories {
  objects?: Readonly<Record<string, new (...args: never[]) => Object3D>>;
  materials?: MaterialConstructors;
  geometries?: Readonly<Record<string, { fromJSON(data: unknown, shapes: Record<string, Shape>): BufferGeometry }>>;
  createCurve?: CurveFactory<Vector2>;
}
function missingCurve(json?: any) {
  throw new Error('ObjectLoader: Unknown curve type "' + json.type + '"; provide createCurve.');
}
/**
 * A loader for loading a JSON resource in the [JSON Object/Scene format](https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4).
 * The files are internally loaded via {@link FileLoader}.
 *
 * ```typescript
 * import { ObjectLoader } from 'ek3d/loaders/ObjectLoader';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 *
 * const scene = new Scene();
 * const loader = new ObjectLoader( undefined, {
 *   objects: { Scene, Mesh },
 *   materials: { MeshBasicMaterial },
 *   geometries: { BoxGeometry },
 * } );
 * const obj = await loader.loadAsync( 'models/json/example.json' );
 * scene.add( obj );
 *
 * // Alternatively, fetch JSON separately before parsing it.
 * const json = await fetch( 'models/json/example.json' ).then( response => response.json() );
 * const object = await loader.parseAsync( json );
 * scene.add( object );
 * ```
 *
 */
export class ObjectLoader extends Loader<Object3D> {
  factories: ObjectLoaderFactories;

  /**
   * Constructs a new object loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager, factories: ObjectLoaderFactories = {}) {
    super(manager);
    this.factories = factories;
  }
  createObject(type?: any, ...args: any[]) {
    const constructors = (this.factories as any).objects;
    if (!constructors || !Object.hasOwn(constructors, type))
      throw new Error('ObjectLoader: Unknown object type "' + type + '".');
    return new (constructors[type] as unknown as new (...args: unknown[]) => Object3D)(...args);
  }
  /**
   * Starts loading from the given URL and pass the loaded 3D object to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  load(
    url: string,
    onLoad: (value: Object3D) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ) {
    const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;
    this.resourcePath = this.resourcePath || path;
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
          const json = JSON.parse(text as string);
          if (
            json.metadata === undefined ||
            json.metadata.type === undefined ||
            json.metadata.type.toLowerCase() === "geometry"
          ) {
            throw new Error("ObjectLoader: Can't load " + url);
          }
          this.parse(json, onLoad, onError);
        } catch (e: any) {
          if (onError !== undefined) onError(e);
          else error(e);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }
  /**
   * Async version of {@link ObjectLoader#load}.
   *
   * @async
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onProgress - Executed while the loading is in progress.
   * @return A Promise that resolves with the loaded 3D object.
   */
  async loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<Object3D> {
    const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;
    this.resourcePath = this.resourcePath || path;
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    const text = await loader.loadAsync(url, onProgress);
    let json: any;
    try {
      json = JSON.parse(text as string);
    } catch (e: any) {
      throw new Error("THREE.ObjectLoader: Can't parse " + url + ". " + e.message);
    }
    const metadata = json.metadata;
    if (metadata === undefined || metadata.type === undefined || metadata.type.toLowerCase() === "geometry") {
      throw new Error("THREE.ObjectLoader: Can't load " + url);
    }
    return await this.parseAsync(json);
  }
  /**
   * Parses the given JSON. This is used internally by {@link ObjectLoader#load}
   * but can also be used directly to parse a previously loaded JSON structure.
   *
   * @param json - The serialized 3D object.
   * @param onLoad - Executed when all resources (e.g. textures) have been fully loaded.
   * @return The parsed 3D object.
   */
  parse(json: any, onLoad?: (value: Object3D) => void, onError?: (error: unknown) => void): Object3D {
    const animations = this.parseAnimations(json.animations);
    const shapes = this.parseShapes(json.shapes);
    const geometries = this.parseGeometries(json.geometries, shapes);
    const images = this.parseImages(
      json.images,
      function () {
        if (onLoad !== undefined) onLoad(object);
      },
      onError,
    );
    const textures = this.parseTextures(json.textures, images);
    const materials = this.parseMaterials(json.materials, textures);
    const object = this.parseObject(json.object, geometries, materials, textures, animations);
    const skeletons = this.parseSkeletons(json.skeletons, object);
    this.bindSkeletons(object, skeletons);
    this.bindLightTargets(object);
    //
    if (onLoad !== undefined) {
      let hasImages = false;
      for (const uuid in images) {
        if (
          (images as any)[uuid].data instanceof HTMLImageElement ||
          (Array.isArray((images as any)[uuid].data) &&
            (images as any)[uuid].data.some((image?: any) => image instanceof HTMLImageElement))
        ) {
          hasImages = true;
          break;
        }
      }
      if (hasImages === false) onLoad(object);
    }
    return object;
  }
  /**
   * Async version of {@link ObjectLoader#parse}.
   *
   * @param json - The serialized 3D object.
   * @return A Promise that resolves with the parsed 3D object.
   */
  async parseAsync(json?: any): Promise<Object3D> {
    const animations = this.parseAnimations(json.animations);
    const shapes = this.parseShapes(json.shapes);
    const geometries = this.parseGeometries(json.geometries, shapes);
    const images = await this.parseImagesAsync(json.images);
    const textures = this.parseTextures(json.textures, images);
    const materials = this.parseMaterials(json.materials, textures);
    const object = this.parseObject(json.object, geometries, materials, textures, animations);
    const skeletons = this.parseSkeletons(json.skeletons, object);
    this.bindSkeletons(object, skeletons);
    this.bindLightTargets(object);
    return object;
  }
  // internals
  parseShapes(json?: any) {
    const shapes: any = {};
    if (json !== undefined) {
      for (let i = 0, l = json.length; i < l; i++) {
        const shape = new Shape().fromJSON(json[i], (this.factories as any).createCurve || missingCurve);
        (shapes as any)[shape.uuid] = shape;
      }
    }
    return shapes;
  }
  parseSkeletons(json: any, object?: any) {
    const skeletons: any = {};
    const bones: any = {};
    // generate bone lookup table
    object.traverse(function (child?: any) {
      if (child.isBone) (bones as any)[child.uuid] = child;
    });
    // create skeletons
    if (json !== undefined) {
      for (let i = 0, l = json.length; i < l; i++) {
        const skeleton = new Skeleton().fromJSON(json[i], bones);
        (skeletons as any)[skeleton.uuid] = skeleton;
      }
    }
    return skeletons;
  }
  parseGeometries(json: any, shapes?: any) {
    const geometries: any = {};
    if (json !== undefined) {
      const bufferGeometryLoader = new BufferGeometryLoader(this.manager);
      for (let i = 0, l = json.length; i < l; i++) {
        let geometry: any;
        const data = json[i];
        switch (data.type) {
          case "BufferGeometry":
          case "InstancedBufferGeometry":
            geometry = bufferGeometryLoader.parse(data);
            break;
          default: {
            const factory = (this.factories as any).geometries;
            if (!factory || !Object.hasOwn(factory, data.type))
              throw new Error('ObjectLoader: Unknown geometry type "' + data.type + '".');
            geometry = factory[data.type].fromJSON(data, shapes);
          }
        }
        geometry.uuid = data.uuid;
        if (data.name !== undefined) geometry.name = data.name;
        if (data.userData !== undefined) geometry.userData = data.userData;
        (geometries as any)[data.uuid] = geometry;
      }
    }
    return geometries;
  }
  parseMaterials(json: any, textures?: any) {
    const cache: any = {}; // MultiMaterial
    const materials: any = {};
    if (json !== undefined) {
      const loader = new MaterialLoader(this.manager, (this.factories as any).materials);
      loader.setTextures(textures);
      for (let i = 0, l = json.length; i < l; i++) {
        const data = json[i];
        if ((cache as any)[data.uuid] === undefined) {
          (cache as any)[data.uuid] = loader.parse(data);
        }
        (materials as any)[data.uuid] = (cache as any)[data.uuid];
      }
    }
    return materials;
  }
  parseAnimations(json?: any) {
    const animations: any = {};
    if (json !== undefined) {
      for (let i = 0; i < json.length; i++) {
        const data = json[i];
        const clip = AnimationClip.parse(data);
        (animations as any)[clip.uuid] = clip;
      }
    }
    return animations;
  }
  parseImages(json: any, onLoad: any, onError?: (error: unknown) => void) {
    const images: any = {};
    let loader: any;
    let failed = false;
    const loadImage = (url?: any) => {
      url = this.manager.resolveURL(url);
      this.manager.itemStart(url);
      return loader.load(
        url,
        () => {
          this.manager.itemEnd(url);
        },
        undefined,
        (event?: any) => {
          failed = true;
          if (onError !== undefined) onError(event);
          this.manager.itemError(url);
          this.manager.itemEnd(url);
        },
      );
    };
    const deserializeImage = (image?: any) => {
      if (typeof image === "string") {
        const url = image;
        const path = /^(\/\/)|([a-z]+:(\/\/)?)/i.test(url) ? url : this.resourcePath + url;
        return loadImage(path);
      } else {
        if (image.data) {
          return {
            data: getTypedArray(image.type, image.data),
            width: image.width,
            height: image.height,
          };
        } else {
          return null;
        }
      }
    };
    if (json !== undefined && json.length > 0) {
      const manager = new LoadingManager(function () {
        if (!failed && onLoad !== undefined) onLoad();
      });
      loader = new ImageLoader(manager);
      loader.setPriority(this.priority);
      loader.setCache(this.cache);
      loader.setCrossOrigin(this.crossOrigin);
      for (let i = 0, il = json.length; i < il; i++) {
        const image = json[i];
        const url = image.url;
        if (Array.isArray(url)) {
          // load array of images e.g CubeTexture
          const imageArray: any[] = [];
          for (let j = 0, jl = url.length; j < jl; j++) {
            const currentUrl = url[j];
            const deserializedImage = deserializeImage(currentUrl);
            if (deserializedImage !== null) {
              if (deserializedImage instanceof HTMLImageElement) {
                imageArray.push(deserializedImage);
              } else {
                // special case: handle array of data textures for cube textures
                imageArray.push(
                  new DataTexture(deserializedImage.data, deserializedImage.width, deserializedImage.height),
                );
              }
            }
          }
          (images as any)[image.uuid] = new TextureSource(imageArray);
        } else {
          // load single image
          const deserializedImage = deserializeImage(image.url);
          (images as any)[image.uuid] = new TextureSource(deserializedImage);
        }
      }
    }
    for (const uuid in images) (images as any)[uuid].uuid = uuid;
    return images;
  }
  async parseImagesAsync(json?: any) {
    const images: any = {};
    let loader: any;
    const deserializeImage = async (image?: any) => {
      if (typeof image === "string") {
        const url = image;
        const path = /^(\/\/)|([a-z]+:(\/\/)?)/i.test(url) ? url : this.resourcePath + url;
        return await loader.loadAsync(path);
      } else {
        if (image.data) {
          return {
            data: getTypedArray(image.type, image.data),
            width: image.width,
            height: image.height,
          };
        } else {
          return null;
        }
      }
    };
    if (json !== undefined && json.length > 0) {
      loader = new ImageLoader(this.manager);
      loader.setPriority(this.priority);
      loader.setCache(this.cache);
      loader.setCrossOrigin(this.crossOrigin);
      for (let i = 0, il = json.length; i < il; i++) {
        const image = json[i];
        const url = image.url;
        if (Array.isArray(url)) {
          // load array of images e.g CubeTexture
          const imageArray: any[] = [];
          for (let j = 0, jl = url.length; j < jl; j++) {
            const currentUrl = url[j];
            const deserializedImage = await deserializeImage(currentUrl);
            if (deserializedImage !== null) {
              if (deserializedImage instanceof HTMLImageElement) {
                imageArray.push(deserializedImage);
              } else {
                // special case: handle array of data textures for cube textures
                imageArray.push(
                  new DataTexture(deserializedImage.data, deserializedImage.width, deserializedImage.height),
                );
              }
            }
          }
          (images as any)[image.uuid] = new TextureSource(imageArray);
        } else {
          // load single image
          const deserializedImage = await deserializeImage(image.url);
          (images as any)[image.uuid] = new TextureSource(deserializedImage);
        }
      }
    }
    for (const uuid in images) (images as any)[uuid].uuid = uuid;
    return images;
  }
  parseTextures(json: any, images?: any) {
    function parseConstant(value: any, type?: any) {
      if (typeof value === "number") return value;
      warn("ObjectLoader.parseTexture: Constant should be in numeric form.", value);
      return type[value];
    }
    const textures: any = {};
    if (json !== undefined) {
      for (let i = 0, l = json.length; i < l; i++) {
        const data = json[i];
        if (data.image === undefined) {
          warn('ObjectLoader: No "image" specified for', data.uuid);
        }
        if (images[data.image] === undefined) {
          warn("ObjectLoader: Undefined image", data.image);
        }
        const source = images[data.image];
        const image = source.data;
        let texture: any;
        if (Array.isArray(image)) {
          texture = new CubeTexture();
          if (image.length === 6) texture.needsUpdate = true;
        } else {
          if (image && image.data) {
            texture = new DataTexture();
          } else {
            texture = new Texture();
          }
          if (image) texture.needsUpdate = true; // textures can have undefined image data
        }
        texture.source = source;
        texture.uuid = data.uuid;
        if (data.name !== undefined) texture.name = data.name;
        if (data.mapping !== undefined) texture.mapping = parseConstant(data.mapping, TEXTURE_MAPPING);
        if (data.channel !== undefined) texture.channel = data.channel;
        if (data.offset !== undefined) texture.offset.fromArray(data.offset);
        if (data.repeat !== undefined) texture.repeat.fromArray(data.repeat);
        if (data.center !== undefined) texture.center.fromArray(data.center);
        if (data.rotation !== undefined) texture.rotation = data.rotation;
        if (data.wrap !== undefined) {
          texture.wrapS = parseConstant(data.wrap[0], TEXTURE_WRAPPING);
          texture.wrapT = parseConstant(data.wrap[1], TEXTURE_WRAPPING);
        }
        if (data.format !== undefined) texture.format = data.format;
        if (data.internalFormat !== undefined) texture.internalFormat = data.internalFormat;
        if (data.type !== undefined) texture.type = data.type;
        if (data.colorSpace !== undefined) texture.colorSpace = data.colorSpace;
        if (data.minFilter !== undefined) texture.minFilter = parseConstant(data.minFilter, TEXTURE_FILTER);
        if (data.magFilter !== undefined) texture.magFilter = parseConstant(data.magFilter, TEXTURE_FILTER);
        if (data.anisotropy !== undefined) texture.anisotropy = data.anisotropy;
        if (data.flipY !== undefined) texture.flipY = data.flipY;
        if (data.generateMipmaps !== undefined) texture.generateMipmaps = data.generateMipmaps;
        if (data.mipmapsAutoUpdate !== undefined) texture.mipmapsAutoUpdate = data.mipmapsAutoUpdate;
        if (data.premultiplyAlpha !== undefined) texture.premultiplyAlpha = data.premultiplyAlpha;
        if (data.unpackAlignment !== undefined) texture.unpackAlignment = data.unpackAlignment;
        if (data.compareFunction !== undefined) (texture as any).compareFunction = data.compareFunction;
        if (data.normalized !== undefined) texture.normalized = data.normalized;
        if (data.userData !== undefined) texture.userData = data.userData;
        (textures as any)[data.uuid] = texture;
      }
    }
    return textures;
  }
  parseObject(data?: any, geometries: any = {}, materials: any = {}, textures: any = {}, animations: any = {}) {
    let object: any;
    function getGeometry(name?: any) {
      if ((geometries as any)[name] === undefined) {
        warn("ObjectLoader: Undefined geometry", name);
      }
      return (geometries as any)[name];
    }
    function getMaterial(name?: any) {
      if (name === undefined) return undefined;
      if (Array.isArray(name)) {
        const array: any[] = [];
        for (let i = 0, l = name.length; i < l; i++) {
          const uuid = name[i];
          if ((materials as any)[uuid] === undefined) {
            warn("ObjectLoader: Undefined material", uuid);
          }
          array.push((materials as any)[uuid]);
        }
        return array;
      }
      if ((materials as any)[name] === undefined) {
        warn("ObjectLoader: Undefined material", name);
      }
      return (materials as any)[name];
    }
    function getTexture(uuid?: any) {
      if ((textures as any)[uuid] === undefined) {
        warn("ObjectLoader: Undefined texture", uuid);
      }
      return (textures as any)[uuid];
    }
    let geometry: any, material: any;
    switch (data.type) {
      case "Scene":
        object = this.createObject("Scene");
        if (data.background !== undefined) {
          if (Number.isInteger(data.background)) {
            object.background = new Color(data.background);
          } else {
            object.background = getTexture(data.background);
          }
        }
        if (data.environment !== undefined) {
          object.environment = getTexture(data.environment);
        }
        if (data.fog !== undefined) {
          if (data.fog.type === "Fog") {
            object.fog = new Fog(data.fog.color, data.fog.near, data.fog.far);
          } else if (data.fog.type === "FogExp2") {
            object.fog = new FogExp2(data.fog.color, data.fog.density);
          }
          if (data.fog.name !== "") {
            object.fog.name = data.fog.name;
          }
        }
        if (data.backgroundBlurriness !== undefined) object.backgroundBlurriness = data.backgroundBlurriness;
        if (data.backgroundIntensity !== undefined) object.backgroundIntensity = data.backgroundIntensity;
        if (data.backgroundRotation !== undefined) object.backgroundRotation.fromArray(data.backgroundRotation);
        if (data.environmentIntensity !== undefined) object.environmentIntensity = data.environmentIntensity;
        if (data.environmentRotation !== undefined) object.environmentRotation.fromArray(data.environmentRotation);
        break;
      case "PerspectiveCamera":
        object = this.createObject("PerspectiveCamera", data.fov, data.aspect, data.near, data.far);
        if (data.focus !== undefined) object.focus = data.focus;
        if (data.zoom !== undefined) object.zoom = data.zoom;
        if (data.filmGauge !== undefined) object.filmGauge = data.filmGauge;
        if (data.filmOffset !== undefined) object.filmOffset = data.filmOffset;
        if (data.view !== undefined) object.view = Object.assign({}, data.view);
        break;
      case "OrthographicCamera":
        object = this.createObject(
          "OrthographicCamera",
          data.left,
          data.right,
          data.top,
          data.bottom,
          data.near,
          data.far,
        );
        if (data.zoom !== undefined) object.zoom = data.zoom;
        if (data.view !== undefined) object.view = Object.assign({}, data.view);
        break;
      case "AmbientLight":
        object = this.createObject("AmbientLight", data.color, data.intensity);
        break;
      case "DirectionalLight":
        object = this.createObject("DirectionalLight", data.color, data.intensity);
        object.target = data.target || "";
        break;
      case "PointLight":
        object = this.createObject("PointLight", data.color, data.intensity, data.distance, data.decay);
        break;
      case "RectAreaLight":
        object = this.createObject("RectAreaLight", data.color, data.intensity, data.width, data.height);
        break;
      case "SpotLight":
        object = this.createObject(
          "SpotLight",
          data.color,
          data.intensity,
          data.distance,
          data.angle,
          data.penumbra,
          data.decay,
        );
        object.target = data.target || "";
        if (data.map !== undefined) object.map = getTexture(data.map);
        break;
      case "HemisphereLight":
        object = this.createObject("HemisphereLight", data.color, data.groundColor, data.intensity);
        break;
      case "LightProbe":
        const sh = new SphericalHarmonics3().fromArray(data.sh);
        object = this.createObject("LightProbe", sh, data.intensity);
        break;
      case "SkinnedMesh":
        geometry = getGeometry(data.geometry);
        material = getMaterial(data.material);
        object = this.createObject("SkinnedMesh", geometry, material);
        if (data.bindMode !== undefined) object.bindMode = data.bindMode;
        if (data.bindMatrix !== undefined) object.bindMatrix.fromArray(data.bindMatrix);
        if (data.skeleton !== undefined) object.skeleton = data.skeleton;
        break;
      case "Mesh":
        geometry = getGeometry(data.geometry);
        material = getMaterial(data.material);
        object = this.createObject("Mesh", geometry, material);
        break;
      case "InstancedMesh":
        geometry = getGeometry(data.geometry);
        material = getMaterial(data.material);
        const count = data.count;
        const instanceMatrix = data.instanceMatrix;
        const instanceColor = data.instanceColor;
        object = this.createObject("InstancedMesh", geometry, material, count);
        object.instanceMatrix = new InstancedBufferAttribute(new Float32Array(instanceMatrix.array), 16);
        if (instanceColor !== undefined)
          object.instanceColor = new InstancedBufferAttribute(
            new Float32Array(instanceColor.array),
            instanceColor.itemSize,
          );
        break;
      case "BatchedMesh":
        geometry = getGeometry(data.geometry);
        material = getMaterial(data.material);
        object = this.createObject(
          "BatchedMesh",
          data.maxInstanceCount,
          data.maxVertexCount,
          data.maxIndexCount,
          material,
        );
        object.geometry = geometry;
        object.perObjectFrustumCulled = data.perObjectFrustumCulled;
        object.sortObjects = data.sortObjects;
        object._drawRanges = data.drawRanges;
        object._reservedRanges = data.reservedRanges;
        object._geometryInfo = data.geometryInfo.map((info?: any) => {
          let box: any = null;
          let sphere: any = null;
          if (info.boundingBox !== undefined) {
            box = new Box3().fromJSON(info.boundingBox);
          }
          if (info.boundingSphere !== undefined) {
            sphere = new Sphere().fromJSON(info.boundingSphere);
          }
          return {
            ...info,
            boundingBox: box,
            boundingSphere: sphere,
          };
        });
        object._instanceInfo = data.instanceInfo;
        object._availableInstanceIds = data.availableInstanceIds;
        object._availableGeometryIds = data.availableGeometryIds;
        object._nextIndexStart = data.nextIndexStart;
        object._nextVertexStart = data.nextVertexStart;
        object._geometryCount = data.geometryCount;
        object._maxInstanceCount = data.maxInstanceCount;
        object._maxVertexCount = data.maxVertexCount;
        object._maxIndexCount = data.maxIndexCount;
        object._geometryInitialized = data.geometryInitialized;
        object._matricesTexture = getTexture(data.matricesTexture.uuid);
        object._indirectTexture = getTexture(data.indirectTexture.uuid);
        if (data.colorsTexture !== undefined) {
          object._colorsTexture = getTexture(data.colorsTexture.uuid);
        }
        if (data.boundingSphere !== undefined) {
          object.boundingSphere = new Sphere().fromJSON(data.boundingSphere);
        }
        if (data.boundingBox !== undefined) {
          object.boundingBox = new Box3().fromJSON(data.boundingBox);
        }
        break;
      case "LOD":
        object = this.createObject("LOD");
        break;
      case "Line":
        object = this.createObject("Line", getGeometry(data.geometry), getMaterial(data.material));
        break;
      case "LineLoop":
        object = this.createObject("LineLoop", getGeometry(data.geometry), getMaterial(data.material));
        break;
      case "LineSegments":
        object = this.createObject("LineSegments", getGeometry(data.geometry), getMaterial(data.material));
        break;
      case "PointCloud":
      case "Points":
        object = this.createObject("Points", getGeometry(data.geometry), getMaterial(data.material));
        break;
      case "Sprite":
        object = this.createObject("Sprite", getMaterial(data.material));
        if (data.center !== undefined) object.center.fromArray(data.center);
        break;
      case "Group":
        object = this.createObject("Group");
        break;
      case "Bone":
        object = this.createObject("Bone");
        break;
      default:
        object = this.createObject(data.type);
    }
    object.uuid = data.uuid;
    if (data.name !== undefined) object.name = data.name;
    if (data.pivot !== undefined) object.pivot = new Vector3().fromArray(data.pivot);
    if (data.matrix !== undefined) {
      object.matrix.fromArray(data.matrix);
      if (data.matrixAutoUpdate !== undefined) object.matrixAutoUpdate = data.matrixAutoUpdate;
      if (object.matrixAutoUpdate) {
        object.matrix.decompose(object.position, object.quaternion, object.scale);
        if (object.pivot !== null) object.position.copy(object.pivot).applyMatrix4(object.matrix).sub(object.pivot);
      }
    } else {
      if (data.position !== undefined) object.position.fromArray(data.position);
      if (data.rotation !== undefined) object.rotation.fromArray(data.rotation);
      if (data.quaternion !== undefined) object.quaternion.fromArray(data.quaternion);
      if (data.scale !== undefined) object.scale.fromArray(data.scale);
    }
    if (data.up !== undefined) object.up.fromArray(data.up);
    if (data.morphTargetDictionary !== undefined)
      object.morphTargetDictionary = Object.assign({}, data.morphTargetDictionary);
    if (data.morphTargetInfluences !== undefined) object.morphTargetInfluences = data.morphTargetInfluences.slice();
    if (data.castShadow !== undefined) object.castShadow = data.castShadow;
    if (data.receiveShadow !== undefined) object.receiveShadow = data.receiveShadow;
    if (data.shadow) {
      if (data.shadow.intensity !== undefined) object.shadow.intensity = data.shadow.intensity;
      if (data.shadow.bias !== undefined) object.shadow.bias = data.shadow.bias;
      if (data.shadow.normalBias !== undefined) object.shadow.normalBias = data.shadow.normalBias;
      if (data.shadow.radius !== undefined) object.shadow.radius = data.shadow.radius;
      if (data.shadow.blurSamples !== undefined) object.shadow.blurSamples = data.shadow.blurSamples;
      if (data.shadow.focus !== undefined) object.shadow.focus = data.shadow.focus;
      if (data.shadow.aspect !== undefined) object.shadow.aspect = data.shadow.aspect;
      if (data.shadow.mapSize !== undefined) object.shadow.mapSize.fromArray(data.shadow.mapSize);
      if (data.shadow.mapType !== undefined) object.shadow.mapType = data.shadow.mapType;
      if (data.shadow.camera !== undefined) object.shadow.camera = this.parseObject(data.shadow.camera);
    }
    if (data.visible !== undefined) object.visible = data.visible;
    if (data.frustumCulled !== undefined) object.frustumCulled = data.frustumCulled;
    if (data.renderOrder !== undefined) object.renderOrder = data.renderOrder;
    if (data.static !== undefined) object.static = data.static;
    if (data.userData !== undefined) object.userData = data.userData;
    if (data.layers !== undefined) object.layers.mask = data.layers;
    if (data.children !== undefined) {
      const children = data.children;
      for (let i = 0; i < children.length; i++) {
        object.add(this.parseObject(children[i], geometries, materials, textures, animations));
      }
    }
    if (data.animations !== undefined) {
      const objectAnimations = data.animations;
      for (let i = 0; i < objectAnimations.length; i++) {
        const uuid = objectAnimations[i];
        object.animations.push((animations as any)[uuid]);
      }
    }
    if (data.type === "LOD") {
      if (data.autoUpdate !== undefined) object.autoUpdate = data.autoUpdate;
      const levels = data.levels;
      for (let l = 0; l < levels.length; l++) {
        const level = levels[l];
        const child = object.getObjectByProperty("uuid", level.object);
        if (child !== undefined) {
          object.addLevel(child, level.distance, level.hysteresis);
        }
      }
    }
    return object;
  }
  bindSkeletons(object: any, skeletons?: any) {
    if (Object.keys(skeletons).length === 0) return;
    object.traverse(function (child?: any) {
      if (child.isSkinnedMesh === true && child.skeleton !== undefined) {
        const skeleton = skeletons[child.skeleton];
        if (skeleton === undefined) {
          warn("ObjectLoader: No skeleton found with UUID:", child.skeleton);
        } else {
          child.bind(skeleton, child.bindMatrix);
        }
      }
    });
  }
  bindLightTargets(object?: any) {
    object.traverse(function (child?: any) {
      if (child.isDirectionalLight || child.isSpotLight) {
        const uuid = child.target;
        const target = object.getObjectByProperty("uuid", uuid);
        if (target !== undefined) {
          child.target = target;
        } else {
          child.target = new Object3D();
        }
      }
    });
  }
}
const TEXTURE_MAPPING = {
  UVMapping: Mapping.UV,
  CubeReflectionMapping: Mapping.CubeReflection,
  CubeRefractionMapping: Mapping.CubeRefraction,
  EquirectangularReflectionMapping: Mapping.EquirectangularReflection,
  EquirectangularRefractionMapping: Mapping.EquirectangularRefraction,
};
const TEXTURE_WRAPPING = {
  RepeatWrapping: Wrapping.Repeat,
  ClampToEdgeWrapping: Wrapping.ClampToEdge,
  MirroredRepeatWrapping: Wrapping.MirroredRepeat,
};
const TEXTURE_FILTER = {
  NearestFilter: TextureFilter.Nearest,
  NearestMipmapNearestFilter: TextureFilter.NearestMipmapNearest,
  NearestMipmapLinearFilter: TextureFilter.NearestMipmapLinear,
  LinearFilter: TextureFilter.Linear,
  LinearMipmapNearestFilter: TextureFilter.LinearMipmapNearest,
  LinearMipmapLinearFilter: TextureFilter.LinearMipmapLinear,
};
