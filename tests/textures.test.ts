import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { CanvasTexture } from "../src/textures/CanvasTexture";
import { VideoTexture } from "../src/textures/VideoTexture";
import { VideoFrameTexture } from "../src/textures/VideoFrameTexture";
import { FramebufferTexture } from "../src/textures/FramebufferTexture";
import { CompressedTexture } from "../src/textures/CompressedTexture";
import { CompressedArrayTexture } from "../src/textures/CompressedArrayTexture";
import { CompressedCubeTexture } from "../src/textures/CompressedCubeTexture";
import { Texture } from "../src/textures/Texture";
import { DataTexture } from "../src/textures/DataTexture";
import { TextureSource } from "../src/textures/TextureSource";
import { CanvasTexture as UpstreamCanvas } from "../upstream/three.js/src/textures/CanvasTexture.js";
import { FramebufferTexture as UpstreamFramebuffer } from "../upstream/three.js/src/textures/FramebufferTexture.js";
import { CompressedTexture as UpstreamCompressed } from "../upstream/three.js/src/textures/CompressedTexture.js";
import { CompressedArrayTexture as UpstreamArray } from "../upstream/three.js/src/textures/CompressedArrayTexture.js";
import { CompressedCubeTexture as UpstreamCube } from "../upstream/three.js/src/textures/CompressedCubeTexture.js";
import { Wrapping, Mapping, TextureFilter, PixelFormat, ColorSpace, TextureType } from "../src/constants";

const mipmaps = () => [{ data: new Uint8Array(8), width: 4, height: 4 }];
const faces = () => Array.from({ length: 6 }, () => ({ width: 4, height: 4, mipmaps: mipmaps() }));

test("compressed cube preserves the upstream clone limitation and supports explicit copy", () => {
  const texture = new CompressedCubeTexture(faces());
  // Upstream JSDoc mislabels dimension/mipmap records as CompressedTexture instances.
  const upstreamFaces = faces() as unknown as UpstreamCompressed[];
  const upstream = new UpstreamCube(upstreamFaces);
  assert.throws(() => texture.clone(), TypeError);
  assert.throws(() => upstream.clone(), TypeError);
  const copy = new CompressedCubeTexture(faces()).copy(texture);
  assert.equal(copy.source, texture.source);
  assert.equal(copy.image, texture.image);
});

test("texture defaults preserve upstream upload, mip, sampling and color contracts", () => {
  // Upstream JSDoc names textures, but its constructor and WebGL uploader consume dimension/mipmap records.
  const upstreamFaces = faces() as unknown as UpstreamCompressed[];
  const pairs = [
    [new CanvasTexture(), new UpstreamCanvas()],
    [new FramebufferTexture(8, 4), new UpstreamFramebuffer(8, 4)],
    [new CompressedTexture(mipmaps(), 4, 4), new UpstreamCompressed(mipmaps(), 4, 4)],
    [new CompressedArrayTexture(mipmaps(), 4, 4, 2), new UpstreamArray(mipmaps(), 4, 4, 2)],
    [new CompressedCubeTexture(faces()), new UpstreamCube(upstreamFaces)],
  ] as const;
  for (const [actual, expected] of pairs) {
    for (const key of [
      "wrapS",
      "wrapT",
      "magFilter",
      "minFilter",
      "format",
      "type",
      "mapping",
      "generateMipmaps",
      "flipY",
      "colorSpace",
      "version",
    ] as const)
      assert.equal(actual[key], expected[key], `${actual.constructor.name}.${key}`);
    assert.equal(actual.source.version, expected.source.version);
  }
  const texture = new CompressedTexture(mipmaps(), 4, 4, PixelFormat.RGBA_S3TC_DXT1, TextureType.UnsignedByte);
  assert.equal(texture.version, 0);
  assert.equal(texture.generateMipmaps, false);
  assert.equal(texture.flipY, false);
  texture.needsUpdate = true;
  assert.equal(texture.version, 1);
  assert.equal(texture.source.version, 1);
  texture.colorSpace = ColorSpace.SRGB;
  texture.wrapS = Wrapping.Repeat;
  const clone = texture.clone();
  assert.equal(clone.colorSpace, ColorSpace.SRGB);
  assert.equal(clone.wrapS, Wrapping.Repeat);
  assert.equal(clone.source, texture.source);
  assert.notEqual(clone.mipmaps, texture.mipmaps);
  assert.equal(clone.mipmaps[0].data, texture.mipmaps[0].data);
  assert.equal(new CompressedCubeTexture(faces()).mapping, Mapping.CubeReflection);
});

test("canvas CPU backing is caller-owned while framebuffer copies have independent dimensions", () => {
  const canvas = { width: 8, height: 4 } as HTMLCanvasElement;
  const texture = new CanvasTexture(canvas);
  assert.equal(texture.image, canvas);
  assert.equal(texture.version, 1);
  const copy = texture.clone();
  assert.equal(copy.source, texture.source);
  let disposals = 0;
  texture.addEventListener("dispose", () => disposals++);
  texture.dispose();
  assert.equal(disposals, 1);
  assert.equal(canvas.width, 8);
  assert.equal(copy.image, canvas);
  const framebuffer = new FramebufferTexture(8, 4);
  const framebufferCopy = framebuffer.clone();
  assert.notEqual(framebufferCopy.source, framebuffer.source);
  assert.notEqual(framebufferCopy.image, framebuffer.image);
  framebufferCopy.image.width = 16;
  assert.equal(framebuffer.image.width, 8);
  assert.equal(framebuffer.minFilter, TextureFilter.Nearest);
  assert.equal(framebuffer.magFilter, TextureFilter.Nearest);
});

test("compressed array update sets are per texture and copy preserves wrapR", () => {
  const first = new CompressedArrayTexture(mipmaps(), 4, 4, 2);
  assert.equal(first.wrapR, Wrapping.ClampToEdge);
  first.wrapR = Wrapping.Repeat;
  first.addLayerUpdate(1);
  first.addLayerUpdate(1);
  assert.deepEqual([...first.layerUpdates], [1]);
  assert.equal(first.version, 0, "marking a layer does not request an upload");
  const second = first.clone();
  assert.equal(second.wrapR, Wrapping.Repeat);
  assert.notEqual(second.layerUpdates, first.layerUpdates);
  assert.equal(second.layerUpdates.size, 0);
  first.clearLayerUpdates();
  assert.equal(first.layerUpdates.size, 0);
  assert.equal(second.source, first.source);
});

test("video callbacks reschedule and disposal cancels only the owned callback", () => {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  const cancelled: number[] = [];
  const video = {
    requestVideoFrameCallback(callback: () => void) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancelVideoFrameCallback(id: number) {
      cancelled.push(id);
      callbacks.delete(id);
    },
  } as unknown as HTMLVideoElement;
  const texture = new VideoTexture(video);
  assert.equal(texture.generateMipmaps, false);
  assert.equal(texture.minFilter, TextureFilter.Linear);
  assert.equal(texture.magFilter, TextureFilter.Linear);
  callbacks.get(1)!();
  assert.equal(texture.version, 1);
  assert.ok(callbacks.has(2));
  texture.update();
  assert.equal(texture.version, 1, "rVFC path must not also poll");
  const clone = texture.clone();
  assert.equal(clone.image, video);
  assert.ok(callbacks.has(3));
  texture.dispose();
  assert.deepEqual(cancelled, [2]);
  texture.dispose();
  assert.deepEqual(cancelled, [2]);
  clone.dispose();
  assert.deepEqual(cancelled, [2, 3]);
});

test("video fallback polls current data and frame textures never close caller-owned frames", () => {
  const video = { readyState: 1, HAVE_CURRENT_DATA: 2 } as HTMLVideoElement;
  const texture = new VideoTexture(video);
  texture.update();
  assert.equal(texture.version, 0);
  Object.assign(video, { readyState: 2 });
  texture.update();
  assert.equal(texture.version, 1);
  let closes = 0;
  const frame = {
    close() {
      closes++;
    },
  } as unknown as VideoFrame;
  const frames = new VideoFrameTexture();
  frames.update();
  assert.equal(frames.version, 0);
  frames.setFrame(frame);
  assert.equal(frames.image, frame);
  assert.equal(frames.version, 1);
  const clone = frames.clone();
  assert.equal(clone.source, frames.source);
  frames.setFrame({
    close() {
      closes++;
    },
  } as unknown as VideoFrame);
  frames.dispose();
  clone.dispose();
  assert.equal(closes, 0);
});

test("texture fields retain source-backed image accessors and immutable hidden identifiers", () => {
  const image = { data: new Uint8Array(4), width: 1, height: 1 };
  const texture = new DataTexture(image.data, image.width, image.height);
  const source = texture.source;
  assert.equal(Object.hasOwn(texture, "image"), false);
  texture.image = image;
  assert.equal(texture.source, source);
  assert.equal(source.data, image);
  const replacement = { data: new Uint8Array(8), width: 2, height: 1 };
  source.data = replacement;
  assert.equal(texture.image, replacement);
  const version = texture.version;
  const sourceVersion = source.version;
  texture.needsUpdate = true;
  assert.equal(texture.version, version + 1);
  assert.equal(source.version, sourceVersion + 1);
  assert.equal(Object.hasOwn(texture, "needsUpdate"), false);
  for (const resource of [new Texture(), texture, new TextureSource()]) {
    assert.deepEqual(Object.getOwnPropertyDescriptor(resource, "id"), {
      value: resource.id,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
});

test("texture clone and copy preserve further-derived types without clone declarations", () => {
  class CustomCanvasTexture extends CanvasTexture {
    label: string = "custom";
  }
  const canvas = { width: 4, height: 2 } as HTMLCanvasElement;
  const texture = new CustomCanvasTexture(canvas);
  const cloned: CustomCanvasTexture = texture.clone();
  const target = new CustomCanvasTexture();
  target.label = "local";
  const copied: CustomCanvasTexture = target.copy(new CanvasTexture(canvas));
  assert.ok(cloned instanceof CustomCanvasTexture);
  assert.ok(copied instanceof CustomCanvasTexture);
  assert.equal(cloned.image, canvas);
  assert.equal(copied.image, canvas);
  assert.equal(cloned.label, "custom");
  assert.equal(copied.label, "local", "copy only transfers texture payload, not subclass-only state");
});
