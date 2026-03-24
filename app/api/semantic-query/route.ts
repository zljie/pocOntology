import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_URL = process.env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7";
const CASE_EXAMPLES = [
  {
    caseId: "case-checkout",
    input: "借阅《三体》",
    dsl: "ACTION CheckoutBook WITH Book.title=\"三体\"",
    graphqlTemplate:
      "mutation CheckoutBook($bookTitle: String!, $patronName: String!) { checkoutBook(input: { bookTitle: $bookTitle, patronName: $patronName }) { loanId dueDate loanStatus } }",
    templateVars: { bookTitle: "三体", patronName: "张三" },
    parsedResult: {
      action: { id: "action-checkout", name: "CheckoutBook", displayName: "借书", layer: "KINETIC" },
      entities: [
        { type: "OBJECT_TYPE", id: "book-001", name: "Book", displayName: "图书", confidence: 0.95, matchedText: "三体" },
        { type: "OBJECT_TYPE", id: "patron-001", name: "Patron", displayName: "读者", confidence: 0.8, matchedText: "借阅" },
      ],
      suggestedProperties: [
        { propertyId: "title", propertyName: "title", displayName: "书名", value: "三体", inferred: false, source: "STRING", objectTypeId: "book-001" },
      ],
      output: [
        { propertyId: "loanId", propertyName: "loanId", displayName: "借阅ID", description: "生成借阅流水号" },
        { propertyId: "dueDate", propertyName: "dueDate", displayName: "应还日期", description: "按规则计算应还日期" },
      ],
    },
  },
  {
    caseId: "case-return",
    input: "还书，条码号 ABC123",
    dsl: "ACTION ReturnBook WITH Holding.barcode=\"ABC123\"",
    graphqlTemplate:
      "mutation ReturnBook($barcode: String!) { returnBook(input: { barcode: $barcode }) { loanId loanStatus holdingStatus actualReturnDate } }",
    templateVars: { barcode: "ABC123" },
    parsedResult: {
      action: { id: "action-return", name: "ReturnBook", displayName: "还书", layer: "KINETIC" },
      entities: [
        { type: "OBJECT_TYPE", id: "holding-001", name: "Holding", displayName: "馆藏副本", confidence: 0.96, matchedText: "条码号" },
        { type: "OBJECT_TYPE", id: "loan-001", name: "Loan", displayName: "借阅记录", confidence: 0.92, matchedText: "还书" },
      ],
      suggestedProperties: [
        { propertyId: "barcode", propertyName: "barcode", displayName: "条码号", value: "ABC123", inferred: false, source: "STRING", objectTypeId: "holding-001" },
      ],
      output: [
        { propertyId: "actualReturnDate", propertyName: "actualReturnDate", displayName: "实际归还时间", description: "写入归还时间戳" },
        { propertyId: "holdingStatus", propertyName: "holdingStatus", displayName: "馆藏状态", description: "更新为 AVAILABLE" },
      ],
    },
  },
  {
    caseId: "case-overdue-fine",
    input: "查询超期罚款",
    dsl: "ACTION QueryOverdueFine WITH Loan.status=\"OVERDUE\"",
    graphqlTemplate:
      "query QueryOverdueFine($loanStatus: String!) { overdueFines(filter: { loanStatus: $loanStatus }) { loanId amount daysOverdue } }",
    templateVars: { loanStatus: "OVERDUE" },
    parsedResult: {
      action: { id: "action-query-overdue-fine", name: "QueryOverdueFine", displayName: "查询超期罚款", layer: "KINETIC" },
      entities: [
        { type: "OBJECT_TYPE", id: "loan-001", name: "Loan", displayName: "借阅记录", confidence: 0.9, matchedText: "超期" },
        { type: "OBJECT_TYPE", id: "fine-001", name: "Fine", displayName: "罚款记录", confidence: 0.93, matchedText: "罚款" },
      ],
      suggestedProperties: [
        { propertyId: "loanStatus", propertyName: "loanStatus", displayName: "借阅状态", value: "OVERDUE", inferred: true, source: "STRING", objectTypeId: "loan-001" },
      ],
      output: [
        { propertyId: "amount", propertyName: "amount", displayName: "罚款金额", description: "按滞纳规则计算" },
        { propertyId: "daysOverdue", propertyName: "daysOverdue", displayName: "逾期天数", description: "根据应还日期与当前日期计算" },
      ],
    },
  },
];

function buildMessagesUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/v1")) {
    return `${normalized}/messages`;
  }
  return `${normalized}/v1/messages`;
}

function extractTextBlocks(content: any[] = []) {
  return content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function extractThinkingBlocks(content: any[] = []) {
  return content
    .filter((block) => block?.type === "thinking" && typeof block?.thinking === "string")
    .map((block) => block.thinking)
    .join("\n");
}

function safeParseJSON(text: string) {
  const tryParse = (value?: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const fencedMatches = text.match(/```json\s*[\s\S]*?```/gi) || [];
  for (const fenced of fencedMatches) {
    const cleaned = fenced.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = tryParse(cleaned);
    if (parsed) return parsed;
  }

  const candidateObjects: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        candidateObjects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  for (const candidate of candidateObjects) {
    const parsed = tryParse(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function extractCodeFence(text: string, language?: string) {
  if (language) {
    const byLang = text.match(new RegExp("```" + language + "\\s*([\\s\\S]*?)\\s*```", "i"));
    if (byLang?.[1]) return byLang[1].trim();
  }
  const fences = text.match(/```[\s\S]*?```/g) || [];
  for (const fence of fences) {
    const content = fence.replace(/^```[a-zA-Z]*\s*/i, "").replace(/```$/, "").trim();
    if (content) return content;
  }
  return "";
}

function fallbackSemanticScenario(query: string) {
  if (query.includes("还")) {
    return "系统识别为归还场景：通过条码定位馆藏副本，关联借阅记录并更新归还状态。";
  }
  if (query.includes("续借")) {
    return "系统识别为续借场景：定位借阅记录并延长应还日期，执行续借规则校验。";
  }
  return "系统识别为借阅场景：解析读者与图书实体，生成借阅事件与规则约束。";
}

function fallbackRdf(query: string) {
  const barcode = query.match(/(?:条码号?|barcode)\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] || "TS2026001";
  return `lib:Event_Return_001 a lib:ReturnEvent ;
    lib:object lib:Holding_${barcode} ;
    lib:updatesLoan lib:Loan_${barcode} .

lib:Loan_${barcode} a lib:Loan ;
    lib:holding lib:Holding_${barcode} ;
    lib:loanStatus "RETURNED" .`;
}

function fallbackOwl() {
  return `Prefix: lib: <http://example.org/library#>
Prefix: owl: <http://www.w3.org/2002/07/owl#>
Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>

Ontology: <http://example.org/library>

Class: lib:ReturnEvent
    SubClassOf: lib:Event

Class: lib:Loan
    SubClassOf: owl:Thing`;
}

function fallbackSwrl() {
  return `lib:Rule_归还状态同步 a lib:BusinessRule ;
    lib:if """
        ?event a lib:ReturnEvent .
        ?event lib:updatesLoan ?loan .
        ?loan lib:holding ?holding .
    """ ;
    lib:then """
        ?loan lib:loanStatus "RETURNED" .
        ?holding lib:holdingStatus "AVAILABLE" .
    """ .`;
}

function fallbackParsedResult(query: string) {
  const barcode = query.match(/(?:条码号?|barcode)\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] || "ABC123";
  const isReturn = query.includes("还");
  const isRenew = query.includes("续借");
  const action = isReturn
    ? { id: "action-return", name: "ReturnBook", displayName: "还书", layer: "KINETIC" }
    : isRenew
    ? { id: "action-renew", name: "RenewLoan", displayName: "续借", layer: "KINETIC" }
    : { id: "action-checkout", name: "CheckoutBook", displayName: "借书", layer: "KINETIC" };

  const entities = isReturn
    ? [
        { type: "OBJECT_TYPE", id: "holding-001", name: "Holding", displayName: "馆藏副本", confidence: 0.92, matchedText: "条码号" },
        { type: "OBJECT_TYPE", id: "loan-001", name: "Loan", displayName: "借阅记录", confidence: 0.88, matchedText: "还书" }
      ]
    : [
        { type: "OBJECT_TYPE", id: "book-001", name: "Book", displayName: "图书", confidence: 0.9, matchedText: "图书" },
        { type: "OBJECT_TYPE", id: "patron-001", name: "Patron", displayName: "读者", confidence: 0.78, matchedText: "用户" }
      ];

  const suggestedProperties = isReturn
    ? [
        { propertyId: "barcode", propertyName: "barcode", displayName: "条码号", value: barcode, inferred: false, source: "STRING", objectTypeId: "holding-001" },
        { propertyId: "loanStatus", propertyName: "loanStatus", displayName: "借阅状态", value: "RETURNED", inferred: true, source: "STRING", objectTypeId: "loan-001" }
      ]
    : [
        { propertyId: "title", propertyName: "title", displayName: "书名", value: "目标图书", inferred: true, source: "STRING", objectTypeId: "book-001" }
      ];

  return {
    action,
    entities,
    suggestedProperties,
    dataFlow: {
      id: isReturn ? "flow-return" : "flow-checkout",
      name: isReturn ? "ReturnProcess" : "CheckoutProcess",
      steps: isReturn
        ? ["1. 定位馆藏副本", "2. 关联借阅记录", "3. 更新借阅状态", "4. 更新馆藏状态"]
        : ["1. 识别操作意图", "2. 识别业务实体", "3. 提取关键参数", "4. 生成业务字段"]
    },
    businessRules: isReturn
      ? [{ id: "rule-return-sync", name: "归还状态一致性", status: "PASS", message: "借阅与馆藏状态将同步更新" }]
      : [{ id: "rule-default", name: "业务规则校验", status: "WARN", message: "建议人工确认规则参数" }],
    output: isReturn
      ? [
          { propertyId: "actualReturnDate", propertyName: "actualReturnDate", displayName: "实际归还时间", description: "系统记录归还时间戳" },
          { propertyId: "holdingStatus", propertyName: "holdingStatus", displayName: "馆藏状态", description: "更新为 AVAILABLE（可借）" }
        ]
      : [{ propertyId: "flowId", propertyName: "flowId", displayName: "流程ID", description: "系统生成语义处理流程标识" }]
  };
}

function fallbackDsl(query: string, parsedResult: any) {
  const actionId = parsedResult?.action?.id || "";
  const barcode = query.match(/(?:条码号?|barcode)\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1];
  const bookTitle = query.match(/《([^》]+)》/)?.[1];
  if (actionId === "action-return") {
    return `ACTION ReturnBook WITH Holding.barcode="${barcode || "ABC123"}"`;
  }
  if (actionId === "action-renew") {
    return `ACTION RenewLoan WITH Loan.barcode="${barcode || "ABC123"}"`;
  }
  if (actionId === "action-query-overdue-fine") {
    return `ACTION QueryOverdueFine WITH Loan.status="OVERDUE"`;
  }
  return `ACTION CheckoutBook WITH Book.title="${bookTitle || "目标图书"}"`;
}

function fallbackTemplateVars(query: string, parsedResult: any): Record<string, string> {
  const actionId = parsedResult?.action?.id || "";
  const barcode = query.match(/(?:条码号?|barcode)\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] || "ABC123";
  const bookTitle = query.match(/《([^》]+)》/)?.[1] || "目标图书";
  const patronName = query.match(/(?:读者|用户|会员)\s*([^\s，,。]+)/)?.[1] || "张三";
  if (actionId === "action-return") {
    return { barcode };
  }
  if (actionId === "action-renew") {
    return { barcode, renewDays: "7" };
  }
  if (actionId === "action-query-overdue-fine") {
    return { loanStatus: "OVERDUE" };
  }
  return { bookTitle, patronName };
}

function fallbackGraphqlTemplate(parsedResult: any) {
  const actionId = parsedResult?.action?.id || "";
  if (actionId === "action-return") {
    return `mutation ReturnBook($barcode: String!) {
  returnBook(input: { barcode: $barcode }) {
    loanId
    loanStatus
    holdingStatus
    actualReturnDate
  }
}`;
  }
  if (actionId === "action-renew") {
    return `mutation RenewLoan($barcode: String!, $renewDays: Int!) {
  renewLoan(input: { barcode: $barcode, renewDays: $renewDays }) {
    loanId
    dueDate
    renewalCount
  }
}`;
  }
  if (actionId === "action-query-overdue-fine") {
    return `query QueryOverdueFine($loanStatus: String!) {
  overdueFines(filter: { loanStatus: $loanStatus }) {
    loanId
    amount
    daysOverdue
  }
}`;
  }
  return `mutation CheckoutBook($bookTitle: String!, $patronName: String!) {
  checkoutBook(input: { bookTitle: $bookTitle, patronName: $patronName }) {
    loanId
    dueDate
    loanStatus
  }
}`;
}

function normalizeServerParsedResult(parsedResult: any, query: string) {
  if (!parsedResult || typeof parsedResult !== "object") {
    return fallbackParsedResult(query);
  }

  const rawAction = parsedResult.action || parsedResult.intentAction || null;
  const rawEntities = Array.isArray(parsedResult.entities)
    ? parsedResult.entities
    : Array.isArray(parsedResult.identifiedEntities)
    ? parsedResult.identifiedEntities
    : [];
  const rawSuggestedProperties = Array.isArray(parsedResult.suggestedProperties)
    ? parsedResult.suggestedProperties
    : Array.isArray(parsedResult.extractedParams)
    ? parsedResult.extractedParams
    : Array.isArray(parsedResult.parameters)
    ? parsedResult.parameters
    : [];
  const rawOutput = Array.isArray(parsedResult.output)
    ? parsedResult.output
    : Array.isArray(parsedResult.generatedFields)
    ? parsedResult.generatedFields
    : [];

  const fallback = fallbackParsedResult(query);

  return {
    action: rawAction?.id
      ? {
          id: rawAction.id,
          name: rawAction.name || fallback.action.name,
          displayName: rawAction.displayName || fallback.action.displayName,
          layer: rawAction.layer || "KINETIC",
        }
      : fallback.action,
    entities:
      rawEntities.length > 0
        ? rawEntities.map((entity: any) => ({
            type: entity.type || "OBJECT_TYPE",
            id: entity.id,
            name: entity.name || entity.displayName || "",
            displayName: entity.displayName || entity.name || "",
            confidence: typeof entity.confidence === "number" ? entity.confidence : 0.8,
            matchedText: entity.matchedText || entity.displayName || entity.name || "",
          }))
        : fallback.entities,
    suggestedProperties:
      rawSuggestedProperties.length > 0
        ? rawSuggestedProperties.map((prop: any) => ({
            propertyId: prop.propertyId || "",
            propertyName: prop.propertyName || prop.displayName || "",
            displayName: prop.displayName || prop.propertyName || "",
            value: String(prop.value ?? ""),
            inferred: Boolean(prop.inferred),
            source: prop.source || "STRING",
            objectTypeId: prop.objectTypeId,
          }))
        : fallback.suggestedProperties,
    dataFlow: parsedResult.dataFlow || fallback.dataFlow,
    businessRules:
      Array.isArray(parsedResult.businessRules) && parsedResult.businessRules.length > 0
        ? parsedResult.businessRules
        : fallback.businessRules,
    output: rawOutput.length > 0 ? rawOutput : fallback.output,
  };
}

function buildSemanticAgentPrompt(query: string) {
  const examples = JSON.stringify(CASE_EXAMPLES, null, 2);
  return `你是“语义解析构建Agent”，负责在用户输入不属于已知案例时，同步构建：
1) 解析结果 action
2) 识别的实体 entities
3) 提取的参数 suggestedProperties
4) 将生成的字段 output

请参考以下3个案例作为风格基准，并对“案例外输入”做最接近的语义泛化：
${examples}

请基于用户输入生成语义理解结果，严格返回 JSON，不要输出额外文本。
JSON schema:
{
  "semanticScenario": "string",
  "rdf": "string",
  "owl": "string",
  "swrl": "string",
  "dsl": "string",
  "graphqlTemplate": "string",
  "templateVars": {"key":"string"},
  "parsedResult": {
    "action": {"id":"string","name":"string","displayName":"string","layer":"SEMANTIC|KINETIC|DYNAMIC"},
    "entities": [{"type":"OBJECT_TYPE|LINK_TYPE|ACTION_TYPE|PROPERTY|VALUE","id":"string","name":"string","displayName":"string","confidence":0.0,"matchedText":"string"}],
    "suggestedProperties": [{"propertyId":"string","propertyName":"string","displayName":"string","value":"string","inferred":true,"source":"STRING|INTEGER|DOUBLE|TIMESTAMP","objectTypeId":"string"}],
    "dataFlow": {"id":"string","name":"string","steps":["string"]},
    "businessRules": [{"id":"string","name":"string","status":"PASS|FAIL|WARN","message":"string"}],
    "output": [{"propertyId":"string","propertyName":"string","displayName":"string","description":"string"}]
  }
}
要求:
1) semanticScenario 用中文，描述业务语义场景与对象关系。
2) rdf 使用 Turtle 风格，前缀使用 lib: 和 xsd:。
3) owl 提供基于 OWL Manchester 语法的本体结构描述，表达该场景依赖的核心本体定义（如类、属性及层级关系）。
4) swrl 输出可执行的规则表达。
5) dsl 使用简洁动作语法，表达“语义到执行”的意图。
6) graphqlTemplate 输出可执行 GraphQL 模板，变量使用 $var 形式。
7) templateVars 提供默认变量值，便于直接发起调用。
8) 对于“还书、条码号”场景，必须围绕 ReturnEvent、Loan、Holding 一致性表达。
9) parsedResult 必须可直接用于界面展示（解析结果、识别的实体、提取的参数、将生成的字段）。
10) 如果输入是案例外内容，务必保证 parsedResult 四个部分完整且可用。`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "缺少 MINIMAX_API_KEY（或 ANTHROPIC_API_KEY）环境变量" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const query = body?.query?.toString?.().trim?.();

  if (!query) {
    return NextResponse.json({ error: "query 不能为空" }, { status: 400 });
  }

  const prompt = buildSemanticAgentPrompt(query);

  const payload = {
    model: MODEL,
    max_tokens: 10000,
    temperature: 0.3,
    system: "你是本体建模与语义查询专家，擅长把自然语言转换为语义网络与规则表达。",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${prompt}\n\n用户输入：${query}` }
        ]
      }
    ]
  };

  const response = await fetch(buildMessagesUrl(BASE_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "Authorization": `Bearer ${apiKey}`,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LLM Request Failed in /api/semantic-query:", response.status, errorText);
    return NextResponse.json(
      { error: "MiniMax 调用失败", detail: errorText.slice(0, 800) },
      { status: 502 }
    );
  }

  const result = await response.json();
  const text = extractTextBlocks(result?.content || []);
  const reasoning = extractThinkingBlocks(result?.content || []);
  const parsed = safeParseJSON(text);
  const rdfFromText = extractCodeFence(text, "turtle") || extractCodeFence(text, "ttl");
  const swrlFromText = extractCodeFence(text, "swrl");

  const semanticScenario = (parsed?.semanticScenario || "").trim() || fallbackSemanticScenario(query);
  const rdf = (parsed?.rdf || "").trim() || rdfFromText || fallbackRdf(query);
  const owl = (parsed?.owl || "").trim() || fallbackOwl();
  const swrl = (parsed?.swrl || "").trim() || swrlFromText || fallbackSwrl();
  const parsedResult = normalizeServerParsedResult(parsed?.parsedResult, query);
  const dsl =
    (parsed?.dsl || parsed?.queryDsl || parsed?.dslQuery || "").trim() || fallbackDsl(query, parsedResult);
  const graphqlTemplate =
    (parsed?.graphqlTemplate || parsed?.graphql || parsed?.graphqlQuery || "").trim() ||
    fallbackGraphqlTemplate(parsedResult);
  const rawTemplateVars = parsed?.templateVars || parsed?.graphqlVariables || parsed?.variables;
  const templateVars =
    rawTemplateVars && typeof rawTemplateVars === "object"
      ? Object.fromEntries(
          Object.entries(rawTemplateVars).map(([key, value]) => [String(key), String(value ?? "")])
        )
      : fallbackTemplateVars(query, parsedResult);

  return NextResponse.json({
    semanticScenario,
    rdf,
    owl,
    swrl,
    dsl,
    graphqlTemplate,
    templateVars,
    reasoning,
    parsedResult
  });
}
