"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsultingChatPanel } from "@/components/consulting/consulting-chat-panel";
import { PropertyEditorPanel } from "@/components/property-editor/property-editor-panel";
import { KineticEditorPanel } from "@/components/property-editor/kinetic-editor-panel";
import { DynamicEditorPanel } from "@/components/property-editor/dynamic-editor-panel";
import { RightSemanticQueryPanel } from "@/components/semantic-query/right-semantic-query-panel";

export function ConsultingRightPanel() {
  const [tab, setTab] = React.useState<"consulting" | "details">("consulting");

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-3 border-b border-[#2d2d2d] bg-[#161614]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="bg-[#0d0d0d] border border-[#2d2d2d]">
            <TabsTrigger value="consulting" className="text-xs">
              AI咨询
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs">
              详情
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0">
        {tab === "consulting" ? (
          <ConsultingChatPanel />
        ) : (
          <>
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

