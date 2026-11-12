import { GL } from "../../GL";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { InstancedMesh } from "../../objects/InstancedMesh";
import type { Skeleton } from "../../objects/Skeleton";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";
import type { WebGLInfoState } from "./WebGLInfo";
import type { WebGLAttributes } from "./WebGLAttributes";
import type { WebGLBindingStates } from "./WebGLBindingStates";
import type { WebGLGeometries } from "./WebGLGeometries";

export class WebGLObjects {
  private geometries: WebGLGeometries;
  private attributes: WebGLAttributes;
  private bindingStates: WebGLBindingStates;
  private info: WebGLInfoState;
  private updateMap: WeakMap<BufferGeometry | InstancedMesh | Skeleton, number>;
  private instancedMeshes: Set<InstancedMesh>;

  constructor(
    gl: WebGL2RenderingContext,
    geometries: WebGLGeometries,
    attributes: WebGLAttributes,
    bindingStates: WebGLBindingStates,
    info: WebGLInfoState,
  ) {
    this.geometries = geometries;
    this.attributes = attributes;
    this.bindingStates = bindingStates;
    this.info = info;
    this.updateMap = new WeakMap();
    this.instancedMeshes = new Set();
    this.update = this.update.bind(this);
    this.dispose = this.dispose.bind(this);
    this.onInstancedMeshDispose = this.onInstancedMeshDispose.bind(this);
  }
  update(object: { geometry: BufferGeometry; isInstancedMesh?: boolean; isSkinnedMesh?: boolean }): BufferGeometry {
    const frame = this.info.render.frame;
    const geometry = object.geometry;
    const buffergeometry = this.geometries.get(object, geometry);
    // Update once per frame
    if (this.updateMap.get(buffergeometry) !== frame) {
      this.geometries.update(buffergeometry);
      this.updateMap.set(buffergeometry, frame);
    }
    if (object.isInstancedMesh) {
      const instancedMesh = object as InstancedMesh;
      if (instancedMesh.hasEventListener("dispose", this.onInstancedMeshDispose) === false) {
        instancedMesh.addEventListener("dispose", this.onInstancedMeshDispose);
        this.instancedMeshes.add(instancedMesh);
      }
      if (this.updateMap.get(instancedMesh) !== frame) {
        this.attributes.update(instancedMesh.instanceMatrix, GL.ARRAY_BUFFER);
        if (instancedMesh.instanceColor !== null) {
          this.attributes.update(instancedMesh.instanceColor, GL.ARRAY_BUFFER);
        }
        this.updateMap.set(instancedMesh, frame);
      }
    }
    if (object.isSkinnedMesh) {
      const skeleton = (object as SkinnedMesh).skeleton;
      if (this.updateMap.get(skeleton) !== frame) {
        skeleton.update();
        this.updateMap.set(skeleton, frame);
      }
    }
    return buffergeometry;
  }
  dispose(): void {
    for (const object of this.instancedMeshes) this.disposeInstancedMesh(object);
    this.updateMap = new WeakMap();
  }
  private onInstancedMeshDispose(event: { target: InstancedMesh }): void {
    this.disposeInstancedMesh(event.target);
  }
  private disposeInstancedMesh(object: InstancedMesh): void {
    this.instancedMeshes.delete(object);
    this.updateMap.delete(object);
    object.removeEventListener("dispose", this.onInstancedMeshDispose);
    this.bindingStates.releaseStatesOfObject(object);
    this.attributes.remove(object.instanceMatrix);
    if (object.instanceColor !== null) this.attributes.remove(object.instanceColor);
  }
}
