"use client";

import React from "react";
import {
  X,
  Server,
  Database,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useSelectionStore, useUIStore } from "@/stores";

export function RightSemanticQueryPanel() {
  const { semanticResourcePreview, semanticParsedResult, setSemanticResourcePreview, selectedActionTypeId, selectActionType } = useSelectionStore();
  const { rightPanelOpen, closeRightPanel } = useUIStore();

  if (!rightPanelOpen || !selectedActionTypeId || !semanticResourcePreview) {
    return null;
  }

  const handleClose = () => {
    closeRightPanel();
    selectActionType(null);
  };

  const handleRetry = () => {
    if (!semanticParsedResult) return;
    setSemanticResourcePreview({ resources: [], dataStructures: [], status: "running" });
    fetch("/api/semantic-query-predict-resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parsedResult: semanticParsedResult }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.resources || data.dataStructures) {
          setSemanticResourcePreview({
            resources: data.resources || [],
            dataStructures: data.dataStructures || [],
            status: "done",
          });
        } else {
          setSemanticResourcePreview({ resources: [], dataStructures: [], status: "error" });
        }
      })
      .catch(() => {
        setSemanticResourcePreview({ resources: [], dataStructures: [], status: "error" });
      });
  };

  const { status, resources, dataStructures } = semanticResourcePreview;

  return (
    <div className="flex flex-col h-full bg-[#161614] border-l border-[#2d2d2d]">
      <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center">
            <Server className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">架构推演结果</h2>
            <p className="text-[10px] text-[#6b6b6b]">服务资源与数据结构</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {status === "running" && (
          <div className="flex flex-col items-center justify-center py-12 text-center h-full mt-10 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-[#8B5CF6]/20 blur-xl rounded-full" />
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] border border-[#3d3d3d] flex items-center justify-center relative z-10">
                <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white mb-2 animate-pulse">正在预测业务资源与数据结构</h3>
              <p className="text-[11px] text-[#6b6b6b]">基于语义解析结果推演架构...</p>
            </div>
            
            {/* Skeleton Loading Effect */}
            <div className="w-full space-y-4 mt-8 opacity-40 pointer-events-none text-left">
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#3d3d3d] animate-pulse" />
                  <div className="h-3 w-28 bg-[#3d3d3d] rounded animate-pulse" />
                </div>
                <div className="h-16 w-full bg-[#1a1a1a] rounded-lg border border-[#3d3d3d] animate-pulse"></div>
                <div className="h-16 w-full bg-[#1a1a1a] rounded-lg border border-[#3d3d3d] animate-pulse"></div>
              </div>
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#3d3d3d] animate-pulse" />
                  <div className="h-3 w-32 bg-[#3d3d3d] rounded animate-pulse" />
                </div>
                <div className="h-28 w-full bg-[#1a1a1a] rounded-lg border border-[#3d3d3d] animate-pulse"></div>
              </div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-12 text-center h-full mt-20">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-sm font-medium text-red-500 mb-2">推演失败</h3>
            <p className="text-xs text-[#6b6b6b] mb-6 max-w-[200px] leading-relaxed">无法完成业务资源预测，可能是网络或服务异常。</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="text-xs bg-[#1a1a1a] border-[#2d2d2d] hover:bg-[#2d2d2d] text-[#e5e5e5] flex items-center gap-2"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              重新推演
            </Button>
          </div>
        )}

        {status === "done" && (
          <div className="space-y-6">
            {/* 预测的后端资源 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#3B82F6]" />
                <h3 className="text-sm font-semibold text-white">预测后端资源 (Resources)</h3>
              </div>
              <div className="space-y-2">
                {resources.length > 0 ? (
                  resources.map((res, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#0d0d0d] border border-[#2d2d2d] hover:border-[#3B82F6]/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{res.name}</span>
                        <Badge variant="outline" className="text-[10px] border-[#3B82F6]/30 text-[#3B82F6]">
                          {res.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#a0a0a0]">{res.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#6b6b6b]">未预测到特殊资源需求</p>
                )}
              </div>
            </div>

            {/* 预测的数据结构 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#10B981]" />
                <h3 className="text-sm font-semibold text-white">数据结构映射 (Data Structures)</h3>
              </div>
              <div className="space-y-3">
                {dataStructures.length > 0 ? (
                  dataStructures.map((ds, idx) => (
                    <div key={idx} className="rounded-lg bg-[#0d0d0d] border border-[#2d2d2d] overflow-hidden">
                      <div className="px-3 py-2 bg-[#1a1a1a] border-b border-[#2d2d2d] flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-[#10B981]" />
                        <span className="text-xs font-semibold text-white">{ds.name}</span>
                      </div>
                      <div className="p-2 space-y-1">
                        {ds.fields.map((field, fIdx) => (
                          <div key={fIdx} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#1a1a1a]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-[#e5e5e5]">{field.name}</span>
                              <span className="text-[10px] text-[#6b6b6b]">{field.description}</span>
                            </div>
                            <span className="text-[10px] font-mono text-[#F59E0B]">{field.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#6b6b6b]">未预测到数据结构</p>
                )}
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
