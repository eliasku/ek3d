import { Side } from "../../constants";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import type { RectAreaLight } from "../../lights/RectAreaLight";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import type { Color } from "../../math/Color";
import { Line } from "../../objects/Line";
import { Mesh } from "../../objects/Mesh";

/** Visualizes the dimensions, color, and world transform of a rectangular area light. */
export class RectAreaLightHelper extends Line<LineBasicMaterial> {
  light: RectAreaLight;
  color: number | Color | string | undefined;

  constructor(light: RectAreaLight, color?: number | Color | string) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0, 1, 1, 0], 3));
    geometry.computeBoundingSphere();
    super(geometry, new LineBasicMaterial({ fog: false }));
    this.light = light;
    this.color = color;
    this.type = "RectAreaLightHelper";

    const face = new BufferGeometry();
    face.setAttribute(
      "position",
      new Float32BufferAttribute([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, -1, -1, 0, 1, -1, 0], 3),
    );
    face.computeBoundingSphere();
    this.add(new Mesh(face, new MeshBasicMaterial({ side: Side.Back, fog: false })));
  }

  updateMatrixWorld(): void {
    this.scale.set(0.5 * this.light.width, 0.5 * this.light.height, 1);
    const face = this.children[0] as Mesh<MeshBasicMaterial>;
    if (this.color !== undefined) {
      this.material.color.set(this.color);
      face.material.color.set(this.color);
    } else {
      const color = this.material.color.copy(this.light.color).multiplyScalar(this.light.intensity);
      const max = Math.max(color.r, color.g, color.b);
      if (max > 1) color.multiplyScalar(1 / max);
      face.material.color.copy(color);
    }
    this.matrixWorld.extractRotation(this.light.matrixWorld).scale(this.scale).copyPosition(this.light.matrixWorld);
    face.matrixWorld.copy(this.matrixWorld);
  }

  /** Frees the GPU resources allocated by this helper. */
  dispose(): void {
    const face = this.children[0] as Mesh<MeshBasicMaterial>;
    this.geometry.dispose();
    this.material.dispose();
    face.geometry.dispose();
    face.material.dispose();
  }
}
