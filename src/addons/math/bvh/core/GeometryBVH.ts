import type { BufferAttribute } from "../../../../core/BufferAttribute";
import { BufferGeometry } from "../../../../core/BufferGeometry";
import type { Object3D } from "../../../../core/Object3D";
import type { Raycaster, Intersection } from "../../../../core/Raycaster";
import type { Material } from "../../../../materials/Material";
import { Box3 } from "../../../../math/Box3";
import { BVH } from "./BVH";
import { DEFAULT_OPTIONS, SKIP_GENERATION, type BVHOptions } from "./Constants";
import { ensureIndex, getRootPrimitiveRanges, type PrimitiveRange } from "./build/geometryUtils";
import { isSharedArrayBufferSupported } from "../utils/BufferUtils";

export function generateIndirectBuffer(ranges: PrimitiveRange[], shared: boolean): Uint16Array | Uint32Array {
  const last = ranges[ranges.length - 1];
  const useUint32 = last.offset + last.count > 2 ** 16;
  const length = ranges.reduce((sum, range) => sum + range.count, 0);
  const bytes = length * (useUint32 ? 4 : 2);
  const buffer = shared ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes);
  const result = useUint32 ? new Uint32Array(buffer) : new Uint16Array(buffer);
  let index = 0;
  for (const range of ranges) {
    for (let i = 0; i < range.count; i++) result[index + i] = range.offset + i;
    index += range.count;
  }
  return result;
}

export abstract class GeometryBVH extends BVH {
  geometry: BufferGeometry;
  abstract get primitiveStride(): number;
  resolvePrimitiveIndex: (index: number) => number;

  abstract raycastObject3D(
    object: Object3D & { material?: Material | Material[] },
    raycaster: Raycaster & { firstHitOnly?: boolean },
    intersects?: Intersection[],
  ): Intersection[] | undefined;
  get indirect(): boolean {
    return this._indirectBuffer !== null;
  }
  get primitiveBufferStride(): number {
    return this.indirect ? 1 : this.primitiveStride;
  }
  get primitiveBuffer(): BufferAttribute["array"] {
    return this._indirectBuffer ?? this.geometry.index!.array;
  }

  constructor(geometry: BufferGeometry, options: Partial<BVHOptions> = {}) {
    super();
    if (!geometry.isBufferGeometry) throw new Error("BVH: Only BufferGeometries are supported.");
    if (options.useSharedArrayBuffer && !isSharedArrayBufferSupported())
      throw new Error("BVH: SharedArrayBuffer is not available.");
    this.geometry = geometry;
    this.resolvePrimitiveIndex = options.indirect ? (i) => this._indirectBuffer![i] : (i) => i;
    const resolved = { ...DEFAULT_OPTIONS, ...options };
    if (!resolved[SKIP_GENERATION]) this.init(resolved);
  }

  override init(options: BVHOptions): void {
    if (options.indirect) {
      this._indirectBuffer = generateIndirectBuffer(
        getRootPrimitiveRanges(this.geometry, options.range, this.primitiveStride),
        options.useSharedArrayBuffer,
      );
    } else {
      ensureIndex(this.geometry, options);
    }
    super.init(options);
    if (!this.geometry.boundingBox && options.setBoundingBox)
      this.geometry.boundingBox = this.getBoundingBox(new Box3());
  }

  override getRootRanges(range: { start: number; count: number } | null): PrimitiveRange[] {
    return this._indirectBuffer
      ? [{ offset: 0, count: this._indirectBuffer.length }]
      : getRootPrimitiveRanges(this.geometry, range, this.primitiveStride);
  }
}
