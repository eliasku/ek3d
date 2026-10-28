export interface MaterialXTreeNode<T> {
  nodePath: string | null;
  add(child: T): void;
}

export function parseMaterialXNodeTree<T extends MaterialXTreeNode<T>>(
  nodeXML: Element,
  createNode: (node: Element, path: string | null) => T,
  addNode: (node: T) => void,
  nodePath: string | null = "",
): T {
  const node = createNode(nodeXML, nodePath);
  if (node.nodePath) addNode(node);
  for (const child of nodeXML.children) node.add(parseMaterialXNodeTree(child, createNode, addNode, node.nodePath));
  return node;
}

export function parseMaterialXText<T extends MaterialXTreeNode<T>>(
  text: string,
  createNode: (node: Element, path: string | null) => T,
  addNode: (node: T) => void,
): T {
  const root = new DOMParser().parseFromString(text, "application/xml").documentElement;
  return parseMaterialXNodeTree(root, createNode, addNode);
}
