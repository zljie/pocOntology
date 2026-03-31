import {
  ActionType,
  AIModel,
  AnalysisInsight,
  BusinessRule,
  Cardinality,
  DataFlow,
  LinkType,
  ObjectType,
  Property,
} from "@/lib/types/ontology";
import { isCamelCase, isPascalCase } from "@/lib/utils";

export type MetaScenario = "library" | "erp" | "custom";

export interface MetaCore {
  scenario?: MetaScenario;
  objectTypes: ObjectType[];
  linkTypes: LinkType[];
  actionTypes: ActionType[];
  dataFlows: DataFlow[];
  businessRules: BusinessRule[];
  aiModels: AIModel[];
  analysisInsights: AnalysisInsight[];
}

export type MetaIssueSeverity = "ERROR" | "WARN";

export interface MetaIssue {
  severity: MetaIssueSeverity;
  code: string;
  message: string;
  path?: string;
  entity?: {
    kind:
      | "ObjectType"
      | "LinkType"
      | "ActionType"
      | "DataFlow"
      | "BusinessRule"
      | "AIModel"
      | "AnalysisInsight"
      | "Property";
    id: string;
    apiName?: string;
  };
}

export interface MetaSnapshot {
  id: string;
  name: string;
  createdAt: string;
  scenario?: MetaScenario;
  metaHash: string;
  meta: MetaCore;
}

export interface MetaDiffItem {
  kind: NonNullable<MetaIssue["entity"]>["kind"];
  apiName: string;
  change: "ADDED" | "REMOVED" | "CHANGED";
  details?: string;
}

export interface MetaDiff {
  from: { name: string; metaHash: string };
  to: { name: string; metaHash: string };
  items: MetaDiffItem[];
  markdown: string;
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const stringify = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(stringify);
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = stringify(v[k]);
    return out;
  };

  return JSON.stringify(stringify(value));
}

export function stableHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function uniqueByApiName<T extends { apiName: string; id: string }>(
  kind: NonNullable<MetaIssue["entity"]>["kind"],
  items: T[],
  issues: MetaIssue[],
  pathPrefix: string
) {
  const byName = new Map<string, T[]>();
  for (const it of items) {
    const name = String((it as any)?.apiName || "");
    if (!name) continue;
    const arr = byName.get(name) || [];
    arr.push(it);
    byName.set(name, arr);
  }
  byName.forEach((arr, name) => {
    if (arr.length <= 1) return;
    for (const it of arr) {
      issues.push({
        severity: "ERROR",
        code: "DUPLICATE_API_NAME",
        message: `${kind} apiName 重复：${name}`,
        path: `${pathPrefix}.${name}`,
        entity: { kind, id: it.id, apiName: it.apiName },
      });
    }
  });
}

function validateProperty(
  owner: { id: string; apiName: string },
  property: Property,
  issues: MetaIssue[],
  pathPrefix: string
) {
  if (!property?.id) {
    issues.push({
      severity: "ERROR",
      code: "MISSING_ID",
      message: `Property 缺少 id（owner=${owner.apiName}）`,
      path: pathPrefix,
      entity: { kind: "Property", id: owner.id, apiName: owner.apiName },
    });
    return;
  }
  if (!property?.apiName) {
    issues.push({
      severity: "ERROR",
      code: "MISSING_API_NAME",
      message: `Property 缺少 apiName（owner=${owner.apiName}）`,
      path: pathPrefix,
      entity: { kind: "Property", id: property.id, apiName: property.apiName },
    });
  } else if (!isCamelCase(property.apiName) && property.apiName !== "id") {
    issues.push({
      severity: "WARN",
      code: "PROPERTY_API_NAME_STYLE",
      message: `Property apiName 建议为 camelCase：${owner.apiName}.${property.apiName}`,
      path: pathPrefix,
      entity: { kind: "Property", id: property.id, apiName: property.apiName },
    });
  }

  const allowedBaseTypes = ["STRING", "INTEGER", "DOUBLE", "BOOLEAN", "TIMESTAMP", "STRUCT"];
  if (!allowedBaseTypes.includes(String((property as any)?.baseType))) {
    issues.push({
      severity: "ERROR",
      code: "INVALID_BASE_TYPE",
      message: `Property baseType 非法：${owner.apiName}.${property.apiName}`,
      path: pathPrefix,
      entity: { kind: "Property", id: property.id, apiName: property.apiName },
    });
  }
}

export function validateMetaCore(meta: MetaCore): MetaIssue[] {
  const issues: MetaIssue[] = [];

  const objectTypes = Array.isArray(meta?.objectTypes) ? meta.objectTypes : [];
  const linkTypes = Array.isArray(meta?.linkTypes) ? meta.linkTypes : [];
  const actionTypes = Array.isArray(meta?.actionTypes) ? meta.actionTypes : [];
  const dataFlows = Array.isArray(meta?.dataFlows) ? meta.dataFlows : [];
  const businessRules = Array.isArray(meta?.businessRules) ? meta.businessRules : [];
  const aiModels = Array.isArray(meta?.aiModels) ? meta.aiModels : [];
  const analysisInsights = Array.isArray(meta?.analysisInsights) ? meta.analysisInsights : [];

  const objectTypeById = new Map<string, ObjectType>(objectTypes.map((ot) => [ot.id, ot]));
  const linkTypeById = new Map<string, LinkType>(linkTypes.map((lt) => [lt.id, lt]));
  const actionTypeById = new Map<string, ActionType>(actionTypes.map((at) => [at.id, at]));

  uniqueByApiName("ObjectType", objectTypes, issues, "objectTypes");
  uniqueByApiName("LinkType", linkTypes, issues, "linkTypes");
  uniqueByApiName("ActionType", actionTypes, issues, "actionTypes");
  uniqueByApiName("DataFlow", dataFlows as any, issues, "dataFlows");
  uniqueByApiName("BusinessRule", businessRules as any, issues, "businessRules");
  uniqueByApiName("AIModel", aiModels as any, issues, "aiModels");
  uniqueByApiName("AnalysisInsight", analysisInsights as any, issues, "analysisInsights");

  for (const ot of objectTypes) {
    const basePath = `objectTypes.${ot.apiName || ot.id}`;
    if (!ot?.apiName) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_API_NAME",
        message: `ObjectType 缺少 apiName（id=${ot.id}）`,
        path: basePath,
        entity: { kind: "ObjectType", id: ot.id, apiName: ot.apiName },
      });
    } else if (!isPascalCase(ot.apiName)) {
      issues.push({
        severity: "WARN",
        code: "OBJECT_API_NAME_STYLE",
        message: `ObjectType apiName 建议为 PascalCase：${ot.apiName}`,
        path: basePath,
        entity: { kind: "ObjectType", id: ot.id, apiName: ot.apiName },
      });
    }

    const propIds = new Set<string>();
    const propApiNames = new Map<string, string[]>();
    const properties = Array.isArray(ot?.properties) ? ot.properties : [];
    for (const p of properties) {
      validateProperty({ id: ot.id, apiName: ot.apiName }, p, issues, `${basePath}.properties.${p?.apiName || p?.id}`);
      if (p?.id) {
        if (propIds.has(p.id)) {
          issues.push({
            severity: "ERROR",
            code: "DUPLICATE_PROPERTY_ID",
            message: `Property id 重复：${ot.apiName}.${p.id}`,
            path: `${basePath}.properties`,
            entity: { kind: "Property", id: p.id, apiName: p.apiName },
          });
        }
        propIds.add(p.id);
      }
      const name = String(p?.apiName || "");
      if (name) {
        const arr = propApiNames.get(name) || [];
        arr.push(String(p?.id || ""));
        propApiNames.set(name, arr);
      }
    }
    propApiNames.forEach((ids, name) => {
      if (ids.length <= 1) return;
      issues.push({
        severity: "ERROR",
        code: "DUPLICATE_PROPERTY_API_NAME",
        message: `Property apiName 重复：${ot.apiName}.${name}`,
        path: `${basePath}.properties.${name}`,
        entity: { kind: "ObjectType", id: ot.id, apiName: ot.apiName },
      });
    });

    const primaryKeyOk = ot?.primaryKey && propIds.has(ot.primaryKey);
    if (!primaryKeyOk) {
      issues.push({
        severity: "WARN",
        code: "INVALID_PRIMARY_KEY",
        message: `ObjectType primaryKey 未指向有效 Property：${ot.apiName}`,
        path: `${basePath}.primaryKey`,
        entity: { kind: "ObjectType", id: ot.id, apiName: ot.apiName },
      });
    }

    const titleKeyOk = ot?.titleKey && propIds.has(ot.titleKey);
    if (!titleKeyOk) {
      issues.push({
        severity: "WARN",
        code: "INVALID_TITLE_KEY",
        message: `ObjectType titleKey 未指向有效 Property：${ot.apiName}`,
        path: `${basePath}.titleKey`,
        entity: { kind: "ObjectType", id: ot.id, apiName: ot.apiName },
      });
    }
  }

  const allowedCardinalities: Cardinality[] = ["ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"];
  for (const lt of linkTypes) {
    const basePath = `linkTypes.${lt.apiName || lt.id}`;
    
    // Validate LinkType ID pattern (lowercase, numbers, dashes, starts with lowercase)
    if (lt.id && !/^[a-z][a-z0-9-]*$/.test(lt.id)) {
      issues.push({
        severity: "ERROR",
        code: "INVALID_LINK_ID_FORMAT",
        message: `LinkType ID 必须以小写字母开头，且只能包含小写字母、数字和短划线：${lt.id}`,
        path: `${basePath}.id`,
        entity: { kind: "LinkType", id: lt.id, apiName: lt.apiName },
      });
    }

    if (!lt?.apiName) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_API_NAME",
        message: `LinkType 缺少 apiName（id=${lt.id}）`,
        path: basePath,
        entity: { kind: "LinkType", id: lt.id, apiName: lt.apiName },
      });
    } else if (!isPascalCase(lt.apiName)) {
      issues.push({
        severity: "WARN",
        code: "LINK_API_NAME_STYLE",
        message: `LinkType apiName 建议为 PascalCase：${lt.apiName}`,
        path: basePath,
        entity: { kind: "LinkType", id: lt.id, apiName: lt.apiName },
      });
    }

    // Validate target/source API names (camelCase, alphanumeric)
    const validateLinkApiName = (name: string | undefined, side: string) => {
      if (!name) return;
      if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
        issues.push({
          severity: "ERROR",
          code: "INVALID_LINK_API_NAME_FORMAT",
          message: `LinkType ${side} API名称必须使用驼峰命名法（小写字母开头，仅字母数字）：${name}`,
          path: `${basePath}.${side}ApiName`,
          entity: { kind: "LinkType", id: lt.id, apiName: lt.apiName },
        });
      }
    };
    validateLinkApiName(lt.targetApiName, 'target');
    validateLinkApiName(lt.sourceApiName, 'source');

    if (!objectTypeById.has(lt.sourceTypeId)) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_REFERENCE",
        message: `LinkType sourceTypeId 不存在：${lt.apiName}`,
        path: `${basePath}.sourceTypeId`,
        entity: { kind: "LinkType", id: lt.id, apiName: lt.apiName },
      });
    }
    if (!objectTypeById.has(lt.targetTypeId)) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_REFERENCE",
        message: `LinkType targetTypeId 不存在：${lt.apiName}`,
        path: `${basePath}.targetTypeId`,
        entity: { kind: "LinkType", id: lt.id, apiName: lt.apiName },
      });
    }
    if (!allowedCardinalities.includes(lt.cardinality)) {
      issues.push({
        severity: "ERROR",
        code: "INVALID_CARDINALITY",
        message: `LinkType cardinality 非法：${lt.apiName}`,
        path: `${basePath}.cardinality`,
        entity: { kind: "LinkType", id: lt.id, apiName: lt.apiName },
      });
    }

    const source = objectTypeById.get(lt.sourceTypeId);
    if (source) {
      const propIds = new Set((source.properties || []).map((p) => p.id));
      if (lt.foreignKeyPropertyId && !propIds.has(lt.foreignKeyPropertyId)) {
        issues.push({
          severity: "WARN",
          code: "INVALID_FOREIGN_KEY_PROPERTY",
          message: `LinkType foreignKeyPropertyId 未指向 source 的 Property：${lt.apiName}`,
          path: `${basePath}.foreignKeyPropertyId`,
          entity: { kind: "LinkType", id: lt.id, apiName: lt.apiName },
        });
      }
    }
  }

  for (const at of actionTypes) {
    const basePath = `actionTypes.${at.apiName || at.id}`;
    if (!at?.apiName) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_API_NAME",
        message: `ActionType 缺少 apiName（id=${at.id}）`,
        path: basePath,
        entity: { kind: "ActionType", id: at.id, apiName: at.apiName },
      });
    } else if (!isPascalCase(at.apiName)) {
      issues.push({
        severity: "WARN",
        code: "ACTION_API_NAME_STYLE",
        message: `ActionType apiName 建议为 PascalCase：${at.apiName}`,
        path: basePath,
        entity: { kind: "ActionType", id: at.id, apiName: at.apiName },
      });
    }

    for (const id of at.affectedObjectTypeIds || []) {
      if (!objectTypeById.has(id)) {
        issues.push({
          severity: "ERROR",
          code: "MISSING_REFERENCE",
          message: `ActionType affectedObjectTypeIds 引用不存在：${at.apiName}`,
          path: `${basePath}.affectedObjectTypeIds`,
          entity: { kind: "ActionType", id: at.id, apiName: at.apiName },
        });
      }
    }
    for (const id of at.affectedLinkTypeIds || []) {
      if (!linkTypeById.has(id)) {
        issues.push({
          severity: "ERROR",
          code: "MISSING_REFERENCE",
          message: `ActionType affectedLinkTypeIds 引用不存在：${at.apiName}`,
          path: `${basePath}.affectedLinkTypeIds`,
          entity: { kind: "ActionType", id: at.id, apiName: at.apiName },
        });
      }
    }
    for (const p of at.inputParameters || []) {
      validateProperty({ id: at.id, apiName: at.apiName }, p, issues, `${basePath}.inputParameters.${p?.apiName || p?.id}`);
    }
    for (const p of at.outputProperties || []) {
      validateProperty({ id: at.id, apiName: at.apiName }, p, issues, `${basePath}.outputProperties.${p?.apiName || p?.id}`);
    }
    for (const id of at.preActions || []) {
      if (!actionTypeById.has(id)) {
        issues.push({
          severity: "WARN",
          code: "MISSING_REFERENCE",
          message: `ActionType preActions 引用不存在：${at.apiName}`,
          path: `${basePath}.preActions`,
          entity: { kind: "ActionType", id: at.id, apiName: at.apiName },
        });
      }
    }
    for (const id of at.postActions || []) {
      if (!actionTypeById.has(id)) {
        issues.push({
          severity: "WARN",
          code: "MISSING_REFERENCE",
          message: `ActionType postActions 引用不存在：${at.apiName}`,
          path: `${basePath}.postActions`,
          entity: { kind: "ActionType", id: at.id, apiName: at.apiName },
        });
      }
    }
  }

  for (const df of dataFlows) {
    const basePath = `dataFlows.${df.apiName || df.id}`;
    if (!df?.apiName) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_API_NAME",
        message: `DataFlow 缺少 apiName（id=${df.id}）`,
        path: basePath,
        entity: { kind: "DataFlow", id: df.id, apiName: df.apiName },
      });
    } else if (!isPascalCase(df.apiName)) {
      issues.push({
        severity: "WARN",
        code: "DATAFLOW_API_NAME_STYLE",
        message: `DataFlow apiName 建议为 PascalCase：${df.apiName}`,
        path: basePath,
        entity: { kind: "DataFlow", id: df.id, apiName: df.apiName },
      });
    }
    for (const step of df.steps || []) {
      if (step.actionTypeId && !actionTypeById.has(step.actionTypeId)) {
        issues.push({
          severity: "WARN",
          code: "MISSING_REFERENCE",
          message: `DataFlow step.actionTypeId 引用不存在：${df.apiName}`,
          path: `${basePath}.steps.${step.stepOrder}.actionTypeId`,
          entity: { kind: "DataFlow", id: df.id, apiName: df.apiName },
        });
      }
      if (step.objectTypeId && !objectTypeById.has(step.objectTypeId)) {
        issues.push({
          severity: "WARN",
          code: "MISSING_REFERENCE",
          message: `DataFlow step.objectTypeId 引用不存在：${df.apiName}`,
          path: `${basePath}.steps.${step.stepOrder}.objectTypeId`,
          entity: { kind: "DataFlow", id: df.id, apiName: df.apiName },
        });
      }
    }
  }

  for (const rule of businessRules) {
    const basePath = `businessRules.${rule.apiName || rule.id}`;
    if (!rule?.apiName) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_API_NAME",
        message: `BusinessRule 缺少 apiName（id=${rule.id}）`,
        path: basePath,
        entity: { kind: "BusinessRule", id: rule.id, apiName: rule.apiName },
      });
    } else if (!isPascalCase(rule.apiName)) {
      issues.push({
        severity: "WARN",
        code: "RULE_API_NAME_STYLE",
        message: `BusinessRule apiName 建议为 PascalCase：${rule.apiName}`,
        path: basePath,
        entity: { kind: "BusinessRule", id: rule.id, apiName: rule.apiName },
      });
    }
    for (const id of rule.appliesToObjectTypeIds || []) {
      if (!objectTypeById.has(id)) {
        issues.push({
          severity: "WARN",
          code: "MISSING_REFERENCE",
          message: `BusinessRule appliesToObjectTypeIds 引用不存在：${rule.apiName}`,
          path: `${basePath}.appliesToObjectTypeIds`,
          entity: { kind: "BusinessRule", id: rule.id, apiName: rule.apiName },
        });
      }
    }
    for (const id of rule.appliesToActionTypeIds || []) {
      if (!actionTypeById.has(id)) {
        issues.push({
          severity: "WARN",
          code: "MISSING_REFERENCE",
          message: `BusinessRule appliesToActionTypeIds 引用不存在：${rule.apiName}`,
          path: `${basePath}.appliesToActionTypeIds`,
          entity: { kind: "BusinessRule", id: rule.id, apiName: rule.apiName },
        });
      }
    }
    if (typeof rule.priority !== "number" || rule.priority < 1 || rule.priority > 100) {
      issues.push({
        severity: "WARN",
        code: "INVALID_PRIORITY",
        message: `BusinessRule priority 建议为 1-100：${rule.apiName}`,
        path: `${basePath}.priority`,
        entity: { kind: "BusinessRule", id: rule.id, apiName: rule.apiName },
      });
    }
  }

  return issues;
}

function indexByKind(meta: MetaCore) {
  const byKind = {
    ObjectType: new Map<string, ObjectType>(),
    LinkType: new Map<string, LinkType>(),
    ActionType: new Map<string, ActionType>(),
    DataFlow: new Map<string, DataFlow>(),
    BusinessRule: new Map<string, BusinessRule>(),
    AIModel: new Map<string, AIModel>(),
    AnalysisInsight: new Map<string, AnalysisInsight>(),
  } as const;

  for (const ot of meta.objectTypes || []) byKind.ObjectType.set(ot.apiName, ot);
  for (const lt of meta.linkTypes || []) byKind.LinkType.set(lt.apiName, lt);
  for (const at of meta.actionTypes || []) byKind.ActionType.set(at.apiName, at);
  for (const df of meta.dataFlows || []) byKind.DataFlow.set(df.apiName, df);
  for (const br of meta.businessRules || []) byKind.BusinessRule.set(br.apiName, br);
  for (const am of meta.aiModels || []) byKind.AIModel.set(am.apiName, am);
  for (const ai of meta.analysisInsights || []) byKind.AnalysisInsight.set(ai.apiName, ai);
  return byKind;
}

function normalizeForDiff(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeForDiff);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    if (k === "createdAt" || k === "updatedAt" || k === "id") continue;
    out[k] = normalizeForDiff(obj[k]);
  }
  return out;
}

export function diffMetaCore(from: { name: string; meta: MetaCore }, to: { name: string; meta: MetaCore }): MetaDiff {
  const fromHash = stableHash(normalizeForDiff(from.meta));
  const toHash = stableHash(normalizeForDiff(to.meta));

  const fromIdx = indexByKind(from.meta);
  const toIdx = indexByKind(to.meta);

  const kinds: Array<keyof typeof fromIdx> = [
    "ObjectType",
    "LinkType",
    "ActionType",
    "DataFlow",
    "BusinessRule",
    "AIModel",
    "AnalysisInsight",
  ];

  const items: MetaDiffItem[] = [];
  for (const kind of kinds) {
    const fromKeys = Array.from(fromIdx[kind].keys());
    const toKeys = Array.from(toIdx[kind].keys());
    const fromSet = new Set(fromKeys);
    const toSet = new Set(toKeys);
    for (const apiName of toKeys) {
      if (!fromSet.has(apiName)) items.push({ kind, apiName, change: "ADDED" });
    }
    for (const apiName of fromKeys) {
      if (!toSet.has(apiName)) items.push({ kind, apiName, change: "REMOVED" });
    }
    for (const apiName of fromKeys) {
      if (!toSet.has(apiName)) continue;
      const a = fromIdx[kind].get(apiName);
      const b = toIdx[kind].get(apiName);
      const aHash = stableHash(normalizeForDiff(a));
      const bHash = stableHash(normalizeForDiff(b));
      if (aHash !== bHash) items.push({ kind, apiName, change: "CHANGED" });
    }
  }

  items.sort((x, y) => {
    if (x.kind !== y.kind) return x.kind.localeCompare(y.kind);
    if (x.change !== y.change) return x.change.localeCompare(y.change);
    return x.apiName.localeCompare(y.apiName);
  });

  const group = (change: MetaDiffItem["change"]) => items.filter((i) => i.change === change);
  const mdLines: string[] = [];
  mdLines.push(`# Meta Diff`);
  mdLines.push(``);
  mdLines.push(`- from: ${from.name} (${fromHash})`);
  mdLines.push(`- to: ${to.name} (${toHash})`);
  mdLines.push(`- changed: ${group("CHANGED").length}, added: ${group("ADDED").length}, removed: ${group("REMOVED").length}`);
  mdLines.push(``);

  const renderSection = (title: string, list: MetaDiffItem[]) => {
    if (!list.length) return;
    mdLines.push(`## ${title}`);
    mdLines.push(``);
    for (const it of list) {
      mdLines.push(`- ${it.kind}: ${it.apiName}`);
    }
    mdLines.push(``);
  };

  renderSection("Added", group("ADDED"));
  renderSection("Removed", group("REMOVED"));
  renderSection("Changed", group("CHANGED"));

  return {
    from: { name: from.name, metaHash: fromHash },
    to: { name: to.name, metaHash: toHash },
    items,
    markdown: mdLines.join("\n"),
  };
}
