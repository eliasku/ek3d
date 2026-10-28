import { AnimationClip } from "../../animation/AnimationClip";
import { BooleanKeyframeTrack } from "../../animation/tracks/BooleanKeyframeTrack";
import { ColorKeyframeTrack } from "../../animation/tracks/ColorKeyframeTrack";
import { NumberKeyframeTrack } from "../../animation/tracks/NumberKeyframeTrack";
import { PropertyBinding } from "../../animation/PropertyBinding";
import { QuaternionKeyframeTrack } from "../../animation/tracks/QuaternionKeyframeTrack";
import { VectorKeyframeTrack } from "../../animation/tracks/VectorKeyframeTrack";
import { InterpolateDiscrete, InterpolateLinear } from "../../constants";
import type { KeyframeTrack } from "../../animation/KeyframeTrack";
import type { Group } from "../../objects/Group";
import type { Mesh } from "../../objects/Mesh";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";
import type { GLTFParser } from "./GLTFLoader";

/**
 * Animation types targeted by `KHR_animation_pointer` paths.
 */
const ANIMATION_TARGET_TYPE = {
  node: "node",
  material: "material",
  camera: "camera",
  light: "light",
} as const;

const KHR_ANIMATION_POINTER = "KHR_animation_pointer";

// Duplicated from GLTFLoader port: cubic spline tracks keep their custom
// interpolant factory; LINEAR and STEP map to the shared interpolant classes.
const INTERPOLATION = {
  CUBICSPLINE: undefined,
  LINEAR: InterpolateLinear,
  STEP: InterpolateDiscrete,
} as const;

const _animationPointerDebug = false;

/** Optional external pointer-path rewriter (see needle-tools usage of the same hook). */
export interface AnimationPointerResolver {
  resolvePath(path: string): string;
}

interface GLTFChannelTarget {
  node?: number | string;
  path: string;
  extensions?: Record<string, { pointer?: string }>;
}

interface GLTFChannel {
  sampler: number;
  target: GLTFChannelTarget;
}

interface GLTFAnimationDef {
  name?: string;
  channels: GLTFChannel[];
  samplers: { input: number; output: number; interpolation?: string }[];
  parameters?: Record<string, number>;
}

type NumericAnimationBuffer =
  | Float32Array
  | Uint32Array
  | Int32Array
  | Uint16Array
  | Int16Array
  | Uint8Array
  | Int8Array;

/** Root/leaf object surface the patched PropertyBinding.findNode walks. */
interface Object3DLike {
  uuid: string;
  name: string;
  type: string;
  getObjectByProperty(name: string, value: string): Object3DLike | undefined;
  getObjectByName(name: string): Object3DLike | undefined;
  traverse(visitor: (child: Object3DLike) => void): void;
}

/**
 * glTF loader plugin implementing `KHR_animation_pointer` (draft spec:
 * https://github.com/ux3d/glTF/tree/extensions/KHR_animation_pointer/extensions/2.0/Khronos/KHR_animation_pointer).
 *
 * Upstream ships this as the vendor module `@needle-tools/three-animation-pointer`;
 * the port carries the implementation in-package because the vendor module is
 * bundled against upstream three's module identities.
 */
export class GLTFAnimationPointerExtension {
  name: string;
  parser: GLTFParser;
  animationPointerResolver: AnimationPointerResolver | null;

  constructor(parser: GLTFParser) {
    this.name = KHR_ANIMATION_POINTER;
    this.parser = parser;

    this.animationPointerResolver = null;
  }

  setAnimationPointerResolver(animationPointerResolver: AnimationPointerResolver | null): this {
    this.animationPointerResolver = animationPointerResolver;
    return this;
  }

  /* DUPLICATE of functionality in GLTFLoader */
  loadAnimationTargetFromChannel(animationChannel: GLTFChannel): Promise<unknown> | undefined {
    const target = animationChannel.target;
    // NOTE: target.id is deprecated.
    const name = target.node !== undefined ? target.node : (target as { id?: number }).id;
    return this.parser.getDependency("node", name as number);
  }

  loadAnimationTargetFromChannelWithAnimationPointer(animationChannel: GLTFChannel): Promise<unknown> | undefined {
    _ensurePropertyBindingPatch();

    const target = animationChannel.target;
    const useExtension =
      target.extensions && target.extensions[KHR_ANIMATION_POINTER] && target.path && target.path === "pointer";
    if (!useExtension) return undefined;

    let targetProperty: string | undefined;

    // check if this is a extension animation
    let type: keyof typeof ANIMATION_TARGET_TYPE = ANIMATION_TARGET_TYPE.node;
    let targetId: number | undefined;

    const ext = target.extensions![KHR_ANIMATION_POINTER];
    let path = ext.pointer!;

    if (_animationPointerDebug) console.log("Original path: " + path, target);

    if (!path) {
      console.warn("Invalid path", ext, target);
      return undefined;
    }

    if (path.startsWith("/materials/")) type = ANIMATION_TARGET_TYPE.material;
    else if (path.startsWith("/extensions/KHR_lights_punctual/lights/")) type = ANIMATION_TARGET_TYPE.light;
    else if (path.startsWith("/cameras/")) type = ANIMATION_TARGET_TYPE.camera;

    targetId = this._tryResolveTargetId(path, type);
    if (targetId === null || Number.isNaN(targetId)) {
      console.warn("Failed resolving animation node id: " + targetId, path);
      return undefined;
    } else {
      if (_animationPointerDebug) console.log("Resolved node ID for " + type, targetId);
    }

    // TODO could be parsed better
    switch (type) {
      case ANIMATION_TARGET_TYPE.material: {
        const pathIndex = ("/materials/" + targetId.toString() + "/").length;
        const pathStart = path.substring(0, pathIndex);
        targetProperty = path.substring(pathIndex);

        switch (targetProperty) {
          // Core Spec PBR Properties
          case "pbrMetallicRoughness/baseColorFactor":
            targetProperty = "color";
            break;
          case "pbrMetallicRoughness/roughnessFactor":
            targetProperty = "roughness";
            break;
          case "pbrMetallicRoughness/metallicFactor":
            targetProperty = "metalness";
            break;
          case "emissiveFactor":
            targetProperty = "emissive";
            break;
          case "alphaCutoff":
            targetProperty = "alphaTest";
            break;
          case "occlusionTexture/strength":
            targetProperty = "aoMapIntensity";
            break;
          case "normalTexture/scale":
            targetProperty = "normalScale";
            break;

          // Core Spec + KHR_texture_transform
          case "pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/scale":
            targetProperty = "map/repeat";
            break;
          case "pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/offset":
            targetProperty = "map/offset";
            break;

          // UV transforms for anything but map doesn't seem to currently be supported in three.js
          case "emissiveTexture/extensions/KHR_texture_transform/scale":
            targetProperty = "emissiveMap/repeat";
            break;
          case "emissiveTexture/extensions/KHR_texture_transform/offset":
            targetProperty = "emissiveMap/offset";
            break;

          // KHR_materials_emissive_strength
          case "extensions/KHR_materials_emissive_strength/emissiveStrength":
            targetProperty = "emissiveIntensity";
            break;

          // KHR_materials_transmission
          case "extensions/KHR_materials_transmission/transmissionFactor":
            targetProperty = "transmission";
            break;

          // KHR_materials_ior
          case "extensions/KHR_materials_ior/ior":
            targetProperty = "ior";
            break;

          // KHR_materials_volume
          case "extensions/KHR_materials_volume/thicknessFactor":
            targetProperty = "thickness";
            break;
          case "extensions/KHR_materials_volume/attenuationColor":
            targetProperty = "attenuationColor";
            break;
          case "extensions/KHR_materials_volume/attenuationDistance":
            targetProperty = "attenuationDistance";
            break;

          // KHR_materials_iridescence
          case "extensions/KHR_materials_iridescence/iridescenceFactor":
            targetProperty = "iridescence";
            break;
          case "extensions/KHR_materials_iridescence/iridescenceIor":
            targetProperty = "iridescenceIOR";
            break;
          case "extensions/KHR_materials_iridescence/iridescenceThicknessMinimum":
            targetProperty = "iridescenceThicknessRange[0]";
            break;
          case "extensions/KHR_materials_iridescence/iridescenceThicknessMaximum":
            targetProperty = "iridescenceThicknessRange[1]";
            break;

          // KHR_materials_clearcoat
          case "extensions/KHR_materials_clearcoat/clearcoatFactor":
            targetProperty = "clearcoat";
            break;
          case "extensions/KHR_materials_clearcoat/clearcoatRoughnessFactor":
            targetProperty = "clearcoatRoughness";
            break;

          // KHR_materials_sheen
          case "extensions/KHR_materials_sheen/sheenColorFactor":
            targetProperty = "sheenColor";
            break;
          case "extensions/KHR_materials_sheen/sheenRoughnessFactor":
            targetProperty = "sheenRoughness";
            break;

          // KHR_materials_specular
          case "extensions/KHR_materials_specular/specularFactor":
            targetProperty = "specularIntensity";
            break;
          case "extensions/KHR_materials_specular/specularColorFactor":
            targetProperty = "specularColor";
            break;
        }

        path = pathStart + targetProperty;
        if (_animationPointerDebug) console.log("PROPERTY PATH", pathStart, targetProperty, path);
        break;
      }

      case ANIMATION_TARGET_TYPE.node: {
        const pathIndexNode = ("/nodes/" + targetId.toString() + "/").length;
        const pathStartNode = path.substring(0, pathIndexNode);
        targetProperty = path.substring(pathIndexNode);

        switch (targetProperty) {
          case "translation":
            targetProperty = "position";
            break;
          case "rotation":
            targetProperty = "quaternion";
            break;
          case "scale":
            targetProperty = "scale";
            break;
          case "weights":
            targetProperty = "morphTargetInfluences";
            break;
          case "extensions/KHR_node_visibility/visible":
            targetProperty = "visible";
            break;
        }

        path = pathStartNode + targetProperty!;
        break;
      }

      case ANIMATION_TARGET_TYPE.light: {
        const pathIndexLight = ("/extensions/KHR_lights_punctual/lights/" + targetId.toString() + "/").length;
        targetProperty = path.substring(pathIndexLight);

        switch (targetProperty) {
          case "color":
            break;
          case "intensity":
            break;
          case "spot/innerConeAngle":
            // TODO would need to set .penumbra, but requires calculations on every animation change (?)
            targetProperty = "penumbra";
            break;
          case "spot/outerConeAngle":
            targetProperty = "angle";
            break;
          case "range":
            targetProperty = "distance";
            break;
        }

        path = "/lights/" + targetId.toString() + "/" + targetProperty;
        break;
      }

      case ANIMATION_TARGET_TYPE.camera: {
        const pathIndexCamera = ("/cameras/" + targetId.toString() + "/").length;
        const pathStartCamera = path.substring(0, pathIndexCamera);
        targetProperty = path.substring(pathIndexCamera);

        switch (targetProperty) {
          case "perspective/yfov":
            targetProperty = "fov";
            break;
          case "perspective/znear":
          case "orthographic/znear":
            targetProperty = "near";
            break;
          case "perspective/zfar":
          case "orthographic/zfar":
            targetProperty = "far";
            break;
          case "perspective/aspect":
            targetProperty = "aspect";
            break;
          // these two write to the same target property since three.js orthographic camera only supports 'zoom'.
          // TODO should there be a warning for either of them? E.g. a warning for "xmag" so that "yfov" + "ymag" work by default?
          case "orthographic/xmag":
            targetProperty = "zoom";
            break;
          case "orthographic/ymag":
            targetProperty = "zoom";
            break;
        }

        path = pathStartCamera + targetProperty!;
        break;
      }
    }

    if (this.animationPointerResolver?.resolvePath) {
      path = this.animationPointerResolver.resolvePath(path);
    }

    target.extensions![KHR_ANIMATION_POINTER].pointer = path;

    if (targetId === null || targetId === undefined || Number.isNaN(targetId)) {
      console.warn("Failed resolving animation node id: " + targetId, target);
      return undefined;
    }

    if (type === ANIMATION_TARGET_TYPE.node) return this.parser.getDependency("node", targetId);
    else if (type === ANIMATION_TARGET_TYPE.material) return this.parser.getDependency("material", targetId);
    else if (type === ANIMATION_TARGET_TYPE.light) return this.parser.getDependency("light", targetId);
    else if (type === ANIMATION_TARGET_TYPE.camera) return this.parser.getDependency("camera", targetId);
    else console.error("Unhandled type", type);

    return undefined;
  }

  createAnimationTracksWithAnimationPointer(
    node: Mesh | SkinnedMesh | Group,
    inputAccessor: { array: NumericAnimationBuffer; itemSize: number },
    outputAccessor: { array: NumericAnimationBuffer; itemSize: number },
    sampler: { interpolation?: string },
    target: GLTFChannelTarget,
  ): KeyframeTrack[] | null {
    const useExtension =
      target.extensions && target.extensions[KHR_ANIMATION_POINTER] && target.path && target.path === "pointer";
    if (!useExtension) return null;

    let animationPointerPropertyPath: string = target.extensions![KHR_ANIMATION_POINTER].pointer!;
    if (!animationPointerPropertyPath) return null;

    const tracks: KeyframeTrack[] = [];

    animationPointerPropertyPath = animationPointerPropertyPath.replaceAll("/", ".");
    // replace node/material/camera/light ID by UUID
    const parts = animationPointerPropertyPath.split(".");
    const hasName = node.name !== undefined && node.name !== null;
    const nodeTargetName = hasName ? node.name : node.uuid;
    parts[2] = nodeTargetName!;

    // specially handle the morphTargetInfluences property for multi-material meshes
    // in which case the target object is a Group and the children are the actual targets
    if (parts[3] === "morphTargetInfluences") {
      if ((node as Group).type === "Group") {
        if (_animationPointerDebug)
          console.log("Detected multi-material skinnedMesh export", animationPointerPropertyPath, node);

        // We assume the children are skinned meshes
        for (const ch of (node as Group).children) {
          if ((ch as SkinnedMesh).isSkinnedMesh && (ch as SkinnedMesh).morphTargetInfluences) {
            parts[3] = ch.name;
            parts[4] = "morphTargetInfluences";
            __createTrack(this.parser, ch as SkinnedMesh);
          }
        }

        return tracks;
      }
    }

    // default
    __createTrack(this.parser, node as Mesh);

    function isBooleanTarget(nodeTarget: Mesh | SkinnedMesh | Group, trackPath: string): boolean {
      // trackPath like ".nodes.MyNode.visible" or ".materials.<uuid>.wireframe"
      try {
        // get last token after '.'
        const sections = trackPath.split(".").filter(Boolean);
        const last = sections[sections.length - 1]; // e.g., 'visible' or 'iridescenceThicknessRange[0]'

        // strip indexers like [0]
        const propName = last!.replace(/\[.*\]$/, "");

        // bail if not a direct property
        if (!(propName in (nodeTarget as unknown as Record<string, unknown>))) return false;

        const val = (nodeTarget as unknown as Record<string, unknown>)[propName];
        return typeof val === "boolean";
      } catch {
        return false;
      }
    }

    /** Create a new track using the current parts array */
    function __createTrack(parser: GLTFParser, nodeTarget: Mesh | SkinnedMesh | Group): void {
      animationPointerPropertyPath = parts.join(".");

      if (_animationPointerDebug)
        console.log(nodeTarget, inputAccessor, outputAccessor, target, animationPointerPropertyPath);

      // Upstream builds every track through ONE switch-selected constructor; the port's Boolean
      // ctor has no interpolation parameter, so route that case through its own branch below.
      type TrackCtor = new (
        name: string,
        times: NumericAnimationBuffer,
        values: NumericAnimationBuffer,
        interpolation?: number,
      ) => KeyframeTrack;

      let TypedKeyframeTrack: TrackCtor | undefined;
      let convertToBoolean = false;
      switch (outputAccessor.itemSize) {
        case 1: {
          // Get type of outputAccessor.array elements
          const arrayType = Object.prototype.toString.call(outputAccessor.array);
          const isUInt8 = arrayType === "[object Uint8Array]";

          // UNSIGNED_BYTE as a strong hint
          const looksLikeBool = isUInt8 && isBooleanTarget(nodeTarget, animationPointerPropertyPath);
          if (looksLikeBool) {
            convertToBoolean = true; // map 0 => false, >0 => true
          } else {
            TypedKeyframeTrack = NumberKeyframeTrack;
          }
          break;
        }
        case 2:
        case 3:
          TypedKeyframeTrack = VectorKeyframeTrack;
          break;
        case 4:
          if (animationPointerPropertyPath.endsWith(".quaternion")) TypedKeyframeTrack = QuaternionKeyframeTrack;
          else TypedKeyframeTrack = ColorKeyframeTrack;
          break;
      }

      if (!TypedKeyframeTrack) {
        console.warn("Unsupported output accessor format", outputAccessor);
        return;
      }

      const interpolation =
        sampler.interpolation !== undefined
          ? INTERPOLATION[sampler.interpolation as keyof typeof INTERPOLATION]
          : InterpolateLinear;

      let outputArray = parser._getArrayFromAccessor(outputAccessor as never) as Float32Array;

      // convert fov values from radians to degrees
      if (animationPointerPropertyPath.endsWith(".fov")) {
        outputArray = outputArray.map((value) => (value / Math.PI) * 180);
      }

      if (convertToBoolean) {
        // boolean values are stored as ubyte in glTF, 0 = false, anything else = true
        outputArray = outputArray.map((v) => (v > 0 ? 1 : 0));
      }

      // Boolean targets take the dedicated ctor (no interpolation parameter) once mapped to false/true.
      const track = convertToBoolean
        ? new BooleanKeyframeTrack(
            animationPointerPropertyPath,
            inputAccessor.array as never,
            Array.from(outputArray).map((v) => v > 0),
          )
        : new TypedKeyframeTrack!(
            animationPointerPropertyPath,
            inputAccessor.array as never,
            outputArray as never,
            interpolation,
          );

      // Override interpolation with custom factory method.
      if (sampler.interpolation === "CUBICSPLINE") {
        parser._createCubicSplineTrackInterpolant(track);
      }

      tracks.push(track);

      // glTF has opacity animation as last component of baseColorFactor,
      // so we need to split that up here and create a separate opacity track if that is animated.
      if (
        animationPointerPropertyPath &&
        outputAccessor.itemSize === 4 &&
        animationPointerPropertyPath.startsWith(".materials.") &&
        animationPointerPropertyPath.endsWith(".color")
      ) {
        const opacityArray = new Float32Array(outputArray.length / 4);

        for (let j = 0, jl = outputArray.length / 4; j < jl; j += 1) {
          opacityArray[j] = outputArray[j * 4 + 3];
        }

        const opacityTrack = new TypedKeyframeTrack(
          animationPointerPropertyPath.replace(".color", ".opacity"),
          inputAccessor.array as never,
          opacityArray as never,
          interpolation,
        );

        // Override interpolation with custom factory method.
        if (sampler.interpolation === "CUBICSPLINE") {
          parser._createCubicSplineTrackInterpolant(track);
        }

        tracks.push(opacityTrack);
      }
    }

    return tracks;
  }

  _tryResolveTargetId(path: string, type: keyof typeof ANIMATION_TARGET_TYPE): number {
    let name = "";
    if (type === "node") {
      name = path.substring("/nodes/".length);
    } else if (type === "material") {
      name = path.substring("/materials/".length);
    } else if (type === "light") {
      name = path.substring("/extensions/KHR_lights_punctual/lights/".length);
    } else if (type === "camera") {
      name = path.substring("/cameras/".length);
    }

    name = name.substring(0, name.indexOf("/"));
    return Number.parseInt(name);
  }

  /* MOSTLY DUPLICATE of GLTFLoader.loadAnimation, but also tries to resolve KHR_animation_pointer. */
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
   * @param animationIndex - The animation index.
   * @return A Promise that resolves with the loaded animation clip.
   */
  loadAnimation(animationIndex: number): Promise<AnimationClip> {
    // oxlint-disable-next-line typescript/no-this-alias -- Upstream's callback body binds `me` for the inner function.
    const me = this;
    const json = this.parser.json;
    const parser = this.parser;

    const animationDef = json.animations[animationIndex] as GLTFAnimationDef;
    const animationName = animationDef.name ? animationDef.name : "animation_" + animationIndex;

    const pendingNodes = [];
    const pendingInputAccessors = [];
    const pendingOutputAccessors = [];
    const pendingSamplers = [];
    const pendingTargets = [];

    for (let i = 0, il = animationDef.channels.length; i < il; i++) {
      const channel = animationDef.channels[i];
      const sampler = animationDef.samplers[channel.sampler];
      const target = channel.target;
      const input = animationDef.parameters !== undefined ? animationDef.parameters[sampler.input] : sampler.input;
      const output = animationDef.parameters !== undefined ? animationDef.parameters[sampler.output] : sampler.output;

      let nodeDependency = me.loadAnimationTargetFromChannelWithAnimationPointer(channel);
      if (!nodeDependency) nodeDependency = me.loadAnimationTargetFromChannel(channel);

      pendingNodes.push(nodeDependency);
      pendingInputAccessors.push(parser.getDependency("accessor", input));
      pendingOutputAccessors.push(parser.getDependency("accessor", output));
      pendingSamplers.push(sampler);
      pendingTargets.push(target);
    }

    return Promise.all([
      Promise.all(pendingNodes as Promise<unknown>[]),
      Promise.all(pendingInputAccessors as Promise<unknown>[]),
      Promise.all(pendingOutputAccessors as Promise<unknown>[]),
      Promise.all(pendingSamplers as unknown as Promise<unknown>[]),
      Promise.all(pendingTargets as unknown as Promise<unknown>[]),
    ]).then(function (dependencies) {
      const nodes = dependencies[0] as (Mesh | SkinnedMesh | Group)[];
      const inputAccessors = dependencies[1] as never[];
      const outputAccessors = dependencies[2] as never[];
      const samplers = dependencies[3] as never[];
      const targets = dependencies[4] as never[];

      const tracks = [];

      for (let i = 0, il = nodes.length; i < il; i++) {
        const node = nodes[i];
        const inputAccessor = inputAccessors[i];
        const outputAccessor = outputAccessors[i];
        const sampler = samplers[i];
        const target = targets[i];

        if (node === undefined) continue;

        if ((node as Mesh).updateMatrix) {
          (node as Mesh).updateMatrix();
          (node as Mesh).matrixAutoUpdate = true;
        }

        let createdTracks = me.createAnimationTracksWithAnimationPointer(
          node,
          inputAccessor as never,
          outputAccessor as never,
          sampler as never,
          target as never,
        );
        if (!createdTracks)
          createdTracks = parser._createAnimationTracks(
            node as Mesh,
            inputAccessor as never,
            outputAccessor as never,
            sampler as never,
            target as never,
          ) as never;

        if (createdTracks) {
          for (let k = 0; k < createdTracks.length; k++) {
            tracks.push(createdTracks[k]);
          }
        }
      }

      return new AnimationClip(animationName, undefined, tracks);
    });
  }
}

let _havePatchedPropertyBindings = false;

// HACK monkey patching findNode to ensure we can map to other types required by KHR_animation_pointer.
type FindNodeFn = (root: Object3DLike, nodeName: string | number | undefined) => Object3DLike | null;
let findNodeFn: FindNodeFn | null = null;

function _ensurePropertyBindingPatch(): void {
  if (_havePatchedPropertyBindings) return;
  _havePatchedPropertyBindings = true;

  const findNode = (findNodeFn ||= ((root: Object3DLike, nodeName: string | number | undefined) =>
    PropertyBinding.findNode(root as never, nodeName as string)) as unknown as FindNodeFn);

  // "node" is the Animator component
  // "path" is the animated property path, just with translated material names.
  PropertyBinding.findNode = function (rootNode: Object3DLike, path: string) {
    // if the binding is empty fallback to original
    if (!path) return findNode(rootNode, path);

    if (path.startsWith(".materials.")) {
      if (_animationPointerDebug) console.log("FIND", path);

      // Upstream semantics: substring(11) then substring from the FIRST '.' after that — a
      // name-only path keeps everything; a name + property path drops the name.
      const tail = path.substring(".materials.".length);
      const tailDot = tail.indexOf(".");
      const remainingPath = tailDot < 0 ? tail : tail.substring(tailDot);
      const nextIndex = remainingPath.indexOf(".");
      const uuid = nextIndex < 0 ? remainingPath : remainingPath.substring(0, nextIndex);
      let res: Object3DLike | null = null;
      rootNode.traverse((x) => {
        if (res !== null || (x.type !== "Mesh" && x.type !== "SkinnedMesh")) return;
        const mesh = x as unknown as {
          material?: Object3DLike & { uuid: string; name: string; map?: unknown; emissiveMap?: unknown };
        };
        const material = mesh.material;
        if (material && (material.uuid === uuid || material.name === uuid)) {
          res = material as unknown as Object3DLike;
          if (_animationPointerDebug) console.log(res, remainingPath);
          if (res !== null) {
            if (remainingPath.endsWith(".map")) res = material.map as unknown as Object3DLike;
            else if (remainingPath.endsWith(".emissiveMap")) res = material.emissiveMap as unknown as Object3DLike;

            // TODO other texture slots only make sense if three.js actually supports them
            // (currently only .map can have repeat/offset)
          }
        }
      });

      return res;
    } else if (path.startsWith(".nodes.") || path.startsWith(".lights.") || path.startsWith(".cameras.")) {
      const sections = path.split(".");
      let currentTarget: Object3DLike | undefined = undefined;
      for (let i = 1; i < sections.length; i++) {
        const val = sections[i]!;
        const isUUID = val.length == 36;
        if (isUUID) {
          // access by UUID
          currentTarget = rootNode.getObjectByProperty("uuid", val);
        } else if (currentTarget && (currentTarget as unknown as Record<string, unknown>)[val]) {
          // access by index
          const index = Number.parseInt(val);
          const key: string | number = index >= 0 && String(index) === val ? index : val;

          const next = (currentTarget as unknown as Record<string, unknown>)[key];
          currentTarget = next as Object3DLike | undefined;
          if (_animationPointerDebug) console.log(currentTarget);
        } else {
          // access by node name
          const foundNode = rootNode.getObjectByName(val);

          if (foundNode) currentTarget = foundNode;
        }
      }

      if (!currentTarget) {
        const originalFindResult = findNode(rootNode, sections[2]!);

        if (!originalFindResult)
          console.warn(KHR_ANIMATION_POINTER + ": Property binding not found", path, rootNode, rootNode.uuid, sections);

        return originalFindResult;
      }

      if (_animationPointerDebug) console.log("NODE", path, currentTarget);

      return currentTarget;
    }

    return findNode(rootNode, path);
  } as unknown as typeof PropertyBinding.findNode;
}
