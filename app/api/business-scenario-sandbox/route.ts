import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    .filter((block: any) => block?.type === "text" && typeof block?.text === "string")
    .map((block: any) => block.text)
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

function stableHash(value: unknown) {
  const json = JSON.stringify(value, Object.keys(value as any).sort());
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
}

function normalizeStringArray(value: any) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  return [String(value)].filter(Boolean);
}

function buildOntologyDigest(ontology: any) {
  const objectTypes: any[] = Array.isArray(ontology?.objectTypes) ? ontology.objectTypes : [];
  const linkTypes: any[] = Array.isArray(ontology?.linkTypes) ? ontology.linkTypes : [];
  const actionTypes: any[] = Array.isArray(ontology?.actionTypes) ? ontology.actionTypes : [];
  const dataFlows: any[] = Array.isArray(ontology?.dataFlows) ? ontology.dataFlows : [];
  const businessRules: any[] = Array.isArray(ontology?.businessRules) ? ontology.businessRules : [];
  const aiModels: any[] = Array.isArray(ontology?.aiModels) ? ontology.aiModels : [];

  const objectTypeById = new Map<string, any>(objectTypes.map((ot) => [String(ot?.id), ot]));
  const linkTypeById = new Map<string, any>(linkTypes.map((lt) => [String(lt?.id), lt]));
  const actionTypeById = new Map<string, any>(actionTypes.map((at) => [String(at?.id), at]));
  const ruleById = new Map<string, any>(businessRules.map((r) => [String(r?.id), r]));

  const digest = {
    objectTypes: objectTypes.map((ot) => ({
      apiName: String(ot?.apiName || ""),
      displayName: String(ot?.displayName || ""),
      layer: ot?.layer,
      category: ot?.category,
      properties: (Array.isArray(ot?.properties) ? ot.properties : []).map((p: any) => ({
        apiName: String(p?.apiName || ""),
        displayName: String(p?.displayName || ""),
        baseType: p?.baseType,
        required: Boolean(p?.required),
      })),
    })),
    linkTypes: linkTypes.map((lt) => ({
      apiName: String(lt?.apiName || ""),
      displayName: String(lt?.displayName || ""),
      sourceObjectType: String(objectTypeById.get(String(lt?.sourceTypeId))?.apiName || ""),
      targetObjectType: String(objectTypeById.get(String(lt?.targetTypeId))?.apiName || ""),
      cardinality: lt?.cardinality,
      relationshipType: lt?.relationshipType,
    })),
    actionTypes: actionTypes.map((at) => ({
      apiName: String(at?.apiName || ""),
      displayName: String(at?.displayName || ""),
      layer: at?.layer,
      affectedObjects: normalizeStringArray(at?.affectedObjectTypeIds).map(
        (id) => String(objectTypeById.get(id)?.apiName || "")
      ),
      affectedLinks: normalizeStringArray(at?.affectedLinkTypeIds).map((id) => String(linkTypeById.get(id)?.apiName || "")),
      inputs: (Array.isArray(at?.inputParameters) ? at.inputParameters : []).map((p: any) => ({
        apiName: String(p?.apiName || ""),
        displayName: String(p?.displayName || ""),
        baseType: p?.baseType,
        required: Boolean(p?.required),
      })),
      outputs: (Array.isArray(at?.outputProperties) ? at.outputProperties : []).map((p: any) => ({
        apiName: String(p?.apiName || ""),
        displayName: String(p?.displayName || ""),
        baseType: p?.baseType,
      })),
      preActions: normalizeStringArray(at?.preActions).map((id) => String(actionTypeById.get(id)?.apiName || "")),
      postActions: normalizeStringArray(at?.postActions).map((id) => String(actionTypeById.get(id)?.apiName || "")),
      requiredRoles: normalizeStringArray(at?.requiredRoles),
    })),
    dataFlows: dataFlows.map((df) => ({
      apiName: String(df?.apiName || ""),
      displayName: String(df?.displayName || ""),
      steps: (Array.isArray(df?.steps) ? df.steps : []).map((s: any) => ({
        stepName: String(s?.stepName || ""),
        actionType: String(actionTypeById.get(String(s?.actionTypeId))?.apiName || ""),
        objectType: String(objectTypeById.get(String(s?.objectTypeId))?.apiName || ""),
        validation: String(s?.validation || ""),
      })),
    })),
    businessRules: businessRules.map((r) => ({
      apiName: String(r?.apiName || ""),
      displayName: String(r?.displayName || ""),
      ruleType: r?.ruleType,
      appliesToObjects: normalizeStringArray(r?.appliesToObjectTypeIds).map((id) => String(objectTypeById.get(id)?.apiName || "")),
      appliesToActions: normalizeStringArray(r?.appliesToActionTypeIds).map((id) => String(actionTypeById.get(id)?.apiName || "")),
      priority: r?.priority,
      enabled: Boolean(r?.enabled),
      expression: String(r?.expression || "").slice(0, 240),
    })),
    aiModels: aiModels.map((m) => ({
      apiName: String(m?.apiName || ""),
      displayName: String(m?.displayName || ""),
      modelType: m?.modelType,
      outputType: m?.outputType,
      modelSource: m?.modelSource,
    })),
    meta: {
      objectTypeCount: objectTypes.length,
      linkTypeCount: linkTypes.length,
      actionTypeCount: actionTypes.length,
      dataFlowCount: dataFlows.length,
      businessRuleCount: businessRules.length,
      aiModelCount: aiModels.length,
    },
  };

  const ontologyDigest = stableHash(digest);
  return { ontologyDigest, digest, lookups: { objectTypeById, linkTypeById, actionTypeById, ruleById } };
}

function buildAgentPrompt(digest: any) {
  const actionNames: string[] = Array.isArray(digest?.actionTypes)
    ? digest.actionTypes.map((a: any) => String(a?.apiName || "")).filter(Boolean)
    : [];
  const objectNames: string[] = Array.isArray(digest?.objectTypes)
    ? digest.objectTypes.map((o: any) => String(o?.apiName || "")).filter(Boolean)
    : [];
  const linkNames: string[] = Array.isArray(digest?.linkTypes)
    ? digest.linkTypes.map((l: any) => String(l?.apiName || "")).filter(Boolean)
    : [];
  const ruleNames: string[] = Array.isArray(digest?.businessRules)
    ? digest.businessRules.map((r: any) => String(r?.apiName || "")).filter(Boolean)
    : [];

  const isLibraryDomain =
    actionNames.includes("CheckoutBook") ||
    actionNames.includes("ReturnBook") ||
    actionNames.includes("CreateReservation") ||
    objectNames.includes("Book") ||
    objectNames.includes("Loan") ||
    objectNames.includes("Patron");

  const libraryGuidance = isLibraryDomain
    ? `领域提示（已识别为“图书馆借阅管理系统”）：
核心动作示例：CancelReservation, CatalogBook, CheckoutBook, CreateReservation, PayFine, RegisterPatron, RenewLoan, ReturnBook, WeedBook
核心对象示例：Book, Category, Holding, Library, Loan, Patron, Fine, Publisher, Department, Budget
核心关系示例：HoldingBook, HoldingLibrary, LoanHolding, PatronLoans, PatronReservations, PatronFines, PatronDepartment, BookCategory, BookPublisher, FineLoan
核心规则示例：FinePaymentRequired, LoanLimitByPatronType, LoanPeriodByPatronType, OverdueFineRate, RenewalLimit, ReservationLimit, ReservationPickupExpiry, ReservationPriorityByType

角色导向（优先用角色做 MECE 分组）：
- 读者（Patron）：找书/借书/还书/续借/预约/缴费/账户管理
- 馆员（Librarian）：编目上架/剔旧下架/借还处理/预约取书/异常处理
- 管理员（Admin/Manager）：预算与采购/规则配置/人员与部门/运营与合规
- 系统（System/Automation）：推荐/通知/对账/批处理/审计与观测`
    : "";

  return `你是“业务场景穷举Agent”（本体业务模型设计器的场景沙盘）。你的目标是：基于输入本体，穷举“可执行”的业务场景清单，并给出覆盖度线索（映射到本体元素）。

先读后写（必须遵守）：
1) 先读取输入中的 ActionType/ObjectType/LinkType/BusinessRule 的 apiName 列表，把它们当作“唯一合法词表”。
2) 输出中的 coverageHints 只能引用这些 apiName；不要创造不存在的 apiName。
3) 输出中的 objects/actors/steps 用自然语言表达没问题，但 coverageHints 必须是 apiName。

方法论与质量闸门（必须遵守）：
1) MECE：分组互斥、整体尽量穷尽；每个分组给出一句“边界说明”（不包含什么），避免重叠。
2) 金字塔：先给顶层主题（1 句），再给 5-8 个二级分组（每组含 rationale），再给每组场景清单。
3) 可执行场景最低标准：必须同时满足
   - steps 至少 4 步（动词短句），包含触发→校验/规则→执行动作→写入/更新→观测结果
   - coverageHints.actionTypes 至少 1 个（否则只能标为 PARTIAL 或 GAP）
4) 场景覆盖面：每个分组至少包含“主流程 + 失败/例外 + 运营/治理 + 观测/审计 + 批处理/离线”中的 3 类。
5) 去重：不要输出同义重复场景（例如“借书”与“办理借阅”只能保留一个）。

输出长度护栏（必须遵守，用于防止超长被截断）：
1) groups 数量：必须在 5–7 之间。
2) 每个 group 的 scenarios 数量：必须在 4–8 之间；优先覆盖更多 ActionType，而不是堆砌同类场景。
3) steps：每个场景必须 4–6 步；每步不超过 24 个中文字符（或 50 个英文字符）。
4) 字段长度上限：
   - theme ≤ 30 字
   - title ≤ 18 字
   - rationale ≤ 60 字（务必含“边界说明：不包含…”）
   - goal/trigger ≤ 40 字
5) coverageHints 与 missingHints 的数组上限：每类最多 6 个；不要重复；不要输出本体词表全文；不要在字符串里换行。
6) 如果你预计会超长：删减低优先级场景（重复/边缘/过细粒度），保持每个 ActionType 至少出现一次。

${libraryGuidance}

输出严格为 JSON，不要输出任何额外文本。

输出 JSON schema（必须匹配，字段必须齐全）：
{
  "pyramid": {
    "theme": "string",
    "groups": [
      {
        "id": "string?",
        "title": "string",
        "rationale": "string (为什么这样分组 + 边界说明：本组不包含什么)",
        "scenarios": [
          {
            "id": "string?",
            "name": "string",
            "goal": "string?",
            "trigger": "string?",
            "actors": ["string"]?,
            "objects": ["string"]?,
            "steps": ["string (动词短句，按时间顺序)"],
            "preconditions": ["string"]?,
            "postconditions": ["string"]?,
            "observableResults": ["string"]?,
            "coverageStatus": "COVERED|PARTIAL|GAP",
            "coverageHints": {
              "actionTypes": ["string (ActionType.apiName)"],
              "objectTypes": ["string (ObjectType.apiName)"],
              "linkTypes": ["string (LinkType.apiName)"],
              "businessRules": ["string (BusinessRule.apiName)"]
            },
            "missingHints": {
              "actionTypes": ["string (优先填 ActionType.apiName；如需新增用 NEW:<CandidateApiName>)"],
              "objectTypes": ["string (优先填 ObjectType.apiName；如需新增用 NEW:<CandidateApiName>)"],
              "linkTypes": ["string (优先填 LinkType.apiName；如需新增用 NEW:<CandidateApiName>)"],
              "businessRules": ["string (优先填 BusinessRule.apiName；如需新增用 NEW:<CandidateApiName>)"]
            }
          }
        ]
      }
    ]
  }
}

覆盖标注规则：
- coverageHints.* 只能使用输入中存在的 apiName；不知道就用空数组，不要编造。
- missingHints.* 用于“为了覆盖需要补充什么”：
  - 如果本体里已经有对应元素，优先引用其 apiName
  - 如果本体里没有，使用 NEW:<CandidateApiName> 形式给出建议新增项（CandidateApiName 用 CamelCase）
  - COVERED 时 missingHints 四类都必须为空数组
- coverageStatus 判定（从严）：
  - COVERED：coverageHints.actionTypes 至少 1 个，且 coverageHints.objectTypes 至少 1 个；steps 与目标一致
  - PARTIAL：能对齐对象/规则，但关键动作缺失或步骤需要新增动作类型
  - GAP：核心对象或关键动作都缺失，属于明显盲区

场景输出策略（让结果更“像业务”）：
1) 优先围绕 ActionType 产出场景：对每个 ActionType，至少产出 1 个“主流程”场景；对关键动作（借还/预约/缴费/编目）再补 1-2 个异常场景。
2) 用 BusinessRule 牵引异常/边界：例如额度限制、期限、优先级、取书过期、逾期计费、缴费前置等。
3) 对 LinkType 牵引协作与数据一致性：例如 LoanHolding / PatronLoans / PatronReservations / FineLoan 等。
4) 如果识别为图书馆领域，分组标题优先按角色命名（读者/馆员/管理员/系统），并在每组内覆盖该角色的“端到端旅程”。

输入（本体摘要，供引用 apiName）：
${JSON.stringify(digest)}
`;
}

function collectReferencedApiNames(pyramid: any) {
  const used = {
    actionTypes: new Set<string>(),
    objectTypes: new Set<string>(),
    linkTypes: new Set<string>(),
    businessRules: new Set<string>(),
  };
  const groups = Array.isArray(pyramid?.groups) ? pyramid.groups : [];
  for (const g of groups) {
    const scenarios = Array.isArray(g?.scenarios) ? g.scenarios : [];
    for (const s of scenarios) {
      const hints = s?.coverageHints || {};
      for (const a of normalizeStringArray(hints?.actionTypes)) used.actionTypes.add(a);
      for (const o of normalizeStringArray(hints?.objectTypes)) used.objectTypes.add(o);
      for (const l of normalizeStringArray(hints?.linkTypes)) used.linkTypes.add(l);
      for (const r of normalizeStringArray(hints?.businessRules)) used.businessRules.add(r);
    }
  }
  return used;
}

function computeCoverageAndGaps(digest: any, pyramid: any) {
  const actionNames: string[] = (digest?.actionTypes || [])
    .map((a: any) => String(a?.apiName || ""))
    .filter((v: string) => Boolean(v));
  const objectNames: string[] = (digest?.objectTypes || [])
    .map((o: any) => String(o?.apiName || ""))
    .filter((v: string) => Boolean(v));
  const linkNames: string[] = (digest?.linkTypes || [])
    .map((l: any) => String(l?.apiName || ""))
    .filter((v: string) => Boolean(v));
  const ruleNames: string[] = (digest?.businessRules || [])
    .map((r: any) => String(r?.apiName || ""))
    .filter((v: string) => Boolean(v));

  const allAction = new Set<string>(actionNames);
  const allObject = new Set<string>(objectNames);
  const allLink = new Set<string>(linkNames);
  const allRules = new Set<string>(ruleNames);

  const used = collectReferencedApiNames(pyramid);
  const usedAction = new Set(Array.from(used.actionTypes).filter((n) => allAction.has(n)));
  const usedObject = new Set(Array.from(used.objectTypes).filter((n) => allObject.has(n)));
  const usedLink = new Set(Array.from(used.linkTypes).filter((n) => allLink.has(n)));
  const usedRule = new Set(Array.from(used.businessRules).filter((n) => allRules.has(n)));

  const uncoveredActionTypes = Array.from(allAction).filter((n) => !usedAction.has(n)).sort();
  const uncoveredObjectTypes = Array.from(allObject).filter((n) => !usedObject.has(n)).sort();
  const uncoveredLinkTypes = Array.from(allLink).filter((n) => !usedLink.has(n)).sort();
  const uncoveredBusinessRules = Array.from(allRules).filter((n) => !usedRule.has(n)).sort();

  const coverage = {
    actionTypes: { covered: usedAction.size, total: allAction.size, ratio: allAction.size ? usedAction.size / allAction.size : 0 },
    objectTypes: { covered: usedObject.size, total: allObject.size, ratio: allObject.size ? usedObject.size / allObject.size : 0 },
    linkTypes: { covered: usedLink.size, total: allLink.size, ratio: allLink.size ? usedLink.size / allLink.size : 0 },
    businessRules: { covered: usedRule.size, total: allRules.size, ratio: allRules.size ? usedRule.size / allRules.size : 0 },
  };

  const gaps = {
    uncoveredActionTypes,
    uncoveredObjectTypes,
    uncoveredLinkTypes,
    uncoveredBusinessRules,
  };

  return { coverage, gaps };
}

function normalizePyramid(pyramid: any) {
  const groups = Array.isArray(pyramid?.groups) ? pyramid.groups : [];
  const normalizedGroups = groups.map((g: any) => {
    const scenarios = Array.isArray(g?.scenarios) ? g.scenarios : [];
    const normalizedScenarios = scenarios.map((s: any) => {
      const coverageHints = s?.coverageHints || {};
      const missingHints = s?.missingHints || {};
      const coverageStatus = s?.coverageStatus === "COVERED" || s?.coverageStatus === "PARTIAL" || s?.coverageStatus === "GAP"
        ? s.coverageStatus
        : "PARTIAL";
      const normalized = {
        ...s,
        coverageStatus,
        coverageHints: {
          actionTypes: normalizeStringArray(coverageHints?.actionTypes),
          objectTypes: normalizeStringArray(coverageHints?.objectTypes),
          linkTypes: normalizeStringArray(coverageHints?.linkTypes),
          businessRules: normalizeStringArray(coverageHints?.businessRules),
        },
        missingHints: {
          actionTypes: normalizeStringArray(missingHints?.actionTypes),
          objectTypes: normalizeStringArray(missingHints?.objectTypes),
          linkTypes: normalizeStringArray(missingHints?.linkTypes),
          businessRules: normalizeStringArray(missingHints?.businessRules),
        },
      };
      if (normalized.coverageStatus === "COVERED") {
        normalized.missingHints = { actionTypes: [], objectTypes: [], linkTypes: [], businessRules: [] };
      }
      return normalized;
    });
    return { ...g, scenarios: normalizedScenarios };
  });
  return { ...pyramid, groups: normalizedGroups };
}

async function requestScenarioSandbox(params: {
  apiKey: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
}) {
  const payload = {
    model: MODEL,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    system: "你是咨询式结构化推演专家，擅长 MECE 与金字塔表达，把本体抽象为可执行业务场景清单。",
    messages: [{ role: "user", content: [{ type: "text", text: params.prompt }] }],
  };

  const response = await fetch(buildMessagesUrl(BASE_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "Authorization": `Bearer ${params.apiKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Business Scenario Sandbox] MiniMax API Error: ${response.status}`, errorText);
    return {
      ok: false as const,
      status: response.status,
      errorText,
    };
  }

  const result = await response.json();
  const text = extractTextBlocks(result?.content || []);
  
  if (!text) {
    console.warn(`[Business Scenario Sandbox] MiniMax API returned empty content or unexpected format:`, JSON.stringify(result).slice(0, 500));
  }

  const parsed = safeParseJSON(text) || {};
  const pyramid = normalizePyramid(parsed?.pyramid || {});

  return {
    ok: true as const,
    text,
    pyramid,
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "缺少 MINIMAX_API_KEY（或 ANTHROPIC_API_KEY）环境变量" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const ontology = body?.ontology;
  if (!ontology) {
    return NextResponse.json({ error: "ontology 不能为空" }, { status: 400 });
  }

  const { ontologyDigest, digest } = buildOntologyDigest(ontology);
  if (!digest?.meta?.objectTypeCount && !digest?.meta?.actionTypeCount && !digest?.meta?.linkTypeCount) {
    return NextResponse.json({ error: "本体数据为空，请先创建对象/关系/动作等元素" }, { status: 400 });
  }

  const prompt = buildAgentPrompt(digest);

  const primary = await requestScenarioSandbox({
    apiKey,
    prompt,
    maxTokens: 12000,
    temperature: 0.3,
  });

  if (!primary.ok) {
    return NextResponse.json(
      { error: "MiniMax 调用失败", detail: primary.errorText.slice(0, 800) },
      { status: 502 }
    );
  }

  let pyramid = primary.pyramid;
  let text = primary.text;

  const primaryGroups = Array.isArray(pyramid?.groups) ? pyramid.groups : [];
  const looksTruncated = typeof text === "string" && text.length > 0 && !primaryGroups.length;
  if (looksTruncated) {
    const retryPrompt =
      `${prompt}\n\n` +
      `补救模式（你上次输出可能因为过长被截断）：\n` +
      `- 严格压缩：groups=5；每组 scenarios=4；steps=4；rationale<=45字；goal/trigger<=30字\n` +
      `- coverageHints 与 missingHints 每类最多 4 个\n` +
      `- 只输出 JSON，不要包含任何解释/前后缀\n`;

    const retry = await requestScenarioSandbox({
      apiKey,
      prompt: retryPrompt,
      maxTokens: 6000,
      temperature: 0.2,
    });

    if (retry.ok) {
      pyramid = retry.pyramid;
      text = retry.text;
    }
  }

  const groups = Array.isArray(pyramid?.groups) ? pyramid.groups : [];
  const totalGroups = groups.length;
  const totalScenarios = groups.reduce((sum: number, g: any) => sum + (Array.isArray(g?.scenarios) ? g.scenarios.length : 0), 0);

  const { coverage, gaps } = computeCoverageAndGaps(digest, pyramid);

  return NextResponse.json({
    meta: {
      ontologyDigest,
      model: MODEL,
      generatedAt: new Date().toISOString(),
      totalGroups,
      totalScenarios,
    },
    pyramid,
    coverage,
    gaps,
    rawText: typeof text === "string" ? text.slice(0, 4000) : "",
  });
}
