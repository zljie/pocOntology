import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

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

function fallbackMece(userInput: string) {
  const text =
    `我先用 MECE 的方式帮你把业务对象拆开，然后你补充边界与关键规则即可。\n\n` +
    `你输入：${userInput}\n\n` +
    `可能涉及的对象（示例）：\n` +
    `- 客户（Customer）：客户基本信息、联系人、等级\n` +
    `- 订单（Order）：订单号、金额、状态、下单时间\n` +
    `- 商品（Product）：SKU、名称、类目、单价\n\n` +
    `请确认：是否需要补充“组织/门店/渠道/权限/主数据编码规则/状态机”？`;

  return {
    assistantMarkdown: text,
    mece: {
      entities: [
        { name: "Customer", displayName: "客户", description: "购买方或服务对象", boundaries: "仅含基础主数据，不含交易明细" },
        { name: "Order", displayName: "订单", description: "交易过程的聚合根", boundaries: "包含订单头与状态，不包含履约明细" },
        { name: "Product", displayName: "商品", description: "可售卖的标准条目", boundaries: "包含 SKU 与价格，不含库存流水" },
      ],
      questions: [
        "是否有组织/门店/渠道等维度需要建模？",
        "订单的状态流转有哪些节点？",
        "客户、订单、商品有哪些必须唯一的编码？",
      ],
    },
  };
}

function fallbackPlan() {
  return {
    assistantMarkdown:
      "我将按你补充的信息生成对象类型与属性草案。请在确认框中检查名称、主键、必填与类型后再一键创建。",
    plan: {
      objectTypes: [
        {
          displayName: "客户",
          apiName: "Customer",
          description: "购买方或服务对象的主数据",
          primaryKeyApiName: "customerId",
          titleKeyApiName: "name",
          properties: [
            { displayName: "客户ID", apiName: "customerId", baseType: "STRING", required: true, description: "客户唯一标识" },
            { displayName: "名称", apiName: "name", baseType: "STRING", required: true, description: "客户名称" },
            { displayName: "手机号", apiName: "phone", baseType: "STRING", required: false, description: "联系方式" },
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
  const existing = Array.isArray(body?.existingObjectTypes) ? body.existingObjectTypes : [];
  const meceContext = body?.meceContext; // Step2 中已经拆解好的实体列表

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
        const existingText = existing
          .slice(0, 80)
          .map((x: any) => `${String(x?.apiName || "")}(${String(x?.displayName || "")})`)
          .filter((x: string) => x.trim())
          .join(", ");

        if (step === 2) {
          const system =
            "你是麦肯锡风格的业务研究员，同时也是本体建模师。你用 MECE 原则拆解业务对象，并用中文与用户对话。";
          const prompt =
            `仅返回 JSON，不要额外文本。schema:\n` +
            `{"assistantMarkdown":"string","mece":{"entities":[{"name":"PascalCase","displayName":"string","description":"string","boundaries":"string"}],"questions":["string"]}}\n\n` +
            `规则：\n` +
            `- entities.name 必须是 PascalCase。\n` +
            `- assistantMarkdown 用中文，包含：1) 你对用户输入的复述；2) MECE 列表；3) 明确要求用户补充的信息。\n` +
            `- 如果发现已有对象重复（existingObjectTypes），请在 assistantMarkdown 中提示并避免重复建议。\n\n` +
            `existingObjectTypes: ${existingText || "(none)"}\n\n` +
            `用户输入：${input}`;

          const result = apiKey ? await requestAgentText(apiKey, system, prompt, 2000) : { text: "", stopReason: "" };
          const json = safeParseJSON(result.text) || fallbackMece(input);
          const assistantMarkdown = String(json?.assistantMarkdown || fallbackMece(input).assistantMarkdown);
          const mece = json?.mece || fallbackMece(input).mece;

          send(controller, { type: "assistant_start", step: 2 });
          for (const chunk of splitTextByChunk(assistantMarkdown, 18)) {
            send(controller, { type: "assistant_delta", delta: chunk });
            await sleep(25);
          }
          send(controller, { type: "assistant_done", text: assistantMarkdown });
          send(controller, { type: "mece_result", mece });
          send(controller, { type: "done" });
          controller.close();
          return;
        }

        const system =
          "你是本体建模专家，负责把业务描述转换为对象类型（ObjectType）与属性（Property）草案，并确保命名规范。";
        
        let contextText = "";
        if (meceContext && Array.isArray(meceContext) && meceContext.length > 0) {
          contextText = `在前一轮中，你已经拆解出以下实体，请务必包含它们并根据用户的补充输入进行更新或增加新的实体：\n${JSON.stringify(meceContext, null, 2)}\n\n`;
        }

        const prompt =
          `仅返回 JSON，不要额外文本。schema:\n` +
          `{"assistantMarkdown":"string","plan":{"objectTypes":[{"displayName":"string","apiName":"PascalCase","description":"string","primaryKeyApiName":"camelCase","titleKeyApiName":"camelCase","properties":[{"displayName":"string","apiName":"camelCase","baseType":"STRING|INTEGER|DOUBLE|BOOLEAN|TIMESTAMP|STRUCT","required":true,"description":"string"}]}]}}\n\n` +
          `规则：\n` +
          `- apiName 命名：对象类型 PascalCase；属性 camelCase。\n` +
          `- baseType 只能取上述枚举。\n` +
          `- assistantMarkdown 用中文，说明生成策略与让用户在确认框检查的要点。\n` +
          `- 如果发现与 existingObjectTypes 冲突，请换一个 apiName 并在 assistantMarkdown 中说明。\n` +
          `- 如果上下文提供了“前一轮拆解的实体”，请确保它们都包含在最终的 objectTypes 列表中。\n\n` +
          `existingObjectTypes: ${existingText || "(none)"}\n\n` +
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
