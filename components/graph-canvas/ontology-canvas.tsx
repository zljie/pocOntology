"use client";

import React, { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useOntologyStore } from "@/stores";
import { upsertMetaToNeo4jClient } from "@/lib/neo4j/client";
import type { MetaCore } from "@/lib/meta/meta-core";
import { useSelectionStore } from "@/stores";
import { useUIStore } from "@/stores";
import { ObjectTypeNode } from "./object-type-node";
import { LinkTypeEdge } from "./link-type-edge";
import { CanvasToolbar } from "./canvas-toolbar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ObjectType, LinkType } from "@/lib/types/ontology";
import { generateId } from "@/lib/utils";

import { OntologyKnowledgeGraph } from "./ontology-knowledge-graph";
import { ProjectOnboardingCanvas } from "@/components/project-onboarding/project-onboarding-canvas";

const nodeTypes: NodeTypes = {
  objectType: ObjectTypeNode,
};

const edgeTypes: EdgeTypes = {
  linkType: LinkTypeEdge,
};

// Generate initial layout positions
function generateLayout(objectTypes: ObjectType[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const cols = Math.ceil(Math.sqrt(objectTypes.length));
  const nodeWidth = 220;
  const nodeHeight = 160;
  const gapX = 80;
  const gapY = 80;

  objectTypes.forEach((ot, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions[ot.id] = {
      x: col * (nodeWidth + gapX) + 100,
      y: row * (nodeHeight + gapY) + 100,
    };
  });

  return positions;
}

function OntologyCanvasMain() {
  const { objectTypes, linkTypes, addLinkType, addObjectType, neo4jProject, scenario } = useOntologyStore();
  const {
    selectedNodeId,
    semanticHighlightedNodeIds,
    semanticHighlightedEdgeIds,
    selectNode,
    selectEdge,
    selectObjectType,
    selectLinkType,
    clearAll,
  } = useSelectionStore();
  const { showMinimap, showGrid, canvasViewMode, openRightPanel, workMode, setCanvasViewMode } = useUIStore();

  React.useEffect(() => {
    if (workMode !== "CONSULTING") return;
    if (canvasViewMode === "KNOWLEDGE_GRAPH") return;
    setCanvasViewMode("KNOWLEDGE_GRAPH");
  }, [workMode, canvasViewMode, setCanvasViewMode]);

  // Convert object types to nodes
  const initialNodes: Node[] = useMemo(() => {
    const positions = generateLayout(objectTypes);
    return objectTypes.map((ot) => ({
      id: ot.id,
      type: "objectType",
      position: positions[ot.id] || { x: 0, y: 0 },
      data: {
        objectType: ot,
        selected: selectedNodeId === ot.id,
        highlighted: semanticHighlightedNodeIds.includes(ot.id),
      },
    }));
  }, [objectTypes, selectedNodeId, semanticHighlightedNodeIds]);

  // Convert link types to edges
  const initialEdges: Edge[] = useMemo(() => {
    return linkTypes.map((lt) => ({
      id: lt.id,
      source: lt.sourceTypeId,
      target: lt.targetTypeId,
      type: "linkType",
      data: {
        linkType: lt,
        cardinality: lt.cardinality,
        label: lt.displayName,
        highlighted: semanticHighlightedEdgeIds.includes(lt.id),
      },
    }));
  }, [linkTypes, semanticHighlightedEdgeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes with selected state
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selected: node.id === selectedNodeId,
          highlighted: semanticHighlightedNodeIds.includes(node.id),
        },
      }))
    );
  }, [selectedNodeId, semanticHighlightedNodeIds, setNodes]);

  // Sync with store data
  React.useEffect(() => {
    setNodes((prev) => {
      const positions: Record<string, { x: number; y: number }> = {};

      for (const node of prev) {
        positions[node.id] = node.position;
      }

      for (const ot of objectTypes) {
        if (positions[ot.id]) continue;
        const cols = Math.ceil(Math.sqrt(objectTypes.length));
        const index = objectTypes.indexOf(ot);
        const col = index % cols;
        const row = Math.floor(index / cols);
        positions[ot.id] = {
          x: col * 300 + 100,
          y: row * 240 + 100,
        };
      }

      return objectTypes.map((ot) => ({
        id: ot.id,
        type: "objectType",
        position: positions[ot.id],
        data: {
          objectType: ot,
          selected: selectedNodeId === ot.id,
          highlighted: semanticHighlightedNodeIds.includes(ot.id),
        },
      }));
    });
  }, [objectTypes, selectedNodeId, semanticHighlightedNodeIds, setNodes]);

  React.useEffect(() => {
    const newEdges: Edge[] = linkTypes.map((lt) => ({
      id: lt.id,
      source: lt.sourceTypeId,
      target: lt.targetTypeId,
      type: "linkType",
      data: {
        linkType: lt,
        cardinality: lt.cardinality,
        label: lt.displayName,
        highlighted: semanticHighlightedEdgeIds.includes(lt.id),
      },
    }));
    setEdges(newEdges);
  }, [linkTypes, semanticHighlightedEdgeIds, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        // Find the source object type
        const sourceType = objectTypes.find((ot) => ot.id === params.source);
        const targetType = objectTypes.find((ot) => ot.id === params.target);
        
        if (sourceType && targetType) {
          // Create a new link type
          addLinkType({
            apiName: `${sourceType.apiName}${targetType.apiName}`,
            displayName: `${sourceType.displayName} → ${targetType.displayName}`,
            sourceTypeId: params.source,
            targetTypeId: params.target,
            cardinality: "ONE_TO_MANY",
            foreignKeyPropertyId: sourceType.primaryKey || "",
            visibility: "PROJECT",
            properties: [],
            layer: sourceType.layer,
          });
        }
      }
    },
    [objectTypes, addLinkType]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
      selectObjectType(node.id);
      openRightPanel();
    },
    [openRightPanel, selectNode, selectObjectType]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      selectEdge(edge.id);
      selectObjectType(null); // Clear object selection when selecting an edge
      selectLinkType(edge.id);
      openRightPanel();
    },
    [openRightPanel, selectEdge, selectObjectType, selectLinkType]
  );

  const onPaneClick = useCallback(() => {
    clearAll();
  }, [clearAll]);

  const handleAddNode = useCallback(async () => {
    const cols = Math.ceil(Math.sqrt(objectTypes.length + 1));
    const index = objectTypes.length;
    const col = index % cols;
    const row = Math.floor(index / cols);

    const newOt = addObjectType({
      apiName: "NewObject",
      displayName: "新对象",
      visibility: "PROJECT",
      primaryKey: "",
      titleKey: "",
      properties: [],
      layer: "SEMANTIC",
    });

    if (neo4jProject) {
      try {
        const meta: MetaCore = {
          scenario,
          objectTypes: [newOt],
          linkTypes: [],
          actionTypes: [],
          dataFlows: [],
          businessRules: [],
          aiModels: [],
          analysisInsights: [],
        };
        await upsertMetaToNeo4jClient({
          database: neo4jProject.dbName,
          scenario: neo4jProject.dbName,
          meta,
        });
      } catch {
        return;
      }
    }
  }, [objectTypes, addObjectType, neo4jProject, scenario]);

  return (
    <div className="relative w-full h-full">
      {canvasViewMode === "KNOWLEDGE_GRAPH" ? (
        <OntologyKnowledgeGraph />
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          snapToGrid={showGrid}
          snapGrid={[16, 16]}
          defaultEdgeOptions={{
            type: "linkType",
            animated: true,
          }}
          proOptions={{ hideAttribution: true }}
        >
          {showGrid && (
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="#2d2d2d"
            />
          )}

          <Controls
            className="!bg-[#1a1a18] !border-[#2d2d2d] !rounded-lg"
            showZoom={true}
            showFitView={true}
            showInteractive={false}
          />

          {showMinimap && (
            <MiniMap
              className="!bg-[#1a1a18] !border-[#2d2d2d] !rounded-lg"
              nodeColor={(node) => {
                if (node.data?.selected) return "#5b8def";
                if (node.data?.highlighted) return "#8B5CF6";
                return "#2d2d2d";
              }}
              maskColor="rgba(0, 0, 0, 0.8)"
            />
          )}
        </ReactFlow>
      )}

      <div className="absolute top-4 right-4 z-10">
        <CanvasToolbar />
      </div>

      {canvasViewMode === "EDITOR" && (
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            size="sm"
            variant="outline"
            className="bg-[#1a1a18] border-[#2d2d2d] text-[#a0a0a0] hover:bg-[#2d2d2d] hover:text-white"
            onClick={handleAddNode}
          >
            <Plus className="w-4 h-4 mr-1" />
            添加节点
          </Button>
        </div>
      )}

      {canvasViewMode === "EDITOR" && objectTypes.length === 0 && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-[#1a1a18] border border-[#2d2d2d] rounded-lg p-6 text-center">
            <p className="text-[#6b6b6b] mb-2">画布为空</p>
            <p className="text-xs text-[#4a4a4a]">点击&quot;添加节点&quot;或从左侧面板创建对象类型</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function OntologyCanvas() {
  const { projectOnboardingMode } = useUIStore();
  if (projectOnboardingMode) return <ProjectOnboardingCanvas />;
  return <OntologyCanvasMain />;
}
