import { SRGBColorSpace } from "../../constants";
import { BufferAttribute, Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { BoxGeometry } from "../../geometries/BoxGeometry";
import { ConeGeometry } from "../../geometries/ConeGeometry";
import { CylinderGeometry } from "../../geometries/CylinderGeometry";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import { ShapeUtils } from "../../extras/ShapeUtils";
import { Color } from "../../math/Color";
import { ColorManagement } from "../../math/ColorManagement";
import { Quaternion } from "../../math/Quaternion";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import type { VRMLNode, VRMLUse } from "./vrml-parser";

export type VRMLGeometry = BufferGeometry & { _type?: "mesh" | "line" | "points"; _solid?: boolean };

export function buildVRMLGeometry(
  node: VRMLNode,
  getNode: (node: VRMLNode | VRMLUse) => unknown,
): VRMLGeometry | undefined {
  function buildIndexedFaceSetNode(node: VRMLNode): VRMLGeometry {
    let color: number[] | undefined, coord!: number[], normal: number[] | undefined, texCoord: number[] | undefined;
    let ccw = true,
      solid = true,
      creaseAngle = 0;
    let colorIndex: number[] | undefined,
      coordIndex: number[] | undefined,
      normalIndex: number[] | undefined,
      texCoordIndex: number[] | undefined;
    let colorPerVertex = true,
      normalPerVertex = true;

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValues = field.values as number[];

      switch (fieldName) {
        case "color":
          const colorNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (colorNode !== null) {
            color = getNode(colorNode) as number[];
          }

          break;

        case "coord":
          const coordNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (coordNode !== null) {
            coord = getNode(coordNode) as number[];
          }

          break;

        case "normal":
          const normalNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (normalNode !== null) {
            normal = getNode(normalNode) as number[];
          }

          break;

        case "texCoord":
          const texCoordNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (texCoordNode !== null) {
            texCoord = getNode(texCoordNode) as number[];
          }

          break;

        case "ccw":
          ccw = field.values[0] as boolean;
          break;

        case "colorIndex":
          colorIndex = fieldValues;
          break;

        case "colorPerVertex":
          colorPerVertex = field.values[0] as boolean;
          break;

        case "convex":
          // field not supported
          break;

        case "coordIndex":
          coordIndex = fieldValues;
          break;

        case "creaseAngle":
          creaseAngle = fieldValues[0];
          break;

        case "normalIndex":
          normalIndex = fieldValues;
          break;

        case "normalPerVertex":
          normalPerVertex = field.values[0] as boolean;
          break;

        case "solid":
          solid = field.values[0] as boolean;
          break;

        case "texCoordIndex":
          texCoordIndex = fieldValues;
          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    if (coordIndex === undefined) {
      console.warn("THREE.VRMLLoader: Missing coordIndex.");

      return new BufferGeometry(); // handle VRML files with incomplete geometry definition
    }

    const triangulatedCoordIndex = triangulateFaceIndex(coordIndex, ccw);

    let colorAttribute;
    let normalAttribute;
    let uvAttribute;

    if (color) {
      if (colorPerVertex === true) {
        if (colorIndex && colorIndex.length > 0) {
          // if the colorIndex field is not empty, then it is used to choose colors for each vertex of the IndexedFaceSet.

          const triangulatedColorIndex = triangulateFaceIndex(colorIndex, ccw);
          colorAttribute = computeAttributeFromIndexedData(triangulatedCoordIndex, triangulatedColorIndex, color, 3);
        } else {
          // if the colorIndex field is empty, then the coordIndex field is used to choose colors from the Color node

          colorAttribute = toNonIndexedAttribute(triangulatedCoordIndex, new Float32BufferAttribute(color, 3));
        }
      } else {
        if (colorIndex && colorIndex.length > 0) {
          // if the colorIndex field is not empty, then they are used to choose one color for each face of the IndexedFaceSet

          const flattenFaceColors = flattenData(color, colorIndex);
          const triangulatedFaceColors = triangulateFaceData(flattenFaceColors, coordIndex);
          colorAttribute = computeAttributeFromFaceData(triangulatedCoordIndex, triangulatedFaceColors);
        } else {
          // if the colorIndex field is empty, then the color are applied to each face of the IndexedFaceSet in order

          const triangulatedFaceColors = triangulateFaceData(color, coordIndex);
          colorAttribute = computeAttributeFromFaceData(triangulatedCoordIndex, triangulatedFaceColors);
        }
      }

      convertColorsToLinearSRGB(colorAttribute);
    }

    if (normal) {
      if (normalPerVertex === true) {
        // consider vertex normals

        if (normalIndex && normalIndex.length > 0) {
          // if the normalIndex field is not empty, then it is used to choose normals for each vertex of the IndexedFaceSet.

          const triangulatedNormalIndex = triangulateFaceIndex(normalIndex, ccw);
          normalAttribute = computeAttributeFromIndexedData(triangulatedCoordIndex, triangulatedNormalIndex, normal, 3);
        } else {
          // if the normalIndex field is empty, then the coordIndex field is used to choose normals from the Normal node

          normalAttribute = toNonIndexedAttribute(triangulatedCoordIndex, new Float32BufferAttribute(normal, 3));
        }
      } else {
        // consider face normals

        if (normalIndex && normalIndex.length > 0) {
          // if the normalIndex field is not empty, then they are used to choose one normal for each face of the IndexedFaceSet

          const flattenFaceNormals = flattenData(normal, normalIndex);
          const triangulatedFaceNormals = triangulateFaceData(flattenFaceNormals, coordIndex);
          normalAttribute = computeAttributeFromFaceData(triangulatedCoordIndex, triangulatedFaceNormals);
        } else {
          // if the normalIndex field is empty, then the normals are applied to each face of the IndexedFaceSet in order

          const triangulatedFaceNormals = triangulateFaceData(normal, coordIndex);
          normalAttribute = computeAttributeFromFaceData(triangulatedCoordIndex, triangulatedFaceNormals);
        }
      }
    } else {
      // if the normal field is NULL, then the loader should automatically generate normals, using creaseAngle to determine if and how normals are smoothed across shared vertices

      normalAttribute = computeNormalAttribute(triangulatedCoordIndex, coord, creaseAngle);
    }

    if (texCoord) {
      // texture coordinates are always defined on vertex level

      if (texCoordIndex && texCoordIndex.length > 0) {
        // if the texCoordIndex field is not empty, then it is used to choose texture coordinates for each vertex of the IndexedFaceSet.

        const triangulatedTexCoordIndex = triangulateFaceIndex(texCoordIndex, ccw);
        uvAttribute = computeAttributeFromIndexedData(triangulatedCoordIndex, triangulatedTexCoordIndex, texCoord, 2);
      } else {
        // if the texCoordIndex field is empty, then the coordIndex array is used to choose texture coordinates from the TextureCoordinate node

        uvAttribute = toNonIndexedAttribute(triangulatedCoordIndex, new Float32BufferAttribute(texCoord, 2));
      }
    }

    const geometry: VRMLGeometry = new BufferGeometry();
    const positionAttribute = toNonIndexedAttribute(triangulatedCoordIndex, new Float32BufferAttribute(coord, 3));

    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("normal", normalAttribute);

    // optional attributes

    if (colorAttribute) geometry.setAttribute("color", colorAttribute);
    if (uvAttribute) geometry.setAttribute("uv", uvAttribute);

    // "solid" influences the material so let's store it for later use

    geometry._solid = solid;
    geometry._type = "mesh";

    return geometry;
  }

  function buildIndexedLineSetNode(node: VRMLNode): VRMLGeometry {
    let color: number[] | undefined, coord!: number[];
    let colorIndex!: number[], coordIndex!: number[];
    let colorPerVertex = true;

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValues = field.values as number[];

      switch (fieldName) {
        case "color":
          const colorNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (colorNode !== null) {
            color = getNode(colorNode) as number[];
          }

          break;

        case "coord":
          const coordNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (coordNode !== null) {
            coord = getNode(coordNode) as number[];
          }

          break;

        case "colorIndex":
          colorIndex = fieldValues;
          break;

        case "colorPerVertex":
          colorPerVertex = field.values[0] as boolean;
          break;

        case "coordIndex":
          coordIndex = fieldValues;
          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    // build lines

    let colorAttribute;

    const expandedLineIndex = expandLineIndex(coordIndex); // create an index for three.js's linesegment primitive

    if (color) {
      if (colorPerVertex === true) {
        if (colorIndex.length > 0) {
          // if the colorIndex field is not empty, then one color is used for each polyline of the IndexedLineSet.

          const expandedColorIndex = expandLineIndex(colorIndex); // compute colors for each line segment (rendering primitive)
          colorAttribute = computeAttributeFromIndexedData(expandedLineIndex, expandedColorIndex, color, 3); // compute data on vertex level
        } else {
          // if the colorIndex field is empty, then the colors are applied to each polyline of the IndexedLineSet in order.

          colorAttribute = toNonIndexedAttribute(expandedLineIndex, new Float32BufferAttribute(color, 3));
        }
      } else {
        if (colorIndex.length > 0) {
          // if the colorIndex field is not empty, then colors are applied to each vertex of the IndexedLineSet

          const flattenLineColors = flattenData(color, colorIndex); // compute colors for each VRML primitive
          const expandedLineColors = expandLineData(flattenLineColors, coordIndex); // compute colors for each line segment (rendering primitive)
          colorAttribute = computeAttributeFromLineData(expandedLineIndex, expandedLineColors); // compute data on vertex level
        } else {
          // if the colorIndex field is empty, then the coordIndex field is used to choose colors from the Color node

          const expandedLineColors = expandLineData(color, coordIndex); // compute colors for each line segment (rendering primitive)
          colorAttribute = computeAttributeFromLineData(expandedLineIndex, expandedLineColors); // compute data on vertex level
        }
      }

      convertColorsToLinearSRGB(colorAttribute);
    }

    //

    const geometry: VRMLGeometry = new BufferGeometry();

    const positionAttribute = toNonIndexedAttribute(expandedLineIndex, new Float32BufferAttribute(coord, 3));
    geometry.setAttribute("position", positionAttribute);

    if (colorAttribute) geometry.setAttribute("color", colorAttribute);

    geometry._type = "line";

    return geometry;
  }

  function buildPointSetNode(node: VRMLNode): VRMLGeometry {
    let color: number[] | undefined, coord!: number[];

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;

      switch (fieldName) {
        case "color":
          const colorNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (colorNode !== null) {
            color = getNode(colorNode) as number[];
          }

          break;

        case "coord":
          const coordNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (coordNode !== null) {
            coord = getNode(coordNode) as number[];
          }

          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    const geometry: VRMLGeometry = new BufferGeometry();

    geometry.setAttribute("position", new Float32BufferAttribute(coord, 3));

    if (color) {
      const colorAttribute = new Float32BufferAttribute(color, 3);
      convertColorsToLinearSRGB(colorAttribute);

      geometry.setAttribute("color", colorAttribute);
    }

    geometry._type = "points";

    return geometry;
  }

  function buildBoxNode(node: VRMLNode): VRMLGeometry {
    const size = new Vector3(2, 2, 2);

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValues = field.values as number[];

      switch (fieldName) {
        case "size":
          size.x = fieldValues[0];
          size.y = fieldValues[1];
          size.z = fieldValues[2];
          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    const geometry = new BoxGeometry(size.x, size.y, size.z);

    return geometry;
  }

  function buildConeNode(node: VRMLNode): VRMLGeometry {
    let radius = 1,
      height = 2,
      openEnded = false;

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValues = field.values as number[];

      switch (fieldName) {
        case "bottom":
          openEnded = !(field.values[0] as boolean);
          break;

        case "bottomRadius":
          radius = fieldValues[0];
          break;

        case "height":
          height = fieldValues[0];
          break;

        case "side":
          // field not supported
          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    const geometry = new ConeGeometry(radius, height, 16, 1, openEnded);

    return geometry;
  }

  function buildCylinderNode(node: VRMLNode): VRMLGeometry {
    let radius = 1,
      height = 2;

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValues = field.values as number[];

      switch (fieldName) {
        case "bottom":
          // field not supported
          break;

        case "radius":
          radius = fieldValues[0];
          break;

        case "height":
          height = fieldValues[0];
          break;

        case "side":
          // field not supported
          break;

        case "top":
          // field not supported
          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    const geometry = new CylinderGeometry(radius, radius, height, 16, 1);

    return geometry;
  }

  function buildSphereNode(node: VRMLNode): VRMLGeometry {
    let radius = 1;

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValues = field.values as number[];

      switch (fieldName) {
        case "radius":
          radius = fieldValues[0];
          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    const geometry = new SphereGeometry(radius, 16, 16);

    return geometry;
  }

  function buildElevationGridNode(node: VRMLNode): VRMLGeometry {
    let color: number[] | undefined;
    let normal: number[] | undefined;
    let texCoord: number[] | undefined;
    let height!: number[];

    let colorPerVertex = true;
    let normalPerVertex = true;
    let solid = true;
    let ccw = true;
    let creaseAngle = 0;
    let xDimension = 2;
    let zDimension = 2;
    let xSpacing = 1;
    let zSpacing = 1;

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValues = field.values as number[];

      switch (fieldName) {
        case "color":
          const colorNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (colorNode !== null) {
            color = getNode(colorNode) as number[];
          }

          break;

        case "normal":
          const normalNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (normalNode !== null) {
            normal = getNode(normalNode) as number[];
          }

          break;

        case "texCoord":
          const texCoordNode = field.values[0] as VRMLNode | VRMLUse | null;

          if (texCoordNode !== null) {
            texCoord = getNode(texCoordNode) as number[];
          }

          break;

        case "height":
          height = fieldValues;
          break;

        case "ccw":
          ccw = field.values[0] as boolean;
          break;

        case "colorPerVertex":
          colorPerVertex = field.values[0] as boolean;
          break;

        case "creaseAngle":
          creaseAngle = fieldValues[0];
          break;

        case "normalPerVertex":
          normalPerVertex = field.values[0] as boolean;
          break;

        case "solid":
          solid = field.values[0] as boolean;
          break;

        case "xDimension":
          xDimension = fieldValues[0];
          break;

        case "xSpacing":
          xSpacing = fieldValues[0];
          break;

        case "zDimension":
          zDimension = fieldValues[0];
          break;

        case "zSpacing":
          zSpacing = fieldValues[0];
          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    // vertex data

    const vertices = [];
    const normals = [];
    const colors = [];
    const uvs = [];

    for (let i = 0; i < zDimension; i++) {
      for (let j = 0; j < xDimension; j++) {
        // compute a row major index

        const index = i * xDimension + j;

        // vertices

        const x = xSpacing * i;
        const y = height[index];
        const z = zSpacing * j;

        vertices.push(x, y, z);

        // colors

        if (color && colorPerVertex === true) {
          const r = color[index * 3 + 0];
          const g = color[index * 3 + 1];
          const b = color[index * 3 + 2];

          colors.push(r, g, b);
        }

        // normals

        if (normal && normalPerVertex === true) {
          const xn = normal[index * 3 + 0];
          const yn = normal[index * 3 + 1];
          const zn = normal[index * 3 + 2];

          normals.push(xn, yn, zn);
        }

        // uvs

        if (texCoord) {
          const s = texCoord[index * 2 + 0];
          const t = texCoord[index * 2 + 1];

          uvs.push(s, t);
        } else {
          uvs.push(i / (xDimension - 1), j / (zDimension - 1));
        }
      }
    }

    // indices

    const indices = [];

    for (let i = 0; i < xDimension - 1; i++) {
      for (let j = 0; j < zDimension - 1; j++) {
        // from https://tecfa.unige.ch/guides/vrml/vrml97/spec/part1/nodesRef.html#ElevationGrid

        const a = i + j * xDimension;
        const b = i + (j + 1) * xDimension;
        const c = i + 1 + (j + 1) * xDimension;
        const d = i + 1 + j * xDimension;

        // faces

        if (ccw === true) {
          indices.push(a, c, b);
          indices.push(c, a, d);
        } else {
          indices.push(a, b, c);
          indices.push(c, d, a);
        }
      }
    }

    //

    const positionAttribute = toNonIndexedAttribute(indices, new Float32BufferAttribute(vertices, 3));
    const uvAttribute = toNonIndexedAttribute(indices, new Float32BufferAttribute(uvs, 2));
    let colorAttribute;
    let normalAttribute;

    // color attribute

    if (color) {
      if (colorPerVertex === false) {
        for (let i = 0; i < xDimension - 1; i++) {
          for (let j = 0; j < zDimension - 1; j++) {
            const index = i + j * (xDimension - 1);

            const r = color[index * 3 + 0];
            const g = color[index * 3 + 1];
            const b = color[index * 3 + 2];

            // one color per quad

            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
          }
        }

        colorAttribute = new Float32BufferAttribute(colors, 3);
      } else {
        colorAttribute = toNonIndexedAttribute(indices, new Float32BufferAttribute(colors, 3));
      }

      convertColorsToLinearSRGB(colorAttribute);
    }

    // normal attribute

    if (normal) {
      if (normalPerVertex === false) {
        for (let i = 0; i < xDimension - 1; i++) {
          for (let j = 0; j < zDimension - 1; j++) {
            const index = i + j * (xDimension - 1);

            const xn = normal[index * 3 + 0];
            const yn = normal[index * 3 + 1];
            const zn = normal[index * 3 + 2];

            // one normal per quad

            normals.push(xn, yn, zn);
            normals.push(xn, yn, zn);
            normals.push(xn, yn, zn);
            normals.push(xn, yn, zn);
            normals.push(xn, yn, zn);
            normals.push(xn, yn, zn);
          }
        }

        normalAttribute = new Float32BufferAttribute(normals, 3);
      } else {
        normalAttribute = toNonIndexedAttribute(indices, new Float32BufferAttribute(normals, 3));
      }
    } else {
      normalAttribute = computeNormalAttribute(indices, vertices, creaseAngle);
    }

    // build geometry

    const geometry: VRMLGeometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("normal", normalAttribute);
    geometry.setAttribute("uv", uvAttribute);

    if (colorAttribute) geometry.setAttribute("color", colorAttribute);

    // "solid" influences the material so let's store it for later use

    geometry._solid = solid;
    geometry._type = "mesh";

    return geometry;
  }

  function buildExtrusionNode(node: VRMLNode): VRMLGeometry {
    let crossSection = [1, 1, 1, -1, -1, -1, -1, 1, 1, 1];
    let spine = [0, 0, 0, 0, 1, 0];
    let scale: number[] | undefined;
    let orientation: number[] | undefined;

    let beginCap = true;
    let ccw = true;
    let creaseAngle = 0;
    let endCap = true;
    let solid = true;

    const fields = node.fields;

    for (let i = 0, l = fields.length; i < l; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValues = field.values as number[];

      switch (fieldName) {
        case "beginCap":
          beginCap = field.values[0] as boolean;
          break;

        case "ccw":
          ccw = field.values[0] as boolean;
          break;

        case "convex":
          // field not supported
          break;

        case "creaseAngle":
          creaseAngle = fieldValues[0];
          break;

        case "crossSection":
          crossSection = fieldValues;
          break;

        case "endCap":
          endCap = field.values[0] as boolean;
          break;

        case "orientation":
          orientation = fieldValues;
          break;

        case "scale":
          scale = fieldValues;
          break;

        case "solid":
          solid = field.values[0] as boolean;
          break;

        case "spine":
          spine = fieldValues; // only extrusion along the Y-axis are supported so far
          break;

        default:
          console.warn("THREE.VRMLLoader: Unknown field:", fieldName);
          break;
      }
    }

    const crossSectionClosed =
      crossSection[0] === crossSection[crossSection.length - 2] &&
      crossSection[1] === crossSection[crossSection.length - 1];

    // vertices

    const vertices = [];
    const spineVector = new Vector3();
    const scaling = new Vector3();

    const axis = new Vector3();
    const vertex = new Vector3();
    const quaternion = new Quaternion();

    for (let i = 0, j = 0, o = 0, il = spine.length; i < il; i += 3, j += 2, o += 4) {
      spineVector.fromArray(spine, i);

      scaling.x = scale ? scale[j + 0] : 1;
      scaling.y = 1;
      scaling.z = scale ? scale[j + 1] : 1;

      axis.x = orientation ? orientation[o + 0] : 0;
      axis.y = orientation ? orientation[o + 1] : 0;
      axis.z = orientation ? orientation[o + 2] : 1;
      const angle = orientation ? orientation[o + 3] : 0;

      for (let k = 0, kl = crossSection.length; k < kl; k += 2) {
        vertex.x = crossSection[k + 0];
        vertex.y = 0;
        vertex.z = crossSection[k + 1];

        // scale

        vertex.multiply(scaling);

        // rotate

        quaternion.setFromAxisAngle(axis, angle);
        vertex.applyQuaternion(quaternion);

        // translate

        vertex.add(spineVector);

        vertices.push(vertex.x, vertex.y, vertex.z);
      }
    }

    // indices

    const indices = [];

    const spineCount = spine.length / 3;
    const crossSectionCount = crossSection.length / 2;

    for (let i = 0; i < spineCount - 1; i++) {
      for (let j = 0; j < crossSectionCount - 1; j++) {
        const a = j + i * crossSectionCount;
        let b = j + 1 + i * crossSectionCount;
        const c = j + (i + 1) * crossSectionCount;
        let d = j + 1 + (i + 1) * crossSectionCount;

        if (j === crossSectionCount - 2 && crossSectionClosed === true) {
          b = i * crossSectionCount;
          d = (i + 1) * crossSectionCount;
        }

        if (ccw === true) {
          indices.push(a, b, c);
          indices.push(c, b, d);
        } else {
          indices.push(a, c, b);
          indices.push(c, d, b);
        }
      }
    }

    // triangulate cap

    if (beginCap === true || endCap === true) {
      const contour = [];

      for (let i = 0, l = crossSection.length; i < l; i += 2) {
        contour.push(new Vector2(crossSection[i], crossSection[i + 1]));
      }

      const faces = ShapeUtils.triangulateShape(contour, []);
      const capIndices = [];

      for (let i = 0, l = faces.length; i < l; i++) {
        const face = faces[i];

        capIndices.push(face[0], face[1], face[2]);
      }

      // begin cap

      if (beginCap === true) {
        for (let i = 0, l = capIndices.length; i < l; i += 3) {
          if (ccw === true) {
            indices.push(capIndices[i + 0], capIndices[i + 1], capIndices[i + 2]);
          } else {
            indices.push(capIndices[i + 0], capIndices[i + 2], capIndices[i + 1]);
          }
        }
      }

      // end cap

      if (endCap === true) {
        const indexOffset = crossSectionCount * (spineCount - 1); // references to the first vertex of the last cross section

        for (let i = 0, l = capIndices.length; i < l; i += 3) {
          if (ccw === true) {
            indices.push(
              indexOffset + capIndices[i + 0],
              indexOffset + capIndices[i + 2],
              indexOffset + capIndices[i + 1],
            );
          } else {
            indices.push(
              indexOffset + capIndices[i + 0],
              indexOffset + capIndices[i + 1],
              indexOffset + capIndices[i + 2],
            );
          }
        }
      }
    }

    const positionAttribute = toNonIndexedAttribute(indices, new Float32BufferAttribute(vertices, 3));
    const normalAttribute = computeNormalAttribute(indices, vertices, creaseAngle);

    const geometry: VRMLGeometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("normal", normalAttribute);
    // no uvs yet

    // "solid" influences the material so let's store it for later use

    geometry._solid = solid;
    geometry._type = "mesh";

    return geometry;
  }

  switch (node.name) {
    case "IndexedFaceSet":
      return buildIndexedFaceSetNode(node);
    case "IndexedLineSet":
      return buildIndexedLineSetNode(node);
    case "PointSet":
      return buildPointSetNode(node);
    case "Box":
      return buildBoxNode(node);
    case "Cone":
      return buildConeNode(node);
    case "Cylinder":
      return buildCylinderNode(node);
    case "Sphere":
      return buildSphereNode(node);
    case "ElevationGrid":
      return buildElevationGridNode(node);
    case "Extrusion":
      return buildExtrusionNode(node);
    default:
      return undefined;
  }
}

function triangulateFaceIndex(index: number[], ccw: boolean) {
  const indices = [];

  // since face definitions can have more than three vertices, it's necessary to
  // perform a simple triangulation

  let start = 0;

  for (let i = 0, l = index.length; i < l; i++) {
    const i1 = index[start];
    const i2 = index[i + (ccw ? 1 : 2)];
    const i3 = index[i + (ccw ? 2 : 1)];

    indices.push(i1, i2, i3);

    // an index of -1 indicates that the current face has ended and the next one begins

    if (index[i + 3] === -1 || i + 3 >= l) {
      i += 3;
      start = i + 1;
    }
  }

  return indices;
}

function triangulateFaceData(data: number[], index: number[]) {
  const triangulatedData = [];

  let start = 0;

  for (let i = 0, l = index.length; i < l; i++) {
    const stride = start * 3;

    const x = data[stride];
    const y = data[stride + 1];
    const z = data[stride + 2];

    triangulatedData.push(x, y, z);

    // an index of -1 indicates that the current face has ended and the next one begins

    if (index[i + 3] === -1 || i + 3 >= l) {
      i += 3;
      start++;
    }
  }

  return triangulatedData;
}

function flattenData(data: number[], index: number[]) {
  const flattenData = [];

  for (let i = 0, l = index.length; i < l; i++) {
    const i1 = index[i];

    const stride = i1 * 3;

    const x = data[stride];
    const y = data[stride + 1];
    const z = data[stride + 2];

    flattenData.push(x, y, z);
  }

  return flattenData;
}

function expandLineIndex(index: number[]) {
  const indices = [];

  for (let i = 0, l = index.length; i < l; i++) {
    const i1 = index[i];
    const i2 = index[i + 1];

    indices.push(i1, i2);

    // an index of -1 indicates that the current line has ended and the next one begins

    if (index[i + 2] === -1 || i + 2 >= l) {
      i += 2;
    }
  }

  return indices;
}

function expandLineData(data: number[], index: number[]) {
  const triangulatedData = [];

  let start = 0;

  for (let i = 0, l = index.length; i < l; i++) {
    const stride = start * 3;

    const x = data[stride];
    const y = data[stride + 1];
    const z = data[stride + 2];

    triangulatedData.push(x, y, z);

    // an index of -1 indicates that the current line has ended and the next one begins

    if (index[i + 2] === -1 || i + 2 >= l) {
      i += 2;
      start++;
    }
  }

  return triangulatedData;
}

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();

const uvA = new Vector2();
const uvB = new Vector2();
const uvC = new Vector2();

function computeAttributeFromIndexedData(coordIndex: number[], index: number[], data: number[], itemSize: number) {
  const array = [];

  // we use the coordIndex.length as delimiter since normalIndex must contain at least as many indices

  for (let i = 0, l = coordIndex.length; i < l; i += 3) {
    const a = index[i];
    const b = index[i + 1];
    const c = index[i + 2];

    if (itemSize === 2) {
      uvA.fromArray(data, a * itemSize);
      uvB.fromArray(data, b * itemSize);
      uvC.fromArray(data, c * itemSize);

      array.push(uvA.x, uvA.y);
      array.push(uvB.x, uvB.y);
      array.push(uvC.x, uvC.y);
    } else {
      vA.fromArray(data, a * itemSize);
      vB.fromArray(data, b * itemSize);
      vC.fromArray(data, c * itemSize);

      array.push(vA.x, vA.y, vA.z);
      array.push(vB.x, vB.y, vB.z);
      array.push(vC.x, vC.y, vC.z);
    }
  }

  return new Float32BufferAttribute(array, itemSize);
}

function computeAttributeFromFaceData(index: number[], faceData: number[]) {
  const array = [];

  for (let i = 0, j = 0, l = index.length; i < l; i += 3, j++) {
    vA.fromArray(faceData, j * 3);

    array.push(vA.x, vA.y, vA.z);
    array.push(vA.x, vA.y, vA.z);
    array.push(vA.x, vA.y, vA.z);
  }

  return new Float32BufferAttribute(array, 3);
}

function computeAttributeFromLineData(index: number[], lineData: number[]) {
  const array = [];

  for (let i = 0, j = 0, l = index.length; i < l; i += 2, j++) {
    vA.fromArray(lineData, j * 3);

    array.push(vA.x, vA.y, vA.z);
    array.push(vA.x, vA.y, vA.z);
  }

  return new Float32BufferAttribute(array, 3);
}

function toNonIndexedAttribute(indices: number[], attribute: BufferAttribute) {
  const array = attribute.array;
  const itemSize = attribute.itemSize;

  const array2 = new Float32Array(indices.length * itemSize);

  let index = 0,
    index2 = 0;

  for (let i = 0, l = indices.length; i < l; i++) {
    index = indices[i] * itemSize;

    for (let j = 0; j < itemSize; j++) {
      array2[index2++] = array[index++];
    }
  }

  return new Float32BufferAttribute(array2, itemSize);
}

const ab = new Vector3();
const cb = new Vector3();

function computeNormalAttribute(index: number[], coord: number[], creaseAngle: number) {
  const faces = [];
  const vertexNormals: Record<number, Vector3[]> = {};

  // prepare face and raw vertex normals

  for (let i = 0, l = index.length; i < l; i += 3) {
    const a = index[i];
    const b = index[i + 1];
    const c = index[i + 2];

    const face = new Face(a, b, c);

    vA.fromArray(coord, a * 3);
    vB.fromArray(coord, b * 3);
    vC.fromArray(coord, c * 3);

    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab);

    cb.normalize();

    face.normal.copy(cb);

    if (vertexNormals[a] === undefined) vertexNormals[a] = [];
    if (vertexNormals[b] === undefined) vertexNormals[b] = [];
    if (vertexNormals[c] === undefined) vertexNormals[c] = [];

    vertexNormals[a].push(face.normal);
    vertexNormals[b].push(face.normal);
    vertexNormals[c].push(face.normal);

    faces.push(face);
  }

  // compute vertex normals and build final geometry

  const normals = [];

  for (let i = 0, l = faces.length; i < l; i++) {
    const face = faces[i];

    const nA = weightedNormal(vertexNormals[face.a], face.normal, creaseAngle);
    const nB = weightedNormal(vertexNormals[face.b], face.normal, creaseAngle);
    const nC = weightedNormal(vertexNormals[face.c], face.normal, creaseAngle);

    vA.fromArray(coord, face.a * 3);
    vB.fromArray(coord, face.b * 3);
    vC.fromArray(coord, face.c * 3);

    normals.push(nA.x, nA.y, nA.z);
    normals.push(nB.x, nB.y, nB.z);
    normals.push(nC.x, nC.y, nC.z);
  }

  return new Float32BufferAttribute(normals, 3);
}

function weightedNormal(normals: Vector3[], vector: Vector3, creaseAngle: number) {
  const normal = new Vector3();

  if (creaseAngle === 0) {
    normal.copy(vector);
  } else {
    for (let i = 0, l = normals.length; i < l; i++) {
      if (normals[i].angleTo(vector) < creaseAngle) {
        normal.add(normals[i]);
      }
    }
  }

  return normal.normalize();
}

export function toColorArray(colors: number[]) {
  const array = [];

  for (let i = 0, l = colors.length; i < l; i += 3) {
    array.push(new Color(colors[i], colors[i + 1], colors[i + 2]));
  }

  return array;
}

function convertColorsToLinearSRGB(attribute: BufferAttribute) {
  const color = new Color();

  for (let i = 0; i < attribute.count; i++) {
    color.fromBufferAttribute(attribute, i);

    ColorManagement.colorSpaceToWorking(color, SRGBColorSpace);

    attribute.setXYZ(i, color.r, color.g, color.b);
  }
}

/**
 * Vertically paints the faces interpolating between the
 * specified colors at the specified angels. This is used for the Background
 * node, but could be applied to other nodes with multiple faces as well.
 *
 * When used with the Background node, default is directionIsDown is true if
 * interpolating the skyColor down from the Zenith. When interpolating up from
 * the Nadir i.e. interpolating the groundColor, the directionIsDown is false.
 *
 * The first angle is never specified, it is the Zenith (0 rad). Angles are specified
 * in radians. The geometry is thought a sphere, but could be anything. The color interpolation
 * is linear along the Y axis in any case.
 *
 * You must specify one more color than you have angles at the beginning of the colors array.
 * This is the color of the Zenith (the top of the shape).
 *
 * @param geometry
 * @param radius
 * @param angles
 * @param colors
 * @param topDown - Whether to work top down or bottom up.
 */
export function paintFaces(
  geometry: BufferGeometry,
  radius: number,
  angles: number[],
  colors: Color[],
  topDown: boolean,
) {
  // compute threshold values

  const thresholds = [];
  const startAngle = topDown === true ? 0 : Math.PI;

  for (let i = 0, l = colors.length; i < l; i++) {
    let angle = i === 0 ? 0 : angles[i - 1];
    angle = topDown === true ? angle : startAngle - angle;

    const point = new Vector3();
    point.setFromSphericalCoords(radius, angle, 0);

    thresholds.push(point);
  }

  // generate vertex colors

  const indices = geometry.index!;
  const positionAttribute = geometry.attributes.position as BufferAttribute;
  const colorAttribute = new BufferAttribute(new Float32Array(positionAttribute.count * 3), 3);

  const position = new Vector3();
  const color = new Color();

  for (let i = 0; i < indices.count; i++) {
    const index = indices.getX(i);
    position.fromBufferAttribute(positionAttribute, index);

    let thresholdIndexA!: number, thresholdIndexB!: number;
    let t = 1;

    for (let j = 1; j < thresholds.length; j++) {
      thresholdIndexA = j - 1;
      thresholdIndexB = j;

      const thresholdA = thresholds[thresholdIndexA];
      const thresholdB = thresholds[thresholdIndexB];

      if (topDown === true) {
        // interpolation for sky color

        if (position.y <= thresholdA.y && position.y > thresholdB.y) {
          t = Math.abs(thresholdA.y - position.y) / Math.abs(thresholdA.y - thresholdB.y);

          break;
        }
      } else {
        // interpolation for ground color

        if (position.y >= thresholdA.y && position.y < thresholdB.y) {
          t = Math.abs(thresholdA.y - position.y) / Math.abs(thresholdA.y - thresholdB.y);

          break;
        }
      }
    }

    const colorA = colors[thresholdIndexA];
    const colorB = colors[thresholdIndexB];

    color.copy(colorA).lerp(colorB, t);

    ColorManagement.colorSpaceToWorking(color, SRGBColorSpace);

    colorAttribute.setXYZ(index, color.r, color.g, color.b);
  }

  geometry.setAttribute("color", colorAttribute);
}

class Face {
  a: number;
  b: number;
  c: number;
  normal: Vector3;
  constructor(a: number, b: number, c: number) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.normal = new Vector3();
  }
}
