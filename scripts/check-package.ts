import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser } from "playwright";
import type { ViteDevServer, PreviewServer } from "vite-plus";
import type * as Vite from "vite-plus";
import { launchBrowser, verifyBrowser } from "./browser-smoke";

const root = fileURLToPath(new URL("../", import.meta.url));
const consumer = await mkdtemp(path.join(tmpdir(), "ek3d-consumer-"));
const browserTool = process.argv.includes("--browser-tool");
let browser: Browser | undefined;
let dev: ViteDevServer | undefined;
let production: PreviewServer | undefined;

function run(command: string, args: string[], cwd = consumer) {
  console.log(`${path.basename(cwd)}: ${command} ${args.join(" ")}`);
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], timeout: 300_000 });
}

function inside(base: string, target: string) {
  const relative = path.relative(base, target);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

try {
  assert(!inside(root, consumer), "The consumer must not inherit repository resolution");
  const [pack] = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", consumer], root)) as {
    filename: string;
    files: { path: string }[];
    bundled: string[];
  }[];
  assert(pack);
  assert.deepEqual(pack.bundled, []);
  const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  const name = "ek3d-packed-consumer";
  lock.name = name;
  lock.packages[""].name = name;
  // Preserve every tool's locked transitive version; only the dependency under test is added below.
  await writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({
      name,
      version: metadata.version,
      private: true,
      type: "module",
      devDependencies: metadata.devDependencies,
    }),
  );
  await writeFile(path.join(consumer, "package-lock.json"), JSON.stringify(lock));
  run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", `./${pack.filename}`]);
  const installed = path.join(consumer, "node_modules/ek3d");
  assert.equal(await realpath(installed), installed, "The package must not be a workspace symlink");
  const requireConsumer = createRequire(path.join(consumer, "package.json"));
  assert.throws(() => requireConsumer.resolve("three"), { code: "MODULE_NOT_FOUND" });
  const packedMetadata = JSON.parse(await readFile(path.join(installed, "package.json"), "utf8"));
  assert.deepEqual(packedMetadata.exports, { "./*": "./src/*.ts" });
  assert.deepEqual(packedMetadata.dependencies ?? {}, {});
  assert.throws(() => requireConsumer.resolve("ek3d"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
  assert.equal(requireConsumer.resolve("ek3d/math/Vector3"), path.join(installed, "src/math/Vector3.ts"));
  const sources = pack.files.filter(({ path: file }) => file.startsWith("src/"));
  const sourceFiles = (await readdir(path.join(root, "src"), { recursive: true }))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => `src/${file.split(path.sep).join("/")}`)
    .sort();
  assert.deepEqual(sources.map(({ path: file }) => file).sort(), sourceFiles);
  for (const { path: file } of sources) {
    assert(file.endsWith(".ts") && !file.endsWith(".d.ts"), file);
    assert.deepEqual(await readFile(path.join(installed, file)), await readFile(path.join(root, file)), file);
  }
  for (const file of ["README.md"])
    assert.deepEqual(await readFile(path.join(installed, file)), await readFile(path.join(root, file)), file);

  await cp(path.join(root, "testbed"), path.join(consumer, "testbed"), { recursive: true });
  await cp(path.join(root, "public"), path.join(consumer, "public"), { recursive: true });
  const directories = ["testbed"];
  if ((await readdir(root)).includes("examples")) {
    await cp(path.join(root, "examples"), path.join(consumer, "examples"), { recursive: true });
    directories.push("examples");
  }
  await mkdir(path.join(consumer, "tests"));
  for (const file of (await readdir(path.join(root, "tests"))).filter(
    (file) => file === "types.ts" || file.endsWith("-types.ts") || /^browser(?:-[\w-]+)?\.ts$/.test(file),
  ))
    await cp(path.join(root, "tests", file), path.join(consumer, "tests", file));
  await writeFile(
    path.join(consumer, "tests/root.ts"),
    "// @ts-expect-error Only defining-module subpaths are exported.\nimport type {} from 'ek3d';\n",
  );
  await cp(path.join(root, "index.html"), path.join(consumer, "index.html"));
  const tsconfig = JSON.parse(await readFile(path.join(root, "tsconfig.json"), "utf8"));
  await writeFile(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { ...tsconfig.compilerOptions, types: [] },
      include: [...directories.map((directory) => `${directory}/**/*.ts`), "tests/**/*.ts"],
    }),
  );
  run(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"]);
  const entries = ["index.html", "testbed/index.html"];
  if (directories.includes("examples")) {
    for (const name of await readdir(path.join(consumer, "examples"), { recursive: true })) {
      if (name.endsWith(".html")) entries.push(`examples/${name.split(path.sep).join("/")}`);
    }
  }
  await writeFile(
    path.join(consumer, "vite.config.ts"),
    `import { defineConfig } from 'vite-plus';
import { writeFileSync } from 'node:fs';
export default defineConfig(({ command }) => ({
  publicDir: 'public',
  oxc: command === 'build' ? { exclude: /\\.ts$/ } : undefined,
  plugins: [{ name: 'record-packed-graph', generateBundle(_options, bundle) {
    writeFileSync('graph.json', JSON.stringify([...new Set(Object.values(bundle).flatMap(chunk => chunk.type === 'chunk' ? Object.keys(chunk.modules) : []))].sort()));
  } }],
  build: { target: 'es2022', minify: 'oxc', rollupOptions: { input: ${JSON.stringify(entries)} } },
}));\n`,
  );
  run("npm", ["exec", "--", "vp", "build"]);
  const graph = JSON.parse(await readFile(path.join(consumer, "graph.json"), "utf8")) as string[];
  assert(graph.some((id) => id === path.join(installed, "src/renderers/WebGLRenderer.ts")));
  for (const id of graph) {
    if (path.isAbsolute(id)) assert(inside(consumer, id), `Bundle escaped consumer: ${id}`);
    assert.doesNotMatch(id, /(?:three\.js\/|renderers\/(?:webxr|webgpu|common)\/|\/nodes\/|\/tsl\/)/);
  }
  const vite: typeof Vite = requireConsumer("vite-plus");
  dev = await vite.createServer({
    root: consumer,
    configFile: false,
    publicDir: "public",
    // Runtime-selected smoke imports must join the initial dependency scan, not trigger reloads mid-lifecycle.
    optimizeDeps: {
      entries: [...entries, "tests/browser*.ts"],
    },
    server: { host: "127.0.0.1", port: 0, fs: { strict: true, allow: [consumer] } },
  });
  await dev.listen();
  const devURL = dev.resolvedUrls?.local[0];
  assert(devURL);
  production = await vite.preview({ root: consumer, configFile: false, preview: { host: "127.0.0.1", port: 0 } });
  const productionURL = production.resolvedUrls?.local[0];
  assert(productionURL);
  if (browserTool) {
    console.log(`Browser tool consumer ready: ${JSON.stringify({ devURL, productionURL })}`);
    console.log("Verify both URLs through browser, then press Enter to remove the temporary consumer.");
    process.stdin.resume();
    await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));
    process.stdin.pause();
  } else {
    browser = await launchBrowser("chromium");
    const smoke = await verifyBrowser(devURL, browser, { lifecycles: true });
    assert.deepEqual(smoke.failures, [], "Installed package development/lifecycle smoke failed");
    const productionSmoke = await verifyBrowser(productionURL, browser, { lifecycles: false });
    assert.deepEqual(productionSmoke.failures, [], "Installed package production smoke failed");
  }
} finally {
  await browser?.close();
  await dev?.close();
  await production?.close();
  await rm(consumer, { recursive: true, force: true });
}
console.log(
  browserTool
    ? "Packed source-first consumer and strict types passed; browser results belong to the browser-tool session."
    : "Packed source-first consumer, strict types and development/production browser checks passed.",
);
