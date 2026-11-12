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
export class SceneHelpers {
  private bounds: BoxHelper;
  private camera: CameraHelper;
  private directional: DirectionalLightHelper;
  private point: PointLightHelper;
  private hemisphere: HemisphereLightHelper;
  private direction: Vector3;
  private position: Vector3;
  private arrow: ArrowHelper;
  private helpers: (
    | AxesHelper
    | GridHelper
    | BoxHelper
    | CameraHelper
    | DirectionalLightHelper
    | PointLightHelper
    | HemisphereLightHelper
    | SkeletonHelper
    | ArrowHelper
  )[];
  private visible: boolean;
  private disposed: boolean;

  constructor(
    private scene: Scene,
    private targets: {
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
    this.bounds = new BoxHelper(targets.object, 0xffcc33);
    this.camera = new CameraHelper(targets.camera);
    this.directional = new DirectionalLightHelper(targets.directional, 0.4);
    this.point = new PointLightHelper(targets.point, 0.25);
    this.hemisphere = new HemisphereLightHelper(targets.hemisphere, 0.3);
    const skeleton = new SkeletonHelper(targets.skeletonRoot);
    this.direction = new Vector3(0, 1, 0);
    this.position = new Vector3();
    this.arrow = new ArrowHelper(this.direction, this.position, 1.2, 0x44ffcc);
    this.helpers = [
      axes,
      grid,
      this.bounds,
      this.camera,
      this.directional,
      this.point,
      this.hemisphere,
      skeleton,
      this.arrow,
    ];
    this.visible = false;
    this.disposed = false;
    for (const helper of this.helpers) {
      helper.visible = false;
      scene.add(helper);
    }
    this.setVisible = this.setVisible.bind(this);
    this.update = this.update.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  setVisible(value: boolean) {
    this.visible = value;
    for (const helper of this.helpers) helper.visible = value;
  }

  update() {
    if (!this.visible || this.disposed) return;
    this.targets.object.updateWorldMatrix(true, false);
    this.targets.skeletonRoot.updateWorldMatrix(true, true);
    this.targets.camera.updateWorldMatrix(true, false);
    this.bounds.update();
    this.camera.update();
    this.directional.update();
    this.point.update();
    this.hemisphere.update();
    this.targets.object.getWorldPosition(this.position);
    this.arrow.position.copy(this.position);
    this.targets.object.getWorldDirection(this.direction);
    this.arrow.setDirection(this.direction);
    // SkeletonHelper updates its endpoints during the renderer's matrix-world traversal.
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const helper of this.helpers) {
      this.scene.remove(helper);
      helper.dispose();
    }
  }
}
