"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useOntologyStore } from "@/stores";
import { useSelectionStore } from "@/stores";
import { useUIStore } from "@/stores";

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

export function OntologyKnowledgeGraph() {
  const { objectTypes, linkTypes } = useOntologyStore();
  const {
    selectedNodeId,
    selectedEdgeId,
    semanticHighlightedNodeIds,
    selectNode,
    selectEdge,
    selectObjectType,
    selectLinkType,
    clearAll,
  } = useSelectionStore();
  const { openRightPanel } = useUIStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Edge> | null>(null);
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, D3Node, SVGGElement, unknown> | null>(null);
  const linkLineSelectionRef = useRef<d3.Selection<SVGLineElement, D3Edge, SVGGElement, unknown> | null>(null);
  const linkTextSelectionRef = useRef<d3.Selection<SVGTextElement, D3Edge, SVGGElement, unknown> | null>(null);
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

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const positions = positionsRef.current;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // 清除旧内容

    // 定义箭头标记
    const defs = svg.append("defs");
    
    // 普通箭头
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 38) // 调整箭头位置以适应节点半径
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#3d3d3d");
      
    // 选中状态的箭头
    defs.append("marker")
      .attr("id", "arrow-selected")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 43)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#5b8def");

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
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d) => (d as D3Node).radius + 20));

    simulationRef.current = simulation;

    // 渲染边
    const link = linkGroup
      .selectAll(".link")
      .data(edges, (d: any) => d.id)
      .join("g")
      .attr("class", "link");

    const linkPath = link.append("line")
      .attr("stroke", "#3d3d3d")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)")
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
      .attr("fill", "#8b8b8b")
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
      .attr("fill", "#2d2d2d")
      .attr("stroke", "#4a4a4a")
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
      linkPath
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkText
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    nodeSelectionRef.current = node as any;
    linkLineSelectionRef.current = linkPath as any;
    linkTextSelectionRef.current = linkText as any;

    return () => {
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

    nodeSel.select("circle")
      .attr("fill", (d) => (selectedNodeId === d.id ? "#5b8def" : semanticHighlightedNodeIds.includes(d.id) ? "#8B5CF6" : "#2d2d2d"))
      .attr("stroke", (d) => (selectedNodeId === d.id ? "#8ab4f8" : semanticHighlightedNodeIds.includes(d.id) ? "#a78bfa" : "#4a4a4a"))
      .attr("stroke-width", (d) => (selectedNodeId === d.id || semanticHighlightedNodeIds.includes(d.id) ? 2.5 : 2));

    linkLineSel
      .attr("stroke", (d) => (selectedEdgeId === d.id ? "#5b8def" : "#3d3d3d"))
      .attr("stroke-width", (d) => (selectedEdgeId === d.id ? 3 : 1.5))
      .attr("marker-end", (d) => (selectedEdgeId === d.id ? "url(#arrow-selected)" : "url(#arrow)"));

    linkTextSel.attr("fill", (d) => (selectedEdgeId === d.id ? "#5b8def" : "#8b8b8b"));
  }, [selectedNodeId, selectedEdgeId, semanticHighlightedNodeIds]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0b0b0b]">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
