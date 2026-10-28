import { ArrowHelper } from "ek3d/helpers/ArrowHelper";
import { AxesHelper } from "ek3d/helpers/AxesHelper";
import { Box3Helper } from "ek3d/helpers/Box3Helper";
import { BoxHelper } from "ek3d/helpers/BoxHelper";
import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { DirectionalLightHelper } from "ek3d/helpers/DirectionalLightHelper";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { HemisphereLightHelper } from "ek3d/helpers/HemisphereLightHelper";
import { PlaneHelper } from "ek3d/helpers/PlaneHelper";
import { PointLightHelper } from "ek3d/helpers/PointLightHelper";
import { PolarGridHelper } from "ek3d/helpers/PolarGridHelper";
import { SkeletonHelper } from "ek3d/helpers/SkeletonHelper";
import { SpotLightHelper } from "ek3d/helpers/SpotLightHelper";
import { Object3D } from "ek3d/core/Object3D";
import { Bone } from "ek3d/objects/Bone";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { PointLight } from "ek3d/lights/PointLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { Box3 } from "ek3d/math/Box3";
import { Plane } from "ek3d/math/Plane";
import { Vector3 } from "ek3d/math/Vector3";
import { Color } from "ek3d/math/Color";
import type { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import type { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";

const root = new Object3D();
const arrow = new ArrowHelper(new Vector3(0, 1, 0), new Vector3(), 3, "red", 0.5, 0.2);
arrow.setColor(new Color("blue"));
arrow.setDirection(new Vector3(1, 0, 0));
arrow.setLength(2);
const line: LineBasicMaterial = arrow.line.material;
const cone: MeshBasicMaterial = arrow.cone.material;
const axes = new AxesHelper(2);
axes.setColors("red", new Color("green"), 0x0000ff);
const bounds = new BoxHelper();
const fluentBounds: BoxHelper = bounds.setFromObject(root);
bounds.update();
const box = new Box3Helper(new Box3(), "yellow");
box.box.expandByPoint(new Vector3(1, 2, 3));
box.updateMatrixWorld();
const grid = new GridHelper(10, 8, "red", new Color("blue"));
const polar = new PolarGridHelper(4, 8, 3, 32, "red", "white");
const camera = new CameraHelper(new PerspectiveCamera());
const orthographic = new CameraHelper(new OrthographicCamera());
camera.update();
const points: number[] = camera.pointMap.n1;
const fluentCamera: CameraHelper = camera.setColors(new Color(), new Color(), new Color(), new Color(), new Color());
const directional = new DirectionalLightHelper(new DirectionalLight());
const point = new PointLightHelper(new PointLight());
const hemisphere = new HemisphereLightHelper(new HemisphereLight());
const spot = new SpotLightHelper(new SpotLight(), "orange");
for (const helper of [directional, point, hemisphere, spot]) {
  helper.color = undefined;
  helper.update();
}
const plane = new PlaneHelper(new Plane(), 2, new Color("yellow"));
plane.plane.constant = 3;
plane.updateMatrixWorld();
root.add(new Bone());
const skeleton = new SkeletonHelper(root);
const bones: Bone[] = skeleton.bones;
const fluentSkeleton: SkeletonHelper = skeleton.setColors(new Color("red"), new Color("green"));
skeleton.updateMatrixWorld();
for (const helper of [
  arrow,
  axes,
  bounds,
  box,
  grid,
  polar,
  camera,
  orthographic,
  directional,
  point,
  hemisphere,
  spot,
  plane,
  skeleton,
]) {
  root.add(helper);
  helper.visible = false;
  helper.dispose();
}
void [line, cone, fluentBounds, points, fluentCamera, bones, fluentSkeleton];

// @ts-expect-error A plane helper requires a plane, not an arbitrary scene object.
new PlaneHelper(root);
// @ts-expect-error A camera helper requires projection matrices.
new CameraHelper(root);
// @ts-expect-error Spot helper requires a spotlight, not the incorrect upstream HemisphereLight JSDoc.
new SpotLightHelper(new HemisphereLight());
// @ts-expect-error Skeleton roots must be scene objects.
new SkeletonHelper(new Box3());
// @ts-expect-error Direction must be a Vector3.
arrow.setDirection("up");
// @ts-expect-error Colors are not arbitrary objects.
arrow.setColor({ color: "red" });
// @ts-expect-error Camera helper palette accepts Color instances.
camera.setColors("red", "blue", "green", "white", "yellow");
// @ts-expect-error Helpers retain a concrete single material, not an array.
axes.material = [];
