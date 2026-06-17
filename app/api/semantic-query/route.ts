import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

const BASE_URL = process.env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7";
const CASE_EXAMPLES: any[] = [];

function buildMessagesUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/messages")) {
    return normalized;
  }
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
  return "系统将用户输入解析为动作、实体与参数，并生成可执行的查询/调用模板预览。";
}

function fallbackRdf(query: string) {
  const escaped = query.trim().replaceAll('"', '\\"');
  return `lib:Query a lib:SemanticQuery ;
    lib:text "${escaped}" .`;
}

function fallbackOwl() {
  return `Class: lib:SemanticQuery
  Annotations: rdfs:label "语义查询"`;
}

function fallbackSwrl() {
  return `lib:Rule_Generic a lib:BusinessRule ;
    lib:then """ true """ .`;
}

function fallbackParsedResult(query: string) {
  const normalized = query.trim();
  return {
    action: { id: "action-generic", name: "GenericAction", displayName: "语义解析", layer: "KINETIC" },
    entities: normalized ? [{ type: "TEXT", id: "query", name: "Query", displayName: "输入语句", confidence: 0.5, matchedText: normalized }] : [],
    suggestedProperties: [],
    dataFlow: { id: "flow-generic", name: "GenericFlow", steps: ["1. 解析意图", "2. 识别实体", "3. 提取参数", "4. 生成执行模板"] },
    businessRules: [{ id: "rule-generic", name: "通用规则校验", status: "WARN", message: "建议人工确认关键参数与约束" }],
    output: [{ propertyId: "result", propertyName: "result", displayName: "结果", description: "返回动作执行结果字段" }],
  };
}

function fallbackDsl(query: string, parsedResult: any) {
  const actionName = parsedResult?.action?.name || "GenericAction";
  const escaped = query.trim().replaceAll('"', '\\"');
  return `ACTION ${actionName} WITH Query.text="${escaped}"`;
}

function fallbackTemplateVars(query: string, parsedResult: any): Record<string, string> {
  return { query: query.trim() };
}

function fallbackGraphqlTemplate(parsedResult: any) {
  return `query SemanticQuery($query: String!) {
  semanticQuery(query: $query) {
    receipt
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
  return `你是“语义解析构建Agent”，负责基于用户输入同步构建：
1) 解析结果 action
2) 识别的实体 entities
3) 提取的参数 suggestedProperties
4) 将生成的字段 output

以下是可选风格参考（可能为空）：
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
8) parsedResult 必须可直接用于界面展示（解析结果、识别的实体、提取的参数、将生成的字段）。
9) 务必保证 parsedResult 四个部分完整且可用。`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  const body = await req.json().catch(() => null);
  const query = body?.query?.toString?.().trim?.();

  if (!query) {
    return NextResponse.json({ error: "query 不能为空" }, { status: 400 });
  }

  let reasoning = "";
  let parsed: any = null;
  let rdfFromText = "";
  let swrlFromText = "";

  if (apiKey) {
    const prompt = buildSemanticAgentPrompt(query);

    const payload = {
      model: MODEL,
      max_tokens: 10000,
      temperature: 0.3,
      system: "你是本体建模与语义查询专家，擅长把自然语言转换为语义网络与规则表达。",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `${prompt}\n\n用户输入：${query}` }],
        },
      ],
    };

    const response = await fetch(buildMessagesUrl(BASE_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM Request Failed in /api/semantic-query:", response.status, errorText);
      return NextResponse.json({ error: "MiniMax 调用失败", detail: errorText.slice(0, 800) }, { status: 502 });
    }

    const result = await response.json();
    const text = extractTextBlocks(result?.content || []);
    reasoning = extractThinkingBlocks(result?.content || []);
    parsed = safeParseJSON(text);
    rdfFromText = extractCodeFence(text, "turtle") || extractCodeFence(text, "ttl") || "";
    swrlFromText = extractCodeFence(text, "swrl") || "";
  } else {
    reasoning = "未配置 LLM Key，已使用本地规则回退生成预览。";
  }

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
    sql: null,
    sqlVars: null,
    reasoning,
    parsedResult
  });
}
