/*
 * Portions adapted from bvh.js 0.0.13.
 * MIT License
 * Copyright (c) 2024 Andrea Gargaro
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { CoordinateSystem } from "../../../constants";

export interface BatchBVHNode {
  box: Float32Array;
  object: number;
  parent: BatchBVHBranch | null;
}

interface BatchBVHBranch {
  box: Float32Array;
  parent: BatchBVHBranch | null;
  left: BatchNode;
  right: BatchNode;
  object?: never;
}

type BatchNode = BatchBVHNode | BatchBVHBranch;

function union(a: Float32Array, b: Float32Array, out: Float32Array): void {
  for (let axis = 0; axis < 6; axis += 2) {
    out[axis] = Math.min(a[axis], b[axis]);
    out[axis + 1] = Math.max(a[axis + 1], b[axis + 1]);
  }
}

function area(box: Float32Array): number {
  const x = box[1] - box[0],
    y = box[3] - box[2],
    z = box[5] - box[4];
  return x * y + y * z + z * x;
}

function unionArea(a: Float32Array, b: Float32Array): number {
  const x = Math.max(a[1], b[1]) - Math.min(a[0], b[0]);
  const y = Math.max(a[3], b[3]) - Math.min(a[2], b[2]);
  const z = Math.max(a[5], b[5]) - Math.min(a[4], b[4]);
  return x * y + y * z + z * x;
}

function expand(box: Float32Array, margin: number): void {
  if (margin > 0)
    for (let i = 0; i < 6; i += 2) {
      box[i] -= margin;
      box[i + 1] += margin;
    }
}

function overlaps(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  return a[1] >= b[0] && b[1] >= a[0] && a[3] >= b[2] && b[3] >= a[2] && a[5] >= b[4] && b[5] >= a[4];
}

export class BatchFrustum {
  readonly array: Float32Array = new Float32Array(24);
  readonly coordinateSystem: CoordinateSystem;

  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
  }

  setFromProjectionMatrix(m: ArrayLike<number>, coordinateSystem = this.coordinateSystem, reversedDepth = false): this {
    this.setPlane(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
    this.setPlane(1, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
    this.setPlane(2, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
    this.setPlane(3, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
    if (reversedDepth) {
      this.setPlane(4, m[2], m[6], m[10], m[14]);
      this.setPlane(5, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
    } else {
      this.setPlane(4, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
      if (coordinateSystem === CoordinateSystem.WebGL) {
        this.setPlane(5, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
      } else if (coordinateSystem === 2001) {
        this.setPlane(5, m[2], m[6], m[10], m[14]);
      } else {
        throw new Error("Invalid coordinate system: " + coordinateSystem);
      }
    }
    return this;
  }

  private setPlane(index: number, x: number, y: number, z: number, constant: number): void {
    const length = Math.sqrt(x * x + y * y + z * z),
      offset = index * 4;
    this.array[offset] = x / length;
    this.array[offset + 1] = y / length;
    this.array[offset + 2] = z / length;
    this.array[offset + 3] = constant / length;
  }

  intersectsBoxMask(box: ArrayLike<number>, mask: number): number {
    for (let i = 0; i < 6; i++) {
      const bit = 32 >> i;
      if ((mask & bit) === 0) continue;
      const offset = i * 4,
        x = this.array[offset],
        y = this.array[offset + 1],
        z = this.array[offset + 2],
        c = this.array[offset + 3];
      const high = x * box[x > 0 ? 1 : 0] + y * box[y > 0 ? 3 : 2] + z * box[z > 0 ? 5 : 4];
      if (high < -c) return -1;
      const low = x * box[x > 0 ? 0 : 1] + y * box[y > 0 ? 2 : 3] + z * box[z > 0 ? 4 : 5];
      if (low > -c) mask ^= bit;
    }
    return mask;
  }

  isIntersectedMargin(box: ArrayLike<number>, mask: number, margin: number): boolean {
    for (let i = 0; i < 6; i++) {
      if ((mask & (32 >> i)) === 0) continue;
      const offset = i * 4,
        x = this.array[offset],
        y = this.array[offset + 1],
        z = this.array[offset + 2];
      const high =
        x * (box[x > 0 ? 1 : 0] + (x > 0 ? -margin : margin)) +
        y * (box[y > 0 ? 3 : 2] + (y > 0 ? -margin : margin)) +
        z * (box[z > 0 ? 5 : 4] + (z > 0 ? -margin : margin));
      if (high < -this.array[offset + 3]) return false;
    }
    return true;
  }
}

export class BatchBVH {
  root: BatchNode | null = null;
  readonly frustum: BatchFrustum;

  constructor(coordinateSystem: CoordinateSystem = CoordinateSystem.WebGL) {
    this.frustum = new BatchFrustum(coordinateSystem);
  }

  createFromArray(
    objects: ArrayLike<number>,
    boxes: Float32Array[],
    onLeafCreation: (node: BatchBVHNode) => void,
    margin = 0,
  ): void {
    const leaves: BatchBVHNode[] = [];
    for (let i = 0; i < objects.length; i++) {
      expand(boxes[i], margin);
      const leaf: BatchBVHNode = { object: objects[i], box: boxes[i], parent: null };
      leaves.push(leaf);
      onLeafCreation(leaf);
    }
    const build = (start: number, end: number, parent: BatchBVHBranch | null): BatchNode => {
      if (end - start === 1) {
        leaves[start].parent = parent;
        return leaves[start];
      }
      const bounds = new Float32Array([Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]);
      const centroids = new Float32Array([Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]);
      for (let i = start; i < end; i++) {
        const box = leaves[i].box;
        union(bounds, box, bounds);
        for (let axis = 0; axis < 6; axis += 2) {
          const center = (box[axis] + box[axis + 1]) * 0.5;
          centroids[axis] = Math.min(centroids[axis], center);
          centroids[axis + 1] = Math.max(centroids[axis + 1], center);
        }
      }
      let axis = 0;
      if (centroids[3] - centroids[2] > centroids[1] - centroids[0]) axis = 2;
      if (centroids[5] - centroids[4] > centroids[axis + 1] - centroids[axis]) axis = 4;
      const position = (centroids[axis] + centroids[axis + 1]) * 0.5;
      let left = start,
        right = end - 1;
      while (left <= right) {
        const box = leaves[left].box;
        if ((box[axis] + box[axis + 1]) * 0.5 < position) left++;
        else {
          const temp = leaves[left];
          leaves[left] = leaves[right];
          leaves[right--] = temp;
        }
      }
      if (left === start || left === end) left = start + ((end - start) >> 1);
      const branch: BatchBVHBranch = { box: bounds, parent, left: leaves[start], right: leaves[left] };
      branch.left = build(start, left, branch);
      branch.right = build(left, end, branch);
      return branch;
    };
    this.root = leaves.length ? build(0, leaves.length, null) : null;
  }

  insert(object: number, box: Float32Array, margin = 0): BatchBVHNode {
    expand(box, margin);
    const leaf: BatchBVHNode = { object, box, parent: null };
    this.insertLeaf(leaf);
    return leaf;
  }

  insertRange(
    objects: ArrayLike<number>,
    boxes: Float32Array[],
    margin = 0,
    onLeafCreation?: (node: BatchBVHNode) => void,
  ): void {
    for (let i = 0; i < objects.length; i++) {
      const node = this.insert(objects[i], boxes[i], margin);
      onLeafCreation?.(node);
    }
  }

  private insertLeaf(leaf: BatchBVHNode): void {
    if (this.root === null) {
      this.root = leaf;
      return;
    }
    let best = this.root,
      bestCost = unionArea(leaf.box, best.box);
    const leafArea = area(leaf.box);
    const pending: { node: BatchNode; inherited: number }[] = [{ node: best, inherited: 0 }];
    while (pending.length) {
      const item = pending.pop()!;
      const node = item.node;
      const cost = unionArea(leaf.box, node.box) + item.inherited;
      if (cost < bestCost) {
        best = node;
        bestCost = cost;
      }
      if (node.object !== undefined) continue;
      const inherited = cost - area(node.box);
      if (leafArea + inherited < bestCost) {
        pending.push({ node: node.left, inherited }, { node: node.right, inherited });
      }
    }
    const oldParent = best.parent;
    const parent: BatchBVHBranch = { box: new Float32Array(6), parent: oldParent, left: best, right: leaf };
    best.parent = parent;
    leaf.parent = parent;
    if (oldParent === null) this.root = parent;
    else if (oldParent.left === best) oldParent.left = parent;
    else oldParent.right = parent;
    this.refitAndRotate(parent);
  }

  private refit(node: BatchBVHBranch | null): void {
    while (node !== null) {
      union(node.left.box, node.right.box, node.box);
      node = node.parent;
    }
  }

  private refitAndRotate(node: BatchBVHBranch | null): void {
    while (node !== null) {
      union(node.left.box, node.right.box, node.box);
      const left = node.left,
        right = node.right;
      let gain = 0;
      let outer: BatchNode | null = null,
        inner: BatchNode | null = null;
      if (right.object === undefined) {
        const cost = area(right.box);
        const leftGain = cost - unionArea(left.box, right.right.box);
        const rightGain = cost - unionArea(left.box, right.left.box);
        if (leftGain > gain) {
          gain = leftGain;
          outer = left;
          inner = right.left;
        }
        if (rightGain > gain) {
          gain = rightGain;
          outer = left;
          inner = right.right;
        }
      }
      if (left.object === undefined) {
        const cost = area(left.box);
        const leftGain = cost - unionArea(right.box, left.right.box);
        const rightGain = cost - unionArea(right.box, left.left.box);
        if (leftGain > gain) {
          gain = leftGain;
          outer = right;
          inner = left.left;
        }
        if (rightGain > gain) {
          outer = right;
          inner = left.right;
        }
      }
      if (outer !== null && inner !== null) {
        const innerParent = inner.parent!;
        if (node.left === outer) node.left = inner;
        else node.right = inner;
        if (innerParent.left === inner) innerParent.left = outer;
        else innerParent.right = outer;
        inner.parent = node;
        outer.parent = innerParent;
        union(innerParent.left.box, innerParent.right.box, innerParent.box);
      }
      node = node.parent;
    }
  }

  move(node: BatchBVHNode, margin = 0): void {
    expand(node.box, margin);
    if (node.parent === null) return;
    this.delete(node);
    this.insertLeaf(node);
  }

  delete(node: BatchBVHNode): void {
    const parent = node.parent;
    if (parent === null) {
      if (this.root === node) this.root = null;
      return;
    }
    const sibling = parent.left === node ? parent.right : parent.left;
    const grandparent = parent.parent;
    sibling.parent = grandparent;
    node.parent = null;
    if (grandparent === null) this.root = sibling;
    else {
      if (grandparent.left === parent) grandparent.left = sibling;
      else grandparent.right = sibling;
      this.refit(grandparent);
    }
  }

  clear(): void {
    this.root = null;
  }

  frustumCulling(
    matrix: ArrayLike<number>,
    callback: (node: BatchBVHNode, frustum: BatchFrustum, mask: number) => void,
    coordinateSystem = this.frustum.coordinateSystem,
    reversedDepth = false,
  ): void {
    if (this.root === null) return;
    const frustum = this.frustum.setFromProjectionMatrix(matrix, coordinateSystem, reversedDepth);
    const visit = (node: BatchNode, mask: number): void => {
      if (node.object !== undefined) {
        if (frustum.intersectsBoxMask(node.box, mask) >= 0) callback(node, frustum, mask);
        return;
      }
      const next = frustum.intersectsBoxMask(node.box, mask);
      if (next >= 0) {
        visit(node.left, next);
        visit(node.right, next);
      }
    };
    visit(this.root, 63);
  }

  intersectsBox(box: ArrayLike<number>, callback: (object: number) => boolean): boolean {
    const visit = (node: BatchNode): boolean => {
      if (!overlaps(box, node.box)) return false;
      return node.object !== undefined ? callback(node.object) : visit(node.left) || visit(node.right);
    };
    return this.root !== null && visit(this.root);
  }

  rayIntersections(
    dir: ArrayLike<number>,
    origin: ArrayLike<number>,
    callback: (object: number) => void,
    near = 0,
    far = Infinity,
  ): void {
    const visit = (node: BatchNode): void => {
      let min = Math.max(0, near),
        max = far;
      for (let axis = 0; axis < 3; axis++) {
        const d = dir[axis],
          o = origin[axis],
          offset = axis * 2;
        if (d === 0) {
          if (o < node.box[offset] || o > node.box[offset + 1]) return;
          continue;
        }
        const a = (node.box[offset] - o) / d,
          b = (node.box[offset + 1] - o) / d;
        min = Math.max(min, Math.min(a, b));
        max = Math.min(max, Math.max(a, b));
        if (min > max) return;
      }
      if (node.object !== undefined) callback(node.object);
      else {
        visit(node.left);
        visit(node.right);
      }
    };
    if (this.root !== null) visit(this.root);
  }
}
