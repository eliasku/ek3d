import { MeshBVH, type MeshBVHOptions, type SerializedBVH } from "ek3d/addons/math/bvh/core/MeshBVH";
import { BVHHelper } from "ek3d/addons/math/bvh/objects/BVHHelper";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { Ray } from "ek3d/math/Ray";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";

const geometry = new BoxGeometry();
const options: MeshBVHOptions = { indirect: true, maxLeafSize: 2 };
const bvh = new MeshBVH(geometry, options);
const data: SerializedBVH = MeshBVH.serialize(bvh);
const restored = MeshBVH.deserialize(data, geometry);
const hit = restored.raycastFirst(new Ray());
const helper = new BVHHelper(new Mesh(geometry, new MeshBasicMaterial()), restored);
helper.depth = 5;
helper.update();
helper.dispose();
void hit;
