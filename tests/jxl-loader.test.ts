import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { JXLLoader } from "../src/addons/loaders/JXLLoader";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("JPEG XL rejects unavailable HDR canvas instead of returning an LDR texture", async () => {
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
  await assert.rejects(new JXLLoader().parseAsync(new ArrayBuffer(0)), /float16 storage/);
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => ({ getContextAttributes: () => ({ colorType: "unorm8" }) }) }),
  });
  await assert.rejects(new JXLLoader().parseAsync(new ArrayBuffer(0)), /float16 storage/);
});

test("JPEG XL decode rejection releases its Blob URL and canvas storage", async () => {
  const canvas = {
    width: 300,
    height: 150,
    getContext: () => ({ globalHDRHeadroom: 0, getContextAttributes: () => ({ colorType: "float16" }) }),
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  const error = new Error("Unsupported image data");
  let imageURL = "";
  vi.stubGlobal(
    "Image",
    class {
      set src(value: string) {
        imageURL = value;
      }
      async decode(): Promise<never> {
        throw error;
      }
    },
  );
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  await assert.rejects(new JXLLoader().parseAsync(new ArrayBuffer(0)), (value) => value === error);
  assert.equal(revoke.mock.calls.length, 1);
  assert.equal(revoke.mock.calls[0][0], imageURL);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});
