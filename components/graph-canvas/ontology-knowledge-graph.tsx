"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useOntologyStore } from "@/stores";
import { useSelectionStore } from "@/stores";
import { useUIStore } from "@/stores";
import { useConsultingStore } from "@/stores";

// 扩展类型以包含 d3 的仿真属性
interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  subLabel: string;
  isSelected: boolean;
  isHighlighted: boolean;
  radius: number;
}

interface D3Edge extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  source: string | D3Node;
  target: string | D3Node;
  label: string;
  isSelected: boolean;
}

const GRAPH_THEME = {
  node: {
    defaultFill: "#111827",
    defaultStroke: "#334155",
    focusFill: "#0b1220",
    focusStroke: "#60a5fa",
    selectedFill: "#2563eb",
    selectedStroke: "#93c5fd",
    semanticFill: "#7c3aed",
    semanticStroke: "#c4b5fd",
  },
  edge: {
    defaultStroke: "#475569",
    focusStroke: "#94a3b8",
    selectedStroke: "#60a5fa",
    inboundStroke: "#f59e0b",
    outboundStroke: "#22c55e",
    label: "#94a3b8",
  },
} as const;

export function OntologyKnowledgeGraph() {
  const { objectTypes, linkTypes } = useOntologyStore();
  const { domains, selectedDomainId } = useConsultingStore();
  const {
    selectedNodeId,
    selectedEdgeId,
    semanticHighlightedNodeIds,
    semanticHighlightedEdgeIds,
    selectNode,
    selectEdge,
    selectObjectType,
    selectLinkType,
    clearAll,
  } = useSelectionStore();
  const { openRightPanel, workMode } = useUIStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Edge> | null>(null);
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, D3Node, SVGGElement, unknown> | null>(null);
  const linkLineSelectionRef = useRef<d3.Selection<SVGLineElement, D3Edge, SVGGElement, unknown> | null>(null);
  const linkTextSelectionRef = useRef<d3.Selection<SVGTextElement, D3Edge, SVGGElement, unknown> | null>(null);
  const radiusByNodeIdRef = useRef<Record<string, number>>({});
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const positionsRef = useRef<
    Map<
      string,
      {
        x?: number;
        y?: number;
        vx?: number;
        vy?: number;
      }
    >
  >(new Map());

  const radiusByNodeId = React.useMemo(() => {
    const selectedDomain = domains.find((d) => d.id === selectedDomainId) || null;
    const scaleMap = selectedDomain?.entityScales || {};
    const map: Record<string, number> = {};
    for (const ot of objectTypes) {
      if (workMode !== "CONSULTING") {
        map[ot.id] = 35;
        continue;
      }
      const scale = scaleMap[ot.id];
      if (scale === "S") map[ot.id] = 28;
      else if (scale === "M") map[ot.id] = 36;
      else if (scale === "L") map[ot.id] = 44;
      else if (scale === "XL") map[ot.id] = 52;
      else if (selectedDomain && selectedDomain.objectTypeIds.includes(ot.id)) map[ot.id] = 36;
      else map[ot.id] = 32;
    }
    return map;
  }, [domains, selectedDomainId, objectTypes, workMode]);

  useEffect(() => {
    radiusByNodeIdRef.current = radiusByNodeId;
  }, [radiusByNodeId]);

  // 整理数据
  const nodes: D3Node[] = React.useMemo(() => {
    return objectTypes.map((ot) => ({
      id: ot.id,
      label: ot.displayName,
      subLabel: ot.apiName,
      isSelected: false,
      isHighlighted: false,
      radius: 35,
    }));
  }, [objectTypes]);

  const edges: D3Edge[] = React.useMemo(() => {
    return linkTypes.map((lt) => ({
      id: lt.id,
      source: lt.sourceTypeId,
      target: lt.targetTypeId,
      label: lt.displayName,
      isSelected: false,
    }));
  }, [linkTypes]);

  const focus = React.useMemo(() => {
    if (selectedNodeId) {
      const nodeIds = new Set<string>([selectedNodeId]);
      const edgeIds = new Set<string>();
      const inboundEdgeIds = new Set<string>();
      const outboundEdgeIds = new Set<string>();
      for (const e of edges) {
        const src = typeof e.source === "string" ? e.source : e.source.id;
        const tgt = typeof e.target === "string" ? e.target : e.target.id;
        if (src === selectedNodeId || tgt === selectedNodeId) {
          edgeIds.add(e.id);
          nodeIds.add(src);
          nodeIds.add(tgt);
          if (src === selectedNodeId) outboundEdgeIds.add(e.id);
          if (tgt === selectedNodeId) inboundEdgeIds.add(e.id);
        }
      }
      return { nodeIds, edgeIds, inboundEdgeIds, outboundEdgeIds };
    }

    if (selectedEdgeId) {
      const nodeIds = new Set<string>();
      const edgeIds = new Set<string>([selectedEdgeId]);
      const e = edges.find((x) => x.id === selectedEdgeId);
      if (e) {
        const src = typeof e.source === "string" ? e.source : e.source.id;
        const tgt = typeof e.target === "string" ? e.target : e.target.id;
        nodeIds.add(src);
        nodeIds.add(tgt);
      }
      return { nodeIds, edgeIds, inboundEdgeIds: new Set<string>(), outboundEdgeIds: new Set<string>() };
    }

    return null;
  }, [selectedNodeId, selectedEdgeId, edges]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const positions = positionsRef.current;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    sizeRef.current = { width, height };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // 清除旧内容

    // 定义箭头标记
    const defs = svg.append("defs");

    const addArrow = (id: string, fill: string) => {
      defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -6 12 12")
        .attr("refX", 12)
        .attr("refY", 0)
        .attr("markerWidth", 12)
        .attr("markerHeight", 12)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-6L12,0L0,6")
        .attr("fill", fill);
    };

    addArrow("arrow-default", GRAPH_THEME.edge.defaultStroke);
    addArrow("arrow-selected", GRAPH_THEME.edge.selectedStroke);
    addArrow("arrow-inbound", GRAPH_THEME.edge.inboundStroke);
    addArrow("arrow-outbound", GRAPH_THEME.edge.outboundStroke);

    // 主容器（用于缩放）
    const g = svg.append("g");

    // 缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    
    // 背景点击清除选择
    svg.on("click", (event) => {
      if (event.target.tagName === "svg") {
        clearAll();
      }
    });

    // 边组
    const linkGroup = g.append("g").attr("class", "links");
    // 节点组
    const nodeGroup = g.append("g").attr("class", "nodes");

    const seededNodes: D3Node[] = nodes.map((n) => {
      const p = positions.get(n.id);
      return {
        ...n,
        x: p?.x,
        y: p?.y,
        vx: p?.vx,
        vy: p?.vy,
      };
    });

    // 创建仿真
    const simulation = d3.forceSimulation<D3Node, D3Edge>(seededNodes)
      .force("link", d3.forceLink<D3Node, D3Edge>(edges).id((d) => d.id).distance(200))
      .force("charge", d3.forceManyBody().strength(-620))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.06))
      .force("y", d3.forceY(height / 2).strength(0.06))
      .force("collide", d3.forceCollide().radius((d) => (d as D3Node).radius + 20));
    simulation.velocityDecay(0.6);

    simulationRef.current = simulation;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !simulationRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      sizeRef.current = { width: w, height: h };
      simulationRef.current.force("center", d3.forceCenter(w / 2, h / 2));
      simulationRef.current.force("x", d3.forceX(w / 2).strength(0.06));
      simulationRef.current.force("y", d3.forceY(h / 2).strength(0.06));
      simulationRef.current.alpha(0.06).restart();
    });
    ro.observe(containerRef.current);

    // 渲染边
    const link = linkGroup
      .selectAll(".link")
      .data(edges, (d: any) => d.id)
      .join("g")
      .attr("class", "link");

    const linkPath = link.append("line")
      .attr("stroke", GRAPH_THEME.edge.defaultStroke)
      .attr("stroke-width", 1.4)
      .attr("stroke-linecap", "round")
      .attr("marker-end", "url(#arrow-default)")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        selectEdge(d.id);
        selectObjectType(null);
        selectLinkType(d.id);
        openRightPanel();
      });

    const linkText = link.append("text")
      .text((d) => d.label)
      .attr("fill", GRAPH_THEME.edge.label)
      .attr("font-size", "12px")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .style("pointer-events", "none");

    // 渲染节点
    const node = nodeGroup
      .selectAll(".node")
      .data(seededNodes, (d: any) => d.id)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(d3.drag<any, D3Node>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        selectNode(d.id);
        selectObjectType(d.id);
        openRightPanel();
      });

    // 节点圆圈
    node.append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", GRAPH_THEME.node.defaultFill)
      .attr("stroke", GRAPH_THEME.node.defaultStroke)
      .attr("stroke-width", 2);

    // 节点主标题
    node.append("text")
      .text((d) => d.label)
      .attr("fill", "#ffffff")
      .attr("font-size", "14px")
      .attr("font-weight", "500")
      .attr("text-anchor", "middle")
      .attr("dy", -2);

    // 节点副标题
    node.append("text")
      .text((d) => d.subLabel)
      .attr("fill", "#a0a0a0")
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("dy", 12);

    // 仿真每一步更新位置
    simulation.on("tick", () => {
      const { width: w, height: h } = sizeRef.current;
      if (w > 120 && h > 120) {
        for (const n of seededNodes) {
          const r = (radiusByNodeIdRef.current[n.id] ?? 35) + 10;
          if (typeof n.x === "number") n.x = Math.max(r, Math.min(w - r, n.x));
          if (typeof n.y === "number") n.y = Math.max(r, Math.min(h - r, n.y));
        }
      }

      linkPath
        .attr("x1", (d: any) => {
          const sx = d.source.x ?? 0;
          const sy = d.source.y ?? 0;
          const tx = d.target.x ?? 0;
          const ty = d.target.y ?? 0;
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const r = (radiusByNodeIdRef.current[d.source.id] ?? 35) + 6;
          return sx + (dx / dist) * r;
        })
        .attr("y1", (d: any) => {
          const sx = d.source.x ?? 0;
          const sy = d.source.y ?? 0;
          const tx = d.target.x ?? 0;
          const ty = d.target.y ?? 0;
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const r = (radiusByNodeIdRef.current[d.source.id] ?? 35) + 6;
          return sy + (dy / dist) * r;
        })
        .attr("x2", (d: any) => {
          const sx = d.source.x ?? 0;
          const sy = d.source.y ?? 0;
          const tx = d.target.x ?? 0;
          const ty = d.target.y ?? 0;
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const r = (radiusByNodeIdRef.current[d.target.id] ?? 35) + 10;
          return tx - (dx / dist) * r;
        })
        .attr("y2", (d: any) => {
          const sx = d.source.x ?? 0;
          const sy = d.source.y ?? 0;
          const tx = d.target.x ?? 0;
          const ty = d.target.y ?? 0;
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const r = (radiusByNodeIdRef.current[d.target.id] ?? 35) + 10;
          return ty - (dy / dist) * r;
        });

      linkText
        .attr("x", (d: any) => {
          const sx = d.source.x ?? 0;
          const sy = d.source.y ?? 0;
          const tx = d.target.x ?? 0;
          const ty = d.target.y ?? 0;
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const r1 = (radiusByNodeIdRef.current[d.source.id] ?? 35) + 6;
          const r2 = (radiusByNodeIdRef.current[d.target.id] ?? 35) + 10;
          const x1 = sx + (dx / dist) * r1;
          const y1 = sy + (dy / dist) * r1;
          const x2 = tx - (dx / dist) * r2;
          const y2 = ty - (dy / dist) * r2;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return mx + (-dy / dist) * 10;
        })
        .attr("y", (d: any) => {
          const sx = d.source.x ?? 0;
          const sy = d.source.y ?? 0;
          const tx = d.target.x ?? 0;
          const ty = d.target.y ?? 0;
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const r1 = (radiusByNodeIdRef.current[d.source.id] ?? 35) + 6;
          const r2 = (radiusByNodeIdRef.current[d.target.id] ?? 35) + 10;
          const x1 = sx + (dx / dist) * r1;
          const y1 = sy + (dy / dist) * r1;
          const x2 = tx - (dx / dist) * r2;
          const y2 = ty - (dy / dist) * r2;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return my + (dx / dist) * 10;
        });

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    nodeSelectionRef.current = node as any;
    linkLineSelectionRef.current = linkPath as any;
    linkTextSelectionRef.current = linkText as any;

    return () => {
      ro.disconnect();
      const current = simulationRef.current?.nodes?.() || [];
      for (const n of current) {
        positions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
      }
      simulation.stop();
    };
  }, [nodes, edges, clearAll, openRightPanel, selectEdge, selectLinkType, selectNode, selectObjectType]);

  useEffect(() => {
    const nodeSel = nodeSelectionRef.current;
    const linkLineSel = linkLineSelectionRef.current;
    const linkTextSel = linkTextSelectionRef.current;
    if (!nodeSel || !linkLineSel || !linkTextSel) return;

    const hasFocus = Boolean(focus);

    nodeSel
      .attr("opacity", (d) => {
        if (!hasFocus) return 1;
        return focus?.nodeIds.has(d.id) ? 1 : 0.12;
      });

    nodeSel.select("circle")
      .attr("r", (d) => radiusByNodeId[d.id] ?? 35)
      .attr("fill", (d) => {
        if (selectedNodeId === d.id) return GRAPH_THEME.node.selectedFill;
        if (semanticHighlightedNodeIds.includes(d.id)) return GRAPH_THEME.node.semanticFill;
        if (hasFocus && focus?.nodeIds.has(d.id)) return GRAPH_THEME.node.focusFill;
        return GRAPH_THEME.node.defaultFill;
      })
      .attr("stroke", (d) => {
        if (selectedNodeId === d.id) return GRAPH_THEME.node.selectedStroke;
        if (semanticHighlightedNodeIds.includes(d.id)) return GRAPH_THEME.node.semanticStroke;
        if (hasFocus && focus?.nodeIds.has(d.id)) return GRAPH_THEME.node.focusStroke;
        return GRAPH_THEME.node.defaultStroke;
      })
      .attr("stroke-width", (d) => {
        if (selectedNodeId === d.id) return 3;
        if (semanticHighlightedNodeIds.includes(d.id)) return 2.6;
        if (hasFocus && focus?.nodeIds.has(d.id)) return 2.4;
        return 2;
      });

    linkLineSel
      .attr("opacity", (d) => {
        if (!hasFocus) return 1;
        return focus?.edgeIds.has(d.id) ? 1 : 0.08;
      })
      .attr("stroke", (d) => {
        if (selectedEdgeId === d.id) return GRAPH_THEME.edge.selectedStroke;
        if (semanticHighlightedEdgeIds.includes(d.id)) return "#c4b5fd";
        if (hasFocus && focus?.edgeIds.has(d.id) && selectedNodeId) {
          if (focus.outboundEdgeIds.has(d.id)) return GRAPH_THEME.edge.outboundStroke;
          if (focus.inboundEdgeIds.has(d.id)) return GRAPH_THEME.edge.inboundStroke;
          return GRAPH_THEME.edge.focusStroke;
        }
        if (hasFocus && focus?.edgeIds.has(d.id)) return GRAPH_THEME.edge.focusStroke;
        return GRAPH_THEME.edge.defaultStroke;
      })
      .attr("stroke-width", (d) => {
        if (selectedEdgeId === d.id) return 3.2;
        if (semanticHighlightedEdgeIds.includes(d.id)) return 2.4;
        if (hasFocus && focus?.edgeIds.has(d.id)) return 2.2;
        return 1.4;
      })
      .attr("stroke-dasharray", (d) => {
        if (!hasFocus) return null;
        if (semanticHighlightedEdgeIds.includes(d.id)) return null;
        return focus?.edgeIds.has(d.id) ? null : "2,10";
      })
      .attr("marker-end", (d) => {
        if (selectedEdgeId === d.id) return "url(#arrow-selected)";
        if (hasFocus && focus?.edgeIds.has(d.id) && selectedNodeId) {
          if (focus.outboundEdgeIds.has(d.id)) return "url(#arrow-outbound)";
          if (focus.inboundEdgeIds.has(d.id)) return "url(#arrow-inbound)";
          return "url(#arrow-default)";
        }
        return "url(#arrow-default)";
      });

    linkTextSel
      .attr("opacity", (d) => {
        if (!hasFocus) return 1;
        return focus?.edgeIds.has(d.id) ? 1 : 0.08;
      })
      .attr("fill", (d) => {
        if (selectedEdgeId === d.id) return GRAPH_THEME.edge.selectedStroke;
        if (semanticHighlightedEdgeIds.includes(d.id)) return "#c4b5fd";
        if (hasFocus && focus?.edgeIds.has(d.id) && selectedNodeId) {
          if (focus.outboundEdgeIds.has(d.id)) return GRAPH_THEME.edge.outboundStroke;
          if (focus.inboundEdgeIds.has(d.id)) return GRAPH_THEME.edge.inboundStroke;
          return GRAPH_THEME.edge.label;
        }
        return GRAPH_THEME.edge.label;
      });
  }, [selectedNodeId, selectedEdgeId, semanticHighlightedNodeIds, semanticHighlightedEdgeIds, radiusByNodeId, focus]);

  useEffect(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    simulation.force("collide", d3.forceCollide<D3Node>().radius((d) => (radiusByNodeId[d.id] ?? 35) + 20));
    simulation.alpha(0.08).restart();
  }, [radiusByNodeId]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0b0b0b]">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
