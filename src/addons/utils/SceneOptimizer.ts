import { BufferAttribute } from "../../core/BufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import { Object3D } from "../../core/Object3D";
import type { Material } from "../../materials/Material";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { BatchedMesh } from "../../objects/BatchedMesh";
import { Group } from "../../objects/Group";
import { InstancedMesh } from "../../objects/InstancedMesh";
import { Mesh } from "../../objects/Mesh";
import { SkinnedMesh } from "../../objects/SkinnedMesh";
import type { Scene } from "../../scenes/Scene";
import { Texture } from "../../textures/Texture";

export interface SceneOptimizerOptions {
  debug?: boolean;
}
type ColorMaterial = Material & { color: Color };
interface BatchGroup {
  meshes: Mesh<ColorMaterial>[];
  geometryStats: Map<BufferGeometry, { vertices: number; indices: number; geometry: BufferGeometry }>;
  totalInstances: number;
  materialProps: ColorMaterial;
}
interface OptimizationStats {
  originalMeshes: number;
  batchedMeshes: number;
  singleMeshes: number;
  drawCalls: number;
  uniqueGeometries: number;
  reductionRatio: string;
}

/** Experimental destructive batching of compatible static meshes. Source geometries and materials are disposed. */
export class SceneOptimizer {
  scene: Scene;
  debug: boolean;

  constructor(scene: Scene, options: SceneOptimizerOptions = {}) {
    this.scene = scene;
    this.debug = options.debug || false;
  }

  _bufferToHash(buffer: ArrayBuffer | ArrayBufferView): number {
    const bytes = ArrayBuffer.isView(buffer)
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer);
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) hash = ((hash << 5) - hash + bytes[i]) | 0;
    return hash;
  }

  _getMaterialPropertiesHash(material: Material): string {
    const properties = material as unknown as Record<string, unknown>;
    const maps = [
      "map",
      "alphaMap",
      "aoMap",
      "bumpMap",
      "displacementMap",
      "emissiveMap",
      "envMap",
      "lightMap",
      "metalnessMap",
      "normalMap",
      "roughnessMap",
    ]
      .map((name) => {
        const map = properties[name];
        return map instanceof Texture
          ? `${map.uuid}_${map.offset.x}_${map.offset.y}_${map.repeat.x}_${map.repeat.y}_${map.rotation}`
          : 0;
      })
      .join("|");
    const physical = [
      "transparent",
      "opacity",
      "alphaTest",
      "alphaToCoverage",
      "side",
      "vertexColors",
      "visible",
      "blending",
      "wireframe",
      "flatShading",
      "premultipliedAlpha",
      "dithering",
      "toneMapped",
      "depthTest",
      "depthWrite",
      "metalness",
      "roughness",
      "clearcoat",
      "clearcoatRoughness",
      "sheen",
      "sheenRoughness",
      "transmission",
      "thickness",
      "attenuationDistance",
      "ior",
      "iridescence",
      "iridescenceIOR",
      "iridescenceThicknessMinimum",
      "iridescenceThicknessMaximum",
      "reflectivity",
    ]
      .map((name) => properties[name]?.toString() ?? 0)
      .join("|");
    const colors = ["emissive", "attenuationColor", "sheenColor"].map((name) => {
      const color = properties[name];
      return color instanceof Color ? color.getHexString() : 0;
    });
    return [material.type, physical, maps, ...colors].join("_");
  }

  _getAttributesSignature(geometry: BufferGeometry): string {
    return Object.keys(geometry.attributes)
      .sort()
      .map((name) => {
        const attribute = geometry.attributes[name];
        const storage =
          attribute instanceof BufferAttribute ? attribute.array.constructor.name : attribute.constructor.name;
        return `${name}_${attribute.itemSize}_${attribute.normalized}_${storage}_${geometry.index !== null}`;
      })
      .join("|");
  }

  _getGeometryHash(geometry: BufferGeometry): string {
    const index = geometry.index ? this._bufferToHash(geometry.index.array) : "noIndex";
    const position = geometry.attributes.position;
    if (!("array" in position)) throw new Error("SceneOptimizer: geometry needs CPU position data");
    return `${index}_${this._bufferToHash(position.array)}_${this._getAttributesSignature(geometry)}`;
  }

  _getBatchKey(materialProps: string, attributesSignature: string): string {
    return `${materialProps}_${attributesSignature}`;
  }

  _analyzeModel(): {
    batchGroups: Map<string, BatchGroup>;
    singleGroups: Map<string, BatchGroup>;
    uniqueGeometries: number;
  } {
    const batchGroups = new Map<string, BatchGroup>();
    const singleGroups = new Map<string, BatchGroup>();
    const uniqueGeometries = new Set<BufferGeometry>();
    this.scene.updateMatrixWorld(true);
    this.scene.traverse((node) => {
      // Batching cannot preserve skinning, morph animation, instance transforms or child attachments.
      if (
        !(node instanceof Mesh) ||
        node instanceof SkinnedMesh ||
        node instanceof InstancedMesh ||
        node instanceof BatchedMesh ||
        Array.isArray(node.material) ||
        node.children.length ||
        node.morphTargetInfluences ||
        !node.visible ||
        Object.values(node.geometry.attributes).some((attribute) => !(attribute instanceof BufferAttribute))
      )
        return;
      const material = node.material;
      if (!("color" in material) || !(material.color instanceof Color) || material instanceof ShaderMaterial) return;
      const key = this._getBatchKey(
        this._getMaterialPropertiesHash(material),
        this._getAttributesSignature(node.geometry),
      );
      // Keep render state and visibility inherited from parents distinct.
      const batchKey = `${key}_${node.parent?.uuid}_${node.castShadow}_${node.receiveShadow}_${node.renderOrder}_${node.layers.mask}_${node.frustumCulled}`;
      uniqueGeometries.add(node.geometry);
      let group = batchGroups.get(batchKey);
      if (!group) {
        group = { meshes: [], geometryStats: new Map(), totalInstances: 0, materialProps: material as ColorMaterial };
        batchGroups.set(batchKey, group);
      }
      group.meshes.push(node as Mesh<ColorMaterial>);
      group.totalInstances++;
      if (!group.geometryStats.has(node.geometry))
        group.geometryStats.set(node.geometry, {
          vertices: node.geometry.attributes.position.count,
          indices: node.geometry.index?.count ?? 0,
          geometry: node.geometry,
        });
    });
    for (const [key, group] of batchGroups) {
      if (group.totalInstances === 1) {
        singleGroups.set(key, group);
        batchGroups.delete(key);
      }
    }
    return { batchGroups, singleGroups, uniqueGeometries: uniqueGeometries.size };
  }

  _createBatchedMeshes(batchGroups: Map<string, BatchGroup>): Set<Mesh> {
    const meshesToRemove = new Set<Mesh>();
    const localMatrix = new Matrix4();
    for (const group of batchGroups.values()) {
      let vertices = 0,
        indices = 0;
      for (const stats of group.geometryStats.values()) {
        vertices += stats.vertices;
        indices += stats.indices;
      }
      const material = group.materialProps.clone();
      material.color.setRGB(1, 1, 1);
      const batchedMesh = new BatchedMesh(group.totalInstances, vertices, indices, material);
      const reference = group.meshes[0];
      batchedMesh.name = `${reference.name}_batch`;
      batchedMesh.castShadow = reference.castShadow;
      batchedMesh.receiveShadow = reference.receiveShadow;
      batchedMesh.renderOrder = reference.renderOrder;
      batchedMesh.layers.mask = reference.layers.mask;
      batchedMesh.frustumCulled = reference.frustumCulled;
      const inverseParentMatrix = new Matrix4();
      if (reference.parent) inverseParentMatrix.copy(reference.parent.matrixWorld).invert();
      const geometryIds = new Map<BufferGeometry, number>();
      for (const mesh of group.meshes) {
        let geometryId = geometryIds.get(mesh.geometry);
        if (geometryId === undefined) {
          geometryId = batchedMesh.addGeometry(mesh.geometry);
          geometryIds.set(mesh.geometry, geometryId);
        }
        const instanceId = batchedMesh.addInstance(geometryId);
        localMatrix.copy(mesh.matrixWorld).premultiply(inverseParentMatrix);
        batchedMesh.setMatrixAt(instanceId, localMatrix);
        batchedMesh.setColorAt(instanceId, mesh.material.color);
        meshesToRemove.add(mesh);
      }
      reference.parent?.add(batchedMesh);
    }
    return meshesToRemove;
  }

  removeEmptyNodes(object: Object3D): void {
    for (let i = 0; i < object.children.length;) {
      const child = object.children[i];
      this.removeEmptyNodes(child);
      if ((child instanceof Group || child.constructor === Object3D) && child.children.length === 0) {
        object.remove(child);
      } else {
        i++;
      }
    }
  }

  /** Removes meshes and disposes source resources not used by surviving meshes. */
  disposeMeshes(meshesToRemove: Set<Mesh>): void {
    const retained = new Set<BufferGeometry | Material>();
    this.scene.traverse((node) => {
      if (!(node instanceof Mesh) || meshesToRemove.has(node)) return;
      retained.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) retained.add(material);
    });
    const disposed = new Set<BufferGeometry | Material>();
    for (const mesh of meshesToRemove) {
      mesh.removeFromParent();
      const resources = [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])];
      for (const resource of resources) {
        if (!retained.has(resource) && !disposed.has(resource)) {
          resource.dispose();
          disposed.add(resource);
        }
      }
    }
  }

  _logDebugInfo(stats: OptimizationStats): void {
    console.group("Scene Optimization Results");
    console.log(`Original meshes: ${stats.originalMeshes}`);
    console.log(`Batched into: ${stats.batchedMeshes} BatchedMesh`);
    console.log(`Single meshes: ${stats.singleMeshes} Mesh`);
    console.log(`Total draw calls: ${stats.drawCalls}`);
    console.log(`Reduction Ratio: ${stats.reductionRatio}% fewer draw calls`);
    console.groupEnd();
  }

  /** Replaces compatible meshes with batches and returns the modified scene. */
  toBatchedMesh(): Scene {
    const { batchGroups, singleGroups, uniqueGeometries } = this._analyzeModel();
    const meshesToRemove = this._createBatchedMeshes(batchGroups);
    this.disposeMeshes(meshesToRemove);
    this.removeEmptyNodes(this.scene);
    if (this.debug) {
      const originalMeshes = meshesToRemove.size + singleGroups.size;
      const drawCalls = batchGroups.size + singleGroups.size;
      this._logDebugInfo({
        originalMeshes,
        batchedMeshes: batchGroups.size,
        singleMeshes: singleGroups.size,
        drawCalls,
        uniqueGeometries,
        reductionRatio: (originalMeshes ? (1 - drawCalls / originalMeshes) * 100 : 0).toFixed(1),
      });
    }
    return this.scene;
  }

  /** InstancedMesh optimization is unsupported, as in the pinned upstream implementation. */
  toInstancingMesh(): never {
    throw new Error("SceneOptimizer: InstancedMesh optimization not implemented yet");
  }
}
