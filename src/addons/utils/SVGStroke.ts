import { BufferGeometry } from "../../core/BufferGeometry";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { ShapeUtils } from "../../extras/ShapeUtils";
import { Vector2 } from "../../math/Vector2";

interface StrokeStyle {
  strokeColor: string;
  strokeWidth: number;
  strokeLineJoin: string;
  strokeLineCap: string;
  strokeMiterLimit: number;
}

// Stroke tessellation from the pinned three.js SVGLoader.
export class SVGStroke {
  static getStrokeStyle(width = 1, color = "#000", lineJoin = "miter", lineCap = "butt", miterLimit = 4) {
    width = width !== undefined ? width : 1;
    color = color !== undefined ? color : "#000";
    lineJoin = lineJoin !== undefined ? lineJoin : "miter";
    lineCap = lineCap !== undefined ? lineCap : "butt";
    miterLimit = miterLimit !== undefined ? miterLimit : 4;

    return {
      strokeColor: color,
      strokeWidth: width,
      strokeLineJoin: lineJoin,
      strokeLineCap: lineCap,
      strokeMiterLimit: miterLimit,
    };
  }

  /**
   * Creates a stroke from an array of points.
   *
   * @param points - The points in 2D space. Minimum 2 points. The path can be open or closed (last point equals to first point).
   * @param style - SVG stroke properties returned by `SVGStroke.getStrokeStyle()`.
   * @param arcDivisions - Arc divisions for round joins and endcaps.
   * @param minDistance - Points closer to this distance will be merged.
   * @return The stroke geometry. UV coordinates run along and across the path.
   * Returns `null` if not geometry was generated.
   */
  static pointsToStroke(
    points: Vector2[],
    style: StrokeStyle,
    arcDivisions = 12,
    minDistance = 0.001,
  ): BufferGeometry | null {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    if (SVGStroke.pointsToStrokeWithBuffers(points, style, arcDivisions, minDistance, vertices, normals, uvs) === 0) {
      return null;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));

    return geometry;
  }

  /**
   * Creates a stroke from an array of points.
   *
   * @param points - The points in 2D space. Minimum 2 points.
   * @param style - SVG stroke properties returned by `SVGStroke.getStrokeStyle()`.
   * @param arcDivisions - Arc divisions for round joins and endcaps.
   * @param minDistance - Points closer to this distance will be merged.
   * @param vertices - An array holding vertices.
   * @param normals - An array holding normals.
   * @param uvs - An array holding UVs.
   * @param vertexOffset - The vertex offset.
   * @return The number of vertices.
   */
  static pointsToStrokeWithBuffers(
    points: Vector2[],
    style: StrokeStyle,
    arcDivisions: number,
    minDistance: number,
    vertices: number[],
    normals: number[],
    uvs: number[],
    vertexOffset = 0,
  ): number {
    // This function can be called to update existing arrays or buffers.
    // Accepts same parameters as pointsToStroke, plus the buffers and optional offset.
    // Param vertexOffset: Offset vertices to start writing in the buffers (3 elements/vertex for vertices and normals, and 2 elements/vertex for uvs)
    // Returns number of written vertices / normals / uvs pairs
    // if 'vertices' parameter is undefined no triangles will be generated, but the returned vertices count will still be valid (useful to preallocate the buffers)
    // 'normals' and 'uvs' buffers are optional

    const tempV2_1 = new Vector2();
    const tempV2_2 = new Vector2();
    const tempV2_3 = new Vector2();
    const tempV2_4 = new Vector2();
    const tempV2_5 = new Vector2();
    const tempV2_6 = new Vector2();
    const tempV2_7 = new Vector2();
    const lastPointL = new Vector2();
    const lastPointR = new Vector2();
    const point0L = new Vector2();
    const point0R = new Vector2();
    const currentPointL = new Vector2();
    const currentPointR = new Vector2();
    const nextPointL = new Vector2();
    const nextPointR = new Vector2();
    const innerPoint = new Vector2();
    const outerPoint = new Vector2();

    arcDivisions = arcDivisions !== undefined ? arcDivisions : 12;
    minDistance = minDistance !== undefined ? minDistance : 0.001;
    vertexOffset = vertexOffset !== undefined ? vertexOffset : 0;

    // First ensure there are no duplicated points
    points = removeDuplicatedPoints(points);

    const numPoints = points.length;

    if (numPoints < 2) return 0;

    const isClosed = points[0].equals(points[numPoints - 1]);

    let currentPoint = points[0];
    let previousPoint = points[0];
    let nextPoint: Vector2 | undefined;

    const strokeWidth2 = style.strokeWidth / 2;

    const deltaU = 1 / (numPoints - 1);
    let u0 = 0,
      u1 = 0;

    let innerSideModified = false;
    let joinIsOnLeftSide = false;
    let isMiter = false;
    let initialJoinIsOnLeftSide = false;

    let numVertices = 0;
    let currentCoordinate = vertexOffset * 3;
    let currentCoordinateUV = vertexOffset * 2;

    // Get initial left and right stroke points
    getNormal(points[0], points[1], tempV2_1).multiplyScalar(strokeWidth2);
    lastPointL.copy(points[0]).sub(tempV2_1);
    lastPointR.copy(points[0]).add(tempV2_1);
    point0L.copy(lastPointL);
    point0R.copy(lastPointR);

    for (let iPoint = 1; iPoint < numPoints; iPoint++) {
      currentPoint = points[iPoint];

      // Get next point
      if (iPoint === numPoints - 1) {
        if (isClosed) {
          // Skip duplicated initial point
          nextPoint = points[1];
        } else nextPoint = undefined;
      } else {
        nextPoint = points[iPoint + 1];
      }

      // Normal of previous segment in tempV2_1
      const normal1 = tempV2_1;
      getNormal(previousPoint, currentPoint, normal1);

      tempV2_3.copy(normal1).multiplyScalar(strokeWidth2);
      currentPointL.copy(currentPoint).sub(tempV2_3);
      currentPointR.copy(currentPoint).add(tempV2_3);

      u1 = u0 + deltaU;

      innerSideModified = false;

      if (nextPoint !== undefined) {
        // Normal of next segment in tempV2_2
        getNormal(currentPoint, nextPoint, tempV2_2);

        tempV2_3.copy(tempV2_2).multiplyScalar(strokeWidth2);
        nextPointL.copy(currentPoint).sub(tempV2_3);
        nextPointR.copy(currentPoint).add(tempV2_3);

        joinIsOnLeftSide = true;
        tempV2_3.subVectors(nextPoint, previousPoint);
        if (normal1.dot(tempV2_3) < 0) {
          joinIsOnLeftSide = false;
        }

        if (iPoint === 1) initialJoinIsOnLeftSide = joinIsOnLeftSide;

        tempV2_3.subVectors(nextPoint, currentPoint);
        tempV2_3.normalize();
        const dot = Math.abs(normal1.dot(tempV2_3));

        // If path is straight, don't create join
        if (dot > Number.EPSILON) {
          // Compute inner and outer segment intersections
          const miterSide = strokeWidth2 / dot;
          tempV2_3.multiplyScalar(-miterSide);
          tempV2_4.subVectors(currentPoint, previousPoint);
          tempV2_5.copy(tempV2_4).setLength(miterSide).add(tempV2_3);
          innerPoint.copy(tempV2_5).negate();
          const miterLength2 = tempV2_5.length();
          const segmentLengthPrev = tempV2_4.length();
          tempV2_4.divideScalar(segmentLengthPrev);
          tempV2_6.subVectors(nextPoint, currentPoint);
          const segmentLengthNext = tempV2_6.length();
          tempV2_6.divideScalar(segmentLengthNext);
          // Check that previous and next segments doesn't overlap with the innerPoint of intersection
          if (tempV2_4.dot(innerPoint) < segmentLengthPrev && tempV2_6.dot(innerPoint) < segmentLengthNext) {
            innerSideModified = true;
          }

          outerPoint.copy(tempV2_5).add(currentPoint);
          innerPoint.add(currentPoint);

          // in-loop fold detection to mitigate #25326
          if (innerSideModified) {
            //  when the second triangle's signed area would flip, snap innerPoint to the previous inner-side vertex

            const refPt = joinIsOnLeftSide ? lastPointR : lastPointL;
            const foldCross =
              (outerPoint.x - refPt.x) * (innerPoint.y - refPt.y) - (outerPoint.y - refPt.y) * (innerPoint.x - refPt.x);
            if ((joinIsOnLeftSide && foldCross < 0) || (!joinIsOnLeftSide && foldCross > 0)) {
              innerPoint.copy(refPt);
            }
          }

          isMiter = false;

          if (innerSideModified) {
            if (joinIsOnLeftSide) {
              nextPointR.copy(innerPoint);
              currentPointR.copy(innerPoint);
            } else {
              nextPointL.copy(innerPoint);
              currentPointL.copy(innerPoint);
            }
          } else {
            // The segment triangles are generated here if there was overlapping

            makeSegmentTriangles();
          }

          switch (style.strokeLineJoin) {
            case "bevel":
              makeSegmentWithBevelJoin(joinIsOnLeftSide, innerSideModified, u1);

              break;

            case "round":
              // Segment triangles

              createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide, innerSideModified);

              // Join triangles

              if (joinIsOnLeftSide) {
                makeCircularSector(currentPoint, currentPointL, nextPointL, u1, 0);
              } else {
                makeCircularSector(currentPoint, nextPointR, currentPointR, u1, 1);
              }

              break;

            case "miter":
            case "miter-clip":
            default:
              const miterFraction = (strokeWidth2 * style.strokeMiterLimit) / miterLength2;

              if (miterFraction < 1) {
                // The join miter length exceeds the miter limit

                if (style.strokeLineJoin !== "miter-clip") {
                  makeSegmentWithBevelJoin(joinIsOnLeftSide, innerSideModified, u1);
                  break;
                } else {
                  // Segment triangles

                  createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide, innerSideModified);

                  // Miter-clip join triangles

                  if (joinIsOnLeftSide) {
                    tempV2_6.subVectors(outerPoint, currentPointL).multiplyScalar(miterFraction).add(currentPointL);
                    tempV2_7.subVectors(outerPoint, nextPointL).multiplyScalar(miterFraction).add(nextPointL);

                    addVertex(currentPointL, u1, 0);
                    addVertex(tempV2_6, u1, 0);
                    addVertex(currentPoint, u1, 0.5);

                    addVertex(currentPoint, u1, 0.5);
                    addVertex(tempV2_6, u1, 0);
                    addVertex(tempV2_7, u1, 0);

                    addVertex(currentPoint, u1, 0.5);
                    addVertex(tempV2_7, u1, 0);
                    addVertex(nextPointL, u1, 0);
                  } else {
                    tempV2_6.subVectors(outerPoint, currentPointR).multiplyScalar(miterFraction).add(currentPointR);
                    tempV2_7.subVectors(outerPoint, nextPointR).multiplyScalar(miterFraction).add(nextPointR);

                    addVertex(currentPointR, u1, 1);
                    addVertex(tempV2_6, u1, 1);
                    addVertex(currentPoint, u1, 0.5);

                    addVertex(currentPoint, u1, 0.5);
                    addVertex(tempV2_6, u1, 1);
                    addVertex(tempV2_7, u1, 1);

                    addVertex(currentPoint, u1, 0.5);
                    addVertex(tempV2_7, u1, 1);
                    addVertex(nextPointR, u1, 1);
                  }
                }
              } else {
                // Miter join segment triangles

                if (innerSideModified) {
                  // Optimized segment + join triangles

                  if (joinIsOnLeftSide) {
                    addVertex(lastPointR, u0, 1);
                    addVertex(lastPointL, u0, 0);
                    addVertex(outerPoint, u1, 0);

                    addVertex(lastPointR, u0, 1);
                    addVertex(outerPoint, u1, 0);
                    addVertex(innerPoint, u1, 1);
                  } else {
                    addVertex(lastPointR, u0, 1);
                    addVertex(lastPointL, u0, 0);
                    addVertex(outerPoint, u1, 1);

                    addVertex(lastPointL, u0, 0);
                    addVertex(innerPoint, u1, 0);
                    addVertex(outerPoint, u1, 1);
                  }

                  if (joinIsOnLeftSide) {
                    nextPointL.copy(outerPoint);
                  } else {
                    nextPointR.copy(outerPoint);
                  }
                } else {
                  // Add extra miter join triangles

                  if (joinIsOnLeftSide) {
                    addVertex(currentPointL, u1, 0);
                    addVertex(outerPoint, u1, 0);
                    addVertex(currentPoint, u1, 0.5);

                    addVertex(currentPoint, u1, 0.5);
                    addVertex(outerPoint, u1, 0);
                    addVertex(nextPointL, u1, 0);
                  } else {
                    addVertex(currentPointR, u1, 1);
                    addVertex(outerPoint, u1, 1);
                    addVertex(currentPoint, u1, 0.5);

                    addVertex(currentPoint, u1, 0.5);
                    addVertex(outerPoint, u1, 1);
                    addVertex(nextPointR, u1, 1);
                  }
                }

                isMiter = true;
              }

              break;
          }
        } else {
          // The segment triangles are generated here when two consecutive points are collinear

          makeSegmentTriangles();
        }
      } else {
        // The segment triangles are generated here if it is the ending segment

        makeSegmentTriangles();
      }

      if (!isClosed && iPoint === numPoints - 1) {
        // Start line endcap
        addCapGeometry(points[0], point0L, point0R, joinIsOnLeftSide, true, u0);
      }

      // Increment loop variables

      u0 = u1;

      previousPoint = currentPoint;

      lastPointL.copy(nextPointL);
      lastPointR.copy(nextPointR);
    }

    if (!isClosed) {
      // Ending line endcap
      addCapGeometry(currentPoint, currentPointL, currentPointR, joinIsOnLeftSide, false, u1);
    } else if (innerSideModified && vertices) {
      // Modify path first segment vertices to adjust to the segments inner and outer intersections

      let lastOuter = outerPoint;
      let lastInner = innerPoint;

      if (initialJoinIsOnLeftSide !== joinIsOnLeftSide) {
        lastOuter = innerPoint;
        lastInner = outerPoint;
      }

      if (joinIsOnLeftSide) {
        if (isMiter || initialJoinIsOnLeftSide) {
          lastInner.toArray(vertices, 0);
          lastInner.toArray(vertices, 3 * 3);

          if (isMiter) {
            lastOuter.toArray(vertices, 1 * 3);
          }
        }
      } else {
        if (isMiter || !initialJoinIsOnLeftSide) {
          lastInner.toArray(vertices, 1 * 3);
          lastInner.toArray(vertices, 3 * 3);

          if (isMiter) {
            lastOuter.toArray(vertices, 0);
          }
        }
      }
    }

    // Second fix for #25326: Scan for reamining flipped (CW) triangles and collapse them to
    // degenerated ones. This is safe and leaves no "holes" in the stroke because the flipped
    // triangle's area is covered by neighbouring (CCW) triangles.

    if (vertices) {
      const tri = [new Vector2(), new Vector2(), new Vector2()];
      const startFloat = vertexOffset * 3;

      for (let t = startFloat; t < currentCoordinate; t += 9) {
        tri[0].set(vertices[t], vertices[t + 1]);
        tri[1].set(vertices[t + 3], vertices[t + 4]);
        tri[2].set(vertices[t + 6], vertices[t + 7]);

        if (ShapeUtils.area(tri) < 0) {
          vertices[t + 3] = tri[0].x;
          vertices[t + 4] = tri[0].y;
        }
      }
    }

    return numVertices;

    // -- End of algorithm

    // -- Functions

    function getNormal(p1: Vector2, p2: Vector2, result: Vector2) {
      result.subVectors(p2, p1);
      return result.set(-result.y, result.x).normalize();
    }

    function addVertex(position: Vector2, u: number, v: number) {
      if (vertices) {
        vertices[currentCoordinate] = position.x;
        vertices[currentCoordinate + 1] = position.y;
        vertices[currentCoordinate + 2] = 0;

        if (normals) {
          normals[currentCoordinate] = 0;
          normals[currentCoordinate + 1] = 0;
          normals[currentCoordinate + 2] = 1;
        }

        currentCoordinate += 3;

        if (uvs) {
          uvs[currentCoordinateUV] = u;
          uvs[currentCoordinateUV + 1] = v;

          currentCoordinateUV += 2;
        }
      }

      numVertices += 3;
    }

    function makeCircularSector(center: Vector2, p1: Vector2, p2: Vector2, u: number, v: number) {
      // param p1, p2: Points in the circle arc.
      // p1 and p2 are in clockwise direction.

      tempV2_1.copy(p1).sub(center).normalize();
      tempV2_2.copy(p2).sub(center).normalize();

      let angle = Math.PI;
      const dot = tempV2_1.dot(tempV2_2);
      if (Math.abs(dot) < 1) angle = Math.abs(Math.acos(dot));

      angle /= arcDivisions;

      tempV2_3.copy(p1);

      for (let i = 0, il = arcDivisions - 1; i < il; i++) {
        tempV2_4.copy(tempV2_3).rotateAround(center, angle);

        addVertex(tempV2_3, u, v);
        addVertex(tempV2_4, u, v);
        addVertex(center, u, 0.5);

        tempV2_3.copy(tempV2_4);
      }

      addVertex(tempV2_3, u, v);
      addVertex(p2, u, v);
      addVertex(center, u, 0.5);
    }

    function makeSegmentTriangles() {
      addVertex(lastPointR, u0, 1);
      addVertex(lastPointL, u0, 0);
      addVertex(currentPointL, u1, 0);

      addVertex(lastPointR, u0, 1);
      addVertex(currentPointL, u1, 0);
      addVertex(currentPointR, u1, 1);
    }

    function makeSegmentWithBevelJoin(joinIsOnLeftSide: boolean, innerSideModified: boolean, u: number) {
      if (innerSideModified) {
        // Optimized segment + bevel triangles

        if (joinIsOnLeftSide) {
          // Path segments triangles

          addVertex(lastPointR, u0, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(currentPointL, u1, 0);

          addVertex(lastPointR, u0, 1);
          addVertex(currentPointL, u1, 0);
          addVertex(innerPoint, u1, 1);

          // Bevel join triangle

          addVertex(currentPointL, u, 0);
          addVertex(nextPointL, u, 0);
          addVertex(innerPoint, u, 0.5);
        } else {
          // Path segments triangles

          addVertex(lastPointR, u0, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(currentPointR, u1, 1);

          addVertex(lastPointL, u0, 0);
          addVertex(innerPoint, u1, 0);
          addVertex(currentPointR, u1, 1);

          // Bevel join triangle

          addVertex(currentPointR, u, 1);
          addVertex(innerPoint, u, 0);
          addVertex(nextPointR, u, 1);
        }
      } else {
        // Bevel join triangle. The segment triangles are done in the main loop

        if (joinIsOnLeftSide) {
          addVertex(currentPointL, u, 0);
          addVertex(nextPointL, u, 0);
          addVertex(currentPoint, u, 0.5);
        } else {
          addVertex(currentPointR, u, 1);
          addVertex(nextPointR, u, 0);
          addVertex(currentPoint, u, 0.5);
        }
      }
    }

    function createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide: boolean, innerSideModified: boolean) {
      if (innerSideModified) {
        if (joinIsOnLeftSide) {
          addVertex(lastPointR, u0, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(currentPointL, u1, 0);

          addVertex(lastPointR, u0, 1);
          addVertex(currentPointL, u1, 0);
          addVertex(innerPoint, u1, 1);

          addVertex(currentPointL, u0, 0);
          addVertex(currentPoint, u1, 0.5);
          addVertex(innerPoint, u1, 1);

          addVertex(currentPoint, u1, 0.5);
          addVertex(nextPointL, u0, 0);
          addVertex(innerPoint, u1, 1);
        } else {
          addVertex(lastPointR, u0, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(currentPointR, u1, 1);

          addVertex(lastPointL, u0, 0);
          addVertex(innerPoint, u1, 0);
          addVertex(currentPointR, u1, 1);

          addVertex(currentPointR, u0, 1);
          addVertex(innerPoint, u1, 0);
          addVertex(currentPoint, u1, 0.5);

          addVertex(currentPoint, u1, 0.5);
          addVertex(innerPoint, u1, 0);
          addVertex(nextPointR, u0, 1);
        }
      }
    }

    function addCapGeometry(
      center: Vector2,
      p1: Vector2,
      p2: Vector2,
      joinIsOnLeftSide: boolean,
      start: boolean,
      u: number,
    ) {
      // param center: End point of the path
      // param p1, p2: Left and right cap points

      switch (style.strokeLineCap) {
        case "round":
          if (start) {
            makeCircularSector(center, p2, p1, u, 0.5);
          } else {
            makeCircularSector(center, p1, p2, u, 0.5);
          }

          break;

        case "square":
          if (start) {
            tempV2_1.subVectors(p1, center);
            tempV2_2.set(tempV2_1.y, -tempV2_1.x);

            tempV2_3.addVectors(tempV2_1, tempV2_2).add(center);
            tempV2_4.subVectors(tempV2_2, tempV2_1).add(center);

            // Modify already existing vertices
            if (joinIsOnLeftSide) {
              tempV2_3.toArray(vertices, 1 * 3);
              tempV2_4.toArray(vertices, 0);
              tempV2_4.toArray(vertices, 3 * 3);
            } else {
              tempV2_3.toArray(vertices, 1 * 3);
              // using tempV2_4 to update 3rd vertex if the uv.y of 3rd vertex is 1
              if (uvs[3 * 2 + 1] === 1) tempV2_4.toArray(vertices, 3 * 3);
              else tempV2_3.toArray(vertices, 3 * 3);
              tempV2_4.toArray(vertices, 0);
            }
          } else {
            tempV2_1.subVectors(p2, center);
            tempV2_2.set(tempV2_1.y, -tempV2_1.x);

            tempV2_3.addVectors(tempV2_1, tempV2_2).add(center);
            tempV2_4.subVectors(tempV2_2, tempV2_1).add(center);

            const vl = vertices.length;

            // Modify already existing vertices
            if (joinIsOnLeftSide) {
              tempV2_3.toArray(vertices, vl - 1 * 3);
              tempV2_4.toArray(vertices, vl - 2 * 3);
              tempV2_4.toArray(vertices, vl - 4 * 3);
            } else {
              tempV2_4.toArray(vertices, vl - 2 * 3);
              tempV2_3.toArray(vertices, vl - 1 * 3);
              tempV2_4.toArray(vertices, vl - 4 * 3);
            }
          }

          break;

        case "butt":
        default:
          // Nothing to do here
          break;
      }
    }

    function removeDuplicatedPoints(points: Vector2[]) {
      // Creates a new array if necessary with duplicated points removed.
      // This does not remove duplicated initial and ending points of a closed path.

      let dupPoints = false;
      for (let i = 1, n = points.length - 1; i < n; i++) {
        if (points[i].distanceTo(points[i + 1]) < minDistance) {
          dupPoints = true;
          break;
        }
      }

      if (!dupPoints) return points;

      const newPoints = [];
      newPoints.push(points[0]);

      for (let i = 1, n = points.length - 1; i < n; i++) {
        if (points[i].distanceTo(points[i + 1]) >= minDistance) {
          newPoints.push(points[i]);
        }
      }

      newPoints.push(points[points.length - 1]);

      return newPoints;
    }
  }
}
