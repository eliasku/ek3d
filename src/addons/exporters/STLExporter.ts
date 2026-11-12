import type { BufferAttribute } from "../../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { Object3D } from "../../core/Object3D";
import { Vector3 } from "../../math/Vector3";
import type { Mesh } from "../../objects/Mesh";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";

export interface STLExporterOptions {
  binary?: boolean;
}

/**
 * Exports the surface geometry of an object and its descendants as ASCII or binary STL.
 * STL contains no color, texture, scale, or index information.
 *
 * ```typescript
 * import { STLExporter } from 'ek3d/addons/exporters/STLExporter';
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
 * const data = new STLExporter().parse(mesh, { binary: true });
 * ```
 */
export class STLExporter {
  parse(scene: Object3D, options: { binary: true }): DataView;
  parse(scene: Object3D, options?: { binary?: false }): string;
  parse(scene: Object3D, options: STLExporterOptions): string | DataView;
  parse(scene: Object3D, options: STLExporterOptions = {}): string | DataView {
    const binary = Object.assign({ binary: false }, options).binary;
    const objects: Mesh[] = [];
    let triangles = 0;

    scene.traverse((object) => {
      if ((object as Mesh).isMesh) {
        const mesh = object as Mesh;
        const geometry = mesh.geometry;
        const index = geometry.index;
        const position = geometry.getAttribute("position");
        if (position === undefined) throw new Error("STLExporter: Mesh geometry requires a position attribute.");
        triangles += (index !== null ? index.count : position.count) / 3;
        objects.push(mesh);
      }
    });

    let text = binary !== true ? "solid exported\n" : "";
    const output = binary === true ? new DataView(new ArrayBuffer(triangles * 50 + 84)) : null;
    let offset = 80;
    if (output !== null) {
      output.setUint32(offset, triangles, true);
      offset += 4;
    }

    const vA = new Vector3();
    const vB = new Vector3();
    const vC = new Vector3();
    const cb = new Vector3();
    const ab = new Vector3();
    const normal = new Vector3();

    for (const object of objects) {
      const geometry = object.geometry;
      const index = geometry.index;
      const position = geometry.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute;
      if (index !== null) {
        for (let j = 0; j < index.count; j += 3) {
          writeFace(index.getX(j), index.getX(j + 1), index.getX(j + 2), position, object);
        }
      } else {
        for (let j = 0; j < position.count; j += 3) {
          writeFace(j, j + 1, j + 2, position, object);
        }
      }
    }

    if (binary === false) text += "endsolid exported\n";
    return output ?? text;

    function writeFace(
      a: number,
      b: number,
      c: number,
      position: BufferAttribute | InterleavedBufferAttribute,
      object: Mesh,
    ): void {
      vA.fromBufferAttribute(position, a);
      vB.fromBufferAttribute(position, b);
      vC.fromBufferAttribute(position, c);
      if ((object as SkinnedMesh).isSkinnedMesh === true) {
        const skinned = object as SkinnedMesh;
        skinned.applyBoneTransform(a, vA);
        skinned.applyBoneTransform(b, vB);
        skinned.applyBoneTransform(c, vC);
      }
      vA.applyMatrix4(object.matrixWorld);
      vB.applyMatrix4(object.matrixWorld);
      vC.applyMatrix4(object.matrixWorld);
      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      cb.cross(ab).normalize();
      normal.copy(cb).normalize();
      if (output !== null) {
        writeVector(normal);
        writeVector(vA);
        writeVector(vB);
        writeVector(vC);
        output.setUint16(offset, 0, true);
        offset += 2;
      } else {
        text += `\tfacet normal ${normal.x} ${normal.y} ${normal.z}\n\t\touter loop\n`;
        text += `\t\t\tvertex ${vA.x} ${vA.y} ${vA.z}\n`;
        text += `\t\t\tvertex ${vB.x} ${vB.y} ${vB.z}\n`;
        text += `\t\t\tvertex ${vC.x} ${vC.y} ${vC.z}\n`;
        text += "\t\tendloop\n\tendfacet\n";
      }
    }

    function writeVector(vertex: Vector3): void {
      if (output === null) return;
      output.setFloat32(offset, vertex.x, true);
      offset += 4;
      output.setFloat32(offset, vertex.y, true);
      offset += 4;
      output.setFloat32(offset, vertex.z, true);
      offset += 4;
    }
  }
}
