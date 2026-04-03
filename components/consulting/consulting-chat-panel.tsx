"use client";

import React from "react";
import { Bot, User, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useConsultingStore, useOntologyStore, useSelectionStore } from "@/stores";
import { ChangeConfirmDialog, type ChangeConfirmSection } from "@/components/consulting/change-confirm-dialog";
import { toPascalCase } from "@/lib/utils";
import type { Cardinality } from "@/lib/types/ontology";

interface Message {
  role: "user" | "assistant";
  content: string;
}

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

function normalizeEntityScale(value: any): "S" | "M" | "L" | "XL" | null {
  if (value === "S" || value === "M" || value === "L" || value === "XL") return value;
  return null;
}

function normalizeCardinality(value: any): Cardinality {
  if (value === "ONE_TO_ONE" || value === "ONE_TO_MANY" || value === "MANY_TO_ONE" || value === "MANY_TO_MANY") return value;
  return "ONE_TO_ONE";
}

function uniquePascalCase(base: string, used: Set<string>) {
  let next = base;
  let i = 2;
  while (used.has(next) || !next) {
    next = `${base}${i}`;
    i += 1;
  }
  used.add(next);
  return next;
}

export function ConsultingChatPanel() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmSections, setConfirmSections] = React.useState<ChangeConfirmSection[]>([]);
  const confirmActionsRef = React.useRef<Map<string, () => Promise<void> | void>>(new Map());
  const createdObjectTypeByNameRef = React.useRef<Map<string, string>>(new Map());

  const { domains, selectedDomainId, addDomain, updateDomain, toggleEntityInDomain, setEntityScale, selectDomain } = useConsultingStore();
  const domain = React.useMemo(() => domains.find((d) => d.id === selectedDomainId) || null, [domains, selectedDomainId]);
  const { objectTypes, linkTypes, actionTypes, dataFlows, businessRules, aiModels, analysisInsights, scenario, addObjectType, addLinkType } =
    useOntologyStore();
  const { selectedObjectTypeId, selectedLinkTypeId } = useSelectionStore();

  const context = React.useMemo(() => {
    const domainObjectTypeIds = domain?.objectTypeIds || [];
    const objectTypeSubset = domainObjectTypeIds.length > 0 ? objectTypes.filter((o) => domainObjectTypeIds.includes(o.id)) : objectTypes;
    const linkTypeSubset =
      domainObjectTypeIds.length > 0
        ? linkTypes.filter((l) => domainObjectTypeIds.includes(l.sourceTypeId) || domainObjectTypeIds.includes(l.targetTypeId))
        : linkTypes;

    return {
      scenario,
      domain: domain
        ? {
            id: domain.id,
            name: domain.name,
            description: domain.description,
            objectTypeIds: domain.objectTypeIds,
            entityScales: domain.entityScales,
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

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/consulting-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          context,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = data?.detail ? `\n${data.detail}` : "";
        throw new Error((data?.error || "请求失败") + detail);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data?.reply || "（空响应）" }]);

      const plan = typeof data?.reply === "string" ? extractFirstJsonCodeBlock(data.reply) : null;
      if (plan) {
        const usedObjectApiNames = new Set(objectTypes.map((o) => o.apiName));
        const usedLinkApiNames = new Set(linkTypes.map((l) => l.apiName));
        const actions = new Map<string, () => Promise<void> | void>();
        const sections: ChangeConfirmSection[] = [];
        createdObjectTypeByNameRef.current = new Map();

        const ensureObjectTypeId = (entity: any) => {
          const displayName = (entity?.displayName || entity?.name || entity?.title || "").toString().trim();
          const description = (entity?.description || "").toString().trim() || undefined;
          const explicitId = (entity?.objectTypeId || entity?.existingObjectTypeId || entity?.id || "").toString().trim();
          if (explicitId && objectTypes.some((o) => o.id === explicitId)) return explicitId;

          if (!displayName) return null;
          const cached = createdObjectTypeByNameRef.current.get(displayName);
          if (cached) return cached;

          const existingByName = objectTypes.find((o) => o.displayName === displayName);
          if (existingByName) return existingByName.id;

          const base = toPascalCase(displayName);
          const apiName = uniquePascalCase(base, usedObjectApiNames);
          const ot = addObjectType({
            displayName,
            apiName,
            description,
            visibility: "PROJECT",
            primaryKey: "",
            titleKey: "",
            properties: [],
            layer: "SEMANTIC",
          });
          createdObjectTypeByNameRef.current.set(displayName, ot.id);
          return ot.id;
        };

        const proposedDomains: any[] = Array.isArray(plan?.proposedDomains) ? plan.proposedDomains : [];
        if (proposedDomains.length) {
          const items = proposedDomains.map((d, idx) => {
            const name = (d?.name || `业务域 ${idx + 1}`).toString().trim();
            const id = `domain:${idx}:${name}`;
            const description = (d?.description || "").toString().trim() || undefined;
            const entities = Array.isArray(d?.entities) ? d.entities : Array.isArray(d?.objectTypes) ? d.objectTypes : [];

            actions.set(id, async () => {
              const domainId = addDomain(name);
              if (description) updateDomain(domainId, { description });

              for (const e of entities) {
                const otId = ensureObjectTypeId(e);
                if (!otId) continue;
                toggleEntityInDomain(domainId, otId);
                const scale = normalizeEntityScale(e?.scale) || normalizeEntityScale(e?.entityScale);
                if (scale) setEntityScale(domainId, otId, scale);
              }

              selectDomain(domainId);
            });

            const entityCount = entities.length;
            return {
              id,
              title: name,
              description: [description, entityCount ? `包含实体：${entityCount} 个` : ""].filter(Boolean).join("\n") || undefined,
              tone: "create" as const,
              defaultSelected: true,
            };
          });

          sections.push({
            key: "domains",
            title: "业务域（将创建到规划面板）",
            description: "勾选后会创建业务域，并将实体加入该业务域（必要时补齐实体类型）。",
            items,
          });
        }

        const entityScaleAdjustments = plan?.entityScaleAdjustments;
        const scaleItemsRaw: any[] = Array.isArray(entityScaleAdjustments)
          ? entityScaleAdjustments
          : entityScaleAdjustments && typeof entityScaleAdjustments === "object"
            ? Object.entries(entityScaleAdjustments).map(([k, v]) => ({ objectTypeId: k, scale: v }))
            : [];

        if (scaleItemsRaw.length) {
          const items = scaleItemsRaw.map((x, idx) => {
            const objectTypeId = (x?.objectTypeId || x?.id || "").toString().trim();
            const scale = normalizeEntityScale(x?.scale);
            const name =
              objectTypeId && objectTypes.some((o) => o.id === objectTypeId)
                ? objectTypes.find((o) => o.id === objectTypeId)?.displayName || objectTypeId
                : (x?.displayName || x?.name || objectTypeId || `调整 ${idx + 1}`).toString().trim();
            const id = `scale:${idx}:${objectTypeId || name}`;
            const reason = (x?.reason || "").toString().trim() || undefined;
            const disabled = !selectedDomainId || !objectTypeId || !scale;

            if (!disabled) {
              actions.set(id, async () => {
                setEntityScale(selectedDomainId!, objectTypeId, scale);
              });
            }

            return {
              id,
              title: `${name} → ${scale || "（缺少规模）"}`,
              description: reason,
              tone: disabled ? ("warn" as const) : ("update" as const),
              defaultSelected: !disabled,
              disabled,
            };
          });

          sections.push({
            key: "scales",
            title: "规模调整（当前选中业务域）",
            description: selectedDomainId ? "勾选后会更新当前选中业务域的实体规模。" : "需要先选中一个业务域才能应用规模调整。",
            items,
          });
        }

        const missingEntities = Array.isArray(plan?.missingEntities) ? plan.missingEntities : [];
        if (missingEntities.length) {
          const items = missingEntities.map((e: any, idx: number) => {
            const displayName = (typeof e === "string" ? e : e?.displayName || e?.name || e?.title || `实体 ${idx + 1}`).toString().trim();
            const description = typeof e === "string" ? undefined : (e?.description || "").toString().trim() || undefined;
            const id = `entity:${idx}:${displayName}`;

            actions.set(id, async () => {
              ensureObjectTypeId({ displayName, description });
            });

            return {
              id,
              title: displayName,
              description,
              tone: "create" as const,
              defaultSelected: true,
            };
          });

          sections.push({
            key: "entities",
            title: "缺失实体（将创建到本体）",
            description: "勾选后会创建对象类型（ObjectType）。你可以之后再补充属性与规则。",
            items,
          });
        }

        const missingLinks = Array.isArray(plan?.missingLinks) ? plan.missingLinks : [];
        if (missingLinks.length) {
          const items = missingLinks.map((l: any, idx: number) => {
            const label = (typeof l === "string" ? l : l?.displayName || l?.label || l?.name || `关系 ${idx + 1}`).toString().trim();
            const source = typeof l === "string" ? null : l?.source || l?.sourceTypeId || l?.from;
            const target = typeof l === "string" ? null : l?.target || l?.targetTypeId || l?.to;
            const card = normalizeCardinality(typeof l === "string" ? null : l?.cardinality);
            const id = `link:${idx}:${label}`;
            const disabled = !source || !target;

            if (!disabled) {
              actions.set(id, async () => {
                const sourceId = typeof source === "string" ? ensureObjectTypeId({ objectTypeId: source, displayName: source }) : null;
                const targetId = typeof target === "string" ? ensureObjectTypeId({ objectTypeId: target, displayName: target }) : null;
                if (!sourceId || !targetId) return;
                const apiName = uniquePascalCase(toPascalCase(label), usedLinkApiNames);
                addLinkType({
                  apiName,
                  displayName: label,
                  description: typeof l === "string" ? "" : (l?.description || "").toString(),
                  sourceTypeId: sourceId,
                  targetTypeId: targetId,
                  cardinality: card,
                  foreignKeyPropertyId: "",
                  properties: [],
                  visibility: "PROJECT",
                  layer: "SEMANTIC",
                });
              });
            }

            const descParts: string[] = [];
            if (typeof l !== "string") {
              const s = (l?.sourceDisplayName || l?.sourceName || "").toString().trim();
              const t = (l?.targetDisplayName || l?.targetName || "").toString().trim();
              if (s || t) descParts.push([s, t].filter(Boolean).join(" → "));
              if (l?.cardinality) descParts.push(`基数：${l.cardinality}`);
              const d = (l?.description || "").toString().trim();
              if (d) descParts.push(d);
            }

            return {
              id,
              title: label,
              description: descParts.join("\n") || (disabled ? "缺少 source/target，无法自动创建" : undefined),
              tone: disabled ? ("warn" as const) : ("create" as const),
              defaultSelected: !disabled,
              disabled,
            };
          });

          sections.push({
            key: "links",
            title: "缺失关系（将创建到本体）",
            description: "勾选后会创建关系类型（LinkType）。foreignKeyPropertyId 默认留空，后续可补齐映射。",
            items,
          });
        }

        const nextQuestions = Array.isArray(plan?.nextQuestions) ? plan.nextQuestions : [];
        if (nextQuestions.length) {
          const items = nextQuestions.map((q: any, idx: number) => ({
            id: `q:${idx}:${q}`,
            title: (q || `问题 ${idx + 1}`).toString(),
            tone: "neutral" as const,
            defaultSelected: false,
            disabled: true,
          }));
          sections.push({
            key: "questions",
            title: "建议追问（仅预览）",
            description: "这些问题不会自动写入，仅用于继续对话推进。",
            items,
          });
        }

        if (sections.length) {
          confirmActionsRef.current = actions;
          setConfirmSections(sections);
          setConfirmOpen(true);
        }
      }
    } catch (error: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: error?.message || "抱歉，生成失败，请重试。" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const title = domain?.name ? `AI 咨询 · ${domain.name}` : "AI 咨询";

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-[#e0e0e0]">
      <ChangeConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认规划变更"
        description="AI 已给出可落地的规划建议。勾选你希望生效的变更，系统将自动创建/更新对应资产。"
        sections={confirmSections}
        onConfirm={async (selectedIds) => {
          const actionMap = confirmActionsRef.current;
          const ordered = confirmSections.flatMap((s) => s.items.map((i) => i.id)).filter((id) => selectedIds.includes(id));
          for (const id of ordered) {
            const fn = actionMap.get(id);
            if (fn) await fn();
          }
          setMessages((prev) => [...prev, { role: "assistant", content: `已应用 ${ordered.length} 项变更。` }]);
        }}
      />
      <div className="flex-none p-4 border-b border-[#2d2d2d] bg-[#161614]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#8B5CF6]" />
              {title}
            </h2>
            <p className="text-[11px] text-[#808080] mt-1">基于当前本体与业务域上下文，持续讨论边界、规模与缺口</p>
          </div>
          {domain && (
            <Badge className="text-[10px] bg-[#8B5CF6]/20 text-[#c4b5fd] border-0">{domain.objectTypeIds.length} 实体</Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center text-[#6b6b6b] text-sm mt-10">
              你可以问：“这个业务域的边界是什么？”、“哪些实体规模应该是 L？”、“还缺哪些关键关系？”。
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user" ? "bg-[#2563EB] text-white" : "bg-[#8B5CF6] text-white"
                }`}
              >
                {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div
                className={`max-w-[86%] p-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-[#2563EB]/20 border border-[#2563EB]/30 text-white"
                    : "bg-[#141414] border border-[#2d2d2d] text-[#d0d0d0]"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="p-3 rounded-lg bg-[#141414] border border-[#2d2d2d] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#8B5CF6]" />
                <span className="text-sm text-[#808080]">正在思考...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex-none p-4 border-t border-[#2d2d2d] bg-[#161614]">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={domain ? "输入问题，继续追问或补充约束..." : "先选择/创建业务域，再开始咨询..."}
            className="flex-1 bg-[#0d0d0d] border-[#3d3d3d] text-white placeholder:text-[#6b6b6b]"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
