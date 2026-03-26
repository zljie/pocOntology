"use client";

import React from "react";
import { useOntologyStore } from "@/stores";
import { useSelectionStore } from "@/stores";
import { useUIStore } from "@/stores";
import type {
  GraphCanvasProps,
  GraphCanvasRef,
  GraphEdge,
  GraphNode,
  InternalGraphEdge,
  InternalGraphNode,
  Theme,
} from "reagraph";

type GraphCanvasComponent = React.ForwardRefExoticComponent<
  GraphCanvasProps & React.RefAttributes<GraphCanvasRef>
>;

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

  const [mounted, setMounted] = React.useState(false);
  const [GraphCanvas, setGraphCanvas] = React.useState<GraphCanvasComponent | null>(null);
  const [theme, setTheme] = React.useState<Theme | null>(null);

  const graphRef = React.useRef<GraphCanvasRef | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    import("reagraph").then((mod) => {
      if (cancelled) return;
      setGraphCanvas(() => mod.GraphCanvas);
      setTheme({
        ...mod.darkTheme,
        canvas: { ...(mod.darkTheme.canvas ?? {}), background: "#0b0b0b", fog: null },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const nodes: GraphNode[] = React.useMemo(() => {
    return objectTypes.map((ot) => {
      const isSelected = selectedNodeId === ot.id;
      const isHighlighted = semanticHighlightedNodeIds.includes(ot.id);
      return {
        id: ot.id,
        label: ot.displayName,
        subLabel: ot.apiName,
        fill: isSelected ? "#5b8def" : isHighlighted ? "#8B5CF6" : "#2d2d2d",
        size: isSelected ? 10 : 7,
        data: { kind: "objectType", refId: ot.id },
      };
    });
  }, [objectTypes, selectedNodeId, semanticHighlightedNodeIds]);

  const edges: GraphEdge[] = React.useMemo(() => {
    return linkTypes.map((lt) => {
      const isSelected = selectedEdgeId === lt.id;
      return {
        id: lt.id,
        source: lt.sourceTypeId,
        target: lt.targetTypeId,
        label: lt.displayName,
        fill: isSelected ? "#5b8def" : "#3d3d3d",
        size: isSelected ? 2 : 1,
        data: { kind: "linkType", refId: lt.id },
      };
    });
  }, [linkTypes, selectedEdgeId]);

  const selections = React.useMemo(() => {
    const ids: string[] = [];
    if (selectedNodeId) ids.push(selectedNodeId);
    if (selectedEdgeId) ids.push(selectedEdgeId);
    return ids;
  }, [selectedNodeId, selectedEdgeId]);

  const handleNodeClick = React.useCallback(
    (node: InternalGraphNode) => {
      selectNode(node.id);
      selectObjectType(node.id);
      openRightPanel();
    },
    [openRightPanel, selectNode, selectObjectType]
  );

  const handleEdgeClick = React.useCallback(
    (edge: InternalGraphEdge) => {
      selectEdge(edge.id);
      selectLinkType(edge.id);
      openRightPanel();
    },
    [openRightPanel, selectEdge, selectLinkType]
  );

  if (!mounted || !GraphCanvas || !theme) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-[#6b6b6b]">
        图谱加载中…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0">
        <GraphCanvas
          ref={graphRef}
          nodes={nodes}
          edges={edges}
          selections={selections}
          theme={theme}
          layoutType="forceDirected2d"
          labelType="none"
          cameraMode="pan"
          animated
          draggable
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onCanvasClick={() => clearAll()}
        />
      </div>
    </div>
  );
}
