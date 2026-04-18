import "server-only";

import { stableHash } from "@/lib/meta/meta-core";
import { toPascalCase } from "@/lib/utils";
import type { MetaCore } from "@/lib/meta/meta-core";
import type { ActionType, AnalysisInsight, BusinessRule, LinkType, ObjectType, Property } from "@/lib/types/ontology";
import type { OsiBehaviorLayer, OsiCoreDocument, OsiImportError } from "@/lib/osi/osi-import-types";

type DatasetRef = {
  semanticModelName: string;
  dataset: NonNullable<OsiCoreDocument["semantic_model"][number]["datasets"]>[number];
};

function nowIso() {
  return new Date().toISOString();
}

function err(fileName: string, message: string, pointer: string): OsiImportError {
  return { fileName, message, path: pointer };
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}${stableHash(value)}`;
}

function stringifyShort(value: unknown, limit = 1800) {
  const text = JSON.stringify(value ?? null, null, 2);
  if (text.length <= limit) return text;
  return text.slice(0, limit);
}

function toOsiCamelCase(value: string) {
  const pascal = toPascalCase(String(value || ""));
  if (!pascal) return "";
  return pascal[0].toLowerCase() + pascal.slice(1);
}

function baseTypeFromJsonSchemaType(typeValue: unknown): Property["baseType"] {
  const t = String(typeValue || "").toLowerCase();
  if (t === "integer") return "INTEGER";
  if (t === "number") return "DOUBLE";
  if (t === "boolean") return "BOOLEAN";
  if (t === "object" || t === "array") return "STRUCT";
  if (t === "string") return "STRING";
  return "STRING";
}

function baseTypeForField(field: any): Property["baseType"] {
  if (field?.dimension?.is_time) return "TIMESTAMP";
  return "STRING";
}

function shouldParseBehaviorLayer(dataString: string) {
  const text = String(dataString || "");
  return text.includes("behavior_layer_version") || text.includes("\"action_types\"") || text.includes("\"rules\"");
}

function parsePropertiesFromSchema(params: { datasetName: string; actionId: string; kind: "input" | "output"; schema: any }): Property[] {
  const { datasetName, actionId, kind, schema } = params;
  if (!schema || typeof schema !== "object") return [];

  const requiredList: string[] = Array.isArray(schema.required) ? schema.required.map((x: any) => String(x)) : [];
  const requiredSet = new Set(requiredList);
  const propsObj = schema.properties && typeof schema.properties === "object" ? schema.properties : null;

  if (!propsObj) {
    return [
      {
        id: stableId("osi-act-prop-", `${datasetName}:${actionId}:${kind}:payload`),
        apiName: "payload",
        displayName: "payload",
        baseType: "STRUCT",
        visibility: "NORMAL",
        required: false,
        description: stringifyShort(schema),
      },
    ];
  }

  const usedApiNames = new Set<string>();
  const out: Property[] = [];
  for (const [rawKey, def] of Object.entries(propsObj)) {
    const key = String(rawKey || "").trim();
    if (!key) continue;
    const apiName = toOsiCamelCase(key);
    if (usedApiNames.has(apiName)) continue;
    usedApiNames.add(apiName);
    out.push({
      id: stableId("osi-act-prop-", `${datasetName}:${actionId}:${kind}:${key}`),
      apiName,
      displayName: key,
      baseType: baseTypeFromJsonSchemaType((def as any)?.type),
      visibility: "NORMAL",
      required: requiredSet.has(key),
      description: (def as any)?.description ? String((def as any).description) : undefined,
    });
  }
  return out;
}

function mapRuleType(constraintType: string, severity: string): BusinessRule["ruleType"] {
  const ct = String(constraintType || "").toLowerCase();
  if (ct === "expression") return "DERIVATION";
  if (ct === "definition") return "DERIVATION";
  if (ct === "quality" || ct === "security" || ct === "compliance") return "VALIDATION";
  if (String(severity || "").toLowerCase() === "info") return "ENRICHMENT";
  return "CONSTRAINT";
}

function mapPriority(severity: string) {
  const s = String(severity || "").toLowerCase();
  if (s === "error") return 80;
  if (s === "warn") return 50;
  return 20;
}

function mapOnViolation(severity: string, message: string): BusinessRule["onViolation"] {
  const s = String(severity || "").toLowerCase();
  if (s === "error") return { action: "BLOCK", message };
  if (s === "warn") return { action: "WARN", message };
  return { action: "LOG", message };
}

function pickTitleKeyApiName(properties: Property[]) {
  const preferred = ["name", "title", "displayName", "display_name"];
  const byApi = new Map(properties.map((p) => [p.apiName, p]));
  for (const p of preferred) {
    const api = toOsiCamelCase(p);
    if (byApi.has(api)) return api;
  }
  return properties.find((p) => p.baseType === "STRING")?.apiName || properties[0]?.apiName || "";
}

export function osiToMetaCore(input: Array<{ fileName: string; doc: OsiCoreDocument }>) {
  const errors: OsiImportError[] = [];

  const allDatasets: Array<{ fileName: string; ref: DatasetRef }> = [];
  const allRelationships: Array<{
    fileName: string;
    semanticModelName: string;
    rel: NonNullable<OsiCoreDocument["semantic_model"][number]["relationships"]>[number];
  }> = [];

  for (const f of input) {
    for (const sm of f.doc.semantic_model || []) {
      const smName = String(sm?.name || "").trim();
      for (const ds of sm.datasets || []) {
        allDatasets.push({ fileName: f.fileName, ref: { semanticModelName: smName, dataset: ds } });
      }
      for (const rel of sm.relationships || []) {
        allRelationships.push({ fileName: f.fileName, semanticModelName: smName, rel });
      }
    }
  }

  const datasetNameSet = new Set<string>();
  for (const d of allDatasets) {
    const name = String(d.ref.dataset?.name || "").trim();
    if (!name) {
      errors.push(err(d.fileName, "dataset.name 不能为空", `/datasets/name`));
      continue;
    }
    if (datasetNameSet.has(name)) {
      errors.push(err(d.fileName, `dataset.name 重复：${name}`, `/datasets/${name}`));
      continue;
    }
    datasetNameSet.add(name);
  }

  const objectTypes: ObjectType[] = [];
  const objectTypeByDatasetName = new Map<string, ObjectType>();
  const usedObjectApiNames = new Set<string>();
  const datasetMetaKeyByName = new Map<string, { fileName: string; semanticModelName: string }>();

  for (const d of allDatasets) {
    const ds = d.ref.dataset;
    const datasetName = String(ds.name || "").trim();
    if (!datasetName) continue;

    const apiName = toPascalCase(datasetName);
    if (usedObjectApiNames.has(apiName)) {
      errors.push(
        err(
          d.fileName,
          `dataset.name 映射后 ObjectType.apiName 冲突：${datasetName} → ${apiName}`,
          `/semantic_model/${d.ref.semanticModelName}/datasets/${datasetName}/name`
        )
      );
      continue;
    }
    usedObjectApiNames.add(apiName);

    const fields = Array.isArray(ds.fields) ? ds.fields : [];
    const usedPropApiNames = new Set<string>();
    const properties: Property[] = fields.map((f: any) => {
      const fieldName = String(f?.name || "").trim();
      const propApiName = toOsiCamelCase(fieldName);
      if (!fieldName) {
        errors.push(err(d.fileName, "field.name 不能为空", `/dataset/${datasetName}/fields/name`));
      }
      if (usedPropApiNames.has(propApiName)) {
        errors.push(
          err(
            d.fileName,
            `field.name 映射后 Property.apiName 冲突：${fieldName} → ${propApiName}`,
            `/semantic_model/${d.ref.semanticModelName}/datasets/${datasetName}/fields/${fieldName}/name`
          )
        );
      }
      usedPropApiNames.add(propApiName);
      return {
        id: stableId("osi-prop-", `${datasetName}:${fieldName}`),
        apiName: propApiName,
        displayName: String(f?.description || fieldName || propApiName),
        baseType: baseTypeForField(f),
        visibility: "NORMAL",
        required: false,
        description: f?.description ? String(f.description) : undefined,
      };
    });

    const pkField = Array.isArray(ds.primary_key) ? String(ds.primary_key[0] || "").trim() : "";
    const pkApi = pkField ? toOsiCamelCase(pkField) : "";
    const pkId = pkApi ? properties.find((p) => p.apiName === pkApi)?.id || "" : "";
    const titleApi = pickTitleKeyApiName(properties);
    const titleId = titleApi ? properties.find((p) => p.apiName === titleApi)?.id || "" : "";

    const now = nowIso();
    const ot: ObjectType = {
      id: stableId("osi-ot-", `${d.ref.semanticModelName}:${datasetName}`),
      apiName,
      displayName: String(ds.description || datasetName),
      description: ds.description ? String(ds.description) : undefined,
      primaryKey: pkId,
      titleKey: titleId || pkId,
      properties,
      visibility: "PROJECT",
      layer: "SEMANTIC",
      createdAt: now,
      updatedAt: now,
    };
    objectTypes.push(ot);
    objectTypeByDatasetName.set(datasetName, ot);
    datasetMetaKeyByName.set(datasetName, { fileName: d.fileName, semanticModelName: d.ref.semanticModelName });
  }

  const linkTypes: LinkType[] = [];
  const usedLinkApiNames = new Set<string>();

  for (const r of allRelationships) {
    const rel = r.rel;
    const relName = String(rel?.name || "").trim();
    if (!relName) {
      errors.push(err(r.fileName, "relationship.name 不能为空", `/semantic_model/${r.semanticModelName}/relationships/name`));
      continue;
    }
    const apiName = toPascalCase(relName);
    if (usedLinkApiNames.has(apiName)) {
      errors.push(
        err(
          r.fileName,
          `relationship.name 映射后 LinkType.apiName 冲突：${relName} → ${apiName}`,
          `/semantic_model/${r.semanticModelName}/relationships/${relName}/name`
        )
      );
      continue;
    }
    usedLinkApiNames.add(apiName);

    const fromName = String(rel?.from || "").trim();
    const toName = String(rel?.to || "").trim();
    const source = objectTypeByDatasetName.get(fromName);
    const target = objectTypeByDatasetName.get(toName);
    if (!source) {
      errors.push(err(r.fileName, `relationship.from 不存在对应 dataset：${fromName}`, `/semantic_model/${r.semanticModelName}/relationships/${relName}/from`));
      continue;
    }
    if (!target) {
      errors.push(err(r.fileName, `relationship.to 不存在对应 dataset：${toName}`, `/semantic_model/${r.semanticModelName}/relationships/${relName}/to`));
      continue;
    }

    const fkField = Array.isArray(rel?.from_columns) ? String(rel.from_columns[0] || "").trim() : "";
    const fkApi = fkField ? toOsiCamelCase(fkField) : "";
    const fkId = fkApi ? source.properties.find((p) => p.apiName === fkApi)?.id || "" : "";
    const now = nowIso();

    linkTypes.push({
      id: stableId("osi-link-", `${r.semanticModelName}:${relName}`),
      apiName,
      displayName: relName,
      description: undefined,
      sourceTypeId: source.id,
      targetTypeId: target.id,
      cardinality: "MANY_TO_ONE",
      foreignKeyPropertyId: fkId,
      properties: [],
      visibility: "PROJECT",
      layer: "SEMANTIC",
      relationshipType: "ASSOCIATION",
      createdAt: now,
      updatedAt: now,
    });
  }

  const actionTypes: ActionType[] = [];
  const businessRules: BusinessRule[] = [];
  const analysisInsights: AnalysisInsight[] = [];
  const usedActionApiNames = new Set<string>();
  const usedRuleApiNames = new Set<string>();
  const usedInsightApiNames = new Set<string>();

  for (const d of allDatasets) {
    const ds = d.ref.dataset;
    const datasetName = String(ds?.name || "").trim();
    if (!datasetName) continue;
    const ot = objectTypeByDatasetName.get(datasetName);
    if (!ot) continue;

    const exts = Array.isArray(ds.custom_extensions) ? ds.custom_extensions : [];
    for (let ei = 0; ei < exts.length; ei += 1) {
      const ext = exts[ei] as any;
      const dataString = String(ext?.data || "");
      if (!shouldParseBehaviorLayer(dataString)) continue;

      let behavior: OsiBehaviorLayer | null = null;
      try {
        behavior = JSON.parse(dataString) as OsiBehaviorLayer;
      } catch (e: any) {
        errors.push(
          err(
            d.fileName,
            `behavior_layer custom_extensions.data 不是合法 JSON：${e?.message || "unknown error"}`,
            `/semantic_model/${d.ref.semanticModelName}/datasets/${datasetName}/custom_extensions/${ei}/data`
          )
        );
        continue;
      }

      for (const a of behavior.action_types || []) {
        const actionId = String(a?.id || "").trim();
        const title = String(a?.title || "").trim();
        if (!actionId || !title) continue;

        const apiName = toPascalCase(`${datasetName}_${actionId}`);
        if (usedActionApiNames.has(apiName)) {
          errors.push(
            err(
              d.fileName,
              `action_types 映射后 ActionType.apiName 冲突：${apiName}`,
              `/semantic_model/${d.ref.semanticModelName}/datasets/${datasetName}/custom_extensions/${ei}/data/action_types/${actionId}/id`
            )
          );
          continue;
        }
        usedActionApiNames.add(apiName);

        const now = nowIso();
        const inputSchema = (a as any)?.io_schema?.input_schema;
        const outputSchema = (a as any)?.io_schema?.output_schema;
        const inputParameters = parsePropertiesFromSchema({ datasetName, actionId, kind: "input", schema: inputSchema });
        const outputProperties = parsePropertiesFromSchema({ datasetName, actionId, kind: "output", schema: outputSchema });

        const at: ActionType = {
          id: stableId("osi-act-", `${d.ref.semanticModelName}:${datasetName}:${actionId}`),
          apiName,
          displayName: title,
          description: a?.description ? String(a.description) : undefined,
          affectedObjectTypeIds: [ot.id],
          affectedLinkTypeIds: [],
          inputParameters,
          outputProperties,
          visibility: "PROJECT",
          layer: "KINETIC",
          createdAt: now,
          updatedAt: now,
        };
        actionTypes.push(at);
      }

      for (const r of behavior.rules || []) {
        const ruleId = String(r?.id || "").trim();
        const title = String(r?.title || "").trim();
        if (!ruleId || !title) continue;

        const apiName = toPascalCase(`${datasetName}_${ruleId}`);
        if (usedRuleApiNames.has(apiName)) {
          errors.push(
            err(
              d.fileName,
              `rules 映射后 BusinessRule.apiName 冲突：${apiName}`,
              `/semantic_model/${d.ref.semanticModelName}/datasets/${datasetName}/custom_extensions/${ei}/data/rules/${ruleId}/id`
            )
          );
          continue;
        }
        usedRuleApiNames.add(apiName);

        const severity = String((r as any)?.severity || "").toLowerCase();
        const message = String((r as any)?.message || title);
        const constraintType = String((r as any)?.constraint?.type || "");

        const now = nowIso();
        const br: BusinessRule = {
          id: stableId("osi-rule-", `${d.ref.semanticModelName}:${datasetName}:${ruleId}`),
          apiName,
          displayName: title,
          description: (r as any)?.description ? String((r as any).description) : message,
          ruleType: mapRuleType(constraintType, severity),
          expression: stringifyShort(
            {
              severity: (r as any)?.severity,
              when: (r as any)?.when,
              if: (r as any)?.if,
              constraint: (r as any)?.constraint,
              message: (r as any)?.message,
              remediation: (r as any)?.remediation,
              references: (r as any)?.references,
              tags: (r as any)?.tags,
            },
            2400
          ),
          appliesToObjectTypeIds: [ot.id],
          onViolation: mapOnViolation(severity, message),
          priority: mapPriority(severity),
          enabled: true,
          visibility: "PROJECT",
          layer: "DYNAMIC",
          createdAt: now,
          updatedAt: now,
        };
        businessRules.push(br);
      }
    }
  }

  for (const f of input) {
    for (const sm of f.doc.semantic_model || []) {
      const smName = String(sm?.name || "").trim();
      const datasets = Array.isArray(sm.datasets) ? sm.datasets : [];
      const firstDatasetName = String(datasets[0]?.name || "").trim();
      const defaultOtId = firstDatasetName ? objectTypeByDatasetName.get(firstDatasetName)?.id || "" : "";

      const metrics = Array.isArray(sm.metrics) ? sm.metrics : [];
      for (const m of metrics) {
        const name = String((m as any)?.name || "").trim();
        if (!name) continue;
        const apiName = toPascalCase(name);
        if (usedInsightApiNames.has(apiName)) {
          errors.push(err(f.fileName, `metrics 映射后 AnalysisInsight.apiName 冲突：${apiName}`, `/semantic_model/${smName}/metrics/${name}/name`));
          continue;
        }
        usedInsightApiNames.add(apiName);

        const dialects = Array.isArray((m as any)?.expression?.dialects) ? (m as any).expression.dialects : [];
        const exprText = dialects
          .map((d: any) => `- ${String(d?.dialect || "")}: ${String(d?.expression || "")}`)
          .join("\n");
        const desc =
          (m as any)?.description
            ? `${String((m as any).description)}\n\n${exprText ? `Expression:\n${exprText}` : ""}`.trim()
            : (exprText ? `Expression:\n${exprText}` : undefined);

        const now = nowIso();
        const insight: AnalysisInsight = {
          id: stableId("osi-metric-", `${smName}:${name}`),
          apiName,
          displayName: name,
          description: desc,
          insightType: "METRIC",
          dataSources: defaultOtId ? [{ objectTypeId: defaultOtId, propertyIds: [] }] : [],
          visibility: "PROJECT",
          layer: "DYNAMIC",
          createdAt: now,
          updatedAt: now,
        };
        analysisInsights.push(insight);
      }
    }
  }

  const meta: MetaCore = {
    scenario: "custom",
    objectTypes,
    linkTypes,
    actionTypes,
    dataFlows: [],
    businessRules,
    aiModels: [],
    analysisInsights,
  };

  return { ok: errors.length === 0, errors, meta };
}
