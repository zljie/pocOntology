"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useOntologyStore } from "@/stores";

type SandboxResult = {
  meta?: {
    totalScenarios?: number;
    totalGroups?: number;
    ontologyDigest?: string;
    model?: string;
    generatedAt?: string;
  };
  pyramid?: {
    theme?: string;
    groups?: Array<{
      id?: string;
      title: string;
      rationale?: string;
      scenarios?: Array<{
        id?: string;
        name: string;
        goal?: string;
        trigger?: string;
        actors?: string[];
        objects?: string[];
        steps?: string[];
        preconditions?: string[];
        postconditions?: string[];
        observableResults?: string[];
        coverageStatus?: "COVERED" | "PARTIAL" | "GAP";
        coverageHints?: {
          actionTypes?: string[];
          objectTypes?: string[];
          linkTypes?: string[];
          businessRules?: string[];
        };
        missingHints?: {
          actionTypes?: string[];
          objectTypes?: string[];
          linkTypes?: string[];
          businessRules?: string[];
        };
      }>;
    }>;
  };
  coverage?: {
    actionTypes?: { covered: number; total: number; ratio: number };
    objectTypes?: { covered: number; total: number; ratio: number };
    linkTypes?: { covered: number; total: number; ratio: number };
    businessRules?: { covered: number; total: number; ratio: number };
  };
  gaps?: {
    uncoveredActionTypes?: string[];
    uncoveredObjectTypes?: string[];
    uncoveredLinkTypes?: string[];
    uncoveredBusinessRules?: string[];
  };
  rawText?: string;
};

export function BusinessScenarioSandbox() {
  const { objectTypes, linkTypes, actionTypes, dataFlows, businessRules, aiModels } = useOntologyStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SandboxResult | null>(null);

  const ontologySnapshot = useMemo(
    () => ({
      objectTypes,
      linkTypes,
      actionTypes,
      dataFlows,
      businessRules,
      aiModels,
    }),
    [objectTypes, linkTypes, actionTypes, dataFlows, businessRules, aiModels]
  );

  const resultText = useMemo(() => {
    if (!result) return "";
    return JSON.stringify(result, null, 2);
  }, [result]);

  async function onGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const resp = await fetch("/api/business-scenario-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ontology: ontologySnapshot }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text.slice(0, 800) || `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as SandboxResult;
      setResult(data);
    } catch (e: any) {
      const errorMsg = e?.message || "生成失败";
      console.error("[Business Scenario Sandbox] Generation failed:", e);
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  }

  async function onCopy() {
    if (!resultText) return;
    await navigator.clipboard.writeText(resultText);
  }

  const totalScenarios = result?.meta?.totalScenarios ?? 0;
  const totalGroups = result?.meta?.totalGroups ?? 0;
  const coverage = result?.coverage;
  const gaps = result?.gaps;

  const pct = (ratio?: number) => `${Math.round(Math.max(0, Math.min(1, ratio ?? 0)) * 100)}%`;
  const normalize = useMemo(() => (arr?: string[]) => (Array.isArray(arr) ? arr.filter(Boolean) : []), []);

  function renderTagRow(label: string, items: string[], tone: "used" | "missing") {
    const normalized = normalize(items);
    return (
      <div className="flex items-start gap-2">
        <div className="text-[11px] text-[#9a9a9a] shrink-0 w-[44px]">{label}</div>
        {normalized.length ? (
          <div className="flex flex-wrap gap-1">
            {normalized.slice(0, 24).map((x) => (
              <Badge
                key={`${label}-${x}`}
                className={
                  tone === "used"
                    ? "bg-[#111827] text-[#93c5fd] border border-[#1f2937]"
                    : "bg-[#3f1d1d] text-[#fca5a5] border border-[#7f1d1d]"
                }
              >
                {x}
              </Badge>
            ))}
            {normalized.length > 24 ? <span className="text-[11px] text-[#6b6b6b]">…</span> : null}
          </div>
        ) : (
          <div className="text-[11px] text-[#6b6b6b]">—</div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#1f1f1f] bg-[#0d0d0d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white">业务场景沙盘</div>
          <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
            {objectTypes.length} 对象 / {actionTypes.length} 动作 / {linkTypes.length} 关系
          </Badge>
          {result && (
            <Badge variant="secondary" className="bg-[#1a2a1a] text-[#86efac] border-[#14532d]">
              {totalGroups} 组 / {totalScenarios} 场景
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:opacity-90 text-white"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "推演中…" : "生成沙盘"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
            onClick={onCopy}
            disabled={!resultText}
          >
            复制 JSON
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 text-sm text-red-300 border-b border-[#2d2d2d] bg-[#1a0f10]">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 p-4">
        <Tabs defaultValue="overview" className="h-full flex flex-col">
          <TabsList className="w-full bg-[#111111] border border-[#2d2d2d]">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="scenarios">场景</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 min-h-0 mt-3">
            <Card className="h-full bg-[#0b0b0b] border-[#2d2d2d] p-4 text-sm text-[#cfcfcf]">
              {!result ? (
                <div className="space-y-2">
                  <div className="text-white font-medium">用途</div>
                  <div>基于当前本体数据，按 MECE 与金字塔结构穷举可推演的业务场景，用于度量覆盖度与盲区。</div>
                  <div className="text-white font-medium pt-2">操作</div>
                  <div>点击右上角「生成沙盘」。生成后在「场景」查看分组与子场景，在「JSON」导出。</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-white font-medium">{result?.pyramid?.theme || "业务场景全景"}</div>
                  <div className="text-xs text-[#9a9a9a]">
                    ontologyDigest: {result?.meta?.ontologyDigest || "-"}；model: {result?.meta?.model || "-"}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-[#0d0d0d] border-[#2d2d2d] p-3">
                      <div className="text-xs text-[#9a9a9a]">分组数</div>
                      <div className="text-xl text-white font-semibold">{totalGroups}</div>
                    </Card>
                    <Card className="bg-[#0d0d0d] border-[#2d2d2d] p-3">
                      <div className="text-xs text-[#9a9a9a]">场景数</div>
                      <div className="text-xl text-white font-semibold">{totalScenarios}</div>
                    </Card>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-[#0d0d0d] border-[#2d2d2d] p-3">
                      <div className="text-xs text-[#9a9a9a]">动作覆盖</div>
                      <div className="text-lg text-white font-semibold">
                        {coverage?.actionTypes ? `${pct(coverage.actionTypes.ratio)} (${coverage.actionTypes.covered}/${coverage.actionTypes.total})` : "-"}
                      </div>
                    </Card>
                    <Card className="bg-[#0d0d0d] border-[#2d2d2d] p-3">
                      <div className="text-xs text-[#9a9a9a]">对象覆盖</div>
                      <div className="text-lg text-white font-semibold">
                        {coverage?.objectTypes ? `${pct(coverage.objectTypes.ratio)} (${coverage.objectTypes.covered}/${coverage.objectTypes.total})` : "-"}
                      </div>
                    </Card>
                    <Card className="bg-[#0d0d0d] border-[#2d2d2d] p-3">
                      <div className="text-xs text-[#9a9a9a]">关系覆盖</div>
                      <div className="text-lg text-white font-semibold">
                        {coverage?.linkTypes ? `${pct(coverage.linkTypes.ratio)} (${coverage.linkTypes.covered}/${coverage.linkTypes.total})` : "-"}
                      </div>
                    </Card>
                    <Card className="bg-[#0d0d0d] border-[#2d2d2d] p-3">
                      <div className="text-xs text-[#9a9a9a]">规则覆盖</div>
                      <div className="text-lg text-white font-semibold">
                        {coverage?.businessRules
                          ? `${pct(coverage.businessRules.ratio)} (${coverage.businessRules.covered}/${coverage.businessRules.total})`
                          : "-"}
                      </div>
                    </Card>
                  </div>
                  {(gaps?.uncoveredActionTypes?.length || gaps?.uncoveredObjectTypes?.length) && (
                    <Card className="bg-[#0d0d0d] border-[#2d2d2d] p-3">
                      <div className="text-xs text-[#9a9a9a] mb-2">盲区提示（未被场景引用的元素）</div>
                      <div className="text-xs text-[#cfcfcf] space-y-1">
                        {!!gaps?.uncoveredActionTypes?.length && (
                          <div>
                            动作：{gaps.uncoveredActionTypes.slice(0, 10).join(", ")}
                            {gaps.uncoveredActionTypes.length > 10 ? " …" : ""}
                          </div>
                        )}
                        {!!gaps?.uncoveredObjectTypes?.length && (
                          <div>
                            对象：{gaps.uncoveredObjectTypes.slice(0, 10).join(", ")}
                            {gaps.uncoveredObjectTypes.length > 10 ? " …" : ""}
                          </div>
                        )}
                        {!!gaps?.uncoveredLinkTypes?.length && (
                          <div>
                            关系：{gaps.uncoveredLinkTypes.slice(0, 10).join(", ")}
                            {gaps.uncoveredLinkTypes.length > 10 ? " …" : ""}
                          </div>
                        )}
                        {!!gaps?.uncoveredBusinessRules?.length && (
                          <div>
                            规则：{gaps.uncoveredBusinessRules.slice(0, 10).join(", ")}
                            {gaps.uncoveredBusinessRules.length > 10 ? " …" : ""}
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="scenarios" className="flex-1 min-h-0 mt-3">
            <Card className="h-full bg-[#0b0b0b] border-[#2d2d2d] p-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {!result?.pyramid?.groups?.length ? (
                    <div className="text-sm text-[#9a9a9a]">尚未生成场景。</div>
                  ) : (
                    result.pyramid.groups.map((g, gi) => (
                      <div key={`${g.title}-${gi}`} className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-white font-medium">{g.title}</div>
                            {g.rationale && <div className="text-xs text-[#9a9a9a] mt-1">{g.rationale}</div>}
                          </div>
                          <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
                            {(g.scenarios || []).length} 场景
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {(g.scenarios || []).map((s, si) => (
                            <Card key={`${s.name}-${si}`} className="bg-[#0d0d0d] border-[#222] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-sm text-white font-medium">{s.name}</div>
                                <div className="flex items-center gap-2">
                                  {s.coverageStatus === "COVERED" && (
                                    <Badge className="bg-[#052e16] text-[#86efac] border border-[#14532d]">已覆盖</Badge>
                                  )}
                                  {s.coverageStatus === "PARTIAL" && (
                                    <Badge className="bg-[#1f2937] text-[#93c5fd] border border-[#334155]">部分覆盖</Badge>
                                  )}
                                  {s.coverageStatus === "GAP" && (
                                    <Badge className="bg-[#3f1d1d] text-[#fca5a5] border border-[#7f1d1d]">盲区</Badge>
                                  )}
                                  {s.coverageHints?.actionTypes?.length ? (
                                    <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">
                                      {s.coverageHints.actionTypes.length} 动作
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                              <div className="text-xs text-[#9a9a9a] mt-1">{s.goal || s.trigger || ""}</div>
                              {!!s.steps?.length && (
                                <div className="mt-2 text-xs text-[#cfcfcf] space-y-1">
                                  {s.steps.slice(0, 6).map((step, idx) => (
                                    <div key={idx}>
                                      {idx + 1}. {step}
                                    </div>
                                  ))}
                                  {s.steps.length > 6 && <div className="text-[#9a9a9a]">…</div>}
                                </div>
                              )}

                              <div className="mt-3 space-y-2">
                                <div className="text-[11px] text-[#9a9a9a]">已用要素</div>
                                <div className="space-y-1">
                                  {renderTagRow("动作", s.coverageHints?.actionTypes || [], "used")}
                                  {renderTagRow("对象", s.coverageHints?.objectTypes || [], "used")}
                                  {renderTagRow("关系", s.coverageHints?.linkTypes || [], "used")}
                                  {renderTagRow("规则", s.coverageHints?.businessRules || [], "used")}
                                </div>
                              </div>

                              {(normalize(s.missingHints?.actionTypes).length ||
                                normalize(s.missingHints?.objectTypes).length ||
                                normalize(s.missingHints?.linkTypes).length ||
                                normalize(s.missingHints?.businessRules).length) && (
                                <div className="mt-3 space-y-2">
                                  <div className="text-[11px] text-[#9a9a9a]">为了覆盖建议补充</div>
                                  <div className="space-y-1">
                                    {renderTagRow("动作", s.missingHints?.actionTypes || [], "missing")}
                                    {renderTagRow("对象", s.missingHints?.objectTypes || [], "missing")}
                                    {renderTagRow("关系", s.missingHints?.linkTypes || [], "missing")}
                                    {renderTagRow("规则", s.missingHints?.businessRules || [], "missing")}
                                  </div>
                                </div>
                              )}
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="json" className="flex-1 min-h-0 mt-3">
            <Card className="h-full bg-[#0b0b0b] border-[#2d2d2d] p-3">
              <Textarea
                className="h-full min-h-[360px] bg-[#0d0d0d] border-[#2d2d2d] text-[#cfcfcf] font-mono text-xs"
                readOnly
                value={resultText}
                placeholder="生成后会显示结构化 JSON，可复制用于评审与度量。"
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
