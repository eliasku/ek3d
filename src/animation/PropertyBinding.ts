import type { AnimationBuffer } from "../math/Interpolant";
import type { AnimationObjectGroup } from "./AnimationObjectGroup";
import type { Object3D } from "../core/Object3D";
import { warn, error } from "../utils";

export interface ParsedTrackPath {
  nodeName?: string;
  objectName?: string;
  objectIndex?: string | number;
  propertyName: string;
  propertyIndex?: string | number;
}
type BindingAccessor = (buffer: AnimationBuffer, offset: number) => void;
export interface AnimationBinding {
  getValue: BindingAccessor;
  setValue: BindingAccessor;
  bind(): void;
  unbind(): void;
}
type BoundProperty = AnimationBuffer & {
  toArray(buffer: AnimationBuffer, offset: number): void;
  fromArray(buffer: AnimationBuffer, offset: number): void;
};
// Runtime path traversal validates these states before choosing a bound getter/setter.
type BindingTarget = { [key: string]: BindingTarget } & {
  length: number;
  name: string;
  isMaterial: boolean;
  isObject3D: boolean;
  materials: BindingTarget;
  material: BindingTarget;
  map?: BindingTarget;
  skeleton: { bones: BindingTarget };
  geometry: { morphAttributes: object };
  morphTargetDictionary: Record<string, number>;
};
// Characters [].:/ are reserved for track binding syntax.
const _RESERVED_CHARS_RE = "\\[\\]\\.:\\/";
const _reservedRe = new RegExp("[" + _RESERVED_CHARS_RE + "]", "g");
// Attempts to allow node names from any language. ES5's `\w` regexp matches
// only latin characters, and the unicode \p{L} is not yet supported. So
// instead, we exclude reserved characters and match everything else.
const _wordChar = "[^" + _RESERVED_CHARS_RE + "]";
const _wordCharOrDot = "[^" + _RESERVED_CHARS_RE.replace("\\.", "") + "]";
// Parent directories, delimited by '/' or ':'. Currently unused, but must
// be matched to parse the rest of the track name.
const _directoryRe = /*@__PURE__*/ /((?:WC+[/:])*)/.source.replace("WC", _wordChar);
// Target node. May contain word characters (a-zA-Z0-9_) and '.' or '-'.
const _nodeRe = /*@__PURE__*/ /(WCOD+)?/.source.replace("WCOD", _wordCharOrDot);
// Object on target node, and accessor. May not contain reserved
// characters. Accessor may contain any character except closing bracket.
const _objectRe = /*@__PURE__*/ /(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC", _wordChar);
// Property and accessor. May not contain reserved characters. Accessor may
// contain any non-bracket characters.
const _propertyRe = /*@__PURE__*/ /\.(WC+)(?:\[(.+)\])?/.source.replace("WC", _wordChar);
const _trackRe = new RegExp("" + "^" + _directoryRe + _nodeRe + _objectRe + _propertyRe + "$");
const _supportedObjectNames = ["material", "materials", "bones", "map"];
class Composite {
  _targetGroup: AnimationObjectGroup;
  rootNode: AnimationObjectGroup;
  path: string;
  _bindings: PropertyBinding[];

  constructor(targetGroup: AnimationObjectGroup, path: string, optionalParsedPath?: ParsedTrackPath) {
    const parsedPath = optionalParsedPath || PropertyBinding.parseTrackName(path);
    this._targetGroup = targetGroup;
    this.rootNode = targetGroup;
    this.path = path;
    this._bindings = targetGroup.subscribe_(path, parsedPath);
  }
  getValue(array: AnimationBuffer, offset: number) {
    this.bind(); // bind all binding
    const firstValidIndex = this._targetGroup.nCachedObjects_,
      binding = this._bindings[firstValidIndex];
    // and only call .getValue on the first
    if (binding !== undefined) binding.getValue(array, offset);
  }
  setValue(array: AnimationBuffer, offset: number) {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
      bindings[i].setValue(array, offset);
    }
  }
  bind() {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
      bindings[i].bind();
    }
  }
  unbind() {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
      bindings[i].unbind();
    }
  }
}
// Note: This class uses a State pattern on a per-method basis:
// 'bind' sets 'this.getValue' / 'setValue' and shadows the
// prototype version of these methods with one that represents
// the bound state. When the property is not found, the methods
// become no-ops.
/**
 * This holds a reference to a real property in the scene graph; used internally.
 */
export class PropertyBinding {
  path: string;
  parsedPath: ParsedTrackPath;
  node: Object3D | null;
  rootNode: Object3D;
  getValue: BindingAccessor;
  setValue: BindingAccessor;
  targetObject: any;
  resolvedProperty: BoundProperty | undefined;
  propertyIndex: any;
  propertyName: any;
  static Composite: typeof Composite = Composite;

  get BindingType(): typeof _bindingType {
    return _bindingType;
  }
  set BindingType(value: typeof _bindingType) {
    Object.defineProperty(this, "BindingType", { value, writable: true, enumerable: true, configurable: true });
  }
  get Versioning(): typeof _versioning {
    return _versioning;
  }
  set Versioning(value: typeof _versioning) {
    Object.defineProperty(this, "Versioning", { value, writable: true, enumerable: true, configurable: true });
  }
  get GetterByBindingType(): BindingAccessor[] {
    return _getterByBindingType;
  }
  set GetterByBindingType(value: BindingAccessor[]) {
    Object.defineProperty(this, "GetterByBindingType", { value, writable: true, enumerable: true, configurable: true });
  }
  get SetterByBindingTypeAndVersioning(): BindingAccessor[][] {
    return _setterByBindingTypeAndVersioning;
  }
  set SetterByBindingTypeAndVersioning(value: BindingAccessor[][]) {
    Object.defineProperty(this, "SetterByBindingTypeAndVersioning", {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  /**
   * Constructs a new property binding.
   *
   * @param rootNode - The root node.
   * @param path - The path.
   * @param [parsedPath] - The parsed path.
   */
  constructor(rootNode: Object3D, path: string, parsedPath?: ParsedTrackPath) {
    /**
     * The object path to the animated property.
     *
     */
    this.path = path;
    /**
     * An object holding information about the path.
     *
     */
    this.parsedPath = parsedPath || PropertyBinding.parseTrackName(path);
    /**
     * The object owns the animated property.
     *
     */
    this.node = PropertyBinding.findNode(rootNode, this.parsedPath.nodeName);
    /**
     * The root node.
     *
     */
    this.rootNode = rootNode;
    // initial state of these methods that calls 'bind'
    /* oxlint-disable typescript/unbound-method -- Install lazy accessors on this binding, retaining its receiver. */
    this.getValue = this._getValue_unbound;
    this.setValue = this._setValue_unbound;
    /* oxlint-enable typescript/unbound-method */
  }
  /**
   * Factory method for creating a property binding from the given parameters.
   *
   * @static
   * @param root - The root node.
   * @param path - The path.
   * @param [parsedPath] - The parsed path.
   * @return The created property binding or composite.
   */
  static create(
    root: Object3D | AnimationObjectGroup,
    path: string,
    parsedPath?: ParsedTrackPath,
  ): PropertyBinding | Composite;
  static create(root: any, path: string, parsedPath?: ParsedTrackPath): PropertyBinding | Composite {
    if (!(root && root.isAnimationObjectGroup)) {
      return new PropertyBinding(root, path, parsedPath);
    } else {
      return new PropertyBinding.Composite(root, path, parsedPath);
    }
  }
  /**
   * Replaces spaces with underscores and removes unsupported characters from
   * node names, to ensure compatibility with parseTrackName().
   *
   * @param name - Node name to be sanitized.
   * @return The sanitized node name.
   */
  static sanitizeNodeName(name: string): string {
    return name.replace(/\s/g, "_").replace(_reservedRe, "");
  }
  /**
   * Parses the given track name (an object path to an animated property) and
   * returns an object with information about the path. Matches strings in the following forms:
   *
   * - nodeName.property
   * - nodeName.property[accessor]
   * - nodeName.material.property[accessor]
   * - uuid.property[accessor]
   * - uuid.objectName[objectIndex].propertyName[propertyIndex]
   * - parentName/nodeName.property
   * - parentName/parentName/nodeName.property[index]
   * - .bone[Armature.DEF_cog].position
   * - scene:helium_balloon_model:helium_balloon_model.position
   *
   * @static
   * @param trackName - The track name to parse.
   * @return The parsed track name as an object.
   */
  static parseTrackName(trackName: string): ParsedTrackPath {
    const matches = _trackRe.exec(trackName);
    if (matches === null) {
      throw new Error("THREE.PropertyBinding: Cannot parse trackName: " + trackName);
    }
    const results: any = {
      // directoryName: matches[ 1 ], // (tschw) currently unused
      nodeName: (matches as any)[2],
      objectName: (matches as any)[3],
      objectIndex: (matches as any)[4],
      propertyName: (matches as any)[5], // required
      propertyIndex: (matches as any)[6],
    };
    const lastDot = results.nodeName && results.nodeName.lastIndexOf(".");
    if (lastDot !== undefined && lastDot !== -1) {
      const objectName = results.nodeName.substring(lastDot + 1);
      // Object names must be checked against an allowlist. Otherwise, there
      // is no way to parse 'foo.bar.baz': 'baz' must be a property, but
      // 'bar' could be the objectName, or part of a nodeName (which can
      // include '.' characters).
      if (_supportedObjectNames.indexOf(objectName) !== -1) {
        results.nodeName = results.nodeName.substring(0, lastDot);
        results.objectName = objectName;
      }
    }
    if (results.propertyName === null || results.propertyName.length === 0) {
      throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: " + trackName);
    }
    return results;
  }
  /**
   * Searches for a node in the hierarchy of the given root object by the given
   * node name.
   *
   * @static
   * @param root - The root object.
   * @param nodeName - The name of the node.
   * @return The found node. Returns `null` if no object was found.
   */
  static findNode(root: Object3D | AnimationObjectGroup, nodeName: string | number | undefined): Object3D | null;
  static findNode(root: any, nodeName?: any): Object3D | null {
    if (
      nodeName === undefined ||
      nodeName === "" ||
      nodeName === "." ||
      nodeName === -1 ||
      nodeName === root.name ||
      nodeName === root.uuid
    ) {
      return root;
    }
    // search into skeleton bones.
    if (root.skeleton) {
      const bone = root.skeleton.getBoneByName(nodeName);
      if (bone !== undefined) {
        return bone;
      }
    }
    // search into node subtree.
    if (root.children) {
      const searchNodeSubtree = function (children?: any): Object3D | null {
        for (let i = 0; i < children.length; i++) {
          const childNode = children[i];
          if (childNode.name === nodeName || childNode.uuid === nodeName) {
            return childNode;
          }
          const result = searchNodeSubtree(childNode.children);
          if (result) return result;
        }
        return null;
      };
      const subTreeNode = searchNodeSubtree(root.children);
      if (subTreeNode) {
        return subTreeNode;
      }
    }
    return null;
  }
  // these are used to "bind" a nonexistent property
  _getValue_unavailable() {}
  _setValue_unavailable() {}
  // Getters
  _getValue_direct(buffer: AnimationBuffer, offset: number) {
    buffer[offset] = this.targetObject[this.propertyName];
  }
  _getValue_array(buffer: AnimationBuffer, offset: number) {
    const source = this.resolvedProperty!;
    for (let i = 0, n = source.length; i !== n; ++i) {
      buffer[offset++] = source[i];
    }
  }
  _getValue_arrayElement(buffer: AnimationBuffer, offset: number) {
    buffer[offset] = this.resolvedProperty![this.propertyIndex];
  }
  _getValue_toArray(buffer: AnimationBuffer, offset: number) {
    this.resolvedProperty!.toArray(buffer, offset);
  }
  // Direct
  _setValue_direct(buffer: AnimationBuffer, offset: number) {
    this.targetObject[this.propertyName] = buffer[offset];
  }
  _setValue_direct_setNeedsUpdate(buffer: AnimationBuffer, offset: number) {
    this.targetObject[this.propertyName] = buffer[offset];
    this.targetObject.needsUpdate = true;
  }
  _setValue_direct_setMatrixWorldNeedsUpdate(buffer: AnimationBuffer, offset: number) {
    this.targetObject[this.propertyName] = buffer[offset];
    this.targetObject.matrixWorldNeedsUpdate = true;
  }
  // EntireArray
  _setValue_array(buffer: AnimationBuffer, offset: number) {
    const dest = this.resolvedProperty!;
    for (let i = 0, n = dest.length; i !== n; ++i) {
      dest[i] = buffer[offset++];
    }
  }
  _setValue_array_setNeedsUpdate(buffer: AnimationBuffer, offset: number) {
    const dest = this.resolvedProperty!;
    for (let i = 0, n = dest.length; i !== n; ++i) {
      dest[i] = buffer[offset++];
    }
    this.targetObject.needsUpdate = true;
  }
  _setValue_array_setMatrixWorldNeedsUpdate(buffer: AnimationBuffer, offset: number) {
    const dest = this.resolvedProperty!;
    for (let i = 0, n = dest.length; i !== n; ++i) {
      dest[i] = buffer[offset++];
    }
    this.targetObject.matrixWorldNeedsUpdate = true;
  }
  // ArrayElement
  _setValue_arrayElement(buffer: AnimationBuffer, offset: number) {
    this.resolvedProperty![this.propertyIndex] = buffer[offset];
  }
  _setValue_arrayElement_setNeedsUpdate(buffer: AnimationBuffer, offset: number) {
    this.resolvedProperty![this.propertyIndex] = buffer[offset];
    this.targetObject.needsUpdate = true;
  }
  _setValue_arrayElement_setMatrixWorldNeedsUpdate(buffer: AnimationBuffer, offset: number) {
    this.resolvedProperty![this.propertyIndex] = buffer[offset];
    this.targetObject.matrixWorldNeedsUpdate = true;
  }
  // HasToFromArray
  _setValue_fromArray(buffer: AnimationBuffer, offset: number) {
    this.resolvedProperty!.fromArray(buffer, offset);
  }
  _setValue_fromArray_setNeedsUpdate(buffer: AnimationBuffer, offset: number) {
    this.resolvedProperty!.fromArray(buffer, offset);
    this.targetObject.needsUpdate = true;
  }
  _setValue_fromArray_setMatrixWorldNeedsUpdate(buffer: AnimationBuffer, offset: number) {
    this.resolvedProperty!.fromArray(buffer, offset);
    this.targetObject.matrixWorldNeedsUpdate = true;
  }
  _getValue_unbound(targetArray: AnimationBuffer, offset: number) {
    this.bind();
    this.getValue(targetArray, offset);
  }
  _setValue_unbound(sourceArray: AnimationBuffer, offset: number) {
    this.bind();
    this.setValue(sourceArray, offset);
  }
  /**
   * Creates a getter / setter pair for the property tracked by this binding.
   */
  bind() {
    let targetObject = this.node as unknown as BindingTarget;
    const parsedPath = this.parsedPath;
    const objectName = parsedPath.objectName;
    const propertyName = parsedPath.propertyName;
    let propertyIndex = parsedPath.propertyIndex;
    if (!targetObject) {
      targetObject = PropertyBinding.findNode(this.rootNode, parsedPath.nodeName) as unknown as BindingTarget;
      this.node = targetObject as unknown as Object3D | null;
    }
    // set fail state so we can just 'return' on error
    /* oxlint-disable typescript/unbound-method -- Install unavailable-state accessors on this binding without allocating wrappers. */
    this.getValue = this._getValue_unavailable;
    this.setValue = this._setValue_unavailable;
    /* oxlint-enable typescript/unbound-method */
    // ensure there is a value node
    if (!targetObject) {
      warn("PropertyBinding: No target node found for track: " + this.path + ".");
      return;
    }
    if (objectName) {
      let objectIndex = parsedPath.objectIndex;
      // special cases were we need to reach deeper into the hierarchy to get the face materials....
      switch (objectName) {
        case "materials":
          if (!targetObject.material) {
            error("PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!targetObject.material.materials) {
            error(
              "PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",
              this,
            );
            return;
          }
          targetObject = targetObject.material.materials;
          break;
        case "bones":
          if (!targetObject.skeleton) {
            error("PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
            return;
          }
          // potential future optimization: skip this if propertyIndex is already an integer
          // and convert the integer string to a true integer.
          targetObject = targetObject.skeleton.bones;
          // support resolving morphTarget names into indices.
          for (let i = 0; i < targetObject.length; i++) {
            if (targetObject[i].name === objectIndex) {
              objectIndex = i;
              break;
            }
          }
          break;
        case "map":
          if ("map" in targetObject) {
            targetObject = targetObject.map as BindingTarget;
            break;
          }
          if (!targetObject.material) {
            error("PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!targetObject.material.map) {
            error("PropertyBinding: Can not bind to material.map as node.material does not have a map.", this);
            return;
          }
          targetObject = targetObject.material.map;
          break;
        default:
          if (targetObject[objectName] === undefined) {
            error("PropertyBinding: Can not bind to objectName of node undefined.", this);
            return;
          }
          targetObject = targetObject[objectName];
      }
      if (objectIndex !== undefined) {
        if (targetObject[objectIndex] === undefined) {
          error("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, targetObject);
          return;
        }
        targetObject = targetObject[objectIndex];
      }
    }
    // resolve property
    const nodeProperty = targetObject[propertyName];
    if (nodeProperty === undefined) {
      const nodeName = parsedPath.nodeName;
      error(
        "PropertyBinding: Trying to update property for track: " +
          nodeName +
          "." +
          propertyName +
          " but it wasn't found.",
        targetObject,
      );
      return;
    }
    // determine versioning scheme
    let versioning = this.Versioning.None;
    this.targetObject = targetObject;
    if (targetObject.isMaterial === true) {
      versioning = this.Versioning.NeedsUpdate;
    } else if (targetObject.isObject3D === true) {
      versioning = this.Versioning.MatrixWorldNeedsUpdate;
    }
    // determine how the property gets bound
    let bindingType = this.BindingType.Direct;
    if (propertyIndex !== undefined) {
      // access a sub element of the property array (only primitives are supported right now)
      if (propertyName === "morphTargetInfluences") {
        // potential optimization, skip this if propertyIndex is already an integer, and convert the integer string to a true integer.
        // support resolving morphTarget names into indices.
        if (!targetObject.geometry) {
          error("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
          return;
        }
        if (!targetObject.geometry.morphAttributes) {
          error(
            "PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",
            this,
          );
          return;
        }
        if (targetObject.morphTargetDictionary[propertyIndex] !== undefined) {
          propertyIndex = targetObject.morphTargetDictionary[propertyIndex];
        }
      }
      bindingType = this.BindingType.ArrayElement;
      this.resolvedProperty = nodeProperty as unknown as BoundProperty;
      this.propertyIndex = propertyIndex;
    } else if (nodeProperty.fromArray !== undefined && nodeProperty.toArray !== undefined) {
      // must use copy for Object3D.Euler/Quaternion
      bindingType = this.BindingType.HasFromToArray;
      this.resolvedProperty = nodeProperty as unknown as BoundProperty;
    } else if (Array.isArray(nodeProperty)) {
      bindingType = this.BindingType.EntireArray;
      this.resolvedProperty = nodeProperty as unknown as BoundProperty;
    } else {
      this.propertyName = propertyName;
    }
    // select getter / setter
    this.getValue = this.GetterByBindingType[bindingType];
    this.setValue = this.SetterByBindingTypeAndVersioning[bindingType][versioning];
  }
  /**
   * Unbinds the property.
   */
  unbind() {
    this.node = null;
    // back to the prototype version of getValue / setValue
    // note: avoiding to mutate the shape of 'this' via 'delete'
    /* oxlint-disable typescript/unbound-method -- Restore lazy accessors on this binding, retaining its receiver. */
    this.getValue = this._getValue_unbound;
    this.setValue = this._setValue_unbound;
    /* oxlint-enable typescript/unbound-method */
  }
}
// Shared dispatch tables; instances only own an override after assignment.
const _bindingType = {
  Direct: 0,
  EntireArray: 1,
  ArrayElement: 2,
  HasFromToArray: 3,
};
const _versioning = {
  None: 0,
  NeedsUpdate: 1,
  MatrixWorldNeedsUpdate: 2,
};
/* oxlint-disable typescript/unbound-method -- Shared prototype accessors are installed on each binding before invocation. */
const _getterByBindingType: BindingAccessor[] = [
  PropertyBinding.prototype._getValue_direct,
  PropertyBinding.prototype._getValue_array,
  PropertyBinding.prototype._getValue_arrayElement,
  PropertyBinding.prototype._getValue_toArray,
];
const _setterByBindingTypeAndVersioning: BindingAccessor[][] = [
  [
    // Direct
    PropertyBinding.prototype._setValue_direct,
    PropertyBinding.prototype._setValue_direct_setNeedsUpdate,
    PropertyBinding.prototype._setValue_direct_setMatrixWorldNeedsUpdate,
  ],
  [
    // EntireArray
    PropertyBinding.prototype._setValue_array,
    PropertyBinding.prototype._setValue_array_setNeedsUpdate,
    PropertyBinding.prototype._setValue_array_setMatrixWorldNeedsUpdate,
  ],
  [
    // ArrayElement
    PropertyBinding.prototype._setValue_arrayElement,
    PropertyBinding.prototype._setValue_arrayElement_setNeedsUpdate,
    PropertyBinding.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate,
  ],
  [
    // HasToFromArray
    PropertyBinding.prototype._setValue_fromArray,
    PropertyBinding.prototype._setValue_fromArray_setNeedsUpdate,
    PropertyBinding.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate,
  ],
];
/* oxlint-enable typescript/unbound-method */
