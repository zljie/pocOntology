"use client";

import React, { useState } from "react";
import { X, Settings, Database, Code, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOntologyStore, useSelectionStore, useUIStore } from "@/stores";

export function KineticEditorPanel() {
  const { actionTypes, dataFlows, updateActionType, updateDataFlow } = useOntologyStore();
  const { selectedActionTypeId, selectedDataFlowId, selectActionType, selectDataFlow } = useSelectionStore();
  const { rightPanelOpen, closeRightPanel } = useUIStore();

  const selectedActionType = actionTypes.find((at) => at.id === selectedActionTypeId);
  const selectedDataFlow = dataFlows.find((df) => df.id === selectedDataFlowId);

  if (!rightPanelOpen || (!selectedActionType && !selectedDataFlow)) {
    return null;
  }

  const handleClose = () => {
    closeRightPanel();
    selectActionType(null);
    selectDataFlow(null);
  };

  if (selectedActionType) {
    return (
      <div className="flex flex-col h-full bg-[#161614]">
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-sm font-semibold text-white">{selectedActionType.displayName}</h2>
            <span className="text-xs text-[#6b6b6b] font-mono">{selectedActionType.apiName}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#10B981]" /> 基本配置
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">显示名称</Label>
                <Input 
                  value={selectedActionType.displayName} 
                  onChange={(e) => updateActionType(selectedActionType.id, { displayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">API 名称</Label>
                <Input 
                  value={selectedActionType.apiName} 
                  onChange={(e) => updateActionType(selectedActionType.id, { apiName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">描述</Label>
                <Textarea 
                  value={selectedActionType.description || ""} 
                  onChange={(e) => updateActionType(selectedActionType.id, { description: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] min-h-[80px]" 
                />
              </div>
            </div>
            
            {/* Note: In a full version, we'd add complex UI for inputParameters, outputProperties, and triggerConditions here */}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedDataFlow) {
    return (
      <div className="flex flex-col h-full bg-[#161614]">
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-sm font-semibold text-white">{selectedDataFlow.displayName}</h2>
            <span className="text-xs text-[#6b6b6b] font-mono">{selectedDataFlow.apiName}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#10B981]" /> 基本配置
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">显示名称</Label>
                <Input 
                  value={selectedDataFlow.displayName} 
                  onChange={(e) => updateDataFlow(selectedDataFlow.id, { displayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">API 名称</Label>
                <Input 
                  value={selectedDataFlow.apiName} 
                  onChange={(e) => updateDataFlow(selectedDataFlow.id, { apiName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">描述</Label>
                <Textarea 
                  value={selectedDataFlow.description || ""} 
                  onChange={(e) => updateDataFlow(selectedDataFlow.id, { description: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] min-h-[80px]" 
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return null;
}
