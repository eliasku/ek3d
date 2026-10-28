import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { decompress } from "../src/addons/utils/WebGLTextureUtils";
import { RepeatWrapping, SRGBColorSpace } from "../src/constants";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";
import { CompressedTexture } from "../src/textures/CompressedTexture";

test("decompress preserves texture metadata without disposing the input or supplied renderer", () => {
  const draws: unknown[][] = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args: unknown[]) => draws.push(args) }) };
  vi.stubGlobal("document", { createElement: () => canvas });
  const texture = new CompressedTexture([], 32, 16);
  texture.name = "compressed";
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  let textureDisposed = false;
  texture.addEventListener("dispose", () => {
    textureDisposed = true;
  });
  const sizes: number[][] = [];
  let rendererDisposed = false;
  const renderer = {
    domElement: {},
    setSize: (width: number, height: number) => sizes.push([width, height]),
    clear: () => {},
    render: () => {},
    dispose: () => {
      rendererDisposed = true;
    },
    forceContextLoss: () => {
      rendererDisposed = true;
    },
  } as unknown as WebGLRenderer;
  try {
    const result = decompress(texture, 8, renderer);
    assert.deepEqual(sizes, [[8, 8]]);
    assert.equal(draws.length, 1);
    assert.equal(result.name, texture.name);
    assert.equal(result.colorSpace, texture.colorSpace);
    assert.equal(result.wrapS, texture.wrapS);
    assert.equal(textureDisposed, false);
    assert.equal(rendererDisposed, false);
    result.dispose();
  } finally {
    vi.unstubAllGlobals();
    texture.dispose();
  }
});
