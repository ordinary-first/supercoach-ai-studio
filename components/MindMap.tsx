import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GoalNode, GoalLink, NodeType, NodeStatus } from '../types';

type LayoutMode = 'force' | 'radial' | 'tree' | 'horizontal';

interface MindMapProps {
  nodes: GoalNode[];
  links: GoalLink[];
  selectedNodeId?: string;
  onNodeClick: (node: GoalNode) => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onReparentNode: (childId: string, newParentId: string) => void;
  onConvertNodeToTask?: (nodeId: string) => void;
  onAddSubNode: (parentId: string) => void;
  width: number;
  height: number;
  editingNodeId?: string | null;
  onEditEnd?: () => void;
  imageLoadingNodes?: Set<string>;
}

// Helper to determine depth for sizing
const getNodeDepth = (nodeId: string, nodes: GoalNode[]): number => {
    let depth = 0;
    let current = nodes.find(n => n.id === nodeId);
    while (current && current.parentId) {
        depth++;
        current = nodes.find(n => n.id === current?.parentId);
    }
    return depth;
};

const MindMap: React.FC<MindMapProps> = ({
    nodes, links, selectedNodeId, onNodeClick, onUpdateNode, onDeleteNode, onReparentNode, onConvertNodeToTask, onAddSubNode, width, height, editingNodeId, onEditEnd, imageLoadingNodes
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Layout Mode State
  const [layout, setLayout] = useState<LayoutMode>('radial');
  const prevLayoutRef = useRef<LayoutMode>(layout);

  // Simulation State
  const simulationRef = useRef<d3.Simulation<GoalNode, GoalLink> | null>(null);
  // Position Persistence
  const nodeStateRef = useRef<Map<string, {x: number, y: number, vx: number, vy: number, fx?: number | null, fy?: number | null}>>(new Map());
  // Zoom Transform Persistence
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  // Structure Change Detection
  const prevStructureRef = useRef<string>('');

  // --- Layout Helpers ---
  interface TreeNode {
    id: string;
    children: TreeNode[];
    node: GoalNode & { depth: number; r: number };
  }

  const buildTree = (d3Nodes: (GoalNode & { depth: number; r: number })[]): TreeNode | null => {
    const root = d3Nodes.find(n => n.type === NodeType.ROOT);
    if (!root) return null;
    const build = (parent: typeof root): TreeNode => ({
      id: parent.id,
      node: parent,
      children: d3Nodes.filter(n => n.parentId === parent.id).map(build),
    });
    return build(root);
  };

  const computeLayoutPositions = (
    d3Nodes: (GoalNode & { depth: number; r: number })[],
    mode: LayoutMode,
    w: number,
    h: number
  ): Map<string, { x: number; y: number }> => {
    const positions = new Map<string, { x: number; y: number }>();
    const tree = buildTree(d3Nodes);
    if (!tree) return positions;

    if (mode === 'radial') {
      // Root at center
      positions.set(tree.id, { x: w / 2, y: h / 2 });

      // Count leaves for proportional sector allocation
      const countLeaves = (node: TreeNode): number => {
        if (node.children.length === 0) return 1;
        return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
      };

      // Recursively assign each child within its parent's angular sector
      const assignRadial = (node: TreeNode, depth: number, angleStart: number, angleEnd: number) => {
        if (node.children.length === 0) return;

        // Use equal spacing for cleaner look when there are few siblings
        const useEqualSpacing = node.children.length <= 8;

        // Responsive radius calculation to prevent overlap
        const minSpacing = 100; // minimum px between nodes on same ring
        const baseRadius = 220 + depth * 140;
        const circumference = Math.max(node.children.length * minSpacing, 2 * Math.PI * baseRadius);
        const radius = Math.max(180, circumference / (2 * Math.PI));

        if (useEqualSpacing) {
          // Equal angular spacing for clean distribution
          const angleSpan = (angleEnd - angleStart) / node.children.length;
          node.children.forEach((child, i) => {
            const childAngle = angleStart + angleSpan * (i + 0.5);

            positions.set(child.id, {
              x: w / 2 + radius * Math.cos(childAngle),
              y: h / 2 + radius * Math.sin(childAngle),
            });

            // Recursively assign children their sector
            assignRadial(child, depth + 1, angleStart + angleSpan * i, angleStart + angleSpan * (i + 1));
          });
        } else {
          // Leaf-weighted proportional spacing for many siblings
          const parentLeaves = countLeaves(node);
          let angleCursor = angleStart;

          node.children.forEach(child => {
            const childLeaves = countLeaves(child);
            const childAngleSpan = ((angleEnd - angleStart) * childLeaves) / parentLeaves;
            const childAngle = angleCursor + childAngleSpan / 2;

            positions.set(child.id, {
              x: w / 2 + radius * Math.cos(childAngle),
              y: h / 2 + radius * Math.sin(childAngle),
            });

            assignRadial(child, depth + 1, angleCursor, angleCursor + childAngleSpan);
            angleCursor += childAngleSpan;
          });
        }
      };

      assignRadial(tree, 0, -Math.PI / 2, 2 * Math.PI - Math.PI / 2);
    } else if (mode === 'tree') {
      // Vertical tree: root at top center
      const levelSpacing = 150;

      // Count total leaves for proper spacing
      const countLeaves = (node: TreeNode): number => {
        if (node.children.length === 0) return 1;
        return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
      };
      const totalLeaves = countLeaves(tree);
      const totalWidth = Math.max(totalLeaves * 120, w * 0.8);
      const startX = w / 2 - totalWidth / 2;

      const assignProportional = (node: TreeNode, depth: number, xMin: number, xMax: number) => {
        const cx = (xMin + xMax) / 2;
        const cy = 100 + depth * levelSpacing;
        positions.set(node.id, { x: cx, y: cy });

        if (node.children.length > 0) {
          const parentLeaves = countLeaves(node);
          let xCursor = xMin;
          node.children.forEach(child => {
            const childLeaves = countLeaves(child);
            const childWidth = ((xMax - xMin) * childLeaves) / parentLeaves;
            assignProportional(child, depth + 1, xCursor, xCursor + childWidth);
            xCursor += childWidth;
          });
        }
      };

      assignProportional(tree, 0, startX, startX + totalWidth);
    } else if (mode === 'horizontal') {
      // Horizontal tree: root at left center
      const levelSpacing = 200;

      const countLeaves = (node: TreeNode): number => {
        if (node.children.length === 0) return 1;
        return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
      };
      const totalLeaves = countLeaves(tree);
      const totalHeight = Math.max(totalLeaves * 100, h * 0.8);
      const startY = h / 2 - totalHeight / 2;

      const assignProportional = (node: TreeNode, depth: number, yMin: number, yMax: number) => {
        const cx = 150 + depth * levelSpacing;
        const cy = (yMin + yMax) / 2;
        positions.set(node.id, { x: cx, y: cy });

        if (node.children.length > 0) {
          const parentLeaves = countLeaves(node);
          let yCursor = yMin;
          node.children.forEach(child => {
            const childLeaves = countLeaves(child);
            const childHeight = ((yMax - yMin) * childLeaves) / parentLeaves;
            assignProportional(child, depth + 1, yCursor, yCursor + childHeight);
            yCursor += childHeight;
          });
        }
      };

      assignProportional(tree, 0, startY, startY + totalHeight);
    }
    // 'force' mode returns empty map (simulation handles positioning)
    return positions;
  };

  // Edit Function (Reusable)
  const startEditing = (d: any, group: d3.Selection<any, any, any, any>) => {
      // Avoid opening if already editing
      if (!group.select("foreignObject.edit-input").empty()) return;

      const textEl = group.select(".node-label");
      textEl.style("opacity", "0"); 
      
      // Hide menu while editing
      group.select(".node-menu").style("opacity", "0");

      const foWidth = 160;
      const foHeight = 40;
      const dy = d.r + 15;

      const fo = group.append("foreignObject")
          .attr("class", "edit-input")
          .attr("width", foWidth)
          .attr("height", foHeight) 
          .attr("x", -foWidth / 2)
          .attr("y", dy - 10)
          .style("overflow", "visible");

      const input = fo.append("xhtml:input")
          .attr("type", "text")
          .attr("value", d.text)
          .attr("placeholder", "목표 입력")
          .style("width", "100%")
          .style("background", "#050B14")
          .style("color", "#CCFF00")
          .style("border", "1px solid #CCFF00")
          .style("border-radius", "4px")
          .style("text-align", "center")
          .style("font-family", "Inter")
          .style("font-size", "14px")
          .style("outline", "none")
          .style("box-shadow", "0 0 15px rgba(204,255,0,0.5)");

      const inputNode = input.node() as HTMLInputElement;
      
      // Delay focus slightly to ensure render is complete
      setTimeout(() => {
          inputNode.focus();
          inputNode.select();
      }, 10);

      // Stop propagation to prevent drag
      input.on("mousedown", (e: Event) => e.stopPropagation());
      input.on("click", (e: Event) => e.stopPropagation());
      input.on("dblclick", (e: Event) => e.stopPropagation());

      const finishEditing = () => {
          const newVal = inputNode.value.trim();
          
          if (newVal) {
              if (newVal !== d.text) {
                  onUpdateNode(d.id, { text: newVal });
              }
              // Restore UI elements
              textEl.style("opacity", "1");
              group.select(".node-menu").style("opacity", "1");
          } else {
              if (d.type !== NodeType.ROOT) {
                  onDeleteNode(d.id);
                  return; 
              } else {
                  textEl.style("opacity", "1");
                  group.select(".node-menu").style("opacity", "1");
              }
          }
          fo.remove();
          if (onEditEnd) onEditEnd();
      };

      input.on("blur", () => {
        if (!document.body.contains(inputNode)) {
            return;
        }
        finishEditing();
      });
      
      input.on("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter" && !e.isComposing) {
              finishEditing();
          }
          if (e.key === "Escape") {
              if (!d.text.trim() && d.type !== NodeType.ROOT) {
                  onDeleteNode(d.id);
              } else {
                  textEl.style("opacity", "1");
                  group.select(".node-menu").style("opacity", "1");
              }
              fo.remove();
              if (onEditEnd) onEditEnd();
          }
      });
  };

  // 1. Structural Effect: Handles Simulation, Nodes, Links creation
  useEffect(() => {
    if (!svgRef.current) return;

    // Clear position cache and reset zoom when layout mode changes
    if (layout !== prevLayoutRef.current) {
        nodeStateRef.current.clear();
        zoomTransformRef.current = d3.zoomIdentity;
        prevLayoutRef.current = layout;
        prevStructureRef.current = ''; // Force rebuild
    }

    // Only rebuild SVG if the structure (node ids, links, editingNodeId, or layout) actually changed
    const structureKey = nodes.map(n => `${n.id}:${n.text}:${n.status}:${n.collapsed}:${n.imageUrl || ''}`).join('|') + '||' + links.map(l => `${typeof l.source === 'object' ? (l.source as any).id : l.source}-${typeof l.target === 'object' ? (l.target as any).id : l.target}`).join('|') + '||' + (editingNodeId || '') + '||' + layout;
    if (structureKey === prevStructureRef.current) return;
    prevStructureRef.current = structureKey;

    // Prepare Data
    // For non-force layouts, ignore cached positions — layout algorithm computes them deterministically
    const useCache = layout === 'force';
    const d3Nodes = nodes.map(n => {
        const stored = useCache ? nodeStateRef.current.get(n.id) : undefined;
        const depth = getNodeDepth(n.id, nodes);
        const r = n.type === NodeType.ROOT ? 65 : (depth === 1 ? 45 : 35);

        return {
            ...n,
            depth,
            r,
            x: stored ? stored.x : (n.parentId ? undefined : width/2),
            y: stored ? stored.y : (n.parentId ? undefined : height/2),
            vx: 0,
            vy: 0,
            fx: stored?.fx ?? undefined,
            fy: stored?.fy ?? undefined
        };
    }) as (GoalNode & { depth: number, r: number })[];

    // Sort by depth to ensure parents are positioned before children
    d3Nodes.sort((a, b) => a.depth - b.depth);

    d3Nodes.forEach(n => {
        if ((n.x === undefined || n.y === undefined) && n.parentId) {
            const parent = d3Nodes.find(p => p.id === n.parentId);
            if (parent && parent.x !== undefined && parent.y !== undefined) {
                // Reduced random offset for cleaner new node appearance
                n.x = parent.x + (Math.random() - 0.5) * 100;
                n.y = parent.y + (Math.random() - 0.5) * 100;
            } else {
                n.x = width / 2;
                n.y = height / 2;
            }
        }
    });

    // Apply layout positions
    if (layout !== 'force') {
        const layoutPositions = computeLayoutPositions(d3Nodes, layout, width, height);
        d3Nodes.forEach(n => {
            const pos = layoutPositions.get(n.id);
            if (pos) {
                n.x = pos.x;
                n.y = pos.y;
                n.fx = pos.x;
                n.fy = pos.y;
            }
        });
        // Pin root at exact center for all non-force layouts
        const rootNode = d3Nodes.find(n => n.type === NodeType.ROOT);
        if (rootNode) {
            rootNode.x = width / 2;
            rootNode.y = height / 2;
            rootNode.fx = width / 2;
            rootNode.fy = height / 2;
        }
    } else {
        // Force mode: pin root at center, clear fx/fy on others
        d3Nodes.forEach(n => {
            if (n.type === NodeType.ROOT) {
                n.fx = width / 2;
                n.fy = height / 2;
            }
        });
    }

    const d3Links = links.map(l => ({ ...l })) as unknown as GoalLink[];

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        zoomTransformRef.current = event.transform;
      });
    svg.call(zoom);

    // Restore previous zoom transform
    if (zoomTransformRef.current !== d3.zoomIdentity) {
        svg.call(zoom.transform, zoomTransformRef.current);
    }

    const handleCenter = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const targetNode = d3Nodes.find(n => n.id === detail?.nodeId);
        if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
            svg.transition().duration(500).call(
                zoom.transform,
                d3.zoomIdentity.translate(width / 2 - targetNode.x, height / 2 - targetNode.y)
            );
        } else {
            // No node selected - center on root
            svg.transition().duration(500).call(
                zoom.transform,
                d3.zoomIdentity.translate(0, 0)
            );
        }
    };
    window.addEventListener('mindmap-center', handleCenter);

    // Physics
    const simulation = d3.forceSimulation<any>(d3Nodes);

    if (layout === 'force') {
      // Full force-directed simulation
      simulation
        .force("link", d3.forceLink<any, GoalLink>(d3Links)
            .id(d => d.id)
            .distance(d => d.target.depth === 1 ? 220 : 120)
            .strength(1)
        )
        .force("charge", d3.forceManyBody().strength(d => (d as any).type === NodeType.ROOT ? -2000 : -800))
        .force("collide", d3.forceCollide().radius(d => (d as any).r + 30).strength(1))
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.02))
        .force("radial", d3.forceRadial<any>(
            d => d.type === NodeType.ROOT ? 0 : (d.depth === 1 ? 220 : 360 + d.depth * 140),
            width / 2,
            height / 2
        ).strength(0.3))
        .velocityDecay(0.65);
    } else {
      // Non-force layouts: nodes are pinned via fx/fy, only keep light link force for aesthetics
      simulation
        .force("link", d3.forceLink<any, GoalLink>(d3Links)
            .id(d => d.id)
            .distance(d => d.target.depth === 1 ? 180 : 120)
            .strength(0.05)
        )
        .velocityDecay(0.9);
    }

    simulation.stop();
    const hasStoredPositions = d3Nodes.some(n => nodeStateRef.current.has(n.id));
    const warmupTicks = layout === 'force' ? (hasStoredPositions ? 10 : 80) : 1;
    for (let i = 0; i < warmupTicks; i++) simulation.tick();
    simulation.restart();
    simulationRef.current = simulation as any;

    // Render Links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("path")
      .data(d3Links)
      .enter().append("path")
      .attr("stroke", "#CCFF00")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 2)
      .attr("fill", "none");

    // Render Nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(d3Nodes)
      .enter().append("g")
      .attr("class", "node-group")
      .attr("cursor", "pointer")
      .call(d3.drag<SVGGElement, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Interaction
    node.on("click", (event, d) => {
        if (event.defaultPrevented) return;
        onNodeClick(d);
    });

    node.on("dblclick", function(event, d) {
        event.stopPropagation();
        event.preventDefault();
        startEditing(d, d3.select(this));
    });

    // Node Visuals
    node.append("circle")
        .attr("r", d => d.r + 8)
        .attr("fill", "none")
        .attr("stroke", "#CCFF00")
        .attr("stroke-width", 2)
        .attr("opacity", 0) 
        .attr("class", "selection-ring")
        .style("pointer-events", "none");

    node.append("circle")
      .attr("r", d => d.r)
      .attr("fill", "#0a1a2f")
      .attr("stroke", d => {
        if (d.status === NodeStatus.COMPLETED) return "#10B981";
        if (d.status === NodeStatus.STUCK) return "#EF4444";
        return "#3B82F6";
      })
      .attr("stroke-width", 2)
      .attr("class", "main-circle transition-colors duration-300");

    // Images
    const defs = svg.append("defs");
    node.each(function(d) {
        if (d.imageUrl) {
             const patternId = `pattern-${d.id}`;
             defs.append("pattern")
                .attr("id", patternId)
                .attr("height", "100%")
                .attr("width", "100%")
                .attr("patternContentUnits", "objectBoundingBox")
                .append("image")
                .attr("height", 1)
                .attr("width", 1)
                .attr("preserveAspectRatio", "none")
                .attr("href", d.imageUrl);

             d3.select(this).append("circle")
                .attr("r", d.r - 4)
                .attr("fill", `url(#${patternId})`)
                .style("filter", "grayscale(20%) contrast(1.1)");
        }
    });

    // Loading Indicators
    node.each(function(d) {
        if (imageLoadingNodes?.has(d.id)) {
            const loadingG = d3.select(this).append("g").attr("class", "loading-indicator");
            loadingG.append("circle")
                .attr("r", d.r)
                .attr("fill", "rgba(5,11,20,0.7)")
                .style("pointer-events", "none");
            loadingG.append("text")
                .text("⏳")
                .attr("text-anchor", "middle")
                .attr("dy", 8)
                .attr("font-size", "24px")
                .style("pointer-events", "none");
        }
    });

    // Collapse Button
    node.each(function(d) {
        const hasChildren = d.collapsed || d3Links.some(l => (l.source as any).id === d.id);
        if (hasChildren) {
            const btnGroup = d3.select(this).append("g")
                .attr("class", "toggle-btn")
                .attr("transform", `translate(${d.r}, 0)`)
                .attr("cursor", "pointer")
                .on("click", (e) => {
                    e.stopPropagation();
                    onUpdateNode(d.id, { collapsed: !d.collapsed });
                });

            btnGroup.append("circle")
                .attr("r", 8)
                .attr("fill", "#050B14")
                .attr("stroke", d.collapsed ? "#FF4D00" : "#CCFF00")
                .attr("stroke-width", 1.5);

            btnGroup.append("text")
                .text(d.collapsed ? "+" : "-")
                .attr("dy", 3)
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("fill", "white")
                .style("pointer-events", "none");
        }
    });

    // Label
    node.append("text")
      .attr("class", "node-label")
      .attr("dy", d => d.r + 20)
      .attr("text-anchor", "middle")
      .text(d => d.text)
      .attr("fill", "white")
      .attr("font-family", "Inter")
      .attr("font-weight", "500")
      .attr("font-size", d => d.type === NodeType.ROOT ? "16px" : "13px")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,1)")
      .style("pointer-events", "none") 
      .call(getWrap, 120);

    if (editingNodeId) {
        node.each(function(d) {
            if (d.id === editingNodeId) {
                startEditing(d, d3.select(this));
            }
        });
    }

    // Tick
    simulation.on("tick", () => {
        d3Nodes.forEach(n => {
            nodeStateRef.current.set(n.id, { x: n.x!, y: n.y!, vx: n.vx!, vy: n.vy!, fx: n.fx, fy: n.fy });
        });
        link.attr("d", (d: any) => {
            // Better curved paths with control point perpendicular to the line
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const cx = (d.source.x + d.target.x) / 2 - dy * 0.15;
            const cy = (d.source.y + d.target.y) / 2 + dx * 0.15;
            return `M${d.source.x},${d.source.y} Q${cx},${cy} ${d.target.x},${d.target.y}`;
        });
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Apply warm-up positions immediately (don't wait for first tick)
    link.attr("d", (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const cx = (d.source.x + d.target.x) / 2 - dy * 0.15;
        const cy = (d.source.y + d.target.y) / 2 + dx * 0.15;
        return `M${d.source.x},${d.source.y} Q${cx},${cy} ${d.target.x},${d.target.y}`;
    });
    node.attr("transform", d => `translate(${d.x},${d.y})`);

    // Drag & Collision
    let potentialParentId: string | null = null;

    // Store original layout positions for snapping back in non-force modes
    const layoutPositionsForDrag = layout !== 'force' ? computeLayoutPositions(d3Nodes, layout, width, height) : null;

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;

      potentialParentId = null;
      d3.selectAll('.main-circle').attr('filter', null);

      svg.selectAll(".nodes g").each(function(n: any) {
          if (n.id === d.id) return;

          const dx = event.x - n.x;
          const dy = event.y - n.y;
          const dist = Math.sqrt(dx*dx + dy*dy);

          if (dist < (n.r + d.r)) {
             potentialParentId = n.id;
             d3.select(this).select('.main-circle')
               .attr('filter', 'drop-shadow(0 0 8px white)');
          }
      });
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);

      d3.selectAll('.main-circle').attr('filter', null);

      if (potentialParentId && potentialParentId !== d.id) {
          // Reparenting: let node float to find new position
          if (d.type !== NodeType.ROOT) {
              if (layout === 'force') {
                  d.fx = null;
                  d.fy = null;
              }
              // Non-force: reparent will trigger re-render with new positions
          }
          onReparentNode(d.id, potentialParentId);
      } else if (layout !== 'force' && layoutPositionsForDrag) {
          // Non-force layouts: snap back to layout position
          const pos = layoutPositionsForDrag.get(d.id);
          if (pos) {
              d.fx = pos.x;
              d.fy = pos.y;
              d.x = pos.x;
              d.y = pos.y;
          }
      }
      // Force mode without reparent: keep fx/fy set so node stays pinned where dropped
      potentialParentId = null;
    }

    function getWrap(textSelection: any, width: number) {
        textSelection.each(function(this: any) {
            const text = d3.select(this);
            const words = text.text().split(/\s+/).reverse();
            let word;
            let line: string[] = [];
            const lineHeight = 1.2;
            const y = text.attr("y");
            const dy = parseFloat(text.attr("dy"));
            text.text(null);
            let tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "px");
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node()!.getComputedTextLength() > width) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", lineHeight + "em").text(word);
                }
            }
        });
    }

    return () => {
      simulation.stop();
      window.removeEventListener('mindmap-center', handleCenter);
      prevStructureRef.current = ''; // Reset for StrictMode re-mount
    };
  }, [nodes, links, width, height, onNodeClick, onUpdateNode, onDeleteNode, editingNodeId, onReparentNode, imageLoadingNodes, layout]);

  // 2. Selection Effect: Updates styles & Adds Horizontal Context Menu
  useEffect(() => {
     if (!svgRef.current) return;
     const svg = d3.select(svgRef.current);
     const nodeGroups = svg.selectAll(".node-group");

     nodeGroups.each(function(d: any) {
        const isSelected = d.id === selectedNodeId;
        const g = d3.select(this);

        // Update Selection Ring
        g.select(".selection-ring")
            .attr("opacity", isSelected ? 1 : 0)
            .attr("class", isSelected ? "selection-ring animate-pulse-glow" : "selection-ring");
        
        // Update Main Circle Border
        g.select(".main-circle")
           .attr("stroke", isSelected ? "#CCFF00" : (d.status === NodeStatus.COMPLETED ? "#10B981" : (d.status === NodeStatus.STUCK ? "#EF4444" : "#3B82F6")))
           .attr("stroke-width", isSelected ? 3 : 2);

        // Manage Controls (Horizontal Menu)
        const isEditingThis = editingNodeId === d.id;
        
        g.select(".node-menu").remove();
        
        if (isSelected && !isEditingThis) {
             // Menu Items Data
             const menuItems = [
                 { label: "편집", action: () => startEditing(d, g) },
                 // Show sibling only for non-root nodes (siblings = add to parent)
                 ...(d.parentId ? [{ label: "형제 노드", action: () => onAddSubNode(d.parentId!) }] : []),
                 { label: "자식 노드", action: () => onAddSubNode(d.id) },
                 ...(d.type !== NodeType.ROOT ? [{ label: "삭제", action: () => onDeleteNode(d.id), danger: true }] : [])
             ];

             const foWidth = 500; // large enough to contain any menu
             const menuHeight = 44;

             // Use ForeignObject for a nice HTML menu
             const menuFO = g.append("foreignObject")
                .attr("class", "node-menu")
                .attr("width", foWidth)
                .attr("height", menuHeight + 20)
                .attr("x", -foWidth / 2)
                .attr("y", -d.r - 60) // Position nicely above
                .style("overflow", "visible");

             const menuDiv = menuFO.append("xhtml:div")
                .style("display", "inline-flex")
                .style("align-items", "center")
                .style("margin", "0 auto")
                .style("position", "relative")
                .style("left", "50%")
                .style("transform", "translateX(-50%)")
                .attr("class", "bg-white text-black rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.4)] px-2 py-0.5")
                .style("font-family", "'Inter', sans-serif")
                .style("font-size", "12px")
                .style("font-weight", "600");

             menuItems.forEach((item, idx) => {
                 const btn = menuDiv.append("xhtml:button")
                    .text(item.label)
                    .attr("class", `px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors text-xs font-semibold ${(item as any).danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-800'}`)
                    .style("white-space", "nowrap")
                    .style("cursor", "pointer");

                 // Add Divider
                 if (idx < menuItems.length - 1) {
                    menuDiv.append("xhtml:div")
                        .attr("class", "w-px h-4 bg-gray-200 mx-0.5");
                 }

                 // Event Listeners
                 btn.on("mousedown", (e: Event) => e.stopPropagation());
                 btn.on("click", (e: Event) => {
                     e.stopPropagation();
                     item.action();
                 });
                 btn.on("dblclick", (e: Event) => e.stopPropagation());
             });

             // Add divider before ▶
             menuDiv.append("xhtml:div")
                 .attr("class", "w-px h-4 bg-gray-200 mx-0.5");

             const moreBtn = menuDiv.append("xhtml:button")
                 .text("▶")
                 .attr("class", "px-2 py-2 rounded hover:bg-gray-100 transition-colors text-gray-400")
                 .style("white-space", "nowrap")
                 .style("cursor", "pointer")
                 .style("font-size", "10px");

             moreBtn.on("mousedown", (e: Event) => e.stopPropagation());
             moreBtn.on("click", (e: Event) => {
                 e.stopPropagation();
                 // Toggle status for now - cycle through PENDING → COMPLETED → STUCK
                 const statusCycle: Record<string, string> = {
                     [NodeStatus.PENDING]: NodeStatus.COMPLETED,
                     [NodeStatus.COMPLETED]: NodeStatus.STUCK,
                     [NodeStatus.STUCK]: NodeStatus.PENDING,
                 };
                 onUpdateNode(d.id, { status: statusCycle[d.status] as NodeStatus });
             });
             moreBtn.on("dblclick", (e: Event) => e.stopPropagation());

             // Add a little arrow pointing down
             menuDiv.append("xhtml:div")
                .attr("class", "absolute left-1/2 bottom-[-4px] w-2 h-2 bg-white transform -translate-x-1/2 rotate-45");
        }
     });

  }, [selectedNodeId, nodes, editingNodeId, onConvertNodeToTask, onAddSubNode, onDeleteNode]); 

  const layoutOptions: { mode: LayoutMode; label: string }[] = [
    { mode: 'radial', label: '방사형' },
    { mode: 'tree', label: '트리' },
    { mode: 'horizontal', label: '가로' },
    { mode: 'force', label: '자유' },
  ];

  return (
    <div className="w-full h-full bg-deep-space relative overflow-hidden">
      <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
         <h1 className="text-2xl font-display text-white tracking-widest drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]">SUPER COACH <span className="text-neon-lime text-xs align-top">BETA</span></h1>
         <p className="text-gray-400 text-xs font-body">Neural Interface Active</p>
      </div>

      {/* Layout Switcher */}
      <div className="absolute top-16 right-4 z-10 flex bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-1 py-0.5 gap-0.5">
        {layoutOptions.map(opt => (
          <button
            key={opt.mode}
            onClick={() => setLayout(opt.mode)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
              layout === opt.mode
                ? 'bg-neon-lime text-black shadow-[0_0_8px_rgba(204,255,0,0.5)]'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <svg ref={svgRef} width={width} height={height} className="cursor-grab active:cursor-grabbing" style={{ overflow: 'visible' }} role="img" aria-label="마인드맵" />
    </div>
  );
};

export default React.memo(MindMap, (prev, next) => {
  // Only re-render if these specific props change
  return (
    prev.nodes === next.nodes &&
    prev.links === next.links &&
    prev.selectedNodeId === next.selectedNodeId &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.editingNodeId === next.editingNodeId &&
    prev.imageLoadingNodes === next.imageLoadingNodes
  );
});