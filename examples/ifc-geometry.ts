import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { ColorSpace } from "ek3d/constants";
import { Color } from "ek3d/math/Color";

export interface IFCColor {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Copies interleaved WASM geometry before its model is closed. */
export function ifcGeometryToBuffer(color: IFCColor, vertices: Float32Array, indices: Uint32Array): BufferGeometry {
  if (vertices.length % 6 !== 0) throw new Error("Invalid IFC position/normal buffer");
  const count = vertices.length / 6;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const linear = new Color().setRGB(color.x, color.y, color.z, ColorSpace.SRGB);
  for (let v = 0; v < count; v++) {
    const src = v * 6;
    const dst = v * 3;
    positions[dst] = vertices[src];
    positions[dst + 1] = vertices[src + 1];
    positions[dst + 2] = vertices[src + 2];
    normals[dst] = vertices[src + 3];
    normals[dst + 1] = vertices[src + 4];
    normals[dst + 2] = vertices[src + 5];
    const rgba = v * 4;
    colors[rgba] = linear.r;
    colors[rgba + 1] = linear.g;
    colors[rgba + 2] = linear.b;
    colors[rgba + 3] = color.w;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(new BufferAttribute(indices.slice(), 1));
  return geometry;
}
