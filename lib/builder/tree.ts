export type NodeKind = "text" | "button" | "image" | "container";
export type NodeProps = {
  text: string;
  url: string;
  href: string;
  color: string;
  background: string;
  fontSize: number;
  padding: number;
};
export type BuilderNode = { id: string; type: NodeKind; props: NodeProps; children: BuilderNode[] };
export type UiTree = { nodes: BuilderNode[] };

const kinds = new Set<NodeKind>(["text", "button", "image", "container"]);
const colorPattern = /^#[0-9a-fA-F]{6}$/;

export function safeUrl(value: string, image = false): string {
  if (!value) return "";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "";
  if (value.startsWith("/") && !/^\/[\\/]/.test(value)) return value;
  if (!image && value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return (image ? ["http:", "https:"] : ["http:", "https:", "mailto:", "tel:"]).includes(url.protocol) ? value : "";
  } catch { return ""; }
}

export function parseUiTree(input: unknown): UiTree | null {
  if (!input || typeof input !== "object" || !Array.isArray((input as UiTree).nodes)) return null;
  const ids = new Set<string>();
  let count = 0;
  const parseNode = (value: unknown, depth: number): BuilderNode | null => {
    if (!value || typeof value !== "object" || depth > 8 || ++count > 200) return null;
    const node = value as Record<string, unknown>;
    if (typeof node.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(node.id) || ids.has(node.id) ||
      typeof node.type !== "string" || !kinds.has(node.type as NodeKind) ||
      !node.props || typeof node.props !== "object" || !Array.isArray(node.children)) return null;
    ids.add(node.id);
    const props = node.props as Record<string, unknown>;
    if (typeof props.text !== "string" || props.text.length > 1000 ||
      typeof props.url !== "string" || props.url.length > 2000 || (props.url && !safeUrl(props.url, true)) ||
      typeof props.href !== "string" || props.href.length > 2000 || (props.href && !safeUrl(props.href)) ||
      typeof props.color !== "string" || !colorPattern.test(props.color) ||
      typeof props.background !== "string" || !colorPattern.test(props.background) ||
      typeof props.fontSize !== "number" || !Number.isInteger(props.fontSize) || props.fontSize < 10 || props.fontSize > 72 ||
      typeof props.padding !== "number" || !Number.isInteger(props.padding) || props.padding < 0 || props.padding > 96 ||
      (node.type !== "container" && node.children.length > 0)) return null;
    const children: BuilderNode[] = [];
    for (const child of node.children) {
      const parsed = parseNode(child, depth + 1);
      if (!parsed) return null;
      children.push(parsed);
    }
    return { id: node.id, type: node.type as NodeKind, props: {
      text: props.text, url: props.url, href: props.href, color: props.color,
      background: props.background, fontSize: props.fontSize, padding: props.padding
    }, children };
  };
  const nodes: BuilderNode[] = [];
  for (const node of (input as UiTree).nodes) {
    const parsed = parseNode(node, 1);
    if (!parsed) return null;
    nodes.push(parsed);
  }
  return { nodes };
}

export function newNode(type: NodeKind): BuilderNode {
  return { id: crypto.randomUUID(), type, props: {
    text: type === "button" ? "Nút bấm" : type === "text" ? "Văn bản" : "",
    url: "", href: "", color: "#1c2434", background: "#ffffff", fontSize: 18, padding: 12
  }, children: [] };
}

export function findNode(nodes: BuilderNode[], id: string): BuilderNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export function updateNode(nodes: BuilderNode[], id: string, update: (node: BuilderNode) => BuilderNode): BuilderNode[] {
  return nodes.map(node => node.id === id ? update(node) : { ...node, children: updateNode(node.children, id, update) });
}

export function removeNode(nodes: BuilderNode[], id: string): BuilderNode[] {
  return nodes.filter(node => node.id !== id).map(node => ({ ...node, children: removeNode(node.children, id) }));
}

export function addNode(tree: UiTree, parentId: string, node: BuilderNode): UiTree {
  if (parentId === "root") return { nodes: [...tree.nodes, node] };
  const parent = findNode(tree.nodes, parentId);
  if (!parent || parent.type !== "container") return tree;
  return { nodes: updateNode(tree.nodes, parentId, current => ({ ...current, children: [...current.children, node] })) };
}

export function moveNode(tree: UiTree, id: string, parentId: string): UiTree {
  const node = findNode(tree.nodes, id);
  if (!node || id === parentId || findNode(node.children, parentId)) return tree;
  if (parentId !== "root" && findNode(tree.nodes, parentId)?.type !== "container") return tree;
  return addNode({ nodes: removeNode(tree.nodes, id) }, parentId, node);
}

export function moveSibling(nodes: BuilderNode[], id: string, direction: -1 | 1): BuilderNode[] {
  const index = nodes.findIndex(node => node.id === id);
  if (index >= 0) {
    const other = index + direction;
    if (other < 0 || other >= nodes.length) return nodes;
    const next = nodes.slice();
    [next[index], next[other]] = [next[other], next[index]];
    return next;
  }
  return nodes.map(node => ({ ...node, children: moveSibling(node.children, id, direction) }));
}
