/*
three-bvh-csg 0.0.18
https://github.com/gkjohnson/three-bvh-csg

MIT License

Copyright (c) 2022 Garrett Johnson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { Mesh } from "../../../../objects/Mesh";
import { Matrix4 } from "../../../../math/Matrix4";
import { BufferGeometry } from "../../../../core/BufferGeometry";
import type { BufferAttribute } from "../../../../core/BufferAttribute";
import { InterleavedBufferAttribute } from "../../../../core/InterleavedBufferAttribute";
import { MeshBasicMaterial } from "../../../../materials/MeshBasicMaterial";
import type { Material } from "../../../../materials/Material";
import { MeshBVH } from "../../bvh/core/MeshBVH";
import { HalfEdgeMap } from "./HalfEdgeMap";
import { areSharedArrayBuffersSupported, convertToSharedArrayBuffer, getTriCount } from "./utils/geometryUtils";

export type CSGGeometry = BufferGeometry & {
  boundsTree?: MeshBVH | null;
  halfEdges?: HalfEdgeMap | null;
  groupIndices?: Uint16Array | null;
};

export class Brush extends Mesh {
  isBrush: boolean;
  _previousMatrix: Matrix4;
  _halfEdges: HalfEdgeMap | null;
  _boundsTree: MeshBVH | null;
  _groupIndices: Uint16Array | null;
  _hash: string | null;

  constructor(
    geometry: BufferGeometry = new BufferGeometry(),
    material: Material | Material[] = new MeshBasicMaterial(),
  ) {
    super(geometry, material);
    this.isBrush = true;
    this._previousMatrix = new Matrix4();
    this._previousMatrix.elements.fill(0);
    this._halfEdges = null;
    this._boundsTree = null;
    this._groupIndices = null;
    this._hash = null;
  }

  markUpdated(): void {
    this._previousMatrix.copy(this.matrix);
  }

  isDirty(): boolean {
    const el1 = this.matrix.elements;
    const el2 = this._previousMatrix.elements;
    for (let i = 0; i < 16; i++) {
      if (el1[i] !== el2[i]) return true;
    }
    return false;
  }

  prepareGeometry(): void {
    const geometry = this.geometry as CSGGeometry;
    const attributes = geometry.attributes;
    const useSharedArrayBuffer = areSharedArrayBuffersSupported();
    const index = geometry.index;
    const position = attributes.position as BufferAttribute | InterleavedBufferAttribute;
    if (position instanceof InterleavedBufferAttribute) {
      throw new Error("Brush: InterleavedBufferAttributes are not supported.");
    }
    const indexHash = index ? `${index.id}_${index.count}_${index.version}` : "-1_-1_-1";
    const posHash = `${position.id}_${position.count}_${position.version}`;
    const hash = `${geometry.uuid}_${indexHash}_${posHash}`;
    if (this._hash === hash) return;
    this._hash = hash;

    if (useSharedArrayBuffer) {
      for (const key in attributes) {
        const attribute = attributes[key] as BufferAttribute | InterleavedBufferAttribute;
        if (attribute instanceof InterleavedBufferAttribute) {
          throw new Error("Brush: InterleavedBufferAttributes are not supported.");
        }
        attribute.array = convertToSharedArrayBuffer(attribute.array);
      }
    }

    geometry.boundsTree = new MeshBVH(geometry, { maxLeafSize: 3, indirect: true, useSharedArrayBuffer });
    if (!geometry.halfEdges) geometry.halfEdges = new HalfEdgeMap();
    geometry.halfEdges.updateFrom(geometry);

    const triCount = getTriCount(geometry);
    if (!geometry.groupIndices || geometry.groupIndices.length !== triCount) {
      geometry.groupIndices = new Uint16Array(triCount);
    }
    const array = geometry.groupIndices;
    const groups = geometry.groups;
    for (let i = 0; i < groups.length; i++) {
      const { start, count } = groups[i];
      for (let g = start / 3; g < (start + count) / 3; g++) array[g] = i;
    }
  }

  disposeCacheData(): void {
    const geometry = this.geometry as CSGGeometry;
    geometry.halfEdges = null;
    geometry.boundsTree = null;
    geometry.groupIndices = null;
  }
}
