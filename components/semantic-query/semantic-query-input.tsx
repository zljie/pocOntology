"use client";

import React, { useState, useCallback } from "react";
import { Streamdown } from "streamdown";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import {
  Search,
  Send,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  BookOpen,
  User,
  Calendar,
  Hash,
  Type,
  Lightbulb,
  Zap,
  Database,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  useOntologyStore,
  useSelectionStore,
  useUIStore,
} from "@/stores";
import { ObjectType, OntologyLayer, ONTOLOGY_LAYER_INFO } from "@/lib/types/ontology";
import { cn } from "@/lib/utils";
import { buildGraphqlTemplate } from "@/lib/semantic/graphql";

// 解析结果类型
interface ParsedEntity {
  type: "OBJECT_TYPE" | "LINK_TYPE" | "ACTION_TYPE" | "PROPERTY" | "VALUE";
  id?: string;
  name: string;
  displayName: string;
  confidence: number;
  matchedText: string;
  evidence?: string;
}

interface ParsedIntent {
  action: {
    id: string;
    name: string;
    displayName: string;
    layer: OntologyLayer;
  };
  entities: ParsedEntity[];
  suggestedProperties: {
    propertyId: string;
    propertyName: string;
    displayName: string;
    value: string;
    inferred: boolean;
    source: string;
    objectTypeId?: string;
  }[];
  dataFlow?: {
    id: string;
    name: string;
    steps: string[];
  };
  businessRules?: {
    id: string;
    name: string;
    status: "PASS" | "FAIL" | "WARN";
    message?: string;
  }[];
  output?: {
    propertyId: string;
    propertyName: string;
    displayName: string;
    description: string;
  }[];
}

interface SemanticQueryInputProps {
  className?: string;
}

// 动作关键词映射
const ACTION_KEYWORDS: Record<string, { actionId: string; actionName: string; actionDisplayName: string }> = {};

// 属性关键词映射
const PROPERTY_KEYWORDS: Record<string, { objectTypeId: string; propertyId: string; propertyName: string; displayName: string; baseType: string }> = {};

// 实体关键词映射
const OBJECT_KEYWORDS: Record<string, { objectTypeId: string; objectName: string; displayName: string }> = {};

// 日期模式
const DATE_PATTERNS = [
  /(\d{1,2})月(\d{1,2})日/,
  /(\d{4})-(\d{1,2})-(\d{1,2})/,
  /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
  /今天/,
  /明天/,
  /后天/,
];

// 数字模式
const NUMBER_PATTERN = /(\d+)/g;

export function SemanticQueryInput({ className }: SemanticQueryInputProps) {
  const [query, setQuery] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedIntent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentIntro, setAgentIntro] = useState("");
  const [parsedAgentStatus, setParsedAgentStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [previewAgentStatus, setPreviewAgentStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [agentError, setAgentError] = useState("");
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState(false);
  const [isAgentFollowEnabled, setIsAgentFollowEnabled] = useState(true);
  const [agentChatDraft, setAgentChatDraft] = useState("");
  const latestParseRequestRef = React.useRef(0);

  const { actionTypes, objectTypes, businessRules, ormMapping, scenario } = useOntologyStore();
  const {
    selectActionType,
    setSemanticHighlightedNodeIds,
    clearSemanticHighlightedNodeIds,
    setSemanticQueryPreview,
    clearSemanticQueryPreview,
    setSemanticParsedResult,
    setSemanticResourcePreview,
  } = useSelectionStore();
  const { openRightPanel } = useUIStore();

  // 解析查询
  const parseQueryText = useCallback(async (rawQuery: string) => {
    const requestId = latestParseRequestRef.current + 1;
    latestParseRequestRef.current = requestId;
    const normalizedQuery = rawQuery?.toString?.().trim?.() || "";
    if (!normalizedQuery) {
      setParsedResult(null);
      setSemanticParsedResult(null);
      clearSemanticHighlightedNodeIds();
      clearSemanticQueryPreview();
      setAgentIntro("");
      setParsedAgentStatus("idle");
      setPreviewAgentStatus("idle");
      setAgentError("");
      return;
    }

    setIsLoading(true);
    setIsStreaming(true);
    setAgentIntro("");
    setParsedAgentStatus("running");
    setPreviewAgentStatus("running");
    setAgentError("");
    setIsAgentDrawerOpen(true);
    try {
      const result = performParsing(normalizedQuery, actionTypes, objectTypes, businessRules);
      setParsedResult(result);
      setSemanticParsedResult(result);
      setSemanticHighlightedNodeIds(deriveHighlightedObjectTypeIds(result, objectTypes, normalizedQuery));
      const localPreview = generateSemanticPreview(result, normalizedQuery, actionTypes);
      setSemanticQueryPreview(localPreview);
      const streamResolved = await requestSemanticAgentStream(normalizedQuery, (event) => {
        if (latestParseRequestRef.current !== requestId) {
          return;
        }
        if (event.type === "intro_delta") {
          setAgentIntro((prev) => prev + String(event.delta || ""));
          return;
        }
        if (event.type === "intro_done") {
          setAgentIntro(String(event.intro || ""));
          return;
        }
        if (event.type === "parsed_result" && event.parsedResult) {
          const normalizedLLMResult = normalizeLLMParsedResult(event.parsedResult, result, actionTypes);
          setParsedResult(normalizedLLMResult);
          setSemanticParsedResult(normalizedLLMResult);
          setSemanticHighlightedNodeIds(
            deriveHighlightedObjectTypeIds(normalizedLLMResult, objectTypes, normalizedQuery)
          );
          setParsedAgentStatus("done");

          // 触发资源预测 Agent
          setSemanticResourcePreview({ resources: [], dataStructures: [], status: "running" });
          selectActionType(normalizedLLMResult.action.id);
          openRightPanel();
          fetch("/api/semantic-query-predict-resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parsedResult: normalizedLLMResult }),
          })
            .then(res => res.json())
            .then(data => {
              if (data.resources || data.dataStructures) {
                setSemanticResourcePreview({
                  resources: data.resources || [],
                  dataStructures: data.dataStructures || [],
                  status: "done",
                });
              } else {
                setSemanticResourcePreview({ resources: [], dataStructures: [], status: "error" });
              }
            })
            .catch(() => {
              setSemanticResourcePreview({ resources: [], dataStructures: [], status: "error" });
            });
          return;
        }
        if (event.type === "preview_result" && event.preview) {
          setSemanticQueryPreview({
            query: normalizedQuery,
            generatedAt: new Date().toISOString(),
            semanticScenario: event.preview.semanticScenario || localPreview.semanticScenario,
            rdf: event.preview.rdf || localPreview.rdf,
            owl: event.preview.owl || localPreview.owl,
            swrl: event.preview.swrl || localPreview.swrl,
            dsl: event.preview.dsl || localPreview.dsl,
            graphqlTemplate: event.preview.graphqlTemplate || localPreview.graphqlTemplate,
            templateVars: event.preview.templateVars || localPreview.templateVars,
            sql: (event.preview as any)?.sql || localPreview.sql,
            sqlVars: (event.preview as any)?.sqlVars || localPreview.sqlVars,
            schemaVersion: "semantic-preview.v2",
            reasoning: event.preview.reasoning,
            source: "llm",
          });
          setPreviewAgentStatus("done");
          return;
        }
        if (event.type === "error") {
          setAgentError(String(event.message || "流式解析失败"));
          setParsedAgentStatus("error");
          setPreviewAgentStatus("error");
        }
      });
      if (latestParseRequestRef.current !== requestId) {
        return;
      }
      if (!streamResolved) {
        const llmPreview = await requestLLMSemanticPreview(normalizedQuery);
        if (llmPreview?.parsedResult) {
          const normalizedLLMResult = normalizeLLMParsedResult(llmPreview.parsedResult, result, actionTypes);
          setParsedResult(normalizedLLMResult);
          setSemanticParsedResult(normalizedLLMResult);
          setSemanticHighlightedNodeIds(
            deriveHighlightedObjectTypeIds(normalizedLLMResult, objectTypes, normalizedQuery)
          );
          setParsedAgentStatus("done");

          // 触发资源预测 Agent
          setSemanticResourcePreview({ resources: [], dataStructures: [], status: "running" });
          selectActionType(normalizedLLMResult.action.id);
          openRightPanel();
          fetch("/api/semantic-query-predict-resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parsedResult: normalizedLLMResult }),
          })
            .then(res => res.json())
            .then(data => {
              if (data.resources || data.dataStructures) {
                setSemanticResourcePreview({
                  resources: data.resources || [],
                  dataStructures: data.dataStructures || [],
                  status: "done",
                });
              } else {
                setSemanticResourcePreview({ resources: [], dataStructures: [], status: "error" });
              }
            })
            .catch(() => {
              setSemanticResourcePreview({ resources: [], dataStructures: [], status: "error" });
            });
        } else {
          setParsedAgentStatus("error");
        }
        if (llmPreview && (llmPreview.semanticScenario || llmPreview.rdf || llmPreview.swrl)) {
          setSemanticQueryPreview({
            query: normalizedQuery,
            generatedAt: new Date().toISOString(),
            semanticScenario: llmPreview.semanticScenario || localPreview.semanticScenario,
            rdf: llmPreview.rdf || localPreview.rdf,
            owl: llmPreview.owl || localPreview.owl,
            swrl: llmPreview.swrl || localPreview.swrl,
            dsl: llmPreview.dsl || localPreview.dsl,
            graphqlTemplate: llmPreview.graphqlTemplate || localPreview.graphqlTemplate,
            templateVars: llmPreview.templateVars || localPreview.templateVars,
            sql: (llmPreview as any)?.sql || localPreview.sql,
            sqlVars: (llmPreview as any)?.sqlVars || localPreview.sqlVars,
            schemaVersion: "semantic-preview.v2",
            reasoning: llmPreview.reasoning,
            source: "llm",
          });
          setPreviewAgentStatus("done");
        } else {
          setPreviewAgentStatus("error");
          setAgentError("语义服务暂不可用，已保留本地规则解析结果");
        }
      } else {
        if (parsedAgentStatus === "running") {
          setParsedAgentStatus("done");

          // 触发资源预测 Agent (Fallback 场景)
          setSemanticResourcePreview({ resources: [], dataStructures: [], status: "running" });
          selectActionType(result.action.id);
          openRightPanel();
          fetch("/api/semantic-query-predict-resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parsedResult: result }),
          })
            .then(res => res.json())
            .then(data => {
              if (data.resources || data.dataStructures) {
                setSemanticResourcePreview({
                  resources: data.resources || [],
                  dataStructures: data.dataStructures || [],
                  status: "done",
                });
              } else {
                setSemanticResourcePreview({ resources: [], dataStructures: [], status: "error" });
              }
            })
            .catch(() => {
              setSemanticResourcePreview({ resources: [], dataStructures: [], status: "error" });
            });
        }
        if (previewAgentStatus === "running") {
          setPreviewAgentStatus("done");
        }
      }
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, [
    actionTypes,
    objectTypes,
    businessRules,
    openRightPanel,
    selectActionType,
    parsedAgentStatus,
    previewAgentStatus,
    setSemanticParsedResult,
    setSemanticResourcePreview,
    setSemanticHighlightedNodeIds,
    clearSemanticHighlightedNodeIds,
    setSemanticQueryPreview,
    clearSemanticQueryPreview,
  ]);

  const parseQuery = useCallback(async () => {
    await parseQueryText(query);
  }, [parseQueryText, query]);

  const sendAgentChat = useCallback(async () => {
    const nextQuery = agentChatDraft.trim();
    if (!nextQuery) return;
    setQuery(nextQuery);
    setAgentChatDraft("");
    await parseQueryText(nextQuery);
  }, [agentChatDraft, parseQueryText]);

  React.useEffect(() => {
    return () => {
      clearSemanticHighlightedNodeIds();
      clearSemanticQueryPreview();
      setSemanticParsedResult(null);
    };
  }, [clearSemanticHighlightedNodeIds, clearSemanticQueryPreview, setSemanticParsedResult]);

  // 处理回车键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      parseQuery();
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b border-[#2d2d2d]">
        <div className="flex items-center gap-2 mb-3 justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">语义查询端口</h2>
                <p className="text-[10px] text-[#6b6b6b]">自然语言 → 本体映射</p>
              </div>
            </div>
            
            {(agentIntro || parsedAgentStatus !== "idle") && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[11px] bg-[#1a1a1a] border-[#2d2d2d] hover:bg-[#2d2d2d] text-[#a0a0a0] flex items-center gap-1.5"
                onClick={() => setIsAgentDrawerOpen(true)}
              >
                <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
                打开 Agent 对话
              </Button>
            )}
          </div>

        {/* Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
          <Input
            placeholder="输入业务需求，例如：为缺料预警生成两套请购方案并推演链路..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-20 h-10 bg-[#1a1a1a] border-[#2d2d2d] focus:border-[#8B5CF6] text-sm"
          />
          <Button
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
            onClick={parseQuery}
            disabled={isLoading || !query.trim()}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            解析
          </Button>
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[10px] text-[#6b6b6b]">示例:</span>
          {["为缺料预警生成两套请购方案并推演链路", "为临期原材料生成处置方案并推演链路", "查询某个对象的关键属性与关系"].map((example) => (
            <button
              key={example}
              onClick={() => setQuery(example)}
              className="text-[10px] px-2 py-1 rounded bg-[#2d2d2d] text-[#a0a0a0] hover:bg-[#3d3d3d] hover:text-white transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <AgentChatDrawer
            isOpen={isAgentDrawerOpen}
            onOpenChange={setIsAgentDrawerOpen}
            isFollowEnabled={isAgentFollowEnabled}
            onFollowChange={setIsAgentFollowEnabled}
            isStreaming={isStreaming}
            intro={agentIntro}
            parsedAgentStatus={parsedAgentStatus}
            previewAgentStatus={previewAgentStatus}
            error={agentError}
            draft={agentChatDraft}
            onDraftChange={setAgentChatDraft}
            onSend={sendAgentChat}
          />
          {parsedResult ? (
            <ParseResultDisplay
              result={parsedResult}
              onSelectAction={(actionId) => {
                selectActionType(actionId);
                openRightPanel();
              }}
            />
          ) : (
            <EmptyParseResult />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ==================== 解析逻辑 ====================
function deriveOutputFromActionTypes(
  action: { id: string; name: string },
  actionTypes: any[]
): NonNullable<ParsedIntent["output"]> {
  if (!action?.id && !action?.name) return [];
  const matchedActionType = actionTypes.find(
    (at) => at?.id === action.id || at?.apiName === action.name
  );
  const outputProperties = Array.isArray(matchedActionType?.outputProperties)
    ? matchedActionType.outputProperties
    : [];
  if (outputProperties.length === 0) return [];

  return outputProperties
    .map((prop: any) => {
      const propertyId = String(prop?.id || prop?.apiName || "");
      const propertyName = String(prop?.apiName || prop?.id || "");
      if (!propertyId && !propertyName) return null;
      return {
        propertyId,
        propertyName,
        displayName: String(prop?.displayName || propertyName || propertyId),
        description: String(prop?.description || ""),
      };
    })
    .filter(Boolean) as NonNullable<ParsedIntent["output"]>;
}

function performParsing(
  query: string,
  actionTypes: any[],
  objectTypes: any[],
  businessRules: any[]
): ParsedIntent {
  const result: ParsedIntent = {
    action: {
      id: "",
      name: "",
      displayName: "",
      layer: "KINETIC",
    },
    entities: [],
    suggestedProperties: [],
    businessRules: [],
    output: [],
  };

  // 1. 识别动作
  const actionKeywordEntries = Object.entries(ACTION_KEYWORDS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [keyword, action] of actionKeywordEntries) {
    if (query.includes(keyword)) {
      result.action = {
        id: action.actionId,
        name: action.actionName,
        displayName: action.actionDisplayName,
        layer: "KINETIC",
      };
      break;
    }
  }

  // 如果没找到动作，尝试从 actionTypes 中匹配
  if (!result.action.id) {
    const matchedAction = actionTypes.find(
      (at) =>
        query.includes(at.displayName) || query.includes(at.apiName)
    );
    if (matchedAction) {
      result.action = {
        id: matchedAction.id,
        name: matchedAction.apiName,
        displayName: matchedAction.displayName,
        layer: matchedAction.layer,
      };
    }
  }

  // 2. 识别实体
  for (const [keyword, obj] of Object.entries(OBJECT_KEYWORDS)) {
    if (query.includes(keyword)) {
      result.entities.push({
        type: "OBJECT_TYPE",
        id: obj.objectTypeId,
        name: obj.objectName,
        displayName: obj.displayName,
        confidence: 0.9,
        matchedText: keyword,
        evidence: `通过关键词"${keyword}"识别`,
      });
    }
  }

  // 3. 识别属性值
  for (const [keyword, prop] of Object.entries(PROPERTY_KEYWORDS)) {
    if (query.includes(keyword)) {
      // 提取值
      let value = keyword;
      
      // 尝试提取数字
      const numbers = query.match(NUMBER_PATTERN);
      if (numbers && prop.baseType === "DOUBLE") {
        value = numbers[0];
      }

      // 尝试提取日期
      for (const pattern of DATE_PATTERNS) {
        const match = query.match(pattern);
        if (match) {
          if (match[0] === "今天") {
            value = new Date().toISOString().split("T")[0];
          } else if (match[0] === "明天") {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            value = tomorrow.toISOString().split("T")[0];
          } else if (match[0] === "后天") {
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 2);
            value = dayAfter.toISOString().split("T")[0];
          } else {
            // 解析日期模式
            if (pattern.source.includes("月")) {
              // 中文日期
              const month = match[1].padStart(2, "0");
              const day = match[2].padStart(2, "0");
              value = `2024-${month}-${day}`;
            } else {
              // ISO 日期
              value = match[0];
            }
          }
          break;
        }
      }

      result.suggestedProperties.push({
        propertyId: prop.propertyId,
        propertyName: prop.propertyName,
        displayName: prop.displayName,
        value: value,
        inferred: DATE_PATTERNS.some((p) => p.test(query)),
        source: prop.baseType,
        objectTypeId: prop.objectTypeId,
      });
    }
  }

  // 4. 特殊处理：提取《...》内容
  const bookTitleMatch = query.match(/《([^》]+)》/);
  if (bookTitleMatch) {
    result.suggestedProperties.push({
      propertyId: "title",
      propertyName: "title",
      displayName: "标题",
      value: bookTitleMatch[1],
      inferred: false,
      source: "STRING",
    });
  }

  // 5. 提取数字作为天数
  const dayMatch = query.match(/(\d+)\s*天/);
  if (dayMatch) {
    result.suggestedProperties.push({
      propertyId: "days",
      propertyName: "days",
      displayName: "天数",
      value: dayMatch[1],
      inferred: true,
      source: "INTEGER",
    });
  }

  // 6. 提取日期
  for (const pattern of DATE_PATTERNS) {
    const match = query.match(pattern);
    if (match) {
      let dateValue = match[0];
      if (match[0] === "今天") {
        dateValue = new Date().toISOString().split("T")[0];
      } else if (match[0] === "明天") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateValue = tomorrow.toISOString().split("T")[0];
      } else if (match[0] === "后天") {
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        dateValue = dayAfter.toISOString().split("T")[0];
      } else if (pattern.source.includes("月")) {
        const month = match[1].padStart(2, "0");
        const day = match[2].padStart(2, "0");
        dateValue = `2024-${month}-${day}`;
      }
      
      result.suggestedProperties.push({
        propertyId: "date",
        propertyName: "date",
        displayName: "日期",
        value: dateValue,
        inferred: true,
        source: "TIMESTAMP",
      });
      break;
    }
  }

  // 7. 获取关联的数据流（通用兜底）
  if (result.action.id) {
    result.dataFlow = {
      id: "flow-generic",
      name: "GenericFlow",
      steps: ["1. 解析意图", "2. 识别实体", "3. 提取参数", "4. 执行动作", "5. 写入/更新", "6. 返回结果"],
    };
  }

  // 8. 验证业务规则（通用兜底）
  if (result.action.id && Array.isArray(businessRules)) {
    const relatedRules = businessRules
      .filter((r: any) => Array.isArray(r?.appliesToActionTypeIds) && r.appliesToActionTypeIds.includes(result.action.id))
      .slice(0, 2);
    result.businessRules = relatedRules.map((r: any) => ({
      id: r?.id || "rule-generic",
      name: r?.displayName || r?.apiName || "通用规则校验",
      status: "WARN",
      message: "可能适用的业务规则",
    }));
  }

  // 9. 输出结果
  const derivedOutput = deriveOutputFromActionTypes(result.action, actionTypes);
  result.output = derivedOutput;

  return result;
}

function deriveHighlightedObjectTypeIds(result: ParsedIntent, objectTypes: ObjectType[], query: string): string[] {
  const highlightedIds = new Set<string>();

  result.entities.forEach((entity) => {
    if (entity.type === "OBJECT_TYPE" && entity.id) {
      highlightedIds.add(entity.id);
    }
  });

  result.suggestedProperties.forEach((property) => {
    if (property.objectTypeId) {
      highlightedIds.add(property.objectTypeId);
    }
  });

  if (highlightedIds.size === 0 && query.trim()) {
    const normalizedQuery = query.toLowerCase();
    objectTypes.forEach((objectType) => {
      if (
        normalizedQuery.includes(objectType.displayName.toLowerCase()) ||
        normalizedQuery.includes(objectType.apiName.toLowerCase())
      ) {
        highlightedIds.add(objectType.id);
      }
    });
  }

  const validObjectTypeIds = new Set(objectTypes.map((ot) => ot.id));
  return Array.from(highlightedIds).filter((id) => validObjectTypeIds.has(id));
}

async function requestLLMSemanticPreview(query: string): Promise<{
  semanticScenario?: string;
  rdf?: string;
  owl?: string;
  swrl?: string;
  dsl?: string;
  graphqlTemplate?: string;
  templateVars?: Record<string, string>;
  reasoning?: string;
  parsedResult?: Partial<ParsedIntent>;
} | null> {
  try {
    const response = await fetch("/api/semantic-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      semanticScenario: data?.semanticScenario,
      rdf: data?.rdf,
      owl: data?.owl,
      swrl: data?.swrl,
      dsl: data?.dsl,
      graphqlTemplate: data?.graphqlTemplate,
      templateVars: data?.templateVars,
      reasoning: data?.reasoning,
      parsedResult: data?.parsedResult,
    };
  } catch {
    return null;
  }
}

async function requestSemanticAgentStream(
  query: string,
  onEvent: (event: any) => void
): Promise<boolean> {
  try {
    const response = await fetch("/api/semantic-query/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok || !response.body) {
      return false;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        const line = block
          .split("\n")
          .find((item) => item.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice(6);
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload));
        } catch {
          onEvent({ type: "intro_delta", delta: payload });
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

function normalizeLLMParsedResult(
  parsed: Partial<ParsedIntent>,
  fallback: ParsedIntent,
  actionTypes: any[]
): ParsedIntent {
  const rawParsed = parsed as any;
  const rawAction = rawParsed?.action || rawParsed?.intentAction || {};
  const rawEntities = Array.isArray(rawParsed?.entities)
    ? rawParsed.entities
    : Array.isArray(rawParsed?.identifiedEntities)
    ? rawParsed.identifiedEntities
    : [];
  const rawSuggestedProperties = Array.isArray(rawParsed?.suggestedProperties)
    ? rawParsed.suggestedProperties
    : Array.isArray(rawParsed?.extractedParams)
    ? rawParsed.extractedParams
    : Array.isArray(rawParsed?.parameters)
    ? rawParsed.parameters
    : [];
  const rawOutput = Array.isArray(rawParsed?.output)
    ? rawParsed.output
    : Array.isArray(rawParsed?.generatedFields)
    ? rawParsed.generatedFields
    : [];
  const action = rawAction?.id
    ? {
        id: rawAction.id,
        name: rawAction.name || fallback.action.name,
        displayName: rawAction.displayName || fallback.action.displayName,
        layer: rawAction.layer || "KINETIC",
      }
    : fallback.action;

  const entities = rawEntities.length > 0
    ? rawEntities.map((entity: any) => ({
        type: entity.type || "OBJECT_TYPE",
        id: entity.id,
        name: entity.name || entity.displayName || "",
        displayName: entity.displayName || entity.name || "",
        confidence: typeof entity.confidence === "number" ? entity.confidence : 0.8,
        matchedText: entity.matchedText || entity.displayName || entity.name || "",
      }))
    : fallback.entities;

  const suggestedProperties = rawSuggestedProperties.length > 0
    ? rawSuggestedProperties.map((prop: any) => ({
        propertyId: prop.propertyId || "",
        propertyName: prop.propertyName || prop.displayName || "",
        displayName: prop.displayName || prop.propertyName || "",
        value: String(prop.value ?? ""),
        inferred: Boolean(prop.inferred),
        source: prop.source || "STRING",
        objectTypeId: prop.objectTypeId,
      }))
    : fallback.suggestedProperties;

  const derivedOutput = deriveOutputFromActionTypes(action, actionTypes);
  const normalizedOutput =
    rawOutput.length > 0
      ? rawOutput
      : derivedOutput.length > 0
      ? derivedOutput
      : fallback.output || [];

  return {
    action,
    entities,
    suggestedProperties,
    dataFlow: parsed.dataFlow || fallback.dataFlow,
    businessRules:
      Array.isArray(parsed.businessRules) && parsed.businessRules.length > 0
        ? parsed.businessRules
        : fallback.businessRules,
    output: normalizedOutput,
  };
}

function generateSemanticPreview(
  result: ParsedIntent,
  query: string,
  actionTypes: any[]
) {
  const actionType = Array.isArray(actionTypes) ? actionTypes.find((at) => at.id === result.action.id) : null;
  const escaped = query.trim().replaceAll('"', '\\"');

  const mapping = actionType?.interfaceMapping?.kind === "GRAPHQL" ? actionType.interfaceMapping : null;
  const graphqlTemplate = mapping ? buildGraphqlTemplate(mapping) : `query SemanticQuery($query: String!) {\n  semanticQuery(query: $query) {\n    receipt\n  }\n}`;
  const templateVars: Record<string, string> = mapping ? {} : { query: query.trim() };

  if (mapping) {
    const extracted = Object.fromEntries(
      (result.suggestedProperties || [])
        .filter((p) => p?.propertyName && typeof p?.value === "string")
        .map((p) => [String(p.propertyName), String(p.value)])
    );
    for (const f of mapping.inputFields || []) {
      templateVars[f] = extracted[f] || "";
    }
  }

  return {
    query,
    generatedAt: new Date().toISOString(),
    semanticScenario: "系统将用户输入解析为动作、实体与参数，并生成可执行的模板预览。",
    rdf: `lib:Query a lib:SemanticQuery ;\n  lib:text "${escaped}" .`,
    owl: `Class: lib:SemanticQuery\n  Annotations: rdfs:label "语义查询"`,
    swrl: `lib:Rule_Generic a lib:BusinessRule ;\n  lib:then """ true """ .`,
    dsl: `ACTION ${result.action.name || "GenericAction"} WITH Query.text="${escaped}"`,
    graphqlTemplate,
    templateVars,
    sql: undefined,
    sqlVars: undefined,
    schemaVersion: "semantic-preview.v2",
    source: "rule" as const,
  };
}

// ==================== 结果展示 ====================
function ParseResultDisplay({
  result,
  onSelectAction,
}: {
  result: ParsedIntent;
  onSelectAction: (actionId: string) => void;
}) {
  if (!result) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
          <p className="text-sm text-[#6b6b6b]">暂无解析结果</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 主标题 */}
      <div className="text-center py-4">
        <h2 className="text-lg font-semibold text-white flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-[#8B5CF6]" />
          语义解析对象拆解
        </h2>
      </div>
      {/* 解析摘要 */}
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-[#2d2d2d]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#8B5CF6]" />
            解析结果
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 识别的动作 */}
          {result.action.id ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20">
              <div className="w-10 h-10 rounded-lg bg-[#10B981]/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#10B981]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {result.action.displayName}
                  </span>
                  <Badge className="text-[10px] bg-[#10B981]/20 text-[#10B981] border-0">
                    {result.action.layer === "KINETIC" ? "动势层操作" : "语义层"}
                  </Badge>
                </div>
                <span className="text-[11px] text-[#6b6b6b] font-mono">
                  {result.action.name}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-7 border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10"
                onClick={() => onSelectAction(result.action.id)}
              >
                查看资源推演
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20">
              <XCircle className="w-5 h-5 text-[#EF4444]" />
              <span className="text-sm text-[#EF4444]">
                无法识别操作意图，请尝试更明确的描述
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 识别的实体 */}
      {result.entities && result.entities.length > 0 && (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-[#3B82F6]" />
              识别的实体
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {result.entities.map((entity, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded bg-[#3B82F6]/10 border border-[#3B82F6]/20"
                >
                  <BookOpen className="w-4 h-4 text-[#3B82F6]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white block truncate">
                      {entity.displayName || entity.name || '未命名实体'}
                    </span>
                    <span className="text-[10px] text-[#6b6b6b] font-mono">
                      {entity.matchedText || '无匹配文本'}
                    </span>
                  </div>
                  <Badge className="text-[9px] bg-[#3B82F6]/20 text-[#3B82F6] border-0">
                    {entity.confidence ? Math.round(entity.confidence * 100) : 0}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 提取的参数 */}
      {result.suggestedProperties && result.suggestedProperties.length > 0 && (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Type className="w-4 h-4 text-[#F59E0B]" />
              提取的参数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.suggestedProperties.map((prop, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded bg-[#F59E0B]/5 border border-[#F59E0B]/10"
                >
                  <div className="w-8 h-8 rounded bg-[#F59E0B]/10 flex items-center justify-center">
                    {prop.source === "TIMESTAMP" ? (
                      <Calendar className="w-4 h-4 text-[#F59E0B]" />
                    ) : prop.source === "INTEGER" || prop.source === "DOUBLE" ? (
                      <Hash className="w-4 h-4 text-[#F59E0B]" />
                    ) : (
                      <Type className="w-4 h-4 text-[#F59E0B]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white block">{prop.displayName || prop.propertyName || '未命名属性'}</span>
                    <span className="text-[10px] text-[#6b6b6b] font-mono">
                      {prop.propertyName || '未知属性名'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#10B981]">
                      {prop.value !== undefined && prop.value !== null ? String(prop.value) : '无值'}
                    </span>
                    {prop.inferred && (
                      <Badge className="text-[9px] bg-[#8B5CF6]/20 text-[#8B5CF6] border-0">
                        推断
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 业务规则验证 */}
      {result.businessRules && result.businessRules.length > 0 && (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#06B6D4]" />
              业务规则验证
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.businessRules.map((rule, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded border",
                    rule.status === "PASS"
                      ? "bg-[#10B981]/5 border-[#10B981]/20"
                      : rule.status === "FAIL"
                      ? "bg-[#EF4444]/5 border-[#EF4444]/20"
                      : "bg-[#F59E0B]/5 border-[#F59E0B]/20"
                  )}
                >
                  {rule.status === "PASS" ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  ) : rule.status === "FAIL" ? (
                    <XCircle className="w-4 h-4 text-[#EF4444]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white block">{rule.name}</span>
                    {rule.message && (
                      <span className="text-[10px] text-[#6b6b6b]">{rule.message}</span>
                    )}
                  </div>
                  <Badge
                    className={cn(
                      "text-[9px] border-0",
                      rule.status === "PASS"
                        ? "bg-[#10B981]/20 text-[#10B981]"
                        : rule.status === "FAIL"
                        ? "bg-[#EF4444]/20 text-[#EF4444]"
                        : "bg-[#F59E0B]/20 text-[#F59E0B]"
                    )}
                  >
                    {rule.status === "PASS" ? "通过" : rule.status === "FAIL" ? "失败" : "需确认"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 数据流 */}
      {result.dataFlow && (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#10B981]" />
              执行流程
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {result.dataFlow.steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#10B981]/20 flex items-center justify-center text-[10px] text-[#10B981] font-medium">
                    {idx + 1}
                  </div>
                  <span className="text-xs text-white">{step}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 输出结果 */}
      {result && result.output && Array.isArray(result.output) && result.output.length > 0 && (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-[#8B5CF6]" />
              将生成的数据或者生成的实例
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.output.map((out, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded bg-[#8B5CF6]/5 border border-[#8B5CF6]/10"
                >
                  <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white block">{out.displayName || out.propertyName || '未命名输出'}</span>
                    <span className="text-[10px] text-[#6b6b6b]">{out.description || '无描述'}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyParseResult() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B5CF6]/20 to-[#06B6D4]/20 flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-[#8B5CF6]" />
      </div>
      <h3 className="text-sm font-medium text-white mb-2">语义查询端口</h3>
      <p className="text-xs text-[#6b6b6b] max-w-[250px]">
        输入自然语言业务需求，系统将自动解析并映射到本体模型，展示完整的语义理解过程
      </p>
      <div className="mt-6 space-y-2 text-left w-full">
        <p className="text-[10px] text-[#6b6b6b] mb-2">支持的查询示例:</p>
        {[
          "为缺料预警生成两套请购方案并推演链路",
          "为临期原材料生成处置方案并推演链路",
          "查询某个对象的关键属性与关系",
        ].map((example, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[11px] text-[#4a4a4a]">
            <ChevronRight className="w-3 h-3" />
            {example}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentChatDrawer({
  isOpen,
  onOpenChange,
  isFollowEnabled,
  onFollowChange,
  isStreaming,
  intro,
  parsedAgentStatus,
  previewAgentStatus,
  error,
  draft,
  onDraftChange,
  onSend,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isFollowEnabled: boolean;
  onFollowChange: (enabled: boolean) => void;
  isStreaming: boolean;
  intro: string;
  parsedAgentStatus: "idle" | "running" | "done" | "error";
  previewAgentStatus: "idle" | "running" | "done" | "error";
  error: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}) {
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    if (!isFollowEnabled) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [intro, isOpen, isFollowEnabled]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange} showOverlay={false}>
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
              <h3 className="text-sm font-semibold text-white">Agent 对话</h3>
              <span className="text-[11px] text-[#a0a0a0]">跟随</span>
              <Switch checked={isFollowEnabled} onCheckedChange={onFollowChange} />
            </div>
            <div className="flex items-center gap-2">
            </div>
          </div>

          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-[11px] border-0", statusClassName(parsedAgentStatus))}>
                Agent-解析结果：{statusLabel(parsedAgentStatus)}
              </Badge>
              <Badge className={cn("text-[11px] border-0", statusClassName(previewAgentStatus))}>
                Agent-语义预览：{statusLabel(previewAgentStatus)}
              </Badge>
            </div>
          </div>

          <ScrollArea className="flex-1 mt-3">
            <div className="px-4 pb-6 space-y-3">
              <div className="p-3 rounded-md bg-[#141414] border border-[#2d2d2d] w-full max-w-full overflow-hidden">
                {intro ? (
                  <Streamdown
                    isAnimating={isStreaming}
                    className="text-[13px] leading-relaxed text-[#d8d8d8] prose prose-invert max-w-none w-full"
                    plugins={{ mermaid, cjk }}
                  >
                    {intro}
                  </Streamdown>
                ) : (
                  <p className="text-[12px] leading-4 text-[#a9a9a9]">
                    {isStreaming ? "Agent 正在基于本体配置生成语义转义说明..." : "等待说明输出"}
                  </p>
                )}
              </div>
              {error && <p className="text-[12px] text-[#f87171]">{error}</p>}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-[#2d2d2d] p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="继续输入，追问或补充条件…"
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSend();
                  }
                }}
                className="h-9 bg-[#141414] border-[#2d2d2d] focus:border-[#8B5CF6] text-sm"
              />
              <Button
                size="sm"
                className="h-9 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                onClick={onSend}
                disabled={!draft.trim()}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                发送
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function statusLabel(status: "idle" | "running" | "done" | "error") {
  if (status === "running") return "执行中";
  if (status === "done") return "已完成";
  if (status === "error") return "失败";
  return "待执行";
}

function statusClassName(status: "idle" | "running" | "done" | "error") {
  if (status === "running") return "bg-[#F59E0B]/20 text-[#F59E0B]";
  if (status === "done") return "bg-[#10B981]/20 text-[#10B981]";
  if (status === "error") return "bg-[#EF4444]/20 text-[#EF4444]";
  return "bg-[#3b3b3b] text-[#a0a0a0]";
}
