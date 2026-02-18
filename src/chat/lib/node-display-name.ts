import { Node } from "@/types/nodes"

export const getNodeDisplayName = (node?: Node): string => {
  if (!node) return "";
  if (node.metadata && node.metadata.title) {
    return `${node.metadata.title}`;
  }
  const path = node.name;
  if (path === '/') {
    return 'Home';
  }
  return path.split('/').pop() || path;
};
