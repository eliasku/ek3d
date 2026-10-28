import {
  BasicDepthPacking,
  DepthFormat,
  HalfFloatType,
  NearestFilter,
  RGBAFormat,
  UnsignedIntType,
} from "../../constants";
import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLight } from "../../lights/PointLight";
import { Color } from "../../math/Color";
import { Frustum } from "../../math/Frustum";
import { Matrix4 } from "../../math/Matrix4";
import { Plane } from "../../math/Plane";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { DepthTexture } from "../../textures/DepthTexture";
import type { Texture } from "../../textures/Texture";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { FullScreenQuad, Pass } from "./Pass";
import {
  bilateralFilter_default,
  compositor_default,
  compositor_default2,
  godrays_default,
  godrays_default2,
} from "./GodraysShaders";

// Adapted from three-good-godrays 0.12.0; the original license is in GodraysShaders.ts.
export enum GodraysUpsampleQuality {
  LOW = 0,
  HIGH = 1,
}
export interface GodraysBlurParams {
  variance: number;
  kernelSize: number;
}
export interface AdaptiveStepsParams {
  stepSize: number;
  minSteps?: number;
  maxSteps?: number;
}
export interface GodraysPassParams {
  density: number;
  maxDensity: number;
  distanceAttenuation: number;
  color: Color;
  raymarchSteps: number;
  blur: boolean | Partial<GodraysBlurParams>;
  gammaCorrection: boolean;
  resolutionScale: number;
  upsampleQuality: GodraysUpsampleQuality;
  adaptiveSteps?: AdaptiveStepsParams;
  debugSteps?: boolean;
}

const directions: Vector3[] = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];
const defaults: GodraysPassParams = {
  density: 1 / 128,
  maxDensity: 0.5,
  distanceAttenuation: 2,
  color: new Color(0xffffff),
  raymarchSteps: 60,
  blur: true,
  gammaCorrection: true,
  resolutionScale: 0.5,
  upsampleQuality: GodraysUpsampleQuality.HIGH,
};

/** Volumetric shadow-map raymarching and depth-aware upsampling. The input buffer needs a depth texture unless one is supplied with setDepthTexture. */
export class GodraysPass extends Pass {
  light: PointLight | DirectionalLight;
  camera: PerspectiveCamera;
  params: GodraysPassParams;
  depthTexture: Texture | null = null;
  illumination: ShaderMaterial;
  blur: ShaderMaterial;
  composite: ShaderMaterial;
  quad: FullScreenQuad;
  rays: WebGLRenderTarget;
  blurred: WebGLRenderTarget;
  depthCopy: WebGLRenderTarget | null = null;
  shadowCopy: WebGLRenderTarget | null = null;
  width: number = 1;
  height: number = 1;
  lightPosition: Vector3 = new Vector3();
  cameraPosition: Vector3 = new Vector3();
  matrix: Matrix4 = new Matrix4();
  frustum: Frustum = new Frustum();
  scratch: Vector3 = new Vector3();
  scratch2: Vector3 = new Vector3();
  scratch3: Vector3 = new Vector3();
  plane: Plane = new Plane();

  constructor(
    light: PointLight | DirectionalLight,
    camera: PerspectiveCamera,
    params: Partial<GodraysPassParams> = {},
  ) {
    super();
    this.light = light;
    this.camera = camera;
    this.params = { ...defaults, color: defaults.color.clone() };
    const targetOptions = {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      format: RGBAFormat,
      type: HalfFloatType,
      generateMipmaps: false,
    };
    this.rays = new WebGLRenderTarget(1, 1, targetOptions);
    this.blurred = new WebGLRenderTarget(1, 1, targetOptions);
    this.illumination = new ShaderMaterial({
      vertexShader: godrays_default2,
      fragmentShader: godrays_default,
      depthTest: false,
      depthWrite: false,
      defines:
        light instanceof PointLight
          ? { IS_POINT_LIGHT: "", USE_CUBE_SHADOWMAP: "" }
          : { IS_DIRECTIONAL_LIGHT: "", USE_UNPACKED_DEPTH: "" },
      uniforms: {
        sceneDepth: { value: null },
        shadowMap: { value: null },
        lightPos: { value: this.lightPosition },
        cameraPos: { value: this.cameraPosition },
        resolution: { value: new Vector2() },
        cameraProjectionMatrixInv: { value: camera.projectionMatrixInverse },
        cameraMatrixWorld: { value: camera.matrixWorld },
        premultipliedLightCameraMatrix: { value: this.matrix },
        texelSizeY: { value: 1 },
        lightCameraNear: { value: 0.1 },
        lightCameraFar: { value: 1000 },
        near: { value: camera.near },
        far: { value: camera.far },
        density: { value: 0 },
        maxDensity: { value: 0 },
        distanceAttenuation: { value: 0 },
        fNormals: { value: directions.map(() => new Vector3()) },
        fConstants: { value: directions.map(() => 0) },
        raymarchSteps: { value: 60 },
        raymarchStepSize: { value: 0 },
        minSteps: { value: 8 },
        maxSteps: { value: 125 },
        shadowTexelWorldSize: { value: 0 },
      },
    });
    this.blur = new ShaderMaterial({
      vertexShader: compositor_default,
      fragmentShader: bilateralFilter_default,
      depthTest: false,
      depthWrite: false,
      defines: { KSIZE_ENUM: 1 },
      uniforms: { tInput: { value: this.rays.texture }, resolution: { value: new Vector2() }, bSigma: { value: 0.1 } },
    });
    this.composite = new ShaderMaterial({
      vertexShader: compositor_default,
      fragmentShader: compositor_default2,
      depthTest: false,
      depthWrite: false,
      defines: { JBU_EXTENT: "1", JBU_SPATIAL_SIGMA: "1.0", JBU_DEPTH_SIGMA: "0.02" },
      uniforms: {
        godrays: { value: this.rays.texture },
        sceneDiffuse: { value: null },
        sceneDepth: { value: null },
        near: { value: camera.near },
        far: { value: camera.far },
        color: { value: this.params.color },
        resolution: { value: new Vector2() },
        godraysResolution: { value: new Vector2() },
        gammaCorrection: { value: true },
      },
    });
    this.quad = new FullScreenQuad(this.illumination);
    this.setParams(params);
  }

  setParams(partial: Partial<GodraysPassParams>): void {
    if ("raymarchSteps" in partial && "adaptiveSteps" in partial)
      throw new Error("Cannot specify both raymarchSteps and adaptiveSteps");
    this.params = { ...defaults, ...partial, color: (partial.color ?? defaults.color).clone() };
    const p = this.params;
    const u = this.illumination.uniforms;
    u.density.value = p.density;
    u.maxDensity.value = p.maxDensity;
    u.distanceAttenuation.value = p.distanceAttenuation;
    u.raymarchSteps.value = p.raymarchSteps;
    u.raymarchStepSize.value = p.adaptiveSteps?.stepSize ?? 0;
    u.minSteps.value = p.adaptiveSteps?.minSteps ?? 8;
    u.maxSteps.value = p.adaptiveSteps?.maxSteps ?? 125;
    this.composite.uniforms.color.value = p.color;
    this.composite.uniforms.gammaCorrection.value = p.gammaCorrection;
    const extent = p.upsampleQuality >= 1 ? 1 : 0;
    this.composite.defines.JBU_EXTENT = String(extent);
    this.composite.defines.JBU_SPATIAL_SIGMA = extent ? "1.0" : "0.5";
    const blur = typeof p.blur === "object" ? p.blur : {};
    this.blur.uniforms.bSigma.value = blur.variance ?? 0.1;
    this.blur.defines.KSIZE_ENUM = blur.kernelSize ?? 1;
    for (const material of [this.illumination, this.blur, this.composite]) {
      if (p.debugSteps) material.defines.DEBUG_STEPS = "";
      else delete material.defines.DEBUG_STEPS;
      material.needsUpdate = true;
    }
    this.setSize(this.width, this.height);
  }

  setDepthTexture(depthTexture: Texture, depthPacking: number = BasicDepthPacking): void {
    if (depthPacking !== BasicDepthPacking) throw new Error("Only BasicDepthPacking is supported");
    this.depthTexture = depthTexture;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const w = Math.max(1, Math.ceil(width * this.params.resolutionScale));
    const h = Math.max(1, Math.ceil(height * this.params.resolutionScale));
    this.rays.setSize(w, h);
    this.blurred.setSize(w, h);
    this.illumination.uniforms.resolution.value.set(w, h);
    this.blur.uniforms.resolution.value.set(w, h);
    this.composite.uniforms.resolution.value.set(width, height);
    this.composite.uniforms.godraysResolution.value.set(w, h);
  }

  private copyDepth(
    renderer: WebGLRenderer,
    source: Texture,
    target: WebGLRenderTarget | null,
    width: number,
    height: number,
  ): WebGLRenderTarget {
    if (!target || target.width !== width || target.height !== height) {
      target?.depthTexture?.dispose();
      target?.dispose();
      target = new WebGLRenderTarget(width, height);
      target.depthTexture = new DepthTexture(width, height, UnsignedIntType);
      target.depthTexture.format = DepthFormat;
      target.depthTexture.compareFunction = null;
      target.depthTexture.minFilter = NearestFilter;
      target.depthTexture.magFilter = NearestFilter;
    }
    renderer.initRenderTarget(target);
    renderer.copyTextureToTexture(source, target.depthTexture!);
    return target;
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    const sceneDepth = this.depthTexture ?? readBuffer.depthTexture;
    if (!sceneDepth) throw new Error("GodraysPass requires a scene depth texture");
    const shadow = this.light.shadow;
    if (!shadow.map) throw new Error("GodraysPass requires a rendered shadow-casting light");
    const u = this.illumination.uniforms;
    const camera = this.camera;
    this.light.getWorldPosition(this.lightPosition);
    camera.getWorldPosition(this.cameraPosition);
    u.near.value = camera.near;
    u.far.value = camera.far;
    u.lightCameraNear.value = shadow.camera.near;
    u.lightCameraFar.value = shadow.camera.far;
    u.texelSizeY.value = 1 / (shadow.map.height * 2);
    this.matrix.multiplyMatrices(shadow.camera.projectionMatrix, shadow.camera.matrixWorldInverse);
    const far = shadow.camera.far;
    const attenuation = this.params.distanceAttenuation;
    const effectiveFar = attenuation <= 0 ? far : far * (1 - Math.pow(0.005, 1 / attenuation));
    if (this.light instanceof PointLight) {
      u.shadowMap.value = shadow.map.texture;
      for (let i = 0; i < 6; i++) {
        this.scratch.copy(this.lightPosition).addScaledVector(directions[i], effectiveFar);
        this.plane.setFromNormalAndCoplanarPoint(directions[i], this.scratch);
        u.fNormals.value[i].copy(this.plane.normal);
        u.fConstants.value[i] = this.plane.constant;
      }
      u.shadowTexelWorldSize.value = (2 * far) / shadow.mapSize.x;
    } else {
      const depth = shadow.map.depthTexture;
      if (!depth) throw new Error("GodraysPass requires a directional shadow depth texture");
      if (depth.compareFunction !== null) {
        this.shadowCopy = this.copyDepth(renderer, depth, this.shadowCopy, shadow.map.width, shadow.map.height);
        u.shadowMap.value = this.shadowCopy.depthTexture;
      } else u.shadowMap.value = depth;
      this.frustum.setFromProjectionMatrix(this.matrix);
      if (effectiveFar < far) {
        shadow.camera.getWorldDirection(this.scratch2);
        shadow.camera.getWorldPosition(this.scratch3);
        this.scratch.copy(this.scratch3).addScaledVector(this.scratch2, effectiveFar);
        this.frustum.planes[4].setFromNormalAndCoplanarPoint(this.scratch2.negate(), this.scratch);
      }
      for (let i = 0; i < 6; i++) {
        u.fNormals.value[i].copy(this.frustum.planes[i].normal).multiplyScalar(-1);
        u.fConstants.value[i] = -this.frustum.planes[i].constant;
      }
      const shadowCamera = this.light.shadow.camera;
      u.shadowTexelWorldSize.value = (shadowCamera.right - shadowCamera.left) / shadow.mapSize.x;
    }
    let depth: Texture = sceneDepth;
    if (!this.renderToScreen && writeBuffer.depthTexture === depth) {
      this.depthCopy = this.copyDepth(renderer, depth, this.depthCopy, writeBuffer.width, writeBuffer.height);
      depth = this.depthCopy.depthTexture!;
    }
    u.sceneDepth.value = depth;
    this.quad.material = this.illumination;
    renderer.setRenderTarget(this.rays);
    this.quad.render(renderer);
    if (this.params.blur) {
      this.quad.material = this.blur;
      renderer.setRenderTarget(this.blurred);
      this.quad.render(renderer);
    }
    this.composite.uniforms.godrays.value = this.params.blur ? this.blurred.texture : this.rays.texture;
    this.composite.uniforms.sceneDiffuse.value = readBuffer.texture;
    this.composite.uniforms.sceneDepth.value = depth;
    this.composite.uniforms.near.value = camera.near;
    this.composite.uniforms.far.value = camera.far;
    this.quad.material = this.composite;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose(): void {
    this.rays.dispose();
    this.blurred.dispose();
    this.depthCopy?.depthTexture?.dispose();
    this.depthCopy?.dispose();
    this.shadowCopy?.depthTexture?.dispose();
    this.shadowCopy?.dispose();
    this.illumination.dispose();
    this.blur.dispose();
    this.composite.dispose();
    this.quad.dispose();
  }
}
