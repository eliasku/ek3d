import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { createLandingSculpture, updateLandingSculpture } from "../examples/landing-sculpture";
import { MeshPhysicalMaterial } from "../src/materials/MeshPhysicalMaterial";
import { Vector3 } from "../src/math/Vector3";

test("landing metaballs stay bounded and outward-facing through motion and separation", () => {
  const material = new MeshPhysicalMaterial();
  const surface = createLandingSculpture(material);
  const initial = surface.positionArray.slice(0, surface.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const normal = new Vector3();
  const face = new Vector3();
  const visited = new Uint8Array(surface.field.length);
  const pending: number[] = [];
  const neighbours = [1, -1, surface.size, -surface.size, surface.size2, -surface.size2];
  try {
    for (const seconds of [0, 8, 25, 60, 200]) {
      for (const energy of [0, 0.5, 1]) {
        updateLandingSculpture(surface, seconds, energy);
        assert.ok(surface.count <= surface.positionArray.length / 3, "the surface must fit its GPU buffer");
        let volume = 0;
        for (let i = 0; i < surface.count; i++) {
          a.fromArray(surface.positionArray, i * 3);
          normal.fromArray(surface.normalArray, i * 3);
          assert.ok(Number.isFinite(a.lengthSq()) && Number.isFinite(normal.lengthSq()));
          assert.ok(normal.lengthSq() > 1e-6, "the surface gradient must define a usable normal");
          assert.ok(Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)) < 0.94, "no lobe may hit the grid boundary");
        }
        for (let i = 0; i < surface.count; i += 3) {
          a.fromArray(surface.positionArray, i * 3);
          b.fromArray(surface.positionArray, (i + 1) * 3);
          c.fromArray(surface.positionArray, (i + 2) * 3);
          volume += a.dot(face.crossVectors(b, c)) / 6;
          face.crossVectors(b.sub(a), c.sub(a));
          normal.fromArray(surface.normalArray, i * 3);
          // Pinching cells can span opposing gradients; check winding in the stable states.
          if (energy !== 0.5 && face.lengthSq() > 1e-14) {
            assert.ok(face.dot(normal) > 0, "winding must agree with the field gradient");
          }
        }
        assert.ok(volume > 0.08 && volume < 0.8, "the closed lobes must retain their visible volume");
        if (energy !== 0.5) {
          visited.fill(0);
          let components = 0;
          for (let cell = 0; cell < surface.field.length; cell++) {
            if (visited[cell] || surface.field[cell] < surface.isolation) continue;
            components++;
            visited[cell] = 1;
            pending.push(cell);
            while (pending.length > 0) {
              const current = pending.pop()!;
              for (const offset of neighbours) {
                const next = current + offset;
                if (
                  next < 0 ||
                  next >= surface.field.length ||
                  visited[next] ||
                  surface.field[next] < surface.isolation
                ) {
                  continue;
                }
                visited[next] = 1;
                pending.push(next);
              }
            }
          }
          if (energy === 0) assert.equal(components, 1, "idle must remain one connected drop");
          else assert.ok(components >= 3, "holding must visibly separate the drop");
        }
      }
    }
    updateLandingSculpture(surface, 0, 0);
    assert.deepEqual(
      surface.positionArray.slice(0, surface.count * 3),
      initial,
      "reset must not retain earlier fields",
    );
  } finally {
    surface.geometry.dispose();
    material.dispose();
  }
});
