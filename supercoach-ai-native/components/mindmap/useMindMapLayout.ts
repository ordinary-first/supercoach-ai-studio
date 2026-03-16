import { useMemo } from 'react';
import type { GoalNode, GoalLink } from '../../shared/types';
import { getLinkId } from '../../hooks/useAutoSave';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 50;
const H_SPACING = 40;
const V_SPACING = 60;

interface TreeNode {
  id: string;
  children: TreeNode[];
  // layout intermediates
  x: number;
  y: number;
  modifier: number;
  depth: number;
}

function buildTree(
  nodes: GoalNode[],
  links: GoalLink[],
): TreeNode | null {
  if (nodes.length === 0) return null;

  const childrenMap = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const link of links) {
    const sourceId = getLinkId(link.source);
    const targetId = getLinkId(link.target);
    if (!childrenMap.has(sourceId)) childrenMap.set(sourceId, []);
    childrenMap.get(sourceId)!.push(targetId);
    hasParent.add(targetId);
  }

  // Find root: node with type ROOT, or node without parent
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let rootId = nodes.find((n) => n.type === 'ROOT')?.id;
  if (!rootId) {
    rootId = nodes.find((n) => !hasParent.has(n.id))?.id;
  }
  if (!rootId) rootId = nodes[0].id;

  function build(id: string, depth: number): TreeNode | null {
    if (!nodeMap.has(id)) return null;
    const childIds = childrenMap.get(id) ?? [];
    const children: TreeNode[] = [];
    for (const cid of childIds) {
      const child = build(cid, depth + 1);
      if (child) children.push(child);
    }
    return { id, children, x: 0, y: 0, modifier: 0, depth };
  }

  return build(rootId, 0);
}

function layoutTree(node: TreeNode, siblingIndex: number): void {
  // Post-order: layout children first
  for (let i = 0; i < node.children.length; i++) {
    layoutTree(node.children[i], i);
  }

  node.y = node.depth * (NODE_HEIGHT + V_SPACING);

  if (node.children.length === 0) {
    node.x = 0;
  } else if (node.children.length === 1) {
    node.x = node.children[0].x;
  } else {
    const first = node.children[0].x;
    const last = node.children[node.children.length - 1].x;
    node.x = (first + last) / 2;
  }
}

function assignSiblingPositions(node: TreeNode): void {
  // Space siblings so they don't overlap
  for (let i = 1; i < node.children.length; i++) {
    const prev = node.children[i - 1];
    const curr = node.children[i];
    const minX = getMaxXInSubtree(prev) + NODE_WIDTH + H_SPACING;
    const currMinX = getMinXInSubtree(curr);
    if (currMinX < minX) {
      const shift = minX - currMinX;
      shiftSubtree(curr, shift);
    }
  }

  // Recenter parent over children
  if (node.children.length > 0) {
    const first = node.children[0].x;
    const last = node.children[node.children.length - 1].x;
    const mid = (first + last) / 2;
    // Don't shift root if it creates negative positions
    node.x = mid;
  }

  for (const child of node.children) {
    assignSiblingPositions(child);
  }
}

function getMinXInSubtree(node: TreeNode): number {
  let min = node.x;
  for (const child of node.children) {
    min = Math.min(min, getMinXInSubtree(child));
  }
  return min;
}

function getMaxXInSubtree(node: TreeNode): number {
  let max = node.x;
  for (const child of node.children) {
    max = Math.max(max, getMaxXInSubtree(child));
  }
  return max;
}

function shiftSubtree(node: TreeNode, shift: number): void {
  node.x += shift;
  for (const child of node.children) {
    shiftSubtree(child, shift);
  }
}

function collectPositions(node: TreeNode, result: Map<string, LayoutNode>): void {
  result.set(node.id, {
    id: node.id,
    x: node.x,
    y: node.y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  });
  for (const child of node.children) {
    collectPositions(child, result);
  }
}

function normalizePositions(positions: Map<string, LayoutNode>): void {
  let minX = Infinity;
  let minY = Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }
  const offsetX = -minX + 40;
  const offsetY = -minY + 40;
  for (const pos of positions.values()) {
    pos.x += offsetX;
    pos.y += offsetY;
  }
}

export function computeLayout(
  nodes: GoalNode[],
  links: GoalLink[],
): Map<string, LayoutNode> {
  const root = buildTree(nodes, links);
  if (!root) return new Map();

  layoutTree(root, 0);
  assignSiblingPositions(root);

  const positions = new Map<string, LayoutNode>();
  collectPositions(root, positions);
  normalizePositions(positions);

  return positions;
}

export function useMindMapLayout(
  nodes: GoalNode[],
  links: GoalLink[],
): Map<string, LayoutNode> {
  return useMemo(() => computeLayout(nodes, links), [nodes, links]);
}

export { NODE_WIDTH, NODE_HEIGHT };
