import { Side } from "../../constants";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import type { Color } from "../../math/Color";
import { Mesh } from "../../objects/Mesh";
import { Scene } from "../../scenes/Scene";

/** A uniform color scene for PMREMGenerator.fromScene(). */
export class ColorEnvironment extends Scene {
  constructor(color: number | Color = 0xffffff) {
    super();
    this.name = "ColorEnvironment";
    this.add(new Mesh(new SphereGeometry(1, 16, 16), new MeshBasicMaterial({ color, side: Side.Back })));
  }

  dispose(): void {
    const mesh = this.children[0] as Mesh<MeshBasicMaterial>;
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
}
