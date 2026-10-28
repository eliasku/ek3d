import { Timer } from "../core/Timer";
import { Object3D } from "../core/Object3D";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { AudioContext } from "./AudioContext";

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const forward = new Vector3();
const up = new Vector3();

/** A scene listener, usually attached to the camera. */
export class AudioListener extends Object3D {
  context: globalThis.AudioContext;
  gain: GainNode;
  filter: AudioNode | null = null;
  timeDelta: number = 0;
  _timer: Timer;

  constructor() {
    super();
    this.type = "AudioListener";
    this.context = AudioContext.getContext();
    this.gain = this.context.createGain();
    this.gain.connect(this.context.destination);
    this._timer = new Timer();
  }
  getInput(): GainNode {
    return this.gain;
  }
  removeFilter(): this {
    if (this.filter !== null) {
      this.gain.disconnect(this.filter);
      this.filter.disconnect(this.context.destination);
      this.gain.connect(this.context.destination);
      this.filter = null;
    }
    return this;
  }
  getFilter(): AudioNode | null {
    return this.filter;
  }
  setFilter(value: AudioNode): this {
    if (this.filter !== null) {
      this.gain.disconnect(this.filter);
      this.filter.disconnect(this.context.destination);
    } else this.gain.disconnect(this.context.destination);
    this.filter = value;
    this.gain.connect(value);
    value.connect(this.context.destination);
    return this;
  }
  getMasterVolume(): number {
    return this.gain.gain.value;
  }
  setMasterVolume(value: number): this {
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
    return this;
  }
  updateMatrixWorld(force?: boolean): void {
    super.updateMatrixWorld(force);
    this._timer.update();
    this.timeDelta = this._timer.getDelta();
    this.matrixWorld.decompose(position, quaternion, scale);
    forward.set(0, 0, -1).applyQuaternion(quaternion);
    up.set(0, 1, 0).applyQuaternion(quaternion);
    const listener = this.context.listener;
    if (listener.positionX) {
      const endTime = this.context.currentTime + this.timeDelta;
      listener.positionX.linearRampToValueAtTime(position.x, endTime);
      listener.positionY.linearRampToValueAtTime(position.y, endTime);
      listener.positionZ.linearRampToValueAtTime(position.z, endTime);
      listener.forwardX.linearRampToValueAtTime(forward.x, endTime);
      listener.forwardY.linearRampToValueAtTime(forward.y, endTime);
      listener.forwardZ.linearRampToValueAtTime(forward.z, endTime);
      listener.upX.linearRampToValueAtTime(up.x, endTime);
      listener.upY.linearRampToValueAtTime(up.y, endTime);
      listener.upZ.linearRampToValueAtTime(up.z, endTime);
    } else {
      listener.setPosition(position.x, position.y, position.z);
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }
}
