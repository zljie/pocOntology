import type { MetaCore } from "@/lib/meta/meta-core";
import type { OnboardingState } from "@/lib/types/project-onboarding";

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

export async function getProjectOnboardingStateClient(database: string) {
  const res = await fetch(`/api/neo4j/onboarding-state?database=${encodeURIComponent(database)}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.toString?.() || "读取 onboarding state 失败");
  }
  return data as { success: true; state: OnboardingState | null };
}

export async function saveProjectOnboardingStateClient(params: { database: string; state: OnboardingState }) {
  const res = await fetch("/api/neo4j/onboarding-state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.toString?.() || "写入 onboarding state 失败");
  }
  return data as { success: true };
}
