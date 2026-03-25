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
const ACTION_KEYWORDS: Record<string, { actionId: string; actionName: string; actionDisplayName: string }> = {
  "借": { actionId: "action-checkout", actionName: "CheckoutBook", actionDisplayName: "借书" },
  "借阅": { actionId: "action-checkout", actionName: "CheckoutBook", actionDisplayName: "借书" },
  "借书": { actionId: "action-checkout", actionName: "CheckoutBook", actionDisplayName: "借书" },
  "还": { actionId: "action-return", actionName: "ReturnBook", actionDisplayName: "还书" },
  "还书": { actionId: "action-return", actionName: "ReturnBook", actionDisplayName: "还书" },
  "归还": { actionId: "action-return", actionName: "ReturnBook", actionDisplayName: "还书" },
  "续借": { actionId: "action-renew", actionName: "RenewLoan", actionDisplayName: "续借" },
  "续期": { actionId: "action-renew", actionName: "RenewLoan", actionDisplayName: "续借" },
  "预约": { actionId: "action-reserve", actionName: "CreateReservation", actionDisplayName: "创建预约" },
  "注册": { actionId: "action-register-patron", actionName: "RegisterPatron", actionDisplayName: "读者注册" },
  "罚款": { actionId: "action-pay-fine", actionName: "PayFine", actionDisplayName: "缴纳罚款" },
  "缴费": { actionId: "action-pay-fine", actionName: "PayFine", actionDisplayName: "缴纳罚款" },
  "编目": { actionId: "action-catalog", actionName: "CatalogBook", actionDisplayName: "图书编目" },
  "下架": { actionId: "action-weeding", actionName: "WeedBook", actionDisplayName: "图书下架" },
};

// 属性关键词映射
const PROPERTY_KEYWORDS: Record<string, { objectTypeId: string; propertyId: string; propertyName: string; displayName: string; baseType: string }> = {
  "书名": { objectTypeId: "book-001", propertyId: "title", propertyName: "title", displayName: "书名", baseType: "STRING" },
  "图书": { objectTypeId: "book-001", propertyId: "title", propertyName: "title", displayName: "书名", baseType: "STRING" },
  "三体": { objectTypeId: "book-001", propertyId: "title", propertyName: "title", displayName: "书名", baseType: "STRING" },
  "读者": { objectTypeId: "patron-001", propertyId: "patronName", propertyName: "patronName", displayName: "姓名", baseType: "STRING" },
  "姓名": { objectTypeId: "patron-001", propertyId: "patronName", propertyName: "patronName", displayName: "姓名", baseType: "STRING" },
  "学号": { objectTypeId: "patron-001", propertyId: "patronId", propertyName: "patronId", displayName: "读者ID", baseType: "STRING" },
  "读者ID": { objectTypeId: "patron-001", propertyId: "patronId", propertyName: "patronId", displayName: "读者ID", baseType: "STRING" },
  "条码": { objectTypeId: "holding-001", propertyId: "barcode", propertyName: "barcode", displayName: "条码号", baseType: "STRING" },
  "条码号": { objectTypeId: "holding-001", propertyId: "barcode", propertyName: "barcode", displayName: "条码号", baseType: "STRING" },
  "天数": { objectTypeId: "loan-001", propertyId: "dueDate", propertyName: "dueDate", displayName: "应还日期", baseType: "TIMESTAMP" },
  "期限": { objectTypeId: "loan-001", propertyId: "dueDate", propertyName: "dueDate", displayName: "应还日期", baseType: "TIMESTAMP" },
  "日期": { objectTypeId: "loan-001", propertyId: "checkoutDate", propertyName: "checkoutDate", displayName: "借出日期", baseType: "TIMESTAMP" },
  "借阅": { objectTypeId: "loan-001", propertyId: "loanId", propertyName: "loanId", displayName: "借阅ID", baseType: "STRING" },
  "借阅ID": { objectTypeId: "loan-001", propertyId: "loanId", propertyName: "loanId", displayName: "借阅ID", baseType: "STRING" },
  "状态": { objectTypeId: "loan-001", propertyId: "loanStatus", propertyName: "loanStatus", displayName: "借阅状态", baseType: "STRING" },
  "价格": { objectTypeId: "holding-001", propertyId: "price", propertyName: "price", displayName: "采购价格", baseType: "DOUBLE" },
  "费用": { objectTypeId: "fine-001", propertyId: "amount", propertyName: "amount", displayName: "罚款金额", baseType: "DOUBLE" },
  "金额": { objectTypeId: "fine-001", propertyId: "amount", propertyName: "amount", displayName: "罚款金额", baseType: "DOUBLE" },
  "罚款": { objectTypeId: "fine-001", propertyId: "amount", propertyName: "amount", displayName: "罚款金额", baseType: "DOUBLE" },
};

// 实体关键词映射
const OBJECT_KEYWORDS: Record<string, { objectTypeId: string; objectName: string; displayName: string }> = {
  "图书": { objectTypeId: "book-001", objectName: "Book", displayName: "图书" },
  "书": { objectTypeId: "book-001", objectName: "Book", displayName: "图书" },
  "馆藏": { objectTypeId: "holding-001", objectName: "Holding", displayName: "馆藏副本" },
  "副本": { objectTypeId: "holding-001", objectName: "Holding", displayName: "馆藏副本" },
  "读者": { objectTypeId: "patron-001", objectName: "Patron", displayName: "读者" },
  "用户": { objectTypeId: "patron-001", objectName: "Patron", displayName: "读者" },
  "借阅": { objectTypeId: "loan-001", objectName: "Loan", displayName: "借阅记录" },
  "借阅记录": { objectTypeId: "loan-001", objectName: "Loan", displayName: "借阅记录" },
  "预约": { objectTypeId: "reservation-001", objectName: "Reservation", displayName: "预约" },
  "罚款": { objectTypeId: "fine-001", objectName: "Fine", displayName: "罚款记录" },
  "罚款记录": { objectTypeId: "fine-001", objectName: "Fine", displayName: "罚款记录" },
  "供应商": { objectTypeId: "supplier-001", objectName: "Supplier", displayName: "供应商" },
  "预算": { objectTypeId: "budget-001", objectName: "Budget", displayName: "预算" },
  "部门": { objectTypeId: "department-001", objectName: "Department", displayName: "部门" },
  "图书馆": { objectTypeId: "library-001", objectName: "Library", displayName: "图书馆" },
  "工作人员": { objectTypeId: "staff-001", objectName: "Staff", displayName: "工作人员" },
  "分类": { objectTypeId: "category-001", objectName: "Category", displayName: "分类" },
  "出版社": { objectTypeId: "publisher-001", objectName: "Publisher", displayName: "出版社" },
};

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

  const { actionTypes, objectTypes, businessRules } = useOntologyStore();
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
      const localPreview = generateSemanticPreview(result, normalizedQuery);
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
          const normalizedLLMResult = normalizeLLMParsedResult(event.parsedResult, result);
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
          const normalizedLLMResult = normalizeLLMParsedResult(llmPreview.parsedResult, result);
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
            placeholder="输入业务需求，例如：借阅《三体》这本书..."
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
          {["借阅《三体》", "还书，条码号 ABC123", "查询超期罚款"].map((example) => (
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
  for (const [keyword, action] of Object.entries(ACTION_KEYWORDS)) {
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
        inferred: keyword === "三体" || keyword === "天数" || DATE_PATTERNS.some(p => p.test(query)),
        source: prop.baseType,
        objectTypeId: prop.objectTypeId,
      });
    }
  }

  // 4. 特殊处理：从 query 中提取《三体》这样的书名
  const bookTitleMatch = query.match(/《([^》]+)》/);
  if (bookTitleMatch) {
    result.suggestedProperties.push({
      propertyId: "title",
      propertyName: "title",
      displayName: "书名",
      value: bookTitleMatch[1],
      inferred: false,
      source: "STRING",
      objectTypeId: "book-001",
    });
  }

  // 5. 提取数字作为天数/期限
  const dayMatch = query.match(/(\d+)\s*天/);
  if (dayMatch) {
    result.suggestedProperties.push({
      propertyId: "loanPeriodDays",
      propertyName: "loanPeriodDays",
      displayName: "借阅天数",
      value: dayMatch[1],
      inferred: true,
      source: "INTEGER",
      objectTypeId: "loan-001",
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
        propertyId: "checkoutDate",
        propertyName: "checkoutDate",
        displayName: "借阅日期",
        value: dateValue,
        inferred: true,
        source: "TIMESTAMP",
        objectTypeId: "loan-001",
      });
      break;
    }
  }

  // 7. 获取关联的数据流
  if (result.action.id) {
    const checkoutFlow = {
      id: "flow-checkout",
      name: "CheckoutProcess",
      steps: [
        "1. 验证读者身份",
        "2. 检查馆藏可用性",
        "3. 验证业务规则（借阅限额、超期等）",
        "4. 计算应还日期",
        "5. 创建借阅记录",
        "6. 更新馆藏状态",
      ],
    };
    
    if (result.action.id === "action-checkout") {
      result.dataFlow = checkoutFlow;
    }
  }

  // 8. 验证业务规则
  const loanLimitRule = businessRules.find((r) => r.apiName === "LoanLimitByPatronType");
  const overdueRule = businessRules.find((r) => r.apiName === "OverdueFineRate");
  
  if (result.action.id === "action-checkout") {
    result.businessRules = [
      {
        id: loanLimitRule?.id || "rule-loan-limit",
        name: loanLimitRule?.displayName || "借阅数量限制",
        status: "PASS",
        message: "将验证读者当前借阅数量是否未达上限",
      },
      {
        id: overdueRule?.id || "rule-overdue-fine",
        name: overdueRule?.displayName || "超期罚款规则",
        status: "WARN",
        message: "需确认借阅天数，系统将自动计算应还日期",
      },
    ];
  }

  // 9. 输出结果
  result.output = [
    {
      propertyId: "loanId",
      propertyName: "loanId",
      displayName: "借阅ID",
      description: "系统将自动生成唯一借阅编号",
    },
    {
      propertyId: "dueDate",
      propertyName: "dueDate",
      displayName: "应还日期",
      description: "根据读者类型和借阅天数自动计算",
    },
    {
      propertyId: "loanStatus",
      propertyName: "loanStatus",
      displayName: "借阅状态",
      description: "初始状态为 ACTIVE（进行中）",
    },
  ];

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

function normalizeLLMParsedResult(parsed: Partial<ParsedIntent>, fallback: ParsedIntent): ParsedIntent {
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

  return {
    action,
    entities,
    suggestedProperties,
    dataFlow: parsed.dataFlow || fallback.dataFlow,
    businessRules:
      Array.isArray(parsed.businessRules) && parsed.businessRules.length > 0
        ? parsed.businessRules
        : fallback.businessRules,
    output: rawOutput.length > 0 ? rawOutput : fallback.output,
  };
}

function generateSemanticPreview(result: ParsedIntent, query: string) {
  const bookTitleMatch = query.match(/《([^》]+)》/);
  const personNameMatch = query.match(/(?:读者|用户|会员)\s*([^\s，,。]+)/);
  const barcodeMatch = query.match(/(?:条码号?|barcode)\s*[:：]?\s*([A-Za-z0-9_-]+)/i);
  const dayMatch = query.match(/(\d+)\s*天/);
  const now = new Date();
  const startTime = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const durationDays = dayMatch ? Number(dayMatch[1]) : 5;
  const end = new Date(now);
  end.setDate(end.getDate() + durationDays);
  end.setHours(23, 59, 59, 0);
  const endTime = end.toISOString().replace(/\.\d{3}Z$/, "Z");
  const personName = personNameMatch?.[1] || "张三";
  const bookTitle = bookTitleMatch?.[1] || "目标图书";
  const barcode = barcodeMatch?.[1] || "TS2026001";
  const actionRuleName =
    result.action.id === "action-return"
      ? "归还规则"
      : result.action.id === "action-renew"
      ? "续借规则"
      : "普通借阅规则";
  const dsl =
    result.action.id === "action-return"
      ? `ACTION ReturnBook WITH Holding.barcode="${barcode}"`
      : result.action.id === "action-renew"
      ? `ACTION RenewLoan WITH Loan.barcode="${barcode}", renewDays=${durationDays}`
      : `ACTION CheckoutBook WITH Book.title="${bookTitle}", Patron.name="${personName}"`;
  const graphqlTemplate =
    result.action.id === "action-return"
      ? `mutation ReturnBook($barcode: String!) {
  returnBook(input: { barcode: $barcode }) {
    loanId
    loanStatus
    holdingStatus
    actualReturnDate
  }
}`
      : result.action.id === "action-renew"
      ? `mutation RenewLoan($barcode: String!, $renewDays: Int!) {
  renewLoan(input: { barcode: $barcode, renewDays: $renewDays }) {
    loanId
    dueDate
    renewalCount
  }
}`
      : `mutation CheckoutBook($bookTitle: String!, $patronName: String!) {
  checkoutBook(input: { bookTitle: $bookTitle, patronName: $patronName }) {
    loanId
    dueDate
    loanStatus
  }
}`;
  let templateVars: Record<string, string>;
  if (result.action.id === "action-return") {
    templateVars = { barcode };
  } else if (result.action.id === "action-renew") {
    templateVars = { barcode, renewDays: String(durationDays) };
  } else {
    templateVars = { bookTitle, patronName: personName };
  }
  const rdf =
    result.action.id === "action-return"
      ? `# 归还事件语义网络
lib:Event_Return_001 a lib:ReturnEvent ;
    lib:actor lib:Person_${personName} ;
    lib:object lib:Holding_${barcode} ;
    lib:actualReturnTime "${startTime}"^^xsd:dateTime ;
    lib:location lib:Branch_海淀馆 ;
    lib:permittedBy lib:Rule_${actionRuleName} ;
    lib:updatesLoan lib:Loan_${barcode} .

lib:Loan_${barcode} a lib:Loan ;
    lib:holding lib:Holding_${barcode} ;
    lib:borrower lib:Person_${personName} ;
    lib:loanStatus "RETURNED" ;
    lib:actualReturnDate "${startTime}"^^xsd:dateTime .

lib:Holding_${barcode} a lib:PhysicalBook ;
    lib:barcode "${barcode}" ;
    lib:holdingStatus "AVAILABLE" ;
    lib:shelfLocation "I247.5/12" .`
      : result.action.id === "action-renew"
      ? `# 续借事件语义网络
lib:Event_Renew_001 a lib:RenewEvent ;
    lib:actor lib:Person_${personName} ;
    lib:object lib:Loan_${barcode} ;
    lib:startTime "${startTime}"^^xsd:dateTime ;
    lib:endTime "${endTime}"^^xsd:dateTime ;
    lib:permittedBy lib:Rule_${actionRuleName} .

lib:Loan_${barcode} a lib:Loan ;
    lib:holding lib:Holding_${barcode} ;
    lib:borrower lib:Person_${personName} ;
    lib:dueDate "${endTime}"^^xsd:dateTime ;
    lib:renewalCount 1 .

lib:Holding_${barcode} a lib:PhysicalBook ;
    lib:barcode "${barcode}" ;
    dc:title "${bookTitle}" .`
      : `# 不仅仅是记录，而是语义网络
lib:Event_Loan_001 a lib:BorrowingEvent ;
    lib:actor lib:Person_${personName} ;
    lib:object lib:Book_${bookTitle} ;
    lib:startTime "${startTime}"^^xsd:dateTime ;
    lib:endTime "${endTime}"^^xsd:dateTime ;
    lib:location lib:Branch_海淀馆 ;
    lib:permittedBy lib:Rule_${actionRuleName} .

lib:Person_${personName} a lib:Member ;
    lib:name "${personName}" ;
    lib:hasCreditScore 850 ;
    lib:memberSince "2020-01-15"^^xsd:date .

lib:Book_${bookTitle} a lib:PhysicalBook ;
    dc:title "${bookTitle}" ;
    lib:instanceOf lib:Work_${bookTitle}原著 ;
    lib:shelfLocation "I247.5/12" ;
    lib:barcode "${barcode}" .`;

  const swrl =
    result.action.id === "action-return"
      ? `# SWRL 规则表达（归还一致性）
lib:Rule_归还状态同步 a lib:BusinessRule ;
    lib:if """
        ?event a lib:ReturnEvent .
        ?event lib:updatesLoan ?loan .
        ?loan a lib:Loan .
        ?loan lib:holding ?holding .
    """ ;
    lib:then """
        ?loan lib:loanStatus "RETURNED" .
        ?holding lib:holdingStatus "AVAILABLE" .
    """ .`
      : `# SWRL 规则表达
lib:Rule_逾期滞纳金 a lib:BusinessRule ;
    lib:if """
        ?loan a lib:Loan .
        ?loan lib:dueDate ?due .
        ?loan lib:actualReturnDate ?actual .
        ?loan lib:bookPrice ?price .
        swrlb:subtractDate(?diff, ?actual, ?due) .
        swrlb:greaterThan(?diff, 3) .
    """ ;
    lib:then """
        ?fine a lib:Fine .
        ?fine lib:basedOn ?loan .
        ?fine lib:amount swrlb:multiply(?price, 0.05) .
        ?fine lib:reason "逾期3天以上" .
    """ .`;

  const owl =
    result.action.id === "action-return"
      ? `Prefix: lib: <http://example.org/library#>
Prefix: owl: <http://www.w3.org/2002/07/owl#>
Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>

Ontology: <http://example.org/library>

Class: lib:ReturnEvent
    SubClassOf: lib:Event
    Annotations: rdfs:label "归还事件"

Class: lib:Loan
    SubClassOf: owl:Thing`
      : `Prefix: lib: <http://example.org/library#>
Prefix: owl: <http://www.w3.org/2002/07/owl#>
Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>

Ontology: <http://example.org/library>

Class: lib:BorrowingEvent
    SubClassOf: lib:Event
    Annotations: rdfs:label "借阅事件"

Class: lib:Book
    SubClassOf: owl:Thing`;

  return {
    query,
    generatedAt: new Date().toISOString(),
    semanticScenario:
      result.action.id === "action-return"
        ? `系统识别为“归还图书”场景：通过条码定位馆藏副本，更新对应借阅记录为已归还，并将馆藏状态恢复为可借。`
        : result.action.id === "action-renew"
        ? `系统识别为“续借”场景：针对指定借阅记录延长应还日期，并执行续借规则校验。`
        : `系统识别为“借阅”场景：基于读者与图书对象创建借阅事件，并派生应还时间与规则约束。`,
    rdf,
    owl,
    swrl,
    dsl,
    graphqlTemplate,
    templateVars,
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
  return (
    <div className="space-y-4">
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
      {result.entities.length > 0 && (
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
                      {entity.displayName}
                    </span>
                    <span className="text-[10px] text-[#6b6b6b] font-mono">
                      {entity.matchedText}
                    </span>
                  </div>
                  <Badge className="text-[9px] bg-[#3B82F6]/20 text-[#3B82F6] border-0">
                    {Math.round(entity.confidence * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 提取的参数 */}
      {result.suggestedProperties.length > 0 && (
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
                    <span className="text-sm text-white block">{prop.displayName}</span>
                    <span className="text-[10px] text-[#6b6b6b] font-mono">
                      {prop.propertyName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#10B981]">
                      {prop.value}
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
      {result.output && result.output.length > 0 && (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-[#8B5CF6]" />
              将生成的字段
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
                    <span className="text-sm text-white block">{out.displayName}</span>
                    <span className="text-[10px] text-[#6b6b6b]">{out.description}</span>
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
          "借阅《三体》这本书",
          "我需要借一本书，从明天开始算5天",
          "还书，条码号 ABC123",
          "查询所有超期的借阅记录",
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
