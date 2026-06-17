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

function extractTextBlocks(content: any[] = []) {
  return content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function fallbackParsedResult(query: string) {
  const normalized = query.trim();
  return {
    action: { id: "action-generic", name: "GenericAction", displayName: "语义解析", layer: "KINETIC" },
    entities: normalized ? [{ type: "TEXT", id: "query", name: "Query", displayName: "输入语句", confidence: 0.5, matchedText: normalized }] : [],
    suggestedProperties: [],
    output: [{ propertyId: "result", propertyName: "result", displayName: "结果", description: "返回动作执行结果字段" }],
  };
}

function fallbackPreview(query: string) {
  const normalized = query.trim();
  const escaped = normalized.replaceAll('"', '\\"');
  const templateVars = { query: normalized };
  return {
    semanticScenario: "系统将输入语句映射为“动作 + 实体 + 参数”的结构化语义，并生成可预览的 DSL/查询模板。",
    rdf: `lib:Query a lib:SemanticQuery ;\n  lib:text "${escaped}" .`,
    owl: `Class: lib:SemanticQuery\n  Annotations: rdfs:label "语义查询"`,
    swrl: `lib:Rule_Generic a lib:BusinessRule ;\n  lib:then """ true """ .`,
    dsl: `ACTION GenericAction WITH Query.text="${escaped}"`,
    graphqlTemplate: `query SemanticQuery($query: String!) {\n  semanticQuery(query: $query) {\n    receipt\n  }\n}`,
    templateVars,
  };
}

async function requestAgentText(apiKey: string, prompt: string, maxTokens = 1200) {
  const payload = {
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.3,
    system: "你是本体语义建模专家。",
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
    console.error("LLM Request Failed:", response.status, errorText);
    return { text: "", stopReason: "http_error" as const };
  }

  const result = await response.json();
  return {
    text: extractTextBlocks(result?.content || []),
    stopReason: typeof result?.stop_reason === "string" ? result.stop_reason : "",
  };
}

function splitTextByChunk(text: string, size = 20) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  const body = await req.json().catch(() => null);
  const query = body?.query?.toString?.().trim?.();

  if (!query) {
    return new Response("query 不能为空", { status: 400 });
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, payload: Record<string, any>) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const introPrompt = `请用中文向用户解释：基于当前系统中的本体模型，会如何把输入语句转换为语义对象、参数、规则与查询执行结构。当需要输出框架图、架构图或流程图时，请强制使用 mermaid 语法（以 \`\`\`mermaid 开头）。输入：${query}`;
        const parsedPrompt = `仅返回 JSON，不要额外文本。输出 parsedResult 字段，schema: {"parsedResult":{"action":{"id":"string","name":"string","displayName":"string","layer":"KINETIC"},"entities":[],"suggestedProperties":[],"output":[]}}。输入：${query}`;
        const previewPrompt = `仅返回 JSON，不要额外文本。输出 schema: {"semanticScenario":"string","rdf":"string","owl":"string","swrl":"string","dsl":"string","graphqlTemplate":"string","templateVars":{"k":"v"}}。输入：${query}`;

        const introResponse = apiKey ? await requestAgentText(apiKey, introPrompt, 10000) : { text: "", stopReason: "" };
        const introText =
          introResponse.text ||
          "我将先根据本体层级识别动作、实体和属性，再由并行 Agent 分别生成解析结果与语义化查询语句预览。";
        const finalIntroText =
          introResponse.stopReason === "max_tokens"
            ? `${introText}\n\n（提示：本次说明已达到模型输出长度上限，可能存在截断。你可以在下方继续追问“继续/补充细节”。）`
            : introText;

        const introChunks = splitTextByChunk(finalIntroText, 18);
        for (const chunk of introChunks) {
          send(controller, { type: "intro_delta", delta: chunk });
          await sleep(30);
        }
        send(controller, { type: "intro_done", intro: finalIntroText });

        const parsedTask = (async () => {
          if (!apiKey) return fallbackParsedResult(query);
          const parsedResponse = await requestAgentText(apiKey, parsedPrompt, 1800);
          const parsedJson = safeParseJSON(parsedResponse.text);
          return parsedJson?.parsedResult || fallbackParsedResult(query);
        })();

        const previewTask = (async () => {
          if (!apiKey) return fallbackPreview(query);
          const previewResponse = await requestAgentText(apiKey, previewPrompt, 1800);
          const previewJson = safeParseJSON(previewResponse.text);
          const fallback = fallbackPreview(query);
          return {
            semanticScenario: previewJson?.semanticScenario || fallback.semanticScenario,
            rdf: previewJson?.rdf || fallback.rdf,
            owl: previewJson?.owl || fallback.owl,
            swrl: previewJson?.swrl || fallback.swrl,
            dsl: previewJson?.dsl || fallback.dsl,
            graphqlTemplate: previewJson?.graphqlTemplate || fallback.graphqlTemplate,
            templateVars:
              previewJson?.templateVars && typeof previewJson.templateVars === "object"
                ? Object.fromEntries(
                    Object.entries(previewJson.templateVars).map(([key, value]) => [String(key), String(value ?? "")])
                  )
                : fallback.templateVars,
          };
        })();

        const [parsedResult, preview] = await Promise.all([parsedTask, previewTask]);
        send(controller, { type: "parsed_result", parsedResult });
        send(controller, { type: "preview_result", preview });
        send(controller, { type: "done" });
        controller.close();
      } catch (error: any) {
        send(controller, { type: "error", message: error?.message || "流式解析失败" });
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
