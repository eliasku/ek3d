import { BufferAttribute } from "../../../../../core/BufferAttribute";
import type { BufferGeometry } from "../../../../../core/BufferGeometry";
import { Color } from "../../../../../math/Color";
import { lerp } from "../../../../../math/MathUtils";
import type { Triangle } from "../../../../../math/Triangle";
import type { Vector3 } from "../../../../../math/Vector3";

export function getTriangleDefinitions(...triangles: Triangle[]): string[] {
  function getVectorDefinition(v: Vector3): string {
    return `new THREE.Vector3( ${v.x}, ${v.y}, ${v.z} )`;
  }

  return triangles.map((t) =>
    `
new THREE.Triangle(
	${getVectorDefinition(t.a)},
	${getVectorDefinition(t.b)},
	${getVectorDefinition(t.c)},
)
		`.trim(),
  );
}

export function logTriangleDefinitions(...triangles: Triangle[]): void {
  console.log(getTriangleDefinitions(...triangles).join(",\n"));
}

export function generateRandomTriangleColors(geometry: BufferGeometry): void {
  const position = geometry.attributes.position;
  const array = new Float32Array(position.count * 3);
  const color = new Color();
  for (let i = 0, l = array.length; i < l; i += 9) {
    color.setHSL(Math.random(), lerp(0.5, 1.0, Math.random()), lerp(0.5, 0.75, Math.random()));
    array[i + 0] = color.r;
    array[i + 1] = color.g;
    array[i + 2] = color.b;
    array[i + 3] = color.r;
    array[i + 4] = color.g;
    array[i + 5] = color.b;
    array[i + 6] = color.r;
    array[i + 7] = color.g;
    array[i + 8] = color.b;
  }
  geometry.setAttribute("color", new BufferAttribute(array, 3));
}
