import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

const BASE_URL = process.env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7";

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

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  const body = await req.json().catch(() => null);
  const query = body?.query?.toString?.().trim?.();
  const context = body?.context;

  if (!query) {
    return NextResponse.json({ error: "query 不能为空" }, { status: 400 });
  }

  if (!apiKey) {
    // Return a mock response if no API key is provided
    return NextResponse.json({
      sql: "SELECT * FROM mock_table WHERE condition = 'mock';",
      api: {
        endpoint: "/api/mock",
        method: "POST",
        payload: { query }
      }
    });
  }

  const prompt = `你是 ORM 框架转换助手，负责将用户的自然语言请求转换为后台程序可使用的稳定 JSON 结构。
该 JSON 必须基于提供的 Ontology 模型推导生成，不要臆测或者猜想数据。

如果用户描述的动作在 actionTypes 中有匹配的定义：
1. 请检查该 actionType 是否包含 \`apiBinding\` 配置。
2. 如果 \`apiBinding.mode === 'CUSTOM_API'\`，说明这是一个自定义接口，请将 \`apiBinding.apiEndpoint\` 等信息填入返回 JSON 的 \`api\` 字段。
3. 如果 \`apiBinding.mode === 'BUILTIN_UPDATE'\` 或是没有配置（基础版本），说明这是一个内置字典更新，请在 JSON 的 \`sql\` 字段生成对应的 \`UPDATE ... SET ... WHERE id = ...\` 或 \`INSERT\` 语句。

JSON 结构必须包含以下字段：
- sql: 用于查询或更新的 SQL 语句。如果动作绑定的是基础内置更新，则生成对应的 update/insert sql；如果是纯查询，也在此提供 sql。必须推导出具体的表名和字段（可以基于 objectTypes 的 apiName 或 displayName 加上常识推断）。
- api: (可选) 如果动作绑定了自定义 API (CUSTOM_API)，这里提供 API 的基本信息（如 endpoint, method, payload）。

请参考以下上下文中的 Ontology 模型数据推导：
${JSON.stringify(context, null, 2)}

用户输入：${query}

请严格返回 JSON 格式，不要输出其他无关文本。
`;

  const payload = {
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.1,
    system: "你是一个专业的 ORM 转换引擎。",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  };

  try {
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
      console.error("LLM Request Failed:", response.status, errorText);
      return NextResponse.json({ error: "LLM 调用失败", detail: errorText.slice(0, 800) }, { status: 502 });
    }

    const result = await response.json();
    const text = extractTextBlocks(result?.content || []);
    const parsed = safeParseJSON(text);

    if (parsed) {
      return NextResponse.json(parsed);
    } else {
      return NextResponse.json({
        sql: "无法生成有效 SQL，解析失败",
        rawResponse: text,
      });
    }
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}