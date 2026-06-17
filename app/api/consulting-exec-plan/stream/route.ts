import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

const BASE_URL =
  process.env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7";

function buildMessagesUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/messages")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/messages`;
  return `${normalized}/v1/messages`;
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
        if (typeof deltaText === "string" && deltaText)
          params.onDelta(deltaText);
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
  const goal = body?.goal?.toString?.().trim?.();
  const context = body?.context;
  const evidence = body?.evidence;

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const push = (obj: any) =>
        controller.enqueue(encoder.encode(sseLine(obj)));

      try {
        if (!goal) {
          push({ type: "error", error: "goal 不能为空" });
          controller.close();
          return;
        }

        if (!apiKey) {
          push({
            type: "assistant_done",
            text: "当前环境未配置大模型 API Key（MINIMAX_API_KEY / ANTHROPIC_API_KEY）。请先配置后再生成执行方案。",
          });
          controller.close();
          return;
        }

        const system = `你是“执行方案 Planner（本体+数据推演）”。你必须遵守：
1) 所有结论必须基于给定的 context（本体/业务域/选择）与 evidence（数据集查询证据）。如果信息不足，必须输出 nextQuestions，不得臆测。
2) 输出结构：先用中文给出简短结论与方案概览（3-8 行），然后输出一个 \`\`\`json 代码块，包含 Plan 对象。
3) Plan JSON 结构（字段可多不可少，尽量齐全）：
{
  "goal": string,
  "context": { "domain"?: any, "selection"?: any, "ontologySummary"?: any, "dataset"?: any },
  "assumptions": string[],
  "steps": [
    {
      "id": string,
      "type": "QUERY" | "DDL" | "MUTATION" | "API_CALL" | "ONTOLOGY_CHANGE",
      "title": string,
      "description": string,
      "executable": { "kind": "SQL" | "GRAPHQL" | "JSON_PATCH" | "CYPHER" | "PSEUDO", "code": string },
      "expectedOutput": string,
      "risk": string,
      "rollback": string
    }
  ],
  "artifacts": [{ "name": string, "type": "SQL" | "DDL" | "API_DRAFT" | "DOC", "content": string }],
  "validation": string[],
  "nextQuestions": string[]
}
4) 如果 evidence 缺失、或无法把 goal 映射到某个实体/字段/动作，请在 nextQuestions 里明确问用户要什么数据集、哪个实体、什么过滤条件、目标输出是什么。
5) steps 中至少包含 1 个 QUERY 步骤（即便是伪 SQL），并且要引用 evidence（例如 pseudoSql/命中统计）来说明可复核性。`;

        const prompt = `上下文（本体与咨询状态）：
${JSON.stringify(context ?? null, null, 2)}

数据证据（evidence，可为空）：
${JSON.stringify(evidence ?? null, null, 2)}

用户目标（goal）：
${goal}

请用中文回答并输出 Plan JSON。`;

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
          push({
            type: "error",
            error: "LLM 调用失败",
            detail: errorText.slice(0, 800),
          });
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

        // 非 SSE：退化为一次性响应
        const result = await response.json().catch(() => null);
        const text =
          Array.isArray(result?.content)
            ? result.content
                .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
                .map((b: any) => b.text)
                .join("\n")
            : "（空响应）";
        fullText = text;
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

