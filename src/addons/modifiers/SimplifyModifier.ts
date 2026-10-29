import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { GLBufferAttribute } from "../../core/GLBufferAttribute";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import { mergeVertices } from "../utils/BufferGeometryUtils";

type Attribute = BufferAttribute | InterleavedBufferAttribute;

type IndexArray = Uint16Array | Uint32Array | Int16Array | Int32Array;

type AttributeArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

type AttributeArrayConstructor = new (length: number) => AttributeArray;

/** meshopt accepts only 16/32-bit indices; glTF may deliver an 8-bit index buffer. */
function toSimplifierIndices(array: AttributeArray): IndexArray {
  return array instanceof Uint16Array ||
    array instanceof Uint32Array ||
    array instanceof Int16Array ||
    array instanceof Int32Array
    ? array
    : Uint32Array.from(array);
}

/** Returns a CPU-readable attribute; GPU-only buffers cannot be simplified. */
function readAttribute(geometry: BufferGeometry, name: string): Attribute | undefined {
  const attribute = geometry.getAttribute(name);
  return attribute instanceof GLBufferAttribute ? undefined : attribute;
}

/**
 * The subset of the meshoptimizer simplifier module used by {@link SimplifyModifier}.
 *
 * The vendor module is not bundled: the consumer loads `meshopt_simplifier.module.js`
 * and passes its `MeshoptSimplifier` export to {@link SimplifyModifier#setSimplifier}.
 */
export interface MeshoptSimplifierLike {
  supported: boolean;
  ready: Promise<unknown>;
  simplify(
    indices: IndexArray,
    vertexPositions: Float32Array,
    vertexPositionsStride: number,
    targetIndexCount: number,
    targetError: number,
    flags?: string[],
  ): [IndexArray, number];
  simplifyWithAttributes(
    indices: IndexArray,
    vertexPositions: Float32Array,
    vertexPositionsStride: number,
    vertexAttributes: Float32Array,
    vertexAttributesStride: number,
    attributeWeights: number[],
    vertexLock: Uint8Array | null,
    targetIndexCount: number,
    targetError: number,
    flags?: string[],
  ): [IndexArray, number];
  compactMesh(indices: IndexArray): [Uint32Array, number];
}

/**
 * This class can be used to modify a geometry by simplifying it. A typical use
 * case for such a modifier is automatic LOD generation.
 *
 * The implementation is based on [meshoptimizer]{@link https://github.com/zeux/meshoptimizer}.
 * The simplifier runtime is supplied by the consumer; this class never bundles or
 * fetches it, matching the other explicit vendor-runtime integrations.
 *
 * ```ts
 * import { SimplifyModifier, type MeshoptSimplifierLike } from 'ek3d/addons/modifiers/SimplifyModifier';
 * import type { BufferGeometry } from 'ek3d/core/BufferGeometry';
 *
 * async function simplify( geometry: BufferGeometry, runtime: MeshoptSimplifierLike ): Promise<BufferGeometry> {
 *   const modifier = new SimplifyModifier().setSimplifier( runtime );
 *   return modifier.modify( geometry, 100 );
 * }
 * ```
 *
 */
export class SimplifyModifier {
  simplifier: MeshoptSimplifierLike | null;

  /**
   * Constructs a new simplify modifier without a simplifier runtime.
   */
  constructor() {
    this.simplifier = null;
  }

  /**
   * Sets the meshoptimizer simplifier runtime used for `modify()`.
   *
   * @param simplifier - The `MeshoptSimplifier` export of the vendor module, or `null` to clear it.
   * @return A reference to this modifier.
   */
  setSimplifier(simplifier: MeshoptSimplifierLike | null): this {
    this.simplifier = simplifier;
    return this;
  }

  /**
   * Returns a new, simplified version of the given geometry. The vertex buffers
   * of the result only contain vertices referenced by the simplified index.
   *
   * @param geometry - The geometry to modify.
   * @param count - The approximate number of vertices to remove.
   * @return A promise that resolves with the new, modified geometry.
   */
  async modify(geometry: BufferGeometry, count: number): Promise<BufferGeometry> {
    const simplifier = this.simplifier;
    if (simplifier === null || simplifier.supported !== true) {
      throw new Error(
        "SimplifyModifier: setSimplifier() must be called with a supported meshoptimizer simplifier before modify() (vendor runtime supplied by the consumer).",
      );
    }

    await simplifier.ready;

    // non-indexed geometries must be welded so the simplifier can collapse edges

    if (geometry.getIndex() === null) geometry = mergeVertices(geometry);

    const index = geometry.getIndex();
    if (index === null) throw new Error("SimplifyModifier: the geometry has no index after welding.");

    const positionAttribute = readAttribute(geometry, "position");
    if (positionAttribute === undefined) {
      throw new Error("SimplifyModifier: the geometry needs a CPU-readable position attribute.");
    }

    // the simplifier requires tightly packed positions

    const positions = new Float32Array(positionAttribute.count * 3);

    for (let i = 0; i < positionAttribute.count; i++) {
      positions[i * 3 + 0] = positionAttribute.getX(i);
      positions[i * 3 + 1] = positionAttribute.getY(i);
      positions[i * 3 + 2] = positionAttribute.getZ(i);
    }

    const ratio = Math.min(1, Math.max(0, 1 - count / positionAttribute.count));
    const targetIndexCount = Math.max(3, Math.floor((index.count * ratio) / 3) * 3);

    // normals and uvs, when present, contribute to the error metric so collapses
    // that would distort shading or texture seams are penalized

    const normalAttribute = readAttribute(geometry, "normal");
    const uvAttribute = readAttribute(geometry, "uv");
    const attributeStride = (normalAttribute ? 3 : 0) + (uvAttribute ? 2 : 0);

    let indices: IndexArray;
    const sourceIndices = toSimplifierIndices(index.array);

    if (attributeStride > 0) {
      const vertexAttributes = new Float32Array(positionAttribute.count * attributeStride);
      const attributeWeights: number[] = [];

      if (normalAttribute) attributeWeights.push(0.25, 0.25, 0.25);
      if (uvAttribute) attributeWeights.push(0.5, 0.5);

      for (let i = 0, o = 0; i < positionAttribute.count; i++) {
        if (normalAttribute) {
          vertexAttributes[o++] = normalAttribute.getX(i);
          vertexAttributes[o++] = normalAttribute.getY(i);
          vertexAttributes[o++] = normalAttribute.getZ(i);
        }

        if (uvAttribute) {
          vertexAttributes[o++] = uvAttribute.getX(i);
          vertexAttributes[o++] = uvAttribute.getY(i);
        }
      }

      indices = simplifier.simplifyWithAttributes(
        sourceIndices,
        positions,
        3,
        vertexAttributes,
        attributeStride,
        attributeWeights,
        null,
        targetIndexCount,
        1,
      )[0];
    } else {
      indices = simplifier.simplify(sourceIndices, positions, 3, targetIndexCount, 1)[0];
    }

    // drop vertices that are no longer referenced and rebuild the attributes

    const [remap, unique] = simplifier.compactMesh(indices); // rewrites indices in place

    const simplifiedGeometry = new BufferGeometry();

    for (const name in geometry.attributes) {
      const attribute = readAttribute(geometry, name);
      if (attribute === undefined) {
        throw new Error(`SimplifyModifier: attribute "${name}" is not CPU-readable.`);
      }

      const itemSize = attribute.itemSize;
      const Constructor = attribute.array.constructor as AttributeArrayConstructor;
      const newAttribute = new BufferAttribute(new Constructor(unique * itemSize), itemSize, attribute.normalized);

      // scatter each vertex to its new slot; 0xffffffff marks unreferenced vertices

      for (let i = 0; i < remap.length; i++) {
        const target = remap[i];

        if (target === 0xffffffff) continue;

        for (let k = 0; k < itemSize; k++) newAttribute.setComponent(target, k, attribute.getComponent(i, k));
      }

      simplifiedGeometry.setAttribute(name, newAttribute);
    }

    simplifiedGeometry.setIndex(new BufferAttribute(indices, 1));

    return simplifiedGeometry;
  }
}
