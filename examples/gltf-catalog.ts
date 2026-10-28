export interface CatalogModel {
  name: string;
  label: string;
  variants: Record<string, string | undefined>;
}

export function defaultVariant(model: CatalogModel): string {
  return model.variants["glTF-Binary"] !== undefined
    ? "glTF-Binary"
    : model.variants["glTF"] !== undefined
      ? "glTF"
      : Object.keys(model.variants)[0]!;
}

export function catalogURL(model: CatalogModel, variant: string): string {
  const file = model.variants[variant];
  if (file === undefined) throw new Error(`Unknown variant ${variant} for ${model.name}`);
  return `/examples/models/gltf-catalog/${encodeURIComponent(model.name)}/${encodeURIComponent(variant)}/${encodeURIComponent(file)}`;
}
