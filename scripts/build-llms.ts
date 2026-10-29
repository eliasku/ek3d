import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

function sourceSection(module: string, source: string): string {
  let fenceLength = 3;
  for (const match of source.matchAll(/`+/g)) fenceLength = Math.max(fenceLength, match[0].length + 1);
  const fence = "`".repeat(fenceLength);
  return `## ${module}\n\n${fence}typescript\n${source.trimEnd()}\n${fence}\n`;
}

// JSDoc code fences must not close the surrounding source block.
assert.equal(
  sourceSection("ek3d/example", "/**\n * ```typescript\n * const value = 1;\n * ```\n */\n"),
  "## ek3d/example\n\n````typescript\n/**\n * ```typescript\n * const value = 1;\n * ```\n */\n````\n",
);

const root = new URL("../", import.meta.url);
const readme = await readFile(new URL("README.md", root), "utf8");
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8")) as {
  name: string;
  version: string;
  repository: { url: string };
};
const repository = packageJson.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
const files = (await readdir(new URL("src/", root), { recursive: true }))
  .filter((name) => name.endsWith(".ts"))
  .map((name) => name.replaceAll("\\", "/"))
  .sort();
assert.ok(files.length > 0, "No maintained TypeScript sources found");

const header = `# ${packageJson.name}\n\n> WebGL-focused TypeScript for canvas games and interactive 3D.\n\nVersion: ${packageJson.version}\n\nUse a TypeScript-capable bundler and direct module imports without a file extension.\nThere is no root package import. Supply shaders and optional runtimes explicitly.\nWebGPU, TSL, WebXR and StereoCamera are not included.\nUse the maintained source as the API reference, not the upstream Three.js documentation.\nRepository paths in the README are relative to the repository root.\n\n## Project documentation\n\n- [README](${repository}/blob/HEAD/README.md)\n- [Contributing](${repository}/blob/HEAD/CONTRIBUTING.md)\n- [Asset notices](${repository}/blob/HEAD/public/examples/README.md)\n- [Full inline source reference](llms-full.txt)\n`;
const index = [header, "## Modules\n"];
const full = [
  header,
  "## README\n",
  readme.trimEnd(),
  "\n# Maintained source\n\nEach heading gives the canonical import path. Source includes types, JSDoc and implementation.\nRelative imports resolve from the original file under src/. Internal declarations are not public exports.\n",
];
for (const name of files) {
  const module = `${packageJson.name}/${name.slice(0, -3)}`;
  const sourcePath = `src/${name}`;
  index.push(`- [${module}](${repository}/blob/HEAD/${encodeURI(sourcePath)})`);
  full.push(sourceSection(module, await readFile(new URL(sourcePath, root), "utf8")));
}

await mkdir(new URL("public/", root), { recursive: true });
await writeFile(new URL("public/llms.txt", root), `${index.join("\n")}\n`);
await writeFile(new URL("public/llms-full.txt", root), `${full.join("\n")}\n`);
console.log(`Generated public/llms.txt and public/llms-full.txt for ${files.length} modules.`);
