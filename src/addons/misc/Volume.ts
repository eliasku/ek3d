import { Matrix4 } from "../../math/Matrix4";
import { Vector3 } from "../../math/Vector3";
import { VolumeSlice } from "./VolumeSlice";

export type VolumeData =
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array;
export type VolumeAxis = "x" | "y" | "z";

export class Volume {
  xLength: number;
  yLength: number;
  zLength: number;
  data: VolumeData;
  header: Record<string, unknown> = {};
  dimensions: number[];
  axisOrder: string[] = ["x", "y", "z"];
  spacing: number[] = [1, 1, 1];
  offset: number[] = [0, 0, 0];
  matrix: Matrix4 = new Matrix4();
  inverseMatrix: Matrix4 = new Matrix4();
  RASDimensions: number[];
  segmentation: boolean = false;
  dataType: string = "";
  min: number = Infinity;
  max: number = -Infinity;
  windowLow: number = 0;
  windowHigh: number = 1;
  sliceList: VolumeSlice[] = [];
  private _lowerThreshold: number = -Infinity;
  private _upperThreshold: number = Infinity;

  constructor(xLength?: number, yLength?: number, zLength?: number, type?: string, arrayBuffer?: ArrayBuffer) {
    this.xLength = Number(xLength) || 1;
    this.yLength = Number(yLength) || 1;
    this.zLength = Number(zLength) || 1;
    this.dimensions = [this.xLength, this.yLength, this.zLength];
    this.RASDimensions = [...this.dimensions];
    const buffer = arrayBuffer ?? new ArrayBuffer(0);
    switch (type) {
      case "Int8":
      case "int8":
      case "signed char":
      case "int8_t":
        this.data = new Int8Array(buffer);
        break;
      case "Int16":
      case "int16":
      case "short":
      case "short int":
      case "signed short":
      case "signed short int":
      case "int16_t":
        this.data = new Int16Array(buffer);
        break;
      case "Uint16":
      case "uint16":
      case "ushort":
      case "unsigned short":
      case "unsigned short int":
      case "uint16_t":
        this.data = new Uint16Array(buffer);
        break;
      case "Int32":
      case "int32":
      case "int":
      case "signed int":
      case "int32_t":
        this.data = new Int32Array(buffer);
        break;
      case "Uint32":
      case "uint32":
      case "uint":
      case "unsigned int":
      case "uint32_t":
        this.data = new Uint32Array(buffer);
        break;
      case "Float32":
      case "float32":
      case "float":
        this.data = new Float32Array(buffer);
        break;
      case "Float64":
      case "float64":
      case "double":
        this.data = new Float64Array(buffer);
        break;
      case "longlong":
      case "long long":
      case "long long int":
      case "signed long long":
      case "signed long long int":
      case "int64":
      case "int64_t":
      case "ulonglong":
      case "unsigned long long":
      case "unsigned long long int":
      case "uint64":
      case "uint64_t":
        throw new Error("THREE.Volume: type is not supported in JavaScript.");
      default:
        this.data = new Uint8Array(buffer);
    }
    if (xLength !== undefined && this.data.length !== this.xLength * this.yLength * this.zLength) {
      throw new Error("THREE.Volume: lengths are not matching arrayBuffer size.");
    }
  }

  get lowerThreshold(): number {
    return this._lowerThreshold;
  }
  set lowerThreshold(value: number) {
    this._lowerThreshold = value;
    this.sliceList.forEach((slice) => {
      slice.geometryNeedsUpdate = true;
    });
  }
  get upperThreshold(): number {
    return this._upperThreshold;
  }
  set upperThreshold(value: number) {
    this._upperThreshold = value;
    this.sliceList.forEach((slice) => {
      slice.geometryNeedsUpdate = true;
    });
  }

  getData(i: number, j: number, k: number): number {
    return this.data[this.access(i, j, k)];
  }
  access(i: number, j: number, k: number): number {
    return k * this.xLength * this.yLength + j * this.xLength + i;
  }
  reverseAccess(index: number): number[] {
    const z = Math.floor(index / (this.yLength * this.xLength));
    const y = Math.floor((index - z * this.yLength * this.xLength) / this.xLength);
    return [index - z * this.yLength * this.xLength - y * this.xLength, y, z];
  }
  map(
    functionToMap: (this: unknown, value: number, index: number, data: VolumeData) => number,
    context?: unknown,
  ): this {
    for (let i = 0; i < this.data.length; i++)
      this.data[i] = functionToMap.call(context || this, this.data[i], i, this.data);
    return this;
  }

  extractPerpendicularPlane(
    axis: VolumeAxis,
    RASIndex: number,
  ): {
    iLength: number;
    jLength: number;
    sliceAccess: (i: number, j: number) => number;
    matrix: Matrix4;
    planeWidth: number;
    planeHeight: number;
  } {
    const axisInIJK = new Vector3(),
      firstDirection = new Vector3(),
      secondDirection = new Vector3();
    const planeMatrix = new Matrix4();
    const dimensions = new Vector3(this.xLength, this.yLength, this.zLength);
    let firstSpacing: number, secondSpacing: number, index: Vector3;
    switch (axis) {
      case "x":
        axisInIJK.set(1, 0, 0);
        firstDirection.set(0, 0, -1);
        secondDirection.set(0, -1, 0);
        firstSpacing = this.spacing[this.axisOrder.indexOf("z")];
        secondSpacing = this.spacing[this.axisOrder.indexOf("y")];
        index = new Vector3(RASIndex, 0, 0);
        planeMatrix
          .makeRotationY(Math.PI / 2)
          .setPosition(new Vector3(RASIndex - (this.RASDimensions[0] - 1) / 2, 0, 0));
        break;
      case "y":
        axisInIJK.set(0, 1, 0);
        firstDirection.set(1, 0, 0);
        secondDirection.set(0, 0, 1);
        firstSpacing = this.spacing[this.axisOrder.indexOf("x")];
        secondSpacing = this.spacing[this.axisOrder.indexOf("z")];
        index = new Vector3(0, RASIndex, 0);
        planeMatrix
          .makeRotationX(-Math.PI / 2)
          .setPosition(new Vector3(0, RASIndex - (this.RASDimensions[1] - 1) / 2, 0));
        break;
      default:
        axisInIJK.set(0, 0, 1);
        firstDirection.set(1, 0, 0);
        secondDirection.set(0, -1, 0);
        firstSpacing = this.spacing[this.axisOrder.indexOf("x")];
        secondSpacing = this.spacing[this.axisOrder.indexOf("y")];
        index = new Vector3(0, 0, RASIndex);
        planeMatrix.setPosition(new Vector3(0, 0, RASIndex - (this.RASDimensions[2] - 1) / 2));
    }
    if (!this.segmentation) {
      firstDirection.applyMatrix4(this.inverseMatrix).normalize();
      secondDirection.applyMatrix4(this.inverseMatrix).normalize();
      axisInIJK.applyMatrix4(this.inverseMatrix).normalize();
    }
    const iLength = Math.floor(Math.abs(firstDirection.dot(dimensions)));
    const jLength = Math.floor(Math.abs(secondDirection.dot(dimensions)));
    const ijkIndex = Math.abs(Math.round(index.applyMatrix4(this.inverseMatrix).dot(axisInIJK)));
    const base = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
    const directions = base.map((b) =>
      [firstDirection, secondDirection, axisInIJK].find((direction) => Math.abs(direction.dot(b)) > 0.9),
    );
    const [iDirection, jDirection, kDirection] = directions;
    if (!iDirection || !jDirection || !kDirection) throw new Error("THREE.Volume: unsupported slice orientation.");
    const sliceAccess = (i: number, j: number): number => {
      const si = iDirection === axisInIJK ? ijkIndex : iDirection === firstDirection ? i : j;
      const sj = jDirection === axisInIJK ? ijkIndex : jDirection === firstDirection ? i : j;
      const sk = kDirection === axisInIJK ? ijkIndex : kDirection === firstDirection ? i : j;
      return this.access(
        iDirection.x > 0 ? si : this.xLength - 1 - si,
        jDirection.y > 0 ? sj : this.yLength - 1 - sj,
        kDirection.z > 0 ? sk : this.zLength - 1 - sk,
      );
    };
    return {
      iLength,
      jLength,
      sliceAccess,
      matrix: planeMatrix,
      planeWidth: Math.abs(iLength * firstSpacing),
      planeHeight: Math.abs(jLength * secondSpacing),
    };
  }
  extractSlice(axis: VolumeAxis, index: number): VolumeSlice {
    const slice = new VolumeSlice(this, index, axis);
    this.sliceList.push(slice);
    return slice;
  }
  repaintAllSlices(): this {
    this.sliceList.forEach((slice) => slice.repaint());
    return this;
  }
  computeMinMax(): number[] {
    let min = Infinity,
      max = -Infinity;
    for (const value of this.data)
      if (!Number.isNaN(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    this.min = min;
    this.max = max;
    return [min, max];
  }
}
