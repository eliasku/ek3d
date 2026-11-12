import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { lerp } from "../../math/MathUtils";
import { Matrix4 } from "../../math/Matrix4";
import { Box3 } from "../../math/Box3";
import type { Object3D } from "../../core/Object3D";
import type { Material } from "../../materials/Material";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { OrthographicCamera } from "../../cameras/OrthographicCamera";
import type { WebGLShaderDescriptor } from "../../renderers/WebGLRenderer";
import { CSMFrustum } from "./CSMFrustum";
import { CSMShader } from "./CSMShader";

export type CSMSplitMode = "uniform" | "logarithmic" | "practical" | "custom";
export interface CSMData {
  camera: PerspectiveCamera | OrthographicCamera;
  parent: Object3D;
  cascades?: number;
  maxFar?: number;
  mode?: CSMSplitMode;
  shadowMapSize?: number;
  shadowBias?: number;
  lightDirection?: Vector3;
  lightIntensity?: number;
  lightNear?: number;
  lightFar?: number;
  lightMargin?: number;
  customSplitsCallback?: (amount: number, near: number, far: number, target: number[]) => void;
}
type CSMMaterial = Material & { defines: Record<string, string | number | boolean> };
const _cameraToLightMatrix = new Matrix4();
const _lightSpaceFrustum = new CSMFrustum({ webGL: true });
const _center = new Vector3();
const _origin = new Vector3();
const _bbox = new Box3();
const _uniformArray: number[] = [];
const _logArray: number[] = [];
const _lightOrientationMatrix = new Matrix4();
const _lightOrientationMatrixInverse = new Matrix4();
const _up = new Vector3(0, 1, 0);

/**
 * An implementation of Cascade Shadow Maps (CSM).
 *
 * Use with WebGLRenderer.
 *
 * ```typescript
 * import { CSM } from "ek3d/addons/csm/CSM";
 * ```
 */
export class CSM {
  camera: PerspectiveCamera | OrthographicCamera;
  parent: Object3D;
  cascades: number;
  maxFar: number;
  mode: CSMSplitMode;
  shadowMapSize: number;
  shadowBias: number;
  lightDirection: Vector3;
  lightIntensity: number;
  lightNear: number;
  lightFar: number;
  lightMargin: number;
  customSplitsCallback: CSMData["customSplitsCallback"];
  fade: boolean;
  mainFrustum: CSMFrustum;
  frustums: CSMFrustum[];
  breaks: number[];
  lights: DirectionalLight[];
  shaders: Map<CSMMaterial, WebGLShaderDescriptor | null>;
  private readonly materialHooks: Map<
    CSMMaterial,
    { original: PropertyDescriptor | undefined; hook: Material["onBeforeCompile"] }
  > = new Map();

  /**
   * Constructs a new CSM instance.
   *
   * @param data - The CSM data.
   */
  constructor(data: CSMData) {
    /**
     * The scene's camera.
     *
     */
    this.camera = data.camera;

    /**
     * The parent object, usually the scene.
     *
     */
    this.parent = data.parent;

    /**
     * The number of cascades.
     *
     * @default 3
     */
    this.cascades = data.cascades || 3;

    /**
     * The maximum far value.
     *
     * @default 100000
     */
    this.maxFar = data.maxFar || 100000;

    /**
     * The frustum split mode.
     *
     * @default 'practical'
     */
    this.mode = data.mode || "practical";

    /**
     * The shadow map size.
     *
     * @default 2048
     */
    this.shadowMapSize = data.shadowMapSize || 2048;

    /**
     * The shadow bias.
     *
     * @default 0.000001
     */
    this.shadowBias = data.shadowBias || 0.000001;

    /**
     * The light direction.
     *
     */
    this.lightDirection = data.lightDirection || new Vector3(1, -1, 1).normalize();

    /**
     * The light intensity.
     *
     * @default 3
     */
    this.lightIntensity = data.lightIntensity || 3;

    /**
     * The light near value.
     *
     * @default 1
     */
    this.lightNear = data.lightNear || 1;

    /**
     * The light far value.
     *
     * @default 2000
     */
    this.lightFar = data.lightFar || 2000;

    /**
     * The light margin.
     *
     * @default 200
     */
    this.lightMargin = data.lightMargin || 200;

    /**
     * Custom split callback when using `mode='custom'`.
     *
     */
    this.customSplitsCallback = data.customSplitsCallback;

    /**
     * Whether to fade between cascades or not.
     *
     * @default false
     */
    this.fade = false;

    /**
     * The main frustum.
     *
     */
    this.mainFrustum = new CSMFrustum({ webGL: true });

    /**
     * An array of frustums representing the cascades.
     *
     */
    this.frustums = [];

    /**
     * An array of numbers in the range `[0,1]` the defines how the
     * mainCSM frustum should be split up.
     *
     */
    this.breaks = [];

    /**
     * An array of directional lights which cast the shadows for
     * the different cascades. There is one directional light for each
     * cascade.
     *
     */
    this.lights = [];

    /**
     * A Map holding enhanced material shaders.
     *
     */
    this.shaders = new Map();

    this._createLights();
    this.updateFrustums();
  }

  /**
   * Creates the directional lights of this CSM instance.
   *
   * @private
   */
  _createLights() {
    for (let i = 0; i < this.cascades; i++) {
      const light = new DirectionalLight(0xffffff, this.lightIntensity);
      light.castShadow = true;
      light.shadow.mapSize.width = this.shadowMapSize;
      light.shadow.mapSize.height = this.shadowMapSize;

      light.shadow.camera.near = this.lightNear;
      light.shadow.camera.far = this.lightFar;
      light.shadow.bias = this.shadowBias;

      this.parent.add(light);
      this.parent.add(light.target);
      this.lights.push(light);
    }
  }

  /**
   * Inits the cascades according to the scene's camera and breaks configuration.
   *
   * @private
   */
  _initCascades() {
    const camera = this.camera;
    camera.updateProjectionMatrix();
    this.mainFrustum.setFromProjectionMatrix(camera.projectionMatrix, this.maxFar);
    this.mainFrustum.split(this.breaks, this.frustums);
  }

  /**
   * Updates the shadow bounds of this CSM instance.
   *
   * @private
   */
  _updateShadowBounds() {
    const frustums = this.frustums;
    for (let i = 0; i < frustums.length; i++) {
      const light = this.lights[i];
      const shadowCam = light.shadow.camera;
      const frustum = this.frustums[i];

      // Get the two points that represent that furthest points on the frustum assuming
      // that's either the diagonal across the far plane or the diagonal across the whole
      // frustum itself.
      const nearVerts = frustum.vertices.near;
      const farVerts = frustum.vertices.far;
      const point1 = farVerts[0];
      let point2;
      if (point1.distanceTo(farVerts[2]) > point1.distanceTo(nearVerts[2])) {
        point2 = farVerts[2];
      } else {
        point2 = nearVerts[2];
      }

      let squaredBBWidth = point1.distanceTo(point2);
      if (this.fade) {
        // expand the shadow extents by the fade margin if fade is enabled.
        const camera = this.camera;
        const far = Math.max(camera.far, this.maxFar);
        const linearDepth = frustum.vertices.far[0].z / (far - camera.near);
        const margin = 0.25 * Math.pow(linearDepth, 2.0) * (far - camera.near);

        squaredBBWidth += margin;
      }

      shadowCam.left = -squaredBBWidth / 2;
      shadowCam.right = squaredBBWidth / 2;
      shadowCam.top = squaredBBWidth / 2;
      shadowCam.bottom = -squaredBBWidth / 2;
      shadowCam.updateProjectionMatrix();
    }
  }

  /**
   * Computes the breaks of this CSM instance based on the scene's camera, number of cascades
   * and the selected split mode.
   *
   * @private
   */
  _getBreaks() {
    const camera = this.camera;
    const far = Math.min(camera.far, this.maxFar);
    this.breaks.length = 0;

    switch (this.mode) {
      case "uniform":
        uniformSplit(this.cascades, camera.near, far, this.breaks);
        break;
      case "logarithmic":
        logarithmicSplit(this.cascades, camera.near, far, this.breaks);
        break;
      case "practical":
        practicalSplit(this.cascades, camera.near, far, 0.5, this.breaks);
        break;
      case "custom":
        if (this.customSplitsCallback === undefined) throw new Error("CSM: Custom split scheme callback not defined.");
        this.customSplitsCallback(this.cascades, camera.near, far, this.breaks);
        break;
    }

    function uniformSplit(amount: number, near: number, far: number, target: number[]) {
      for (let i = 1; i < amount; i++) {
        target.push((near + ((far - near) * i) / amount) / far);
      }

      target.push(1);
    }

    function logarithmicSplit(amount: number, near: number, far: number, target: number[]) {
      for (let i = 1; i < amount; i++) {
        target.push((near * (far / near) ** (i / amount)) / far);
      }

      target.push(1);
    }

    function practicalSplit(amount: number, near: number, far: number, lambda: number, target: number[]) {
      _uniformArray.length = 0;
      _logArray.length = 0;
      logarithmicSplit(amount, near, far, _logArray);
      uniformSplit(amount, near, far, _uniformArray);

      for (let i = 1; i < amount; i++) {
        target.push(lerp(_uniformArray[i - 1], _logArray[i - 1], lambda));
      }

      target.push(1);
    }
  }

  /**
   * Updates the CSM. This method must be called in your animation loop before
   * calling `renderer.render()`.
   */
  update() {
    const camera = this.camera;
    const frustums = this.frustums;

    // for each frustum we need to find its min-max box aligned with the light orientation
    // the position in _lightOrientationMatrix does not matter, as we transform there and back
    _lightOrientationMatrix.lookAt(_origin, this.lightDirection, _up);
    _lightOrientationMatrixInverse.copy(_lightOrientationMatrix).invert();

    for (let i = 0; i < frustums.length; i++) {
      const light = this.lights[i];
      const shadowCam = light.shadow.camera;
      const texelWidth = (shadowCam.right - shadowCam.left) / this.shadowMapSize;
      const texelHeight = (shadowCam.top - shadowCam.bottom) / this.shadowMapSize;
      _cameraToLightMatrix.multiplyMatrices(_lightOrientationMatrixInverse, camera.matrixWorld);
      frustums[i].toSpace(_cameraToLightMatrix, _lightSpaceFrustum);

      const nearVerts = _lightSpaceFrustum.vertices.near;
      const farVerts = _lightSpaceFrustum.vertices.far;
      _bbox.makeEmpty();
      for (let j = 0; j < 4; j++) {
        _bbox.expandByPoint(nearVerts[j]);
        _bbox.expandByPoint(farVerts[j]);
      }

      _bbox.getCenter(_center);
      _center.z = _bbox.max.z + this.lightMargin;
      _center.x = Math.floor(_center.x / texelWidth) * texelWidth;
      _center.y = Math.floor(_center.y / texelHeight) * texelHeight;
      _center.applyMatrix4(_lightOrientationMatrix);

      light.position.copy(_center);
      light.target.position.copy(_center);

      light.target.position.x += this.lightDirection.x;
      light.target.position.y += this.lightDirection.y;
      light.target.position.z += this.lightDirection.z;
    }
  }

  /**
   * Applications must call this method for all materials that should be affected by CSM.
   *
   * @param source - The material to set up for CSM support.
   */
  setupMaterial(source: Material) {
    const material = source as CSMMaterial;

    material.defines = material.defines || {};
    material.defines.USE_CSM = 1;
    material.defines.CSM_CASCADES = this.cascades;

    if (this.fade) {
      material.defines.CSM_FADE = "";
    }

    const breaksVec2: Vector2[] = [];
    const shaders = this.shaders;
    const previous = this.materialHooks.get(material);
    const original = previous ? previous.original : Object.getOwnPropertyDescriptor(material, "onBeforeCompile");

    const hook: Material["onBeforeCompile"] = (shader) => {
      const start = shader.fragmentShader.indexOf("#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )");
      const end = shader.fragmentShader.indexOf(
        "#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )",
        start,
      );
      const main = shader.fragmentShader.indexOf("void main() {");
      const csmStart = CSMShader.lights_fragment_begin.indexOf(
        "#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct ) && defined( USE_CSM )",
      );
      const csmEnd = CSMShader.lights_fragment_begin.indexOf(
        "#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )",
        csmStart,
      );
      if (start < 0 || end < 0 || main < 0 || csmStart < 0 || csmEnd < 0)
        throw new Error("CSM: Unsupported material shader.");
      shader.fragmentShader =
        shader.fragmentShader.slice(0, start) +
        CSMShader.lights_fragment_begin.slice(csmStart, csmEnd) +
        shader.fragmentShader.slice(end);
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "uniform vec2 CSM_cascades[ CSM_CASCADES ];\nuniform float cameraNear;\nuniform float shadowFar;\nvoid main() {",
      );
      const far = Math.min(this.camera.far, this.maxFar);
      this._getExtendedBreaks(breaksVec2);

      shader.uniforms.CSM_cascades = { value: breaksVec2 };
      shader.uniforms.cameraNear = { value: this.camera.near };
      shader.uniforms.shadowFar = { value: far };

      shaders.set(material, shader);
    };
    material.onBeforeCompile = hook;
    this.materialHooks.set(material, { original, hook });

    shaders.set(material, null);
  }

  /**
   * Updates the CSM uniforms.
   *
   * @private
   */
  _updateUniforms() {
    const far = Math.min(this.camera.far, this.maxFar);
    const shaders = this.shaders;

    shaders.forEach((shader, material) => {
      if (shader !== null) {
        const uniforms = shader.uniforms;
        this._getExtendedBreaks(uniforms.CSM_cascades.value as Vector2[]);
        uniforms.cameraNear.value = this.camera.near;
        uniforms.shadowFar.value = far;
      }

      if (!this.fade && "CSM_FADE" in material.defines) {
        delete material.defines.CSM_FADE;
        material.needsUpdate = true;
      } else if (this.fade && !("CSM_FADE" in material.defines)) {
        material.defines.CSM_FADE = "";
        material.needsUpdate = true;
      }
    });
  }

  /**
   * Computes the extended breaks for the CSM uniforms.
   *
   * @private
   * @param target - The target array that holds the extended breaks.
   */
  _getExtendedBreaks(target: Vector2[]) {
    while (target.length < this.breaks.length) {
      target.push(new Vector2());
    }

    target.length = this.breaks.length;

    for (let i = 0; i < this.cascades; i++) {
      const amount = this.breaks[i];
      const prev = this.breaks[i - 1] || 0;
      target[i].x = prev;
      target[i].y = amount;
    }
  }

  /**
   * Applications must call this method every time they change camera or CSM settings.
   */
  updateFrustums() {
    this._getBreaks();
    this._initCascades();
    this._updateShadowBounds();
    this._updateUniforms();
  }

  /**
   * Applications must call this method when they remove the CSM usage from their scene.
   */
  remove() {
    for (let i = 0; i < this.lights.length; i++) {
      this.parent.remove(this.lights[i].target);
      this.parent.remove(this.lights[i]);
    }
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    const shaders = this.shaders;
    shaders.forEach((shader, material) => {
      const hooks = this.materialHooks.get(material);
      if (hooks && Object.getOwnPropertyDescriptor(material, "onBeforeCompile")?.value === hooks.hook) {
        if (hooks.original) Object.defineProperty(material, "onBeforeCompile", hooks.original);
        else Reflect.deleteProperty(material, "onBeforeCompile");
      }
      delete material.defines.USE_CSM;
      delete material.defines.CSM_CASCADES;
      delete material.defines.CSM_FADE;

      if (shader !== null) {
        delete shader.uniforms.CSM_cascades;
        delete shader.uniforms.cameraNear;
        delete shader.uniforms.shadowFar;
      }

      material.needsUpdate = true;
    });
    shaders.clear();
    this.materialHooks.clear();
  }
}
