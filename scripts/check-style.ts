import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript6";

function problems(name: string, text: string): string[] {
  const file = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const errors: string[] = [];
  const report = (node: ts.Node, message: string) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    errors.push(`${name}:${line + 1}: ${message}`);
  };
  let declarationSeen = false;
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement)) {
      if (declarationSeen) report(statement, "Put imports before declarations.");
    } else declarationSeen = true;
  }
  const checkedDocs = new Set<number>();
  function visit(node: ts.Node): void {
    if (ts.isExportDeclaration(node)) report(node, "Export the defining declaration directly, without an export list.");
    if (ts.isPropertyDeclaration(node)) {
      if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)) {
        report(node, "Use a real typed field or accessor, not declare.");
      }
      if (!node.type) report(node, "Give class fields explicit TypeScript types.");
    }
    if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
      const classes = new Set(node.statements.filter(ts.isClassDeclaration).map((item) => item.name?.text));
      for (const statement of node.statements) {
        if (ts.isInterfaceDeclaration(statement) && classes.has(statement.name.text)) {
          report(statement, "Do not merge a class and interface; express the real implementation contract.");
        }
      }
    }
    for (const doc of (node as ts.Node & { jsDoc?: readonly ts.JSDoc[] }).jsDoc ?? []) {
      if (checkedDocs.has(doc.pos)) continue;
      checkedDocs.add(doc.pos);
      for (const tag of doc.tags ?? []) {
        if ((ts.isJSDocParameterTag(tag) || ts.isJSDocReturnTag(tag) || ts.isJSDocTypeTag(tag)) && tag.typeExpression) {
          report(tag, "Represent the type in TypeScript, retaining only the JSDoc description.");
        }
        if (ts.isJSDocTypedefTag(tag) || ts.isJSDocCallbackTag(tag)) {
          report(tag, "Declare documented types and callbacks in TypeScript, not JSDoc.");
        }
      }
      if (/```(?:js|javascript|ts)\b/.test(doc.getText(file))) {
        report(doc, "Use a current TypeScript example with a typescript code fence.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return errors;
}

// Guard the checker itself against accepting regressions or rejecting ordinary inferred function returns.
assert.equal(problems("valid.ts", 'import type { T } from "./T"; export class C { value: number = 1; }').length, 0);
assert.equal(
  problems("invalid.ts", 'interface C {} import { x } from "./x"; class C { declare value: number; } export { C };')
    .length,
  4,
);
assert.equal(problems("field.ts", "class C { value = 1; }").length, 1);
assert.equal(
  problems("doc.ts", "/** @param {number} value - Input. */ export function read(value: number) { return value; }")
    .length,
  1,
);

const root = new URL("../", import.meta.url);
const files = ["vite.config.ts"];
for (const directory of ["src", "demo", "examples", "tests", "scripts"]) {
  if (directory === "examples" && !existsSync(new URL("examples/", root))) continue;
  for (const name of await readdir(new URL(`${directory}/`, root), { recursive: true })) {
    if (/\.tsx?$/.test(name)) files.push(`${directory}/${name}`);
  }
}
const errors: string[] = [];
for (const name of files.sort()) {
  errors.push(...problems(name, await readFile(new URL(name, root), "utf8")));
}
if (errors.length) throw new Error(`Source convention violations in ${fileURLToPath(root)}:\n${errors.join("\n")}`);
console.log(`Source conventions: ${files.length} TypeScript files checked.`);
