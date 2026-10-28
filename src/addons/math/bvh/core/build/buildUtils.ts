import { BVHNode } from "../BVHNode";
import { BYTES_PER_NODE, IS_LEAFNODE_FLAG } from "../Constants";

export function countNodes(node: BVHNode): number {
  return node.count !== undefined ? 1 : 1 + countNodes(node.left!) + countNodes(node.right!);
}

export function populateBuffer(byteOffset: number, node: BVHNode, buffer: ArrayBufferLike): number {
  const floats = new Float32Array(buffer);
  const uint32 = new Uint32Array(buffer);
  const uint16 = new Uint16Array(buffer);
  const uint8 = new Uint8Array(buffer);
  function populate(offset: number, current: BVHNode): number {
    const i32 = offset / 4,
      i16 = offset / 2;
    for (let i = 0; i < 6; i++) floats[i32 + i] = current.boundingData[i];
    if (current.count !== undefined) {
      if (current.buffer) {
        uint8.set(new Uint8Array(current.buffer), offset);
        return offset + current.buffer.byteLength;
      }
      uint32[i32 + 6] = current.offset!;
      uint16[i16 + 14] = current.count;
      uint16[i16 + 15] = IS_LEAFNODE_FLAG;
      return offset + BYTES_PER_NODE;
    }
    const rightOffset = populate(offset + BYTES_PER_NODE, current.left!);
    const relativeRightIndex = (rightOffset - offset) / BYTES_PER_NODE;
    if (relativeRightIndex > 2 ** 32)
      throw new Error("MeshBVH: Cannot store relative child node offset greater than 32 bits.");
    uint32[i32 + 6] = relativeRightIndex;
    uint32[i32 + 7] = current.splitAxis!;
    return populate(rightOffset, current.right!);
  }
  return populate(byteOffset, node);
}
