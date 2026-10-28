import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Vector3 } from "../../math/Vector3";
import { mergeVertices } from "../utils/BufferGeometryUtils";

/** Splits indexed vertices at edges sharper than the supplied angle. */
export class EdgeSplitModifier {
  modify(input: BufferGeometry, cutOffAngle: number, tryKeepNormals = true): BufferGeometry {
    let geometry = input;
    const hadNormals = geometry.attributes.normal !== undefined;
    let oldNormals: BufferAttribute["array"] | null = null;
    if (hadNormals) {
      geometry = geometry.clone();
      if (tryKeepNormals && geometry.index !== null) oldNormals = (geometry.attributes.normal as BufferAttribute).array;
      geometry.deleteAttribute("normal");
    }
    if (geometry.index === null) geometry = mergeVertices(geometry);
    const indexes = geometry.index!.array;
    const positions = (geometry.attributes.position as BufferAttribute).array;
    const normals = new Float32Array(indexes.length * 3);
    const vertices: number[][] = Array.from({ length: positions.length / 3 }, () => []);
    const a = new Vector3(),
      b = new Vector3(),
      c = new Vector3();
    for (let i = 0; i < indexes.length; i += 3) {
      a.fromArray(positions, indexes[i] * 3);
      b.fromArray(positions, indexes[i + 1] * 3);
      c.fromArray(positions, indexes[i + 2] * 3);
      const normal = c.sub(b).cross(a.sub(b)).normalize();
      for (let j = 0; j < 3; j++) {
        normals[(i + j) * 3] = normal.x;
        normals[(i + j) * 3 + 1] = normal.y;
        normals[(i + j) * 3 + 2] = normal.z;
        vertices[indexes[i + j]].push(i + j);
      }
    }
    const splits: { original: number; indexes: number[] }[] = [];
    const cutoff = Math.cos(cutOffAngle) - 0.001;
    function split(group: number[], original: number | null = null): void {
      if (group.length === 0) return;
      let best: number[] = [],
        remaining: number[] = [];
      for (const first of group) {
        const current = [first],
          other: number[] = [];
        for (const index of group)
          if (index !== first) {
            const dot =
              normals[first * 3] * normals[index * 3] +
              normals[first * 3 + 1] * normals[index * 3 + 1] +
              normals[first * 3 + 2] * normals[index * 3 + 2];
            (dot < cutoff ? other : current).push(index);
          }
        if (current.length > best.length) {
          best = current;
          remaining = other;
        }
      }
      if (original !== null) splits.push({ original, indexes: best });
      if (remaining.length) split(remaining, original || best[0]);
    }
    for (const group of vertices) split(group);
    const attributes: Record<string, BufferAttribute> = {};
    for (const [name, value] of Object.entries(geometry.attributes)) {
      const old = value as BufferAttribute;
      const Constructor = old.array.constructor as new (length: number) => BufferAttribute["array"];
      const array = new Constructor((indexes.length + splits.length) * old.itemSize);
      array.set(old.array);
      attributes[name] = new BufferAttribute(array, old.itemSize, old.normalized);
    }
    const newIndexes = new Uint32Array(indexes);
    splits.forEach((entry, i) => {
      const vertex = indexes[entry.original],
        target = indexes.length + i;
      for (const attribute of Object.values(attributes))
        for (let j = 0; j < attribute.itemSize; j++) {
          attribute.array[target * attribute.itemSize + j] = attribute.array[vertex * attribute.itemSize + j];
        }
      for (const index of entry.indexes) newIndexes[index] = target;
    });
    const result = new BufferGeometry();
    result.setIndex(new BufferAttribute(newIndexes, 1));
    for (const [name, attribute] of Object.entries(attributes)) result.setAttribute(name, attribute);
    if (hadNormals) {
      result.computeVertexNormals();
      if (oldNormals !== null) {
        const changed = new Uint8Array(oldNormals.length / 3);
        for (const entry of splits) changed[entry.original] = 1;
        const normals = (result.attributes.normal as BufferAttribute).array;
        for (let i = 0; i < changed.length; i++)
          if (!changed[i]) {
            for (let j = 0; j < 3; j++) normals[3 * i + j] = oldNormals[3 * i + j];
          }
      }
    }
    return result;
  }
}
