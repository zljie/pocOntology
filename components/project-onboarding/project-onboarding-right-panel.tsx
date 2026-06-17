"use client";

import React from "react";
import { Streamdown } from "streamdown";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn, generateId, isCamelCase, isPascalCase, toCamelCase, toPascalCase } from "@/lib/utils";
import { useUIStore, useOntologyStore, useOnboardingStore } from "@/stores";
import { getProjectOnboardingStateClient, saveProjectOnboardingStateClient, upsertMetaToNeo4jClient } from "@/lib/neo4j/client";
import type { OnboardingStepId, OnboardingState } from "@/lib/types/project-onboarding";
import type { MetaCore } from "@/lib/meta/meta-core";
import type { Property, PropertyBaseType } from "@/lib/types/ontology";

type ScopeResult = {
  scopeSummary?: string;
  inScope?: string[];
  outOfScope?: string[];
  coreDomains?: string[];
  glossary?: Array<{ term: string; meaning: string }>;
  openQuestions?: string[];
};

const ALLOWED_BASE_TYPES: PropertyBaseType[] = ["STRING", "INTEGER", "DOUBLE", "BOOLEAN", "TIMESTAMP", "STRUCT"];

function normalizeBaseType(value: string): PropertyBaseType {
  const upper = String(value || "").toUpperCase();
  if ((ALLOWED_BASE_TYPES as string[]).includes(upper)) return upper as PropertyBaseType;
  return "STRING";
}

function normalizeObjectTypeApiName(name: string) {
  if (isPascalCase(name)) return name;
  return toPascalCase(name);
}

function normalizeActionApiName(name: string) {
  if (isPascalCase(name)) return name;
  return toPascalCase(name);
}

function normalizePropertyApiName(name: string) {
  if (isCamelCase(name)) return name;
  return toCamelCase(name);
}

function uniquePascalCase(base: string, used: Set<string>) {
  let name = isPascalCase(base) ? base : toPascalCase(base);
  if (!name) name = "Entity";
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let i = 2;
  while (used.has(`${name}${i}`)) i += 1;
  const finalName = `${name}${i}`;
  used.add(finalName);
  return finalName;
}

function uniqueCamelCase(base: string, used: Set<string>) {
  let name = normalizePropertyApiName(base);
  if (!name) name = "field";
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let i = 2;
  while (used.has(`${name}${i}`)) i += 1;
  const finalName = `${name}${i}`;
  used.add(finalName);
  return finalName;
}

async function readSSE(response: Response, onEvent: (event: any) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("SSE 响应不可读");
  const decoder = new TextDecoder();
  let buffer = "";

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
      try {
        onEvent(JSON.parse(jsonText));
      } catch {
        continue;
      }
    }
  }
}

function getStepTitle(stepId: OnboardingStepId) {
  if (stepId === "SCOPE") return "业务范围";
  if (stepId === "OBJECTS") return "业务对象";
  if (stepId === "SCENARIOS") return "业务场景";
  return "行为/事件";
}

function getNextStep(stepId: OnboardingStepId): OnboardingStepId | null {
  if (stepId === "SCOPE") return "OBJECTS";
  if (stepId === "OBJECTS") return "SCENARIOS";
  if (stepId === "SCENARIOS") return "ACTIONS";
  return null;
}

export function ProjectOnboardingRightPanel() {
  const { projectOnboardingMode, rightPanelOpen, closeRightPanel, exitProjectOnboarding, openRightPanel } = useUIStore();
  const { neo4jProject, objectTypes, linkTypes, actionTypes, dataFlows, businessRules, aiModels, analysisInsights, scenario, addObjectType, addActionType } =
    useOntologyStore();
  const { initProjectOnboarding, hydrateProjectOnboarding, onboardingByProject, setCurrentStep, setStepInput, setStepProposal, confirmStep, rollbackTo } =
    useOnboardingStore();

  const dbName = neo4jProject?.dbName || "";
  const onboarding: OnboardingState | undefined = dbName ? onboardingByProject[dbName] : undefined;

  const currentStep = onboarding?.currentStep || "SCOPE";
  const stepState = onboarding?.steps?.[currentStep];

  const [error, setError] = React.useState<string>("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [assistantText, setAssistantText] = React.useState("");
  const [scopeResult, setScopeResult] = React.useState<ScopeResult | null>(null);
  const [confirmKeys, setConfirmKeys] = React.useState<Record<string, boolean>>({});
  const [scenarioResult, setScenarioResult] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!projectOnboardingMode) return;
    if (!dbName) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await getProjectOnboardingStateClient(dbName);
        if (cancelled) return;
        if (resp?.state && resp.state?.projectDbName === dbName) {
          hydrateProjectOnboarding(dbName, resp.state);
          return;
        }
      } catch {
      }
      if (cancelled) return;
      initProjectOnboarding(dbName);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectOnboardingMode, dbName, initProjectOnboarding, hydrateProjectOnboarding]);

  React.useEffect(() => {
    if (!projectOnboardingMode) return;
    if (!dbName) return;
    const state = onboardingByProject[dbName];
    if (!state) return;
    const handle = window.setTimeout(() => {
      saveProjectOnboardingStateClient({ database: dbName, state }).catch(() => {});
    }, 500);
    return () => {
      window.clearTimeout(handle);
    };
  }, [projectOnboardingMode, dbName, onboardingByProject]);

  React.useEffect(() => {
    setError("");
    setIsStreaming(false);
    setAssistantText(stepState?.assistantMarkdown || "");
    setScopeResult((stepState?.proposalJson as any)?.scope || null);
    setScenarioResult(stepState?.proposalJson || null);
    setConfirmKeys({});
  }, [dbName, currentStep, stepState?.assistantMarkdown, stepState?.proposalJson]);

  const inputText = stepState?.inputText || "";
  const status = stepState?.status || "READY";
  const isLocked = status === "LOCKED";
  const canConfirm = Boolean(stepState?.proposalJson) && status === "READY";

  async function runScopeGen() {
    if (!dbName || !onboarding) return;
    const text = inputText.trim();
    if (!text) {
      setError("请输入业务范围描述");
      return;
    }
    setError("");
    setIsStreaming(true);
    setAssistantText("");
    setScopeResult(null);
    try {
      const res = await fetch("/api/project-scope-gen/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 800) || `HTTP ${res.status}`);

      let markdown = "";
      let scope: ScopeResult | null = null;
      await readSSE(res, (evt) => {
        if (evt?.type === "assistant_delta") {
          markdown += String(evt?.delta || "");
          setAssistantText(markdown);
        } else if (evt?.type === "assistant_done") {
          markdown = String(evt?.text || markdown);
          setAssistantText(markdown);
        } else if (evt?.type === "scope_result") {
          scope = evt?.scope || null;
          setScopeResult(scope);
        } else if (evt?.type === "error") {
          setError(String(evt?.error || "生成失败"));
        }
      });

      const proposalJson = { scope };
      setStepProposal(dbName, "SCOPE", markdown, proposalJson);
    } catch (e: any) {
      setError(e?.message || "生成失败");
    } finally {
      setIsStreaming(false);
    }
  }

  async function runObjectPlanGen() {
    if (!dbName) return;
    const text = inputText.trim();
    if (!text) {
      setError("请输入对象描述");
      return;
    }
    setError("");
    setIsStreaming(true);
    setAssistantText("");
    try {
      const res = await fetch("/api/object-type-gen/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 3,
          input: text,
          existingObjectTypes: objectTypes,
        }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 800) || `HTTP ${res.status}`);

      let markdown = "";
      let plan: any = null;
      await readSSE(res, (evt) => {
        if (evt?.type === "assistant_delta") {
          markdown += String(evt?.delta || "");
          setAssistantText(markdown);
        } else if (evt?.type === "assistant_done") {
          markdown = String(evt?.text || markdown);
          setAssistantText(markdown);
        } else if (evt?.type === "plan_result") {
          plan = evt?.plan || null;
        } else if (evt?.type === "error") {
          setError(String(evt?.message || "生成失败"));
        }
      });
      setStepProposal(dbName, "OBJECTS", markdown, { plan });
      if (plan?.objectTypes?.length) {
        const defaults: Record<string, boolean> = {};
        for (const ot of plan.objectTypes) {
          const key = String(ot?.id || ot?.apiName || ot?.displayName || "");
          if (key) defaults[key] = true;
        }
        setConfirmKeys(defaults);
      }
    } catch (e: any) {
      setError(e?.message || "生成失败");
    } finally {
      setIsStreaming(false);
    }
  }

  async function runScenarioGen() {
    setError("");
    setIsStreaming(true);
    try {
      const ontologySnapshot = { objectTypes, linkTypes, actionTypes, dataFlows, businessRules, aiModels };
      const prepareResp = await fetch("/api/business-scenario-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ontology: ontologySnapshot, mode: "prepare" }),
      });
      if (!prepareResp.ok) throw new Error((await prepareResp.text()).slice(0, 800) || `HTTP ${prepareResp.status}`);
      const prepared = (await prepareResp.json()) as any;
      const requestId = String(prepared?.meta?.requestId || "");

      const resp = await fetch("/api/business-scenario-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ontology: ontologySnapshot, requestId }),
      });
      if (!resp.ok) throw new Error((await resp.text()).slice(0, 800) || `HTTP ${resp.status}`);
      const data = (await resp.json()) as any;
      setScenarioResult(data);
      setStepProposal(dbName, "SCENARIOS", "已生成业务场景沙盘结果，请选择关键场景后确认。", data);
      const defaults: Record<string, boolean> = {};
      const groups = Array.isArray(data?.pyramid?.groups) ? data.pyramid.groups : [];
      for (const g of groups) {
        const scenarios = Array.isArray(g?.scenarios) ? g.scenarios : [];
        for (const s of scenarios) {
          const id = String(s?.id || s?.name || "");
          if (id) defaults[id] = false;
        }
      }
      setConfirmKeys(defaults);
    } catch (e: any) {
      setError(e?.message || "生成失败");
    } finally {
      setIsStreaming(false);
    }
  }

  async function runActionPlanGen() {
    if (!dbName) return;
    const text = inputText.trim();
    if (!text) {
      setError("请输入行为/事件描述");
      return;
    }
    setError("");
    setIsStreaming(true);
    setAssistantText("");
    try {
      const scopeSummary = (onboarding?.steps?.SCOPE?.proposalJson as any)?.scope?.scopeSummary;
      const scenariosSelected = (() => {
        const planJson = onboarding?.steps?.SCENARIOS?.proposalJson as any;
        const selected = Array.isArray(planJson?.selectedScenarioNames) ? planJson.selectedScenarioNames : [];
        return selected.slice(0, 24);
      })();
      const context =
        `【业务范围】${scopeSummary || "未提供"}\n` +
        `【关键场景】${scenariosSelected.length ? scenariosSelected.join("；") : "未选择"}\n` +
        `【对象类型】${objectTypes.map((x) => x.apiName).slice(0, 60).join(", ") || "无"}\n\n`;
      const fullInput = `${context}${text}`;

      const res = await fetch("/api/action-type-gen/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 3,
          input: fullInput,
          existingObjectTypes: objectTypes,
          existingActionTypes: actionTypes,
        }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 800) || `HTTP ${res.status}`);

      let markdown = "";
      let plan: any = null;
      await readSSE(res, (evt) => {
        if (evt?.type === "assistant_delta") {
          markdown += String(evt?.delta || "");
          setAssistantText(markdown);
        } else if (evt?.type === "assistant_done") {
          markdown = String(evt?.text || markdown);
          setAssistantText(markdown);
        } else if (evt?.type === "plan_result") {
          plan = evt?.plan || null;
        } else if (evt?.type === "error") {
          setError(String(evt?.message || "生成失败"));
        }
      });
      setStepProposal(dbName, "ACTIONS", markdown, { plan });
      if (plan?.actionTypes?.length) {
        const defaults: Record<string, boolean> = {};
        for (const at of plan.actionTypes) {
          const key = String(at?.id || at?.apiName || at?.displayName || "");
          if (key) defaults[key] = true;
        }
        setConfirmKeys(defaults);
      }
    } catch (e: any) {
      setError(e?.message || "生成失败");
    } finally {
      setIsStreaming(false);
    }
  }

  async function applyObjectPlan() {
    if (!dbName) return;
    const plan = (stepState?.proposalJson as any)?.plan;
    const drafts = Array.isArray(plan?.objectTypes) ? plan.objectTypes : [];
    const enabled = drafts.filter((ot: any) => {
      const key = String(ot?.id || ot?.apiName || ot?.displayName || "");
      return key ? Boolean(confirmKeys[key]) : false;
    });
    if (!enabled.length) {
      setError("请选择要创建的对象类型");
      return;
    }
    const usedObjectApiNames = new Set(objectTypes.map((ot) => ot.apiName));
    const created: any[] = [];
    for (const draftOt of enabled) {
      const rawApi = String(draftOt.apiName || draftOt.displayName || "");
      const apiName = uniquePascalCase(normalizeObjectTypeApiName(rawApi), usedObjectApiNames);

      const usedPropApiNames = new Set<string>();
      const props: Property[] = (draftOt.properties || []).map((p: any) => {
        const raw = String(p.apiName || p.displayName || "");
        const propApiName = uniqueCamelCase(raw, usedPropApiNames);
        return {
          id: generateId(),
          apiName: propApiName,
          displayName: String(p.displayName || propApiName),
          baseType: normalizeBaseType(String(p.baseType)),
          visibility: "NORMAL",
          required: Boolean(p.required),
          description: p.description,
        };
      });

      if (props.length === 0) {
        const idApi = uniqueCamelCase(String(draftOt.primaryKeyApiName || "id"), usedPropApiNames);
        const nameApi = uniqueCamelCase(String(draftOt.titleKeyApiName || "name"), usedPropApiNames);
        props.push(
          {
            id: generateId(),
            apiName: idApi,
            displayName: "ID",
            baseType: "STRING",
            visibility: "NORMAL",
            required: true,
            description: "唯一标识",
          },
          {
            id: generateId(),
            apiName: nameApi,
            displayName: "名称",
            baseType: "STRING",
            visibility: "NORMAL",
            required: true,
            description: "标题展示字段",
          }
        );
      }

      const pkApi = normalizePropertyApiName(String(draftOt.primaryKeyApiName || "id"));
      const titleApi = normalizePropertyApiName(String(draftOt.titleKeyApiName || "name"));
      const pkId = props.find((p) => p.apiName === pkApi)?.id || props[0]?.id || "";
      const titleId = props.find((p) => p.apiName === titleApi)?.id || props[0]?.id || "";

      const newOt = addObjectType({
        displayName: String(draftOt.displayName || apiName),
        apiName,
        description: draftOt.description,
        visibility: "PROJECT",
        primaryKey: pkId,
        titleKey: titleId,
        properties: props,
        layer: "SEMANTIC",
      });
      created.push(newOt);
    }

    if (neo4jProject && created.length) {
      try {
        const meta: MetaCore = {
          scenario,
          objectTypes: created,
          linkTypes: [],
          actionTypes: [],
          dataFlows: [],
          businessRules: [],
          aiModels: [],
          analysisInsights: [],
        };
        await upsertMetaToNeo4jClient({
          database: neo4jProject.dbName,
          scenario: neo4jProject.dbName,
          meta,
        });
      } catch (e: any) {
        setError(e?.message || "写入 Neo4j 失败");
        return;
      }
    }

    confirmStep(dbName, "OBJECTS", created.map((x) => x.id));
  }

  async function applyScenarioSelection() {
    if (!dbName) return;
    const data = scenarioResult || stepState?.proposalJson;
    const groups = Array.isArray(data?.pyramid?.groups) ? data.pyramid.groups : [];
    const selectedScenarioNames: string[] = [];
    for (const g of groups) {
      const scenarios = Array.isArray(g?.scenarios) ? g.scenarios : [];
      for (const s of scenarios) {
        const key = String(s?.id || s?.name || "");
        if (key && confirmKeys[key]) selectedScenarioNames.push(String(s?.name || key));
      }
    }
    if (!selectedScenarioNames.length) {
      setError("请选择至少 1 个关键场景");
      return;
    }
    const proposal = { ...(data || {}), selectedScenarioNames };
    setStepProposal(dbName, "SCENARIOS", "已选择关键场景并保存。", proposal);
    confirmStep(dbName, "SCENARIOS", []);
  }

  async function applyActionPlan() {
    if (!dbName) return;
    const plan = (stepState?.proposalJson as any)?.plan;
    const drafts = Array.isArray(plan?.actionTypes) ? plan.actionTypes : [];
    const enabled = drafts.filter((at: any) => {
      const key = String(at?.id || at?.apiName || at?.displayName || "");
      return key ? Boolean(confirmKeys[key]) : false;
    });
    if (!enabled.length) {
      setError("请选择要创建的操作类型");
      return;
    }
    const objectIdByApiName = new Map(objectTypes.map((ot) => [ot.apiName, ot.id]));
    const usedActionApiNames = new Set(actionTypes.map((at) => at.apiName));
    const created: any[] = [];

    for (const draftAt of enabled) {
      const baseApiName = String(draftAt.apiName || draftAt.displayName || "");
      const apiName = uniquePascalCase(normalizeActionApiName(baseApiName), usedActionApiNames);

      const usedInputApiNames = new Set<string>();
      const usedOutputApiNames = new Set<string>();

      const inputParameters: Property[] = (draftAt.inputParameters || []).map((p: any) => {
        const raw = String(p.apiName || p.displayName || "");
        const propApiName = uniqueCamelCase(raw, usedInputApiNames);
        return {
          id: generateId(),
          apiName: propApiName,
          displayName: String(p.displayName || propApiName),
          baseType: normalizeBaseType(String(p.baseType)),
          visibility: "NORMAL",
          required: Boolean(p.required),
          description: p.description,
        };
      });
      const outputProperties: Property[] = (draftAt.outputProperties || []).map((p: any) => {
        const raw = String(p.apiName || p.displayName || "");
        const propApiName = uniqueCamelCase(raw, usedOutputApiNames);
        return {
          id: generateId(),
          apiName: propApiName,
          displayName: String(p.displayName || propApiName),
          baseType: normalizeBaseType(String(p.baseType)),
          visibility: "NORMAL",
          required: Boolean(p.required),
          description: p.description,
        };
      });
      const affectedObjectTypeIds = (draftAt.affectedObjectTypeApiNames || [])
        .map((n: any) => String(n || "").trim())
        .map((n: string) => objectIdByApiName.get(n))
        .filter(Boolean) as string[];

      const newAt = addActionType({
        displayName: String(draftAt.displayName || apiName),
        apiName,
        description: draftAt.description,
        affectedObjectTypeIds,
        affectedLinkTypeIds: [],
        inputParameters,
        outputProperties,
        visibility: "PROJECT",
        layer: "KINETIC",
      });
      created.push(newAt);
    }

    if (neo4jProject && created.length) {
      try {
        const meta: MetaCore = {
          scenario,
          objectTypes: [],
          linkTypes: [],
          actionTypes: created,
          dataFlows: [],
          businessRules: [],
          aiModels: [],
          analysisInsights: [],
        };
        await upsertMetaToNeo4jClient({
          database: neo4jProject.dbName,
          scenario: neo4jProject.dbName,
          meta,
        });
      } catch (e: any) {
        setError(e?.message || "写入 Neo4j 失败");
        return;
      }
    }

    confirmStep(dbName, "ACTIONS", created.map((x) => x.id));
    exitProjectOnboarding();
    openRightPanel();
  }

  if (!projectOnboardingMode) return null;
  if (!rightPanelOpen) return null;
  if (!dbName) return null;
  if (!onboarding || !stepState) return null;

  const next = getNextStep(currentStep);

  const headerBadgeTone =
    status === "DONE" ? "bg-[#1a2a1a] text-[#86efac] border-[#14532d]" : status === "READY" ? "bg-[#111827] text-[#93c5fd] border-[#1f2937]" : "bg-[#2d2d2d] text-[#6b6b6b] border-[#3d3d3d]";

  const renderConfirmList = (items: Array<{ key: string; title: string; subtitle?: string }>) => (
    <div className="space-y-2">
      {items.map((x) => (
        <label key={x.key} className="flex items-start gap-3 rounded-md border border-[#2d2d2d] bg-[#0d0d0d] p-3">
          <div className="pt-0.5">
            <Switch
              checked={Boolean(confirmKeys[x.key])}
              onCheckedChange={(checked: boolean) => setConfirmKeys((prev) => ({ ...prev, [x.key]: checked }))}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-white">{x.title}</div>
            {x.subtitle ? <div className="mt-1 text-xs text-[#9a9a9a]">{x.subtitle}</div> : null}
          </div>
        </label>
      ))}
    </div>
  );

  const stepHint =
    currentStep === "SCOPE"
      ? "描述系统范围、边界与关键名词"
      : currentStep === "OBJECTS"
        ? "描述核心实体/单据/主数据与关键字段"
        : currentStep === "SCENARIOS"
          ? "基于当前本体生成场景金字塔并选择关键场景"
          : "描述业务流程、状态节点与关键动作（含事件）";

  const primaryAction =
    currentStep === "SCOPE"
      ? { label: "生成范围建议", onClick: runScopeGen }
      : currentStep === "OBJECTS"
        ? { label: "生成对象计划", onClick: runObjectPlanGen }
        : currentStep === "SCENARIOS"
          ? { label: "生成业务场景", onClick: runScenarioGen }
          : { label: "生成动作计划", onClick: runActionPlanGen };

  const confirmAction =
    currentStep === "SCOPE"
      ? { label: next ? `确认并进入：${getStepTitle(next)}` : "确认", onClick: () => confirmStep(dbName, "SCOPE", []) }
      : currentStep === "OBJECTS"
        ? { label: next ? `确认并创建对象，进入：${getStepTitle(next)}` : "确认并创建对象", onClick: applyObjectPlan }
        : currentStep === "SCENARIOS"
          ? { label: next ? `确认场景选择，进入：${getStepTitle(next)}` : "确认", onClick: applyScenarioSelection }
          : { label: "确认并创建动作，完成引导", onClick: applyActionPlan };

  const confirmList =
    currentStep === "SCOPE"
      ? null
      : currentStep === "OBJECTS"
        ? (() => {
            const plan = (stepState.proposalJson as any)?.plan;
            const drafts = Array.isArray(plan?.objectTypes) ? plan.objectTypes : [];
            return renderConfirmList(
              drafts.map((ot: any) => {
                const key = String(ot?.id || ot?.apiName || ot?.displayName || "");
                return { key, title: `${String(ot?.apiName || "")}（${String(ot?.displayName || "")}）`, subtitle: String(ot?.description || "") || undefined };
              })
            );
          })()
        : currentStep === "SCENARIOS"
          ? (() => {
              const data = scenarioResult || stepState.proposalJson;
              const groups = Array.isArray(data?.pyramid?.groups) ? data.pyramid.groups : [];
              const rows: Array<{ key: string; title: string; subtitle?: string }> = [];
              for (const g of groups) {
                const scenarios = Array.isArray(g?.scenarios) ? g.scenarios : [];
                for (const s of scenarios) {
                  const key = String(s?.id || s?.name || "");
                  rows.push({ key, title: String(s?.name || ""), subtitle: String(g?.title || "") || undefined });
                }
              }
              return rows.length ? renderConfirmList(rows) : null;
            })()
          : (() => {
              const plan = (stepState.proposalJson as any)?.plan;
              const drafts = Array.isArray(plan?.actionTypes) ? plan.actionTypes : [];
              return renderConfirmList(
                drafts.map((at: any) => {
                  const key = String(at?.id || at?.apiName || at?.displayName || "");
                  return {
                    key,
                    title: `${String(at?.apiName || "")}（${String(at?.displayName || "")}）`,
                    subtitle: String(at?.description || "") || undefined,
                  };
                })
              );
            })();

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-3 border-b border-[#2d2d2d] bg-[#161614]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold text-white">新建项目引导</div>
              <Badge className={cn("text-[11px] border", headerBadgeTone)}>{getStepTitle(currentStep)}</Badge>
              <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d] text-[11px]">
                {neo4jProject?.displayName || dbName}
              </Badge>
            </div>
            <div className="mt-1 text-[11px] text-[#9a9a9a] truncate">{stepHint}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-xs text-[#a0a0a0] hover:text-white" onClick={() => closeRightPanel()}>
              关闭
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="bg-[#2d2d2d] text-[#e5e7eb] border border-[#3d3d3d] hover:bg-[#3a3a3a] text-xs"
            onClick={() => {
              if (isLocked) return;
              rollbackTo(dbName, currentStep);
            }}
            disabled={isStreaming}
          >
            回退重做本步
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-[#2d2d2d] text-[#e5e7eb] border border-[#3d3d3d] hover:bg-[#3a3a3a] text-xs"
            onClick={() => exitProjectOnboarding()}
            disabled={isStreaming}
          >
            退出引导
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            className="bg-[#5b8def] hover:bg-[#3d6bc7] text-white text-xs"
            onClick={() => primaryAction.onClick()}
            disabled={isLocked || isStreaming}
          >
            {isStreaming ? "生成中…" : primaryAction.label}
          </Button>
        </div>
        {error ? <div className="mt-2 text-xs text-red-400">{error}</div> : null}
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs text-[#a0a0a0] mb-2">输入</div>
              <Textarea
                value={inputText}
                onChange={(e) => setStepInput(dbName, currentStep, e.target.value)}
                placeholder={`用自然语言描述：${stepHint}`}
                className="min-h-[120px] bg-[#0d0d0d] border-[#2d2d2d] text-white"
                disabled={isLocked || isStreaming}
              />
            </div>

            {assistantText ? (
              <div className="rounded-md border border-[#2d2d2d] bg-[#0d0d0d] p-3">
                <div className="text-xs text-[#a0a0a0] mb-2">生成说明</div>
                <div className="prose prose-invert max-w-none prose-pre:bg-[#111111] prose-pre:border prose-pre:border-[#2d2d2d]">
                  <Streamdown plugins={{ mermaid, cjk }}>{assistantText}</Streamdown>
                </div>
              </div>
            ) : null}

            {currentStep === "SCOPE" && scopeResult ? (
              <div className="rounded-md border border-[#2d2d2d] bg-[#0d0d0d] p-3 space-y-3">
                <div className="text-xs text-[#a0a0a0]">范围结果</div>
                <div className="text-sm text-white">{scopeResult.scopeSummary || "—"}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-[#9a9a9a] mb-1">In Scope</div>
                    <div className="space-y-1">
                      {(scopeResult.inScope || []).slice(0, 12).map((x, idx) => (
                        <div key={`in-${idx}`} className="text-xs text-[#e5e7eb]">
                          - {x}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#9a9a9a] mb-1">Out of Scope</div>
                    <div className="space-y-1">
                      {(scopeResult.outOfScope || []).slice(0, 12).map((x, idx) => (
                        <div key={`out-${idx}`} className="text-xs text-[#e5e7eb]">
                          - {x}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {(scopeResult.openQuestions || []).length ? (
                  <div>
                    <div className="text-[11px] text-[#9a9a9a] mb-1">待确认问题</div>
                    <div className="space-y-1">
                      {(scopeResult.openQuestions || []).slice(0, 10).map((x, idx) => (
                        <div key={`q-${idx}`} className="text-xs text-[#e5e7eb]">
                          - {x}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {confirmList ? (
              <div>
                <div className="text-xs text-[#a0a0a0] mb-2">确认落地</div>
                {confirmList}
              </div>
            ) : null}

            <div className="pt-2">
              <Button
                className="w-full bg-[#10B981] hover:bg-[#059669] text-white"
                onClick={() => confirmAction.onClick()}
                disabled={!canConfirm || isStreaming}
              >
                {confirmAction.label}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
