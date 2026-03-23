"use client";

import React, { useState, useCallback } from "react";
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

  const { actionTypes, objectTypes, businessRules } = useOntologyStore();
  const {
    selectActionType,
    setSemanticHighlightedNodeIds,
    clearSemanticHighlightedNodeIds,
    setSemanticQueryPreview,
    clearSemanticQueryPreview,
  } = useSelectionStore();
  const { openRightPanel } = useUIStore();

  // 解析查询
  const parseQuery = useCallback(() => {
    if (!query.trim()) {
      setParsedResult(null);
      clearSemanticHighlightedNodeIds();
      clearSemanticQueryPreview();
      return;
    }

    setIsLoading(true);

    // 模拟解析延迟
    setTimeout(() => {
      const result = performParsing(query, actionTypes, objectTypes, businessRules);
      setParsedResult(result);
      setSemanticHighlightedNodeIds(deriveHighlightedObjectTypeIds(result, objectTypes, query));
      setSemanticQueryPreview(generateSemanticPreview(result, query));
      setIsLoading(false);
    }, 500);
  }, [
    query,
    actionTypes,
    objectTypes,
    businessRules,
    setSemanticHighlightedNodeIds,
    clearSemanticHighlightedNodeIds,
    setSemanticQueryPreview,
    clearSemanticQueryPreview,
  ]);

  React.useEffect(() => {
    return () => {
      clearSemanticHighlightedNodeIds();
      clearSemanticQueryPreview();
    };
  }, [clearSemanticHighlightedNodeIds, clearSemanticQueryPreview]);

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
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">语义查询端口</h2>
            <p className="text-[10px] text-[#6b6b6b]">自然语言 → 本体映射</p>
          </div>
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

function generateSemanticPreview(result: ParsedIntent, query: string) {
  const bookTitleMatch = query.match(/《([^》]+)》/);
  const personNameMatch = query.match(/(?:读者|用户|会员)\s*([^\s，,。]+)/);
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
  const actionRuleName =
    result.action.id === "action-return"
      ? "归还规则"
      : result.action.id === "action-renew"
      ? "续借规则"
      : "普通借阅规则";

  const rdf = `# 不仅仅是记录，而是语义网络
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
    lib:barcode "TS2026001" .`;

  const swrl = `# SWRL 规则表达
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

  return {
    query,
    generatedAt: new Date().toISOString(),
    rdf,
    swrl,
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
                查看详情
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
