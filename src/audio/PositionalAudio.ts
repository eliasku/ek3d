import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { Audio } from "./Audio";
import type { AudioListener } from "./AudioListener";

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const orientation = new Vector3();

/** Audio whose position and directional cone follow its world transform. */
export class PositionalAudio extends Audio {
  panner: PannerNode;
  constructor(listener: AudioListener) {
    super(listener);
    this.panner = this.context.createPanner();
    this.panner.panningModel = "HRTF";
    this.panner.connect(this.gain);
  }
  connect(): this {
    super.connect();
    this.panner.connect(this.gain);
    return this;
  }
  disconnect(): this {
    super.disconnect();
    this.panner.disconnect(this.gain);
    return this;
  }
  getOutput(): PannerNode {
    return this.panner;
  }
  getRefDistance(): number {
    return this.panner.refDistance;
  }
  setRefDistance(value: number): this {
    this.panner.refDistance = value;
    return this;
  }
  getRolloffFactor(): number {
    return this.panner.rolloffFactor;
  }
  setRolloffFactor(value: number): this {
    this.panner.rolloffFactor = value;
    return this;
  }
  getDistanceModel(): DistanceModelType {
    return this.panner.distanceModel;
  }
  setDistanceModel(value: DistanceModelType): this {
    this.panner.distanceModel = value;
    return this;
  }
  getMaxDistance(): number {
    return this.panner.maxDistance;
  }
  setMaxDistance(value: number): this {
    this.panner.maxDistance = value;
    return this;
  }
  setDirectionalCone(coneInnerAngle: number, coneOuterAngle: number, coneOuterGain: number): this {
    this.panner.coneInnerAngle = coneInnerAngle;
    this.panner.coneOuterAngle = coneOuterAngle;
    this.panner.coneOuterGain = coneOuterGain;
    return this;
  }
  updateMatrixWorld(force?: boolean): void {
    super.updateMatrixWorld(force);
    if (this.hasPlaybackControl && !this.isPlaying) return;
    this.matrixWorld.decompose(position, quaternion, scale);
    orientation.set(0, 0, 1).applyQuaternion(quaternion);
    const panner = this.panner;
    if (panner.positionX) {
      const endTime = this.context.currentTime + this.listener.timeDelta;
      panner.positionX.linearRampToValueAtTime(position.x, endTime);
      panner.positionY.linearRampToValueAtTime(position.y, endTime);
      panner.positionZ.linearRampToValueAtTime(position.z, endTime);
      panner.orientationX.linearRampToValueAtTime(orientation.x, endTime);
      panner.orientationY.linearRampToValueAtTime(orientation.y, endTime);
      panner.orientationZ.linearRampToValueAtTime(orientation.z, endTime);
    } else {
      panner.setPosition(position.x, position.y, position.z);
      panner.setOrientation(orientation.x, orientation.y, orientation.z);
    }
  }
}
