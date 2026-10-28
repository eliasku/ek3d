import { BufferGeometry } from "../../core/BufferGeometry";
import { BufferAttribute, Float32BufferAttribute } from "../../core/BufferAttribute";

/** Splits the longest edge of each triangle until it is short enough. */
export class TessellateModifier {
  maxEdgeLength: number;
  maxIterations: number;

  constructor(maxEdgeLength = 0.1, maxIterations = 6) {
    this.maxEdgeLength = maxEdgeLength;
    this.maxIterations = maxIterations;
  }

  modify(geometry: BufferGeometry): BufferGeometry {
    const source = geometry.index === null ? geometry : geometry.toNonIndexed();
    const names = ["position", "normal", "color", "uv", "uv1"].filter(
      (name) => source.getAttribute(name) !== undefined,
    );
    let arrays = names.map((name) =>
      Array.from((source.getAttribute(name) as BufferAttribute).array as ArrayLike<number>),
    );
    const sizes = names.map((name) => (name === "uv" || name === "uv1" ? 2 : 3));
    const maxSquared = this.maxEdgeLength * this.maxEdgeLength;
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      const next = names.map((): number[] => []);
      let split = false;
      const positions = arrays[0];
      for (let face = 0; face < positions.length / 9; face++) {
        const distance = (a: number, b: number): number => {
          const i = face * 9 + a * 3,
            j = face * 9 + b * 3;
          return (
            (positions[i] - positions[j]) ** 2 +
            (positions[i + 1] - positions[j + 1]) ** 2 +
            (positions[i + 2] - positions[j + 2]) ** 2
          );
        };
        const ab = distance(0, 1),
          bc = distance(1, 2),
          ac = distance(0, 2);
        let triangles = [0, 1, 2];
        let edge = [0, 1];
        if (ab > maxSquared || bc > maxSquared || ac > maxSquared) {
          split = true;
          if (ab >= bc && ab >= ac) triangles = [0, 3, 2, 3, 1, 2];
          else if (bc >= ab && bc >= ac) {
            edge = [1, 2];
            triangles = [0, 1, 3, 3, 2, 0];
          } else {
            edge = [0, 2];
            triangles = [0, 1, 3, 3, 1, 2];
          }
        }
        for (let attribute = 0; attribute < names.length; attribute++) {
          const values = arrays[attribute],
            size = sizes[attribute],
            offset = face * 3 * size;
          for (const vertex of triangles)
            for (let component = 0; component < size; component++) {
              next[attribute].push(
                vertex === 3
                  ? (values[offset + edge[0] * size + component] + values[offset + edge[1] * size + component]) / 2
                  : values[offset + vertex * size + component],
              );
            }
        }
      }
      arrays = next;
      if (!split) break;
    }
    const result = new BufferGeometry();
    names.forEach((name, i) => result.setAttribute(name, new Float32BufferAttribute(arrays[i], sizes[i])));
    if (source !== geometry) source.dispose();
    return result;
  }
}
