import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Triangle } from "../../math/Triangle";
import { Vector3 } from "../../math/Vector3";

/*
 * Ported from three-subdivide 1.1.5, MIT License.
 * Copyright (c) 2022-2023 Stephens Nunnally <@stevinz>
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

export interface LoopSubdivisionOptions {
  /** Split shared coplanar edges before subdivision. */
  split?: boolean;
  /** Average UVs using the subdivision formula. */
  uvSmooth?: boolean;
  /** Keep vertices on open boundaries in place. */
  preserveEdges?: boolean;
  /** Split triangles without smoothing their positions. */
  flatOnly?: boolean;
  /** Stop iterating when the current triangle count reaches this limit. */
  maxTriangles?: number;
  /** Blend corner weighting with Loop's formula, clamped to zero through one. */
  weight?: number;
}

type NumericArray = BufferAttribute["array"];
type NumericArrayConstructor = new (length: number) => NumericArray;

const POSITION_DECIMALS = 2;

const _average = new Vector3();
const _center = new Vector3();
const _midpoint = new Vector3();
const _normal = new Vector3();
const _temp = new Vector3();

const _vector0 = new Vector3();
const _vector1 = new Vector3();
const _vector2 = new Vector3();
const _vec0to1 = new Vector3();
const _vec1to2 = new Vector3();
const _vec2to0 = new Vector3();

const _position = [new Vector3(), new Vector3(), new Vector3()];

const _vertex = [new Vector3(), new Vector3(), new Vector3()];

const _triangle = new Triangle();

/** Loop subdivision surface modifier for BufferGeometry. */
export class LoopSubdivision {
  /** Return a subdivided geometry without disposing the original. */
  static modify(bufferGeometry: BufferGeometry, iterations = 1, params: LoopSubdivisionOptions = {}) {
    if (arguments.length > 3)
      console.warn(`LoopSubdivision.modify() now uses a parameter object. See readme for more info!`);

    if (typeof params !== "object") params = {};

    if (params.split === undefined) params.split = true;
    if (params.uvSmooth === undefined) params.uvSmooth = false;
    if (params.preserveEdges === undefined) params.preserveEdges = false;
    if (params.flatOnly === undefined) params.flatOnly = false;
    if (params.maxTriangles === undefined) params.maxTriangles = Infinity;
    if (params.weight === undefined) params.weight = 1;
    if (isNaN(params.weight) || !isFinite(params.weight)) params.weight = 1;
    params.weight = Math.max(0, Math.min(1, params.weight));

    if (!verifyGeometry(bufferGeometry)) return bufferGeometry;
    let modifiedGeometry = bufferGeometry.clone();

    if (params.split) {
      const splitGeometry = LoopSubdivision.edgeSplit(modifiedGeometry);
      modifiedGeometry.dispose();
      modifiedGeometry = splitGeometry;
    }

    for (let i = 0; i < iterations; i++) {
      let currentTriangles = modifiedGeometry.attributes.position.count / 3;
      if (currentTriangles < params.maxTriangles) {
        let subdividedGeometry;

        // Subdivide
        if (params.flatOnly) {
          subdividedGeometry = LoopSubdivision.flat(modifiedGeometry, params);
        } else {
          subdividedGeometry = LoopSubdivision.smooth(modifiedGeometry, params);
        }

        // Copy and Resize Groups
        modifiedGeometry.groups.forEach((group) => {
          subdividedGeometry.addGroup(group.start * 4, group.count * 4, group.materialIndex);
        });

        // Clean Up
        modifiedGeometry.dispose();
        modifiedGeometry = subdividedGeometry;
      }
    }

    return modifiedGeometry;
  }

  /**
   * Applies one iteration of split subdivision. Splits all triangles at edges shared by coplanar triangles.
   * Starts by splitting at longest shared edge, followed by splitting from that new center edge point to the
   * center of any other shared edges.
   */
  static edgeSplit(geometry: BufferGeometry) {
    if (!verifyGeometry(geometry)) return geometry;
    const existing = geometry.index !== null ? geometry.toNonIndexed() : geometry.clone();
    const split = new BufferGeometry();

    const attributeList = gatherAttributes(existing);
    const vertexCount = existing.attributes.position.count;
    const posAttribute = existing.getAttribute("position") as BufferAttribute;
    const norAttribute = existing.getAttribute("normal") as BufferAttribute;
    const edgeHashToTriangle: Record<string, number[]> = {};
    const triangleEdgeHashes: string[][] = [];
    const edgeLength: Record<string, number> = {};
    const triangleExist: boolean[] = [];

    for (let i = 0; i < vertexCount; i += 3) {
      // Positions
      _vector0.fromBufferAttribute(posAttribute, i + 0);
      _vector1.fromBufferAttribute(posAttribute, i + 1);
      _vector2.fromBufferAttribute(posAttribute, i + 2);
      _normal.fromBufferAttribute(norAttribute, i);
      const vecHash0 = hashFromVector(_vector0);
      const vecHash1 = hashFromVector(_vector1);
      const vecHash2 = hashFromVector(_vector2);

      // Verify Area
      const triangleSize = _triangle.set(_vector0, _vector1, _vector2).getArea();
      triangleExist.push(!fuzzy(triangleSize, 0));
      if (!triangleExist[i / 3]) {
        triangleEdgeHashes.push([]);
        continue;
      }

      // Calculate Normals
      calcNormal(_normal, _vector0, _vector1, _vector2);
      const normalHash = hashFromVector(_normal);

      // Vertex Hashes
      const hashes = [
        `${vecHash0}_${vecHash1}_${normalHash}`, // [0]: 0to1
        `${vecHash1}_${vecHash0}_${normalHash}`, // [1]: 1to0
        `${vecHash1}_${vecHash2}_${normalHash}`, // [2]: 1to2
        `${vecHash2}_${vecHash1}_${normalHash}`, // [3]: 2to1
        `${vecHash2}_${vecHash0}_${normalHash}`, // [4]: 2to0
        `${vecHash0}_${vecHash2}_${normalHash}`, // [5]: 0to2
      ];

      // Store Edge Hashes
      const index = i / 3;
      for (let j = 0; j < hashes.length; j++) {
        // Attach Triangle Index to Edge Hash
        if (!edgeHashToTriangle[hashes[j]]) edgeHashToTriangle[hashes[j]] = [];
        edgeHashToTriangle[hashes[j]].push(index);

        // Edge Length
        if (!edgeLength[hashes[j]]) {
          if (j === 0 || j === 1) edgeLength[hashes[j]] = _vector0.distanceTo(_vector1);
          if (j === 2 || j === 3) edgeLength[hashes[j]] = _vector1.distanceTo(_vector2);
          if (j === 4 || j === 5) edgeLength[hashes[j]] = _vector2.distanceTo(_vector0);
        }
      }

      // Triangle Edge Reference
      triangleEdgeHashes.push([hashes[0], hashes[2], hashes[4]]);
    }

    attributeList.forEach((attributeName) => {
      const attribute = existing.getAttribute(attributeName) as BufferAttribute;
      if (!attribute) return;
      const floatArray = splitAttribute(attribute, attributeName);
      split.setAttribute(attributeName, new BufferAttribute(floatArray, attribute.itemSize));
    });

    const morphAttributes = existing.morphAttributes as Record<string, BufferAttribute[]>;
    for (const attributeName in morphAttributes) {
      const array: BufferAttribute[] = [];
      const morphAttribute = morphAttributes[attributeName];

      // Process Array of Float32BufferAttributes
      for (let i = 0, l = morphAttribute.length; i < l; i++) {
        if (morphAttribute[i].count !== vertexCount) continue;
        const floatArray = splitAttribute(morphAttribute[i], attributeName, true);
        array.push(new BufferAttribute(floatArray, morphAttribute[i].itemSize));
      }
      split.morphAttributes[attributeName] = array;
    }
    split.morphTargetsRelative = existing.morphTargetsRelative;

    // Clean Up, Return New Geometry
    existing.dispose();
    return split;

    function splitAttribute(attribute: BufferAttribute, attributeName: string, morph = false) {
      const newTriangles = 4; /* maximum number of new triangles */
      const arrayLength = vertexCount * attribute.itemSize * newTriangles;
      const floatArray = new (attribute.array.constructor as NumericArrayConstructor)(arrayLength);

      const processGroups = attributeName === "position" && !morph && existing.groups.length > 0;
      let groupStart: number | undefined, groupMaterial: number | undefined;

      let index = 0;
      let skipped = 0;
      let step = attribute.itemSize;
      for (let i = 0; i < vertexCount; i += 3) {
        // Verify Triangle is Valid
        if (!triangleExist[i / 3]) {
          skipped += 3;
          continue;
        }

        // Get Triangle Points
        _vector0.fromBufferAttribute(attribute, i + 0);
        _vector1.fromBufferAttribute(attribute, i + 1);
        _vector2.fromBufferAttribute(attribute, i + 2);

        // Check for Shared Edges
        const existingIndex = i / 3;
        const edgeHash0to1 = triangleEdgeHashes[existingIndex][0];
        const edgeHash1to2 = triangleEdgeHashes[existingIndex][1];
        const edgeHash2to0 = triangleEdgeHashes[existingIndex][2];

        const edgeCount0to1 = edgeHashToTriangle[edgeHash0to1].length;
        const edgeCount1to2 = edgeHashToTriangle[edgeHash1to2].length;
        const edgeCount2to0 = edgeHashToTriangle[edgeHash2to0].length;
        const sharedCount = edgeCount0to1 + edgeCount1to2 + edgeCount2to0 - 3;

        // New Index (Before New Triangles, used for Groups)
        const loopStartIndex = (index * 3) / step / 3;

        // No Shared Edges
        if (sharedCount === 0) {
          setTriangle(floatArray, index, step, _vector0, _vector1, _vector2);
          index += step * 3;

          // Shared Edges
        } else {
          const length0to1 = edgeLength[edgeHash0to1];
          const length1to2 = edgeLength[edgeHash1to2];
          const length2to0 = edgeLength[edgeHash2to0];

          // Add New Triangle Positions
          if (
            (length0to1 > length1to2 || edgeCount1to2 <= 1) &&
            (length0to1 > length2to0 || edgeCount2to0 <= 1) &&
            edgeCount0to1 > 1
          ) {
            _center.copy(_vector0).add(_vector1).divideScalar(2.0);
            if (edgeCount2to0 > 1) {
              _midpoint.copy(_vector2).add(_vector0).divideScalar(2.0);
              setTriangle(floatArray, index, step, _vector0, _center, _midpoint);
              index += step * 3;
              setTriangle(floatArray, index, step, _center, _vector2, _midpoint);
              index += step * 3;
            } else {
              setTriangle(floatArray, index, step, _vector0, _center, _vector2);
              index += step * 3;
            }
            if (edgeCount1to2 > 1) {
              _midpoint.copy(_vector1).add(_vector2).divideScalar(2.0);
              setTriangle(floatArray, index, step, _center, _vector1, _midpoint);
              index += step * 3;
              setTriangle(floatArray, index, step, _midpoint, _vector2, _center);
              index += step * 3;
            } else {
              setTriangle(floatArray, index, step, _vector1, _vector2, _center);
              index += step * 3;
            }
          } else if ((length1to2 > length2to0 || edgeCount2to0 <= 1) && edgeCount1to2 > 1) {
            _center.copy(_vector1).add(_vector2).divideScalar(2.0);
            if (edgeCount0to1 > 1) {
              _midpoint.copy(_vector0).add(_vector1).divideScalar(2.0);
              setTriangle(floatArray, index, step, _center, _midpoint, _vector1);
              index += step * 3;
              setTriangle(floatArray, index, step, _midpoint, _center, _vector0);
              index += step * 3;
            } else {
              setTriangle(floatArray, index, step, _vector1, _center, _vector0);
              index += step * 3;
            }
            if (edgeCount2to0 > 1) {
              _midpoint.copy(_vector2).add(_vector0).divideScalar(2.0);
              setTriangle(floatArray, index, step, _center, _vector2, _midpoint);
              index += step * 3;
              setTriangle(floatArray, index, step, _midpoint, _vector0, _center);
              index += step * 3;
            } else {
              setTriangle(floatArray, index, step, _vector2, _vector0, _center);
              index += step * 3;
            }
          } else if (edgeCount2to0 > 1) {
            _center.copy(_vector2).add(_vector0).divideScalar(2.0);
            if (edgeCount1to2 > 1) {
              _midpoint.copy(_vector1).add(_vector2).divideScalar(2.0);
              setTriangle(floatArray, index, step, _vector2, _center, _midpoint);
              index += step * 3;
              setTriangle(floatArray, index, step, _center, _vector1, _midpoint);
              index += step * 3;
            } else {
              setTriangle(floatArray, index, step, _vector2, _center, _vector1);
              index += step * 3;
            }
            if (edgeCount0to1 > 1) {
              _midpoint.copy(_vector0).add(_vector1).divideScalar(2.0);
              setTriangle(floatArray, index, step, _vector0, _midpoint, _center);
              index += step * 3;
              setTriangle(floatArray, index, step, _midpoint, _vector1, _center);
              index += step * 3;
            } else {
              setTriangle(floatArray, index, step, _vector0, _vector1, _center);
              index += step * 3;
            }
          } else {
            setTriangle(floatArray, index, step, _vector0, _vector1, _vector2);
            index += step * 3;
          }
        }

        // Process Groups
        if (processGroups) {
          existing.groups.forEach((group) => {
            if (group.start === i - skipped) {
              if (groupStart !== undefined && groupMaterial !== undefined) {
                split.addGroup(groupStart, loopStartIndex - groupStart, groupMaterial);
              }
              groupStart = loopStartIndex;
              groupMaterial = group.materialIndex;
            }
          });
        }

        // Reset Skipped Triangle Counter
        skipped = 0;
      }

      // Resize Array
      const reducedCount = (index * 3) / step;
      const reducedArray = new (attribute.array.constructor as NumericArrayConstructor)(reducedCount);
      for (let i = 0; i < reducedCount; i++) {
        reducedArray[i] = floatArray[i];
      }

      // Final Group
      if (processGroups && groupStart !== undefined && groupMaterial !== undefined) {
        split.addGroup(groupStart, (index * 3) / step / 3 - groupStart, groupMaterial);
      }

      return reducedArray;
    }
  }

  /** Applies one iteration of Loop (flat) subdivision (1 triangle split into 4 triangles) */
  static flat(geometry: BufferGeometry, params: LoopSubdivisionOptions = {}) {
    if (!verifyGeometry(geometry)) return geometry;
    const existing = geometry.index !== null ? geometry.toNonIndexed() : geometry.clone();
    const loop = new BufferGeometry();

    const attributeList = gatherAttributes(existing);
    const vertexCount = existing.attributes.position.count;

    attributeList.forEach((attributeName) => {
      const attribute = existing.getAttribute(attributeName) as BufferAttribute;
      if (!attribute) return;

      loop.setAttribute(attributeName, LoopSubdivision.flatAttribute(attribute, vertexCount, params));
    });

    const morphAttributes = existing.morphAttributes as Record<string, BufferAttribute[]>;
    for (const attributeName in morphAttributes) {
      const array: BufferAttribute[] = [];
      const morphAttribute = morphAttributes[attributeName];

      // Process Array of Float32BufferAttributes
      for (let i = 0, l = morphAttribute.length; i < l; i++) {
        if (morphAttribute[i].count !== vertexCount) continue;
        array.push(LoopSubdivision.flatAttribute(morphAttribute[i], vertexCount, params));
      }
      loop.morphAttributes[attributeName] = array;
    }
    loop.morphTargetsRelative = existing.morphTargetsRelative;

    existing.dispose();
    return loop;
  }

  static flatAttribute(attribute: BufferAttribute, vertexCount: number, _params: LoopSubdivisionOptions = {}) {
    const newTriangles = 4;
    const arrayLength = vertexCount * attribute.itemSize * newTriangles;
    const floatArray = new (attribute.array.constructor as NumericArrayConstructor)(arrayLength);

    let index = 0;
    let step = attribute.itemSize;
    for (let i = 0; i < vertexCount; i += 3) {
      // Original Vertices
      _vector0.fromBufferAttribute(attribute, i + 0);
      _vector1.fromBufferAttribute(attribute, i + 1);
      _vector2.fromBufferAttribute(attribute, i + 2);

      // Midpoints
      _vec0to1.copy(_vector0).add(_vector1).divideScalar(2.0);
      _vec1to2.copy(_vector1).add(_vector2).divideScalar(2.0);
      _vec2to0.copy(_vector2).add(_vector0).divideScalar(2.0);

      // Add New Triangle Positions
      setTriangle(floatArray, index, step, _vector0, _vec0to1, _vec2to0);
      index += step * 3;
      setTriangle(floatArray, index, step, _vector1, _vec1to2, _vec0to1);
      index += step * 3;
      setTriangle(floatArray, index, step, _vector2, _vec2to0, _vec1to2);
      index += step * 3;
      setTriangle(floatArray, index, step, _vec0to1, _vec1to2, _vec2to0);
      index += step * 3;
    }

    return new BufferAttribute(floatArray, attribute.itemSize);
  }

  /** Applies one iteration of Loop (smooth) subdivision (1 triangle split into 4 triangles) */
  static smooth(geometry: BufferGeometry, params: LoopSubdivisionOptions = {}) {
    if (typeof params !== "object") params = {};

    if (params.uvSmooth === undefined) params.uvSmooth = false;
    if (params.preserveEdges === undefined) params.preserveEdges = false;

    if (!verifyGeometry(geometry)) return geometry;
    const existing = geometry.index !== null ? geometry.toNonIndexed() : geometry.clone();
    const flat = LoopSubdivision.flat(existing, params);
    const loop = new BufferGeometry();

    const attributeList = gatherAttributes(existing);
    const vertexCount = existing.attributes.position.count;
    const posAttribute = existing.getAttribute("position") as BufferAttribute;
    const flatPosition = flat.getAttribute("position") as BufferAttribute;
    const hashToIndex: Record<string, number[]> = {}; // Position hash mapped to index values of same position
    const existingNeighbors: Record<string, Record<string, number[]>> = {}; // Position hash mapped to existing vertex neighbors
    const flatOpposites: Record<string, number[]> = {}; // Position hash mapped to new edge point opposites
    const existingEdges: Record<string, Set<string>> = {};

    function addNeighbor(posHash: string, neighborHash: string, index: number) {
      if (!existingNeighbors[posHash]) existingNeighbors[posHash] = {};
      if (!existingNeighbors[posHash][neighborHash]) existingNeighbors[posHash][neighborHash] = [];
      existingNeighbors[posHash][neighborHash].push(index);
    }

    function addOpposite(posHash: string, index: number) {
      if (!flatOpposites[posHash]) flatOpposites[posHash] = [];
      flatOpposites[posHash].push(index);
    }

    function addEdgePoint(posHash: string, edgeHash: string) {
      if (!existingEdges[posHash]) existingEdges[posHash] = new Set();
      existingEdges[posHash].add(edgeHash);
    }

    for (let i = 0; i < vertexCount; i += 3) {
      const posHash0 = hashFromVector(_vertex[0].fromBufferAttribute(posAttribute, i + 0));
      const posHash1 = hashFromVector(_vertex[1].fromBufferAttribute(posAttribute, i + 1));
      const posHash2 = hashFromVector(_vertex[2].fromBufferAttribute(posAttribute, i + 2));

      // Neighbors (of Existing Geometry)
      addNeighbor(posHash0, posHash1, i + 1);
      addNeighbor(posHash0, posHash2, i + 2);
      addNeighbor(posHash1, posHash0, i + 0);
      addNeighbor(posHash1, posHash2, i + 2);
      addNeighbor(posHash2, posHash0, i + 0);
      addNeighbor(posHash2, posHash1, i + 1);

      // Opposites (of new FlatSubdivided vertices)
      _vec0to1.copy(_vertex[0]).add(_vertex[1]).divideScalar(2.0);
      _vec1to2.copy(_vertex[1]).add(_vertex[2]).divideScalar(2.0);
      _vec2to0.copy(_vertex[2]).add(_vertex[0]).divideScalar(2.0);
      const hash0to1 = hashFromVector(_vec0to1);
      const hash1to2 = hashFromVector(_vec1to2);
      const hash2to0 = hashFromVector(_vec2to0);
      addOpposite(hash0to1, i + 2);
      addOpposite(hash1to2, i + 0);
      addOpposite(hash2to0, i + 1);

      // Track Edges for 'edgePreserve'
      addEdgePoint(posHash0, hash0to1);
      addEdgePoint(posHash0, hash2to0);
      addEdgePoint(posHash1, hash0to1);
      addEdgePoint(posHash1, hash1to2);
      addEdgePoint(posHash2, hash1to2);
      addEdgePoint(posHash2, hash2to0);
    }

    for (let i = 0; i < flat.attributes.position.count; i++) {
      const posHash = hashFromVector(_temp.fromBufferAttribute(flatPosition, i));
      if (!hashToIndex[posHash]) hashToIndex[posHash] = [];
      hashToIndex[posHash].push(i);
    }

    attributeList.forEach((attributeName) => {
      const existingAttribute = existing.getAttribute(attributeName) as BufferAttribute;
      const flattenedAttribute = flat.getAttribute(attributeName) as BufferAttribute;
      if (existingAttribute === undefined || flattenedAttribute === undefined) return;

      const floatArray = subdivideAttribute(attributeName, existingAttribute, flattenedAttribute);
      loop.setAttribute(attributeName, new BufferAttribute(floatArray, flattenedAttribute.itemSize));
    });

    const morphAttributes = existing.morphAttributes as Record<string, BufferAttribute[]>;
    for (const attributeName in morphAttributes) {
      const array: BufferAttribute[] = [];
      const morphAttribute = morphAttributes[attributeName];

      // Process Array of Float32BufferAttributes
      for (let i = 0, l = morphAttribute.length; i < l; i++) {
        if (morphAttribute[i].count !== vertexCount) continue;
        const existingAttribute = morphAttribute[i];
        const flattenedAttribute = LoopSubdivision.flatAttribute(morphAttribute[i], morphAttribute[i].count, params);

        const floatArray = subdivideAttribute(attributeName, existingAttribute, flattenedAttribute);
        array.push(new BufferAttribute(floatArray, flattenedAttribute.itemSize));
      }
      loop.morphAttributes[attributeName] = array;
    }
    loop.morphTargetsRelative = existing.morphTargetsRelative;

    flat.dispose();
    existing.dispose();
    return loop;

    function subdivideAttribute(
      attributeName: string,
      existingAttribute: BufferAttribute,
      flattenedAttribute: BufferAttribute,
    ) {
      const arrayLength = flat.attributes.position.count * flattenedAttribute.itemSize;
      const floatArray = new (existingAttribute.array.constructor as NumericArrayConstructor)(arrayLength);

      // Process Triangles
      let index = 0;
      for (let i = 0; i < flat.attributes.position.count; i += 3) {
        // Process Triangle Points
        for (let v = 0; v < 3; v++) {
          if (attributeName === "uv" && !params.uvSmooth) {
            _vertex[v].fromBufferAttribute(flattenedAttribute, i + v);
          } else if (attributeName === "normal") {
            _position[v].fromBufferAttribute(flatPosition, i + v);
            const positionHash = hashFromVector(_position[v]);
            const positions = hashToIndex[positionHash];

            const k = Object.keys(positions).length;
            const beta = 0.75 / k;
            const startWeight = 1.0 - beta * k;

            _vertex[v].fromBufferAttribute(flattenedAttribute, i + v);
            _vertex[v].multiplyScalar(startWeight);

            positions.forEach((positionIndex) => {
              _average.fromBufferAttribute(flattenedAttribute, positionIndex);
              _average.multiplyScalar(beta);
              _vertex[v].add(_average);
            });
          } else {
            // 'position', 'color', etc...

            _vertex[v].fromBufferAttribute(flattenedAttribute, i + v);
            _position[v].fromBufferAttribute(flatPosition, i + v);

            const positionHash = hashFromVector(_position[v]);
            const neighbors = existingNeighbors[positionHash];
            const opposites = flatOpposites[positionHash];

            if (neighbors) {
              // Check Edges have even Opposite Points
              if (params.preserveEdges) {
                const edgeSet = existingEdges[positionHash];
                let hasPair = true;
                for (const edgeHash of edgeSet) {
                  if (flatOpposites[edgeHash].length % 2 !== 0) hasPair = false;
                }
                if (!hasPair) continue;
              }

              // Number of Neighbors
              const k = Object.keys(neighbors).length;

              // Loop's formula.
              const beta = (1 / k) * (5 / 8 - Math.pow(3 / 8 + (1 / 4) * Math.cos((2 * Math.PI) / k), 2));

              const heavy = 1 / k / k;

              const weight = lerp(heavy, beta, params.weight as number);

              const startWeight = 1.0 - weight * k;
              _vertex[v].multiplyScalar(startWeight);

              for (let neighborHash in neighbors) {
                const neighborIndices = neighbors[neighborHash];

                _average.set(0, 0, 0);
                for (let j = 0; j < neighborIndices.length; j++) {
                  _average.add(_temp.fromBufferAttribute(existingAttribute, neighborIndices[j]));
                }
                _average.divideScalar(neighborIndices.length);

                _average.multiplyScalar(weight);
                _vertex[v].add(_average);
              }
            } else if (opposites && opposites.length === 2) {
              const k = opposites.length;
              const beta = 0.125; /* 1/8 */
              const startWeight = 1.0 - beta * k;
              _vertex[v].multiplyScalar(startWeight);

              opposites.forEach((oppositeIndex) => {
                _average.fromBufferAttribute(existingAttribute, oppositeIndex);
                _average.multiplyScalar(beta);
                _vertex[v].add(_average);
              });
            }
          }
        }

        // Add New Triangle Position
        setTriangle(floatArray, index, flattenedAttribute.itemSize, _vertex[0], _vertex[1], _vertex[2]);
        index += flattenedAttribute.itemSize * 3;
      }

      return floatArray;
    }
  }
}

const _positionShift = Math.pow(10, POSITION_DECIMALS);

/** Compares two numbers to see if they're almost the same */
function fuzzy(a: number, b: number, tolerance = 0.00001) {
  return a < b + tolerance && a > b - tolerance;
}

/** Generates hash strong from Number */
function hashFromNumber(num: number, shift = _positionShift) {
  let roundedNumber = round(num * shift);
  if (roundedNumber == 0) roundedNumber = 0; /* prevent -0 (signed 0 can effect Math.atan2(), etc.) */
  return `${roundedNumber}`;
}

/** Generates hash strong from Vector3 */
function hashFromVector(vector: Vector3, shift = _positionShift) {
  return `${hashFromNumber(vector.x, shift)},${hashFromNumber(vector.y, shift)},${hashFromNumber(vector.z, shift)}`;
}

function lerp(x: number, y: number, t: number) {
  return (1 - t) * x + t * y;
}

function round(x: number) {
  return (x + (x > 0 ? 0.5 : -0.5)) << 0;
}

function calcNormal(target: Vector3, vec1: Vector3, vec2: Vector3, vec3: Vector3) {
  _temp.subVectors(vec1, vec2);
  target.subVectors(vec2, vec3);
  target.cross(_temp).normalize();
}

function gatherAttributes(geometry: BufferGeometry) {
  const desired = ["position", "normal", "uv"];
  const contains = Object.keys(geometry.attributes);
  const attributeList = Array.from(new Set(desired.concat(contains)));
  return attributeList;
}

function setTriangle(
  positions: NumericArray,
  index: number,
  step: number,
  vec0: Vector3,
  vec1: Vector3,
  vec2: Vector3,
) {
  if (step >= 1) {
    positions[index] = vec0.x;
    positions[index + 0 + step * 1] = vec1.x;
    positions[index + 0 + step * 2] = vec2.x;
  }
  if (step >= 2) {
    positions[index + 1] = vec0.y;
    positions[index + 1 + step * 1] = vec1.y;
    positions[index + 1 + step * 2] = vec2.y;
  }
  if (step >= 3) {
    positions[index + 2] = vec0.z;
    positions[index + 2 + step * 1] = vec1.z;
    positions[index + 2 + step * 2] = vec2.z;
  }
  if (step >= 4) {
    positions[index + 3] = NaN;
    positions[index + 3 + step * 1] = NaN;
    positions[index + 3 + step * 2] = NaN;
  }
}

function verifyGeometry(geometry: BufferGeometry) {
  if (geometry === undefined) {
    console.warn(`LoopSubdivision: Geometry provided is undefined`);
    return false;
  }

  if (!geometry.isBufferGeometry) {
    console.warn(`LoopSubdivision: Geometry provided is not 'BufferGeometry' type`);
    return false;
  }

  if (geometry.attributes.position === undefined) {
    console.warn(`LoopSubdivision: Geometry provided missing required 'position' attribute`);
    return false;
  }

  if (geometry.attributes.normal === undefined) {
    geometry.computeVertexNormals();
  }
  return true;
}
