import { Object3D } from "../core/Object3D";
import { warn } from "../utils";
import type { AudioListener } from "./AudioListener";

/** A global audio source connected to the scene's listener. */
export class Audio extends Object3D {
  listener: AudioListener;
  context: globalThis.AudioContext;
  gain: GainNode;
  autoplay: boolean = false;
  buffer: AudioBuffer | null = null;
  detune: number = 0;
  loop: boolean = false;
  loopStart: number = 0;
  loopEnd: number = 0;
  offset: number = 0;
  duration: number | undefined = undefined;
  playbackRate: number = 1;
  isPlaying: boolean = false;
  hasPlaybackControl: boolean = true;
  source: AudioNode | null = null;
  sourceType: "empty" | "audioNode" | "mediaNode" | "mediaStreamNode" | "buffer" = "empty";
  _startedAt: number = 0;
  _progress: number = 0;
  _connected: boolean = false;
  filters: AudioNode[] = [];

  constructor(listener: AudioListener) {
    super();
    this.type = "Audio";
    this.listener = listener;
    this.context = listener.context;
    this.gain = this.context.createGain();
    this.gain.connect(listener.getInput());
  }

  getOutput(): AudioNode {
    return this.gain;
  }

  setNodeSource(audioNode: AudioNode): this {
    this.hasPlaybackControl = false;
    this.sourceType = "audioNode";
    this.source = audioNode;
    this.connect();
    return this;
  }

  setMediaElementSource(mediaElement: HTMLMediaElement): this {
    this.hasPlaybackControl = false;
    this.sourceType = "mediaNode";
    this.source = this.context.createMediaElementSource(mediaElement);
    this.connect();
    return this;
  }

  setMediaStreamSource(mediaStream: MediaStream): this {
    this.hasPlaybackControl = false;
    this.sourceType = "mediaStreamNode";
    this.source = this.context.createMediaStreamSource(mediaStream);
    this.connect();
    return this;
  }

  setBuffer(audioBuffer: AudioBuffer): this {
    this.buffer = audioBuffer;
    this.sourceType = "buffer";
    if (this.autoplay) this.play();
    return this;
  }

  play(delay: number = 0): this | undefined {
    if (this.isPlaying) {
      warn("Audio: Audio is already playing.");
      return;
    }
    if (!this.hasPlaybackControl) {
      warn("Audio: this Audio has no playback control.");
      return;
    }
    this._startedAt = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.loop;
    source.loopStart = this.loopStart;
    source.loopEnd = this.loopEnd;
    source.onended = this.onEnded.bind(this);
    source.start(this._startedAt, this._progress + this.offset, this.duration);
    this.isPlaying = true;
    this.source = source;
    this.setDetune(this.detune);
    this.setPlaybackRate(this.playbackRate);
    return this.connect();
  }

  pause(): this | undefined {
    if (!this.hasPlaybackControl) {
      warn("Audio: this Audio has no playback control.");
      return;
    }
    if (this.isPlaying) {
      this._progress += Math.max(this.context.currentTime - this._startedAt, 0) * this.playbackRate;
      if (this.loop) this._progress %= this.duration || this.buffer!.duration;
      const source = this.source as AudioBufferSourceNode;
      source.stop();
      source.onended = null;
      this.isPlaying = false;
    }
    return this;
  }

  stop(delay: number = 0): this | undefined {
    if (!this.hasPlaybackControl) {
      warn("Audio: this Audio has no playback control.");
      return;
    }
    this._progress = 0;
    if (this.source !== null) {
      const source = this.source as AudioBufferSourceNode;
      source.stop(this.context.currentTime + delay);
      source.onended = null;
    }
    this.isPlaying = false;
    return this;
  }

  connect(): this {
    if (this.filters.length > 0) {
      this.source!.connect(this.filters[0]);
      for (let i = 1; i < this.filters.length; i++) this.filters[i - 1].connect(this.filters[i]);
      this.filters[this.filters.length - 1].connect(this.getOutput());
    } else this.source!.connect(this.getOutput());
    this._connected = true;
    return this;
  }

  disconnect(): this | undefined {
    if (!this._connected) return;
    if (this.filters.length > 0) {
      this.source!.disconnect(this.filters[0]);
      for (let i = 1; i < this.filters.length; i++) this.filters[i - 1].disconnect(this.filters[i]);
      this.filters[this.filters.length - 1].disconnect(this.getOutput());
    } else this.source!.disconnect(this.getOutput());
    this._connected = false;
    return this;
  }

  getFilters(): AudioNode[] {
    return this.filters;
  }

  setFilters(value: AudioNode[] = []): this {
    if (this._connected) {
      this.disconnect();
      this.filters = value.slice();
      this.connect();
    } else this.filters = value.slice();
    return this;
  }

  setDetune(value: number): this {
    this.detune = value;
    const source = this.source as AudioBufferSourceNode | null;
    if (this.isPlaying && source?.detune !== undefined)
      source.detune.setTargetAtTime(value, this.context.currentTime, 0.01);
    return this;
  }
  getDetune(): number {
    return this.detune;
  }
  getFilter(): AudioNode | undefined {
    return this.filters[0];
  }
  setFilter(filter?: AudioNode): this {
    return this.setFilters(filter ? [filter] : []);
  }

  setPlaybackRate(value: number): this | undefined {
    if (!this.hasPlaybackControl) {
      warn("Audio: this Audio has no playback control.");
      return;
    }
    this.playbackRate = value;
    if (this.isPlaying)
      (this.source as AudioBufferSourceNode).playbackRate.setTargetAtTime(value, this.context.currentTime, 0.01);
    return this;
  }
  getPlaybackRate(): number {
    return this.playbackRate;
  }
  onEnded(): void {
    this.isPlaying = false;
    this._progress = 0;
  }

  getLoop(): boolean {
    if (!this.hasPlaybackControl) {
      warn("Audio: this Audio has no playback control.");
      return false;
    }
    return this.loop;
  }
  setLoop(value: boolean): this | undefined {
    if (!this.hasPlaybackControl) {
      warn("Audio: this Audio has no playback control.");
      return;
    }
    this.loop = value;
    if (this.isPlaying) (this.source as AudioBufferSourceNode).loop = value;
    return this;
  }
  setLoopStart(value: number): this {
    this.loopStart = value;
    return this;
  }
  setLoopEnd(value: number): this {
    this.loopEnd = value;
    return this;
  }
  getVolume(): number {
    return this.gain.gain.value;
  }
  setVolume(value: number): this {
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
    return this;
  }

  copy(source: this, recursive?: boolean): this {
    super.copy(source, recursive);
    if (source.sourceType !== "buffer") {
      warn("Audio: Audio source type cannot be copied.");
      return this;
    }
    this.autoplay = source.autoplay;
    this.buffer = source.buffer;
    this.detune = source.detune;
    this.loop = source.loop;
    this.loopStart = source.loopStart;
    this.loopEnd = source.loopEnd;
    this.offset = source.offset;
    this.duration = source.duration;
    this.playbackRate = source.playbackRate;
    this.hasPlaybackControl = source.hasPlaybackControl;
    this.sourceType = source.sourceType;
    this.filters = source.filters.slice();
    return this;
  }
  clone(recursive?: boolean): this {
    const AudioClass = this.constructor as new (listener: AudioListener) => this;
    return new AudioClass(this.listener).copy(this, recursive);
  }
}
