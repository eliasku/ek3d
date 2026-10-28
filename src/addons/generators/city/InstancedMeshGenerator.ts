import type { BufferGeometry } from "../../../core/BufferGeometry";
import type { Material } from "../../../materials/Material";
import type { Matrix4 } from "../../../math/Matrix4";
import { ceilPowerOfTwo } from "../../../math/MathUtils";
import { InstancedMesh } from "../../../objects/InstancedMesh";

/** Shared lifecycle for street furniture with one geometry and material. */
export class InstancedMeshGenerator<P extends object> {
  parameters: P;
  geometry: BufferGeometry | null = null;
  material: Material | null = null;
  mesh: InstancedMesh | null = null;
  private _createGeometry: (parameters: P) => BufferGeometry;
  private _createMaterial: () => Material;
  private _name: string;
  private _receiveShadow: boolean;
  private _parametersKey: string | null = null;

  constructor(
    parameters: Partial<P>,
    createGeometry: (parameters: P) => BufferGeometry,
    createMaterial: () => Material,
    name: string,
    receiveShadow = true,
  ) {
    const defaults = (this.constructor as typeof InstancedMeshGenerator & { defaults: P }).defaults;
    this.parameters = Object.assign({}, defaults, parameters);
    this._createGeometry = createGeometry;
    this._createMaterial = createMaterial;
    this._name = name;
    this._receiveShadow = receiveShadow;
  }

  build(placements: Matrix4[]): InstancedMesh {
    const parametersKey = JSON.stringify(this.parameters);
    if (parametersKey !== this._parametersKey || (this.mesh && placements.length > this.mesh.instanceMatrix.count)) {
      this.dispose();
      this._parametersKey = parametersKey;
    }
    if (this.geometry === null) this.geometry = this._createGeometry(this.parameters);
    if (this.material === null) this.material = this._createMaterial();
    if (this.mesh === null) {
      this.mesh = createInstances(this.geometry, this.material, placements.length, this._name);
      this.mesh.receiveShadow = this._receiveShadow;
    }
    updateInstances(this.mesh, placements);
    return this.mesh;
  }

  dispose(): void {
    this.geometry?.dispose();
    this.mesh?.dispose();
    this.material?.dispose();
    this.geometry = null;
    this.material = null;
    this.mesh = null;
  }
}

export function createInstances(
  geometry: BufferGeometry,
  material: Material,
  count: number,
  name: string,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, ceilPowerOfTwo(Math.max(1, count)));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function updateInstances(mesh: InstancedMesh, placements: Matrix4[]): void {
  mesh.count = placements.length;
  mesh.visible = placements.length > 0;
  for (let i = 0; i < placements.length; i++) mesh.setMatrixAt(i, placements[i]);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.boundingBox = null;
  mesh.computeBoundingSphere();
}
