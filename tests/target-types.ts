import { WebGLArrayRenderTarget } from "ek3d/renderers/WebGLArrayRenderTarget";
import { WebGL3DRenderTarget } from "ek3d/renderers/WebGL3DRenderTarget";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { RenderTarget3D } from "ek3d/core/RenderTarget3D";
import { RenderTarget, type RenderTargetOptions } from "ek3d/core/RenderTarget";
import type { DataArrayTexture } from "ek3d/textures/DataArrayTexture";
import type { Data3DTexture } from "ek3d/textures/Data3DTexture";
import type { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { NearestFilter, RepeatWrapping } from "ek3d/constants";

const options: RenderTargetOptions = {
  depthBuffer: true,
  depthTexture: new DepthTexture(8, 4),
  minFilter: NearestFilter,
  magFilter: NearestFilter,
  wrapR: RepeatWrapping,
  flipY: false,
};
const array = new WebGLArrayRenderTarget(8, 4, 3, options);
const volume = new WebGL3DRenderTarget(8, 4, 3, options);
const common = new RenderTarget3D(8, 4, 3, { count: 2 });
const arrayTexture: DataArrayTexture = array.texture;
const volumeTexture: Data3DTexture = volume.texture;
const commonTexture: Data3DTexture = common.texture;
const arrayClone: WebGLArrayRenderTarget = array.clone().copy(array);
const volumeClone: WebGL3DRenderTarget = volume.clone().copy(volume);
const commonClone: RenderTarget3D = common.clone().copy(common);
const ordinaryClone: WebGLRenderTarget = new WebGLRenderTarget().clone();
array.setSize(16, 8, 4);
volume.setSize(16, 8, 4);
array.texture = arrayTexture;
volume.texture = volumeTexture;

export function targetConsumer(renderer: WebGLRenderer) {
  renderer.setRenderTarget(array, 2);
  renderer.setRenderTarget(volume, 1);
  const pixels = new Uint8Array(4);
  renderer.readRenderTargetPixels(array, 0, 0, 1, 1, pixels, 2);
  const pending = renderer.readRenderTargetPixelsAsync(volume, 0, 0, 1, 1, pixels, 1);
  renderer.setRenderTarget(null);
  return { pending, arrayClone, volumeClone, commonClone, ordinaryClone, commonTexture };
}

// @ts-expect-error target dimensions are numeric
new WebGLArrayRenderTarget("8", 4, 2);
// @ts-expect-error options do not accept arbitrary unknown keys
new WebGL3DRenderTarget(8, 4, 2, { notAnOption: true });
// @ts-expect-error depth attachment must be a DepthTexture
new RenderTarget3D(8, 4, 2, { depthTexture: volumeTexture });
// @ts-expect-error array target retains the array texture contract
array.texture = volumeTexture;
// @ts-expect-error ordinary target options are checked too
new WebGLRenderTarget(8, 4, { depthBuffer: "yes" });
// @ts-expect-error A type argument cannot change the plain texture created by this constructor.
new RenderTarget<DataArrayTexture>();
// @ts-expect-error Specialized attachments require their concrete target class.
new WebGLRenderTarget<Data3DTexture>();
