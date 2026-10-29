import { AnimationClip } from "../../animation/AnimationClip";
import { QuaternionKeyframeTrack } from "../../animation/tracks/QuaternionKeyframeTrack";
import { VectorKeyframeTrack } from "../../animation/tracks/VectorKeyframeTrack";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";
import { Bone } from "../../objects/Bone";
import { Skeleton } from "../../objects/Skeleton";

/** The skeleton and animation clip produced by {@link BVHLoader#parse}. */
export interface BVHLoaderResult {
  skeleton: Skeleton;
  clip: AnimationClip;
}

interface BVHKeyframe {
  time: number;
  position: Vector3;
  rotation: Quaternion;
}

interface BVHNode {
  name: string;
  type: string;
  offset: Vector3;
  channels: string[];
  frames: BVHKeyframe[];
  children: BVHNode[];
}

const _vx = /*@__PURE__*/ new Vector3(1, 0, 0);
const _vy = /*@__PURE__*/ new Vector3(0, 1, 0);
const _vz = /*@__PURE__*/ new Vector3(0, 0, 1);

/**
 * A loader for the Biovision Hierarchy (BVH) motion capture format.
 *
 * Imports BVH files and outputs a single {@link Skeleton} and {@link AnimationClip}.
 * Only files with a single root joint are supported.
 *
 * ```ts
 * import { BVHLoader } from "ek3d/addons/loaders/BVHLoader";
 * import { AnimationMixer } from "ek3d/animation/AnimationMixer";
 *
 * const loader = new BVHLoader();
 * const result = await loader.loadAsync( "models/bvh/pirouette.bvh" );
 *
 * const mixer = new AnimationMixer( result.skeleton.bones[ 0 ] );
 * mixer.clipAction( result.clip ).play();
 * ```
 */
export class BVHLoader extends Loader<BVHLoaderResult> {
  /** Whether to animate bone positions. */
  animateBonePositions: boolean = true;
  /** Whether to animate bone rotations. */
  animateBoneRotations: boolean = true;

  /**
   * Constructs a new BVH loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  /**
   * Starts loading from the given URL and passes the parsed result to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  override load(
    url: string,
    onLoad?: (result: BVHLoaderResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (text) => {
        try {
          if (typeof text !== "string") throw new TypeError("BVHLoader requires text data");
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

  /**
   * Parses the given BVH data and returns the resulting skeleton and animation clip.
   *
   * @param text - The raw BVH data as a string.
   * @return An object holding the parsed skeleton and clip.
   */
  parse(text: string): BVHLoaderResult {
    const animateBonePositions = this.animateBonePositions;
    const animateBoneRotations = this.animateBoneRotations;
    const lines = text.split(/[\r\n]+/g);
    const bones = readBvh(lines);
    const threeBones: Bone[] = [];
    toTHREEBone(bones[0], threeBones);
    const threeClip = toTHREEAnimation(bones);
    return {
      skeleton: new Skeleton(threeBones),
      clip: threeClip,
    };

    // Reads the HIERARCHY and MOTION sections and returns a flat list of BVH nodes.
    function readBvh(lines: string[]): BVHNode[] {
      if (nextLine(lines) !== "HIERARCHY") {
        console.error("THREE.BVHLoader: HIERARCHY expected.");
      }

      const list: BVHNode[] = [];
      const root = readNode(lines, nextLine(lines), list);

      if (nextLine(lines) !== "MOTION") {
        console.error("THREE.BVHLoader: MOTION expected.");
      }

      let tokens = nextLine(lines).split(/[\s]+/);
      const numFrames = parseInt(tokens[1]);
      if (isNaN(numFrames)) {
        console.error("THREE.BVHLoader: Failed to read number of frames.");
      }

      tokens = nextLine(lines).split(/[\s]+/);
      const frameTime = parseFloat(tokens[2]);
      if (isNaN(frameTime)) {
        console.error("THREE.BVHLoader: Failed to read frame time.");
      }

      for (let i = 0; i < numFrames; i++) {
        tokens = nextLine(lines).split(/[\s]+/);
        readFrameData(tokens, i * frameTime, root);
      }

      return list;
    }

    // Reads one number from the remaining frame tokens, failing clearly on truncated data.
    function nextValue(data: string[]): number {
      const token = data.shift();
      if (token === undefined) throw new Error("THREE.BVHLoader: Missing motion channel value.");
      return parseFloat(token.trim());
    }

    // Reads one frame of channel data into the node hierarchy, consuming `data` as it goes.
    function readFrameData(data: string[], frameTime: number, bone: BVHNode): void {
      // end sites have no motion data
      if (bone.type === "ENDSITE") return;

      const keyframe: BVHKeyframe = {
        time: frameTime,
        position: new Vector3(),
        rotation: new Quaternion(),
      };
      bone.frames.push(keyframe);

      const quat = new Quaternion();

      for (let i = 0; i < bone.channels.length; i++) {
        switch (bone.channels[i]) {
          case "Xposition":
            keyframe.position.x = nextValue(data);
            break;
          case "Yposition":
            keyframe.position.y = nextValue(data);
            break;
          case "Zposition":
            keyframe.position.z = nextValue(data);
            break;
          case "Xrotation":
            quat.setFromAxisAngle(_vx, (nextValue(data) * Math.PI) / 180);
            keyframe.rotation.multiply(quat);
            break;
          case "Yrotation":
            quat.setFromAxisAngle(_vy, (nextValue(data) * Math.PI) / 180);
            keyframe.rotation.multiply(quat);
            break;
          case "Zrotation":
            quat.setFromAxisAngle(_vz, (nextValue(data) * Math.PI) / 180);
            keyframe.rotation.multiply(quat);
            break;
          default:
            console.warn("THREE.BVHLoader: Invalid channel type.");
        }
      }

      for (let i = 0; i < bone.children.length; i++) {
        readFrameData(data, frameTime, bone.children[i]);
      }
    }

    // Recursively parses the HIERARCHY section and collects a flat list of nodes.
    function readNode(lines: string[], firstline: string, list: BVHNode[]): BVHNode {
      const node: BVHNode = {
        name: "",
        type: "",
        offset: new Vector3(),
        channels: [],
        frames: [],
        children: [],
      };
      list.push(node);

      let tokens = firstline.split(/[\s]+/);

      if (tokens[0].toUpperCase() === "END" && tokens[1].toUpperCase() === "SITE") {
        node.type = "ENDSITE";
        node.name = "ENDSITE"; // bvh end sites have no name
      } else {
        node.name = tokens[1];
        node.type = tokens[0].toUpperCase();
      }

      if (nextLine(lines) !== "{") {
        console.error("THREE.BVHLoader: Expected opening { after type & name");
      }

      tokens = nextLine(lines).split(/[\s]+/);
      if (tokens[0] !== "OFFSET") {
        console.error("THREE.BVHLoader: Expected OFFSET but got: " + tokens[0]);
      }
      if (tokens.length !== 4) {
        console.error("THREE.BVHLoader: Invalid number of values for OFFSET.");
      }
      node.offset.set(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
      if (isNaN(node.offset.x) || isNaN(node.offset.y) || isNaN(node.offset.z)) {
        console.error("THREE.BVHLoader: Invalid values of OFFSET.");
      }

      if (node.type !== "ENDSITE") {
        tokens = nextLine(lines).split(/[\s]+/);
        if (tokens[0] !== "CHANNELS") {
          console.error("THREE.BVHLoader: Expected CHANNELS definition.");
        }
        const numChannels = parseInt(tokens[1]);
        node.channels = tokens.splice(2, numChannels);
      }

      while (true) {
        const line = nextLine(lines);
        if (line === "}") return node;
        node.children.push(readNode(lines, line, list));
      }
    }

    // Recursively converts the internal node structure to a Bone hierarchy.
    function toTHREEBone(source: BVHNode, list: Bone[]): Bone {
      const bone = new Bone();
      list.push(bone);
      bone.position.add(source.offset);
      bone.name = source.name;
      if (source.type !== "ENDSITE") {
        for (let i = 0; i < source.children.length; i++) {
          bone.add(toTHREEBone(source.children[i], list));
        }
      }
      return bone;
    }

    // Builds position and quaternion tracks from the keyframe data stored in each node.
    function toTHREEAnimation(bones: BVHNode[]): AnimationClip {
      const tracks: (VectorKeyframeTrack | QuaternionKeyframeTrack)[] = [];

      for (let i = 0; i < bones.length; i++) {
        const bone = bones[i];
        if (bone.type === "ENDSITE") continue;

        const times: number[] = [];
        const positions: number[] = [];
        const rotations: number[] = [];

        for (let j = 0; j < bone.frames.length; j++) {
          const frame = bone.frames[j];
          times.push(frame.time);
          // The animation system animates the position property, so add the joint offset.
          positions.push(frame.position.x + bone.offset.x);
          positions.push(frame.position.y + bone.offset.y);
          positions.push(frame.position.z + bone.offset.z);
          rotations.push(frame.rotation.x);
          rotations.push(frame.rotation.y);
          rotations.push(frame.rotation.z);
          rotations.push(frame.rotation.w);
        }

        if (animateBonePositions) {
          tracks.push(new VectorKeyframeTrack(bone.name + ".position", times, positions));
        }
        if (animateBoneRotations) {
          tracks.push(new QuaternionKeyframeTrack(bone.name + ".quaternion", times, rotations));
        }
      }

      return new AnimationClip("animation", -1, tracks);
    }

    // Returns the next non-empty line, consuming it from `lines`.
    function nextLine(lines: string[]): string {
      let line = lines.shift();
      while (line !== undefined && line.trim().length === 0) line = lines.shift();
      if (line === undefined) throw new Error("THREE.BVHLoader: Unexpected end of file.");
      return line.trim();
    }
  }
}
