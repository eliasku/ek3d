/*
 * three-mesh-bvh 0.9.10
 * MIT License
 * Copyright (c) 2018 Garrett Johnson
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
export const CENTER = 0;
export const AVERAGE = 1;
export const SAH = 2;
export const NOT_INTERSECTED = 0;
export const INTERSECTED = 1;
export const CONTAINED = 2;
export const PRIMITIVE_INTERSECT_COST = 1.25;
export const TRAVERSAL_COST = 1;
export const BYTES_PER_NODE = 32;
export const UINT32_PER_NODE = BYTES_PER_NODE / 4;
export const IS_LEAFNODE_FLAG = 0xffff;
export const LEAFNODE_MASK_32 = IS_LEAFNODE_FLAG << 16;
export const FLOAT32_EPSILON = 2 ** -24;
export const SKIP_GENERATION = Symbol("SKIP_GENERATION");

export interface BVHOptions {
  strategy: number;
  maxDepth: number;
  maxLeafSize: number;
  useSharedArrayBuffer: boolean;
  setBoundingBox: boolean;
  onProgress: ((progress: number) => void) | null;
  indirect: boolean;
  verbose: boolean;
  range: { start: number; count: number } | null;
  [SKIP_GENERATION]: boolean;
}

export const DEFAULT_OPTIONS: BVHOptions = {
  strategy: CENTER,
  maxDepth: 40,
  maxLeafSize: 10,
  useSharedArrayBuffer: false,
  setBoundingBox: true,
  onProgress: null,
  indirect: false,
  verbose: true,
  range: null,
  [SKIP_GENERATION]: false,
};
