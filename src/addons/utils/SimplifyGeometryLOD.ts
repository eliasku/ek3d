import { BufferAttribute } from "../../core/BufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";

// Adapted from @three.ez/simplify-geometry 0.0.1, MIT, Copyright (c) 2025 Andrea Gargaro.

export type SimplifyFlag = "LockBorder" | "Sparse" | "ErrorAbsolute" | "Prune";
export interface MeshoptSimplifierRuntime {
  ready: Promise<void>;
  simplify(
    indices: Uint32Array,
    positions: Float32Array,
    stride: number,
    targetCount: number,
    error: number,
    flags?: SimplifyFlag[],
  ): [Uint32Array, number];
}
export interface SimplifyParams {
  ratio: number;
  error?: number;
  lockBorder?: boolean;
  sparse?: boolean;
  errorAbsolute?: boolean;
  prune?: boolean;
  logAppearanceError?: boolean;
  optimizeMemory?: boolean;
}
export const performanceRangeLOD: number[] = [0.01, 0.02, 0.05, 0.1];
export const balancedRangeLOD: number[] = [0.007, 0.015, 0.04, 0.08];
export const qualityRangeLOD: number[] = [0.004, 0.01, 0.035, 0.07];

export async function simplifyGeometry(
  geometry: BufferGeometry,
  params: SimplifyParams,
  runtime: MeshoptSimplifierRuntime,
): Promise<BufferGeometry> {
  if (!geometry.index) throw new Error("simplifyGeometry: non-indexed geometries are not currently supported.");
  if (geometry.groups.length > 0) throw new Error("simplifyGeometry: geometry groups are not currently supported.");
  const position = geometry.attributes.position;
  if (!(position instanceof BufferAttribute) || !(position.array instanceof Float32Array))
    throw new Error("simplifyGeometry: positions must be a Float32 buffer attribute.");
  await runtime.ready;
  const flags: SimplifyFlag[] = [];
  if (params.lockBorder) flags.push("LockBorder");
  if (params.sparse) flags.push("Sparse");
  if (params.errorAbsolute) flags.push("ErrorAbsolute");
  if (params.prune) flags.push("Prune");
  const source = geometry.index.array;
  const indices = source instanceof Uint32Array ? source : new Uint32Array(source);
  const [result, error] = runtime.simplify(
    indices,
    position.array,
    3,
    3 * Math.floor(params.ratio * (indices.length / 3)),
    params.error ?? 1,
    flags,
  );
  if (result.length === indices.length) console.error("Simplify: simplification failed");
  if (params.logAppearanceError) console.log(`Simplify: appearance error: ${error}`);
  let output: Uint32Array | Uint16Array | Uint8Array = result;
  const vertices = position.array.length / 3;
  if (params.optimizeMemory && vertices <= 65535)
    output = vertices <= 255 ? new Uint8Array(result) : new Uint16Array(result);
  const clone = geometry.clone();
  clone.index = new BufferAttribute(output, 1);
  return clone;
}

export async function simplifyGeometriesByErrorLOD(
  geometries: BufferGeometry[],
  count: number,
  range: number[],
  runtime: MeshoptSimplifierRuntime,
): Promise<BufferGeometry[][]> {
  const result: BufferGeometry[][] = [];
  for (const geometry of geometries) {
    const levels = [geometry];
    for (let i = 0; i < count; i++)
      levels.push(await simplifyGeometry(geometry, { ratio: 0, error: range[i] }, runtime));
    result.push(levels);
  }
  return result;
}
