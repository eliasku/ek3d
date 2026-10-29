import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";

/**
 * A subdivided box outline for LineSegments.
 *
 * ```ts
 * import { BoxLineGeometry } from "ek3d/addons/geometries/BoxLineGeometry";
 * import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
 * import { LineSegments } from "ek3d/objects/LineSegments";
 *
 * const lines = new LineSegments(new BoxLineGeometry(), new LineBasicMaterial({ color: 0x00ff00 }));
 * ```
 */
export class BoxLineGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1) {
    super();
    widthSegments = Math.floor(widthSegments);
    heightSegments = Math.floor(heightSegments);
    depthSegments = Math.floor(depthSegments);
    const widthHalf = width / 2,
      heightHalf = height / 2,
      depthHalf = depth / 2;
    const segmentWidth = width / widthSegments,
      segmentHeight = height / heightSegments,
      segmentDepth = depth / depthSegments;
    const vertices: number[] = [];
    let x = -widthHalf,
      y = -heightHalf,
      z = -depthHalf;
    for (let i = 0; i <= widthSegments; i++) {
      vertices.push(x, -heightHalf, -depthHalf, x, heightHalf, -depthHalf);
      vertices.push(x, heightHalf, -depthHalf, x, heightHalf, depthHalf);
      vertices.push(x, heightHalf, depthHalf, x, -heightHalf, depthHalf);
      vertices.push(x, -heightHalf, depthHalf, x, -heightHalf, -depthHalf);
      x += segmentWidth;
    }
    for (let i = 0; i <= heightSegments; i++) {
      vertices.push(-widthHalf, y, -depthHalf, widthHalf, y, -depthHalf);
      vertices.push(widthHalf, y, -depthHalf, widthHalf, y, depthHalf);
      vertices.push(widthHalf, y, depthHalf, -widthHalf, y, depthHalf);
      vertices.push(-widthHalf, y, depthHalf, -widthHalf, y, -depthHalf);
      y += segmentHeight;
    }
    for (let i = 0; i <= depthSegments; i++) {
      vertices.push(-widthHalf, -heightHalf, z, -widthHalf, heightHalf, z);
      vertices.push(-widthHalf, heightHalf, z, widthHalf, heightHalf, z);
      vertices.push(widthHalf, heightHalf, z, widthHalf, -heightHalf, z);
      vertices.push(widthHalf, -heightHalf, z, -widthHalf, -heightHalf, z);
      z += segmentDepth;
    }
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  }
}
