"use client";

import React from "react";
import { Streamdown } from "streamdown";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import { Sparkles, Send, CheckCircle2, Circle } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOntologyStore } from "@/stores";
import { useSelectionStore } from "@/stores";
import { useUIStore } from "@/stores";
import { generateId, isCamelCase, isPascalCase, toCamelCase, toPascalCase, cn, getBaseTypeDisplayName } from "@/lib/utils";
import type { PropertyBaseType, Property, ObjectType } from "@/lib/types/ontology";
import { upsertMetaToNeo4jClient } from "@/lib/neo4j/client";
import type { MetaCore } from "@/lib/meta/meta-core";

type Step = 1 | 2 | 3;

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type MeceEntity = {
  name: string;
  displayName: string;
  description: string;
  boundaries: string;
};

type MeceResult = {
  entities: MeceEntity[];
  questions: string[];
};

type PlanProperty = {
  displayName: string;
  apiName: string;
  baseType: PropertyBaseType | string;
  required: boolean;
  description?: string;
};

type PlanObjectType = {
  displayName: string;
  apiName: string;
  description?: string;
  primaryKeyApiName?: string;
  titleKeyApiName?: string;
  properties: PlanProperty[];
};

type PlanResult = {
  objectTypes: Array<PlanObjectType & { id: string; enabled: boolean }>;
};

const STEP1_INTRO = `## AI 辅助生成：实体类型（第 1/3 步）

你可以用自然语言描述你要建模的业务域，我会帮你把对象类型与属性拆出来，并在确认后才真正写入画布。

请尽量包含这些信息（越具体越好）：
- **业务背景**：你在做什么系统/场景？
- **范围与边界**：包含什么，不包含什么？
- **关键对象**：你认为最重要的名词（人/物/单据/地点/组织/事件/状态）有哪些？
- **唯一标识**：哪些字段能唯一标识一个对象（如编号、条码、SKU）？
- **常用查询**：你希望经常按哪些条件查、筛选或统计？

示例（可复制修改）：
> 我在做一个 ERP 采购系统。范围包含采购申请、采购订单、供应商、收货入库；不包含财务结算。采购申请有编号、申请人、部门、物料明细、总金额、状态（草稿/提交/审批中/已通过/已驳回）。采购订单关联供应商与申请单，订单号唯一。收货入库按订单生成，记录入库单号、到货时间、仓库、实收数量。
`;

const ALLOWED_BASE_TYPES: PropertyBaseType[] = ["STRING", "INTEGER", "DOUBLE", "BOOLEAN", "TIMESTAMP", "STRUCT"];

function normalizeObjectTypeApiName(name: string) {
  if (isPascalCase(name)) return name;
  return toPascalCase(name);
}

function normalizePropertyApiName(name: string) {
  if (isCamelCase(name)) return name;
  return toCamelCase(name);
}

function normalizeBaseType(value: string): PropertyBaseType {
  const upper = String(value || "").toUpperCase();
  if ((ALLOWED_BASE_TYPES as string[]).includes(upper)) return upper as PropertyBaseType;
  return "STRING";
}

function uniquePascalCase(base: string, used: Set<string>) {
  let name = normalizeObjectTypeApiName(base);
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

async function readSSE(
  response: Response,
  onEvent: (event: any) => void
) {
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

export function EntityTypeAIAssistantDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { objectTypes, addObjectType, neo4jProject, scenario } = useOntologyStore();
  const { selectObjectType } = useSelectionStore();
  const { openRightPanel } = useUIStore();

  const [step, setStep] = React.useState<Step>(1);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [followEnabled, setFollowEnabled] = React.useState(true);
  const [mece, setMece] = React.useState<MeceResult | null>(null);
  const [plan, setPlan] = React.useState<PlanResult | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [createResult, setCreateResult] = React.useState<string>("");
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setDraft("");
    setError("");
    setIsStreaming(false);
    setFollowEnabled(true);
    setMece(null);
    setPlan(null);
    setConfirmOpen(false);
    setCreateResult("");
    setMessages([{ id: generateId(), role: "assistant", content: STEP1_INTRO }]);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (!followEnabled) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, followEnabled, messages, isStreaming]);

  const appendUser = (text: string) => {
    setMessages((prev) => [...prev, { id: generateId(), role: "user", content: text }]);
  };

  const appendAssistantPlaceholder = () => {
    const id = generateId();
    setMessages((prev) => [...prev, { id, role: "assistant", content: "" }]);
    return id;
  };

  const updateAssistant = (id: string, delta: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)));
  };

  const streamStep = async (targetStep: 2 | 3, input: string) => {
    setError("");
    setIsStreaming(true);
    const assistantId = appendAssistantPlaceholder();
    const existing = objectTypes.map((ot) => ({ apiName: ot.apiName, displayName: ot.displayName }));

    try {
      const payload: any = { step: targetStep, input, existingObjectTypes: existing };
      if (targetStep === 3 && mece?.entities) {
        payload.meceContext = mece.entities;
      }

      const res = await fetch("/api/object-type-gen/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "AI 接口失败");
      }

      await readSSE(res, (event) => {
        if (event?.type === "assistant_delta") {
          updateAssistant(assistantId, String(event.delta || ""));
        }
        if (event?.type === "mece_result") {
          setMece(event.mece || null);
          setStep(2);
        }
        if (event?.type === "plan_result") {
          const raw = event.plan?.objectTypes || [];
          const next: PlanResult = {
            objectTypes: raw.map((ot: any) => ({
              ...ot,
              id: generateId(),
              enabled: true,
            })),
          };
          setPlan(next);
          setStep(3);
          setConfirmOpen(true);
        }
        if (event?.type === "error") {
          setError(String(event.message || "AI 生成失败"));
        }
      });
    } catch (e: any) {
      setError(e?.message || "AI 生成失败");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    setDraft("");
    appendUser(text);
    if (step === 1) {
      await streamStep(2, text);
      return;
    }
    if (step === 2) {
      await streamStep(3, text);
      return;
    }
  };

  const handleGenerateWithoutMore = async () => {
    if (isStreaming) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    if (!lastUser.trim()) return;
    appendUser("我确认目前信息足够，请直接生成对象类型与属性。");
    await streamStep(3, lastUser);
  };

  const togglePlannedObjectType = (id: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        objectTypes: prev.objectTypes.map((ot) => (ot.id === id ? { ...ot, enabled: !ot.enabled } : ot)),
      };
    });
  };

  const setAllPlannedObjectTypes = (enabled: boolean) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        objectTypes: prev.objectTypes.map((ot) => ({ ...ot, enabled })),
      };
    });
  };

  const createFromPlan = async () => {
    const currentPlan = plan;
    const selectedDrafts = (currentPlan?.objectTypes || []).filter((ot) => ot.enabled);
    if (!selectedDrafts.length) return;
    const usedObjectApiNames = new Set(objectTypes.map((ot) => ot.apiName));
    const created: ObjectType[] = [];
    const renamed: string[] = [];

    for (const draftOt of selectedDrafts) {
      const baseApiName = draftOt.apiName || draftOt.displayName;
      const normalizedBase = normalizeObjectTypeApiName(baseApiName);
      const apiName = uniquePascalCase(baseApiName, usedObjectApiNames);
      if (normalizedBase !== apiName) {
        renamed.push(`${normalizedBase} → ${apiName}`);
      }

      const usedPropApiNames = new Set<string>();
      const props: Property[] = (draftOt.properties || []).map((p) => {
        const raw = p.apiName || p.displayName;
        const propApiName = uniqueCamelCase(raw, usedPropApiNames);
        return {
          id: generateId(),
          apiName: propApiName,
          displayName: p.displayName || propApiName,
          baseType: normalizeBaseType(String(p.baseType)),
          visibility: "NORMAL",
          required: Boolean(p.required),
          description: p.description,
        };
      });

      if (props.length === 0) {
        const idApi = uniqueCamelCase(draftOt.primaryKeyApiName || "id", usedPropApiNames);
        const nameApi = uniqueCamelCase(draftOt.titleKeyApiName || "name", usedPropApiNames);
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

      const pkApi = normalizePropertyApiName(draftOt.primaryKeyApiName || "id");
      const titleApi = normalizePropertyApiName(draftOt.titleKeyApiName || "name");
      const pkId = props.find((p) => p.apiName === pkApi)?.id || props[0]?.id || "";
      const titleId = props.find((p) => p.apiName === titleApi)?.id || props[0]?.id || "";

      const newOt = addObjectType({
        displayName: draftOt.displayName || apiName,
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

    if (created[0]?.id) {
      selectObjectType(created[0].id);
      openRightPanel();
    }

    const parts: string[] = [];
    if (created.length) parts.push(`已创建：${created.map((x) => x.apiName).join(", ")}`);
    if (renamed.length) parts.push(`已自动去重命名：${renamed.join("；")}`);
    setCreateResult(parts.join("；"));
  };

  const stepLabel = step === 1 ? "第 1/3 步" : step === 2 ? "第 2/3 步" : "第 3/3 步";
  const plannedTotalCount = plan?.objectTypes?.length || 0;
  const plannedSelectedCount = plan?.objectTypes?.filter((ot) => ot.enabled).length || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} showOverlay={false}>
      <SheetContent
        side="right"
        showClose
        onOpenChange={onOpenChange}
        className="z-[60] w-[560px] sm:w-[620px] bg-[#0d0d0d] border-[#2d2d2d] p-0"
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-[#2d2d2d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
              <h3 className="text-sm font-semibold text-white">AI 辅助生成 · 实体类型</h3>
              <Badge className="text-[11px] border-0 bg-[#3b3b3b] text-[#d0d0d0]">{stepLabel}</Badge>
              <span className="text-[11px] text-[#a0a0a0]">跟随</span>
              <Switch checked={followEnabled} onCheckedChange={setFollowEnabled} />
            </div>
            <div className="flex items-center gap-2">
              {step === 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-[#2d2d2d] text-[#a0a0a0]"
                  onClick={handleGenerateWithoutMore}
                  disabled={isStreaming}
                >
                  直接生成
                </Button>
              )}
              {step === 3 && plan?.objectTypes?.length ? (
                <Button
                  size="sm"
                  className="h-8 bg-[#10B981] hover:bg-[#059669] text-white"
                  onClick={() => setConfirmOpen(true)}
                >
                  查看确认框
                </Button>
              ) : null}
            </div>
          </div>

          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-[11px] border-0", isStreaming ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "bg-[#10B981]/20 text-[#10B981]")}>
                {isStreaming ? "AI：生成中" : "AI：就绪"}
              </Badge>
              {mece?.entities?.length ? (
                <Badge className="text-[11px] border-0 bg-[#3B82F6]/20 text-[#3B82F6]">
                  MECE 对象：{mece.entities.length}
                </Badge>
              ) : null}
              {plan?.objectTypes?.length ? (
                <Badge className="text-[11px] border-0 bg-[#8B5CF6]/20 text-[#8B5CF6]">
                  计划对象：{plan.objectTypes.length}
                </Badge>
              ) : null}
            </div>
          </div>

          <ScrollArea className="flex-1 mt-3">
            <div className="px-4 pb-6 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "p-3 rounded-md border w-full max-w-full overflow-hidden",
                    m.role === "assistant"
                      ? "bg-[#141414] border-[#2d2d2d]"
                      : "bg-[#0f172a] border-[#1e293b]"
                  )}
                >
                  <Streamdown
                    isAnimating={isStreaming && m.role === "assistant"}
                    className={cn(
                      "text-[13px] leading-relaxed prose prose-invert max-w-none w-full",
                      m.role === "assistant" ? "text-[#d8d8d8]" : "text-[#e5e7eb]"
                    )}
                    plugins={{ mermaid, cjk }}
                  >
                    {m.content || (m.role === "assistant" && isStreaming ? "AI 正在思考…" : "")}
                  </Streamdown>
                </div>
              ))}
              {error ? <p className="text-[12px] text-[#f87171]">{error}</p> : null}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-[#2d2d2d] p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder={step === 1 ? "描述你的业务域与范围…" : step === 2 ? "补充缺失信息或确认边界…" : "已生成，可在确认框中落库"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isStreaming || step === 3}
                className="h-9 bg-[#141414] border-[#2d2d2d] focus:border-[#8B5CF6] text-sm"
              />
              <Button
                size="sm"
                className="h-9 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                onClick={handleSend}
                disabled={step === 3 || isStreaming || !draft.trim()}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                发送
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-[720px] bg-[#161614] border-[#3d3d3d] text-white z-[100]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                本次计划生成的对象类型与属性
                <Badge className="text-[11px] border-0 bg-[#3b3b3b] text-[#d0d0d0]">
                  已选 {plannedSelectedCount}/{plannedTotalCount}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-[#a0a0a0]">
                确认后将写入当前画布（本地数据）。如需调整，请关闭确认框并继续补充信息重新生成。
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[380px] pr-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[#2d2d2d] text-[#a0a0a0]"
                    onClick={() => setAllPlannedObjectTypes(true)}
                    disabled={!plannedTotalCount}
                  >
                    全选
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[#2d2d2d] text-[#a0a0a0]"
                    onClick={() => setAllPlannedObjectTypes(false)}
                    disabled={!plannedTotalCount}
                  >
                    全不选
                  </Button>
                </div>

                {(plan?.objectTypes || []).map((ot) => (
                  <div
                    key={ot.id}
                    className={cn(
                      "rounded-md border bg-[#0d0d0d] p-3",
                      ot.enabled ? "border-[#2d2d2d]" : "border-[#2d2d2d] opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{ot.displayName}</div>
                        <div className="text-xs text-[#6b6b6b] font-mono">{normalizeObjectTypeApiName(ot.apiName || ot.displayName)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[11px] border-0 bg-[#3B82F6]/20 text-[#3B82F6]">
                          属性 {ot.properties?.length || 0}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                          onClick={() => togglePlannedObjectType(ot.id)}
                        >
                          {ot.enabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#10B981]" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 mr-1 text-[#6b6b6b]" />
                          )}
                          纳入创建
                        </Button>
                      </div>
                    </div>
                    {ot.description ? <div className="mt-2 text-xs text-[#a0a0a0]">{ot.description}</div> : null}
                    <div className="mt-3 space-y-1">
                      {(ot.properties || []).map((p) => {
                        const apiName = normalizePropertyApiName(p.apiName || p.displayName);
                        const typeLabel = getBaseTypeDisplayName(normalizeBaseType(String(p.baseType)));
                        return (
                          <div
                            key={`${ot.id}-${apiName}`}
                            className="flex items-center justify-between gap-3 text-xs border border-[#1f1f1f] bg-[#111111] rounded-md px-2 py-1.5"
                          >
                            <div className="min-w-0">
                              <div className="text-[#e5e7eb] truncate">
                                {p.displayName}
                                {p.required ? <span className="text-[#F59E0B] ml-1">*</span> : null}
                              </div>
                              <div className="text-[#6b6b6b] font-mono truncate">{apiName}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className="text-[10px] border-0 bg-[#3b3b3b] text-[#d0d0d0]">{typeLabel}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {createResult ? <div className="text-xs text-[#10B981]">{createResult}</div> : null}

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                className="bg-transparent border-[#3d3d3d] text-white hover:bg-[#2d2d2d]"
              >
                关闭
              </Button>
              <Button
                onClick={() => {
                  void createFromPlan();
                }}
                className="bg-[#10B981] hover:bg-[#059669] text-white"
                disabled={!plannedSelectedCount}
              >
                确认并创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
