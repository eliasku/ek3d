import { ObjectLoader, type ObjectLoaderFactories } from "ek3d/loaders/ObjectLoader";
import { MaterialLoader, type MaterialConstructors } from "ek3d/loaders/MaterialLoader";
import { BufferGeometryLoader } from "ek3d/loaders/BufferGeometryLoader";
import { AnimationLoader } from "ek3d/loaders/AnimationLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { Mesh } from "ek3d/objects/Mesh";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { BatchedMesh } from "ek3d/objects/BatchedMesh";
import { Object3D } from "ek3d/core/Object3D";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Material } from "ek3d/materials/Material";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { LineCurve } from "ek3d/extras/curves/LineCurve";
import { AnimationClip } from "ek3d/animation/AnimationClip";

const manager = new LoadingManager();
const materials: MaterialConstructors = { MeshBasicMaterial };
const factories: ObjectLoaderFactories = {
  objects: { Object3D, Mesh, InstancedMesh, BatchedMesh },
  materials,
  geometries: { BoxGeometry },
  createCurve(json) {
    return new LineCurve().fromJSON(json);
  },
};
const objects: Promise<Object3D> = new ObjectLoader(manager, factories).loadAsync("scene.json");
const material: Promise<Material> = new MaterialLoader(manager, materials).loadAsync("material.json");
const geometry: Promise<BufferGeometry> = new BufferGeometryLoader(manager).loadAsync("geometry.json");
const animation: Promise<AnimationClip[]> = new AnimationLoader(manager).loadAsync("clips.json");
new ObjectLoader(manager, factories).parse(
  { object: { type: "Object3D" } },
  (object) => {
    const uuid: string = object.uuid;
    void uuid;
  },
  (error) => {
    const cause: unknown = error;
    void cause;
  },
);
// @ts-expect-error Material constructors must construct a Material.
const invalid: MaterialConstructors = { Object3D };
// @ts-expect-error Object factories must construct an Object3D.
const invalidObjects: ObjectLoaderFactories = { objects: { MeshBasicMaterial } };
void [objects, material, geometry, animation, invalid, invalidObjects];
