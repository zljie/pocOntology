"use client";

import React from "react";
import { useSelectionStore } from "@/stores";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SemanticQueryPreviewPanel({ className }: { className?: string }) {
  const semanticQueryPreview = useSelectionStore((state) => state.semanticQueryPreview);
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [executionResult, setExecutionResult] = React.useState<any>(null);
  const [executionError, setExecutionError] = React.useState("");

  const handleExecute = async () => {
    if (!semanticQueryPreview?.graphqlTemplate) return;
    setIsExecuting(true);
    setExecutionError("");
    try {
      const response = await fetch("/api/simulate-graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: semanticQueryPreview.query,
          dsl: semanticQueryPreview.dsl || "",
          graphqlTemplate: semanticQueryPreview.graphqlTemplate,
          templateVars: semanticQueryPreview.templateVars || {},
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setExecutionResult(null);
        setExecutionError(data?.error || "模拟执行失败");
        return;
      }
      setExecutionResult(data);
    } catch {
      setExecutionResult(null);
      setExecutionError("模拟执行失败，请稍后重试");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={cn("h-[260px] border-t border-[#2d2d2d] bg-[#10100f]", className)}>
      <div className="h-full flex flex-col">
        <div className="px-4 py-2.5 border-b border-[#2d2d2d] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white tracking-wide">语义化查询语句预览</h3>
          {semanticQueryPreview && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#7a7a7a]">来源：{semanticQueryPreview.query}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2d2d2d] text-[#a0a0a0]">
                {semanticQueryPreview.source === "llm" ? "LLM" : "规则"}
              </span>
            </div>
          )}
        </div>

        {semanticQueryPreview ? (
          <Tabs defaultValue="rdf" className="flex-1 flex flex-col min-h-0">
            <div className="px-3 pt-2">
              <TabsList className="h-8 bg-[#1a1a18]">
                <TabsTrigger value="scenario" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  语义场景
                </TabsTrigger>
                <TabsTrigger value="rdf" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  RDF / Turtle
                </TabsTrigger>
                <TabsTrigger value="owl" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  OWL / 本体
                </TabsTrigger>
                <TabsTrigger value="swrl" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  SWRL Rule
                </TabsTrigger>
                <TabsTrigger value="dsl" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  Query DSL
                </TabsTrigger>
                <TabsTrigger value="graphql" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  GraphQL
                </TabsTrigger>
                <TabsTrigger value="sql" className="text-xs data-[state=active]:bg-[#2d2d2d]">
                  SQL
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="scenario" className="mt-2 px-3 pb-3 flex-1 min-h-0">
              <ScrollArea className="h-full rounded-md border border-[#2d2d2d] bg-[#0d0d0d]">
                <pre className="p-3 text-[11px] leading-5 text-[#d8d8d8] whitespace-pre-wrap break-words">
                  {semanticQueryPreview.semanticScenario || "未生成语义场景描述"}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="rdf" className="mt-2 px-3 pb-3 flex-1 min-h-0">
              <ScrollArea className="h-full rounded-md border border-[#2d2d2d] bg-[#0d0d0d]">
                <pre className="p-3 text-[11px] leading-5 text-[#9fd0ff] whitespace-pre-wrap break-words">
                  {semanticQueryPreview.rdf}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="owl" className="mt-2 px-3 pb-3 flex-1 min-h-0">
              <ScrollArea className="h-full rounded-md border border-[#2d2d2d] bg-[#0d0d0d]">
                <pre className="p-3 text-[11px] leading-5 text-[#ffb86c] whitespace-pre-wrap break-words">
                  {semanticQueryPreview.owl || "未生成 OWL 描述"}
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

            <TabsContent value="dsl" className="mt-2 px-3 pb-3 flex-1 min-h-0">
              <ScrollArea className="h-full rounded-md border border-[#2d2d2d] bg-[#0d0d0d]">
                <pre className="p-3 text-[11px] leading-5 text-[#8BE9FD] whitespace-pre-wrap break-words">
                  {semanticQueryPreview.dsl || "未生成 Query DSL"}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="graphql" className="mt-2 px-3 pb-3 flex-1 min-h-0">
              <div className="mb-2 flex items-center justify-end">
                <Button
                  size="sm"
                  className="h-7 text-[11px] bg-[#10B981] hover:bg-[#059669] text-white"
                  onClick={handleExecute}
                  disabled={isExecuting || !semanticQueryPreview.graphqlTemplate}
                >
                  {isExecuting ? "执行中..." : "执行"}
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-36px)] rounded-md border border-[#2d2d2d] bg-[#0d0d0d]">
                <pre className="p-3 text-[11px] leading-5 text-[#93F2B2] whitespace-pre-wrap break-words">
                  {semanticQueryPreview.graphqlTemplate || "未生成 GraphQL 模板"}
                </pre>
                {semanticQueryPreview.templateVars && Object.keys(semanticQueryPreview.templateVars).length > 0 && (
                  <pre className="px-3 pb-3 text-[10px] leading-5 text-[#9ca3af] whitespace-pre-wrap break-words">
                    {`variables:\n${JSON.stringify(semanticQueryPreview.templateVars, null, 2)}`}
                  </pre>
                )}
                {executionResult && (
                  <pre className="px-3 pb-3 text-[10px] leading-5 text-[#60a5fa] whitespace-pre-wrap break-words">
                    {`receipt:\n${JSON.stringify(executionResult.receipt, null, 2)}\n\nresult:\n${JSON.stringify(executionResult.data, null, 2)}`}
                  </pre>
                )}
                {executionError && (
                  <pre className="px-3 pb-3 text-[10px] leading-5 text-[#f87171] whitespace-pre-wrap break-words">
                    {`error:\n${executionError}`}
                  </pre>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sql" className="mt-2 px-3 pb-3 flex-1 min-h-0">
              <ScrollArea className="h-full rounded-md border border-[#2d2d2d] bg-[#0d0d0d]">
                <pre className="p-3 text-[11px] leading-5 text-[#93F2B2] whitespace-pre-wrap break-words">
                  {semanticQueryPreview.sql || "未生成 SQL 计划"}
                </pre>
                {semanticQueryPreview.sqlVars && Object.keys(semanticQueryPreview.sqlVars).length > 0 && (
                  <pre className="px-3 pb-3 text-[10px] leading-5 text-[#9ca3af] whitespace-pre-wrap break-words">
                    {`params:\n${JSON.stringify(semanticQueryPreview.sqlVars, null, 2)}`}
                  </pre>
                )}
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
