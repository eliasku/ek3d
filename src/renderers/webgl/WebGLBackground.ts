import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Material } from "../../materials/Material";
import type { Object3D } from "../../core/Object3D";
import type { WebGLEnvironmentProvider } from "./WebGLEnvironmentAccess";
import type { WebGLRenderer } from "../WebGLRenderer";
import { getEnvironment } from "./WebGLEnvironmentAccess";
import { backgroundShader } from "../shaders/BackgroundShader";
import { backgroundCubeShader } from "../shaders/BackgroundCubeShader";
import { BackSide, FrontSide, SRGBTransfer } from "../../constants";
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
export function WebGLBackground(
  renderer: WebGLRenderer,
  environments: WebGLEnvironmentProvider | null,
  state: WebGLBackgroundState,
  objects: WebGLBackgroundObjects,
  alpha: boolean,
  premultipliedAlpha: boolean,
): WebGLBackgroundSystem {
  const clearColor = new Color(0x000000);
  let clearAlpha = alpha === true ? 0 : 1;
  let planeMesh: any;
  let boxMesh: any;
  let currentBackground: any = null;
  let currentBackgroundVersion = 0;
  let currentTonemapping: any = null;
  function getBackground(scene: Object3D) {
    let background = (scene as any).isScene === true ? (scene as any).background : null;
    if (background && background.isTexture) {
      const usePMREM = (scene as any).backgroundBlurriness > 0; // use PMREM if the user wants to blur the background
      background = getEnvironment(environments, background, usePMREM);
    }
    return background;
  }
  function render(scene: Object3D) {
    let forceClear = false;
    const background = getBackground(scene);
    if (background === null) {
      setClear(clearColor, clearAlpha);
    } else if (background && background.isColor) {
      setClear(background, 1);
      forceClear = true;
    }
    if (renderer.autoClear || forceClear) {
      // buffers might not be writable which is required to ensure a correct clear
      state.buffers.depth.setTest(true);
      state.buffers.depth.setMask(true);
      state.buffers.color.setMask(true);
      renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    }
  }
  function addToRenderList(renderList: WebGLBackgroundRenderList, scene: Object3D) {
    const background = getBackground(scene);
    if (background && background.isCubeTexture) {
      if (boxMesh === undefined) {
        boxMesh = new Mesh(
          new BoxGeometry(1, 1, 1),
          new ShaderMaterial({
            name: "BackgroundCubeMaterial",
            uniforms: cloneUniforms(backgroundCubeShader.uniforms),
            vertexShader: backgroundCubeShader.vertexShader,
            fragmentShader: backgroundCubeShader.fragmentShader,
            side: BackSide,
            depthTest: false,
            depthWrite: false,
            fog: false,
            allowOverride: false,
          }),
        );
        boxMesh.geometry.deleteAttribute("normal");
        boxMesh.geometry.deleteAttribute("uv");
        boxMesh.onBeforeRender = function (this: any, renderer?: any, scene?: any, camera?: any) {
          this.matrixWorld.copyPosition(camera.matrixWorld);
        };
        // add "envMap" material property so the renderer can evaluate it like for built-in materials
        Object.defineProperty(boxMesh.material, "envMap", {
          get: function (this: any) {
            return this.uniforms.envMap.value;
          },
        });
        objects.update(boxMesh);
      }
      boxMesh.material.uniforms.envMap.value = background;
      boxMesh.material.uniforms.backgroundBlurriness.value = (scene as any).backgroundBlurriness;
      boxMesh.material.uniforms.backgroundIntensity.value = (scene as any).backgroundIntensity;
      // note: since the matrix is orthonormal, we can use the more-efficient transpose() in lieu of invert()
      boxMesh.material.uniforms.backgroundRotation.value
        .setFromMatrix4(_m1.makeRotationFromEuler((scene as any).backgroundRotation))
        .transpose();
      if (background.isRenderTargetTexture === false) {
        boxMesh.material.uniforms.backgroundRotation.value.premultiply(_m);
      }
      boxMesh.material.toneMapped = ColorManagement.getTransfer(background.colorSpace) !== SRGBTransfer;
      if (
        currentBackground !== background ||
        currentBackgroundVersion !== background.version ||
        currentTonemapping !== renderer.toneMapping
      ) {
        boxMesh.material.needsUpdate = true;
        currentBackground = background;
        currentBackgroundVersion = background.version;
        currentTonemapping = renderer.toneMapping;
      }
      boxMesh.layers.enableAll();
      // push to the pre-sorted opaque render list
      renderList.unshift(boxMesh, boxMesh.geometry, boxMesh.material, 0, 0, null);
    } else if (background && background.isTexture) {
      if (planeMesh === undefined) {
        planeMesh = new Mesh(
          new PlaneGeometry(2, 2),
          new ShaderMaterial({
            name: "BackgroundMaterial",
            uniforms: cloneUniforms(backgroundShader.uniforms),
            vertexShader: backgroundShader.vertexShader,
            fragmentShader: backgroundShader.fragmentShader,
            side: FrontSide,
            depthTest: false,
            depthWrite: false,
            fog: false,
            allowOverride: false,
          }),
        );
        planeMesh.geometry.deleteAttribute("normal");
        // add "map" material property so the renderer can evaluate it like for built-in materials
        Object.defineProperty(planeMesh.material, "map", {
          get: function (this: any) {
            return this.uniforms.t2D.value;
          },
        });
        objects.update(planeMesh);
      }
      planeMesh.material.uniforms.t2D.value = background;
      planeMesh.material.uniforms.backgroundIntensity.value = (scene as any).backgroundIntensity;
      planeMesh.material.toneMapped = ColorManagement.getTransfer(background.colorSpace) !== SRGBTransfer;
      if (background.matrixAutoUpdate === true) {
        background.updateMatrix();
      }
      planeMesh.material.uniforms.uvTransform.value.copy(background.matrix);
      if (
        currentBackground !== background ||
        currentBackgroundVersion !== background.version ||
        currentTonemapping !== renderer.toneMapping
      ) {
        planeMesh.material.needsUpdate = true;
        currentBackground = background;
        currentBackgroundVersion = background.version;
        currentTonemapping = renderer.toneMapping;
      }
      planeMesh.layers.enableAll();
      // push to the pre-sorted opaque render list
      renderList.unshift(planeMesh, planeMesh.geometry, planeMesh.material, 0, 0, null);
    }
  }
  function setClear(color: Color, alpha: number) {
    color.getRGB(_rgb, getUnlitUniformColorSpace(renderer));
    state.buffers.color.setClear(_rgb.r, _rgb.g, _rgb.b, alpha, premultipliedAlpha);
  }
  function dispose() {
    if (boxMesh !== undefined) {
      boxMesh.geometry.dispose();
      boxMesh.material.dispose();
      boxMesh = undefined;
    }
    if (planeMesh !== undefined) {
      planeMesh.geometry.dispose();
      planeMesh.material.dispose();
      planeMesh = undefined;
    }
  }
  return {
    getClearColor: function () {
      return clearColor;
    },
    setClearColor: function (color: Color | number | string, alpha: number = 1) {
      clearColor.set(color);
      clearAlpha = alpha;
      setClear(clearColor, clearAlpha);
    },
    getClearAlpha: function () {
      return clearAlpha;
    },
    setClearAlpha: function (alpha: number) {
      clearAlpha = alpha;
      setClear(clearColor, clearAlpha);
    },
    render: render,
    addToRenderList: addToRenderList,
    dispose: dispose,
  };
}
