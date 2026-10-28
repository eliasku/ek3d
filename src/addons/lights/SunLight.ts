import { Object3D } from "../../core/Object3D";
import { Light } from "../../lights/Light";
import type { Color } from "../../math/Color";
import { SunLightShadow } from "./SunLightShadow";

/** A directional sun light with two cascaded shadow maps. */
export class SunLight extends Light {
  isSunLight: boolean = true;
  shadow: SunLightShadow;

  constructor(color?: number | Color | string, intensity?: number) {
    super(color, intensity);
    this.type = "SunLight";
    this.position.copy(Object3D.DEFAULT_UP);
    this.updateMatrix();
    this.shadow = new SunLightShadow();
  }

  override dispose(): void {
    super.dispose();
    this.shadow.dispose();
  }

  override copy(source: SunLight, recursive?: boolean): this {
    super.copy(source, recursive);
    this.shadow = source.shadow.clone();
    return this;
  }

  override toJSON(meta?: unknown) {
    const data = super.toJSON(meta);
    data.object.shadow = this.shadow.toJSON();
    return data;
  }
}
