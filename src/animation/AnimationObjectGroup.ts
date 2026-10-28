import type { Object3D } from "../core/Object3D";
import type { ParsedTrackPath } from "./PropertyBinding";
import { PropertyBinding } from "./PropertyBinding";
import { generateUUID } from "../math/MathUtils";
import { error } from "../utils";
/**
 * A group of objects that receives a shared animation state.
 *
 * Usage:
 *
 * - Add objects you would otherwise pass as 'root' to the
 * constructor or the .clipAction method of AnimationMixer.
 * - Instead pass this object as 'root'.
 * - You can also add and remove objects later when the mixer is running.
 *
 * Note:
 *
 * - Objects of this class appear as one object to the mixer,
 * so cache control of the individual objects must be done on the group.
 *
 * Limitation:
 *
 * - The animated properties must be compatible among the all objects in the group.
 * - A single property can either be controlled through a target group or directly, but not both.
 */
export class AnimationObjectGroup {
  isAnimationObjectGroup: boolean;
  uuid: string;
  _objects: any[];
  nCachedObjects_: number;
  _indicesByUUID: any;
  _paths: any[];
  _parsedPaths: any[];
  _bindings: any[];
  _bindingsIndicesByPath: any;
  stats: any;

  /**
   * Constructs a new animation group.
   *
   * @param arguments - An arbitrary number of 3D objects that share the same animation state.
   */
  constructor(...objects: Object3D[]);
  constructor() {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isAnimationObjectGroup = true;
    /**
     * The UUID of the 3D object.
     *
     * @readonly
     */
    this.uuid = generateUUID();
    // cached objects followed by the active ones
    this._objects = Array.prototype.slice.call(arguments);
    this.nCachedObjects_ = 0; // threshold
    // note: read by PropertyBinding.Composite
    const indices: any = {};
    this._indicesByUUID = indices; // for bookkeeping
    for (let i = 0, n = arguments.length; i !== n; ++i) {
      (indices as any)[(arguments as any)[i].uuid] = i;
    }
    this._paths = []; // inside: string
    this._parsedPaths = []; // inside: { we don't care, here }
    this._bindings = []; // inside: Array< PropertyBinding >
    this._bindingsIndicesByPath = {}; // inside: indices in these arrays
    // oxlint-disable-next-line typescript/no-this-alias -- Stats getters have their own receiver, distinct from the group.
    const scope = this;
    this.stats = {
      objects: {
        get total() {
          return scope._objects.length;
        },
        get inUse() {
          return this.total - scope.nCachedObjects_;
        },
      },
      get bindingsPerObject() {
        return scope._bindings.length;
      },
    };
  }
  /**
   * Adds an arbitrary number of objects to this animation group.
   *
   * @param arguments - The 3D objects to add.
   */
  add(...objects: Object3D[]): void;
  add() {
    const objects = this._objects,
      indicesByUUID = this._indicesByUUID,
      paths = this._paths,
      parsedPaths = this._parsedPaths,
      bindings = this._bindings,
      nBindings = bindings.length;
    let knownObject = undefined,
      nObjects = objects.length,
      nCachedObjects = this.nCachedObjects_;
    for (let i = 0, n = arguments.length; i !== n; ++i) {
      const object = (arguments as any)[i],
        uuid = object.uuid;
      let index = (indicesByUUID as any)[uuid];
      if (index === undefined) {
        // unknown object -> add it to the ACTIVE region
        index = nObjects++;
        (indicesByUUID as any)[uuid] = index;
        objects.push(object);
        // accounting is done, now do the same for all bindings
        for (let j = 0, m = nBindings; j !== m; ++j) {
          bindings[j].push(new PropertyBinding(object, paths[j], parsedPaths[j]));
        }
      } else if (index < nCachedObjects) {
        knownObject = objects[index];
        // move existing object to the ACTIVE region
        const firstActiveIndex = --nCachedObjects,
          lastCachedObject = objects[firstActiveIndex];
        (indicesByUUID as any)[lastCachedObject.uuid] = index;
        objects[index] = lastCachedObject;
        (indicesByUUID as any)[uuid] = firstActiveIndex;
        objects[firstActiveIndex] = object;
        // accounting is done, now do the same for all bindings
        for (let j = 0, m = nBindings; j !== m; ++j) {
          const bindingsForPath = bindings[j],
            lastCached = bindingsForPath[firstActiveIndex];
          let binding = bindingsForPath[index];
          bindingsForPath[index] = lastCached;
          if (binding === undefined) {
            // since we do not bother to create new bindings
            // for objects that are cached, the binding may
            // or may not exist
            binding = new PropertyBinding(object, paths[j], parsedPaths[j]);
          }
          bindingsForPath[firstActiveIndex] = binding;
        }
      } else if (objects[index] !== knownObject) {
        error(
          "AnimationObjectGroup: Different objects with the same UUID " +
            "detected. Clean the caches or recreate your infrastructure when reloading scenes.",
        );
      } // else the object is already where we want it to be
    } // for arguments
    this.nCachedObjects_ = nCachedObjects;
  }
  /**
   * Removes an arbitrary number of objects to this animation group
   *
   * @param arguments - The 3D objects to remove.
   */
  remove(...objects: Object3D[]): void;
  remove() {
    const objects = this._objects,
      indicesByUUID = this._indicesByUUID,
      bindings = this._bindings,
      nBindings = bindings.length;
    let nCachedObjects = this.nCachedObjects_;
    for (let i = 0, n = arguments.length; i !== n; ++i) {
      const object = (arguments as any)[i],
        uuid = object.uuid,
        index = (indicesByUUID as any)[uuid];
      if (index !== undefined && index >= nCachedObjects) {
        // move existing object into the CACHED region
        const lastCachedIndex = nCachedObjects++,
          firstActiveObject = objects[lastCachedIndex];
        (indicesByUUID as any)[firstActiveObject.uuid] = index;
        objects[index] = firstActiveObject;
        (indicesByUUID as any)[uuid] = lastCachedIndex;
        objects[lastCachedIndex] = object;
        // accounting is done, now do the same for all bindings
        for (let j = 0, m = nBindings; j !== m; ++j) {
          const bindingsForPath = bindings[j],
            firstActive = bindingsForPath[lastCachedIndex],
            binding = bindingsForPath[index];
          bindingsForPath[index] = firstActive;
          bindingsForPath[lastCachedIndex] = binding;
        }
      }
    } // for arguments
    this.nCachedObjects_ = nCachedObjects;
  }
  /**
   * Deallocates all memory resources for the passed 3D objects of this animation group.
   *
   * @param arguments - The 3D objects to uncache.
   */
  uncache(...objects: Object3D[]): void;
  uncache() {
    const objects = this._objects,
      indicesByUUID = this._indicesByUUID,
      bindings = this._bindings,
      nBindings = bindings.length;
    let nCachedObjects = this.nCachedObjects_,
      nObjects = objects.length;
    for (let i = 0, n = arguments.length; i !== n; ++i) {
      const object = (arguments as any)[i],
        uuid = object.uuid,
        index = (indicesByUUID as any)[uuid];
      if (index !== undefined) {
        delete (indicesByUUID as any)[uuid];
        if (index < nCachedObjects) {
          // object is cached, shrink the CACHED region
          const firstActiveIndex = --nCachedObjects,
            lastCachedObject = objects[firstActiveIndex],
            lastIndex = --nObjects,
            lastObject = objects[lastIndex];
          if (index !== firstActiveIndex) {
            // last cached object takes this object's place
            (indicesByUUID as any)[lastCachedObject.uuid] = index;
          }
          objects[index] = lastCachedObject;
          if (firstActiveIndex !== lastIndex) {
            // last object goes to the activated slot and pop
            (indicesByUUID as any)[lastObject.uuid] = firstActiveIndex;
          }
          objects[firstActiveIndex] = lastObject;
          objects.pop();
          // accounting is done, now do the same for all bindings
          for (let j = 0, m = nBindings; j !== m; ++j) {
            const bindingsForPath = bindings[j],
              lastCached = bindingsForPath[firstActiveIndex],
              last = bindingsForPath[lastIndex];
            bindingsForPath[index] = lastCached;
            bindingsForPath[firstActiveIndex] = last;
            bindingsForPath.pop();
          }
        } else {
          // object is active, just swap with the last and pop
          const lastIndex = --nObjects,
            lastObject = objects[lastIndex];
          if (index !== lastIndex) {
            (indicesByUUID as any)[lastObject.uuid] = index;
          }
          objects[index] = lastObject;
          objects.pop();
          // accounting is done, now do the same for all bindings
          for (let j = 0, m = nBindings; j !== m; ++j) {
            const bindingsForPath = bindings[j];
            bindingsForPath[index] = bindingsForPath[lastIndex];
            bindingsForPath.pop();
          }
        } // cached or active
      } // if object is known
    } // for arguments
    this.nCachedObjects_ = nCachedObjects;
  }
  // Internal interface used by befriended PropertyBinding.Composite:
  subscribe_(path: string, parsedPath: ParsedTrackPath) {
    // returns an array of bindings for the given path that is changed
    // according to the contained objects in the group
    const indicesByPath = this._bindingsIndicesByPath;
    let index = (indicesByPath as any)[path];
    const bindings = this._bindings;
    if (index !== undefined) return bindings[index];
    const paths = this._paths,
      parsedPaths = this._parsedPaths,
      objects = this._objects,
      nObjects = objects.length,
      nCachedObjects = this.nCachedObjects_,
      bindingsForPath = Array<PropertyBinding>(nObjects);
    index = bindings.length;
    (indicesByPath as any)[path] = index;
    paths.push(path);
    parsedPaths.push(parsedPath);
    bindings.push(bindingsForPath);
    for (let i = nCachedObjects, n = objects.length; i !== n; ++i) {
      const object = objects[i];
      bindingsForPath[i] = new PropertyBinding(object, path, parsedPath);
    }
    return bindingsForPath;
  }
  unsubscribe_(path: string) {
    // tells the group to forget about a property path and no longer
    // update the array previously obtained with 'subscribe_'
    const indicesByPath = this._bindingsIndicesByPath,
      index = (indicesByPath as any)[path];
    if (index !== undefined) {
      const paths = this._paths,
        parsedPaths = this._parsedPaths,
        bindings = this._bindings,
        lastBindingsIndex = bindings.length - 1,
        lastBindings = bindings[lastBindingsIndex],
        lastBindingsPath = paths[lastBindingsIndex];
      (indicesByPath as any)[lastBindingsPath] = index;
      bindings[index] = lastBindings;
      bindings.pop();
      parsedPaths[index] = parsedPaths[lastBindingsIndex];
      parsedPaths.pop();
      paths[index] = paths[lastBindingsIndex];
      paths.pop();
    }
  }
}
