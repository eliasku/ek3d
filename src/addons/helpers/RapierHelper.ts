import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { LineSegments } from "../../objects/LineSegments";
import type { RapierWorld } from "../physics/RapierPhysics";

/** Displays the colliders in a Rapier world. */
export class RapierHelper extends LineSegments<LineBasicMaterial> {
  world: RapierWorld;

  constructor(world: RapierWorld) {
    super(new BufferGeometry(), new LineBasicMaterial({ vertexColors: true }));
    this.world = world;
    this.frustumCulled = false;
  }

  update(): void {
    const { vertices, colors } = this.world.debugRender();
    const position = this.geometry.getAttribute("position");
    const color = this.geometry.getAttribute("color");
    if (
      position instanceof BufferAttribute &&
      color instanceof BufferAttribute &&
      position.array.length === vertices.length &&
      color.array.length === colors.length
    ) {
      position.array.set(vertices);
      color.array.set(colors);
      position.needsUpdate = true;
      color.needsUpdate = true;
    } else {
      if (position || color) this.geometry.dispose();
      this.geometry.setAttribute("position", new BufferAttribute(vertices, 3));
      this.geometry.setAttribute("color", new BufferAttribute(colors, 4));
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
