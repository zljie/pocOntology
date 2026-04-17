"use client";

import React from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, type Node, type NodeProps, type NodeTypes, type Edge } from "@xyflow/react";
import { useOnboardingStore, useUIStore, useOntologyStore } from "@/stores";
import type { OnboardingStepId, OnboardingStepStatus } from "@/lib/types/project-onboarding";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type StepNodeData = {
  stepId: OnboardingStepId;
  title: string;
  description: string;
  status: OnboardingStepStatus;
  isCurrent: boolean;
};

function StepNode({ data }: NodeProps<Node<StepNodeData>>) {
  const tone =
    data.status === "DONE" ? "border-[#14532d] bg-[#0b1a12]" : data.status === "READY" ? "border-[#1f2937] bg-[#0b1220]" : "border-[#2d2d2d] bg-[#111111]";
  const titleTone =
    data.status === "DONE" ? "text-[#86efac]" : data.status === "READY" ? "text-[#93c5fd]" : "text-[#a0a0a0]";
  const descTone = data.status === "LOCKED" ? "text-[#6b6b6b]" : "text-[#9a9a9a]";
  return (
    <div
      className={cn(
        "w-[240px] rounded-lg border p-4 shadow-sm",
        tone,
        data.isCurrent ? "ring-2 ring-[#5b8def]/40" : ""
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cn("text-sm font-semibold", titleTone)}>{data.title}</div>
        <div className={cn("text-[11px] font-mono", data.status === "DONE" ? "text-[#86efac]" : data.status === "READY" ? "text-[#93c5fd]" : "text-[#6b6b6b]")}>
          {data.status}
        </div>
      </div>
      <div className={cn("mt-2 text-xs leading-relaxed", descTone)}>{data.description}</div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  onboardingStep: StepNode,
};

export function ProjectOnboardingCanvas() {
  const { projectOnboardingMode, openRightPanel, exitProjectOnboarding } = useUIStore();
  const { neo4jProject } = useOntologyStore();
  const { onboardingByProject, setCurrentStep, initProjectOnboarding } = useOnboardingStore();

  const dbName = neo4jProject?.dbName || "";
  React.useEffect(() => {
    if (!projectOnboardingMode) return;
    if (!dbName) return;
    if (onboardingByProject[dbName]) return;
    initProjectOnboarding(dbName);
  }, [projectOnboardingMode, dbName, onboardingByProject, initProjectOnboarding]);

  const onboarding = dbName ? onboardingByProject[dbName] : undefined;
  if (!projectOnboardingMode) return null;
  if (!dbName) return null;
  if (!onboarding) return null;

  const steps: Array<{ stepId: OnboardingStepId; title: string; description: string }> = [
    { stepId: "SCOPE", title: "业务范围", description: "范围/边界/关键名词与待确认问题" },
    { stepId: "OBJECTS", title: "业务对象", description: "对象类型与关键属性草案（确认后创建）" },
    { stepId: "SCENARIOS", title: "业务场景", description: "按 MECE 生成场景金字塔并选择关键场景" },
    { stepId: "ACTIONS", title: "行为/事件", description: "生成 CRUD+业务动作（确认后创建）" },
  ];

  const nodes: Node<StepNodeData>[] = steps.map((s, idx) => ({
    id: s.stepId,
    type: "onboardingStep",
    position: { x: 80 + idx * 280, y: 180 },
    draggable: false,
    data: {
      stepId: s.stepId,
      title: s.title,
      description: s.description,
      status: onboarding.steps[s.stepId].status,
      isCurrent: onboarding.currentStep === s.stepId,
    },
  }));

  const edges: Edge[] = steps.slice(0, -1).map((s) => ({
    id: `${s.stepId}->${steps[steps.findIndex((x) => x.stepId === s.stepId) + 1].stepId}`,
    source: s.stepId,
    target: steps[steps.findIndex((x) => x.stepId === s.stepId) + 1].stepId,
    animated: true,
    style: { stroke: "#334155" },
  }));

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-3 left-3 z-10">
        <Button
          size="sm"
          variant="secondary"
          className="bg-[#2d2d2d] text-[#e5e7eb] border border-[#3d3d3d] hover:bg-[#3a3a3a]"
          onClick={() => exitProjectOnboarding()}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          退出引导
        </Button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_: React.MouseEvent, node: Node<StepNodeData>) => {
          const stepId = node.id as OnboardingStepId;
          const status = onboarding.steps[stepId]?.status;
          if (status === "LOCKED") return;
          setCurrentStep(dbName, stepId);
          openRightPanel();
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#2d2d2d" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
