import ts from "typescript6";
import type { Plugin } from "vite-plus";

/** Use TypeScript's cross-module const enum emit instead of isolated transpilation. */
export function constEnums(): Plugin {
  let program: ts.Program | undefined;
  return {
    name: "typescript-const-enums",
    enforce: "pre",
    apply: "build",
    buildStart() {
      const config = ts.readConfigFile("tsconfig.json", (file) => ts.sys.readFile(file));
      if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
      program = ts.createProgram(parsed.fileNames, {
        ...parsed.options,
        noEmit: false,
        sourceMap: true,
        preserveConstEnums: false,
        isolatedModules: false,
      });
      const externalSources = program
        .getSourceFiles()
        .filter(
          (file) =>
            !file.isDeclarationFile && file.fileName.endsWith(".ts") && program!.isSourceFileFromExternalLibrary(file),
        );
      if (externalSources.length) {
        // Source-first packages under node_modules must be emit roots, not external libraries.
        program = ts.createProgram(
          [...parsed.fileNames, ...externalSources.map((file) => file.fileName)],
          program.getCompilerOptions(),
          undefined,
          program,
        );
      }
    },
    transform(_code, id) {
      if (!id.endsWith(".ts") || !program) return;
      const source = program.getSourceFile(id);
      if (!source || source.isDeclarationFile) return;
      let output = "";
      let map = "";
      program.emit(source, (file, text) => {
        if (file.endsWith(".js.map")) map = text;
        else if (file.endsWith(".js")) output = text;
      });
      if (!output) throw new Error(`TypeScript did not emit ${id}`);
      return { code: output, map };
    },
  };
}
