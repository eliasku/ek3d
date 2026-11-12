import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Color } from "../../math/Color";
import { BufferUsage } from "../../constants";
import { Matrix4 } from "../../math/Matrix4";
import { Matrix3 } from "../../math/Matrix3";
import { Mesh } from "../../objects/Mesh";
import { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import { Vector3 } from "../../math/Vector3";

export interface TubePainterInstance {
  mesh: Mesh<MeshStandardMaterial>;
  moveTo(position: Vector3): void;
  lineTo(position: Vector3): void;
  setSize(value: number): void;
  setColor(value: Color): void;
  update(): void;
}

export class TubePainter implements TubePainterInstance {
  mesh: Mesh<MeshStandardMaterial>;
  private positions: BufferAttribute;
  private normals: BufferAttribute;
  private colors: BufferAttribute;
  private geometry: BufferGeometry;
  private normalMatrix: Matrix3;
  private normalMatrix1: Matrix3;
  private normalMatrix2: Matrix3;
  private vector: Vector3;
  private vector1: Vector3;
  private vector2: Vector3;
  private vector3: Vector3;
  private vector4: Vector3;
  private color1: Color;
  private color2: Color;
  private size1: number;
  private size2: number;
  private direction: Vector3;
  private normal: Vector3;
  private side: Vector3;
  private point1: Vector3;
  private point2: Vector3;
  private matrix1: Matrix4;
  private matrix2: Matrix4;
  private lastNormal: Vector3;
  private prevDirection: Vector3;
  private rotationAxis: Vector3;
  private isFirstSegment: boolean;
  private endCapStartIndex: number | null;
  private endCapVertexCount: number;
  private count: number;

  constructor() {
    const BUFFER_SIZE = 1000000 * 3;

    this.positions = new BufferAttribute(new Float32Array(BUFFER_SIZE), 3);
    this.positions.usage = BufferUsage.DynamicDraw;

    this.normals = new BufferAttribute(new Float32Array(BUFFER_SIZE), 3);
    this.normals.usage = BufferUsage.DynamicDraw;

    this.colors = new BufferAttribute(new Float32Array(BUFFER_SIZE), 3);
    this.colors.usage = BufferUsage.DynamicDraw;

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", this.positions);
    this.geometry.setAttribute("normal", this.normals);
    this.geometry.setAttribute("color", this.colors);
    this.geometry.drawRange.count = 0;

    const material = new MeshStandardMaterial({ vertexColors: true });
    this.mesh = new Mesh<MeshStandardMaterial>(this.geometry, material);
    this.mesh.frustumCulled = false;

    this.normalMatrix = new Matrix3();
    this.normalMatrix1 = new Matrix3();
    this.normalMatrix2 = new Matrix3();
    this.vector = new Vector3();
    this.vector1 = new Vector3();
    this.vector2 = new Vector3();
    this.vector3 = new Vector3();
    this.vector4 = new Vector3();
    this.color1 = new Color(0xffffff);
    this.color2 = new Color(0xffffff);
    this.size1 = 1;
    this.size2 = 1;
    this.direction = new Vector3();
    this.normal = new Vector3();
    this.side = new Vector3();
    this.point1 = new Vector3();
    this.point2 = new Vector3();
    this.matrix1 = new Matrix4();
    this.matrix2 = new Matrix4();
    this.lastNormal = new Vector3();
    this.prevDirection = new Vector3();
    this.rotationAxis = new Vector3();
    this.isFirstSegment = true;
    this.endCapStartIndex = null;
    this.endCapVertexCount = 0;
    this.count = 0;

    this.moveTo = this.moveTo.bind(this);
    this.lineTo = this.lineTo.bind(this);
    this.setSize = this.setSize.bind(this);
    this.setColor = this.setColor.bind(this);
    this.update = this.update.bind(this);
  }

  private getPoints(size: number): Vector3[] {
    const PI2 = Math.PI * 2;

    const sides = 15;
    const array: Vector3[] = [];
    const radius = 0.01 * size;

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * PI2;
      array.push(new Vector3(Math.sin(angle) * radius, Math.cos(angle) * radius, 0));
    }

    return array;
  }

  private addCap(position: Vector3, matrix: Matrix4, isEndCap: boolean, capSize: number): void {
    let count = this.geometry.drawRange.count;

    const points = this.getPoints(capSize);
    const sides = points.length;
    const radius = 0.01 * capSize;
    const latSegments = 4;
    const directionSign = isEndCap ? -1 : 1;

    this.normalMatrix.getNormalMatrix(matrix);

    for (let lat = 0; lat < latSegments; lat++) {
      const phi1 = (lat / latSegments) * Math.PI * 0.5;
      const phi2 = ((lat + 1) / latSegments) * Math.PI * 0.5;

      const z1 = Math.sin(phi1) * radius * directionSign;
      const r1 = Math.cos(phi1) * radius;

      const z2 = Math.sin(phi2) * radius * directionSign;
      const r2 = Math.cos(phi2) * radius;

      for (let i = 0; i < sides; i++) {
        const theta1 = (i / sides) * Math.PI * 2;
        const theta2 = ((i + 1) / sides) * Math.PI * 2;

        // First ring
        const x1 = Math.sin(theta1) * r1;
        const y1 = Math.cos(theta1) * r1;

        const x2 = Math.sin(theta2) * r1;
        const y2 = Math.cos(theta2) * r1;

        // Second ring
        const x3 = Math.sin(theta1) * r2;
        const y3 = Math.cos(theta1) * r2;

        const x4 = Math.sin(theta2) * r2;
        const y4 = Math.cos(theta2) * r2;

        // Transform to world space
        this.vector1.set(x1, y1, z1).applyMatrix4(matrix).add(position);
        this.vector2.set(x2, y2, z1).applyMatrix4(matrix).add(position);
        this.vector3.set(x3, y3, z2).applyMatrix4(matrix).add(position);
        this.vector4.set(x4, y4, z2).applyMatrix4(matrix).add(position);

        // First triangle
        this.normal.set(x1, y1, z1).applyNormalMatrix(this.normalMatrix);
        this.vector.set(x2, y2, z1).applyNormalMatrix(this.normalMatrix);
        this.side.set(x3, y3, z2).applyNormalMatrix(this.normalMatrix);

        if (isEndCap) {
          this.vector1.toArray(this.positions.array, count * 3);
          this.vector2.toArray(this.positions.array, (count + 1) * 3);
          this.vector3.toArray(this.positions.array, (count + 2) * 3);

          this.normal.toArray(this.normals.array, count * 3);
          this.vector.toArray(this.normals.array, (count + 1) * 3);
          this.side.toArray(this.normals.array, (count + 2) * 3);
        } else {
          this.vector1.toArray(this.positions.array, count * 3);
          this.vector3.toArray(this.positions.array, (count + 1) * 3);
          this.vector2.toArray(this.positions.array, (count + 2) * 3);

          this.normal.toArray(this.normals.array, count * 3);
          this.side.toArray(this.normals.array, (count + 1) * 3);
          this.vector.toArray(this.normals.array, (count + 2) * 3);
        }

        this.color1.toArray(this.colors.array, count * 3);
        this.color1.toArray(this.colors.array, (count + 1) * 3);
        this.color1.toArray(this.colors.array, (count + 2) * 3);

        count += 3;

        // Second triangle
        if (r2 > 0.001) {
          this.normal.set(x2, y2, z1).applyNormalMatrix(this.normalMatrix);
          this.vector.set(x4, y4, z2).applyNormalMatrix(this.normalMatrix);
          this.side.set(x3, y3, z2).applyNormalMatrix(this.normalMatrix);

          if (isEndCap) {
            this.vector2.toArray(this.positions.array, count * 3);
            this.vector4.toArray(this.positions.array, (count + 1) * 3);
            this.vector3.toArray(this.positions.array, (count + 2) * 3);

            this.normal.toArray(this.normals.array, count * 3);
            this.vector.toArray(this.normals.array, (count + 1) * 3);
            this.side.toArray(this.normals.array, (count + 2) * 3);
          } else {
            this.vector3.toArray(this.positions.array, count * 3);
            this.vector4.toArray(this.positions.array, (count + 1) * 3);
            this.vector2.toArray(this.positions.array, (count + 2) * 3);

            this.side.toArray(this.normals.array, count * 3);
            this.vector.toArray(this.normals.array, (count + 1) * 3);
            this.normal.toArray(this.normals.array, (count + 2) * 3);
          }

          this.color1.toArray(this.colors.array, count * 3);
          this.color1.toArray(this.colors.array, (count + 1) * 3);
          this.color1.toArray(this.colors.array, (count + 2) * 3);

          count += 3;
        }
      }
    }

    this.geometry.drawRange.count = count;
  }

  private updateEndCap(position: Vector3, matrix: Matrix4, capSize: number): void {
    if (this.endCapStartIndex === null) return;

    const points = this.getPoints(capSize);
    const sides = points.length;
    const radius = 0.01 * capSize;
    const latSegments = 4;

    this.normalMatrix.getNormalMatrix(matrix);

    let count = this.endCapStartIndex;

    for (let lat = 0; lat < latSegments; lat++) {
      const phi1 = (lat / latSegments) * Math.PI * 0.5;
      const phi2 = ((lat + 1) / latSegments) * Math.PI * 0.5;

      const z1 = -Math.sin(phi1) * radius;
      const r1 = Math.cos(phi1) * radius;

      const z2 = -Math.sin(phi2) * radius;
      const r2 = Math.cos(phi2) * radius;

      for (let i = 0; i < sides; i++) {
        const theta1 = (i / sides) * Math.PI * 2;
        const theta2 = ((i + 1) / sides) * Math.PI * 2;

        // First ring
        const x1 = Math.sin(theta1) * r1;
        const y1 = Math.cos(theta1) * r1;

        const x2 = Math.sin(theta2) * r1;
        const y2 = Math.cos(theta2) * r1;

        // Second ring
        const x3 = Math.sin(theta1) * r2;
        const y3 = Math.cos(theta1) * r2;

        const x4 = Math.sin(theta2) * r2;
        const y4 = Math.cos(theta2) * r2;

        // Transform positions to world space
        this.vector1.set(x1, y1, z1).applyMatrix4(matrix).add(position);
        this.vector2.set(x2, y2, z1).applyMatrix4(matrix).add(position);
        this.vector3.set(x3, y3, z2).applyMatrix4(matrix).add(position);
        this.vector4.set(x4, y4, z2).applyMatrix4(matrix).add(position);

        // Transform normals to world space
        this.normal.set(x1, y1, z1).applyNormalMatrix(this.normalMatrix);
        this.vector.set(x2, y2, z1).applyNormalMatrix(this.normalMatrix);
        this.side.set(x3, y3, z2).applyNormalMatrix(this.normalMatrix);

        // First triangle
        this.vector1.toArray(this.positions.array, count * 3);
        this.vector2.toArray(this.positions.array, (count + 1) * 3);
        this.vector3.toArray(this.positions.array, (count + 2) * 3);

        this.normal.toArray(this.normals.array, count * 3);
        this.vector.toArray(this.normals.array, (count + 1) * 3);
        this.side.toArray(this.normals.array, (count + 2) * 3);

        this.color1.toArray(this.colors.array, count * 3);
        this.color1.toArray(this.colors.array, (count + 1) * 3);
        this.color1.toArray(this.colors.array, (count + 2) * 3);

        count += 3;

        // Second triangle
        if (r2 > 0.001) {
          this.normal.set(x2, y2, z1).applyNormalMatrix(this.normalMatrix);
          this.vector.set(x4, y4, z2).applyNormalMatrix(this.normalMatrix);
          this.side.set(x3, y3, z2).applyNormalMatrix(this.normalMatrix);

          this.vector2.toArray(this.positions.array, count * 3);
          this.vector4.toArray(this.positions.array, (count + 1) * 3);
          this.vector3.toArray(this.positions.array, (count + 2) * 3);

          this.normal.toArray(this.normals.array, count * 3);
          this.vector.toArray(this.normals.array, (count + 1) * 3);
          this.side.toArray(this.normals.array, (count + 2) * 3);

          this.color1.toArray(this.colors.array, count * 3);
          this.color1.toArray(this.colors.array, (count + 1) * 3);
          this.color1.toArray(this.colors.array, (count + 2) * 3);

          count += 3;
        }
      }
    }

    this.positions.addUpdateRange(this.endCapStartIndex * 3, this.endCapVertexCount * 3);
    this.normals.addUpdateRange(this.endCapStartIndex * 3, this.endCapVertexCount * 3);
    this.colors.addUpdateRange(this.endCapStartIndex * 3, this.endCapVertexCount * 3);
  }

  private stroke(
    position1: Vector3,
    position2: Vector3,
    matrix1: Matrix4,
    matrix2: Matrix4,
    size1: number,
    size2: number,
  ): void {
    if (position1.distanceToSquared(position2) === 0) return;

    let count = this.geometry.drawRange.count;

    const points1 = this.getPoints(size1);
    const points2 = this.getPoints(size2);

    this.normalMatrix1.getNormalMatrix(matrix1);
    this.normalMatrix2.getNormalMatrix(matrix2);

    for (let i = 0, il = points2.length; i < il; i++) {
      const vertex1_2 = points2[i];
      const vertex2_2 = points2[(i + 1) % il];
      const vertex1_1 = points1[i];
      const vertex2_1 = points1[(i + 1) % il];

      this.vector1.copy(vertex1_2).applyMatrix4(matrix2).add(position2);
      this.vector2.copy(vertex2_2).applyMatrix4(matrix2).add(position2);
      this.vector3.copy(vertex2_1).applyMatrix4(matrix1).add(position1);
      this.vector4.copy(vertex1_1).applyMatrix4(matrix1).add(position1);

      this.vector1.toArray(this.positions.array, (count + 0) * 3);
      this.vector2.toArray(this.positions.array, (count + 1) * 3);
      this.vector4.toArray(this.positions.array, (count + 2) * 3);

      this.vector2.toArray(this.positions.array, (count + 3) * 3);
      this.vector3.toArray(this.positions.array, (count + 4) * 3);
      this.vector4.toArray(this.positions.array, (count + 5) * 3);

      this.vector1.copy(vertex1_2).applyNormalMatrix(this.normalMatrix2);
      this.vector2.copy(vertex2_2).applyNormalMatrix(this.normalMatrix2);
      this.vector3.copy(vertex2_1).applyNormalMatrix(this.normalMatrix1);
      this.vector4.copy(vertex1_1).applyNormalMatrix(this.normalMatrix1);

      this.vector1.toArray(this.normals.array, (count + 0) * 3);
      this.vector2.toArray(this.normals.array, (count + 1) * 3);
      this.vector4.toArray(this.normals.array, (count + 2) * 3);

      this.vector2.toArray(this.normals.array, (count + 3) * 3);
      this.vector3.toArray(this.normals.array, (count + 4) * 3);
      this.vector4.toArray(this.normals.array, (count + 5) * 3);

      this.color2.toArray(this.colors.array, (count + 0) * 3);
      this.color2.toArray(this.colors.array, (count + 1) * 3);
      this.color1.toArray(this.colors.array, (count + 2) * 3);

      this.color2.toArray(this.colors.array, (count + 3) * 3);
      this.color1.toArray(this.colors.array, (count + 4) * 3);
      this.color1.toArray(this.colors.array, (count + 5) * 3);

      count += 6;
    }

    this.geometry.drawRange.count = count;
  }

  private calculateRMF(): void {
    if (this.isFirstSegment === true) {
      if (Math.abs(this.direction.y) < 0.99) {
        this.vector.copy(this.direction).multiplyScalar(this.direction.y);
        this.normal.set(0, 1, 0).sub(this.vector).normalize();
      } else {
        this.vector.copy(this.direction).multiplyScalar(this.direction.x);
        this.normal.set(1, 0, 0).sub(this.vector).normalize();
      }
    } else {
      this.rotationAxis.crossVectors(this.prevDirection, this.direction);

      const rotAxisLength = this.rotationAxis.length();

      if (rotAxisLength > 0.0001) {
        this.rotationAxis.divideScalar(rotAxisLength);
        this.vector.addVectors(this.prevDirection, this.direction);
        const c1 = -2.0 / (1.0 + this.prevDirection.dot(this.direction));
        const dot = this.lastNormal.dot(this.vector);
        this.normal.copy(this.lastNormal).addScaledVector(this.vector, c1 * dot);
      } else {
        this.normal.copy(this.lastNormal);
      }
    }

    this.side.crossVectors(this.direction, this.normal).normalize();
    this.normal.crossVectors(this.side, this.direction).normalize();

    if (this.isFirstSegment === false) {
      const smoothFactor = 0.3;

      this.normal.lerp(this.lastNormal, smoothFactor).normalize();
      this.side.crossVectors(this.direction, this.normal).normalize();
      this.normal.crossVectors(this.side, this.direction).normalize();
    }

    this.lastNormal.copy(this.normal);
    this.prevDirection.copy(this.direction);

    this.matrix1.makeBasis(this.side, this.normal, this.vector.copy(this.direction).negate());
  }

  moveTo(position: Vector3): void {
    this.point2.copy(position);

    this.lastNormal.set(0, 1, 0);

    this.isFirstSegment = true;

    this.endCapStartIndex = null;
    this.endCapVertexCount = 0;
  }

  lineTo(position: Vector3): void {
    this.point1.copy(position);

    this.direction.subVectors(this.point1, this.point2);

    const length = this.direction.length();

    if (length === 0) return;

    this.direction.normalize();

    this.calculateRMF();

    if (this.isFirstSegment === true) {
      this.color2.copy(this.color1);
      this.size2 = this.size1;

      this.matrix2.copy(this.matrix1);

      this.addCap(this.point2, this.matrix2, false, this.size2);

      // End cap is added immediately after start cap and updated in-place
      this.endCapStartIndex = this.geometry.drawRange.count;
      this.addCap(this.point1, this.matrix1, true, this.size1);
      this.endCapVertexCount = this.geometry.drawRange.count - this.endCapStartIndex;
    }

    this.stroke(this.point1, this.point2, this.matrix1, this.matrix2, this.size1, this.size2);

    this.updateEndCap(this.point1, this.matrix1, this.size1);

    this.point2.copy(this.point1);
    this.matrix2.copy(this.matrix1);

    this.color2.copy(this.color1);
    this.size2 = this.size1;

    this.isFirstSegment = false;
  }

  setSize(value: number): void {
    this.size1 = value;
  }

  setColor(value: Color): void {
    this.color1.copy(value);
  }

  //

  update(): void {
    const start = this.count;
    const end = this.geometry.drawRange.count;

    if (start === end) return;

    this.positions.addUpdateRange(start * 3, (end - start) * 3);
    this.positions.needsUpdate = true;

    this.normals.addUpdateRange(start * 3, (end - start) * 3);
    this.normals.needsUpdate = true;

    this.colors.addUpdateRange(start * 3, (end - start) * 3);
    this.colors.needsUpdate = true;

    this.count = end;
  }
}
