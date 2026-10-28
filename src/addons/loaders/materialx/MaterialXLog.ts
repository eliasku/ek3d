export const MaterialXLogCodes = {
  UNSUPPORTED_NODE: { label: "unsupported-node", severity: "error" },
  IGNORED_SURFACE_INPUT: { label: "ignored-surface-input", severity: "warning" },
  MISSING_REFERENCE: { label: "missing-reference", severity: "error" },
  MISSING_MATERIAL: { label: "missing-material", severity: "error" },
  INVALID_VALUE: { label: "invalid-value", severity: "error" },
  TEXTURE_LOAD_FAILED: { label: "texture-load-failed", severity: "warning" },
  UNKNOWN_INPUT: { label: "unknown-input", severity: "error" },
  INVALID_OUTPUT_CONNECTION: { label: "invalid-output-connection", severity: "error" },
  TYPE_MISMATCH: { label: "type-mismatch", severity: "error" },
} as const;

export interface MaterialXLogEntry {
  code: string;
  severity: "error" | "warning";
  message: string;
  nodeName?: string;
}

export class MaterialXLog {
  entries: MaterialXLogEntry[] = [];
  get errors(): MaterialXLogEntry[] {
    return this.entries.filter((entry) => entry.severity === "error");
  }
  get warnings(): MaterialXLogEntry[] {
    return this.entries.filter((entry) => entry.severity === "warning");
  }
  add(code: { label: string; severity: "error" | "warning" }, message: string, nodeName?: string | null): void {
    const entry: MaterialXLogEntry = { code: code.label, severity: code.severity, message };
    if (nodeName !== undefined && nodeName !== null) entry.nodeName = nodeName;
    this.entries.push(entry);
  }
}
