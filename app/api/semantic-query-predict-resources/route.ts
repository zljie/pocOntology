import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_URL = process.env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7";

function buildMessagesUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/v1")) {
    return `${normalized}/messages`;
  }
  return `${normalized}/v1/messages`;
}

function extractTextBlocks(content: any[] = []) {
  return content
    .filter((block: any) => block?.type === "text" && typeof block?.text === "string")
    .map((block: any) => block.text)
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

function buildPredictAgentPrompt(parsedResultStr: string) {
  return `你是“资源与数据结构预测Agent”。根据用户输入的语义查询解析结果，推断并预测在右侧业务面板中应该展示哪些后端资源信息与数据结构。

请基于传入的 parsedResult 分析，严格返回 JSON，不要输出额外文本。

JSON schema:
{
  "resources": [
    {
      "name": "string (资源/服务名称，如 User Service)",
      "type": "string (资源类型，如 Microservice, Database, API, Message Queue)",
      "description": "string (该资源在此业务场景中的作用)"
    }
  ],
  "dataStructures": [
    {
      "name": "string (数据模型/表/实体名称，如 LoanRecord)",
      "fields": [
        {
          "name": "string (字段名)",
          "type": "string (数据类型，如 String, Integer, DateTime)",
          "description": "string (字段含义)"
        }
      ]
    }
  ]
}

要求：
1) 返回必须是合法的 JSON 对象。
2) 预测的资源和数据结构必须合理匹配业务场景。比如：如果是“借书”场景，资源可能是“图书管理服务”、“借阅流水表”；数据结构可能包含“借阅ID”、“读者ID”、“应还日期”等。
3) 不要有任何非JSON输出。
`;
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
  const parsedResult = body?.parsedResult;

  if (!parsedResult) {
    return NextResponse.json({ error: "parsedResult 不能为空" }, { status: 400 });
  }

  const prompt = buildPredictAgentPrompt(JSON.stringify(parsedResult));

  const payload = {
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.3,
    system: "你是资源分析与架构推演专家，擅长从业务语义解析出所需的服务资源与底层数据结构。",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${prompt}\n\n解析结果：\n${JSON.stringify(parsedResult, null, 2)}` }
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
    console.error("LLM Request Failed in /api/semantic-query-predict-resources:", response.status, errorText);
    return NextResponse.json(
      { error: "MiniMax 调用失败", detail: errorText.slice(0, 800) },
      { status: 502 }
    );
  }

  const result = await response.json();
  const text = extractTextBlocks(result?.content || []);
  const parsed = safeParseJSON(text);

  if (!parsed) {
    // Fallback logic in case of parsing failure
    return NextResponse.json({
      resources: [
        { name: "Core Business Service", type: "Microservice", description: "核心业务逻辑处理服务" },
        { name: "Main Database", type: "Database", description: "存储核心业务数据" }
      ],
      dataStructures: [
        {
          name: "TransactionRecord",
          fields: [
            { name: "id", type: "String", description: "流水主键" },
            { name: "status", type: "String", description: "状态" },
            { name: "createdAt", type: "DateTime", description: "创建时间" }
          ]
        }
      ]
    });
  }

  return NextResponse.json({
    resources: parsed.resources || [],
    dataStructures: parsed.dataStructures || []
  });
}
