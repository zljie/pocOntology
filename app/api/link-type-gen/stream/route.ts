import { NextRequest } from "next/server";

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
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fallbackSuggested(userInput: string) {
  const assistantMarkdown =
    `我会根据你已有的对象类型与业务描述，推导可能存在的关系，并询问你是否需要补充。\n\n` +
    `你输入：${userInput}\n\n` +
    `建议关系（示例）：\n` +
    `- Customer 1:N Order（客户拥有多个订单）\n` +
    `- Order 1:N OrderLine（订单包含多条明细）\n\n` +
    `请确认/补充：是否需要“组织/部门/门店/仓库/审批流”等关系？是否存在多对多？`;

  return {
    assistantMarkdown,
    suggested: {
      links: [
        {
          apiName: "CustomerHasOrders",
          displayName: "拥有订单",
          sourceObjectTypeApiName: "Customer",
          targetObjectTypeApiName: "Order",
          cardinality: "ONE_TO_MANY",
          reason: "主从关系：客户到订单",
        },
        {
          apiName: "OrderHasLines",
          displayName: "包含明细",
          sourceObjectTypeApiName: "Order",
          targetObjectTypeApiName: "OrderLine",
          cardinality: "ONE_TO_MANY",
          reason: "聚合关系：订单到明细",
        },
      ],
      questions: [
        "有哪些强约束的归属关系（必须归属某个父对象）？",
        "是否存在多对多关系需要中间对象？",
        "是否需要双向展示名称（例如：订单的客户 / 客户的订单）？",
      ],
    },
  };
}

function fallbackPlan() {
  return {
    assistantMarkdown: "我将根据你确认/补充的信息生成关系类型（LinkType）计划，并在确认后批量创建。",
    plan: {
      linkTypes: [
        {
          displayName: "拥有订单",
          apiName: "CustomerHasOrders",
          description: "客户与订单的主从关系",
          sourceObjectTypeApiName: "Customer",
          targetObjectTypeApiName: "Order",
          cardinality: "ONE_TO_MANY",
        },
      ],
    },
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  const body = await req.json().catch(() => null);

  const step = Number(body?.step);
  const input = body?.input?.toString?.().trim?.();
  const existingObjectTypes = Array.isArray(body?.existingObjectTypes) ? body.existingObjectTypes : [];
  const existingLinkTypes = Array.isArray(body?.existingLinkTypes) ? body.existingLinkTypes : [];
  const suggestedContext = body?.suggestedContext;

  if (![2, 3].includes(step) || !input) {
    return new Response("step 或 input 不合法", { status: 400 });
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, payload: Record<string, any>) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const objectTypesText = existingObjectTypes
          .slice(0, 160)
          .map((x: any) => `${String(x?.apiName || "")}(${String(x?.displayName || "")})`)
          .filter((x: string) => x.trim())
          .join(", ");
        const linkTypesText = existingLinkTypes
          .slice(0, 160)
          .map((x: any) => `${String(x?.apiName || "")}(${String(x?.displayName || "")})`)
          .filter((x: string) => x.trim())
          .join(", ");

        if (step === 2) {
          const system =
            "你是资深业务分析师与本体建模师。你的任务是根据对象类型与业务描述，推导可能存在的关系（LinkType）并提出补充问题。";
          const prompt =
            `仅返回 JSON，不要额外文本。schema:\n` +
            `{"assistantMarkdown":"string","suggested":{"links":[{"apiName":"PascalCase","displayName":"string","sourceObjectTypeApiName":"PascalCase","targetObjectTypeApiName":"PascalCase","cardinality":"ONE_TO_ONE|ONE_TO_MANY|MANY_TO_ONE|MANY_TO_MANY","reason":"string"}],"questions":["string"]}}\n\n` +
            `规则：\n` +
            `- link apiName 必须 PascalCase。\n` +
            `- source/target 优先引用已有对象类型（existingObjectTypes）。如对象缺失，请在 questions 中提出。\n` +
            `- cardinality 必须在枚举内。\n` +
            `- assistantMarkdown 用中文：1) 复述场景；2) 给出关系建议（含基数与理由）；3) 询问是否需要补充。\n` +
            `- 如果与 existingLinkTypes 重复，请避免重复建议并提示。\n\n` +
            `existingObjectTypes: ${objectTypesText || "(none)"}\n` +
            `existingLinkTypes: ${linkTypesText || "(none)"}\n\n` +
            `用户输入：${input}`;

          const result = apiKey ? await requestAgentText(apiKey, system, prompt, 2200) : { text: "", stopReason: "" };
          const json = safeParseJSON(result.text) || fallbackSuggested(input);
          const assistantMarkdown = String(json?.assistantMarkdown || fallbackSuggested(input).assistantMarkdown);
          const suggested = json?.suggested || fallbackSuggested(input).suggested;

          send(controller, { type: "assistant_start", step: 2 });
          for (const chunk of splitTextByChunk(assistantMarkdown, 18)) {
            send(controller, { type: "assistant_delta", delta: chunk });
            await sleep(25);
          }
          send(controller, { type: "assistant_done", text: assistantMarkdown });
          send(controller, { type: "suggested_result", suggested });
          send(controller, { type: "done" });
          controller.close();
          return;
        }

        const system =
          "你是本体建模专家，负责把业务描述转换为可落地的 LinkType 草案（source/target/基数/命名），并确保命名规范。";
        const contextText =
          suggestedContext && Array.isArray(suggestedContext) && suggestedContext.length > 0
            ? `在前一轮中，你已经推导出以下关系，请务必包含它们并根据用户补充进行调整或增加：\n${JSON.stringify(suggestedContext, null, 2)}\n\n`
            : "";

        const prompt =
          `仅返回 JSON，不要额外文本。schema:\n` +
          `{"assistantMarkdown":"string","plan":{"linkTypes":[{"displayName":"string","apiName":"PascalCase","description":"string","sourceObjectTypeApiName":"PascalCase","targetObjectTypeApiName":"PascalCase","cardinality":"ONE_TO_ONE|ONE_TO_MANY|MANY_TO_ONE|MANY_TO_MANY"}]}}\n\n` +
          `规则：\n` +
          `- apiName 必须 PascalCase。\n` +
          `- cardinality 必须在枚举内。\n` +
          `- source/target 优先使用 existingObjectTypes。\n` +
          `- 若与 existingLinkTypes 冲突，请换一个 apiName 并在 assistantMarkdown 中说明。\n` +
          `- 如果提供了“前一轮推导关系”，请确保它们都包含在最终 linkTypes 列表中。\n\n` +
          `existingObjectTypes: ${objectTypesText || "(none)"}\n` +
          `existingLinkTypes: ${linkTypesText || "(none)"}\n\n` +
          contextText +
          `用户补充输入：${input}`;

        const result = apiKey ? await requestAgentText(apiKey, system, prompt, 2600) : { text: "", stopReason: "" };
        const json = safeParseJSON(result.text) || fallbackPlan();
        const assistantMarkdown = String(json?.assistantMarkdown || fallbackPlan().assistantMarkdown);
        const plan = json?.plan || fallbackPlan().plan;

        send(controller, { type: "assistant_start", step: 3 });
        for (const chunk of splitTextByChunk(assistantMarkdown, 18)) {
          send(controller, { type: "assistant_delta", delta: chunk });
          await sleep(25);
        }
        send(controller, { type: "assistant_done", text: assistantMarkdown });
        send(controller, { type: "plan_result", plan });
        send(controller, { type: "done" });
        controller.close();
      } catch (error: any) {
        send(controller, { type: "error", message: error?.message || "AI 生成失败" });
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
