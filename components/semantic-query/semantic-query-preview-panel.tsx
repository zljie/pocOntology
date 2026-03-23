"use client";

import React from "react";
import { useSelectionStore } from "@/stores";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function SemanticQueryPreviewPanel({ className }: { className?: string }) {
  const semanticQueryPreview = useSelectionStore((state) => state.semanticQueryPreview);

  return (
    <div className={cn("h-[260px] border-t border-[#2d2d2d] bg-[#10100f]", className)}>
      <div className="h-full flex flex-col">
        <div className="px-4 py-2.5 border-b border-[#2d2d2d] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white tracking-wide">语义化查询语句预览</h3>
          {semanticQueryPreview && (
            <span className="text-[10px] text-[#7a7a7a]">来源：{semanticQueryPreview.query}</span>
          )}
        </div>

        {semanticQueryPreview ? (
          <Tabs defaultValue="rdf" className="flex-1 flex flex-col min-h-0">
            <div className="px-3 pt-2">
              <TabsList className="h-8 bg-[#1a1a18]">
                <TabsTrigger value="rdf" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  RDF / Turtle
                </TabsTrigger>
                <TabsTrigger value="swrl" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  SWRL Rule
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="rdf" className="mt-2 px-3 pb-3 flex-1 min-h-0">
              <ScrollArea className="h-full rounded-md border border-[#2d2d2d] bg-[#0d0d0d]">
                <pre className="p-3 text-[11px] leading-5 text-[#9fd0ff] whitespace-pre-wrap break-words">
                  {semanticQueryPreview.rdf}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="swrl" className="mt-2 px-3 pb-3 flex-1 min-h-0">
              <ScrollArea className="h-full rounded-md border border-[#2d2d2d] bg-[#0d0d0d]">
                <pre className="p-3 text-[11px] leading-5 text-[#c6b0ff] whitespace-pre-wrap break-words">
                  {semanticQueryPreview.swrl}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-xs text-[#6b6b6b] text-center">
              执行语义查询后，这里会展示可供 Agent 理解与转换的语义化语句
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
