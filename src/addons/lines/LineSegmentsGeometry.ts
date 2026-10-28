import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { InstancedBufferGeometry } from "../../core/InstancedBufferGeometry";
import { InstancedInterleavedBuffer } from "../../core/InstancedInterleavedBuffer";
import { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import { WireframeGeometry } from "../../geometries/WireframeGeometry";
import type { EdgesGeometry } from "../../geometries/EdgesGeometry";
import { Box3 } from "../../math/Box3";
import type { Matrix4 } from "../../math/Matrix4";
import { Sphere } from "../../math/Sphere";
import { Vector3 } from "../../math/Vector3";
import type { LineSegments } from "../../objects/LineSegments";
import type { Mesh } from "../../objects/Mesh";

const _box = new Box3();
const _vector = new Vector3();

/** A series of vertex pairs forming line segments for LineSegments2. */
export class LineSegmentsGeometry extends InstancedBufferGeometry {
  isLineSegmentsGeometry: boolean;

  constructor() {
    super();
    this.isLineSegmentsGeometry = true;
    this.type = "LineSegmentsGeometry";
    this.setIndex([0, 2, 1, 2, 3, 1, 2, 4, 3, 4, 5, 3, 4, 6, 5, 6, 7, 5]);
    this.setAttribute(
      "position",
      new Float32BufferAttribute([-1, 2, 0, 1, 2, 0, -1, 1, 0, 1, 1, 0, -1, 0, 0, 1, 0, 0, -1, -1, 0, 1, -1, 0], 3),
    );
    this.setAttribute("uv", new Float32BufferAttribute([-1, 2, 1, 2, -1, 1, 1, 1, -1, -1, 1, -1, -1, -2, 1, -2], 2));
  }

  applyMatrix4(matrix: Matrix4): this {
    const start = this.attributes.instanceStart as InterleavedBufferAttribute | undefined;
    const end = this.attributes.instanceEnd as InterleavedBufferAttribute;
    if (start !== undefined) {
      start.applyMatrix4(matrix);
      end.applyMatrix4(matrix);
      start.needsUpdate = true;
    }
    if (this.boundingBox !== null) this.computeBoundingBox();
    if (this.boundingSphere !== null) this.computeBoundingSphere();
    return this;
  }

  /** Sets pairs of start and end positions. */
  setPositions(array: Float32Array | number[]): this {
    const lineSegments = array instanceof Float32Array ? array : new Float32Array(array);
    const buffer = new InstancedInterleavedBuffer(lineSegments, 6, 1);
    this.setAttribute("instanceStart", new InterleavedBufferAttribute(buffer, 3, 0));
    this.setAttribute("instanceEnd", new InterleavedBufferAttribute(buffer, 3, 3));
    this.instanceCount = this.attributes.instanceStart.count;
    this.computeBoundingBox();
    this.computeBoundingSphere();
    return this;
  }

  /** Sets pairs of start and end colors. */
  setColors(array: Float32Array | number[]): this {
    const colors = array instanceof Float32Array ? array : new Float32Array(array);
    const buffer = new InstancedInterleavedBuffer(colors, 6, 1);
    this.setAttribute("instanceColorStart", new InterleavedBufferAttribute(buffer, 3, 0));
    this.setAttribute("instanceColorEnd", new InterleavedBufferAttribute(buffer, 3, 3));
    return this;
  }

  fromWireframeGeometry(geometry: WireframeGeometry): this {
    this.setPositions((geometry.attributes.position as Float32BufferAttribute).array as Float32Array);
    return this;
  }

  fromEdgesGeometry(geometry: EdgesGeometry): this {
    this.setPositions((geometry.attributes.position as Float32BufferAttribute).array as Float32Array);
    return this;
  }

  fromMesh(mesh: Mesh): this {
    return this.fromWireframeGeometry(new WireframeGeometry(mesh.geometry));
  }

  /** The source line segments geometry must be non-indexed. */
  fromLineSegments(lineSegments: LineSegments): this {
    this.setPositions((lineSegments.geometry.attributes.position as Float32BufferAttribute).array as Float32Array);
    return this;
  }

  computeBoundingBox(): void {
    if (this.boundingBox === null) this.boundingBox = new Box3();
    const start = this.attributes.instanceStart as InterleavedBufferAttribute | undefined;
    const end = this.attributes.instanceEnd as InterleavedBufferAttribute | undefined;
    if (start !== undefined && end !== undefined) {
      this.boundingBox.setFromBufferAttribute(start);
      _box.setFromBufferAttribute(end);
      this.boundingBox.union(_box);
    }
  }

  computeBoundingSphere(): void {
    if (this.boundingSphere === null) this.boundingSphere = new Sphere();
    if (this.boundingBox === null) this.computeBoundingBox();
    const start = this.attributes.instanceStart as InterleavedBufferAttribute | undefined;
    const end = this.attributes.instanceEnd as InterleavedBufferAttribute | undefined;
    if (start !== undefined && end !== undefined) {
      const center = this.boundingSphere.center;
      this.boundingBox!.getCenter(center);
      let maxRadiusSq = 0;
      for (let i = 0; i < start.count; i++) {
        _vector.fromBufferAttribute(start, i);
        maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector));
        _vector.fromBufferAttribute(end, i);
        maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector));
      }
      this.boundingSphere.radius = Math.sqrt(maxRadiusSq);
      if (isNaN(this.boundingSphere.radius)) {
        console.error(
          "THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",
          this,
        );
      }
    }
  }
}
