import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import ts from "typescript6";
import { dependencyGraph, cycles, parse } from "../scripts/module-graph";
import { build } from "vite-plus";

const root = new URL("../", import.meta.url);

test("source-first consumers resolve canonical subpaths and cannot import the package root", () => {
  assert.equal(import.meta.resolve("ek3d/math/Vector3"), new URL("src/math/Vector3.ts", root).href);
  assert.throws(() => import.meta.resolve("ek3d"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
  for (const subpath of [
    "renderers/webxr/WebXRManager",
    "renderers/webxr/WebXRController",
    "renderers/webxr/WebXRDepthSensing",
    "renderers/webgpu/WebGPURenderer",
    "cameras/StereoCamera",
  ]) {
    // Wildcard exports may resolve a URL even when the target does not exist.
    assert.equal(existsSync(fileURLToPath(import.meta.resolve(`ek3d/${subpath}`))), false, subpath);
  }
});

test("published implementation graph has no re-exports, runtime cycles or upstream imports", async () => {
  const modules = new Map<string, string>();
  for (const name of await readdir(new URL("src/", root), { recursive: true })) {
    if (!name.endsWith(".ts")) continue;
    assert.notEqual(name.split("/").pop(), "index.ts");
    const text = await readFile(new URL(`src/${name}`, root), "utf8");
    assert.doesNotMatch(name, /(?:^|\/)(?:webxr|webgpu|common|nodes|tsl)\//, `${name}: backend module`);
    if (name === "renderers/WebGLRenderer.ts")
      assert.doesNotMatch(text, /\bdiagnostics\b/, `${name}: node-backend shader diagnostics`);
    const file = parse(name, text);
    const removedMembers: Record<string, readonly string[]> = {
      BufferAttribute: ["dispose"],
      BufferGeometry: ["indirect", "indirectOffset", "getIndirect", "setIndirect"],
      Object3D: ["static"],
      Mesh: ["count"],
      WebGLRenderer: ["xr"],
    };
    const checkMembers = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) && node.name) {
        const removed = removedMembers[node.name.text] ?? [];
        for (const member of node.members)
          if (member.name)
            assert.ok(!removed.includes(member.name.getText(file)), `${name}: removed ${member.name.getText(file)}`);
      }
      ts.forEachChild(node, checkMembers);
    };
    checkMembers(file);
    const imports = new Set<string>();
    for (const statement of file.statements) {
      if (ts.isImportDeclaration(statement)) {
        assert.ok(ts.isStringLiteral(statement.moduleSpecifier), `${name}: nonliteral import`);
        const specifier = statement.moduleSpecifier.text;
        assert.ok(specifier.startsWith("."), `${name}: ${specifier}`);
        assert.ok(!/\.(?:js|ts)$/.test(specifier), `${name}: extensionful ${specifier}`);
        if (statement.importClause?.name) imports.add(statement.importClause.name.text);
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) imports.add(item.name.text);
        else if (bindings) imports.add(bindings.name.text);
      }
    }
    for (const statement of file.statements) {
      if (ts.isExportDeclaration(statement)) {
        assert.equal(statement.moduleSpecifier, undefined, `${name}: re-export`);
        assert.ok(statement.exportClause && ts.isNamedExports(statement.exportClause), `${name}: aggregate export`);
        for (const item of statement.exportClause.elements)
          assert.ok(
            !imports.has((item.propertyName ?? item.name).text),
            `${name}: imported declaration exported again`,
          );
      }
      if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression))
        assert.ok(!imports.has(statement.expression.text), `${name}: imported default exported again`);
    }
    modules.set(name, text);
  }
  const graph = dependencyGraph(modules);
  assert.deepEqual(cycles(graph), []);
  const visited = new Set<string>();
  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    for (const child of graph.get(name) ?? []) visit(child);
  }
  visit("renderers/WebGLRenderer.ts");
  assert.deepEqual(
    [...visited].filter(
      (name) =>
        /^(materials|objects|lights)\//.test(name) ||
        /Raycaster|PMREMGenerator|WebGLOutput|WebXRManager|WebGLShadowMap|shaders\/[A-Z]\w*Shader\.ts|DFGLUTData|LTCTextures|ShaderLib\.ts|ShaderChunk\.ts/.test(
          name,
        ),
    ),
    [],
  );
});

test("runtime SCCs detect indirect cycles but ignore type-only references", () => {
  const graph = dependencyGraph(
    new Map([
      ["a.ts", 'import { b } from "./b"; export const a = () => b;'],
      ["b.ts", 'import { c } from "./c"; export const b = () => c;'],
      ["c.ts", 'import { a } from "./a"; export const c = () => a;'],
      ["d.ts", 'import type { a } from "./a"; export const d = 1;'],
    ]),
  );
  assert.deepEqual(cycles(graph), [["a.ts", "b.ts", "c.ts"]]);
});

test("runtime graph retains empty imports but excludes type-only imports", () => {
  const graph = dependencyGraph(
    new Map([
      ["effect.ts", "export const registration = 1;"],
      ["type.ts", "export interface Shape { x: number; }"],
      [
        "entry.ts",
        'import {} from "./effect"; import type {} from "./type"; import { type Shape } from "./type"; export const ready = true;',
      ],
    ]),
  );
  assert.deepEqual(graph.get("entry.ts"), ["effect.ts"]);
});

test("runtime graph rejects missing modules and external dependencies", () => {
  assert.throws(
    () => dependencyGraph(new Map([["entry.ts", 'import { value } from "./missing";']])),
    /unresolved module/,
  );
  assert.throws(
    () => dependencyGraph(new Map([["entry.ts", 'import { value } from "external";']])),
    /external dependency/,
  );
});

test("production compilation inlines imported engine and WebGL const enums", async () => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    oxc: { exclude: /\.ts$/ },
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL("src/renderers/webgl/WebGLState.ts", root)), formats: ["es"] },
    },
  });
  const [bundle] = Array.isArray(result) ? result : [result];
  assert.ok("output" in bundle);
  const code = bundle.output
    .filter((chunk) => chunk.type === "chunk")
    .map((chunk) => chunk.code)
    .join("\n");
  assert.doesNotMatch(code, /\b(?:CullFace|MAX_COMBINED_TEXTURE_IMAGE_UNITS|TEXTURE_CUBE_MAP_POSITIVE_X)\b/);
  assert.match(code, /getParameter\(35661\b/);
  assert.match(code, /cullFace\(1029\b/);
});
