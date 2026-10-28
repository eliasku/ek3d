import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { VideoTexture } from "ek3d/textures/VideoTexture";
import { VideoFrameTexture } from "ek3d/textures/VideoFrameTexture";
import { FramebufferTexture } from "ek3d/textures/FramebufferTexture";
import { CompressedTexture } from "ek3d/textures/CompressedTexture";
import type { CompressedTextureMipmap, CompressedTextureFace } from "ek3d/textures/CompressedTexture";
import { CompressedArrayTexture } from "ek3d/textures/CompressedArrayTexture";
import { CompressedCubeTexture } from "ek3d/textures/CompressedCubeTexture";
import { DataTexture } from "ek3d/textures/DataTexture";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { RGBA_S3TC_DXT1_Format } from "ek3d/constants";

declare const canvas: HTMLCanvasElement;
declare const offscreen: OffscreenCanvas;
declare const video: HTMLVideoElement;
declare const frame: VideoFrame;
const canvasTexture: CanvasTexture = new CanvasTexture(canvas).clone();
new CanvasTexture(offscreen);
const canvasImage: HTMLCanvasElement | OffscreenCanvas | null = canvasTexture.image;
const videoTexture: VideoTexture = new VideoTexture(video).clone();
const videoFrames: VideoFrameTexture = new VideoFrameTexture().clone();
videoFrames.setFrame(frame);
const framebuffer: FramebufferTexture = new FramebufferTexture(4, 4).clone();
const width: number = framebuffer.image.width;
const mipmaps: CompressedTextureMipmap[] = [{ width: 4, height: 4, data: new Uint8Array(8) }];
const compressed: CompressedTexture = new CompressedTexture(mipmaps, 4, 4, RGBA_S3TC_DXT1_Format).clone();
const array: CompressedArrayTexture = new CompressedArrayTexture(mipmaps, 4, 4, 2, RGBA_S3TC_DXT1_Format).clone();
array.addLayerUpdate(1);
array.clearLayerUpdates();
const depth: number = array.image.depth;
const faces: CompressedTextureFace[] = Array.from({ length: 6 }, () => ({ width: 4, height: 4, mipmaps }));
const cube: CompressedCubeTexture = new CompressedCubeTexture(faces, RGBA_S3TC_DXT1_Format);
const face: CompressedTextureFace = cube.image[0];
// @ts-expect-error Canvas textures require a canvas, not video media.
new CanvasTexture(video);
// @ts-expect-error Video textures require an HTMLVideoElement.
new VideoTexture(canvas);
// @ts-expect-error Frames must be real WebCodecs frame objects.
videoFrames.setFrame(canvas);
// @ts-expect-error Compressed mip data is binary, not a JavaScript number array.
new CompressedTexture([{ width: 4, height: 4, data: [1, 2] }], 4, 4);
// @ts-expect-error Cube faces require dimensions and compressed mipmaps.
new CompressedCubeTexture([new Uint8Array(8)]);
// @ts-expect-error Layer identifiers are numeric.
array.addLayerUpdate("1");
// @ts-expect-error A type argument cannot change the image created by the constructor.
new CompressedTexture<CompressedTextureFace[]>(mipmaps, 4, 4);
// @ts-expect-error DepthTexture construction creates dimensions, not a cube-face array.
new DepthTexture<{ width: number; height: number; depth: number }[]>(4, 4);
// @ts-expect-error Copying pixel data cannot preserve a canvas image contract.
canvasTexture.copy(new DataTexture(new Uint8Array(4), 1, 1));
// @ts-expect-error Copying a canvas cannot preserve a typed pixel-data image contract.
new DataTexture(new Uint8Array(4), 1, 1).copy(canvasTexture);
void [canvasImage, videoTexture, width, compressed, depth, face];
