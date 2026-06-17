import "server-only";

import {
  DatasetManifest,
  DatasetManifestItem,
  DatasetProvider,
  DatasetSchema,
  QueryEvidence,
  QuerySpec,
} from "@/lib/datasets/types";
import { MANIFEST_TEXT } from "@/lib/datasets/inline/manifest";
import { ERP_DEMO_TEXT } from "@/lib/datasets/inline/erp-demo";

type JsonEntitiesV1File = {
  entities: Record<string, any[]>;
};

type JsonEntitiesV1Source = {
  raw: string;
  parsed: JsonEntitiesV1File;
};

// 把字符串字面量在模块加载时一次性解析，后续访问纯内存读，避免重复 parse。
const SOURCES: Record<string, JsonEntitiesV1Source> = {
  "erp-demo.json": (() => {
    const parsed = JSON.parse(ERP_DEMO_TEXT) as JsonEntitiesV1File;
    return { raw: ERP_DEMO_TEXT, parsed };
  })(),
};

const MANIFEST: DatasetManifest = JSON.parse(MANIFEST_TEXT);

function toArrayTypes(rows: any[], field: string): string[] {
  const types = new Set<string>();
  for (const r of rows) {
    const v = (r as any)?.[field];
    if (v === null || typeof v === "undefined") continue;
    if (Array.isArray(v)) types.add("array");
    else types.add(typeof v);
  }
  return Array.from(types).sort();
}

function buildPseudoSql(spec: QuerySpec) {
  const clauses: string[] = [];
  for (const c of spec.where?.conditions || []) {
    const val = typeof c.value === "string" ? `'${c.value}'` : JSON.stringify(c.value);
    if (c.op === "eq") clauses.push(`${c.field} = ${val}`);
    else if (c.op === "contains") clauses.push(`${c.field} LIKE '%${String(c.value)}%'`);
    else if (c.op === "gt") clauses.push(`${c.field} > ${val}`);
    else if (c.op === "gte") clauses.push(`${c.field} >= ${val}`);
    else if (c.op === "lt") clauses.push(`${c.field} < ${val}`);
    else if (c.op === "lte") clauses.push(`${c.field} <= ${val}`);
    else if (c.op === "in") clauses.push(`${c.field} IN (${Array.isArray(c.value) ? c.value.map((x) => JSON.stringify(x)).join(", ") : val})`);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(spec.where?.op === "or" ? " OR " : " AND ")}` : "";
  const limit = Math.min(Math.max(spec.limit ?? 20, 1), 50);
  const offset = Math.max(spec.offset ?? 0, 0);
  return `SELECT * FROM ${spec.entity}${where} LIMIT ${limit} OFFSET ${offset};`;
}

function matchCondition(row: any, cond: { field: string; op: string; value: any }): boolean {
  const v = row?.[cond.field];
  if (cond.op === "eq") return v === cond.value;
  if (cond.op === "contains") return typeof v === "string" && String(v).includes(String(cond.value));
  if (cond.op === "gt") return typeof v === "number" && typeof cond.value === "number" && v > cond.value;
  if (cond.op === "gte") return typeof v === "number" && typeof cond.value === "number" && v >= cond.value;
  if (cond.op === "lt") return typeof v === "number" && typeof cond.value === "number" && v < cond.value;
  if (cond.op === "lte") return typeof v === "number" && typeof cond.value === "number" && v <= cond.value;
  if (cond.op === "in") return Array.isArray(cond.value) && cond.value.includes(v);
  return false;
}

function applyWhere(rows: any[], spec: QuerySpec): any[] {
  const conditions = spec.where?.conditions || [];
  if (!conditions.length) return rows;
  const op = spec.where?.op || "and";
  return rows.filter((row) => {
    const results = conditions.map((c) => matchCondition(row, c as any));
    return op === "or" ? results.some(Boolean) : results.every(Boolean);
  });
}

export class JsonEntitiesProvider implements DatasetProvider {
  async listDatasets(): Promise<DatasetManifestItem[]> {
    return Array.isArray(MANIFEST?.datasets) ? MANIFEST.datasets : [];
  }

  async getSchema(datasetId: string, entity: string): Promise<DatasetSchema> {
    const item = (await this.listDatasets()).find((d) => d.id === datasetId);
    if (!item) throw new Error(`未知数据集：${datasetId}`);
    const data = SOURCES[item.file];
    if (!data) throw new Error(`数据集 ${datasetId} 的源文件 ${item.file} 缺失或未内联`);
    const rows = Array.isArray(data?.parsed?.entities?.[entity]) ? data.parsed.entities[entity] : [];
    const fieldSet = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r || {})) fieldSet.add(k);
    const fields = Array.from(fieldSet)
      .sort()
      .map((name) => ({ name, types: toArrayTypes(rows, name) }));
    return { entity, fields, rowCount: rows.length };
  }

  async query(spec: QuerySpec): Promise<QueryEvidence> {
    const item = (await this.listDatasets()).find((d) => d.id === spec.datasetId);
    if (!item) throw new Error(`未知数据集：${spec.datasetId}`);
    const data = SOURCES[item.file];
    if (!data) throw new Error(`数据集 ${spec.datasetId} 的源文件 ${item.file} 缺失或未内联`);
    const allRows = Array.isArray(data?.parsed?.entities?.[spec.entity]) ? data.parsed.entities[spec.entity] : [];
    const filtered = applyWhere(allRows, spec);
    const limit = Math.min(Math.max(spec.limit ?? 20, 1), 50);
    const offset = Math.max(spec.offset ?? 0, 0);
    const sampleRows = filtered.slice(offset, offset + limit);

    return {
      datasetId: spec.datasetId,
      entity: spec.entity,
      where: spec.where,
      matchedCount: filtered.length,
      returnedCount: sampleRows.length,
      sampleRows,
      pseudoSql: buildPseudoSql(spec),
    };
  }
}
