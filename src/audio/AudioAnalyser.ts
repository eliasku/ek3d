import type { Audio } from "./Audio";

/** Frequency-domain analysis of a source's output. */
export class AudioAnalyser {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  constructor(audio: Audio, fftSize: number = 2048) {
    this.analyser = audio.context.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    audio.getOutput().connect(this.analyser);
  }
  getFrequencyData(): Uint8Array<ArrayBuffer> {
    this.analyser.getByteFrequencyData(this.data);
    return this.data;
  }
  getAverageFrequency(): number {
    const data = this.getFrequencyData();
    let value = 0;
    for (let i = 0; i < data.length; i++) value += data[i];
    return value / data.length;
  }
}
