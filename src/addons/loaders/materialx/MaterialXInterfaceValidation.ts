import { MaterialXLogCodes, type MaterialXLog } from "./MaterialXLog";
import type { MaterialXResolvedNodeDef } from "./MaterialXNodeDefs";

export interface MaterialXValidationNode {
  element: string;
  name: string | null;
  type: string | null;
  output: string | null;
  referencePath: string | null;
  hasReference: boolean;
  nodeDef: MaterialXResolvedNodeDef | null;
  children: MaterialXValidationNode[];
  materialX: { getMaterialXNode(path: string): MaterialXValidationNode | null | undefined };
  getAttribute(name: string): string | null;
}

// Upstream compiler categories affect whether unresolved interfaces are checked.
const compilerCategories = new Set<string>([
  "add",
  "subtract",
  "multiply",
  "divide",
  "modulo",
  "absval",
  "sign",
  "floor",
  "ceil",
  "round",
  "power",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan2",
  "sqrt",
  "ln",
  "exp",
  "fract",
  "clamp",
  "min",
  "max",
  "normalize",
  "magnitude",
  "dot",
  "dotproduct",
  "viewdirection",
  "crossproduct",
  "distance",
  "invert",
  "transformmatrix",
  "transformnormal",
  "transformpoint",
  "transformvector",
  "normalmap",
  "transpose",
  "determinant",
  "invertmatrix",
  "creatematrix",
  "remap",
  "range",
  "open_pbr_anisotropy",
  "smoothstep",
  "luminance",
  "rgbtohsv",
  "hsvadjust",
  "facingratio",
  "hsvtorgb",
  "mix",
  "minus",
  "difference",
  "screen",
  "overlay",
  "burn",
  "dodge",
  "colorcorrect",
  "unpremult",
  "combine2",
  "combine3",
  "combine4",
  "ramplr",
  "ramptb",
  "ramp4",
  "ramp_gradient",
  "ramp",
  "splitlr",
  "splittb",
  "noise2d",
  "noise3d",
  "fractal2d",
  "fractal3d",
  "cellnoise2d",
  "cellnoise3d",
  "randomfloat",
  "randomcolor",
  "worleynoise2d",
  "worleynoise3d",
  "unifiednoise2d",
  "unifiednoise3d",
  "place2d",
  "safepower",
  "contrast",
  "saturate",
  "extract",
  "separate2",
  "separate3",
  "separate4",
  "reflect",
  "refract",
  "time",
  "frame",
  "ifgreater",
  "ifgreatereq",
  "ifequal",
  "rotate2d",
  "rotate3d",
  "heighttonormal",
  "and",
  "or",
  "xor",
  "not",
  "checkerboard",
  "circle",
  "bump",
  "blackbody",
]);

function formatElement(node: MaterialXValidationNode, names: string[], tag = node.element): string {
  const attrs: string[] = [];
  for (const name of names) {
    const value = node.getAttribute(name);
    if (value !== null && value !== "") attrs.push(`${name}="${value}"`);
  }
  return `<${tag} ${attrs.join(" ")}>`;
}

function compatible(expected: string | null, actual: string | null): boolean {
  return (
    !expected ||
    !actual ||
    expected === actual ||
    (expected === "float" && actual === "integer") ||
    (expected === "integer" && actual === "float")
  );
}

function validateConnection(input: MaterialXValidationNode, parent: MaterialXValidationNode, log: MaterialXLog): void {
  if (!input.referencePath) return;
  const source = input.materialX.getMaterialXNode(input.referencePath);
  if (!source) return;
  let outputType: string | null = null;
  if (source.element === "output") outputType = source.type;
  else if (source.nodeDef) {
    const outputs = source.nodeDef.outputs;
    if (input.output) outputType = outputs[input.output] ?? null;
    else if (source.type && source.type !== "multioutput") outputType = source.type;
    else if (outputs.out) outputType = outputs.out;
    else {
      const values = Object.values(outputs);
      outputType = values.length === 1 ? values[0] : source.type;
    }
  }
  const snippet = formatElement(
    input,
    ["name", "type", "nodename", "nodegraph", "interfacename", "output", "value"],
    "input",
  );
  if (input.output && outputType === null) {
    log.add(
      MaterialXLogCodes.INVALID_OUTPUT_CONNECTION,
      `No output found for port connection: ${snippet}`,
      parent.name,
    );
  } else if (input.type && outputType && !compatible(input.type, outputType)) {
    log.add(MaterialXLogCodes.TYPE_MISMATCH, `Mismatched types in port connection: ${snippet}`, parent.name);
  }
}

function validateNode(node: MaterialXValidationNode, log: MaterialXLog): void {
  if (node.element === "materialx" || node.element === "nodegraph") {
    for (const child of node.children) validateNode(child, log);
    return;
  }
  if (node.element === "input" || node.element === "output") return;
  if (node.nodeDef) {
    const inputs = node.nodeDef.inputs;
    for (const child of node.children) {
      if (child.element !== "input" || !child.name) continue;
      const expected = inputs[child.name]?.type;
      const snippet = formatElement(node, ["name", "type", "nodedef"]);
      if (expected === undefined) {
        log.add(
          MaterialXLogCodes.UNKNOWN_INPUT,
          `Node interface error: Input '${child.name}' doesn't match declaration: ${snippet}`,
          node.name,
        );
      } else if (child.type && expected && child.hasReference === false && !compatible(expected, child.type)) {
        log.add(
          MaterialXLogCodes.TYPE_MISMATCH,
          `Input '${child.name}' type '${child.type}' doesn't match nodedef type '${expected}' on ${snippet}`,
          node.name,
        );
      }
      if (child.hasReference) validateConnection(child, node, log);
    }
  } else if (!compilerCategories.has(node.element) && node.element !== "surfacematerial") {
    for (const child of node.children)
      if (child.element === "input" && child.hasReference) validateConnection(child, node, log);
  }
  for (const child of node.children)
    if (child.element !== "input" && child.element !== "output") validateNode(child, log);
}

export function createStrictInterfaceValidator(): (root: MaterialXValidationNode, log: MaterialXLog) => void {
  return validateNode;
}
