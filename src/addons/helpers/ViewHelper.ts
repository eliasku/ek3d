import { CylinderGeometry } from "../../geometries/CylinderGeometry";
import { CanvasTexture } from "../../textures/CanvasTexture";
import { Color } from "../../math/Color";
import { Euler } from "../../math/Euler";
import { Mesh } from "../../objects/Mesh";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Object3D } from "../../core/Object3D";
import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import { Quaternion } from "../../math/Quaternion";
import { Raycaster } from "../../core/Raycaster";
import { Sprite } from "../../objects/Sprite";
import { SpriteMaterial } from "../../materials/SpriteMaterial";
import { ColorSpace } from "../../constants";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import type { Camera } from "../../cameras/Camera";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

export class ViewHelper extends Object3D {
  isViewHelper: boolean;
  camera: Camera;
  animating: boolean;
  center: Vector3;
  location: { top: number | null; right: number; bottom: number; left: number | null };
  render: (renderer: WebGLRenderer) => void;
  handleClick: (event: PointerEvent) => boolean;
  setLabels: (x?: string, y?: string, z?: string) => void;
  setLabelStyle: (font?: string, color?: string, radius?: number) => void;
  update: (delta: number) => void;
  dispose: () => void;

  constructor(camera: Camera, domElement: HTMLElement) {
    super();

    this.isViewHelper = true;

    this.camera = camera;

    this.animating = false;

    this.center = new Vector3();

    this.location = {
      top: null,
      right: 0,
      bottom: 0,
      left: null,
    };

    const color1 = new Color("#ff4466");
    const color2 = new Color("#88ff44");
    const color3 = new Color("#4488ff");
    const color4 = new Color("#000000");

    const options: {
      labelX?: string;
      labelY?: string;
      labelZ?: string;
      font?: string;
      color?: string;
      radius?: number;
    } = {};

    const interactiveObjects: Sprite[] = [];
    const raycaster = new Raycaster();
    const mouse = new Vector2();
    const dummy = new Object3D();

    const orthoCamera = new OrthographicCamera(-2, 2, 2, -2, 0, 4);
    orthoCamera.position.set(0, 0, 2);

    const geometry = new CylinderGeometry(0.04, 0.04, 0.8, 5).rotateZ(-Math.PI / 2).translate(0.4, 0, 0);

    const xAxis = new Mesh<MeshBasicMaterial>(geometry, getAxisMaterial(color1));
    const yAxis = new Mesh<MeshBasicMaterial>(geometry, getAxisMaterial(color2));
    const zAxis = new Mesh<MeshBasicMaterial>(geometry, getAxisMaterial(color3));

    yAxis.rotation.z = Math.PI / 2;
    zAxis.rotation.y = -Math.PI / 2;

    this.add(xAxis);
    this.add(zAxis);
    this.add(yAxis);

    const spriteMaterial1 = getSpriteMaterial(color1);
    const spriteMaterial2 = getSpriteMaterial(color2);
    const spriteMaterial3 = getSpriteMaterial(color3);
    const spriteMaterial4 = getSpriteMaterial(color4);

    const posXAxisHelper = new Sprite(spriteMaterial1);
    const posYAxisHelper = new Sprite(spriteMaterial2);
    const posZAxisHelper = new Sprite(spriteMaterial3);
    const negXAxisHelper = new Sprite(spriteMaterial4);
    const negYAxisHelper = new Sprite(spriteMaterial4);
    const negZAxisHelper = new Sprite(spriteMaterial4);

    posXAxisHelper.position.x = 1;
    posYAxisHelper.position.y = 1;
    posZAxisHelper.position.z = 1;
    negXAxisHelper.position.x = -1;
    negYAxisHelper.position.y = -1;
    negZAxisHelper.position.z = -1;

    negXAxisHelper.material.opacity = 0.2;
    negYAxisHelper.material.opacity = 0.2;
    negZAxisHelper.material.opacity = 0.2;

    posXAxisHelper.userData.type = "posX";
    posYAxisHelper.userData.type = "posY";
    posZAxisHelper.userData.type = "posZ";
    negXAxisHelper.userData.type = "negX";
    negYAxisHelper.userData.type = "negY";
    negZAxisHelper.userData.type = "negZ";

    this.add(posXAxisHelper);
    this.add(posYAxisHelper);
    this.add(posZAxisHelper);
    this.add(negXAxisHelper);
    this.add(negYAxisHelper);
    this.add(negZAxisHelper);

    interactiveObjects.push(posXAxisHelper);
    interactiveObjects.push(posYAxisHelper);
    interactiveObjects.push(posZAxisHelper);
    interactiveObjects.push(negXAxisHelper);
    interactiveObjects.push(negYAxisHelper);
    interactiveObjects.push(negZAxisHelper);

    const point = new Vector3();
    const dim = 128;
    const turnRate = 2 * Math.PI; // turn rate in angles per second

    this.render = function (this: ViewHelper, renderer: WebGLRenderer) {
      this.quaternion.copy(this.camera.quaternion).invert();
      this.updateMatrixWorld();

      point.set(0, 0, 1);
      point.applyQuaternion(this.camera.quaternion);

      //

      const location = this.location;

      let x, y;

      if (location.left !== null) {
        x = location.left;
      } else {
        x = domElement.offsetWidth - dim - location.right;
      }

      if (location.top !== null) {
        // Position from top
        y = domElement.offsetHeight - dim - location.top;
      } else {
        // Position from bottom
        y = location.bottom;
      }

      renderer.clearDepth();

      renderer.getViewport(viewport);
      renderer.setViewport(x, y, dim, dim);

      renderer.render(this, orthoCamera);

      renderer.setViewport(viewport.x, viewport.y, viewport.z, viewport.w);
    };

    const targetPosition = new Vector3();
    const targetQuaternion = new Quaternion();

    const q1 = new Quaternion();
    const q2 = new Quaternion();
    const viewport = new Vector4();
    let radius = 0;

    this.handleClick = function (this: ViewHelper, event: PointerEvent) {
      if (this.animating === true) return false;

      const rect = domElement.getBoundingClientRect();
      const location = this.location;

      let offsetX, offsetY;

      if (location.left !== null) {
        offsetX = rect.left + location.left;
      } else {
        offsetX = rect.left + domElement.offsetWidth - dim - location.right;
      }

      if (location.top !== null) {
        offsetY = rect.top + location.top;
      } else {
        offsetY = rect.top + domElement.offsetHeight - dim - location.bottom;
      }

      mouse.x = ((event.clientX - offsetX) / dim) * 2 - 1;
      mouse.y = -((event.clientY - offsetY) / dim) * 2 + 1;

      raycaster.setFromCamera(mouse, orthoCamera);

      const intersects = raycaster.intersectObjects(interactiveObjects);

      if (intersects.length > 0) {
        const intersection = intersects[0];
        const object = intersection.object;

        prepareAnimationData(object, this.center);

        this.animating = true;

        return true;
      } else {
        return false;
      }
    };

    this.setLabels = function (labelX?: string, labelY?: string, labelZ?: string) {
      options.labelX = labelX;
      options.labelY = labelY;
      options.labelZ = labelZ;

      updateLabels();
    };

    this.setLabelStyle = function (font?: string, color?: string, radius?: number) {
      options.font = font;
      options.color = color;
      options.radius = radius;

      updateLabels();
    };

    this.update = function (this: ViewHelper, delta: number) {
      const step = delta * turnRate;

      // animate position by doing a slerp and then scaling the position on the unit sphere

      q1.rotateTowards(q2, step);
      this.camera.position.set(0, 0, 1).applyQuaternion(q1).multiplyScalar(radius).add(this.center);

      // animate orientation

      this.camera.quaternion.rotateTowards(targetQuaternion, step);

      if (q1.angleTo(q2) === 0) {
        this.animating = false;
      }
    };

    this.dispose = function () {
      geometry.dispose();

      xAxis.material.dispose();
      yAxis.material.dispose();
      zAxis.material.dispose();

      posXAxisHelper.material.map!.dispose();
      posYAxisHelper.material.map!.dispose();
      posZAxisHelper.material.map!.dispose();
      negXAxisHelper.material.map!.dispose();
      negYAxisHelper.material.map!.dispose();
      negZAxisHelper.material.map!.dispose();

      posXAxisHelper.material.dispose();
      posYAxisHelper.material.dispose();
      posZAxisHelper.material.dispose();
      negXAxisHelper.material.dispose();
      negYAxisHelper.material.dispose();
      negZAxisHelper.material.dispose();
    };

    const prepareAnimationData = (object: Object3D, focusPoint: Vector3) => {
      switch (object.userData.type) {
        case "posX":
          targetPosition.set(1, 0, 0);
          targetQuaternion.setFromEuler(new Euler(0, Math.PI * 0.5, 0));
          break;

        case "posY":
          targetPosition.set(0, 1, 0);
          targetQuaternion.setFromEuler(new Euler(-Math.PI * 0.5, 0, 0));
          break;

        case "posZ":
          targetPosition.set(0, 0, 1);
          targetQuaternion.setFromEuler(new Euler());
          break;

        case "negX":
          targetPosition.set(-1, 0, 0);
          targetQuaternion.setFromEuler(new Euler(0, -Math.PI * 0.5, 0));
          break;

        case "negY":
          targetPosition.set(0, -1, 0);
          targetQuaternion.setFromEuler(new Euler(Math.PI * 0.5, 0, 0));
          break;

        case "negZ":
          targetPosition.set(0, 0, -1);
          targetQuaternion.setFromEuler(new Euler(0, Math.PI, 0));
          break;

        default:
          console.error("ViewHelper: Invalid axis.");
      }

      //

      radius = this.camera.position.distanceTo(focusPoint);
      targetPosition.multiplyScalar(radius).add(focusPoint);

      dummy.position.copy(focusPoint);

      dummy.lookAt(this.camera.position);
      q1.copy(dummy.quaternion);

      dummy.lookAt(targetPosition);
      q2.copy(dummy.quaternion);
    };

    function getAxisMaterial(color: Color) {
      return new MeshBasicMaterial({ color: color, toneMapped: false });
    }

    function useOffscreenCanvas() {
      let result = false;

      try {
        // this check has been adapted from WebGLTextures

        result = typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d") !== null;
      } catch {
        // Ignore any errors
      }

      return result;
    }

    function createCanvas(width: number, height: number) {
      let canvas;

      if (useOffscreenCanvas()) {
        canvas = new OffscreenCanvas(width, height);
      } else {
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
      }

      return canvas;
    }

    function getSpriteMaterial(color: Color, text?: string) {
      const { font = "24px Arial", color: labelColor = "#000000", radius = 14 } = options;

      const canvas = createCanvas(64, 64);

      const context = canvas.getContext("2d");
      if (context === null) throw new Error("ViewHelper requires a 2D canvas context.");
      context.beginPath();
      context.arc(32, 32, radius, 0, 2 * Math.PI);
      context.closePath();
      context.fillStyle = color.getStyle();
      context.fill();

      if (text) {
        context.font = font;
        context.textAlign = "center";
        context.fillStyle = labelColor;
        context.fillText(text, 32, 41);
      }

      const texture = new CanvasTexture(canvas);
      texture.colorSpace = ColorSpace.SRGB;

      return new SpriteMaterial({ map: texture, toneMapped: false });
    }

    function updateLabels() {
      posXAxisHelper.material.map!.dispose();
      posYAxisHelper.material.map!.dispose();
      posZAxisHelper.material.map!.dispose();

      posXAxisHelper.material.dispose();
      posYAxisHelper.material.dispose();
      posZAxisHelper.material.dispose();

      posXAxisHelper.material = getSpriteMaterial(color1, options.labelX);
      posYAxisHelper.material = getSpriteMaterial(color2, options.labelY);
      posZAxisHelper.material = getSpriteMaterial(color3, options.labelZ);
    }
  }
}
