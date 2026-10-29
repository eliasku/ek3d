import type { LoadingManager } from "./LoadingManager";
import { InstancedInterleavedBuffer } from "../core/InstancedInterleavedBuffer";
import { Sphere } from "../math/Sphere";
import { BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
import { FileLoader } from "./FileLoader";
import { Loader } from "./Loader";
import { InstancedBufferGeometry } from "../core/InstancedBufferGeometry";
import { InstancedBufferAttribute } from "../core/InstancedBufferAttribute";
import { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import { InterleavedBuffer } from "../core/InterleavedBuffer";
import { getTypedArray, error } from "../utils";
/**
 * Class for loading geometries. The files are internally
 * loaded via {@link FileLoader}.
 *
 * ```ts
 * import { BufferGeometryLoader } from 'ek3d/loaders/BufferGeometryLoader';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const loader = new BufferGeometryLoader();
 * const geometry = await loader.loadAsync( 'models/json/pressure.json' );
 *
 * const material = new MeshBasicMaterial( { color: 0xF5F5F5 } );
 * const object = new Mesh( geometry, material );
 * scene.add( object );
 * ```
 *
 */
export class BufferGeometryLoader extends Loader<BufferGeometry> {
  /**
   * Constructs a new geometry loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }
  /**
   * Starts loading from the given URL and pass the loaded geometry to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  load(
    url: string,
    onLoad: (value: BufferGeometry) => void,
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
   * Parses the given JSON object and returns a geometry.
   *
   * @param json - The serialized geometry.
   * @return The parsed geometry.
   */
  parse(json?: any): BufferGeometry {
    if (json.type !== undefined && json.type !== "BufferGeometry" && json.type !== "InstancedBufferGeometry")
      throw new Error('BufferGeometryLoader: Unknown geometry type "' + json.type + '".');
    const interleavedBufferMap: any = {};
    const arrayBufferMap: any = {};
    function getInterleavedBuffer(json: any, uuid?: any) {
      if ((interleavedBufferMap as any)[uuid] !== undefined) return (interleavedBufferMap as any)[uuid];
      const interleavedBuffers = json.interleavedBuffers;
      const interleavedBuffer = interleavedBuffers[uuid];
      const buffer = getArrayBuffer(json, interleavedBuffer.buffer);
      const array = getTypedArray(interleavedBuffer.type, buffer);
      const ib = interleavedBuffer.isInstancedInterleavedBuffer
        ? new InstancedInterleavedBuffer(array, interleavedBuffer.stride, interleavedBuffer.meshPerAttribute)
        : new InterleavedBuffer(array, interleavedBuffer.stride);
      ib.uuid = interleavedBuffer.uuid;
      if (interleavedBuffer.usage !== undefined) ib.setUsage(interleavedBuffer.usage);
      (interleavedBufferMap as any)[uuid] = ib;
      return ib;
    }
    function getArrayBuffer(json: any, uuid?: any) {
      if ((arrayBufferMap as any)[uuid] !== undefined) return (arrayBufferMap as any)[uuid];
      const arrayBuffers = json.arrayBuffers;
      const arrayBuffer = arrayBuffers[uuid];
      const ab = new Uint32Array(arrayBuffer).buffer;
      (arrayBufferMap as any)[uuid] = ab;
      return ab;
    }
    const geometry = json.isInstancedBufferGeometry ? new InstancedBufferGeometry() : new BufferGeometry();
    if (json.instanceCount !== undefined) (geometry as any).instanceCount = json.instanceCount;
    const index = json.data.index;
    if (index !== undefined) {
      const typedArray = getTypedArray(index.type, index.array);
      geometry.setIndex(new BufferAttribute(typedArray, 1));
    }
    const attributes = json.data.attributes;
    for (const key in attributes) {
      const attribute = attributes[key];
      let bufferAttribute: any;
      if (attribute.isInterleavedBufferAttribute) {
        const interleavedBuffer = getInterleavedBuffer(json.data, attribute.data);
        bufferAttribute = new InterleavedBufferAttribute(
          interleavedBuffer,
          attribute.itemSize,
          attribute.offset,
          attribute.normalized,
        );
      } else {
        const typedArray = getTypedArray(attribute.type, attribute.array);
        bufferAttribute = attribute.isInstancedBufferAttribute
          ? new InstancedBufferAttribute(
              typedArray,
              attribute.itemSize,
              attribute.normalized,
              attribute.meshPerAttribute,
            )
          : new BufferAttribute(typedArray, attribute.itemSize, attribute.normalized);
      }
      if (attribute.name !== undefined) bufferAttribute.name = attribute.name;
      if (attribute.usage !== undefined) (bufferAttribute as any).setUsage(attribute.usage);
      if (attribute.gpuType !== undefined) (bufferAttribute as any).gpuType = attribute.gpuType;
      geometry.setAttribute(key, bufferAttribute);
    }
    const morphAttributes = json.data.morphAttributes;
    if (morphAttributes) {
      for (const key in morphAttributes) {
        const attributeArray = morphAttributes[key];
        const array: any[] = [];
        for (let i = 0, il = attributeArray.length; i < il; i++) {
          const attribute = attributeArray[i];
          let bufferAttribute: any;
          if (attribute.isInterleavedBufferAttribute) {
            const interleavedBuffer = getInterleavedBuffer(json.data, attribute.data);
            bufferAttribute = new InterleavedBufferAttribute(
              interleavedBuffer,
              attribute.itemSize,
              attribute.offset,
              attribute.normalized,
            );
          } else {
            const typedArray = getTypedArray(attribute.type, attribute.array);
            bufferAttribute = new BufferAttribute(typedArray, attribute.itemSize, attribute.normalized);
          }
          if (attribute.name !== undefined) bufferAttribute.name = attribute.name;
          if (attribute.usage !== undefined) (bufferAttribute as any).setUsage(attribute.usage);
          if (attribute.gpuType !== undefined) (bufferAttribute as any).gpuType = attribute.gpuType;
          array.push(bufferAttribute);
        }
        geometry.morphAttributes[key] = array;
      }
    }
    const morphTargetsRelative = json.data.morphTargetsRelative;
    if (morphTargetsRelative) {
      geometry.morphTargetsRelative = true;
    }
    const groups = json.data.groups || json.data.drawcalls || json.data.offsets;
    if (groups !== undefined) {
      for (let i = 0, n = groups.length; i !== n; ++i) {
        const group = groups[i];
        geometry.addGroup(group.start, group.count, group.materialIndex);
      }
    }
    const boundingSphere = json.data.boundingSphere;
    if (boundingSphere !== undefined) {
      geometry.boundingSphere = new Sphere().fromJSON(boundingSphere);
    }
    if (json.uuid !== undefined) geometry.uuid = json.uuid;
    if (json.name) geometry.name = json.name;
    if (json.userData) geometry.userData = json.userData;
    return geometry;
  }
}
