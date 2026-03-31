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
import {
  cn,
  generateId,
  getBaseTypeDisplayName,
  isCamelCase,
  isPascalCase,
  toCamelCase,
  toPascalCase,
} from "@/lib/utils";
import type { ActionType, ObjectType, Property, PropertyBaseType } from "@/lib/types/ontology";

type Step = 1 | 2 | 3;

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type SuggestedAction = {
  apiName: string;
  displayName: string;
  crud: "CREATE" | "READ" | "UPDATE" | "DELETE" | "OTHER" | string;
  targetObjectTypeApiName?: string;
  reason?: string;
};

type SuggestedResult = {
  actions: SuggestedAction[];
  questions: string[];
};

type PlanProperty = {
  displayName: string;
  apiName: string;
  baseType: PropertyBaseType | string;
  required: boolean;
  description?: string;
};

type PlanActionType = {
  displayName: string;
  apiName: string;
  description?: string;
  affectedObjectTypeApiNames?: string[];
  inputParameters?: PlanProperty[];
  outputProperties?: PlanProperty[];
};

type PlanResult = {
  actionTypes: Array<PlanActionType & { id: string; enabled: boolean }>;
};

const STEP1_INTRO = `## AI 辅助生成：操作类型（第 1/3 步）

目标：为你的业务流程快速生成 **CRUD 动作**（Create/Update/Delete/Get/List 等），并预测你可能遗漏的业务动作（例如：Submit/Approve/Cancel/Close/Reopen）。

请尽量包含这些信息：
- **对象范围**：涉及哪些实体（例如：采购申请、采购订单、供应商、收货入库）
- **主流程**：从开始到结束的关键步骤
- **状态节点**：对象状态如何变化（草稿/提交/审批中/已通过/已驳回…）
- **关键输入/输出**：动作需要哪些输入？希望返回哪些字段？
- **权限/校验/审批**：哪些动作需要规则或审批？

示例（可复制修改）：
> 我在做 ERP 采购：采购申请（PR）提交后进入审批，审批通过可生成采购订单（PO），到货后收货入库（GR）。PR/PO/GR 都有编号，状态有 草稿/已提交/审批中/已通过/已驳回/已关闭。需要：创建/修改/查询/删除（草稿才可删）、提交、审批、驳回、生成 PO、收货入库。
`;

const ALLOWED_BASE_TYPES: PropertyBaseType[] = ["STRING", "INTEGER", "DOUBLE", "BOOLEAN", "TIMESTAMP", "STRUCT"];

function normalizeActionApiName(name: string) {
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
  let name = normalizeActionApiName(base);
  if (!name) name = "Action";
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

export function ActionTypeAIAssistantDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { objectTypes, actionTypes, addActionType } = useOntologyStore();
  const { selectActionType } = useSelectionStore();
  const { openRightPanel } = useUIStore();

  const [step, setStep] = React.useState<Step>(1);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [followEnabled, setFollowEnabled] = React.useState(true);
  const [suggested, setSuggested] = React.useState<SuggestedResult | null>(null);
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
    setSuggested(null);
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

    const existingObjectTypes = objectTypes.map((ot: ObjectType) => ({ apiName: ot.apiName, displayName: ot.displayName }));
    const existingActionTypes = actionTypes.map((at: ActionType) => ({ apiName: at.apiName, displayName: at.displayName }));

    try {
      const payload: any = { step: targetStep, input, existingObjectTypes, existingActionTypes };
      if (targetStep === 3 && suggested?.actions) {
        payload.suggestedContext = suggested.actions;
      }

      const res = await fetch("/api/action-type-gen/stream", {
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
        if (event?.type === "suggested_result") {
          setSuggested(event.suggested || null);
          setStep(2);
        }
        if (event?.type === "plan_result") {
          const raw = event.plan?.actionTypes || [];
          const next: PlanResult = {
            actionTypes: raw.map((x: any) => ({
              ...x,
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
    appendUser("我确认目前信息足够，请直接生成 ActionType。");
    await streamStep(3, lastUser);
  };

  const togglePlannedActionType = (id: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        actionTypes: prev.actionTypes.map((at) => (at.id === id ? { ...at, enabled: !at.enabled } : at)),
      };
    });
  };

  const setAllPlannedActionTypes = (enabled: boolean) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        actionTypes: prev.actionTypes.map((at) => ({ ...at, enabled })),
      };
    });
  };

  const createFromPlan = () => {
    const selectedDrafts = (plan?.actionTypes || []).filter((at) => at.enabled);
    if (!selectedDrafts.length) return;

    const objectIdByApiName = new Map(objectTypes.map((ot) => [ot.apiName, ot.id]));
    const usedActionApiNames = new Set(actionTypes.map((at) => at.apiName));

    const created: ActionType[] = [];
    const renamed: string[] = [];

    for (const draftAt of selectedDrafts) {
      const baseApiName = draftAt.apiName || draftAt.displayName;
      const normalizedBase = normalizeActionApiName(baseApiName);
      const apiName = uniquePascalCase(baseApiName, usedActionApiNames);
      if (normalizedBase !== apiName) renamed.push(`${normalizedBase} → ${apiName}`);

      const usedInputApiNames = new Set<string>();
      const usedOutputApiNames = new Set<string>();

      const inputParameters: Property[] = (draftAt.inputParameters || []).map((p) => {
        const raw = p.apiName || p.displayName;
        const propApiName = uniqueCamelCase(raw, usedInputApiNames);
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

      const outputProperties: Property[] = (draftAt.outputProperties || []).map((p) => {
        const raw = p.apiName || p.displayName;
        const propApiName = uniqueCamelCase(raw, usedOutputApiNames);
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

      const affectedObjectTypeIds =
        (draftAt.affectedObjectTypeApiNames || [])
          .map((n) => String(n || "").trim())
          .map((n) => objectIdByApiName.get(n))
          .filter(Boolean) as string[];

      const newAt = addActionType({
        displayName: draftAt.displayName || apiName,
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

    if (created[0]?.id) {
      selectActionType(created[0].id);
      openRightPanel();
    }

    const parts: string[] = [];
    if (created.length) parts.push(`已创建：${created.map((x) => x.apiName).join(", ")}`);
    if (renamed.length) parts.push(`已自动去重命名：${renamed.join("；")}`);
    setCreateResult(parts.join("；"));
  };

  const plannedTotalCount = plan?.actionTypes?.length || 0;
  const plannedSelectedCount = plan?.actionTypes?.filter((at) => at.enabled).length || 0;
  const stepLabel = step === 1 ? "第 1/3 步" : step === 2 ? "第 2/3 步" : "第 3/3 步";

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
              <h3 className="text-sm font-semibold text-white">AI 辅助生成 · 操作类型</h3>
              <Badge className="text-[11px] border-0 bg-[#3b3b3b] text-[#d0d0d0]">{stepLabel}</Badge>
              <span className="text-[11px] text-[#a0a0a0]">跟随</span>
              <Switch checked={followEnabled} onCheckedChange={setFollowEnabled} />
            </div>
            <div className="flex items-center gap-2">
              {step === 2 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-[#2d2d2d] text-[#a0a0a0]"
                  onClick={handleGenerateWithoutMore}
                  disabled={isStreaming}
                >
                  直接生成
                </Button>
              ) : null}
              {step === 3 && plan?.actionTypes?.length ? (
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
              <Badge
                className={cn(
                  "text-[11px] border-0",
                  isStreaming ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "bg-[#10B981]/20 text-[#10B981]"
                )}
              >
                {isStreaming ? "AI：生成中" : "AI：就绪"}
              </Badge>
              {suggested?.actions?.length ? (
                <Badge className="text-[11px] border-0 bg-[#3B82F6]/20 text-[#3B82F6]">
                  预测动作：{suggested.actions.length}
                </Badge>
              ) : null}
              {plan?.actionTypes?.length ? (
                <Badge className="text-[11px] border-0 bg-[#8B5CF6]/20 text-[#8B5CF6]">
                  计划动作：{plan.actionTypes.length}
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
                    m.role === "assistant" ? "bg-[#141414] border-[#2d2d2d]" : "bg-[#0f172a] border-[#1e293b]"
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
                placeholder={step === 1 ? "描述你的业务场景与流程…" : step === 2 ? "补充规则/状态/权限/审批…" : "已生成，可在确认框中创建"}
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
          <DialogContent className="sm:max-w-[760px] bg-[#161614] border-[#3d3d3d] text-white z-[100]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                本次计划生成的操作类型（ActionType）
                <Badge className="text-[11px] border-0 bg-[#3b3b3b] text-[#d0d0d0]">
                  已选 {plannedSelectedCount}/{plannedTotalCount}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-[#a0a0a0]">
                确认后将写入当前画布（本地数据）。如需调整，请关闭确认框并继续补充信息重新生成。
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[420px] pr-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[#2d2d2d] text-[#a0a0a0]"
                    onClick={() => setAllPlannedActionTypes(true)}
                    disabled={!plannedTotalCount}
                  >
                    全选
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[#2d2d2d] text-[#a0a0a0]"
                    onClick={() => setAllPlannedActionTypes(false)}
                    disabled={!plannedTotalCount}
                  >
                    全不选
                  </Button>
                </div>

                {(plan?.actionTypes || []).map((at) => (
                  <div
                    key={at.id}
                    className={cn(
                      "rounded-md border bg-[#0d0d0d] p-3",
                      at.enabled ? "border-[#2d2d2d]" : "border-[#2d2d2d] opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{at.displayName}</div>
                        <div className="text-xs text-[#6b6b6b] font-mono truncate">
                          {normalizeActionApiName(at.apiName || at.displayName)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[11px] border-0 bg-[#3B82F6]/20 text-[#3B82F6]">
                          入参 {at.inputParameters?.length || 0} / 出参 {at.outputProperties?.length || 0}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                          onClick={() => togglePlannedActionType(at.id)}
                        >
                          {at.enabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#10B981]" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 mr-1 text-[#6b6b6b]" />
                          )}
                          纳入创建
                        </Button>
                      </div>
                    </div>
                    {at.description ? <div className="mt-2 text-xs text-[#a0a0a0]">{at.description}</div> : null}

                    {at.affectedObjectTypeApiNames?.length ? (
                      <div className="mt-2 text-xs text-[#6b6b6b] font-mono">
                        影响对象：{at.affectedObjectTypeApiNames.join(", ")}
                      </div>
                    ) : null}

                    {(at.inputParameters?.length || at.outputProperties?.length) ? (
                      <div className="mt-3 space-y-2">
                        {at.inputParameters?.length ? (
                          <div>
                            <div className="text-[11px] text-[#a0a0a0] mb-1">输入参数</div>
                            <div className="space-y-1">
                              {(at.inputParameters || []).map((p) => {
                                const apiName = normalizePropertyApiName(p.apiName || p.displayName);
                                const typeLabel = getBaseTypeDisplayName(normalizeBaseType(String(p.baseType)));
                                return (
                                  <div
                                    key={`${at.id}-in-${apiName}`}
                                    className="flex items-center justify-between gap-3 text-xs border border-[#1f1f1f] bg-[#111111] rounded-md px-2 py-1.5"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-[#e5e7eb] truncate">
                                        {p.displayName}
                                        {p.required ? <span className="text-[#F59E0B] ml-1">*</span> : null}
                                      </div>
                                      <div className="text-[#6b6b6b] font-mono truncate">{apiName}</div>
                                    </div>
                                    <Badge className="text-[10px] border-0 bg-[#3b3b3b] text-[#d0d0d0]">{typeLabel}</Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {at.outputProperties?.length ? (
                          <div>
                            <div className="text-[11px] text-[#a0a0a0] mb-1">输出字段</div>
                            <div className="space-y-1">
                              {(at.outputProperties || []).map((p) => {
                                const apiName = normalizePropertyApiName(p.apiName || p.displayName);
                                const typeLabel = getBaseTypeDisplayName(normalizeBaseType(String(p.baseType)));
                                return (
                                  <div
                                    key={`${at.id}-out-${apiName}`}
                                    className="flex items-center justify-between gap-3 text-xs border border-[#1f1f1f] bg-[#111111] rounded-md px-2 py-1.5"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-[#e5e7eb] truncate">
                                        {p.displayName}
                                        {p.required ? <span className="text-[#F59E0B] ml-1">*</span> : null}
                                      </div>
                                      <div className="text-[#6b6b6b] font-mono truncate">{apiName}</div>
                                    </div>
                                    <Badge className="text-[10px] border-0 bg-[#3b3b3b] text-[#d0d0d0]">{typeLabel}</Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
                onClick={createFromPlan}
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

