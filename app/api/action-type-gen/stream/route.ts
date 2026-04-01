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
    `我会先把你这个业务场景中常见的 CRUD 动作列出来，并指出可能遗漏的业务动作，再请你补充确认。\n\n` +
    `你输入：${userInput}\n\n` +
    `建议动作（示例）：\n` +
    `- CreateOrder（创建订单）\n` +
    `- UpdateOrder（修改订单）\n` +
    `- CancelOrder（取消订单）\n` +
    `- ListOrder（查询订单列表）\n\n` +
    `请补充：对象有哪些关键状态？有哪些需要审批/校验/权限控制的动作？`;

  return {
    assistantMarkdown,
    suggested: {
      actions: [
        { apiName: "CreateOrder", displayName: "创建订单", crud: "CREATE", targetObjectTypeApiName: "Order", reason: "产生交易单据" },
        { apiName: "UpdateOrder", displayName: "修改订单", crud: "UPDATE", targetObjectTypeApiName: "Order", reason: "变更订单字段" },
        { apiName: "CancelOrder", displayName: "取消订单", crud: "OTHER", targetObjectTypeApiName: "Order", reason: "状态流转动作" },
        { apiName: "ListOrder", displayName: "查询订单列表", crud: "READ", targetObjectTypeApiName: "Order", reason: "常用查询" },
      ],
      questions: [
        "这个业务里有哪些核心对象（实体类型）？",
        "每个对象的关键状态节点有哪些？",
        "哪些动作需要审批/权限/规则校验？",
      ],
    },
  };
}

function fallbackPlan() {
  return {
    assistantMarkdown: "我将根据你补充的信息，生成可用于 CRUD 的 ActionType，并在确认后批量创建。",
    plan: {
      actionTypes: [
        {
          displayName: "创建订单",
          apiName: "CreateOrder",
          description: "创建一条订单记录",
          affectedObjectTypeApiNames: ["Order"],
          inputParameters: [
            { displayName: "客户ID", apiName: "customerId", baseType: "STRING", required: true, description: "下单客户" },
            { displayName: "订单金额", apiName: "amount", baseType: "DOUBLE", required: true, description: "订单总金额" },
          ],
          outputProperties: [
            { displayName: "订单ID", apiName: "orderId", baseType: "STRING", required: true, description: "创建后返回的订单ID" },
            { displayName: "状态", apiName: "status", baseType: "STRING", required: true, description: "订单状态" },
          ],
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
  const existingActionTypes = Array.isArray(body?.existingActionTypes) ? body.existingActionTypes : [];
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
          .slice(0, 120)
          .map((x: any) => `${String(x?.apiName || "")}(${String(x?.displayName || "")})`)
          .filter((x: string) => x.trim())
          .join(", ");
        const actionTypesText = existingActionTypes
          .slice(0, 160)
          .map((x: any) => `${String(x?.apiName || "")}(${String(x?.displayName || "")})`)
          .filter((x: string) => x.trim())
          .join(", ");

        if (step === 2) {
          const system =
            "你是资深业务分析师（麦肯锡风格）和本体建模师。你的任务是从业务描述中预测需要的 CRUD 动作与缺失的业务动作，并提出补充问题。";
          const prompt =
            `仅返回 JSON，不要额外文本。schema:\n` +
            `{"assistantMarkdown":"string","suggested":{"actions":[{"apiName":"PascalCase","displayName":"string","crud":"CREATE|READ|UPDATE|DELETE|OTHER","targetObjectTypeApiName":"PascalCase","reason":"string"}],"questions":["string"]}}\n\n` +
            `规则：\n` +
            `- apiName 必须是 PascalCase，尽量以 CRUD 前缀命名（Create/Update/Delete/Get/List），业务型动作可用 Approve/Cancel/Submit 等。\n` +
            `- targetObjectTypeApiName 优先引用已有对象类型（existingObjectTypes），否则也可提出“缺失对象”。\n` +
            `- assistantMarkdown 用中文：1) 复述场景；2) 给出预测动作清单与理由；3) 提出补充问题。\n` +
            `- 如果发现动作与 existingActionTypes 重复，请避免重复建议并提示。\n\n` +
            `existingObjectTypes: ${objectTypesText || "(none)"}\n` +
            `existingActionTypes: ${actionTypesText || "(none)"}\n\n` +
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
          "你是本体建模专家，负责把业务描述转换为可执行的 ActionType 草案（偏 CRUD）。你会输出输入参数、输出字段、以及影响对象。";
        const contextText =
          suggestedContext && Array.isArray(suggestedContext) && suggestedContext.length > 0
            ? `在前一轮中，你已经预测出以下动作，请务必包含它们并根据用户补充进行调整或增加：\n${JSON.stringify(suggestedContext, null, 2)}\n\n`
            : "";

        const prompt =
          `仅返回 JSON，不要额外文本。schema:\n` +
          `{"assistantMarkdown":"string","plan":{"actionTypes":[{"displayName":"string","apiName":"PascalCase","description":"string","affectedObjectTypeApiNames":["PascalCase"],"inputParameters":[{"displayName":"string","apiName":"camelCase","baseType":"STRING|INTEGER|DOUBLE|BOOLEAN|TIMESTAMP|STRUCT","required":true,"description":"string"}],"outputProperties":[{"displayName":"string","apiName":"camelCase","baseType":"STRING|INTEGER|DOUBLE|BOOLEAN|TIMESTAMP|STRUCT","required":true,"description":"string"}]}]}}\n\n` +
          `规则：\n` +
          `- apiName 命名：PascalCase，CRUD 尽量以 Create/Update/Delete/Get/List 开头。\n` +
          `- inputParameters/outputProperties 的 apiName 必须为 camelCase。\n` +
          `- baseType 只能取上述枚举。\n` +
          `- affectedObjectTypeApiNames 优先使用已有对象类型（existingObjectTypes）。\n` +
          `- 若与 existingActionTypes 冲突，请换一个 apiName 并在 assistantMarkdown 中说明。\n` +
          `- 如果提供了“前一轮预测动作”，请确保它们都包含在最终 actionTypes 列表中。\n\n` +
          `existingObjectTypes: ${objectTypesText || "(none)"}\n` +
          `existingActionTypes: ${actionTypesText || "(none)"}\n\n` +
          contextText +
          `用户补充输入：${input}`;

        const result = apiKey ? await requestAgentText(apiKey, system, prompt, 2800) : { text: "", stopReason: "" };
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
