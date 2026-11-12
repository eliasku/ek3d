import type { Camera } from "../../cameras/Camera";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Light } from "../../lights/Light";
import type { Object3D } from "../../core/Object3D";
import type { WebGLRenderer } from "../WebGLRenderer";
import type { OrthographicCamera } from "../../cameras/OrthographicCamera";
import type { Layers } from "../../core/Layers";
import type { LightShadow } from "../../lights/LightShadow";
import type { Material, MaterialProperties } from "../../materials/Material";
import type { Line } from "../../objects/Line";
import type { Points } from "../../objects/Points";
import { Side, TextureFilter, ShadowMap, Blending, Compare, PixelFormat, TextureType } from "../../constants";
import { WebGLRenderTarget } from "../WebGLRenderTarget";
import { WebGLCubeRenderTarget } from "../WebGLCubeRenderTarget";
import { MeshDepthMaterial } from "../../materials/MeshDepthMaterial";
import { MeshDistanceMaterial } from "../../materials/MeshDistanceMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Mesh } from "../../objects/Mesh";
import { Vector4 } from "../../math/Vector4";
import { Vector2 } from "../../math/Vector2";
import { Matrix4 } from "../../math/Matrix4";
import { Frustum } from "../../math/Frustum";
import { DepthTexture } from "../../textures/DepthTexture";
import { CubeDepthTexture } from "../../textures/CubeDepthTexture";
import * as vsm from "../shaders/ShaderLib/vsm.glsl";
import { warn } from "../../utils";
import { Vector3 } from "../../math/Vector3";

export interface WebGLShadowMapObjects {
  update(object: Pick<Mesh, "geometry">): BufferGeometry;
}
export interface WebGLShadowMapCapabilities {
  maxTextureSize: number;
}
export interface WebGLShadowMapSystem {
  /** Enables shadow maps. Defaults to false. */
  enabled: boolean;
  /** Updates shadows automatically. Disable for static lighting. Defaults to true. */
  autoUpdate: boolean;
  /** Requests a shadow update on the next render. Defaults to false. */
  needsUpdate: boolean;
  /** Shadow filtering algorithm. Defaults to ShadowMap.PCF. */
  type: ShadowMap;
  render(lights: Light[], scene: Object3D, camera: Camera): void;
  dispose(): void;
}

type ShadowResource = LightShadow<PerspectiveCamera | OrthographicCamera> & {
  isPointLightShadow?: boolean;
  map: (WebGLRenderTarget & { isWebGLCubeRenderTarget?: boolean }) | null;
  mapPass: WebGLRenderTarget | null;
  getCamera(viewportIndex?: number): Camera;
  getFrustum(viewportIndex?: number): Frustum;
  updateMatrices(light: Light, viewCamera?: Camera): void;
};

type ShadowLight = Light & {
  shadow?: ShadowResource;
  isPointLight?: boolean;
  distance?: number;
};

const _cubeDirections = [
  /*@__PURE__*/ new Vector3(1, 0, 0),
  /*@__PURE__*/ new Vector3(-1, 0, 0),
  /*@__PURE__*/ new Vector3(0, 1, 0),
  /*@__PURE__*/ new Vector3(0, -1, 0),
  /*@__PURE__*/ new Vector3(0, 0, 1),
  /*@__PURE__*/ new Vector3(0, 0, -1),
];
const _cubeUps = [
  /*@__PURE__*/ new Vector3(0, -1, 0),
  /*@__PURE__*/ new Vector3(0, -1, 0),
  /*@__PURE__*/ new Vector3(0, 0, 1),
  /*@__PURE__*/ new Vector3(0, 0, -1),
  /*@__PURE__*/ new Vector3(0, -1, 0),
  /*@__PURE__*/ new Vector3(0, -1, 0),
];
const _projScreenMatrix = /*@__PURE__*/ new Matrix4();
const _lightPositionWorld = /*@__PURE__*/ new Vector3();
const _lookTarget = /*@__PURE__*/ new Vector3();
export class WebGLShadowMap implements WebGLShadowMapSystem {
  private _frustum: Frustum = new Frustum();
  private _shadowMapSize: Vector2 = new Vector2();
  private _viewportSize: Vector2 = new Vector2();
  private _viewport: Vector4 = new Vector4();
  private _depthMaterial: MeshDepthMaterial = new MeshDepthMaterial();
  private _distanceMaterial: MeshDistanceMaterial = new MeshDistanceMaterial();
  private _materialCache: Record<string, Record<string, Material & MaterialProperties>> = {};
  private _maxTextureSize: number;
  private shadowSide: Record<Side, Side>;
  private shadowMaterialVertical: ShaderMaterial;
  private shadowMaterialHorizontal: ShaderMaterial;
  private fullScreenTri: BufferGeometry;
  private fullScreenMesh: Mesh;
  private materialSources: Map<string, WeakRef<Material>>;
  private shadows: Set<WeakRef<ShadowResource>>;
  private shadowRefs: WeakMap<ShadowResource, WeakRef<ShadowResource>>;
  private shadowMapTypes: WeakMap<ShadowResource, ShadowMap>;
  private shadowRegistry: FinalizationRegistry<WeakRef<ShadowResource>>;
  private _previousType: ShadowMap;
  enabled: boolean;
  autoUpdate: boolean;
  needsUpdate: boolean;
  type: ShadowMap;

  constructor(
    private renderer: WebGLRenderer,
    private objects: WebGLShadowMapObjects,
    capabilities: WebGLShadowMapCapabilities,
  ) {
    this._maxTextureSize = capabilities.maxTextureSize;
    this.shadowSide = { [Side.Front]: Side.Back, [Side.Back]: Side.Front, [Side.Double]: Side.Double };
    this.shadowMaterialVertical = new ShaderMaterial({
      defines: {
        VSM_SAMPLES: 8,
      },
      uniforms: {
        shadow_pass: { value: null },
        resolution: { value: new Vector2() },
        radius: { value: 4.0 },
      },
      vertexShader: vsm.vertex,
      fragmentShader: vsm.fragment,
    });
    this.shadowMaterialHorizontal = this.shadowMaterialVertical.clone();
    this.shadowMaterialHorizontal.defines.HORIZONTAL_PASS = 1;
    this.fullScreenTri = new BufferGeometry();
    this.fullScreenTri.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, -1, 0.5, 3, -1, 0.5, -1, 3, 0.5]), 3),
    );
    this.fullScreenMesh = new Mesh(this.fullScreenTri, this.shadowMaterialVertical);
    this.enabled = false;
    this.autoUpdate = true;
    this.needsUpdate = false;
    this.type = ShadowMap.PCF;
    this.render = this.render.bind(this);
    this.dispose = this.dispose.bind(this);
    this.materialSources = new Map();
    this.shadows = new Set();
    this.shadowRefs = new WeakMap();
    this.shadowMapTypes = new WeakMap();
    this.shadowRegistry = new FinalizationRegistry(this.onShadowFinalize.bind(this));
    this._previousType = this.type;
    this.onMaterialDispose = this.onMaterialDispose.bind(this);
  }

  render(lights: Light[], scene: Object3D, camera: Camera): void {
    if (this.enabled === false) return;
    if (this.autoUpdate === false && this.needsUpdate === false) return;
    if (lights.length === 0) return;
    if (this.type === ShadowMap.PCFSoft) {
      warn("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.");
      this.type = ShadowMap.PCF;
    }
    const currentRenderTarget = this.renderer.getRenderTarget();
    const activeCubeFace = this.renderer.getActiveCubeFace();
    const activeMipmapLevel = this.renderer.getActiveMipmapLevel();
    try {
      const _state = this.renderer.state;
      // Set GL state for depth map.
      _state.setBlending(Blending.No);
      if (_state.buffers.depth.getReversed() === true) {
        _state.buffers.color.setClear(0, 0, 0, 0);
      } else {
        _state.buffers.color.setClear(1, 1, 1, 1);
      }
      _state.buffers.depth.setTest(true);
      _state.setScissorTest(false);
      // check for shadow map type changes
      const typeChanged = this._previousType !== this.type;
      // When shadow map type changes, materials need recompilation because sampler types change
      // (sampler2DShadow for PCF vs sampler2D for Basic)
      if (typeChanged) {
        scene.traverse(function (object: Object3D & { material?: Material | Material[] }) {
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => (mat.needsUpdate = true));
            } else {
              object.material.needsUpdate = true;
            }
          }
        });
      }
      // render depth map
      for (let i = 0, il = lights.length; i < il; i++) {
        const light = lights[i] as ShadowLight;
        const shadow = light.shadow;
        if (shadow === undefined) {
          warn("WebGLShadowMap:", light, "has no shadow.");
          continue;
        }
        if (!this.shadowRefs.has(shadow)) {
          const ref = new WeakRef(shadow);
          this.shadowRefs.set(shadow, ref);
          this.shadows.add(ref);
          this.shadowRegistry.register(shadow, ref, ref);
        }
        if (shadow.autoUpdate === false && shadow.needsUpdate === false) continue;
        this._shadowMapSize.copy(shadow.mapSize);
        const shadowFrameExtents = shadow.getFrameExtents();
        this._shadowMapSize.multiply(shadowFrameExtents);
        this._viewportSize.copy(shadow.mapSize);
        if (this._shadowMapSize.x > this._maxTextureSize || this._shadowMapSize.y > this._maxTextureSize) {
          if (this._shadowMapSize.x > this._maxTextureSize) {
            this._viewportSize.x = Math.floor(this._maxTextureSize / shadowFrameExtents.x);
            this._shadowMapSize.x = this._viewportSize.x * shadowFrameExtents.x;
            shadow.mapSize.x = this._viewportSize.x;
          }
          if (this._shadowMapSize.y > this._maxTextureSize) {
            this._viewportSize.y = Math.floor(this._maxTextureSize / shadowFrameExtents.y);
            this._shadowMapSize.y = this._viewportSize.y * shadowFrameExtents.y;
            shadow.mapSize.y = this._viewportSize.y;
          }
        }
        const reversedDepthBuffer = this.renderer.state.buffers.depth.getReversed();
        shadow.camera._reversedDepth = reversedDepthBuffer;
        if (shadow.map === null || typeChanged === true || this.shadowMapTypes.get(shadow) !== this.type) {
          if (shadow.map !== null) {
            if (shadow.map.depthTexture !== null) {
              shadow.map.depthTexture.dispose();
              shadow.map.depthTexture = null;
            }
            shadow.map.dispose();
          }
          if (this.type === ShadowMap.VSM) {
            if (light.isPointLight) {
              warn(
                "WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.",
              );
              continue;
            }
            shadow.map = new WebGLRenderTarget(this._shadowMapSize.x, this._shadowMapSize.y, {
              format: PixelFormat.RG,
              type: TextureType.HalfFloat,
              minFilter: TextureFilter.Linear,
              magFilter: TextureFilter.Linear,
              generateMipmaps: false,
            });
            shadow.map.texture.name = light.name + ".shadowMap";
            // Native depth texture for VSM - depth is captured here, then blurred into the color texture
            shadow.map.depthTexture = new DepthTexture(this._shadowMapSize.x, this._shadowMapSize.y, TextureType.Float);
            shadow.map.depthTexture.name = light.name + ".shadowMapDepth";
            shadow.map.depthTexture.format = PixelFormat.Depth;
            shadow.map.depthTexture.compareFunction = null; // For regular sampling (not shadow comparison)
            shadow.map.depthTexture.minFilter = TextureFilter.Nearest;
            shadow.map.depthTexture.magFilter = TextureFilter.Nearest;
          } else {
            if (light.isPointLight) {
              shadow.map = new WebGLCubeRenderTarget(this._shadowMapSize.x);
              shadow.map.depthTexture = new CubeDepthTexture(this._shadowMapSize.x, TextureType.UnsignedInt);
            } else {
              shadow.map = new WebGLRenderTarget(this._shadowMapSize.x, this._shadowMapSize.y);
              shadow.map.depthTexture = new DepthTexture(
                this._shadowMapSize.x,
                this._shadowMapSize.y,
                TextureType.UnsignedInt,
              );
            }
            shadow.map.depthTexture.name = light.name + ".shadowMap";
            shadow.map.depthTexture.format = PixelFormat.Depth;
            if (this.type === ShadowMap.PCF) {
              shadow.map.depthTexture.compareFunction = reversedDepthBuffer ? Compare.GreaterEqual : Compare.LessEqual;
              shadow.map.depthTexture.minFilter = TextureFilter.Linear;
              shadow.map.depthTexture.magFilter = TextureFilter.Linear;
            } else {
              shadow.map.depthTexture.compareFunction = null;
              shadow.map.depthTexture.minFilter = TextureFilter.Nearest;
              shadow.map.depthTexture.magFilter = TextureFilter.Nearest;
            }
          }
          shadow.camera.updateProjectionMatrix();
          this.shadowMapTypes.set(shadow, this.type);
        }
        if (
          shadow.map.isWebGLCubeRenderTarget !== true &&
          (shadow.map.width !== this._shadowMapSize.x || shadow.map.height !== this._shadowMapSize.y)
        ) {
          shadow.map.setSize(this._shadowMapSize.x, this._shadowMapSize.y);
        }
        // For cube render targets (PointLights), render all 6 faces. Sun lights
        // render one atlas viewport per cascade.
        const faceCount = shadow.map.isWebGLCubeRenderTarget ? 6 : shadow.getViewportCount();
        if (light.isPointLight !== true) shadow.updateMatrices(light, camera);
        const layers = (shadow.camera.layers.mask & 0xfffffffe) !== 0 ? shadow.camera.layers : camera.layers;
        for (let face = 0; face < faceCount; face++) {
          const shadowCamera = shadow.getCamera(face);
          if (light.isPointLight) {
            const camera = shadow.camera as PerspectiveCamera;
            const shadowMatrix: Matrix4 = shadow.matrix;
            const far = light.distance || camera.far;
            if (far !== camera.far) {
              camera.far = far;
              camera.updateProjectionMatrix();
            }
            _lightPositionWorld.setFromMatrixPosition(light.matrixWorld);
            camera.position.copy(_lightPositionWorld);
            _lookTarget.copy(camera.position);
            _lookTarget.add(_cubeDirections[face]);
            camera.up.copy(_cubeUps[face]);
            camera.lookAt(_lookTarget);
            camera.updateMatrixWorld();
            shadowMatrix.makeTranslation(-_lightPositionWorld.x, -_lightPositionWorld.y, -_lightPositionWorld.z);
            _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            shadow._frustum.setFromProjectionMatrix(_projScreenMatrix, camera.coordinateSystem, camera.reversedDepth);
          }
          // For cube render targets, render to each face separately
          if (shadow.map.isWebGLCubeRenderTarget) {
            this.renderer.setRenderTarget(shadow.map, face);
            this.renderer.clear();
          } else {
            // For 2D render targets, use viewports
            if (face === 0) {
              this.renderer.setRenderTarget(shadow.map);
              this.renderer.clear();
            }
            const viewport = shadow.getViewport(face);
            this._viewport.set(
              this._viewportSize.x * viewport.x,
              this._viewportSize.y * viewport.y,
              this._viewportSize.x * viewport.z,
              this._viewportSize.y * viewport.w,
            );
            _state.viewport(this._viewport);
          }
          this._frustum = shadow.getFrustum(face);
          this.renderObject(scene, camera, shadowCamera, light, layers, this.type);
        }
        // do blur pass for VSM
        if (shadow.isPointLightShadow !== true && this.type === ShadowMap.VSM) {
          this.VSMPass(shadow, camera);
        }
        shadow.needsUpdate = false;
      }
      this._previousType = this.type;
      this.needsUpdate = false;
    } finally {
      this.renderer.setRenderTarget(currentRenderTarget, activeCubeFace, activeMipmapLevel);
    }
  }
  private VSMPass(shadow: ShadowResource, camera: Camera) {
    const geometry = this.objects.update(this.fullScreenMesh);
    if (this.shadowMaterialVertical.defines.VSM_SAMPLES !== shadow.blurSamples) {
      this.shadowMaterialVertical.defines.VSM_SAMPLES = shadow.blurSamples;
      this.shadowMaterialHorizontal.defines.VSM_SAMPLES = shadow.blurSamples;
      this.shadowMaterialVertical.needsUpdate = true;
      this.shadowMaterialHorizontal.needsUpdate = true;
    }
    if (shadow.mapPass === null) {
      shadow.mapPass = new WebGLRenderTarget(this._shadowMapSize.x, this._shadowMapSize.y, {
        format: PixelFormat.RG,
        type: TextureType.HalfFloat,
      });
    } else if (shadow.mapPass.width !== shadow.map!.width || shadow.mapPass.height !== shadow.map!.height) {
      shadow.mapPass.setSize(shadow.map!.width, shadow.map!.height);
    }
    // vertical pass - read from native depth texture
    this.shadowMaterialVertical.uniforms.shadow_pass.value = shadow.map!.depthTexture;
    this.shadowMaterialVertical.uniforms.resolution.value.set(shadow.map!.width, shadow.map!.height);
    this.shadowMaterialVertical.uniforms.radius.value = shadow.radius;
    this.renderer.setRenderTarget(shadow.mapPass);
    this.renderer.clear();
    this.renderer.renderBufferDirect(camera, null, geometry, this.shadowMaterialVertical, this.fullScreenMesh, null);
    // horizontal pass
    this.shadowMaterialHorizontal.uniforms.shadow_pass.value = shadow.mapPass.texture;
    this.shadowMaterialHorizontal.uniforms.resolution.value.set(shadow.map!.width, shadow.map!.height);
    this.shadowMaterialHorizontal.uniforms.radius.value = shadow.radius;
    this.renderer.setRenderTarget(shadow.map);
    this.renderer.clear();
    this.renderer.renderBufferDirect(camera, null, geometry, this.shadowMaterialHorizontal, this.fullScreenMesh, null);
  }
  private getDepthMaterial(
    object: Object3D,
    material: Material & MaterialProperties,
    light: ShadowLight,
    type: ShadowMap,
  ) {
    let result: (Material & MaterialProperties) | null = null;
    const customMaterial = light.isPointLight === true ? object.customDistanceMaterial : object.customDepthMaterial;
    if (customMaterial !== undefined) {
      result = customMaterial;
    } else {
      result = light.isPointLight === true ? this._distanceMaterial : this._depthMaterial;
      if (
        (this.renderer.localClippingEnabled &&
          material.clipShadows === true &&
          Array.isArray(material.clippingPlanes) &&
          material.clippingPlanes.length !== 0) ||
        (material.displacementMap && material.displacementScale !== 0) ||
        (material.alphaMap && material.alphaTest > 0) ||
        (material.map && material.alphaTest > 0) ||
        material.alphaToCoverage === true
      ) {
        // in this case we need a unique material instance reflecting the
        // appropriate state
        const keyA = result.uuid,
          keyB = material.uuid;
        let materialsForVariant = this._materialCache[keyA];
        if (materialsForVariant === undefined) {
          materialsForVariant = {};
          this._materialCache[keyA] = materialsForVariant;
        }
        let cachedMaterial = materialsForVariant[keyB];
        if (cachedMaterial === undefined) {
          cachedMaterial = result.clone();
          materialsForVariant[keyB] = cachedMaterial;
          material.addEventListener("dispose", this.onMaterialDispose);
          this.materialSources.set(material.uuid, new WeakRef(material));
        }
        result = cachedMaterial;
      }
    }
    result.visible = material.visible;
    result.wireframe = material.wireframe;
    if (type === ShadowMap.VSM) {
      result.side = material.shadowSide !== null ? material.shadowSide : material.side;
    } else {
      result.side = material.shadowSide !== null ? material.shadowSide : this.shadowSide[material.side];
    }
    result.alphaMap = material.alphaMap;
    result.alphaTest = material.alphaToCoverage === true ? 0.5 : material.alphaTest; // approximate alphaToCoverage by using a fixed alphaTest value
    result.map = material.map;
    result.clipShadows = material.clipShadows;
    result.clippingPlanes = material.clippingPlanes;
    result.clipIntersection = material.clipIntersection;
    result.displacementMap = material.displacementMap;
    result.displacementScale = material.displacementScale;
    result.displacementBias = material.displacementBias;
    result.wireframeLinewidth = material.wireframeLinewidth;
    result.linewidth = material.linewidth;
    if (light.isPointLight === true && (result as MeshDistanceMaterial).isMeshDistanceMaterial === true) {
      const materialProperties = this.renderer.properties.get(result);
      materialProperties.light = light;
    }
    return result;
  }
  private renderObject(
    object: Object3D,
    camera: Camera,
    shadowCamera: Camera,
    light: ShadowLight,
    layers: Layers,
    type: ShadowMap,
  ) {
    if (object.visible === false) return;
    const visible = object.layers.test(layers);
    if (visible && ((object as Mesh).isMesh || (object as Line).isLine || (object as Points).isPoints)) {
      if (
        (object.castShadow || (object.receiveShadow && type === ShadowMap.VSM)) &&
        (!object.frustumCulled || (object as Mesh).intersectsFrustum(this._frustum))
      ) {
        object.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, object.matrixWorld);
        const geometry = this.objects.update(object as Mesh);
        const material = (object as Mesh).material;
        if (Array.isArray(material)) {
          const groups = geometry.groups;
          for (let k = 0, kl = groups.length; k < kl; k++) {
            const group = groups[k];
            const groupMaterial = material[group.materialIndex!];
            if (groupMaterial && groupMaterial.visible) {
              const depthMaterial = this.getDepthMaterial(object, groupMaterial, light, type);
              object.onBeforeShadow(this.renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
              this.renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, group);
              object.onAfterShadow(this.renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
            }
          }
        } else if (material.visible) {
          const depthMaterial = this.getDepthMaterial(object, material, light, type);
          object.onBeforeShadow(this.renderer, object, camera, shadowCamera, geometry, depthMaterial, null);
          this.renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, null);
          object.onAfterShadow(this.renderer, object, camera, shadowCamera, geometry, depthMaterial, null);
        }
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      this.renderObject(children[i], camera, shadowCamera, light, layers, type);
    }
  }
  private onMaterialDispose(event: { target: Material }) {
    const material = event.target;
    material.removeEventListener("dispose", this.onMaterialDispose);
    this.materialSources.delete(material.uuid);
    // make sure to remove the unique distance/depth materials used for shadow map rendering
    for (const id in this._materialCache) {
      const cache = this._materialCache[id];
      const uuid = event.target.uuid;
      if (uuid in cache) {
        const shadowMaterial = cache[uuid];
        shadowMaterial.dispose();
        delete cache[uuid];
      }
    }
  }
  dispose(): void {
    for (const ref of this.materialSources.values())
      ref.deref()?.removeEventListener("dispose", this.onMaterialDispose);
    this.materialSources.clear();
    for (const variant in this._materialCache) {
      for (const uuid in this._materialCache[variant]) this._materialCache[variant][uuid].dispose();
      delete this._materialCache[variant];
    }
    this._depthMaterial.dispose();
    this._distanceMaterial.dispose();
    this.shadowMaterialVertical.dispose();
    this.shadowMaterialHorizontal.dispose();
    this.fullScreenTri.dispose();
    // Light-owned targets survive; context restoration must refill even frozen maps.
    for (const ref of this.shadows) {
      const shadow = ref.deref();
      if (shadow !== undefined) {
        shadow.needsUpdate = true;
        this.shadowRefs.delete(shadow);
      }
      this.shadowRegistry.unregister(ref);
    }
    this.shadows.clear();
    this.needsUpdate = true;
  }
  private onShadowFinalize(ref: WeakRef<ShadowResource>): void {
    this.shadows.delete(ref);
  }
}
