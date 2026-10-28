import type { BufferGeometry } from "../../core/BufferGeometry";
import { WireframeGeometry } from "../../geometries/WireframeGeometry";
import { LineSegmentsGeometry } from "./LineSegmentsGeometry";

/** A line segments geometry for wireframe rendering. */
export class WireframeGeometry2 extends LineSegmentsGeometry {
  isWireframeGeometry2: boolean;

  constructor(geometry?: BufferGeometry) {
    super();
    this.isWireframeGeometry2 = true;
    this.type = "WireframeGeometry2";
    this.fromWireframeGeometry(new WireframeGeometry(geometry));
  }
}
