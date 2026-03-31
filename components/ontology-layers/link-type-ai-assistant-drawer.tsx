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
import { cn, generateId, isPascalCase, toPascalCase } from "@/lib/utils";
import type { Cardinality, LinkType, ObjectType } from "@/lib/types/ontology";

type Step = 1 | 2 | 3;

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type SuggestedLink = {
  apiName: string;
  displayName: string;
  sourceObjectTypeApiName: string;
  targetObjectTypeApiName: string;
  cardinality: Cardinality | string;
  reason?: string;
};

type SuggestedResult = {
  links: SuggestedLink[];
  questions: string[];
};

type PlanLinkType = {
  displayName: string;
  apiName: string;
  description?: string;
  sourceObjectTypeApiName: string;
  targetObjectTypeApiName: string;
  cardinality: Cardinality | string;
};

type PlanResult = {
  linkTypes: Array<PlanLinkType & { id: string; enabled: boolean }>;
};

const STEP1_INTRO = `## AI 辅助生成：关系类型（第 1/3 步）

我会基于你当前画布中的 **实体类型（ObjectType）**，结合你的业务描述，推导可能存在的 **关系类型（LinkType）**（包括 source/target 与基数），并在你确认后批量创建。

请描述：
- 业务场景与范围（包含/不包含）
- 关键对象之间的“归属/包含/关联/引用/依赖”关系
- 是否存在多对多（是否需要中间对象）

示例（可复制修改）：
> 采购申请 PR 属于一个部门，PR 包含多条物料明细；PR 审批通过后生成采购订单 PO，PO 关联供应商，PO 也包含多条明细；收货入库 GR 关联 PO，并记录到货仓库。
`;

const CARDINALITIES: Cardinality[] = ["ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"];

function normalizeCardinality(value: string): Cardinality {
  const upper = String(value || "").toUpperCase();
  if ((CARDINALITIES as string[]).includes(upper)) return upper as Cardinality;
  return "ONE_TO_MANY";
}

function normalizeLinkApiName(name: string) {
  if (isPascalCase(name)) return name;
  return toPascalCase(name);
}

function uniquePascalCase(base: string, used: Set<string>) {
  let name = normalizeLinkApiName(base);
  if (!name) name = "Link";
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

export function LinkTypeAIAssistantDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { objectTypes, linkTypes, addLinkType } = useOntologyStore();
  const { selectLinkType } = useSelectionStore();
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
    const existingLinkTypes = linkTypes.map((lt: LinkType) => ({ apiName: lt.apiName, displayName: lt.displayName }));

    try {
      const payload: any = { step: targetStep, input, existingObjectTypes, existingLinkTypes };
      if (targetStep === 3 && suggested?.links) {
        payload.suggestedContext = suggested.links;
      }

      const res = await fetch("/api/link-type-gen/stream", {
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
          const raw = event.plan?.linkTypes || [];
          const next: PlanResult = {
            linkTypes: raw.map((x: any) => ({
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
    appendUser("我确认目前信息足够，请直接生成关系类型。");
    await streamStep(3, lastUser);
  };

  const togglePlannedLinkType = (id: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        linkTypes: prev.linkTypes.map((lt) => (lt.id === id ? { ...lt, enabled: !lt.enabled } : lt)),
      };
    });
  };

  const setAllPlannedLinkTypes = (enabled: boolean) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        linkTypes: prev.linkTypes.map((lt) => ({ ...lt, enabled })),
      };
    });
  };

  const createFromPlan = () => {
    const selectedDrafts = (plan?.linkTypes || []).filter((lt) => lt.enabled);
    if (!selectedDrafts.length) return;

    const objectIdByApiName = new Map(objectTypes.map((ot) => [ot.apiName, ot.id]));
    const usedLinkApiNames = new Set(linkTypes.map((lt) => lt.apiName));

    const created: LinkType[] = [];
    const renamed: string[] = [];
    const skipped: string[] = [];

    for (const draftLt of selectedDrafts) {
      const sourceId = objectIdByApiName.get(String(draftLt.sourceObjectTypeApiName || "").trim());
      const targetId = objectIdByApiName.get(String(draftLt.targetObjectTypeApiName || "").trim());
      if (!sourceId || !targetId) {
        skipped.push(`${draftLt.apiName || draftLt.displayName}`);
        continue;
      }

      const baseApiName = draftLt.apiName || draftLt.displayName;
      const normalizedBase = normalizeLinkApiName(baseApiName);
      const apiName = uniquePascalCase(baseApiName, usedLinkApiNames);
      if (normalizedBase !== apiName) renamed.push(`${normalizedBase} → ${apiName}`);

      const newLt = addLinkType({
        apiName,
        displayName: draftLt.displayName || apiName,
        description: draftLt.description,
        sourceTypeId: sourceId,
        targetTypeId: targetId,
        cardinality: normalizeCardinality(String(draftLt.cardinality)),
        foreignKeyPropertyId: "",
        properties: [],
        visibility: "PROJECT",
        layer: "SEMANTIC",
      });
      created.push(newLt);
    }

    if (created[0]?.id) {
      selectLinkType(created[0].id);
      openRightPanel();
    }

    const parts: string[] = [];
    if (created.length) parts.push(`已创建：${created.map((x) => x.apiName).join(", ")}`);
    if (renamed.length) parts.push(`已自动去重命名：${renamed.join("；")}`);
    if (skipped.length) parts.push(`已跳过（缺少对象类型）：${skipped.join(", ")}`);
    setCreateResult(parts.join("；"));
  };

  const plannedTotalCount = plan?.linkTypes?.length || 0;
  const plannedSelectedCount = plan?.linkTypes?.filter((lt) => lt.enabled).length || 0;
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
              <h3 className="text-sm font-semibold text-white">AI 辅助生成 · 关系类型</h3>
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
              {step === 3 && plan?.linkTypes?.length ? (
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
              {suggested?.links?.length ? (
                <Badge className="text-[11px] border-0 bg-[#3B82F6]/20 text-[#3B82F6]">
                  推导关系：{suggested.links.length}
                </Badge>
              ) : null}
              {plan?.linkTypes?.length ? (
                <Badge className="text-[11px] border-0 bg-[#8B5CF6]/20 text-[#8B5CF6]">
                  计划关系：{plan.linkTypes.length}
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
                placeholder={step === 1 ? "描述你的业务对象关系…" : step === 2 ? "补充遗漏关系或确认基数…" : "已生成，可在确认框中创建"}
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
                本次计划生成的关系类型（LinkType）
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
                    onClick={() => setAllPlannedLinkTypes(true)}
                    disabled={!plannedTotalCount}
                  >
                    全选
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[#2d2d2d] text-[#a0a0a0]"
                    onClick={() => setAllPlannedLinkTypes(false)}
                    disabled={!plannedTotalCount}
                  >
                    全不选
                  </Button>
                </div>

                {(plan?.linkTypes || []).map((lt) => (
                  <div
                    key={lt.id}
                    className={cn(
                      "rounded-md border bg-[#0d0d0d] p-3",
                      lt.enabled ? "border-[#2d2d2d]" : "border-[#2d2d2d] opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{lt.displayName}</div>
                        <div className="text-xs text-[#6b6b6b] font-mono truncate">
                          {normalizeLinkApiName(lt.apiName || lt.displayName)}
                        </div>
                        <div className="text-[11px] text-[#6b6b6b] font-mono mt-1 truncate">
                          {lt.sourceObjectTypeApiName} → {lt.targetObjectTypeApiName} · {normalizeCardinality(String(lt.cardinality))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                          onClick={() => togglePlannedLinkType(lt.id)}
                        >
                          {lt.enabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#10B981]" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 mr-1 text-[#6b6b6b]" />
                          )}
                          纳入创建
                        </Button>
                      </div>
                    </div>
                    {lt.description ? <div className="mt-2 text-xs text-[#a0a0a0]">{lt.description}</div> : null}
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

