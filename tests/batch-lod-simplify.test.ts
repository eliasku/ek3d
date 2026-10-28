import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  simplifyGeometry,
  simplifyGeometriesByErrorLOD,
  performanceRangeLOD,
  type MeshoptSimplifierRuntime,
} from "../src/addons/utils/SimplifyGeometryLOD";
import { TorusKnotGeometry } from "../src/geometries/TorusKnotGeometry";
import { BufferGeometry } from "../src/core/BufferGeometry";

test("meshoptimizer LODs preserve the source and decrease index count", async () => {
  const source = readFileSync("examples/public/examples/libs/meshoptimizer/meshopt_simplifier.js", "utf8");
  const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  // The public runtime is intentionally loaded outside the module graph.
  const module = (await import(/* @vite-ignore */ url)) as { MeshoptSimplifier: MeshoptSimplifierRuntime };
  const geometry = new TorusKnotGeometry(1, 0.4, 64, 16);
  const original = geometry.index!.count;
  const [levels] = await simplifyGeometriesByErrorLOD([geometry], 4, performanceRangeLOD, module.MeshoptSimplifier);
  assert.equal(levels.length, 5);
  assert.equal(levels[0], geometry);
  assert.equal(geometry.index!.count, original);
  assert.ok(levels[4].index!.count < original);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i].index!.count <= levels[i - 1].index!.count);
  await assert.rejects(simplifyGeometry(new BufferGeometry(), { ratio: 0 }, module.MeshoptSimplifier), /non-indexed/);
  for (const level of levels) level.dispose();
});
