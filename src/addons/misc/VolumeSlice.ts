import { ClampToEdgeWrapping, DoubleSide, LinearFilter, SRGBColorSpace } from "../../constants";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Matrix4 } from "../../math/Matrix4";
import { Mesh } from "../../objects/Mesh";
import { Texture } from "../../textures/Texture";
import type { Volume, VolumeAxis } from "./Volume";

export class VolumeSlice {
  volume: Volume;
  axis: VolumeAxis;
  canvas: HTMLCanvasElement;
  canvasBuffer: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ctxBuffer: CanvasRenderingContext2D;
  iLength: number;
  jLength: number;
  sliceAccess: (i: number, j: number) => number;
  matrix: Matrix4;
  geometry: PlaneGeometry;
  mesh: Mesh<MeshBasicMaterial>;
  geometryNeedsUpdate: boolean = true;
  private _index: number;

  constructor(volume: Volume, index = 0, axis: VolumeAxis = "z") {
    this.volume = volume;
    this._index = index;
    this.axis = axis;
    this.canvas = document.createElement("canvas");
    this.canvasBuffer = document.createElement("canvas");
    const extracted = volume.extractPerpendicularPlane(axis, index);
    this.iLength = extracted.iLength;
    this.jLength = extracted.jLength;
    this.sliceAccess = extracted.sliceAccess;
    this.matrix = extracted.matrix;
    this.canvas.width = extracted.planeWidth;
    this.canvas.height = extracted.planeHeight;
    this.canvasBuffer.width = extracted.iLength;
    this.canvasBuffer.height = extracted.jLength;
    const ctx = this.canvas.getContext("2d");
    const ctxBuffer = this.canvasBuffer.getContext("2d");
    if (!ctx || !ctxBuffer) throw new Error("THREE.VolumeSlice: 2D canvas context unavailable.");
    this.ctx = ctx;
    this.ctxBuffer = ctxBuffer;
    this.geometry = new PlaneGeometry(extracted.planeWidth, extracted.planeHeight);
    const canvasMap = new Texture(this.canvas);
    canvasMap.minFilter = LinearFilter;
    canvasMap.generateMipmaps = false;
    canvasMap.wrapS = canvasMap.wrapT = ClampToEdgeWrapping;
    canvasMap.colorSpace = SRGBColorSpace;
    this.mesh = new Mesh<MeshBasicMaterial>(
      this.geometry,
      new MeshBasicMaterial({ map: canvasMap, side: DoubleSide, transparent: true }),
    );
    this.mesh.matrixAutoUpdate = false;
    this.repaint();
  }

  get index(): number {
    return this._index;
  }
  set index(value: number) {
    this._index = value;
    this.geometryNeedsUpdate = true;
  }

  repaint(): void {
    if (this.geometryNeedsUpdate) this.updateGeometry();
    const image = this.ctxBuffer.getImageData(0, 0, this.iLength, this.jLength);
    const data = image.data;
    const volume = this.volume;
    if (volume.dataType === "label") {
      console.error("THREE.VolumeSlice.repaint: label are not supported yet");
    } else {
      let pixel = 0;
      for (let j = 0; j < this.jLength; j++) {
        for (let i = 0; i < this.iLength; i++) {
          let value = volume.data[this.sliceAccess(i, j)];
          const alpha = volume.upperThreshold >= value && volume.lowerThreshold <= value ? 255 : 0;
          value = Math.floor((255 * (value - volume.windowLow)) / (volume.windowHigh - volume.windowLow));
          value = value > 255 ? 255 : value < 0 ? 0 : value | 0;
          data[pixel++] = value;
          data[pixel++] = value;
          data[pixel++] = value;
          data[pixel++] = alpha;
        }
      }
    }
    this.ctxBuffer.putImageData(image, 0, 0);
    this.ctx.drawImage(
      this.canvasBuffer,
      0,
      0,
      this.iLength,
      this.jLength,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const map = this.mesh.material.map;
    if (map) map.needsUpdate = true;
  }

  updateGeometry(): void {
    const extracted = this.volume.extractPerpendicularPlane(this.axis, this.index);
    this.sliceAccess = extracted.sliceAccess;
    this.iLength = extracted.iLength;
    this.jLength = extracted.jLength;
    this.matrix = extracted.matrix;
    this.canvas.width = extracted.planeWidth;
    this.canvas.height = extracted.planeHeight;
    this.canvasBuffer.width = this.iLength;
    this.canvasBuffer.height = this.jLength;
    const ctx = this.canvas.getContext("2d");
    const ctxBuffer = this.canvasBuffer.getContext("2d");
    if (!ctx || !ctxBuffer) throw new Error("THREE.VolumeSlice: 2D canvas context unavailable.");
    this.ctx = ctx;
    this.ctxBuffer = ctxBuffer;
    this.geometry.dispose();
    this.geometry = new PlaneGeometry(extracted.planeWidth, extracted.planeHeight);
    this.mesh.geometry = this.geometry;
    this.mesh.matrix.identity();
    this.mesh.applyMatrix4(this.matrix);
    this.geometryNeedsUpdate = false;
  }
}
