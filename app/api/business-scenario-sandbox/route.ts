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
  return `你是“业务场景穷举Agent”（本体业务模型设计器的场景沙盘）。你的目标是回答：当前本体业务模型，最多能推演出哪些可执行的业务场景。

方法论约束：
1) MECE：分组互斥、整体尽量穷尽；不要出现语义重复或交叉分组。
2) 麦肯锡金字塔：先给出顶层主题（一句话），再给出 5-9 个二级分组（并给出 rationale），每个分组下给出可执行子场景清单。
3) “可执行场景”的最低标准：必须能映射到本体中的对象/关系/动作/规则中的至少一个元素，并能写出动作链（steps）。
4) 场景应覆盖：主流程 + 例外/失败路径 + 运营/治理/合规 + 观测/审计 + 批处理/离线 + 多角色协作（如果模型支持）。

严格输出 JSON，不要输出任何额外文本。

输出 JSON schema（必须匹配）：
{
  "pyramid": {
    "theme": "string",
    "groups": [
      {
        "id": "string?",
        "title": "string",
        "rationale": "string?",
        "scenarios": [
          {
            "id": "string?",
            "name": "string",
            "goal": "string?",
            "trigger": "string?",
            "actors": ["string"]?,
            "objects": ["string"]?,
            "steps": ["string"]?,
            "preconditions": ["string"]?,
            "postconditions": ["string"]?,
            "observableResults": ["string"]?,
            "coverageStatus": "COVERED|PARTIAL|GAP"?,
            "coverageHints": {
              "actionTypes": ["string"]?,
              "objectTypes": ["string"]?,
              "linkTypes": ["string"]?,
              "businessRules": ["string"]?
            }?
          }
        ]
      }
    ]
  }
}

覆盖标注规则：
- coverageHints 中的 actionTypes/objectTypes/linkTypes/businessRules 必须只使用下面输入中存在的 apiName；如果无法判断，留空数组。
- coverageStatus：
  - COVERED：能明确映射到至少 1 个 ActionType apiName 且对象/关系匹配清晰
  - PARTIAL：只有对象/规则可匹配，但动作链不完整或需要新增动作
  - GAP：本体明显缺少关键对象/动作/规则，属于盲区

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
  const payload = {
    model: MODEL,
    max_tokens: 10000,
    temperature: 0.4,
    system: "你是咨询式结构化推演专家，擅长 MECE 与金字塔表达，把本体抽象为可执行业务场景清单。",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
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
    return NextResponse.json(
      { error: "MiniMax 调用失败", detail: errorText.slice(0, 800) },
      { status: 502 }
    );
  }

  const result = await response.json();
  const text = extractTextBlocks(result?.content || []);
  const parsed = safeParseJSON(text) || {};

  const pyramid = parsed?.pyramid || {};
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
