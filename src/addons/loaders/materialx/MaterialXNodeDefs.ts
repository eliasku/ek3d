import { registryData } from "./MaterialXNodeInterfaceRegistry";

export interface MaterialXNodeDef {
  node: string;
  version?: string;
  isdefaultversion?: boolean;
  inputs: Record<string, { type: string; value?: string; defaultgeomprop?: string }>;
  outputs: Record<string, string>;
}

export interface MaterialXResolvedNodeDef extends MaterialXNodeDef {
  name: string;
}

export interface MaterialXNodeDefInstance {
  element: string;
  type: string | null;
  children: { element: string; name: string | null; type: string | null }[];
  materialX: { getDocumentNodeDefs(): Record<string, MaterialXNodeDef> };
  getAttribute(name: string): string | null;
}

const namesByCategory = new Map<string, string[]>();
for (const [name, def] of Object.entries(registryData.nodedefs)) {
  const names = namesByCategory.get(def.node) ?? [];
  names.push(name);
  namesByCategory.set(def.node, names);
}

export function getNodeDefNames(category: string): string[] {
  return namesByCategory.get(category) || [];
}

export function resolveNodeDef(node: MaterialXNodeDefInstance): MaterialXResolvedNodeDef | null {
  const documentDefs = node.materialX.getDocumentNodeDefs();
  const explicitName = node.getAttribute("nodedef");
  if (explicitName) {
    const def = registryData.nodedefs[explicitName] || documentDefs[explicitName];
    if (def) return { name: explicitName, ...def };
  }
  const version = node.getAttribute("version") || "";
  const candidates: [string, MaterialXNodeDef][] = [
    ...getNodeDefNames(node.element).map((name): [string, MaterialXNodeDef] => [name, registryData.nodedefs[name]]),
    ...Object.entries(documentDefs).filter(([, def]) => def.node === node.element),
  ];
  let roughMatch: MaterialXResolvedNodeDef | null = null;
  for (const [name, def] of candidates) {
    if ((def.version || "") !== version && !(def.isdefaultversion === true && version === "")) continue;
    const outputs = Object.keys(def.outputs);
    const outputType = outputs.length > 1 ? "multioutput" : (def.outputs.out ?? def.outputs[outputs[0]] ?? null);
    if (node.type && outputType !== "multioutput" && outputType !== node.type) continue;
    const match = node.children.every((child) => {
      if (child.element !== "input") return true;
      const declared = def.inputs[child.name ?? "null"];
      return !!declared && (!child.type || declared.type === child.type);
    });
    if (match) return { name, ...def };
    roughMatch ??= { name, ...def };
  }
  return roughMatch;
}
