import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Object3D } from "../../core/Object3D";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { euclideanModulo } from "../../math/MathUtils";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";
import { Line } from "../../objects/Line";
import { Mesh } from "../../objects/Mesh";
import type { Bone } from "../../objects/Bone";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";

export interface CCDIKLink {
  index: number;
  enabled?: boolean;
  limitation?: Vector3;
  rotationMin?: Vector3;
  rotationMax?: Vector3;
}
export interface CCDIK {
  target: number;
  effector: number;
  links: CCDIKLink[];
  iteration?: number;
  minAngle?: number;
  maxAngle?: number;
  blendFactor?: number;
}

const quaternion = new Quaternion();
const targetPos = new Vector3(),
  targetVec = new Vector3();
const effectorPos = new Vector3(),
  effectorVec = new Vector3();
const linkPos = new Vector3(),
  invLinkQ = new Quaternion(),
  linkScale = new Vector3();
const axis = new Vector3(),
  vector = new Vector3(),
  center = new Vector3(),
  matrix = new Matrix4();

export class CCDIKSolver {
  private initialQuaternions: Quaternion[][];
  private workingQuaternion: Quaternion = new Quaternion();

  constructor(
    public mesh: SkinnedMesh,
    public iks: CCDIK[] = [],
  ) {
    this.initialQuaternions = iks.map((ik) => ik.links.map(() => new Quaternion()));
    for (const ik of iks) {
      let child = mesh.skeleton.bones[ik.effector];
      for (const link of ik.links) {
        const bone = mesh.skeleton.bones[link.index];
        if (child.parent !== bone)
          console.warn(`THREE.CCDIKSolver: bone ${child.name} is not the child of bone ${bone.name}`);
        child = bone;
      }
    }
  }

  update(globalBlendFactor = 1): this {
    for (const ik of this.iks) this.updateOne(ik, globalBlendFactor);
    return this;
  }

  updateOne(ik: CCDIK, overrideBlend = 1): this {
    const blend = ik.blendFactor === undefined ? overrideBlend : ik.blendFactor;
    const bones = this.mesh.skeleton.bones;
    const initial = this.initialQuaternions[this.iks.indexOf(ik)];
    const effector = bones[ik.effector];
    targetPos.setFromMatrixPosition(bones[ik.target].matrixWorld);
    if (blend < 1) {
      for (let j = 0; j < ik.links.length; j++) initial[j].copy(bones[ik.links[j].index].quaternion);
    }
    for (let i = 0; i < (ik.iteration === undefined ? 1 : ik.iteration); i++) {
      let rotated = false;
      for (const spec of ik.links) {
        if (spec.enabled === false) break;
        const link = bones[spec.index];
        link.matrixWorld.decompose(linkPos, invLinkQ, linkScale);
        invLinkQ.invert();
        effectorPos.setFromMatrixPosition(effector.matrixWorld);
        effectorVec.subVectors(effectorPos, linkPos).applyQuaternion(invLinkQ).normalize();
        targetVec.subVectors(targetPos, linkPos).applyQuaternion(invLinkQ).normalize();
        let angle = Math.acos(Math.max(-1, Math.min(1, targetVec.dot(effectorVec))));
        if (angle < 1e-5) continue;
        if (ik.minAngle !== undefined && angle < ik.minAngle) angle = ik.minAngle;
        if (ik.maxAngle !== undefined && angle > ik.maxAngle) angle = ik.maxAngle;
        axis.crossVectors(effectorVec, targetVec).normalize();
        link.quaternion.multiply(quaternion.setFromAxisAngle(axis, angle));
        if (spec.limitation !== undefined) {
          const limitation = spec.limitation;
          const c = Math.min(link.quaternion.w, 1);
          const dot =
            link.quaternion.x * limitation.x + link.quaternion.y * limitation.y + link.quaternion.z * limitation.z;
          const c2 = (dot < 0 ? -1 : 1) * Math.sqrt(1 - c * c);
          link.quaternion.set(limitation.x * c2, limitation.y * c2, limitation.z * c2, c);
        }
        const min = spec.rotationMin,
          max = spec.rotationMax;
        if (min !== undefined || max !== undefined) {
          vector.setFromEuler(link.rotation);
          if (min !== undefined && max !== undefined) {
            center.addVectors(min, max).multiplyScalar(0.5);
            vector.x = center.x + euclideanModulo(vector.x - center.x + Math.PI, 2 * Math.PI) - Math.PI;
            vector.y = center.y + euclideanModulo(vector.y - center.y + Math.PI, 2 * Math.PI) - Math.PI;
            vector.z = center.z + euclideanModulo(vector.z - center.z + Math.PI, 2 * Math.PI) - Math.PI;
          }
          if (min !== undefined) vector.max(min);
          if (max !== undefined) vector.min(max);
          link.rotation.setFromVector3(vector);
        }
        link.updateMatrixWorld(true);
        rotated = true;
      }
      if (!rotated) break;
    }
    if (blend < 1) {
      for (let j = 0; j < ik.links.length; j++) {
        const link = bones[ik.links[j].index];
        link.quaternion.copy(this.workingQuaternion.copy(initial[j]).slerp(link.quaternion, blend));
        link.updateMatrixWorld(true);
      }
    }
    return this;
  }

  createHelper(sphereSize?: number): CCDIKHelper {
    return new CCDIKHelper(this.mesh, this.iks, sphereSize);
  }
}

function position(bone: Bone, inverse: Matrix4): Vector3 {
  return vector.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(inverse);
}

export class CCDIKHelper extends Object3D {
  sphereGeometry: SphereGeometry;
  targetSphereMaterial: MeshBasicMaterial = new MeshBasicMaterial({
    color: 0xff8888,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  effectorSphereMaterial: MeshBasicMaterial = new MeshBasicMaterial({
    color: 0x88ff88,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  linkSphereMaterial: MeshBasicMaterial = new MeshBasicMaterial({
    color: 0x8888ff,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  lineMaterial: LineBasicMaterial = new LineBasicMaterial({
    color: 0xff0000,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

  constructor(
    public root: SkinnedMesh,
    public iks: CCDIK[] = [],
    sphereSize = 0.25,
  ) {
    super();
    this.matrix.copy(root.matrixWorld);
    this.matrixAutoUpdate = false;
    this.sphereGeometry = new SphereGeometry(sphereSize, 16, 8);
    for (const ik of iks) {
      this.add(new Mesh(this.sphereGeometry, this.targetSphereMaterial));
      this.add(new Mesh(this.sphereGeometry, this.effectorSphereMaterial));
      for (const _link of ik.links) this.add(new Mesh(this.sphereGeometry, this.linkSphereMaterial));
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array((2 + ik.links.length) * 3), 3));
      this.add(new Line(geometry, this.lineMaterial));
    }
  }

  override updateMatrixWorld(force?: boolean): void {
    if (this.visible) {
      let offset = 0;
      const bones = this.root.skeleton.bones;
      matrix.copy(this.root.matrixWorld).invert();
      for (const ik of this.iks) {
        const target = bones[ik.target],
          effector = bones[ik.effector];
        this.children[offset++].position.copy(position(target, matrix));
        this.children[offset++].position.copy(position(effector, matrix));
        for (const link of ik.links) this.children[offset++].position.copy(position(bones[link.index], matrix));
        const line = this.children[offset++] as Line;
        const attribute = line.geometry.attributes.position as BufferAttribute;
        let p = position(target, matrix);
        attribute.setXYZ(0, p.x, p.y, p.z);
        p = position(effector, matrix);
        attribute.setXYZ(1, p.x, p.y, p.z);
        for (let i = 0; i < ik.links.length; i++) {
          p = position(bones[ik.links[i].index], matrix);
          attribute.setXYZ(i + 2, p.x, p.y, p.z);
        }
        attribute.needsUpdate = true;
      }
    }
    this.matrix.copy(this.root.matrixWorld);
    super.updateMatrixWorld(force);
  }

  dispose(): void {
    this.sphereGeometry.dispose();
    this.targetSphereMaterial.dispose();
    this.effectorSphereMaterial.dispose();
    this.linkSphereMaterial.dispose();
    this.lineMaterial.dispose();
    for (const child of this.children) if (child instanceof Line) child.geometry.dispose();
  }
}
