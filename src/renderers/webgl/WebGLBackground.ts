import type { Camera } from "../../cameras/Camera";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Material } from "../../materials/Material";
import type { Object3D } from "../../core/Object3D";
import type { WebGLEnvironmentProvider } from "./WebGLEnvironmentAccess";
import type { WebGLRenderer } from "../WebGLRenderer";
import type { Scene } from "../../scenes/Scene";
import type { Texture } from "../../textures/Texture";
import type { CubeTexture } from "../../textures/CubeTexture";
import { getEnvironment } from "./WebGLEnvironmentAccess";
import { backgroundShader } from "../shaders/BackgroundShader";
import { backgroundCubeShader } from "../shaders/BackgroundCubeShader";
import { Side, Transfer } from "../../constants";
import { BoxGeometry } from "../../geometries/BoxGeometry";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Color } from "../../math/Color";
import { ColorManagement } from "../../math/ColorManagement";
import { Matrix3 } from "../../math/Matrix3";
import { Matrix4 } from "../../math/Matrix4";
import { Mesh } from "../../objects/Mesh";
import { cloneUniforms, getUnlitUniformColorSpace } from "../shaders/UniformsUtils";

export interface WebGLBackgroundState {
  buffers: {
    color: {
      setClear(r: number, g: number, b: number, a: number, premultipliedAlpha: boolean): void;
      setMask(value: boolean): void;
    };
    depth: { setTest(value: boolean): void; setMask(value: boolean): void };
  };
}
export interface WebGLBackgroundObjects {
  update(object: Mesh): BufferGeometry;
}
export interface WebGLBackgroundRenderList {
  unshift(object: Mesh, geometry: BufferGeometry, material: Material, groupOrder: number, z: number, group: null): void;
}
export interface WebGLBackgroundSystem {
  getClearColor(): Color;
  setClearColor(color: Color | number | string, alpha?: number): void;
  getClearAlpha(): number;
  setClearAlpha(alpha: number): void;
  render(scene: Object3D): void;
  addToRenderList(renderList: WebGLBackgroundRenderList, scene: Object3D): void;
  dispose(): void;
}
const _rgb = { r: 0, b: 0, g: 0 };
const _m1 = /*@__PURE__*/ new Matrix4();
const _m = /*@__PURE__*/ new Matrix3();
_m.set(-1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
export class WebGLBackground implements WebGLBackgroundSystem {
  private readonly renderer: WebGLRenderer;
  private readonly environments: WebGLEnvironmentProvider | null;
  private readonly state: WebGLBackgroundState;
  private readonly objects: WebGLBackgroundObjects;
  private readonly premultipliedAlpha: boolean;
  private readonly clearColor: Color = new Color(0x000000);
  private clearAlpha: number;
  private planeMesh: Mesh<ShaderMaterial> | undefined = undefined;
  private boxMesh: Mesh<ShaderMaterial> | undefined = undefined;
  private currentBackground: unknown = null;
  private currentBackgroundVersion: number = 0;
  private currentTonemapping: WebGLRenderer["toneMapping"] | null = null;

  constructor(
    renderer: WebGLRenderer,
    environments: WebGLEnvironmentProvider | null,
    state: WebGLBackgroundState,
    objects: WebGLBackgroundObjects,
    alpha: boolean,
    premultipliedAlpha: boolean,
  ) {
    this.renderer = renderer;
    this.environments = environments;
    this.state = state;
    this.objects = objects;
    this.premultipliedAlpha = premultipliedAlpha;
    this.clearAlpha = alpha === true ? 0 : 1;
    this.getClearColor = this.getClearColor.bind(this);
    this.setClearColor = this.setClearColor.bind(this);
    this.getClearAlpha = this.getClearAlpha.bind(this);
    this.setClearAlpha = this.setClearAlpha.bind(this);
    this.render = this.render.bind(this);
    this.addToRenderList = this.addToRenderList.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  private getBackground(scene: Object3D): Color | Texture | null {
    let background = (scene as Scene).isScene === true ? (scene as Scene).background : null;
    if (background && (background as Texture).isTexture) {
      const usePMREM = (scene as Scene).backgroundBlurriness > 0; // use PMREM if the user wants to blur the background
      background = getEnvironment(this.environments, background as Texture, usePMREM);
    }
    return background;
  }

  render(scene: Object3D): void {
    let forceClear = false;
    const background = this.getBackground(scene);
    if (background === null) {
      this.setClear(this.clearColor, this.clearAlpha);
    } else if (background && (background as Color).isColor) {
      this.setClear(background as Color, 1);
      forceClear = true;
    }
    if (this.renderer.autoClear || forceClear) {
      // buffers might not be writable which is required to ensure a correct clear
      this.state.buffers.depth.setTest(true);
      this.state.buffers.depth.setMask(true);
      this.state.buffers.color.setMask(true);
      this.renderer.clear(this.renderer.autoClearColor, this.renderer.autoClearDepth, this.renderer.autoClearStencil);
    }
  }

  addToRenderList(renderList: WebGLBackgroundRenderList, scene: Object3D): void {
    const background = this.getBackground(scene);
    if (background && (background as CubeTexture).isCubeTexture) {
      const texture = background as Texture;
      if (this.boxMesh === undefined) {
        this.boxMesh = new Mesh(
          new BoxGeometry(1, 1, 1),
          new ShaderMaterial({
            name: "BackgroundCubeMaterial",
            uniforms: cloneUniforms(backgroundCubeShader.uniforms),
            vertexShader: backgroundCubeShader.vertexShader,
            fragmentShader: backgroundCubeShader.fragmentShader,
            side: Side.Back,
            depthTest: false,
            depthWrite: false,
            fog: false,
            allowOverride: false,
          }),
        );
        this.boxMesh.geometry.deleteAttribute("normal");
        this.boxMesh.geometry.deleteAttribute("uv");
        this.boxMesh.onBeforeRender = function (
          this: Mesh,
          _renderer: WebGLRenderer,
          _scene: Object3D,
          camera: Camera,
        ) {
          this.matrixWorld.copyPosition(camera.matrixWorld);
        };
        // add "envMap" material property so the renderer can evaluate it like for built-in materials
        Object.defineProperty(this.boxMesh.material, "envMap", {
          get: function (this: ShaderMaterial) {
            return this.uniforms.envMap.value;
          },
        });
        this.objects.update(this.boxMesh);
      }
      this.boxMesh.material.uniforms.envMap.value = background;
      this.boxMesh.material.uniforms.backgroundBlurriness.value = (scene as Scene).backgroundBlurriness;
      this.boxMesh.material.uniforms.backgroundIntensity.value = (scene as Scene).backgroundIntensity;
      // note: since the matrix is orthonormal, we can use the more-efficient transpose() in lieu of invert()
      const backgroundRotation = this.boxMesh.material.uniforms.backgroundRotation.value as Matrix3;
      backgroundRotation.setFromMatrix4(_m1.makeRotationFromEuler((scene as Scene).backgroundRotation)).transpose();
      if (texture.isRenderTargetTexture === false) {
        backgroundRotation.premultiply(_m);
      }
      this.boxMesh.material.toneMapped = ColorManagement.getTransfer(texture.colorSpace) !== Transfer.SRGB;
      if (
        this.currentBackground !== background ||
        this.currentBackgroundVersion !== texture.version ||
        this.currentTonemapping !== this.renderer.toneMapping
      ) {
        this.boxMesh.material.needsUpdate = true;
        this.currentBackground = background;
        this.currentBackgroundVersion = texture.version;
        this.currentTonemapping = this.renderer.toneMapping;
      }
      this.boxMesh.layers.enableAll();
      // push to the pre-sorted opaque render list
      renderList.unshift(this.boxMesh, this.boxMesh.geometry, this.boxMesh.material, 0, 0, null);
    } else if (background && (background as Texture).isTexture) {
      const texture = background as Texture;
      if (this.planeMesh === undefined) {
        this.planeMesh = new Mesh(
          new PlaneGeometry(2, 2),
          new ShaderMaterial({
            name: "BackgroundMaterial",
            uniforms: cloneUniforms(backgroundShader.uniforms),
            vertexShader: backgroundShader.vertexShader,
            fragmentShader: backgroundShader.fragmentShader,
            side: Side.Front,
            depthTest: false,
            depthWrite: false,
            fog: false,
            allowOverride: false,
          }),
        );
        this.planeMesh.geometry.deleteAttribute("normal");
        // add "map" material property so the renderer can evaluate it like for built-in materials
        Object.defineProperty(this.planeMesh.material, "map", {
          get: function (this: ShaderMaterial) {
            return this.uniforms.t2D.value;
          },
        });
        this.objects.update(this.planeMesh);
      }
      this.planeMesh.material.uniforms.t2D.value = background;
      this.planeMesh.material.uniforms.backgroundIntensity.value = (scene as Scene).backgroundIntensity;
      this.planeMesh.material.toneMapped = ColorManagement.getTransfer(texture.colorSpace) !== Transfer.SRGB;
      if (texture.matrixAutoUpdate === true) {
        texture.updateMatrix();
      }
      (this.planeMesh.material.uniforms.uvTransform.value as Matrix3).copy(texture.matrix);
      if (
        this.currentBackground !== background ||
        this.currentBackgroundVersion !== texture.version ||
        this.currentTonemapping !== this.renderer.toneMapping
      ) {
        this.planeMesh.material.needsUpdate = true;
        this.currentBackground = background;
        this.currentBackgroundVersion = texture.version;
        this.currentTonemapping = this.renderer.toneMapping;
      }
      this.planeMesh.layers.enableAll();
      // push to the pre-sorted opaque render list
      renderList.unshift(this.planeMesh, this.planeMesh.geometry, this.planeMesh.material, 0, 0, null);
    }
  }

  private setClear(color: Color, alpha: number): void {
    color.getRGB(_rgb, getUnlitUniformColorSpace(this.renderer));
    this.state.buffers.color.setClear(_rgb.r, _rgb.g, _rgb.b, alpha, this.premultipliedAlpha);
  }

  dispose(): void {
    if (this.boxMesh !== undefined) {
      this.boxMesh.geometry.dispose();
      this.boxMesh.material.dispose();
      this.boxMesh = undefined;
    }
    if (this.planeMesh !== undefined) {
      this.planeMesh.geometry.dispose();
      this.planeMesh.material.dispose();
      this.planeMesh = undefined;
    }
  }

  getClearColor(): Color {
    return this.clearColor;
  }

  setClearColor(color: Color | number | string, alpha: number = 1): void {
    this.clearColor.set(color);
    this.clearAlpha = alpha;
    this.setClear(this.clearColor, this.clearAlpha);
  }

  getClearAlpha(): number {
    return this.clearAlpha;
  }

  setClearAlpha(alpha: number): void {
    this.clearAlpha = alpha;
    this.setClear(this.clearColor, this.clearAlpha);
  }
}
