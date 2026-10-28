import { AxesHelper } from "ek3d/helpers/AxesHelper";
import { ArrowHelper } from "ek3d/helpers/ArrowHelper";
import { BoxHelper } from "ek3d/helpers/BoxHelper";
import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { DirectionalLightHelper } from "ek3d/helpers/DirectionalLightHelper";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { HemisphereLightHelper } from "ek3d/helpers/HemisphereLightHelper";
import { PointLightHelper } from "ek3d/helpers/PointLightHelper";
import { SkeletonHelper } from "ek3d/helpers/SkeletonHelper";
import { Vector3 } from "ek3d/math/Vector3";
import type { Object3D } from "ek3d/core/Object3D";
import type { Camera } from "ek3d/cameras/Camera";
import type { Scene } from "ek3d/scenes/Scene";
import type { DirectionalLight } from "ek3d/lights/DirectionalLight";
import type { HemisphereLight } from "ek3d/lights/HemisphereLight";
import type { PointLight } from "ek3d/lights/PointLight";

/** Attach world-space helpers directly to the scene, not to the transformed demonstration stage. */
export function setupHelpers(
  scene: Scene,
  targets: {
    object: Object3D;
    camera: Camera;
    directional: DirectionalLight;
    point: PointLight;
    hemisphere: HemisphereLight;
    skeletonRoot: Object3D;
  },
) {
  const axes = new AxesHelper(2);
  const grid = new GridHelper(12, 12, 0x7788aa, 0x394457);
  grid.position.y = -1.48;
  const bounds = new BoxHelper(targets.object, 0xffcc33);
  const camera = new CameraHelper(targets.camera);
  const directional = new DirectionalLightHelper(targets.directional, 0.4);
  const point = new PointLightHelper(targets.point, 0.25);
  const hemisphere = new HemisphereLightHelper(targets.hemisphere, 0.3);
  const skeleton = new SkeletonHelper(targets.skeletonRoot);
  const direction = new Vector3(0, 1, 0);
  const position = new Vector3();
  const arrow = new ArrowHelper(direction, position, 1.2, 0x44ffcc);
  const helpers = [axes, grid, bounds, camera, directional, point, hemisphere, skeleton, arrow];
  let visible = false;
  let disposed = false;
  for (const helper of helpers) {
    helper.visible = false;
    scene.add(helper);
  }
  return {
    setVisible(value: boolean) {
      visible = value;
      for (const helper of helpers) helper.visible = value;
    },
    update() {
      if (!visible || disposed) return;
      targets.object.updateWorldMatrix(true, false);
      targets.skeletonRoot.updateWorldMatrix(true, true);
      targets.camera.updateWorldMatrix(true, false);
      bounds.update();
      camera.update();
      directional.update();
      point.update();
      hemisphere.update();
      targets.object.getWorldPosition(position);
      arrow.position.copy(position);
      targets.object.getWorldDirection(direction);
      arrow.setDirection(direction);
      // SkeletonHelper updates its endpoints during the renderer's matrix-world traversal.
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const helper of helpers) {
        scene.remove(helper);
        helper.dispose();
      }
    },
  };
}
