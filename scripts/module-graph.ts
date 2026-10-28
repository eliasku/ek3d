import ts from "typescript6";
import path from "node:path/posix";

export const parse = (name: string, source: string): ts.SourceFile =>
  ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

export function resolveModule(from: string, specifier: string, modules: Map<string, string>): string {
  if (!specifier.startsWith(".")) throw new Error(`${from}: external dependency ${specifier}`);
  const normalized = path.normalize(path.join(path.dirname(from), specifier));
  for (const candidate of [normalized, `${normalized}.js`, `${normalized}.ts`]) {
    if (modules.has(candidate)) return candidate;
  }
  throw new Error(`${from}: unresolved module ${specifier}`);
}

export function dependencyGraph(modules: Map<string, string>): Map<string, string[]> {
  return new Map(
    [...modules].map(([name, text]) => [
      name,
      parse(name, text)
        .statements.filter(
          (node): node is ts.ImportDeclaration =>
            ts.isImportDeclaration(node) &&
            !node.importClause?.isTypeOnly &&
            !(
              node.importClause?.namedBindings &&
              ts.isNamedImports(node.importClause.namedBindings) &&
              node.importClause.namedBindings.elements.length > 0 &&
              node.importClause.namedBindings.elements.every((item) => item.isTypeOnly)
            ),
        )
        .map((node) => {
          if (!ts.isStringLiteral(node.moduleSpecifier)) throw new Error(`${name}: unsupported module specifier`);
          return resolveModule(name, node.moduleSpecifier.text, modules);
        }),
    ]),
  );
}

export function cycles(graph: Map<string, string[]>): string[][] {
  let next = 0;
  const indices = new Map<string, number>(),
    low = new Map<string, number>(),
    stack: string[] = [],
    active = new Set<string>(),
    result: string[][] = [];
  function visit(node: string): void {
    indices.set(node, next);
    low.set(node, next++);
    stack.push(node);
    active.add(node);
    for (const child of graph.get(node) ?? []) {
      if (!indices.has(child)) {
        visit(child);
        low.set(node, Math.min(low.get(node)!, low.get(child)!));
      } else if (active.has(child)) low.set(node, Math.min(low.get(node)!, indices.get(child)!));
    }
    if (low.get(node) !== indices.get(node)) return;
    const component: string[] = [];
    let child: string;
    do {
      child = stack.pop()!;
      active.delete(child);
      component.push(child);
    } while (child !== node);
    if (component.length > 1 || graph.get(node)?.includes(node)) result.push(component.sort());
  }
  for (const node of graph.keys()) if (!indices.has(node)) visit(node);
  return result.sort((a, b) => a[0].localeCompare(b[0], "en"));
}
