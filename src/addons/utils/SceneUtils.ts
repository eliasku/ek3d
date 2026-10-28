import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import { InstancedBufferAttribute } from "../../core/InstancedBufferAttribute";
import type { Object3D } from "../../core/Object3D";
import type { Material } from "../../materials/Material";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Vector3 } from "../../math/Vector3";
import { Group } from "../../objects/Group";
import { InstancedMesh } from "../../objects/InstancedMesh";
import { Mesh } from "../../objects/Mesh";
import { SkinnedMesh } from "../../objects/SkinnedMesh";
import { deepCloneAttribute, mergeGroups } from "./BufferGeometryUtils";

const matrix = new Matrix4();
const color = new Color();

export function createMeshesFromInstancedMesh(instancedMesh: InstancedMesh): Group {
  const group = new Group();
  for (let i = 0; i < instancedMesh.count; i++) {
    const mesh = new Mesh(instancedMesh.geometry, instancedMesh.material);
    instancedMesh.getMatrixAt(i, mesh.matrix);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    group.add(mesh);
  }
  group.copy(instancedMesh);
  group.updateMatrixWorld();
  return group;
}

export function createMeshesFromMultiMaterialMesh(mesh: Mesh): Group | Mesh {
  if (!Array.isArray(mesh.material)) {
    console.warn("THREE.SceneUtils.createMeshesFromMultiMaterialMesh(): The given mesh has no multiple materials.");
    return mesh;
  }
  const object = new Group();
  object.copy(mesh);
  const geometry = mergeGroups(mesh.geometry);
  const index = geometry.index!;
  for (const group of geometry.groups) {
    const result = new BufferGeometry();
    for (const name of Object.keys(geometry.attributes)) {
      const attribute = geometry.attributes[name] as BufferAttribute | InterleavedBufferAttribute;
      const ArrayType = attribute.array.constructor as new (length: number) => BufferAttribute["array"];
      const output = new BufferAttribute(
        new ArrayType(group.count * attribute.itemSize),
        attribute.itemSize,
        attribute.normalized,
      );
      for (let k = group.start, n = 0; k < group.start + group.count; k++, n++) {
        const source = index.getX(k);
        if (attribute.itemSize >= 1) output.setX(n, attribute.getX(source));
        if (attribute.itemSize >= 2) output.setY(n, attribute.getY(source));
        if (attribute.itemSize >= 3) output.setZ(n, attribute.getZ(source));
        if (attribute.itemSize >= 4) output.setW(n, attribute.getW(source));
      }
      result.setAttribute(name, output);
    }
    object.add(new Mesh(result, mesh.material[group.materialIndex]));
  }
  return object;
}

export function createMultiMaterialObject(geometry: BufferGeometry, materials: Material[]): Group {
  const group = new Group();
  for (const material of materials) group.add(new Mesh(geometry, material));
  return group;
}

export function reduceVertices<T>(object: Object3D, func: (value: T, vertex: Vector3) => T, initialValue: T): T {
  let value = initialValue;
  const vertex = new Vector3();
  object.updateWorldMatrix(true, true);
  object.traverseVisible((child) => {
    const geometry = (child as Object3D & { geometry?: BufferGeometry }).geometry;
    const position = geometry?.attributes.position as BufferAttribute | InterleavedBufferAttribute | undefined;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      if (child instanceof Mesh) child.getVertexPosition(i, vertex);
      else vertex.fromBufferAttribute(position, i);
      if (!(child instanceof SkinnedMesh)) vertex.applyMatrix4(child.matrixWorld);
      value = func(value, vertex);
    }
  });
  return value;
}

export function sortInstancedMesh(mesh: InstancedMesh, compareFn: (a: number, b: number) => number): void {
  const matrices = deepCloneAttribute(mesh.instanceMatrix);
  const colors = mesh.instanceColor ? deepCloneAttribute(mesh.instanceColor) : null;
  const attributes = new Map<InstancedBufferAttribute, BufferAttribute>();
  for (const attribute of Object.values(mesh.geometry.attributes)) {
    if (attribute instanceof InstancedBufferAttribute) attributes.set(attribute, deepCloneAttribute(attribute));
  }
  const tokens = Array.from({ length: mesh.count }, (_, i) => i).sort(compareFn);
  for (let i = 0; i < tokens.length; i++) {
    const source = tokens[i];
    matrix.fromArray(matrices.array, source * mesh.instanceMatrix.itemSize);
    matrix.toArray(mesh.instanceMatrix.array, i * mesh.instanceMatrix.itemSize);
    if (mesh.instanceColor && colors) {
      color.fromArray(colors.array, source * mesh.instanceColor.itemSize);
      color.toArray(mesh.instanceColor.array, i * mesh.instanceColor.itemSize);
    }
    for (const [attribute, copy] of attributes) {
      attribute.setX(i, copy.getX(source));
      if (attribute.itemSize > 1) attribute.setY(i, copy.getY(source));
      if (attribute.itemSize > 2) attribute.setZ(i, copy.getZ(source));
      if (attribute.itemSize > 3) attribute.setW(i, copy.getW(source));
    }
  }
}

export function* traverseGenerator(object: Object3D): Generator<Object3D> {
  yield object;
  for (const child of object.children) yield* traverseGenerator(child);
}

export function* traverseVisibleGenerator(object: Object3D): Generator<Object3D> {
  if (!object.visible) return;
  yield object;
  for (const child of object.children) yield* traverseVisibleGenerator(child);
}

export function* traverseAncestorsGenerator(object: Object3D): Generator<Object3D> {
  if (object.parent !== null) {
    yield object.parent;
    yield* traverseAncestorsGenerator(object.parent);
  }
}
