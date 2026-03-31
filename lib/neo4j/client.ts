import type { MetaCore } from "@/lib/meta/meta-core";

export async function createNeo4jDatabaseClient(dbName: string) {
  const res = await fetch("/api/neo4j/create-database", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dbName }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.toString?.() || "创建 Neo4j 数据库失败");
  }
  return data as { success: true; dbName: string };
}

export async function upsertMetaToNeo4jClient(params: {
  database: string;
  scenario: string;
  meta: MetaCore;
  reset?: boolean;
}) {
  const res = await fetch("/api/neo4j/upsert-meta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      database: params.database,
      scenario: params.scenario,
      reset: Boolean(params.reset),
      meta: params.meta,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.toString?.() || "写入 Neo4j 失败");
  }
  return data as { success: true; result: unknown };
}

