import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Controls } from "ek3d/extras/Controls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { Object3D } from "ek3d/core/Object3D";
import { Vector3 } from "ek3d/math/Vector3";

const camera = new PerspectiveCamera(60, 1, 0.1, 100);
const element = document.createElement("canvas");

const controls = new OrbitControls(camera, element);
const detached = new OrbitControls(camera);
controls.object.zoom = 2;

const orthographic = new OrbitControls(new OrthographicCamera(), element);
const orthoObject: OrthographicCamera = orthographic.object;
orthoObject.zoom = 3;

// The generic parameter preserves the concrete camera type without a cast.
const narrowed = new OrbitControls<PerspectiveCamera>(camera, null);
const narrowedObject: PerspectiveCamera = narrowed.object;
narrowedObject.aspect = 2;
narrowedObject.fov = 45;

const base: Controls<PerspectiveCamera> = controls;
const managed: PerspectiveCamera = base.object;
const element0: HTMLElement | null = base.domElement;
base.enabled = false;
base.state = -1;
base.keys = { LEFT: "a" };
const left: string = base.keys.LEFT;
const rotation: number | null = base.mouseButtons.LEFT;
const oneTouch: number | null = base.touches.ONE;

controls.connect(element);
controls.disconnect();
controls.dispose();
controls.update();
controls.update(0.016);
const changed: boolean = controls.update(1);
controls.listenToKeyEvents(window);
controls.stopListenToKeyEvents();
controls.cursorStyle = "grab";
const style: "auto" | "grab" = controls.cursorStyle;
controls.target.copy(new Vector3(1, 2, 3));
controls.cursor.set(0, 1, 0);
controls.minDistance = 1;
controls.maxDistance = 10;
controls.minZoom = 0.5;
controls.maxZoom = 4;
controls.minTargetRadius = 0;
controls.maxTargetRadius = 5;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI / 2;
controls.minAzimuthAngle = -Math.PI;
controls.maxAzimuthAngle = Math.PI;
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enableZoom = true;
controls.zoomSpeed = 1;
controls.enableRotate = true;
controls.rotateSpeed = 1;
controls.keyRotateSpeed = 1;
controls.enablePan = true;
controls.panSpeed = 1;
controls.screenSpacePanning = false;
controls.keyPanSpeed = 4;
controls.zoomToCursor = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1;
controls.mouseButtons = { LEFT: 0, MIDDLE: 1, RIGHT: 2 };
controls.touches = { ONE: 0, TWO: 2 };
controls.pan(1, 2);
controls.dollyIn(1.1);
controls.dollyOut(1.1);
controls.rotateLeft(0.1);
controls.rotateUp(0.1);
controls.saveState();
controls.reset();
const polar: number = controls.getPolarAngle();
const azimuth: number = controls.getAzimuthalAngle();
const distance: number = controls.getDistance();

class PlainControls extends Controls<Object3D> {
  disconnects: number = 0;

  disconnect(): void {
    this.disconnects++;
  }

  dispose(): void {
    this.disconnect();
  }

  update(): boolean {
    return false;
  }
}

const plain = new PlainControls(new Object3D(), element);
const object3d: Object3D = plain.object;
const plainElement: HTMLElement | null = plain.domElement;
plain.connect(element);
plain.disconnect();
plain.dispose();
const updated: boolean = plain.update();
const disconnects: number = plain.disconnects;

export function orbitConsumer() {
  return {
    controls,
    detached,
    narrowedObject,
    managed,
    element0,
    left,
    rotation,
    oneTouch,
    changed,
    style,
    polar,
    azimuth,
    distance,
    object3d,
    orthoObject,
    plainElement,
    disconnects,
    updated,
  };
}

// @ts-expect-error OrbitControls manages cameras, not arbitrary objects
new OrbitControls(new Object3D());
// @ts-expect-error A concrete generic cannot be wider than the supported camera union
new OrbitControls<Object3D>(new Object3D());
// @ts-expect-error the retained object is the camera, not an arbitrary object type
narrowed.object = new Object3D();
// @ts-expect-error perspective fields are not available on the orthographic object
orthographic.object.fov = 45;
// @ts-expect-error cursor styles are limited to the supported values
controls.cursorStyle = "pointer";
// @ts-expect-error domElement accepts the element itself, not a selector
new OrbitControls(camera, "#scene");
// @ts-expect-error the base class is abstract
new Controls<Object3D>(new Object3D());
// @ts-expect-error subclass updates return the changed flag
plain.update = () => "changed";
