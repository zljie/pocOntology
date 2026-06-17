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

function sseLine(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

async function parseAnthropicSse(params: {
  response: Response;
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const reader = params.response.body?.getReader();
  if (!reader) throw new Error("SSE 响应不可读");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n").map((x) => x.trim());
      const dataLine = lines.find((x) => x.startsWith("data: "));
      if (!dataLine) continue;
      const payload = dataLine.slice("data: ".length);
      if (payload === "[DONE]") {
        params.onDone();
        return;
      }
      let evt: any = null;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      const type = String(evt?.type || "");
      if (type === "content_block_delta") {
        const deltaText = evt?.delta?.text;
        if (typeof deltaText === "string" && deltaText) params.onDelta(deltaText);
      }
      if (type === "message_stop") {
        params.onDone();
        return;
      }
    }
  }
  params.onDone();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  const body = await req.json().catch(() => null);
  const message = body?.message?.toString?.().trim?.();
  const context = body?.context;

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const push = (obj: any) => controller.enqueue(encoder.encode(sseLine(obj)));
      try {
        if (!message) {
          push({ type: "error", error: "message 不能为空" });
          controller.close();
          return;
        }
        if (!apiKey) {
          push({
            type: "assistant_done",
            text: "当前环境未配置大模型 API Key（MINIMAX_API_KEY / ANTHROPIC_API_KEY）。你可以先配置后再使用咨询模式对话。",
          });
          controller.close();
          return;
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

        const payload: any = {
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
          stream: true,
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
          const errorText = await response.text().catch(() => "");
          push({ type: "error", error: "LLM 调用失败", detail: errorText.slice(0, 800) });
          controller.close();
          return;
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
          await parseAnthropicSse({
            response,
            onDelta: (t) => {
              fullText += t;
              push({ type: "assistant_delta", delta: t });
            },
            onDone: () => {
              push({ type: "assistant_done", text: fullText || "（空响应）" });
              controller.close();
            },
          });
          return;
        }

        const result = await response.json().catch(() => null);
        const text = extractTextBlocks(result?.content || []) || "（空响应）";
        fullText = text;
        const chunkSize = 120;
        for (let i = 0; i < text.length; i += chunkSize) {
          const delta = text.slice(i, i + chunkSize);
          push({ type: "assistant_delta", delta });
        }
        push({ type: "assistant_done", text });
        controller.close();
      } catch (e: any) {
        push({ type: "error", error: e?.message || "stream 失败" });
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

