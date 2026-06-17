import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

const BASE_URL = process.env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7";

function buildMessagesUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/messages")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/messages`;
  return `${normalized}/v1/messages`;
}

function extractTextBlocks(content: any[] = []) {
  return content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  const body = await req.json().catch(() => null);
  const message = body?.message?.toString?.().trim?.();
  const context = body?.context;

  if (!message) {
    return NextResponse.json({ error: "message 不能为空" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({
      reply:
        "当前环境未配置大模型 API Key（MINIMAX_API_KEY / ANTHROPIC_API_KEY）。你可以先配置后再使用咨询模式对话。",
    });
  }

  const system = `你是“本体业务咨询助手”。你的任务：
1) 帮助用户在业务梳理阶段划分业务域边界，并根据本体实体类型（ObjectType）评估规模与复杂度；
2) 所有回答必须基于提供的本体与业务域上下文，不要臆测不存在的实体/关系；
3) 输出尽量结构化：先结论，再给清单/建议步骤；
4) 当用户要求产出“规划结果”时，输出一个 JSON 段落（放在 \`\`\`json 代码块中），包含：
   - proposedDomains：业务域落地计划数组，每项包含 name/description/entities（entities 可包含 existingObjectTypeId 或 displayName/description/scale）
   - domainSummary：简短总结
   - entityScaleAdjustments：对“当前选中业务域”中已有实体的规模调整建议（优先用 objectTypeId）
   - missingEntities：建议新增的实体清单（displayName/description 可选）
   - missingLinks：建议新增的关系清单（source/target 可用 objectTypeId 或 displayName；包含 displayName/cardinality/description 可选）
   - nextQuestions：建议继续追问的问题列表`;

  const prompt = `上下文（Ontology + 业务域规划）：
${JSON.stringify(context, null, 2)}

用户：${message}
请用中文回答。`;

  const payload = {
    model: MODEL,
    max_tokens: 2400,
    temperature: 0.2,
    system,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
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
    return NextResponse.json({ error: "LLM 调用失败", detail: errorText.slice(0, 800) }, { status: 502 });
  }

  const result = await response.json();
  const text = extractTextBlocks(result?.content || []);
  return NextResponse.json({ reply: text || "（空响应）" });
}
