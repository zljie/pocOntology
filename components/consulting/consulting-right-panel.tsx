"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsultingChatPanel } from "@/components/consulting/consulting-chat-panel";
import { ExecPlanPanel } from "@/components/consulting/exec-plan-panel";
import { PropertyEditorPanel } from "@/components/property-editor/property-editor-panel";
import { KineticEditorPanel } from "@/components/property-editor/kinetic-editor-panel";
import { DynamicEditorPanel } from "@/components/property-editor/dynamic-editor-panel";
import { RightSemanticQueryPanel } from "@/components/semantic-query/right-semantic-query-panel";
import { useUIStore } from "@/stores";
import { Button } from "@/components/ui/button";

export function ConsultingRightPanel() {
  const { consultingRightTab: tab, setConsultingRightTab: setTab } = useUIStore();

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-3 border-b border-[#2d2d2d] bg-[#161614]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="bg-[#0d0d0d] border border-[#2d2d2d]">
            <TabsTrigger value="consulting" className="text-xs">
              AI咨询
            </TabsTrigger>
              <TabsTrigger value="planner" className="text-xs">
                执行方案
              </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0">
        {tab === "consulting" ? (
          <ConsultingChatPanel />
        ) : tab === "planner" ? (
          <ExecPlanPanel />
        ) : (
          <>
            <div className="flex-none p-3 border-b border-[#2d2d2d] bg-[#0d0d0d]">
              <Button
                variant="outline"
                className="bg-[#2d2d2d] border-[#3d3d3d] text-[#a0a0a0] hover:bg-[#3d3d3d]"
                onClick={() => setTab("consulting")}
              >
                返回 AI咨询
              </Button>
            </div>
            <PropertyEditorPanel />
            <KineticEditorPanel />
            <DynamicEditorPanel />
            <RightSemanticQueryPanel />
          </>
        )}
      </div>
    </div>
  );
}
