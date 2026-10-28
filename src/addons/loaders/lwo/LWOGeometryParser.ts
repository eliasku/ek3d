import { BufferGeometry } from "../../../core/BufferGeometry";
import { BufferAttribute, Float32BufferAttribute } from "../../../core/BufferAttribute";
import type { LWOGeometry, LWOLayer, LWOTree } from "./IFFParser";

export class LWOGeometryParser {
  constructor(private readonly tree: LWOTree) {}

  parse(geoData: LWOGeometry, layer: LWOLayer): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(geoData.points, 3));
    geometry.setIndex(this.splitIndices(geoData.vertexIndices, geoData.polygonDimensions));
    this.parseGroups(geometry, geoData);
    geometry.computeVertexNormals();
    this.parseUVs(geometry, layer);
    this.parseMorphTargets(geometry, layer);
    return geometry;
  }

  // Split quads into triangles.
  splitIndices(indices: number[], polygonDimensions: number[]): number[] {
    const remappedIndices: number[] = [];
    let i = 0;
    polygonDimensions.forEach(function (dim) {
      if (dim < 4) {
        for (let k = 0; k < dim; k++) remappedIndices.push(indices[i + k]);
      } else if (dim === 4) {
        remappedIndices.push(indices[i], indices[i + 1], indices[i + 2], indices[i], indices[i + 2], indices[i + 3]);
      } else if (dim > 4) {
        for (let k = 1; k < dim - 1; k++) {
          remappedIndices.push(indices[i], indices[i + k], indices[i + k + 1]);
        }
        console.warn("LWOLoader: polygons with greater than 4 sides are not supported");
      }
      i += dim;
    });
    return remappedIndices;
  }

  // Polygon indices are ignored; they are assumed to be ordered.
  parseGroups(geometry: BufferGeometry, geoData: LWOGeometry): void {
    const tags = this.tree.tags;
    const matNames: string[] = [];
    let elemSize = 3;
    if (geoData.type === "lines") elemSize = 2;
    if (geoData.type === "points") elemSize = 1;
    const remappedIndices = this.splitMaterialIndices(geoData.polygonDimensions, geoData.materialIndices!);
    let indexNum = 0;
    const indexPairs: Record<string, number> = {};
    let prevMaterialIndex: number | undefined;
    let materialIndex: number | undefined;
    let prevStart = 0;
    let currentCount = 0;

    for (let i = 0; i < remappedIndices.length; i += 2) {
      materialIndex = remappedIndices[i + 1];
      if (i === 0) matNames[indexNum] = tags[materialIndex];
      if (prevMaterialIndex === undefined) prevMaterialIndex = materialIndex;
      if (materialIndex !== prevMaterialIndex) {
        let currentIndex: number;
        if (indexPairs[tags[prevMaterialIndex]]) {
          currentIndex = indexPairs[tags[prevMaterialIndex]];
        } else {
          currentIndex = indexNum;
          indexPairs[tags[prevMaterialIndex]] = indexNum;
          matNames[indexNum] = tags[prevMaterialIndex];
          indexNum++;
        }
        geometry.addGroup(prevStart, currentCount, currentIndex);
        prevStart += currentCount;
        prevMaterialIndex = materialIndex;
        currentCount = 0;
      }
      currentCount += elemSize;
    }

    if (geometry.groups.length > 0) {
      let currentIndex: number;
      if (indexPairs[tags[materialIndex!]]) {
        currentIndex = indexPairs[tags[materialIndex!]];
      } else {
        currentIndex = indexNum;
        indexPairs[tags[materialIndex!]] = indexNum;
        matNames[indexNum] = tags[materialIndex!];
      }
      geometry.addGroup(prevStart, currentCount, currentIndex);
    }
    geometry.userData.matNames = matNames;
  }

  splitMaterialIndices(polygonDimensions: number[], indices: number[]): number[] {
    const remappedIndices: number[] = [];
    polygonDimensions.forEach(function (dim, i) {
      if (dim <= 3) {
        remappedIndices.push(indices[i * 2], indices[i * 2 + 1]);
      } else if (dim === 4) {
        remappedIndices.push(indices[i * 2], indices[i * 2 + 1], indices[i * 2], indices[i * 2 + 1]);
      } else {
        for (let k = 0; k < dim - 2; k++) {
          remappedIndices.push(indices[i * 2], indices[i * 2 + 1]);
        }
      }
    });
    return remappedIndices;
  }

  // Multiple partial VMAPs are merged; discontinuous VMADs are not supported.
  parseUVs(geometry: BufferGeometry, layer: LWOLayer): void {
    const remappedUVs = Array.from(Array<number>(geometry.attributes.position.count * 2), function () {
      return 0;
    });
    for (const name in layer.uvs) {
      const uvs = layer.uvs![name].uvs;
      const uvIndices = layer.uvs![name].uvIndices;
      uvIndices.forEach(function (i, j) {
        remappedUVs[i * 2] = uvs[j * 2];
        remappedUVs[i * 2 + 1] = uvs[j * 2 + 1];
      });
    }
    geometry.setAttribute("uv", new Float32BufferAttribute(remappedUVs, 2));
  }

  parseMorphTargets(geometry: BufferGeometry, layer: LWOLayer): void {
    let num = 0;
    for (const name in layer.morphTargets) {
      const remappedPoints = (geometry.attributes.position as BufferAttribute).array.slice();
      if (!geometry.morphAttributes.position) geometry.morphAttributes.position = [];
      const morphPoints = layer.morphTargets![name].points;
      const morphIndices = layer.morphTargets![name].indices;
      const type = layer.morphTargets![name].type;
      morphIndices.forEach(function (i, j) {
        if (type === "relative") {
          remappedPoints[i * 3] += morphPoints[j * 3];
          remappedPoints[i * 3 + 1] += morphPoints[j * 3 + 1];
          remappedPoints[i * 3 + 2] += morphPoints[j * 3 + 2];
        } else {
          remappedPoints[i * 3] = morphPoints[j * 3];
          remappedPoints[i * 3 + 1] = morphPoints[j * 3 + 1];
          remappedPoints[i * 3 + 2] = morphPoints[j * 3 + 2];
        }
      });
      geometry.morphAttributes.position[num] = new Float32BufferAttribute(remappedPoints, 3);
      geometry.morphAttributes.position[num].name = name;
      num++;
    }
    geometry.morphTargetsRelative = false;
  }
}
