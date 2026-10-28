import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { GLTFExporter } from "../src/addons/exporters/GLTFExporter";
import { Object3D } from "../src/core/Object3D";
import { Scene } from "../src/scenes/Scene";

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
  const result = await exporter.parseAsync(scene);
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
