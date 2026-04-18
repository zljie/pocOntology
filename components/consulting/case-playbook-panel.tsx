"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CASE_PLAYBOOKS } from "@/lib/case-playbook/scenarios";
import { useConsultingStore, useOntologyStore, useSelectionStore, useUIStore } from "@/stores";
import { cn, toPascalCase } from "@/lib/utils";
import { Send } from "lucide-react";

function matchObjectTypeId(params: { datasetName: string; objectTypes: any[] }) {
  const datasetName = String(params.datasetName || "").trim();
  if (!datasetName) return null;
  const api = toPascalCase(datasetName);
  const byApi = params.objectTypes.find((o) => o.apiName === api);
  if (byApi) return byApi.id;
  const byName = params.objectTypes.find((o) => String(o.displayName || "").toLowerCase() === datasetName.toLowerCase());
  if (byName) return byName.id;
  const contains = params.objectTypes.find((o) => String(o.apiName || "").toLowerCase().includes(datasetName.toLowerCase()));
  return contains?.id || null;
}

function actionSuffix(actionId: string) {
  const s = String(actionId || "");
  const seg = s.split("/").filter(Boolean);
  return seg[seg.length - 1] || s;
}

function selectBestActionType(params: { actionId: string; objectTypeIds: string[]; actionTypes: any[] }) {
  const suffix = toPascalCase(actionSuffix(params.actionId));
  const candidates = params.actionTypes.filter((a) => Array.isArray(a.affectedObjectTypeIds) && a.affectedObjectTypeIds.some((id: string) => params.objectTypeIds.includes(id)));
  const bestBySuffix = candidates.find((a) => String(a.apiName || "").includes(suffix));
  if (bestBySuffix) return bestBySuffix.id;
  const anyBySuffix = params.actionTypes.find((a) => String(a.apiName || "").includes(suffix));
  return anyBySuffix?.id || null;
}

function selectBestRules(params: { objectTypeIds: string[]; businessRules: any[] }) {
  return params.businessRules
    .filter((r) => Array.isArray(r.appliesToObjectTypeIds) && r.appliesToObjectTypeIds.some((id: string) => params.objectTypeIds.includes(id)))
    .map((r) => r.id);
}

function selectBestMetrics(params: { metricNames: string[]; insights: any[] }) {
  const wanted = new Set(params.metricNames.map((x) => String(x || "").trim()).filter(Boolean));
  if (!wanted.size) return [];
  const ids: string[] = [];
  for (const i of params.insights) {
    const name = String(i.displayName || i.apiName || "").trim();
    if (wanted.has(name)) ids.push(i.id);
  }
  if (ids.length) return ids;
  for (const i of params.insights) {
    const name = String(i.apiName || "").trim();
    if (wanted.has(name)) ids.push(i.id);
  }
  return ids;
}

export function CasePlaybookPanel() {
  const { casePlaybook, selectCase, selectCaseStep, updateCaseStepIntent, setDraftMessage } = useConsultingStore();
  const { objectTypes, linkTypes, actionTypes, businessRules, analysisInsights } = useOntologyStore();
  const { setSemanticHighlightedNodeIds, setSemanticHighlightedEdgeIds, clearAll } = useSelectionStore();
  const { openRightPanel, setConsultingRightTab } = useUIStore();

  const selectedCase = CASE_PLAYBOOKS.find((c) => c.caseId === casePlaybook.selectedCaseId) || CASE_PLAYBOOKS[0];
  const selectedStep = selectedCase?.steps.find((s) => s.stepId === casePlaybook.selectedStepId) || selectedCase?.steps[0];

  React.useEffect(() => {
    if (!casePlaybook.selectedCaseId) selectCase(selectedCase.caseId);
    if (!casePlaybook.selectedStepId && selectedStep) selectCaseStep(selectedStep.stepId);
  }, [casePlaybook.selectedCaseId, casePlaybook.selectedStepId, selectCase, selectCaseStep, selectedCase.caseId, selectedStep]);

  const editedIntent = selectedStep ? casePlaybook.editedIntentTextByStepId[selectedStep.stepId] || "" : "";
  const effectiveIntent = (editedIntent || selectedStep?.intentText || "").trim();

  const onSelectStep = (stepId: string) => {
    const step = selectedCase.steps.find((s) => s.stepId === stepId);
    if (!step) return;

    selectCaseStep(stepId);
    clearAll();

    const objectTypeIds = step.relatedDatasetNames
      .map((n) => matchObjectTypeId({ datasetName: n, objectTypes }))
      .filter(Boolean) as string[];

    setSemanticHighlightedNodeIds(objectTypeIds);

    const edgeIds = linkTypes
      .filter((l) => objectTypeIds.includes(l.sourceTypeId) && objectTypeIds.includes(l.targetTypeId))
      .map((l) => l.id);
    setSemanticHighlightedEdgeIds(edgeIds);

    const actionTypeId = selectBestActionType({ actionId: step.actionId, objectTypeIds, actionTypes });
    if (actionTypeId) {
      useSelectionStore.getState().selectActionType(actionTypeId);
    }

    const ruleIds = selectBestRules({ objectTypeIds, businessRules });
    if (ruleIds[0]) {
      useSelectionStore.getState().selectBusinessRule(ruleIds[0]);
    }

    const metricIds = selectBestMetrics({ metricNames: step.relatedMetricNames || [], insights: analysisInsights });
    if (metricIds[0]) {
      useSelectionStore.getState().selectAnalysisInsight(metricIds[0]);
    }

    openRightPanel();
    setConsultingRightTab("details");
  };

  const onSendToChat = () => {
    if (!selectedStep) return;
    const text =
      `案例：${selectedCase.title}\n` +
      `步骤：${selectedStep.title}\n` +
      `动作：${selectedStep.actionId}\n\n` +
      `意图：${effectiveIntent || selectedStep.intentText}\n\n` +
      `请帮我：\n- 用更清晰的方式改写这一步意图\n- 指出缺失的信息（输入字段/口径/边界条件）\n- 给出可验证的验收结果（输出字段/可观测指标）`;
    setDraftMessage(text);
    openRightPanel();
    setConsultingRightTab("consulting");
  };

  const usedLinks = selectedStep
    ? linkTypes.filter((l) => {
        const ids = selectedStep.relatedDatasetNames
          .map((n) => matchObjectTypeId({ datasetName: n, objectTypes }))
          .filter(Boolean) as string[];
        return ids.includes(l.sourceTypeId) && ids.includes(l.targetTypeId);
      })
    : [];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-3 border-b border-[#2d2d2d] bg-[#161614]">
        <div className="text-sm font-semibold text-white">案例剧本</div>
        <div className="mt-1 text-[11px] text-[#9a9a9a]">选择步骤后将高亮图谱并联动右侧详情/聊天。</div>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-4">
            <div className="space-y-2">
              <div className="text-xs text-[#a0a0a0]">案例</div>
              <div className="space-y-2">
                {CASE_PLAYBOOKS.map((c) => {
                  const active = c.caseId === selectedCase.caseId;
                  return (
                    <button
                      key={c.caseId}
                      className={cn(
                        "w-full text-left rounded-md border p-3 transition-colors",
                        active ? "border-[#5b8def]/40 bg-[#0b1220]" : "border-[#2d2d2d] bg-[#0d0d0d] hover:bg-[#121212]"
                      )}
                      onClick={() => {
                        selectCase(c.caseId);
                        selectCaseStep(c.steps[0]?.stepId || null);
                        onSelectStep(c.steps[0]?.stepId || "");
                      }}
                    >
                      <div className="text-sm text-white">{c.title}</div>
                      <div className="mt-1 text-xs text-[#9a9a9a]">{c.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedCase ? (
              <div className="space-y-2">
                <div className="text-xs text-[#a0a0a0]">步骤</div>
                <div className="space-y-2">
                  {selectedCase.steps.map((s, idx) => {
                    const active = s.stepId === selectedStep?.stepId;
                    return (
                      <button
                        key={s.stepId}
                        className={cn(
                          "w-full text-left rounded-md border p-3 transition-colors",
                          active ? "border-[#5b8def]/40 bg-[#0b1220]" : "border-[#2d2d2d] bg-[#0d0d0d] hover:bg-[#121212]"
                        )}
                        onClick={() => onSelectStep(s.stepId)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm text-white">
                            Step {idx + 1}：{s.title}
                          </div>
                          <Badge className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d] text-[11px]">{s.actionId}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-[#9a9a9a] line-clamp-2">{(casePlaybook.editedIntentTextByStepId[s.stepId] || s.intentText).trim()}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedStep ? (
              <div className="rounded-md border border-[#2d2d2d] bg-[#0d0d0d] p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-white">{selectedStep.title}</div>
                  <Button size="sm" className="bg-[#5b8def] hover:bg-[#3d6bc7] text-white" onClick={onSendToChat}>
                    <Send className="w-4 h-4 mr-1" />
                    发到聊天
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-[#a0a0a0]">意图（可改写）</div>
                  <Textarea
                    value={editedIntent || selectedStep.intentText}
                    onChange={(e) => updateCaseStepIntent(selectedStep.stepId, e.target.value)}
                    className="min-h-[110px] bg-[#0b0b0b] border-[#2d2d2d] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-[#a0a0a0]">用到的元素</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedStep.relatedDatasetNames.map((n) => (
                      <Badge key={`ds-${n}`} className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">
                        {n}
                      </Badge>
                    ))}
                    {usedLinks.slice(0, 12).map((l) => (
                      <Badge key={`lt-${l.id}`} className="bg-[#7c3aed]/10 text-[#c4b5fd] border border-[#7c3aed]/20">
                        {l.displayName}
                      </Badge>
                    ))}
                    {selectedStep.relatedMetricNames?.map((m) => (
                      <Badge key={`m-${m}`} className="bg-[#064e3b]/20 text-[#86efac] border border-[#14532d]/40">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-[#a0a0a0]">输入示例</div>
                  <pre className="text-xs text-[#e5e7eb] bg-[#0b0b0b] border border-[#2d2d2d] rounded-md p-2 overflow-auto">
                    {JSON.stringify(selectedStep.inputExampleJson ?? null, null, 2)}
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-[#a0a0a0]">输出示例</div>
                  <pre className="text-xs text-[#e5e7eb] bg-[#0b0b0b] border border-[#2d2d2d] rounded-md p-2 overflow-auto">
                    {JSON.stringify(selectedStep.outputExampleJson ?? null, null, 2)}
                  </pre>
                </div>

                {selectedStep.notes ? <div className="text-xs text-[#9a9a9a]">{selectedStep.notes}</div> : null}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

