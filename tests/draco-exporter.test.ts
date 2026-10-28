import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { DRACOExporter } from "../src/addons/exporters/DRACOExporter";
import type { DracoEncoderModule } from "../src/addons/exporters/DRACOExporter";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { PointsMaterial } from "../src/materials/PointsMaterial";
import { Mesh } from "../src/objects/Mesh";
import { Points } from "../src/objects/Points";

test("Draco exporter passes geometry and options to an injected encoder and copies its output", async () => {
  const calls: unknown[][] = [];
  let destroyed = 0;
  class Encoder {
    SetSpeedOptions(...args: number[]): void {
      calls.push(["speed", ...args]);
    }
    SetEncodingMethod(method: number): void {
      calls.push(["method", method]);
    }
    SetAttributeQuantization(...args: number[]): void {
      calls.push(["quantization", ...args]);
    }
    EncodeMeshToDracoBuffer(): number {
      calls.push(["mesh"]);
      return 3;
    }
    EncodePointCloudToDracoBuffer(): number {
      calls.push(["points"]);
      return 3;
    }
  }
  class MeshBuilder {
    AddFloatAttributeToMesh(_mesh: object, type: number, count: number, size: number, values: ArrayLike<number>): void {
      calls.push(["attribute", type, count, size, Array.from(values)]);
    }
    AddFacesToMesh(_mesh: object, count: number, values: ArrayLike<number>): void {
      calls.push(["faces", count, Array.from(values)]);
    }
  }
  class PointCloudBuilder {
    AddFloatAttribute(_cloud: object, type: number, count: number, size: number, values: ArrayLike<number>): void {
      calls.push(["pointAttribute", type, count, size, Array.from(values)]);
    }
  }
  const runtime: DracoEncoderModule = {
    Encoder,
    MeshBuilder,
    PointCloudBuilder,
    Mesh: class {},
    PointCloud: class {},
    DracoInt8Array: class {
      GetValue(index: number): number {
        return [68, 82, 67][index];
      }
    },
    POSITION: 0,
    NORMAL: 1,
    COLOR: 2,
    TEX_COORD: 3,
    destroy: () => {
      destroyed++;
    },
  };
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute("color", new Float32BufferAttribute([1, 0, 0, 1, 0, 1, 0, 0.5, 0, 0, 1, 1], 4));
  const exporter = new DRACOExporter(runtime);
  assert.deepEqual(
    Array.from(
      await exporter.parseAsync(new Mesh(geometry, new MeshBasicMaterial()), { exportColor: true, encodeSpeed: 2 }),
    ),
    [68, 82, 67],
  );
  assert.deepEqual(
    calls.find((entry) => entry[0] === "faces"),
    ["faces", 1, [0, 1, 2]],
  );
  assert.deepEqual(
    calls.find((entry) => entry[0] === "speed"),
    ["speed", 2, 5],
  );
  assert.deepEqual(
    calls.find((entry) => entry[0] === "attribute" && entry[1] === 2),
    ["attribute", 2, 3, 4, [1, 0, 0, 1, 0, 1, 0, 0.5, 0, 0, 1, 1]],
  );
  assert.equal(destroyed, 4);
  calls.length = 0;
  geometry.setIndex([2, 1, 0]);
  await exporter.parseAsync(new Mesh(geometry, new MeshBasicMaterial()));
  assert.deepEqual(
    calls.find((entry) => entry[0] === "faces"),
    ["faces", 1, [2, 1, 0]],
  );
  calls.length = 0;
  await exporter.parseAsync(new Points(geometry, new PointsMaterial()));
  assert.ok(calls.some((entry) => entry[0] === "points"));
  assert.throws(() => exporter.parse(), /parseAsync/);
});

test("local Draco encoder produces a Draco stream", async () => {
  const source = readFileSync(
    new URL("../examples/public/examples/libs/draco/draco_encoder.js", import.meta.url),
    "utf8",
  );
  const module: { exports: unknown } = { exports: {} };
  runInNewContext(source, {
    module,
    exports: module.exports,
    process,
    require: createRequire(import.meta.url),
    __dirname: ".",
  });
  const createEncoder = module.exports as () => DracoEncoderModule | Promise<DracoEncoderModule>;
  const runtime = await createEncoder();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setIndex([0, 1, 2]);
  const output = await new DRACOExporter(runtime).parseAsync(new Mesh(geometry, new MeshBasicMaterial()));
  assert.equal(String.fromCharCode(...output.slice(0, 5)), "DRACO");
});

test("encoder resources are released when Draco rejects geometry", async () => {
  const source = readFileSync(
    new URL("../examples/public/examples/libs/draco/draco_encoder.js", import.meta.url),
    "utf8",
  );
  const module: { exports: unknown } = { exports: {} };
  runInNewContext(source, {
    module,
    exports: module.exports,
    process,
    require: createRequire(import.meta.url),
    __dirname: ".",
  });
  const createEncoder = module.exports as () => DracoEncoderModule | Promise<DracoEncoderModule>;
  const runtime = await createEncoder();
  const failure = new Error("face insertion failed");
  const released: object[] = [];
  const wrapped: DracoEncoderModule = Object.create(runtime);
  wrapped.MeshBuilder = class extends runtime.MeshBuilder {
    AddFacesToMesh(): void {
      throw failure;
    }
  };
  wrapped.destroy = (value: object): void => {
    released.push(value);
    runtime.destroy(value);
  };
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setIndex([0, 1, 2]);
  await assert.rejects(
    new DRACOExporter(wrapped).parseAsync(new Mesh(geometry, new MeshBasicMaterial())),
    (error: unknown) => error === failure,
  );
  assert.equal(released.length, 3);
  assert.equal(new Set(released).size, 3);
});
