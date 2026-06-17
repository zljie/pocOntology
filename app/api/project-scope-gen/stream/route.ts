import { NextRequest } from "next/server";

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

function safeParseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const block = text.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
    if (!block) return null;
    try {
      return JSON.parse(block);
    } catch {
      return null;
    }
  }
}

async function requestAgentText(apiKey: string, system: string, prompt: string, maxTokens = 1800) {
  const payload = {
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.25,
    system,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  };

  const response = await fetch(buildMessagesUrl(BASE_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LLM Request Failed:", response.status, errorText);
    return { text: "", stopReason: "http_error" as const };
  }

  const result = await response.json();
  return {
    text: extractTextBlocks(result?.content || []),
    stopReason: typeof result?.stop_reason === "string" ? result.stop_reason : "",
  };
}

function splitTextByChunk(text: string, size = 18) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fallbackScope(userInput: string) {
  const assistantMarkdown =
    `我先把你的项目业务范围做一个可落地的“范围/边界/关键名词”摘要，然后你确认即可。\n\n` +
    `你输入：${userInput}\n\n` +
    `请补充：\n- 你明确不做的内容有哪些？\n- 最核心的业务对象（名词）有哪些？\n- 是否存在审批/权限/组织维度？`;

  return {
    assistantMarkdown,
    scope: {
      scopeSummary: "业务范围草案（待补充确认）",
      inScope: ["核心业务流程", "核心业务对象", "关键状态与规则"],
      outOfScope: ["财务结算/对账（如不在范围内）", "外部系统集成（如不在范围内）"],
      coreDomains: [],
      glossary: [],
      openQuestions: ["明确系统边界：哪些模块不做？", "是否存在组织/权限/审批流？", "关键编码规则是什么？"],
    },
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  const body = await req.json().catch(() => null);
  const input = body?.input?.toString?.().trim?.() || "";

  if (!input) return new Response("input 不合法", { status: 400 });

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, payload: Record<string, any>) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const system = "你是资深业务分析师与本体建模顾问。你负责把用户的项目描述整理成可执行的业务范围与边界。";
        const prompt =
          `仅返回 JSON，不要额外文本。schema:\n` +
          `{"assistantMarkdown":"string","scope":{"scopeSummary":"string","inScope":["string"],"outOfScope":["string"],"coreDomains":["string"],"glossary":[{"term":"string","meaning":"string"}],"openQuestions":["string"]}}\n\n` +
          `规则：\n` +
          `- assistantMarkdown 用中文：复述用户输入 + 给出范围/边界的解释 + 提出需要用户确认的关键问题。\n` +
          `- inScope/outOfScope 必须具体、可验收。\n` +
          `- glossary 只收录关键名词（最多 12 个）。\n` +
          `- openQuestions 用于驱动下一步对象与场景建模。\n\n` +
          `用户输入：${input}`;

        const result = apiKey ? await requestAgentText(apiKey, system, prompt, 2000) : { text: "", stopReason: "" };
        const json = safeParseJSON(result.text) || fallbackScope(input);
        const assistantMarkdown = String(json?.assistantMarkdown || fallbackScope(input).assistantMarkdown);
        const scope = json?.scope || fallbackScope(input).scope;

        send(controller, { type: "assistant_start" });
        for (const chunk of splitTextByChunk(assistantMarkdown, 18)) {
          send(controller, { type: "assistant_delta", delta: chunk });
          await sleep(25);
        }
        send(controller, { type: "assistant_done", text: assistantMarkdown });
        send(controller, { type: "scope_result", scope });
        send(controller, { type: "done" });
        controller.close();
      } catch (e: any) {
        send(controller, { type: "error", error: e?.message || "生成失败" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

