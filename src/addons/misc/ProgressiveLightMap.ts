import type { Camera } from "../../cameras/Camera";
import { DoubleSide, FloatType, HalfFloatType } from "../../constants";
import { BufferAttribute } from "../../core/BufferAttribute";
import { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { Object3D } from "../../core/Object3D";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { Light } from "../../lights/Light";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import { MeshLambertMaterial } from "../../materials/MeshLambertMaterial";
import { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import type { Vector3 } from "../../math/Vector3";
import { Mesh } from "../../objects/Mesh";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { Scene } from "../../scenes/Scene";
import type { Texture } from "../../textures/Texture";

export interface LightMapBox {
  w: number;
  h: number;
  x: number;
  y: number;
  index: number;
}

type LightMapMaterial = MeshPhongMaterial | MeshBasicMaterial | MeshStandardMaterial | MeshLambertMaterial;
export type LightMapPacker = (boxes: LightMapBox[]) => { w: number; h: number };

/** Accumulates shadowed lighting into a packed, progressively refined UV lightmap. */
export class ProgressiveLightMap {
  readonly scene: Scene = new Scene();
  readonly progressiveLightMap1: WebGLRenderTarget;
  readonly progressiveLightMap2: WebGLRenderTarget;
  readonly uvMat: MeshPhongMaterial = new MeshPhongMaterial();
  readonly lightMapContainers: { basicMat: LightMapMaterial; object: Mesh<LightMapMaterial> }[] = [];
  readonly uv_boxes: LightMapBox[] = [];
  buffer1Active: boolean = false;
  firstUpdate: boolean = true;
  labelMesh: Mesh<MeshBasicMaterial> | null = null;
  blurringPlane: Mesh<MeshBasicMaterial> | null = null;
  private readonly previous: { value: Texture | null } = { value: null };
  private readonly averaging: { value: number } = { value: 100 };
  private readonly blurPrevious: { value: Texture | null } = { value: null };

  constructor(
    readonly renderer: WebGLRenderer,
    readonly potpack: LightMapPacker,
    readonly res: number = 1024,
  ) {
    const format =
      typeof navigator !== "undefined" && /(Android|iPad|iPhone|iPod)/g.test(navigator.userAgent)
        ? HalfFloatType
        : FloatType;
    this.progressiveLightMap1 = new WebGLRenderTarget(res, res, { type: format });
    this.progressiveLightMap2 = new WebGLRenderTarget(res, res, { type: format });
    this.progressiveLightMap2.texture.channel = 1;
    this.previous.value = this.progressiveLightMap1.texture;
    this.uvMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.trimEnd();
      shader.fragmentShader = shader.fragmentShader.trimEnd();
      shader.vertexShader =
        "attribute vec2 uv1;\n#define USE_LIGHTMAP\n#define LIGHTMAP_UV uv1\n" +
        shader.vertexShader.slice(0, -1) +
        " gl_Position = vec4((LIGHTMAP_UV - 0.5) * 2.0, 1.0, 1.0); }";
      const start = shader.fragmentShader.indexOf("void main() {");
      shader.fragmentShader =
        "#define USE_LIGHTMAP\n" +
        shader.fragmentShader.slice(0, start) +
        "uniform sampler2D previousShadowMap;\nuniform float averagingWindow;\n" +
        shader.fragmentShader.slice(start - 1, -1) +
        "\nvec3 texelOld = texture2D(previousShadowMap, vLightMapUv).rgb;\ngl_FragColor.rgb = mix(texelOld, gl_FragColor.rgb, 1.0/averagingWindow);\n}";
      shader.uniforms.previousShadowMap = this.previous;
      shader.uniforms.averagingWindow = this.averaging;
    };
  }

  addObjectsToLightMap(objects: Object3D[]): void {
    this.uv_boxes.length = 0;
    const padding = 3 / this.res;
    objects.forEach((object, index) => {
      if (object instanceof Light) {
        this.scene.attach(object);
        return;
      }
      if (
        !(object instanceof Mesh) ||
        !(
          object.material instanceof MeshPhongMaterial ||
          object.material instanceof MeshBasicMaterial ||
          object.material instanceof MeshStandardMaterial ||
          object.material instanceof MeshLambertMaterial
        )
      )
        return;
      if (!object.geometry.hasAttribute("uv")) {
        console.warn("THREE.ProgressiveLightMap: All lightmap objects need uvs.");
        return;
      }
      if (!object.geometry.hasAttribute("normal")) {
        console.warn("THREE.ProgressiveLightMap: All lightmap objects need normals.");
        return;
      }
      if (!this.blurringPlane) this.initializeBlurPlane();
      object.material.lightMap = this.progressiveLightMap2.texture;
      object.material.dithering = true;
      object.castShadow = object.receiveShadow = true;
      object.renderOrder = 1000 + index;
      this.uv_boxes.push({ w: 1 + padding * 2, h: 1 + padding * 2, x: 0, y: 0, index });
      this.lightMapContainers.push({ basicMat: object.material, object: object as Mesh<LightMapMaterial> });
    });
    const dimensions = this.potpack(this.uv_boxes);
    for (const box of this.uv_boxes) {
      const object = objects[box.index];
      if (!(object instanceof Mesh)) continue;
      const source = object.geometry.getAttribute("uv");
      if (!(source instanceof BufferAttribute || source instanceof InterleavedBufferAttribute)) continue;
      const uv1 = new BufferAttribute(new Float32Array(source.count * 2), 2);
      for (let i = 0; i < source.count; i++)
        uv1.setXY(
          i,
          (source.getX(i) + box.x + padding) / dimensions.w,
          (source.getY(i) + box.y + padding) / dimensions.h,
        );
      object.geometry.setAttribute("uv1", uv1);
      uv1.needsUpdate = true;
    }
  }

  update(camera: Camera, blendWindow = 100, blurEdges = true): void {
    if (!this.blurringPlane) return;
    const oldTarget = this.renderer.getRenderTarget();
    this.blurringPlane.visible = blurEdges;
    const saved = this.lightMapContainers.map(({ object }) => ({
      parent: object.parent,
      culled: object.frustumCulled,
    }));
    for (const { object } of this.lightMapContainers) this.scene.attach(object);
    if (this.firstUpdate) {
      this.renderer.compile(this.scene, camera);
      this.firstUpdate = false;
    }
    this.averaging.value = blendWindow;
    for (const { object } of this.lightMapContainers) {
      object.material = this.uvMat;
      object.frustumCulled = false;
    }
    const active = this.buffer1Active ? this.progressiveLightMap1 : this.progressiveLightMap2;
    const inactive = this.buffer1Active ? this.progressiveLightMap2 : this.progressiveLightMap1;
    this.renderer.setRenderTarget(active);
    this.previous.value = this.blurPrevious.value = inactive.texture;
    this.buffer1Active = !this.buffer1Active;
    this.renderer.render(this.scene, camera);
    this.lightMapContainers.forEach(({ object, basicMat }, i) => {
      object.frustumCulled = saved[i].culled;
      object.material = basicMat;
      saved[i].parent?.attach(object);
    });
    this.renderer.setRenderTarget(oldTarget);
  }

  showDebugLightmap(visible: boolean, position?: Vector3): void {
    if (!this.lightMapContainers.length) {
      console.warn("THREE.ProgressiveLightMap: Call .showDebugLightmap() after adding the objects.");
      return;
    }
    if (!this.labelMesh) {
      this.labelMesh = new Mesh(
        new PlaneGeometry(100, 100),
        new MeshBasicMaterial({ map: this.progressiveLightMap1.texture, side: DoubleSide }),
      );
      this.labelMesh.position.y = 250;
      this.lightMapContainers[0].object.parent?.add(this.labelMesh);
    }
    if (position) this.labelMesh.position.copy(position);
    this.labelMesh.visible = visible;
  }

  private initializeBlurPlane(): void {
    const material = new MeshBasicMaterial();
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.trimEnd();
      shader.fragmentShader = shader.fragmentShader.trimEnd();
      shader.vertexShader =
        "#define USE_UV\n" + shader.vertexShader.slice(0, -1) + " gl_Position = vec4((uv - 0.5) * 2.0, 1.0, 1.0); }";
      const start = shader.fragmentShader.indexOf("void main() {");
      shader.fragmentShader =
        "#define USE_UV\n" +
        shader.fragmentShader.slice(0, start) +
        "uniform sampler2D previousShadowMap;\nuniform float pixelOffset;\n" +
        shader.fragmentShader.slice(start - 1, -1) +
        ` gl_FragColor.rgb = (texture2D(previousShadowMap, vUv + vec2(pixelOffset, 0.0)).rgb + texture2D(previousShadowMap, vUv + vec2(0.0, pixelOffset)).rgb + texture2D(previousShadowMap, vUv + vec2(0.0, -pixelOffset)).rgb + texture2D(previousShadowMap, vUv + vec2(-pixelOffset, 0.0)).rgb + texture2D(previousShadowMap, vUv + vec2(pixelOffset, pixelOffset)).rgb + texture2D(previousShadowMap, vUv + vec2(-pixelOffset, pixelOffset)).rgb + texture2D(previousShadowMap, vUv + vec2(pixelOffset, -pixelOffset)).rgb + texture2D(previousShadowMap, vUv + vec2(-pixelOffset, -pixelOffset)).rgb)/8.0; }`;
      shader.uniforms.previousShadowMap = this.blurPrevious;
      shader.uniforms.pixelOffset = { value: 0.5 / this.res };
    };
    material.depthWrite = false;
    this.blurringPlane = new Mesh(new PlaneGeometry(1, 1), material);
    this.blurringPlane.name = "Blurring Plane";
    this.blurringPlane.frustumCulled = false;
    this.scene.add(this.blurringPlane);
  }

  dispose(): void {
    this.progressiveLightMap1.dispose();
    this.progressiveLightMap2.dispose();
    this.uvMat.dispose();
    if (this.blurringPlane) {
      this.blurringPlane.geometry.dispose();
      this.blurringPlane.material.dispose();
    }
    if (this.labelMesh) {
      this.labelMesh.removeFromParent();
      this.labelMesh.geometry.dispose();
      this.labelMesh.material.dispose();
    }
  }
}
