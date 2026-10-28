import { LineGeometry } from "./LineGeometry";
import { LineMaterial } from "./LineMaterial";
import { LineSegments2 } from "./LineSegments2";

export class Line2 extends LineSegments2 {
  isLine2: boolean = true;

  constructor(geometry = new LineGeometry(), material = new LineMaterial({ color: Math.random() * 0xffffff })) {
    super(geometry, material);
    this.type = "Line2";
  }
}
