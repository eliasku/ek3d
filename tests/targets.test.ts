import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { WebGLArrayRenderTarget } from "../src/renderers/WebGLArrayRenderTarget";
import { WebGL3DRenderTarget } from "../src/renderers/WebGL3DRenderTarget";
import { WebGLCubeRenderTarget } from "../src/renderers/WebGLCubeRenderTarget";
import { RenderTarget } from "../src/core/RenderTarget";
import { RenderTarget3D } from "../src/core/RenderTarget3D";
import { DepthTexture } from "../src/textures/DepthTexture";
import { WebGLArrayRenderTarget as UpstreamArray } from "../upstream/three.js/src/renderers/WebGLArrayRenderTarget.js";
import { WebGL3DRenderTarget as Upstream3D } from "../upstream/three.js/src/renderers/WebGL3DRenderTarget.js";
import { RenderTarget3D as UpstreamCommon } from "../upstream/three.js/src/core/RenderTarget3D.js";
import { NearestFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from "../src/constants";

const pairs = [
  [WebGLArrayRenderTarget, UpstreamArray],
  [WebGL3DRenderTarget, Upstream3D],
  [RenderTarget3D, UpstreamCommon],
] as const;

for (const [Target, Upstream] of pairs) {
  test(`${Target.name} preserves upstream dimensions, sampling and option defaults`, () => {
    const options = { minFilter: NearestFilter, magFilter: NearestFilter, wrapR: RepeatWrapping, depthBuffer: false };
    const actual = new Target(7, 5, 3, options);
    const expected = new Upstream(7, 5, 3, options);
    assert.deepEqual([actual.width, actual.height, actual.depth], [expected.width, expected.height, expected.depth]);
    assert.deepEqual(actual.texture.image, expected.texture.image);
    for (const key of ["minFilter", "magFilter", "wrapR", "generateMipmaps", "flipY", "format", "type"] as const)
      assert.equal(actual.texture[key], Reflect.get(expected.texture, key), key);
    assert.equal(actual.texture.isRenderTargetTexture, true);
    assert.equal(actual.texture.renderTarget, actual);
    assert.equal(actual.texture.format, RGBAFormat);
    assert.equal(actual.texture.type, UnsignedByteType);
    assert.equal(actual.depthBuffer, false);
    assert.deepEqual(actual.viewport.toArray(), [0, 0, 7, 5]);
    assert.deepEqual(actual.scissor.toArray(), [0, 0, 7, 5]);
    const defaults = new Target();
    assert.deepEqual([defaults.width, defaults.height, defaults.depth], [1, 1, 1]);
    assert.equal(defaults.depthBuffer, true);
  });

  test(`${Target.name} resize invalidates only changed storage and preserves volume identity`, () => {
    const target = new Target(7, 5, 3);
    const upstream = new Upstream(7, 5, 3);
    const texture = target.texture;
    let disposals = 0;
    target.addEventListener("dispose", () => disposals++);
    target.setSize(7, 5, 3);
    assert.equal(disposals, 0);
    target.viewport.set(1, 2, 3, 4);
    target.setSize(9, 4, 2);
    upstream.setSize(9, 4, 2);
    assert.equal(disposals, 1);
    assert.equal(target.texture, texture);
    assert.deepEqual(target.texture.image, upstream.texture.image);
    assert.equal(target.texture.isArrayTexture, upstream.texture.isArrayTexture);
    assert.deepEqual(target.viewport.toArray(), [0, 0, 9, 4]);
    assert.deepEqual(target.scissor.toArray(), [0, 0, 9, 4]);
    target.setSize(9, 4);
    assert.equal(target.depth, 1, "omitted depth resets to one, as upstream");
    assert.equal(disposals, 2);
    target.dispose();
    assert.equal(disposals, 3);
    assert.equal(target.texture, texture, "dispose keeps CPU attachment for reallocation");
  });

  test(`${Target.name} clone/copy separate attachment storage and preserve depth ownership`, () => {
    const target = new Target(7, 5, 3);
    const depth = new DepthTexture(7, 5);
    target.depthTexture = depth;
    target.scissorTest = true;
    target.texture.wrapR = RepeatWrapping;
    const copy = target.clone();
    assert.ok(copy instanceof Target);
    assert.notEqual(copy.texture, target.texture);
    assert.notEqual(copy.texture.source, target.texture.source);
    assert.notEqual(copy.texture.image, target.texture.image);
    assert.deepEqual(copy.texture.image, target.texture.image);
    assert.equal(copy.texture.renderTarget, copy);
    assert.equal(copy.texture.wrapR, RepeatWrapping);
    assert.equal(copy.scissorTest, true);
    assert.notEqual(copy.depthTexture, depth);
    assert.equal(copy.depthTexture?.renderTarget, copy);
    assert.equal(depth.renderTarget, target);
    copy.setSize(2, 3, 4);
    assert.equal(target.texture.image.width, 7);
    const destination = new Target();
    assert.equal(destination.copy(target), destination);
    assert.equal(destination.depth, 3);
    const borrowing = new Target(7, 5, 3);
    borrowing.depthTexture = depth;
    assert.equal(borrowing.clone().depthTexture, depth, "borrowed depth stays with its original owner");
    borrowing.depthTexture = null;
    assert.equal(depth.renderTarget, target);
    target.depthTexture = null;
    assert.equal(depth.renderTarget, null);
  });
}

test("specialized WebGL targets keep attachment accessors and subtype-preserving clone methods", () => {
  const descriptor = Object.getOwnPropertyDescriptor(RenderTarget.prototype, "texture");
  assert.equal(typeof descriptor?.get, "function");
  assert.equal(typeof descriptor?.set, "function");
  for (const Target of [WebGLArrayRenderTarget, WebGL3DRenderTarget, WebGLCubeRenderTarget]) {
    const specialized = Object.getOwnPropertyDescriptor(Target.prototype, "texture");
    assert.equal(typeof specialized?.get, "function");
    assert.equal(typeof specialized?.set, "function");
    const target = new Target();
    assert.equal(Object.hasOwn(target, "texture"), false);
    assert.equal(Object.hasOwn(Target.prototype, "clone"), false);
    const replacement = target.texture.clone();
    Reflect.set(target, "texture", replacement);
    assert.equal(target.texture, replacement);
    assert.equal(target.textures[0], replacement);
    assert.equal(Object.hasOwn(target, "texture"), false);
    const cloned = target.clone();
    assert.ok(cloned instanceof Target);
    assert.equal(cloned.texture.constructor, target.texture.constructor);
  }
});

test("common RenderTarget3D creates independently owned volume MRT attachments", () => {
  const target = new RenderTarget3D(4, 3, 2, { count: 2 });
  const clone = target.clone();
  assert.equal(target.textures.length, 2);
  for (let index = 0; index < 2; index++) {
    assert.equal(target.textures[index].renderTarget, target);
    assert.equal(clone.textures[index].renderTarget, clone);
    assert.notEqual(clone.textures[index].source, target.textures[index].source);
    assert.notEqual(clone.textures[index].image, target.textures[index].image);
  }
});
