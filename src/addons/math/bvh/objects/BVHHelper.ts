import { LineBasicMaterial } from "../../../../materials/LineBasicMaterial";
import { MeshBasicMaterial } from "../../../../materials/MeshBasicMaterial";
import { BufferAttribute } from "../../../../core/BufferAttribute";
import { BufferGeometry } from "../../../../core/BufferGeometry";
import { Object3D } from "../../../../core/Object3D";
import { Group } from "../../../../objects/Group";
import { BatchedMesh } from "../../../../objects/BatchedMesh";
import { InstancedMesh } from "../../../../objects/InstancedMesh";
import { Box3 } from "../../../../math/Box3";
import { Matrix4 } from "../../../../math/Matrix4";
import { Vector3 } from "../../../../math/Vector3";
import { GeometryBVH } from "../core/GeometryBVH";
import type { BVHGeometry, BVHBatchedMesh } from "../utils/ExtensionUtilities";
import { arrayToBox } from "../utils/ArrayBoxUtilities";

const boundingBox = /* @__PURE__ */ new Box3();
const matrix = /* @__PURE__ */ new Matrix4();
const vec = /* @__PURE__ */ new Vector3();

class BVHRootHelper extends Object3D {
  material: LineBasicMaterial | MeshBasicMaterial;
  geometry: BufferGeometry;
  depth: number;
  displayParents: boolean;
  bvh: GeometryBVH | null;
  displayEdges: boolean;
  _group: number;

  get isMesh() {
    return !this.displayEdges;
  }

  get isLineSegments() {
    return this.displayEdges;
  }

  get isLine() {
    return this.displayEdges;
  }

  getVertexPosition(index: number, target: Vector3) {
    return target.fromBufferAttribute(this.geometry.getAttribute("position") as BufferAttribute, index);
  }

  constructor(bvh: GeometryBVH | null, material: LineBasicMaterial | MeshBasicMaterial, depth = 10, group = 0) {
    super();

    this.material = material;
    this.geometry = new BufferGeometry();
    this.name = "BVHRootHelper";
    this.depth = depth;
    this.displayParents = false;
    this.bvh = bvh;
    this.displayEdges = true;
    this._group = group;
  }

  raycast() {}

  update() {
    const boundsTree = this.bvh;
    this.geometry.dispose();
    this.visible = false;
    if (boundsTree) {
      this.geometry = this.getGeometry(boundsTree);
      this.visible = true;
    }
  }

  getGeometry(boundsTree: GeometryBVH) {
    const group = this._group;

    // fill in the position buffer with the bounds corners
    let positionArray: Float32Array;
    if (group !== -1) {
      positionArray = this.getBVHBoundPositions(boundsTree, group);
    } else {
      const positionArrays = boundsTree._roots.map((r, i) => this.getBVHBoundPositions(boundsTree, i));
      const total = positionArrays.reduce((v, arr) => v + arr.length, 0);
      positionArray = new Float32Array(total);

      let offset = 0;
      positionArrays.forEach((arr) => {
        positionArray.set(arr, offset);
        offset += arr.length;
      });
    }

    const indexArray = this.getBVHBoundIndices(positionArray);

    // update the geometry
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indexArray, 1, false));
    geometry.setAttribute("position", new BufferAttribute(positionArray, 3, false));
    return geometry;
  }

  getBVHBoundIndices(positionArray: Float32Array) {
    const boundsCount = positionArray.length / (8 * 3);
    let indexArray;
    let indices;
    if (this.displayEdges) {
      // fill in the index buffer to point to the corner points
      indices = new Uint8Array([
        // x axis
        0, 4, 1, 5, 2, 6, 3, 7,

        // y axis
        0, 2, 1, 3, 4, 6, 5, 7,

        // z axis
        0, 1, 2, 3, 4, 5, 6, 7,
      ]);
    } else {
      indices = new Uint8Array([
        // X-, X+
        0, 1, 2, 2, 1, 3,

        4, 6, 5, 6, 7, 5,

        // Y-, Y+
        1, 4, 5, 0, 4, 1,

        2, 3, 6, 3, 7, 6,

        // Z-, Z+
        0, 2, 4, 2, 6, 4,

        1, 5, 3, 3, 5, 7,
      ]);
    }

    if (positionArray.length > 65535) {
      indexArray = new Uint32Array(indices.length * boundsCount);
    } else {
      indexArray = new Uint16Array(indices.length * boundsCount);
    }

    const indexLength = indices.length;
    for (let i = 0; i < boundsCount; i++) {
      const posOffset = i * 8;
      const indexOffset = i * indexLength;
      for (let j = 0; j < indexLength; j++) {
        indexArray[indexOffset + j] = posOffset + indices[j];
      }
    }

    return indexArray;
  }

  getBVHBoundPositions(bvh: GeometryBVH, group = 0, matrix: Matrix4 | null = null) {
    // count the number of bounds required
    const targetDepth = this.depth - 1;
    const displayParents = this.displayParents;
    let boundsCount = 0;
    bvh.traverse((depth, isLeaf) => {
      if (depth >= targetDepth || isLeaf) {
        boundsCount++;
        return true;
      } else if (displayParents) {
        boundsCount++;
      }
    }, group);

    // fill in the position buffer with the bounds corners
    let posIndex = 0;
    const positionArray = new Float32Array(8 * 3 * boundsCount);
    bvh.traverse((depth, isLeaf, boundingData) => {
      const terminate = depth >= targetDepth || isLeaf;
      if (terminate || displayParents) {
        arrayToBox(0, boundingData, boundingBox);

        const { min, max } = boundingBox;
        for (let x = -1; x <= 1; x += 2) {
          const xVal = x < 0 ? min.x : max.x;
          for (let y = -1; y <= 1; y += 2) {
            const yVal = y < 0 ? min.y : max.y;
            for (let z = -1; z <= 1; z += 2) {
              const zVal = z < 0 ? min.z : max.z;
              vec.set(xVal, yVal, zVal);
              if (matrix) {
                vec.applyMatrix4(matrix);
              }

              vec.toArray(positionArray, posIndex);
              posIndex += 3;
            }
          }
        }

        return terminate;
      }
    }, group);

    return positionArray;
  }
}

/**
 * A `THREE.Group` that visualizes a BVH as wireframe bounding boxes or solid
 * face overlays. Attach it as a sibling of the mesh in the scene graph and
 * call `update()` whenever the mesh's BVH or world transform changes.
 */
export class BVHHelper extends Group {
  depth: number;
  mesh: Object3D | null;
  bvh: GeometryBVH | null;
  displayParents: boolean;
  displayEdges: boolean;
  instanceId: number;
  _roots: BVHRootHelper[];
  edgeMaterial: LineBasicMaterial;
  meshMaterial: MeshBasicMaterial;

  /**
   * Shortcut to `edgeMaterial.color`.
   */
  get color() {
    return this.edgeMaterial.color;
  }

  /**
   * Opacity applied to both edge and mesh materials.
   */
  get opacity() {
    return this.edgeMaterial.opacity;
  }

  set opacity(v: number) {
    this.edgeMaterial.opacity = v;
    this.meshMaterial.opacity = v;
  }

  get objectIndex() {
    console.warn('BVHHelper: "objectIndex" has been renamed "instanceId".');
    return this.instanceId;
  }

  set objectIndex(v: number) {
    console.warn('BVHHelper: "objectIndex" has been renamed "instanceId".');
    this.instanceId = v;
  }

  constructor(mesh: Object3D | GeometryBVH | null = null, bvh: GeometryBVH | number | null = null, depth = 10) {
    // handle bvh, depth signature
    if (mesh instanceof GeometryBVH) {
      depth = typeof bvh === "number" ? bvh || 10 : 10;
      bvh = mesh;
      mesh = null;
    }

    // handle mesh, depth signature
    if (typeof bvh === "number") {
      depth = bvh;
      bvh = null;
    }

    super();

    this.name = "BVHHelper";

    this.depth = depth;

    this.mesh = mesh;

    this.bvh = bvh;

    this.displayParents = false;

    this.displayEdges = true;

    this.instanceId = 0;

    this._roots = [];

    const edgeMaterial = new LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });

    const meshMaterial = new MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });

    meshMaterial.color = edgeMaterial.color;

    /**
     * Material used when rendering in wireframe edge mode.
     */
    this.edgeMaterial = edgeMaterial;

    /**
     * Material used when rendering in solid face mode.
     */
    this.meshMaterial = meshMaterial;

    this.update();
  }

  /**
   * Rebuilds the helper's display geometry from the current BVH state. Must
   * be called after changes to the BVH, `depth`, `displayParents`, or
   * `displayEdges`.
   */
  update() {
    const mesh = this.mesh;
    const instanceId = this.instanceId;
    const source = mesh as (Object3D & { boundsTree?: GeometryBVH | null; geometry?: BVHGeometry }) | null;
    let bvh = this.bvh || source?.boundsTree || source?.geometry?.boundsTree || null;
    if (mesh instanceof BatchedMesh && (mesh as BVHBatchedMesh).boundsTrees && !bvh && instanceId >= 0) {
      // get the bvh from a batchedMesh if not provided
      // TODO: we should have an official way to get the geometry index cleanly
      const drawInfo = mesh._instanceInfo[instanceId];
      if (drawInfo) {
        bvh = (mesh as BVHBatchedMesh).boundsTrees![drawInfo.geometryIndex] || bvh;
      }
    }

    const totalRoots = bvh ? bvh._roots.length : 0;
    while (this._roots.length > totalRoots) {
      const root = this._roots.pop()!;
      root.geometry.dispose();
      this.remove(root);
    }

    for (let i = 0; i < totalRoots; i++) {
      const { depth, edgeMaterial, meshMaterial, displayParents, displayEdges } = this;

      if (i >= this._roots.length) {
        const root = new BVHRootHelper(bvh, edgeMaterial, depth, i);
        this.add(root);
        this._roots.push(root);
      }

      const root = this._roots[i];
      root.bvh = bvh;
      root.depth = depth;
      root.displayParents = displayParents;
      root.displayEdges = displayEdges;
      root.material = displayEdges ? edgeMaterial : meshMaterial;
      root.update();
    }
  }

  updateMatrixWorld(force?: boolean) {
    const mesh = this.mesh;
    const parent = this.parent;
    const instanceId = this.instanceId;

    if (mesh !== null) {
      mesh.updateWorldMatrix(true, false);

      if (parent) {
        this.matrix.copy(parent.matrixWorld).invert().multiply(mesh.matrixWorld);
      } else {
        this.matrix.copy(mesh.matrixWorld);
      }

      // handle batched and instanced mesh bvhs
      if ((mesh instanceof InstancedMesh || mesh instanceof BatchedMesh) && instanceId >= 0) {
        mesh.getMatrixAt(instanceId, matrix);
        this.matrix.multiply(matrix);
      }

      this.matrix.decompose(this.position, this.quaternion, this.scale);
    }

    super.updateMatrixWorld(force);
  }

  copy(source: Object3D): this {
    const helper = source as BVHHelper;

    this.depth = helper.depth;
    this.mesh = helper.mesh;
    this.bvh = helper.bvh;
    this.opacity = helper.opacity;
    this.color.copy(helper.color);

    return this;
  }

  clone(): this {
    return new BVHHelper().copy(this) as this;
  }

  /**
   * Disposes of the materials and geometries used by the helper.
   */
  dispose() {
    this.edgeMaterial.dispose();
    this.meshMaterial.dispose();

    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      (children[i] as BVHRootHelper).geometry.dispose();
    }
  }
}
