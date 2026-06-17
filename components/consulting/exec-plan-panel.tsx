"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Streamdown } from "streamdown";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import { useConsultingStore, useOntologyStore, useSelectionStore } from "@/stores";

function extractFirstJsonCodeBlock(text: string): any | null {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  if (!match?.[1]) return null;
  const raw = match[1].trim();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function ExecPlanPanel() {
  const [goal, setGoal] = React.useState("基于 PR-2026-0001，制定从 PR→PO→收货→发票的执行与校验方案，并给出可复核的查询证据。");
  const [isLoading, setIsLoading] = React.useState(false);
  const [datasets, setDatasets] = React.useState<Array<{ id: string; name?: string; entities?: string[] }>>([]);
  const [datasetId, setDatasetId] = React.useState<string>("erp-demo");
  const [datasetEntity, setDatasetEntity] = React.useState<string>("PurchaseRequisition");
  const [datasetField, setDatasetField] = React.useState<string>("prNumber");
  const [datasetValue, setDatasetValue] = React.useState<string>("PR-2026-0001");
  const [evidence, setEvidence] = React.useState<any>(null);
  const [assistantText, setAssistantText] = React.useState<string>("");
  const [planJson, setPlanJson] = React.useState<any>(null);

  const { domains, selectedDomainId } = useConsultingStore();
  const domain = React.useMemo(() => domains.find((d) => d.id === selectedDomainId) || null, [domains, selectedDomainId]);
  const { objectTypes, linkTypes, actionTypes, dataFlows, businessRules, aiModels, analysisInsights, scenario } = useOntologyStore();
  const { selectedObjectTypeId, selectedLinkTypeId } = useSelectionStore();

  const validDomainObjectTypeIds = React.useMemo(() => {
    if (!domain) return [];
    const exist = new Set(objectTypes.map((o) => o.id));
    return (domain.objectTypeIds || []).filter((id) => exist.has(id));
  }, [domain, objectTypes]);

  const isDomainStale = React.useMemo(() => {
    if (!domain) return false;
    const hasConfig = (domain.objectTypeIds || []).length > 0;
    return hasConfig && validDomainObjectTypeIds.length === 0 && objectTypes.length > 0;
  }, [domain, validDomainObjectTypeIds.length, objectTypes.length]);

  const context = React.useMemo(() => {
    const domainObjectTypeIds = domain && !isDomainStale ? validDomainObjectTypeIds : [];
    const objectTypeSubset = domainObjectTypeIds.length > 0 ? objectTypes.filter((o) => domainObjectTypeIds.includes(o.id)) : objectTypes;
    const linkTypeSubset =
      domainObjectTypeIds.length > 0
        ? linkTypes.filter((l) => domainObjectTypeIds.includes(l.sourceTypeId) || domainObjectTypeIds.includes(l.targetTypeId))
        : linkTypes;

    return {
      scenario,
      domain: domain && !isDomainStale
        ? {
            id: domain.id,
            name: domain.name,
            description: domain.description,
            objectTypeIds: validDomainObjectTypeIds,
            entityScales: Object.fromEntries(
              Object.entries(domain.entityScales || {}).filter(([k]) => validDomainObjectTypeIds.includes(k))
            ),
          }
        : null,
      selection: {
        selectedObjectTypeId,
        selectedLinkTypeId,
      },
      ontology: {
        objectTypes: objectTypeSubset,
        linkTypes: linkTypeSubset,
        actionTypes,
        dataFlows,
        businessRules,
        aiModels,
        analysisInsights,
      },
    };
  }, [
    scenario,
    domain,
    isDomainStale,
    validDomainObjectTypeIds,
    selectedObjectTypeId,
    selectedLinkTypeId,
    objectTypes,
    linkTypes,
    actionTypes,
    dataFlows,
    businessRules,
    aiModels,
    analysisInsights,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/datasets/list")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const next = Array.isArray(data?.datasets) ? data.datasets : [];
        setDatasets(next);
        if (!next.some((d: any) => d?.id === datasetId) && next[0]?.id) setDatasetId(next[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const runEvidenceQuery = async () => {
    setEvidence(null);
    const resp = await fetch("/api/datasets/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId,
        entity: datasetEntity,
        where:
          datasetField && datasetValue
            ? { op: "and", conditions: [{ field: datasetField, op: "eq", value: datasetValue }] }
            : undefined,
        limit: 10,
      }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error(data?.error || "查询失败");
    setEvidence(data?.evidence || null);
    return data?.evidence || null;
  };

  const generatePlan = async () => {
    if (!goal.trim()) return;
    setIsLoading(true);
    setAssistantText("");
    setPlanJson(null);
    try {
      const ev = evidence || (await runEvidenceQuery().catch(() => null));

      const response = await fetch("/api/consulting-exec-plan/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          context,
          evidence: ev,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "请求失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("SSE 响应不可读");
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part
            .split("\n")
            .map((x) => x.trim())
            .find((x) => x.startsWith("data: "));
          if (!line) continue;
          const jsonText = line.slice("data: ".length);
          let evt: any = null;
          try {
            evt = JSON.parse(jsonText);
          } catch {
            continue;
          }

          if (evt?.type === "assistant_delta") {
            text += String(evt?.delta || "");
            setAssistantText(text);
          } else if (evt?.type === "assistant_done") {
            text = String(evt?.text || text || "（空响应）");
            setAssistantText(text);
          } else if (evt?.type === "error") {
            const detail = evt?.detail ? `\n${evt.detail}` : "";
            throw new Error(String(evt?.error || "请求失败") + detail);
          }
        }
      }

      const pj = extractFirstJsonCodeBlock(text);
      setPlanJson(pj);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0d0d] text-[#e0e0e0]">
      <div className="flex-none p-4 border-b border-[#2d2d2d] bg-[#161614]">
        <div className="text-sm font-semibold text-white">执行方案（Planner）</div>
        <div className="text-[11px] text-[#808080] mt-1">基于本体上下文 + 数据集 evidence 生成可复核的 Plan JSON</div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          <Card className="p-3 bg-[#111] border-[#2d2d2d]">
            <Label className="text-xs text-[#a0a0a0]">目标（goal）</Label>
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="mt-2 h-9 bg-[#0d0d0d] border-[#2d2d2d] text-[#e5e5e5]"
            />
          </Card>

          <Card className="p-3 bg-[#111] border-[#2d2d2d]">
            <div className="text-xs text-[#a0a0a0] mb-2">证据来源（数据集查询）</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-[#a0a0a0]">数据集</Label>
                <Select value={datasetId} onValueChange={setDatasetId}>
                  <SelectTrigger className="h-8 bg-[#0d0d0d] border-[#2d2d2d] text-[#e5e5e5]">
                    <SelectValue placeholder="选择数据集" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d0d0d] border-[#2d2d2d]">
                    {datasets.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name || d.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-[#a0a0a0]">实体</Label>
                <Input
                  value={datasetEntity}
                  onChange={(e) => setDatasetEntity(e.target.value)}
                  className="h-8 bg-[#0d0d0d] border-[#2d2d2d] text-[#e5e5e5]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-[#a0a0a0]">字段</Label>
                <Input
                  value={datasetField}
                  onChange={(e) => setDatasetField(e.target.value)}
                  className="h-8 bg-[#0d0d0d] border-[#2d2d2d] text-[#e5e5e5]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-[#a0a0a0]">值（eq）</Label>
                <Input
                  value={datasetValue}
                  onChange={(e) => setDatasetValue(e.target.value)}
                  className="h-8 bg-[#0d0d0d] border-[#2d2d2d] text-[#e5e5e5]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="outline"
                className="h-8 bg-[#2d2d2d] border-[#3d3d3d] text-[#e5e5e5] hover:bg-[#3d3d3d]"
                onClick={() => runEvidenceQuery().catch(() => {})}
              >
                获取证据
              </Button>
              <Button
                className="h-8 bg-[#8B5CF6] text-white hover:bg-[#7c3aed]"
                disabled={isLoading}
                onClick={() => generatePlan().catch(() => {})}
              >
                {isLoading ? "生成中…" : "生成执行方案"}
              </Button>
            </div>

            {evidence ? (
              <pre className="mt-2 text-[11px] leading-relaxed whitespace-pre-wrap text-[#cfcfcf] bg-[#0b0b0b] border border-[#2d2d2d] rounded p-2 max-h-56 overflow-auto">
                {JSON.stringify(evidence, null, 2)}
              </pre>
            ) : null}
          </Card>

          {planJson ? (
            <Card className="p-3 bg-[#111] border-[#2d2d2d]">
              <div className="text-xs text-[#a0a0a0] mb-2">Plan JSON（解析结果）</div>
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-[#cfcfcf] bg-[#0b0b0b] border border-[#2d2d2d] rounded p-2 max-h-72 overflow-auto">
                {JSON.stringify(planJson, null, 2)}
              </pre>
              {Array.isArray(planJson?.nextQuestions) && planJson.nextQuestions.length ? (
                <div className="mt-2 text-[11px] text-[#a0a0a0]">
                  缺口问题：{planJson.nextQuestions.join("；")}
                </div>
              ) : null}
            </Card>
          ) : null}

          {assistantText ? (
            <Card className="p-3 bg-[#111] border-[#2d2d2d]">
              <div className="text-xs text-[#a0a0a0] mb-2">Planner 原始输出（支持 Markdown/Mermaid）</div>
              <div className="prose prose-invert max-w-none text-sm">
                <Streamdown plugins={{ mermaid, cjk }} isAnimating={isLoading}>
                  {assistantText}
                </Streamdown>
              </div>
            </Card>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
