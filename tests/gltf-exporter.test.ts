import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { GLTFExporter, type GLTFDocument } from "../src/addons/exporters/GLTFExporter";
import { Object3D } from "../src/core/Object3D";
import { Scene } from "../src/scenes/Scene";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Mesh } from "../src/objects/Mesh";

test("glTF exports visible scene nodes without reparenting and reports plugin errors", async () => {
  const scene = new Scene();
  scene.name = "source";
  const visible = new Object3D();
  visible.name = "visible";
  const hidden = new Object3D();
  hidden.name = "hidden";
  hidden.visible = false;
  scene.add(visible, hidden);
  const exporter = new GLTFExporter();
  const result = await new Promise<GLTFDocument | ArrayBuffer>((resolve) => exporter.parse(scene, resolve, null));
  assert.ok(!(result instanceof ArrayBuffer));
  assert.equal(result.scenes?.[0].name, "source");
  assert.equal(result.nodes?.length, 1);
  assert.equal(result.nodes?.[0].name, "visible");
  assert.equal(visible.parent, scene);
  assert.equal(hidden.parent, scene);

  const failure = new Error("plugin failed");
  const plugin = () => ({
    beforeParse: () => {
      throw failure;
    },
  });
  exporter.register(plugin);
  await assert.rejects(exporter.parseAsync(scene), (error: unknown) => error === failure);
  exporter.unregister(plugin);
  const all = await exporter.parseAsync(scene, { onlyVisible: false });
  assert.ok(!(all instanceof ArrayBuffer));
  assert.equal(all.nodes?.length, 2);
});

test("glTF restores caller geometry when material export fails", async () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const normal = new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2, 0, 0, 2]), 3);
  geometry.setAttribute("normal", normal);
  geometry.addGroup(0, 3, 0);
  const mesh = new Mesh(geometry, [new MeshBasicMaterial()]);
  const failure = new Error("material export failed");
  const exporter = new GLTFExporter().register(() => ({
    writeMaterialAsync: () => {
      assert.equal(geometry.getAttribute("normal"), normal);
      throw failure;
    },
  }));

  await assert.rejects(exporter.parseAsync(mesh, { binary: true }), (error: unknown) => error === failure);
  assert.equal(geometry.getIndex(), null);
  assert.equal(geometry.getAttribute("normal"), normal);
  assert.deepEqual(Array.from(normal.array), [0, 0, 2, 0, 0, 2, 0, 0, 2]);
});
