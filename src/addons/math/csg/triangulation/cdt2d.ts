/*
Native TypeScript adaptation of the 2D algorithms used by cdt2d 1.0.0:

https://github.com/mikolalysenko/cdt2d (1.0.0)
https://github.com/mikolalysenko/binary-search-bounds (2.0.5)
https://github.com/mikolalysenko/robust-in-sphere (1.2.1)
https://github.com/mikolalysenko/robust-orientation (1.2.1)
https://github.com/mikolalysenko/robust-scale (1.0.2)
https://github.com/mikolalysenko/robust-subtract (1.0.0)
https://github.com/mikolalysenko/robust-sum (1.0.0)
https://github.com/mikolalysenko/two-product (1.0.2)
https://github.com/mikolalysenko/two-sum (1.0.0)

All packages are MIT licensed. See LICENSE.

The MIT License (MIT)

cdt2d: Copyright (c) 2015 Mikola Lysenko
binary-search-bounds: Copyright (c) 2013-2015 Mikola Lysenko
robust-in-sphere: Copyright (c) 2014 Mikola Lysenko
robust-orientation, robust-scale, robust-subtract, robust-sum,
two-product, two-sum: Copyright (c) 2013 Mikola Lysenko

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import { monotoneTriangulate } from "./monotone";
import { Triangulation, delaunayRefine } from "./mesh";
import { classifyFaces } from "./filter";

export interface TriangulationOptions {
  delaunay?: boolean;
  interior?: boolean;
  exterior?: boolean;
  infinity?: boolean;
}

export default function cdt2d(
  points: number[][],
  edgesOrOptions: number[][] | TriangulationOptions = [],
  options: TriangulationOptions = {},
): number[][] {
  const edges = Array.isArray(edgesOrOptions) ? edgesOrOptions : [];
  if (!Array.isArray(edgesOrOptions)) options = edgesOrOptions;
  const delaunay = options.delaunay === undefined ? true : !!options.delaunay;
  const interior = options.interior === undefined ? true : !!options.interior;
  const exterior = options.exterior === undefined ? true : !!options.exterior;
  const infinity = !!options.infinity;
  if ((!interior && !exterior) || points.length === 0) return [];
  const cells = monotoneTriangulate(points, edges);
  if (!delaunay && interior === exterior && !infinity) return cells;
  const canonicalEdges = edges.map((e) => [Math.min(e[0], e[1]), Math.max(e[0], e[1])]);
  canonicalEdges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const mesh = new Triangulation(points.length, canonicalEdges);
  for (const f of cells) mesh.addTriangle(f[0], f[1], f[2]);
  if (delaunay) delaunayRefine(points, mesh);
  if (!exterior) return classifyFaces(mesh, -1);
  if (!interior) return classifyFaces(mesh, 1, infinity);
  if (infinity) return classifyFaces(mesh, 0, true);
  return mesh.cells();
}
