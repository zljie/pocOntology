"use client";

import React, { useState } from "react";
import { X, Settings, Shield, Sparkles, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOntologyStore, useSelectionStore, useUIStore } from "@/stores";

export function DynamicEditorPanel() {
  const { businessRules, aiModels, analysisInsights, updateBusinessRule, updateAIModel, updateAnalysisInsight } = useOntologyStore();
  const { selectedBusinessRuleId, selectedAIModelId, selectedAnalysisInsightId, selectBusinessRule, selectAIModel, selectAnalysisInsight } = useSelectionStore();
  const { rightPanelOpen, closeRightPanel } = useUIStore();

  const selectedBusinessRule = businessRules.find((br) => br.id === selectedBusinessRuleId);
  const selectedAIModel = aiModels.find((ai) => ai.id === selectedAIModelId);
  const selectedAnalysisInsight = analysisInsights.find((ai) => ai.id === selectedAnalysisInsightId);

  if (!rightPanelOpen || (!selectedBusinessRule && !selectedAIModel && !selectedAnalysisInsight)) {
    return null;
  }

  const handleClose = () => {
    closeRightPanel();
    selectBusinessRule(null);
    selectAIModel(null);
    selectAnalysisInsight(null);
  };

  if (selectedBusinessRule) {
    return (
      <div className="flex flex-col h-full bg-[#161614]">
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-sm font-semibold text-white">{selectedBusinessRule.displayName}</h2>
            <span className="text-xs text-[#6b6b6b] font-mono">{selectedBusinessRule.apiName}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#F59E0B]" /> 基本配置
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">显示名称</Label>
                <Input 
                  value={selectedBusinessRule.displayName} 
                  onChange={(e) => updateBusinessRule(selectedBusinessRule.id, { displayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">API 名称</Label>
                <Input 
                  value={selectedBusinessRule.apiName} 
                  onChange={(e) => updateBusinessRule(selectedBusinessRule.id, { apiName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">描述</Label>
                <Textarea 
                  value={selectedBusinessRule.description || ""} 
                  onChange={(e) => updateBusinessRule(selectedBusinessRule.id, { description: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] min-h-[80px]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">规则表达式 (DSL)</Label>
                <Textarea 
                  value={selectedBusinessRule.expression || ""} 
                  onChange={(e) => updateBusinessRule(selectedBusinessRule.id, { expression: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs text-[#10B981] min-h-[100px]" 
                  placeholder="例如: patron.currentLoanCount < patron.maxBooksAllowed"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedAIModel) {
    return (
      <div className="flex flex-col h-full bg-[#161614]">
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-sm font-semibold text-white">{selectedAIModel.displayName}</h2>
            <span className="text-xs text-[#6b6b6b] font-mono">{selectedAIModel.apiName}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8B5CF6]" /> 基本配置
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">显示名称</Label>
                <Input 
                  value={selectedAIModel.displayName} 
                  onChange={(e) => updateAIModel(selectedAIModel.id, { displayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">API 名称</Label>
                <Input 
                  value={selectedAIModel.apiName} 
                  onChange={(e) => updateAIModel(selectedAIModel.id, { apiName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">描述</Label>
                <Textarea 
                  value={selectedAIModel.description || ""} 
                  onChange={(e) => updateAIModel(selectedAIModel.id, { description: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] min-h-[80px]" 
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedAnalysisInsight) {
    return (
      <div className="flex flex-col h-full bg-[#161614]">
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-sm font-semibold text-white">{selectedAnalysisInsight.displayName}</h2>
            <span className="text-xs text-[#6b6b6b] font-mono">{selectedAnalysisInsight.apiName}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[#06B6D4]" /> 基本配置
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">显示名称</Label>
                <Input 
                  value={selectedAnalysisInsight.displayName} 
                  onChange={(e) => updateAnalysisInsight(selectedAnalysisInsight.id, { displayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">API 名称</Label>
                <Input 
                  value={selectedAnalysisInsight.apiName} 
                  onChange={(e) => updateAnalysisInsight(selectedAnalysisInsight.id, { apiName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">描述</Label>
                <Textarea 
                  value={selectedAnalysisInsight.description || ""} 
                  onChange={(e) => updateAnalysisInsight(selectedAnalysisInsight.id, { description: e.target.value })} 
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
