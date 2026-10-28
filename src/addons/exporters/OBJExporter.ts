import { SRGBColorSpace } from "../../constants";
import type { BufferAttribute } from "../../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { Object3D } from "../../core/Object3D";
import type { Material } from "../../materials/Material";
import { Color } from "../../math/Color";
import { ColorManagement } from "../../math/ColorManagement";
import { Matrix3 } from "../../math/Matrix3";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import type { Mesh } from "../../objects/Mesh";
import type { Line } from "../../objects/Line";
import type { Points } from "../../objects/Points";

/**
 * An exporter for OBJ.
 *
 * `OBJExporter` is not able to export material data into MTL files so only geometry data are supported.
 *
 * ```typescript
 * import { OBJExporter } from 'ek3d/addons/exporters/OBJExporter';
 * import { Scene } from 'ek3d/scenes/Scene';
 * const scene = new Scene();
 * const exporter = new OBJExporter();
 * const data = exporter.parse( scene );
 * ```
 *
 */
export class OBJExporter {
  /**
   * Parses the given 3D object and generates the OBJ output.
   *
   * If the 3D object is composed of multiple children and geometry, they are merged into a single mesh in the file.
   *
   * @param object - The 3D object to export.
   * @return The exported OBJ.
   */
  parse(object: Object3D): string {
    let output = "";

    let indexVertex = 0;
    let indexVertexUvs = 0;
    let indexNormals = 0;

    const vertex = new Vector3();
    const color = new Color();
    const normal = new Vector3();
    const uv = new Vector2();

    const face: string[] = [];

    function parseMesh(mesh: Mesh) {
      let nbVertex = 0;
      let nbNormals = 0;
      let nbVertexUvs = 0;

      const geometry = mesh.geometry;

      const normalMatrixWorld = new Matrix3();

      // shortcuts
      const vertices = geometry.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute | undefined;
      const normals = geometry.getAttribute("normal") as BufferAttribute | InterleavedBufferAttribute | undefined;
      const uvs = geometry.getAttribute("uv") as BufferAttribute | InterleavedBufferAttribute | undefined;
      const colors = geometry.getAttribute("color") as BufferAttribute | InterleavedBufferAttribute | undefined;
      const indices = geometry.getIndex();

      // name of the mesh object
      output += "o " + mesh.name + "\n";

      // name of the mesh material
      if (mesh.material && (mesh.material as Material).name) {
        output += "usemtl " + (mesh.material as Material).name + "\n";
      }

      // vertices

      if (vertices !== undefined) {
        for (let i = 0, l = vertices.count; i < l; i++, nbVertex++) {
          vertex.fromBufferAttribute(vertices, i);

          // transform the vertex to world space
          vertex.applyMatrix4(mesh.matrixWorld);

          // transform the vertex to export format
          output += "v " + vertex.x + " " + vertex.y + " " + vertex.z;

          if (colors !== undefined) {
            color.fromBufferAttribute(colors, i);

            ColorManagement.workingToColorSpace(color, SRGBColorSpace);

            output += " " + color.r + " " + color.g + " " + color.b;
          }

          output += "\n";
        }
      }

      // uvs

      if (uvs !== undefined) {
        for (let i = 0, l = uvs.count; i < l; i++, nbVertexUvs++) {
          uv.fromBufferAttribute(uvs, i);

          // transform the uv to export format
          output += "vt " + uv.x + " " + uv.y + "\n";
        }
      }

      // normals

      if (normals !== undefined) {
        normalMatrixWorld.getNormalMatrix(mesh.matrixWorld);

        for (let i = 0, l = normals.count; i < l; i++, nbNormals++) {
          normal.fromBufferAttribute(normals, i);

          // transform the normal to world space
          normal.applyMatrix3(normalMatrixWorld).normalize();

          // transform the normal to export format
          output += "vn " + normal.x + " " + normal.y + " " + normal.z + "\n";
        }
      }

      // faces

      if (indices !== null) {
        for (let i = 0, l = indices.count; i < l; i += 3) {
          for (let m = 0; m < 3; m++) {
            const j = indices.getX(i + m) + 1;

            face[m] =
              indexVertex +
              j +
              (normals || uvs ? "/" + (uvs ? indexVertexUvs + j : "") + (normals ? "/" + (indexNormals + j) : "") : "");
          }

          // transform the face to export format
          output += "f " + face.join(" ") + "\n";
        }
      } else {
        for (let i = 0, l = vertices!.count; i < l; i += 3) {
          for (let m = 0; m < 3; m++) {
            const j = i + m + 1;

            face[m] =
              indexVertex +
              j +
              (normals || uvs ? "/" + (uvs ? indexVertexUvs + j : "") + (normals ? "/" + (indexNormals + j) : "") : "");
          }

          // transform the face to export format
          output += "f " + face.join(" ") + "\n";
        }
      }

      // update index
      indexVertex += nbVertex;
      indexVertexUvs += nbVertexUvs;
      indexNormals += nbNormals;
    }

    function parseLine(line: Line) {
      let nbVertex = 0;

      const geometry = line.geometry;
      const type = line.type;

      // shortcuts
      const vertices = geometry.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute | undefined;
      const indices = geometry.getIndex();

      // name of the line object
      output += "o " + line.name + "\n";

      if (vertices !== undefined) {
        for (let i = 0, l = vertices.count; i < l; i++, nbVertex++) {
          vertex.fromBufferAttribute(vertices, i);

          // transform the vertex to world space
          vertex.applyMatrix4(line.matrixWorld);

          // transform the vertex to export format
          output += "v " + vertex.x + " " + vertex.y + " " + vertex.z + "\n";
        }
      }

      if (type === "Line") {
        output += "l ";

        if (indices !== null) {
          for (let i = 0, l = indices.count; i < l; i++) {
            const j = indices.getX(i) + 1;

            output += indexVertex + j + " ";
          }
        } else {
          for (let j = 1, l = vertices!.count; j <= l; j++) {
            output += indexVertex + j + " ";
          }
        }

        output += "\n";
      }

      if (type === "LineSegments") {
        if (indices !== null) {
          for (let i = 0, l = indices.count - 1; i < l; i += 2) {
            const j = indices.getX(i) + 1;
            const k = indices.getX(i + 1) + 1;

            output += "l " + (indexVertex + j) + " " + (indexVertex + k) + "\n";
          }
        } else {
          for (let j = 1, k = j + 1, l = vertices!.count; j < l; j += 2, k = j + 1) {
            output += "l " + (indexVertex + j) + " " + (indexVertex + k) + "\n";
          }
        }
      }

      // update index
      indexVertex += nbVertex;
    }

    function parsePoints(points: Points) {
      let nbVertex = 0;

      const geometry = points.geometry;

      const vertices = geometry.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute | undefined;
      const colors = geometry.getAttribute("color") as BufferAttribute | InterleavedBufferAttribute | undefined;

      output += "o " + points.name + "\n";

      if (vertices !== undefined) {
        for (let i = 0, l = vertices.count; i < l; i++, nbVertex++) {
          vertex.fromBufferAttribute(vertices, i);
          vertex.applyMatrix4(points.matrixWorld);

          output += "v " + vertex.x + " " + vertex.y + " " + vertex.z;

          if (colors !== undefined) {
            color.fromBufferAttribute(colors, i);

            ColorManagement.workingToColorSpace(color, SRGBColorSpace);

            output += " " + color.r + " " + color.g + " " + color.b;
          }

          output += "\n";
        }

        output += "p ";

        for (let j = 1, l = vertices.count; j <= l; j++) {
          output += indexVertex + j + " ";
        }

        output += "\n";
      }

      // update index
      indexVertex += nbVertex;
    }

    object.traverse(function (objectChild) {
      const child = objectChild as Object3D & { isMesh?: boolean; isLine?: boolean; isPoints?: boolean };

      if (child.isMesh === true) {
        parseMesh(child as Mesh);
      }

      if (child.isLine === true) {
        parseLine(child as Line);
      }

      if (child.isPoints === true) {
        parsePoints(child as Points);
      }
    });

    return output;
  }
}
