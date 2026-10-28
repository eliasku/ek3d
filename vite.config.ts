import { existsSync, readdirSync } from "node:fs";
import { defineConfig } from "vite-plus";
import { constEnums } from "./scripts/const-enums";

const exampleEntries = existsSync("examples")
  ? readdirSync("examples", { recursive: true })
      .filter((name) => name.toString().endsWith(".html"))
      .map((name) => `examples/${name.toString()}`)
  : [];

export default defineConfig({
  publicDir: "public",
  plugins: [constEnums()],
  worker: { plugins: () => [constEnums()] },

  // The upstream checkout is a read-only comparison baseline, not a development entry point.
  optimizeDeps: {
    entries: ["index.html", "testbed/index.html", ...exampleEntries, "tests/browser*.ts"],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  lint: {
    ignorePatterns: ["dist/**", "upstream/**", "public/**"],
    options: { typeAware: true, typeCheck: false },
    overrides: [
      {
        // Compile-only fixtures deliberately exercise calls and method assignments without executing them.
        files: ["tests/types.ts", "tests/*-types.ts"],
        rules: {
          "no-unused-vars": ["error", { args: "none" }],
          "typescript/no-floating-promises": "off",
          "typescript/unbound-method": "off",
        },
      },
      {
        // The listener loop binds `this._listenCallback` explicitly to itself, matching upstream.
        files: ["src/addons/libs/lil-gui/Controller.ts"],
        rules: { "typescript/unbound-method": "off" },
      },
    ],
  },
  fmt: {
    // Keep copied fonts and vendor runtimes byte-identical to their licensed upstream sources.
    ignorePatterns: ["upstream/**", "dist/**", "examples/fonts/**", "public/**", "package-lock.json"],
    printWidth: 120,
    sortPackageJson: false,
  },
  build: {
    rolldownOptions: {
      input: ["index.html", "testbed/index.html", ...exampleEntries],
      external: [
        // exclude transpiling source code from /upstream/ directory
        /^\/upstream\/.*/,
      ],
    },
    assetsInlineLimit: 0,
  },
});
