import { NextRequest } from "next/server";

const BASE_URL = process.env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7";

function buildMessagesUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
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
  const isReturn = query.includes("还");
  const action = isReturn
    ? { id: "action-return", name: "ReturnBook", displayName: "还书", layer: "KINETIC" }
    : { id: "action-checkout", name: "CheckoutBook", displayName: "借书", layer: "KINETIC" };
  return {
    action,
    entities: isReturn
      ? [{ type: "OBJECT_TYPE", id: "loan-001", name: "Loan", displayName: "借阅记录", confidence: 0.9, matchedText: "还书" }]
      : [{ type: "OBJECT_TYPE", id: "book-001", name: "Book", displayName: "图书", confidence: 0.88, matchedText: "图书" }],
    suggestedProperties: [],
    output: isReturn
      ? [{ propertyId: "actualReturnDate", propertyName: "actualReturnDate", displayName: "实际归还时间", description: "记录归还时间" }]
      : [{ propertyId: "loanId", propertyName: "loanId", displayName: "借阅ID", description: "生成借阅记录编号" }],
  };
}

function fallbackPreview(query: string) {
  const barcode = query.match(/(?:条码号?|barcode)\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] || "ABC123";
  if (query.includes("还")) {
    return {
      semanticScenario: "系统将归还语义转义为 ReturnEvent，关联 Loan 与 Holding 并更新状态。",
      rdf: `lib:Event_Return_001 a lib:ReturnEvent ;\n  lib:updatesLoan lib:Loan_${barcode} .`,
      swrl: `lib:Rule_归还状态同步 a lib:BusinessRule ;\n  lib:then """ ?loan lib:loanStatus "RETURNED" . """ .`,
      dsl: `ACTION ReturnBook WITH Holding.barcode="${barcode}"`,
      graphqlTemplate:
        `mutation ReturnBook($barcode: String!) {\n  returnBook(input: { barcode: $barcode }) {\n    loanId\n    loanStatus\n    holdingStatus\n    actualReturnDate\n  }\n}`,
      templateVars: { barcode },
    };
  }
  return {
    semanticScenario: "系统将借阅语义转义为 BorrowingEvent，绑定读者与馆藏并生成借阅记录。",
    rdf: `lib:Event_Loan_001 a lib:BorrowingEvent ;\n  lib:object lib:Book_目标图书 .`,
    swrl: `lib:Rule_借阅可用性 a lib:BusinessRule ;\n  lib:then """ ?loan lib:loanStatus "ACTIVE" . """ .`,
    dsl: `ACTION CheckoutBook WITH Book.title="目标图书"`,
    graphqlTemplate:
      `mutation CheckoutBook($bookTitle: String!, $patronName: String!) {\n  checkoutBook(input: { bookTitle: $bookTitle, patronName: $patronName }) {\n    loanId\n    dueDate\n    loanStatus\n  }\n}`,
    templateVars: { bookTitle: "目标图书", patronName: "张三" },
  };
}

async function requestAgentText(apiKey: string, prompt: string) {
  const payload = {
    model: MODEL,
    max_tokens: 1200,
    temperature: 0.3,
    system: "你是图书馆本体语义建模专家。",
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
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    return "";
  }

  const result = await response.json();
  return extractTextBlocks(result?.content || []);
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
        const introPrompt = `请用中文向用户解释：基于当前图书馆本体模型，会如何把输入语句转换为语义对象、参数、规则与查询执行结构。输入：${query}`;
        const parsedPrompt = `仅返回 JSON，不要额外文本。输出 parsedResult 字段，schema: {"parsedResult":{"action":{"id":"string","name":"string","displayName":"string","layer":"KINETIC"},"entities":[],"suggestedProperties":[],"output":[]}}。输入：${query}`;
        const previewPrompt = `仅返回 JSON，不要额外文本。输出 schema: {"semanticScenario":"string","rdf":"string","swrl":"string","dsl":"string","graphqlTemplate":"string","templateVars":{"k":"v"}}。输入：${query}`;

        const introText =
          apiKey
            ? (await requestAgentText(apiKey, introPrompt)) ||
              "我将先根据本体层级识别动作、实体和属性，再由并行 Agent 分别生成解析结果与语义化查询语句预览。"
            : "我将先根据本体层级识别动作、实体和属性，再由并行 Agent 分别生成解析结果与语义化查询语句预览。";

        const introChunks = splitTextByChunk(introText, 18);
        for (const chunk of introChunks) {
          send(controller, { type: "intro_delta", delta: chunk });
          await sleep(30);
        }
        send(controller, { type: "intro_done", intro: introText });

        const parsedTask = (async () => {
          if (!apiKey) return fallbackParsedResult(query);
          const parsedText = await requestAgentText(apiKey, parsedPrompt);
          const parsedJson = safeParseJSON(parsedText);
          return parsedJson?.parsedResult || fallbackParsedResult(query);
        })();

        const previewTask = (async () => {
          if (!apiKey) return fallbackPreview(query);
          const previewText = await requestAgentText(apiKey, previewPrompt);
          const previewJson = safeParseJSON(previewText);
          const fallback = fallbackPreview(query);
          return {
            semanticScenario: previewJson?.semanticScenario || fallback.semanticScenario,
            rdf: previewJson?.rdf || fallback.rdf,
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
