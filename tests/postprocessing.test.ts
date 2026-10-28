import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { EffectComposer } from "../src/addons/postprocessing/EffectComposer";
import { ShaderPass } from "../src/addons/postprocessing/ShaderPass";
import { CopyShader } from "../src/addons/shaders/CopyShader";

test("EffectComposer marks only the last enabled pass as renderToScreen", () => {
  const fakeRenderer = {
    getPixelRatio: () => 1,
    getSize: (target: { set(x: number, y: number): never }) => target.set(100, 50),
  };
  const composer = new EffectComposer(fakeRenderer as never);
  const first = new ShaderPass(CopyShader);
  const second = new ShaderPass(CopyShader);
  const third = new ShaderPass(CopyShader);
  composer.addPass(first);
  composer.addPass(second);
  composer.addPass(third);

  assert.ok(composer.isLastEnabledPass(2), "last pass must be last enabled");
  assert.ok(!composer.isLastEnabledPass(0), "an earlier pass is not the last enabled pass");

  second.enabled = false;
  third.enabled = false;
  assert.ok(composer.isLastEnabledPass(0), "disabling later passes promotes the first");

  composer.removePass(second);
  const index = composer.passes.indexOf(third);
  composer.insertPass(second, index);
  assert.equal(composer.passes.indexOf(second), index, "insertPass restores order");
});

test("ShaderPass clones shader uniforms and keeps the textureID contract", () => {
  const texture = { name: "tDiffuseTarget" };
  const pass = new ShaderPass(CopyShader);
  assert.notEqual(pass.uniforms, CopyShader.uniforms);
  assert.notEqual(pass.uniforms!.tDiffuse, CopyShader.uniforms.tDiffuse);
  pass.uniforms!.tDiffuse.value = texture;
  assert.notEqual(CopyShader.uniforms.tDiffuse.value, texture, "shader defaults must stay isolated");

  const named = new ShaderPass({ ...CopyShader, name: "NamedCopy" }, "tInput");
  assert.equal(pass.material!.name, "CopyShader");
  assert.equal(named.textureID, "tInput");
  assert.equal(named.material!.name, "NamedCopy");
});
