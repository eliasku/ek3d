import type { PositionalAudio } from "../../audio/PositionalAudio";
import { BufferGeometry } from "../../core/BufferGeometry";
import { BufferAttribute } from "../../core/BufferAttribute";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { degToRad } from "../../math/MathUtils";
import { Line } from "../../objects/Line";

/** Visualizes a positional source's directional cone as a child of that source. */
export class PositionalAudioHelper extends Line<LineBasicMaterial[]> {
  audio: PositionalAudio;
  range: number;
  divisionsInnerAngle: number;
  divisionsOuterAngle: number;
  constructor(
    audio: PositionalAudio,
    range: number = 1,
    divisionsInnerAngle: number = 16,
    divisionsOuterAngle: number = 2,
  ) {
    const geometry = new BufferGeometry();
    const divisions = divisionsInnerAngle + divisionsOuterAngle * 2;
    geometry.setAttribute("position", new BufferAttribute(new Float32Array((divisions * 3 + 3) * 3), 3));
    super(geometry, [new LineBasicMaterial({ color: 0xffff00 }), new LineBasicMaterial({ color: 0x00ff00 })]);
    this.audio = audio;
    this.range = range;
    this.divisionsInnerAngle = divisionsInnerAngle;
    this.divisionsOuterAngle = divisionsOuterAngle;
    this.type = "PositionalAudioHelper";
    this.update();
  }
  update(): void {
    const inner = degToRad(this.audio.panner.coneInnerAngle) / 2;
    const outer = degToRad(this.audio.panner.coneOuterAngle) / 2;
    const geometry = this.geometry;
    const positions = geometry.getAttribute("position") as BufferAttribute;
    let start = 0;
    geometry.clearGroups();
    const generateSegment = (from: number, to: number, divisions: number, materialIndex: number): void => {
      const step = (to - from) / divisions;
      positions.setXYZ(start, 0, 0, 0);
      let count = 1;
      for (let angle = from; angle < to; angle += step) {
        const stride = start + count;
        const next = Math.min(angle + step, to);
        positions.setXYZ(stride, Math.sin(angle) * this.range, 0, Math.cos(angle) * this.range);
        positions.setXYZ(stride + 1, Math.sin(next) * this.range, 0, Math.cos(next) * this.range);
        positions.setXYZ(stride + 2, 0, 0, 0);
        count += 3;
      }
      geometry.addGroup(start, count, materialIndex);
      start += count;
    };
    generateSegment(-outer, -inner, this.divisionsOuterAngle, 0);
    generateSegment(-inner, inner, this.divisionsInnerAngle, 1);
    generateSegment(inner, outer, this.divisionsOuterAngle, 0);
    positions.needsUpdate = true;
    this.material[0].visible = inner !== outer;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material[0].dispose();
    this.material[1].dispose();
  }
}
