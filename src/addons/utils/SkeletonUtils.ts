import { AnimationClip } from "../../animation/AnimationClip";
import { AnimationMixer } from "../../animation/AnimationMixer";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { QuaternionKeyframeTrack } from "../../animation/tracks/QuaternionKeyframeTrack";
import { VectorKeyframeTrack } from "../../animation/tracks/VectorKeyframeTrack";
import type { KeyframeTrack } from "../../animation/KeyframeTrack";
import { Vector3 } from "../../math/Vector3";
import { SkeletonHelper } from "../../helpers/SkeletonHelper";
import type { Skeleton } from "../../objects/Skeleton";
import type { Object3D } from "../../core/Object3D";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";
import type { Bone } from "../../objects/Bone";
import type { NumericAnimationBuffer } from "../../math/Interpolant";

/**
 * @module SkeletonUtils
 */

/** An object holding a skeleton, i.e. a skinned mesh or SkeletonHelper. */
type SkeletonHolder = { skeleton: Skeleton; isObject3D: true };

type BoneData = {
  bone: Bone;
  pos?: { times: NumericAnimationBuffer; values: NumericAnimationBuffer };
  quat?: { times: NumericAnimationBuffer; values: NumericAnimationBuffer };
};

/** Retarget options of `SkeletonUtils`. */
export interface RetargetOptions {
  /** Whether to use the position of the first frame or not. */
  useFirstFramePosition?: boolean;
  /** The FPS of the clip. */
  fps?: number;
  /** A dictionary for mapping target to source bone names. */
  names?: Record<string, string>;
  /** A function for mapping bone names. Alternative to `names`. */
  getBoneName?(bone: Bone): string;
  /** Whether to trim the clip or not. If set the array should hold two values for the start and end. */
  trim?: number[];
  /** Whether to preserve bone matrices or not. */
  preserveBoneMatrix?: boolean;
  /** Whether to preserve bone positions or not. */
  preserveBonePositions?: boolean;
  /** Whether to use the target matrix or not. */
  useTargetMatrix?: boolean;
  /** The name of the source's hip bone. */
  hip?: string;
  /** The hip influence. */
  hipInfluence?: Vector3;
  /** The scale. */
  scale?: number;
  /** Per-bone local offset matrices, keyed by bone name. */
  localOffsets?: Record<string, Matrix4>;
  /** An additional position offset applied to the hip bone. */
  hipPosition?: Vector3;
}

type RetargetTarget = Object3D | Skeleton;

function getBoneName(bone: Bone, options: RetargetOptions): string | undefined {
  if (options.getBoneName !== undefined) {
    return options.getBoneName(bone);
  }

  return options.names![bone.name];
}

/**
 * Retargets the skeleton from the given source to the target.
 *
 * Both `target` and `source` can be a 3D object with a skeleton property (e.g. a skinned mesh)
 * or a {@link Skeleton} directly.
 *
 * @param target - The target object.
 * @param source - The source object.
 * @param options - The options.
 */
export function retarget(target: RetargetTarget, source: RetargetTarget, options: RetargetOptions = {}): void {
  const quat = new Quaternion(),
    scale = new Vector3(),
    relativeMatrix = new Matrix4(),
    globalMatrix = new Matrix4();

  options.preserveBoneMatrix = options.preserveBoneMatrix !== undefined ? options.preserveBoneMatrix : true;
  options.preserveBonePositions = options.preserveBonePositions !== undefined ? options.preserveBonePositions : true;
  options.useTargetMatrix = options.useTargetMatrix !== undefined ? options.useTargetMatrix : false;
  options.hip = options.hip !== undefined ? options.hip : "hip";
  options.hipInfluence = options.hipInfluence !== undefined ? options.hipInfluence : new Vector3(1, 1, 1);
  options.scale = options.scale !== undefined ? options.scale : 1;
  options.names = options.names || {};

  const sourceObject = source as Object3D & { skeleton?: Skeleton };
  const targetObject = target as Object3D & { skeleton?: Skeleton };
  const sourceBones = sourceObject.isObject3D ? sourceObject.skeleton!.bones : getBones(source as Skeleton),
    bones = targetObject.isObject3D ? targetObject.skeleton!.bones : getBones(target as Skeleton);

  let bone: Bone, name: string | undefined, boneTo: Bone | undefined, bonesPosition: Vector3[] | undefined;

  // reset bones

  if (targetObject.isObject3D) {
    targetObject.skeleton!.pose();
  } else {
    options.useTargetMatrix = true;
    options.preserveBoneMatrix = false;
  }

  if (options.preserveBonePositions) {
    bonesPosition = [];

    for (let i = 0; i < bones.length; i++) {
      bonesPosition.push(bones[i].position.clone());
    }
  }

  if (options.preserveBoneMatrix) {
    // reset matrix

    (target as Object3D).updateMatrixWorld();

    (target as Object3D).matrixWorld.identity();

    // reset children matrix

    for (let i = 0; i < (target as Object3D).children.length; ++i) {
      (target as Object3D).children[i].updateMatrixWorld(true);
    }
  }

  for (let i = 0; i < bones.length; ++i) {
    bone = bones[i];
    name = getBoneName(bone, options);

    boneTo = getBoneByName(name!, sourceBones);

    globalMatrix.copy(bone.matrixWorld);

    if (boneTo) {
      boneTo.updateMatrixWorld();

      if (options.useTargetMatrix) {
        relativeMatrix.copy(boneTo.matrixWorld);
      } else {
        relativeMatrix.copy((target as Object3D).matrixWorld).invert();
        relativeMatrix.multiply(boneTo.matrixWorld);
      }

      // ignore scale to extract rotation

      scale.setFromMatrixScale(relativeMatrix);
      relativeMatrix.scale(scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z));

      // apply to global matrix

      globalMatrix.makeRotationFromQuaternion(quat.setFromRotationMatrix(relativeMatrix));

      if (targetObject.isObject3D) {
        if (options.localOffsets) {
          if (options.localOffsets[bone.name]) {
            globalMatrix.multiply(options.localOffsets[bone.name]);
          }
        }
      }

      globalMatrix.copyPosition(relativeMatrix);
    }

    if (name === options.hip) {
      globalMatrix.elements[12] *= options.scale * options.hipInfluence.x;
      globalMatrix.elements[13] *= options.scale * options.hipInfluence.y;
      globalMatrix.elements[14] *= options.scale * options.hipInfluence.z;

      if (options.hipPosition !== undefined) {
        globalMatrix.elements[12] += options.hipPosition.x * options.scale;
        globalMatrix.elements[13] += options.hipPosition.y * options.scale;
        globalMatrix.elements[14] += options.hipPosition.z * options.scale;
      }
    }

    if (bone.parent) {
      bone.matrix.copy(bone.parent.matrixWorld).invert();
      bone.matrix.multiply(globalMatrix);
    } else {
      bone.matrix.copy(globalMatrix);
    }

    bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);

    bone.updateMatrixWorld();
  }

  if (options.preserveBonePositions) {
    for (let i = 0; i < bones.length; ++i) {
      bone = bones[i];
      name = getBoneName(bone, options) || bone.name;

      if (name !== options.hip) {
        bone.position.copy(bonesPosition![i]);
      }
    }
  }

  if (options.preserveBoneMatrix) {
    // restore matrix

    (target as Object3D).updateMatrixWorld(true);
  }
}

/**
 * Retargets the animation clip of the source to the target 3D object.
 *
 * The `source` can be a 3D object with a skeleton property (e.g. a skinned mesh)
 * or a {@link Skeleton} directly.
 *
 * @param target - The target 3D object. Must have a `skeleton` property.
 * @param source - The source object.
 * @param clip - The animation clip.
 * @param options - The options.
 * @return The retargeted animation clip.
 */
export function retargetClip(
  target: Object3D,
  source: RetargetTarget,
  clip: AnimationClip,
  options: RetargetOptions = {},
): AnimationClip {
  options.useFirstFramePosition = options.useFirstFramePosition !== undefined ? options.useFirstFramePosition : false;

  // Calculate fps from the clip; the actual upstream sample rate comes from the caller.
  if (options.fps === undefined) {
    throw new Error("THREE.SkeletonUtils.retargetClip: options.fps is required.");
  }

  options.names = options.names || {};

  const sourceObject: Object3D =
    (source as Object3D).isObject3D === true ? (source as Object3D) : getHelperFromSkeleton(source as Skeleton);

  const numFrames = Math.round(((clip.duration * options.fps) / 1000) * 1000),
    delta = clip.duration / (numFrames - 1),
    convertedTracks: KeyframeTrack[] = [],
    mixer = new AnimationMixer(sourceObject),
    bones = getBones(getSkeleton(target)!),
    boneDatas: BoneData[] = [];

  let positionOffset: Vector3 | undefined, bone: Bone, boneTo: Bone | undefined, boneData, name: string | undefined;

  mixer.clipAction(clip).play();

  // trim

  let start = 0,
    end = numFrames;

  if (options.trim !== undefined) {
    start = Math.round(options.trim[0] * options.fps);
    end = Math.min(Math.round(options.trim[1] * options.fps), numFrames) - start;

    mixer.update(options.trim[0]);
  } else {
    mixer.update(0);
  }

  sourceObject.updateMatrixWorld();

  //

  for (let frame = 0; frame < end; ++frame) {
    const time = frame * delta;

    retarget(target as unknown as RetargetTarget, sourceObject, options);

    for (let j = 0; j < bones.length; ++j) {
      bone = bones[j];
      name = getBoneName(bone, options) || bone.name;
      boneTo = getBoneByName(name!, getSkeleton(sourceObject)!.bones);

      if (boneTo) {
        boneData = boneDatas[j] = boneDatas[j] || { bone: bone };

        if (options.hip === name) {
          if (!boneData.pos) {
            boneData.pos = {
              times: new Float32Array(end),
              values: new Float32Array(end * 3),
            };
          }

          if (options.useFirstFramePosition) {
            if (frame === 0) {
              positionOffset = bone.position.clone();
            }

            bone.position.sub(positionOffset!);
          }

          boneData.pos.times[frame] = time;

          const posValues = [0, 0, 0];
          bone.position.toArray(posValues);
          (boneData.pos.values as Float32Array).set(posValues, frame * 3);
        }

        if (!boneData.quat) {
          boneData.quat = {
            times: new Float32Array(end),
            values: new Float32Array(end * 4),
          };
        }

        boneData.quat.times[frame] = time;

        const quatValues = [0, 0, 0, 1];
        bone.quaternion.toArray(quatValues);
        (boneData.quat.values as Float32Array).set(quatValues, frame * 4);
      }
    }

    if (frame === end - 2) {
      // last mixer update before final loop iteration
      // make sure we do not go over or equal to clip duration
      mixer.update(delta - 0.0000001);
    } else {
      mixer.update(delta);
    }

    sourceObject.updateMatrixWorld();
  }

  for (let i = 0; i < boneDatas.length; ++i) {
    boneData = boneDatas[i];

    if (boneData) {
      if (boneData.pos) {
        convertedTracks.push(
          new VectorKeyframeTrack(
            ".bones[" + boneData.bone.name + "].position",
            boneData.pos.times,
            boneData.pos.values,
          ),
        );
      }

      convertedTracks.push(
        new QuaternionKeyframeTrack(
          ".bones[" + boneData.bone.name + "].quaternion",
          boneData.quat!.times,
          boneData.quat!.values,
        ),
      );
    }
  }

  mixer.uncacheAction(clip);

  return new AnimationClip(clip.name, -1, convertedTracks);
}

/**
 * Clones the given 3D object and its descendants, ensuring that any `SkinnedMesh` instances are
 * correctly associated with their bones. Bones are also cloned, and must be descendants of the
 * object passed to this method. Other data, like geometries and materials, are reused by reference.
 *
 * @param source - The 3D object to clone.
 * @return The cloned 3D object.
 */
export function clone(source: Object3D): Object3D {
  const sourceLookup = new Map<Object3D, Object3D>();
  const cloneLookup = new Map<Object3D, Object3D>();

  const clone = source.clone();

  parallelTraverse(source, clone, (sourceNode, clonedNode) => {
    sourceLookup.set(clonedNode, sourceNode);
    cloneLookup.set(sourceNode, clonedNode);
  });

  clone.traverse((node) => {
    if (!(node as SkinnedMesh).isSkinnedMesh) return;

    const clonedMesh = node as SkinnedMesh;
    const sourceMesh = sourceLookup.get(node) as SkinnedMesh;
    const sourceBones = sourceMesh.skeleton.bones;

    clonedMesh.skeleton = sourceMesh.skeleton.clone();
    clonedMesh.bindMatrix.copy(sourceMesh.bindMatrix);

    clonedMesh.skeleton.bones = sourceBones.map<Bone>((bone) => cloneLookup.get(bone) as Bone);

    clonedMesh.bind(clonedMesh.skeleton, clonedMesh.bindMatrix);
  });

  return clone;
}

// internal helpers

function getBoneByName(name: string, bones: Bone[]): Bone | undefined {
  for (let i = 0; i < bones.length; i++) {
    if (name === bones[i].name) return bones[i];
  }
}

function getBones(skeleton: Skeleton | Bone[]): Bone[] {
  return Array.isArray(skeleton) ? skeleton : skeleton.bones;
}

function getSkeleton(object: Object3D | null | undefined): Skeleton | null {
  const holder = object as unknown as SkeletonHolder;
  return holder.isObject3D === true && holder.skeleton ? holder.skeleton : null;
}

function getHelperFromSkeleton(skeleton: Skeleton): SkeletonHelper & { skeleton: Skeleton } {
  const source = new SkeletonHelper(skeleton.bones[0]) as SkeletonHelper & { skeleton: Skeleton };
  source.skeleton = skeleton;

  return source;
}

function parallelTraverse(a: Object3D, b: Object3D, callback: (a: Object3D, b: Object3D) => void): void {
  callback(a, b);

  for (let i = 0; i < a.children.length; i++) {
    parallelTraverse(a.children[i], b.children[i], callback);
  }
}
