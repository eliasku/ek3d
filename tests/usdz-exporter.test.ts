import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { USDZExporter } from "../src/addons/exporters/USDZExporter";
import type { USDZZipRuntime } from "../src/addons/exporters/USDZExporter";
import { AnimationClip } from "../src/animation/AnimationClip";
import { VectorKeyframeTrack } from "../src/animation/tracks/VectorKeyframeTrack";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshStandardMaterial } from "../src/materials/MeshStandardMaterial";
import { Mesh } from "../src/objects/Mesh";
import { Scene } from "../src/scenes/Scene";
import { Texture } from "../src/textures/Texture";

test("USDZ exports aligned geometry, textured material and animation through the injected ZIP runtime", async () => {
  const imageBytes = new Uint8Array([137, 80, 78, 71, 1]);
  class Canvas {
    width: number = 2;
    height: number = 2;
    getContext() {
      return { translate() {}, scale() {}, drawImage() {} };
    }
    toBlob(callback: (blob: Blob) => void) {
      callback(new Blob([imageBytes]));
    }
  }
  vi.stubGlobal("HTMLCanvasElement", Canvas);
  vi.stubGlobal("document", { createElement: () => new Canvas() });

  try {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    geometry.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    geometry.setIndex([0, 2, 1]);
    const texture = new Texture(new Canvas());
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.25 });
    const mesh = new Mesh(geometry, material);
    mesh.name = "Triangle";
    const scene = new Scene();
    scene.add(mesh);
    const clip = new AnimationClip("move", 1, [
      new VectorKeyframeTrack("Triangle.position", [0, 1], [0, 0, 0, 2, 3, 4]),
    ]);
    let files: Parameters<USDZZipRuntime["zipSync"]>[0] | undefined;
    let options: Parameters<USDZZipRuntime["zipSync"]>[1] | undefined;
    const archive = new Uint8Array([1, 2, 3]);
    const exporter = new USDZExporter({
      zipSync(input, settings) {
        files = input;
        options = settings;
        return archive;
      },
    });
    await exporter.parseAsync(scene, { animations: [clip], animationFrameRate: 24 });
    assert.ok(files);
    assert.ok(options);
    assert.equal(options.level, 0);
    assert.ok(options.mtime instanceof Date);
    const geometryName = `geometries/Geometry_${geometry.id}.usda`;
    const textureName = `textures/Texture_${texture.source.id}_${texture.flipY}.png`;
    assert.deepEqual(Object.keys(files), ["model.usda", geometryName, textureName]);

    let offset = 0;
    const contents: Record<string, Uint8Array> = {};
    for (const [name, entry] of Object.entries(files)) {
      const bytes = Array.isArray(entry) ? entry[0] : entry;
      const extra = Array.isArray(entry) ? entry[1].extra : {};
      const extraLength = Object.values(extra).reduce((sum, padding) => sum + 4 + padding.length, 0);
      offset += 30 + new TextEncoder().encode(name).length + extraLength;
      assert.equal(offset % 64, 0, `${name} data must be 64-byte aligned`);
      offset += bytes.length;
      contents[name] = bytes;
    }
    assert.deepEqual(contents[textureName], imageBytes);
    const model = new TextDecoder().decode(contents["model.usda"]);
    const meshData = new TextDecoder().decode(contents[geometryName]);
    assert.ok(model.includes(`@./${geometryName}@</Geometry>`));
    assert.ok(model.includes(`rel material:binding = </Materials/Material_${material.id}>`));
    assert.ok(model.includes(`asset inputs:file = @${textureName}@`));
    assert.ok(model.includes('string inputs:varname = "st"'));
    assert.ok(model.includes("float inputs:roughness = 0.25"));
    assert.ok(model.includes("timeCodesPerSecond = 24"));
    assert.ok(model.includes("endTimeCode = 24"));
    assert.ok(model.includes("float3 xformOp:translate.timeSamples"));
    assert.ok(model.includes("24.00000: (2.000000, 3.000000, 4.000000)"));
    assert.ok(meshData.includes("int[] faceVertexCounts = [3]"));
    assert.ok(meshData.includes("int[] faceVertexIndices = [0, 2, 1]"));
    assert.ok(
      meshData.includes(
        "point3f[] points = [(0.000000, 0.000000, 0.000000), (1.000000, 0.000000, 0.000000), (0.000000, 1.000000, 0.000000)]",
      ),
    );
    assert.ok(meshData.includes("texCoord2f[] primvars:st = [(0.000000, 1), (1.000000, 1), (0.000000, 0)]"));
  } finally {
    vi.unstubAllGlobals();
  }
});
