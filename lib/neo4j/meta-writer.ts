import "server-only";
import neo4j, { ManagedTransaction, QueryResult } from "neo4j-driver";
import { MetaCore } from "@/lib/meta/meta-core";
import { getNeo4jDatabase, getNeo4jDriver } from "@/lib/neo4j/driver";

export type Neo4jWriteSummary = {
  nodesCreated: number;
  nodesDeleted: number;
  relationshipsCreated: number;
  relationshipsDeleted: number;
  propertiesSet: number;
};

export type Neo4jUpsertMetaResult = {
  scenario: string;
  database?: string;
  reset: boolean;
  summary: Neo4jWriteSummary;
  stats: Record<string, number>;
};

function counterFromResult(result: QueryResult): Neo4jWriteSummary {
  const c = result.summary.counters.updates();
  return {
    nodesCreated: c.nodesCreated,
    nodesDeleted: c.nodesDeleted,
    relationshipsCreated: c.relationshipsCreated,
    relationshipsDeleted: c.relationshipsDeleted,
    propertiesSet: c.propertiesSet,
  };
}

function mergeSummary(a: Neo4jWriteSummary, b: Neo4jWriteSummary): Neo4jWriteSummary {
  return {
    nodesCreated: a.nodesCreated + b.nodesCreated,
    nodesDeleted: a.nodesDeleted + b.nodesDeleted,
    relationshipsCreated: a.relationshipsCreated + b.relationshipsCreated,
    relationshipsDeleted: a.relationshipsDeleted + b.relationshipsDeleted,
    propertiesSet: a.propertiesSet + b.propertiesSet,
  };
}

function pk(...parts: string[]) {
  return parts.map((p) => String(p)).join(":");
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

const constraintsEnsuredByDb = new Map<string, Promise<void>>();

async function ensureConstraints(tx: ManagedTransaction) {
  await tx.run(
    "CREATE CONSTRAINT ontology_pk IF NOT EXISTS FOR (n:Ontology) REQUIRE n.pk IS UNIQUE"
  );
  await tx.run(
    "CREATE CONSTRAINT objecttype_pk IF NOT EXISTS FOR (n:ObjectType) REQUIRE n.pk IS UNIQUE"
  );
  await tx.run(
    "CREATE INDEX objecttype_propertyApiNames IF NOT EXISTS FOR (n:ObjectType) ON (n.propertyApiNames)"
  );
  await tx.run(
    "CREATE CONSTRAINT actiontype_pk IF NOT EXISTS FOR (n:ActionType) REQUIRE n.pk IS UNIQUE"
  );
  await tx.run(
    "CREATE CONSTRAINT dataflow_pk IF NOT EXISTS FOR (n:DataFlow) REQUIRE n.pk IS UNIQUE"
  );
  await tx.run(
    "CREATE CONSTRAINT businessrule_pk IF NOT EXISTS FOR (n:BusinessRule) REQUIRE n.pk IS UNIQUE"
  );
  await tx.run(
    "CREATE CONSTRAINT aimodel_pk IF NOT EXISTS FOR (n:AIModel) REQUIRE n.pk IS UNIQUE"
  );
  await tx.run(
    "CREATE CONSTRAINT analysisinsight_pk IF NOT EXISTS FOR (n:AnalysisInsight) REQUIRE n.pk IS UNIQUE"
  );
}

async function ensureConstraintsOnce(database: string | undefined) {
  const key = database || "__default__";
  const existing = constraintsEnsuredByDb.get(key);
  if (existing) return existing;

  const driver = getNeo4jDriver();
  const promise = (async () => {
    const session = driver.session({ database, defaultAccessMode: neo4j.session.WRITE });
    try {
      await session.executeWrite(async (tx) => {
        await ensureConstraints(tx);
      });
    } finally {
      await session.close();
    }
  })();

  constraintsEnsuredByDb.set(key, promise);
  return promise;
}

async function getScenarioStats(
  scenario: string,
  database: string | undefined
): Promise<Record<string, number>> {
  const driver = getNeo4jDriver();
  const session = driver.session({ database, defaultAccessMode: neo4j.session.READ });
  try {
    const res = await session.run(
      `
MATCH (n {scenario: $scenario})
UNWIND labels(n) AS label
RETURN label, count(*) AS cnt
ORDER BY label
`,
      { scenario }
    );
    const out: Record<string, number> = {};
    for (const row of res.records) {
      out[String(row.get("label"))] = Number(row.get("cnt"));
    }
    return out;
  } finally {
    await session.close();
  }
}

export async function upsertMetaToNeo4j(params: {
  meta: MetaCore;
  scenario: string;
  reset?: boolean;
  database?: string;
}): Promise<Neo4jUpsertMetaResult> {
  const scenario = params.scenario.trim() || "custom";
  const reset = Boolean(params.reset);
  const database = params.database ?? getNeo4jDatabase();

  const driver = getNeo4jDriver();
  await ensureConstraintsOnce(database);
  const session = driver.session({ database, defaultAccessMode: neo4j.session.WRITE });

  const objectTypes = params.meta.objectTypes ?? [];
  const linkTypes = params.meta.linkTypes ?? [];
  const actionTypes = params.meta.actionTypes ?? [];
  const dataFlows = params.meta.dataFlows ?? [];
  const businessRules = params.meta.businessRules ?? [];
  const aiModels = params.meta.aiModels ?? [];
  const analysisInsights = params.meta.analysisInsights ?? [];

  const now = new Date().toISOString();

  const objectTypeRows = objectTypes.map((it) => ({
    pk: pk(scenario, it.id),
    id: it.id,
    apiName: it.apiName,
    displayName: it.displayName,
    propertyApiNames: (it.properties ?? []).map((p) => p.apiName),
    propertyCount: (it.properties ?? []).length,
    propertiesRaw: json(it.properties ?? []),
    raw: json(it),
  }));

  const linkTypeRows = linkTypes.map((it) => ({
    pk: pk(scenario, it.id),
    id: it.id,
    apiName: it.apiName,
    displayName: it.displayName,
    sourcePk: pk(scenario, it.sourceTypeId),
    targetPk: pk(scenario, it.targetTypeId),
    cardinality: String((it as any)?.cardinality ?? ""),
    relationshipType: String((it as any)?.relationshipType ?? ""),
    raw: json(it),
  }));

  const metaNodeRows = {
    actionTypes: actionTypes.map((it) => ({
      pk: pk(scenario, it.id),
      id: it.id,
      apiName: it.apiName,
      displayName: it.displayName,
      raw: json(it),
    })),
    dataFlows: dataFlows.map((it) => ({
      pk: pk(scenario, it.id),
      id: it.id,
      apiName: it.apiName,
      displayName: it.displayName,
      raw: json(it),
    })),
    businessRules: businessRules.map((it) => ({
      pk: pk(scenario, it.id),
      id: it.id,
      apiName: it.apiName,
      displayName: it.displayName,
      raw: json(it),
    })),
    aiModels: aiModels.map((it) => ({
      pk: pk(scenario, it.id),
      id: it.id,
      apiName: it.apiName,
      displayName: it.displayName,
      raw: json(it),
    })),
    analysisInsights: analysisInsights.map((it) => ({
      pk: pk(scenario, it.id),
      id: it.id,
      apiName: it.apiName,
      displayName: it.displayName,
      raw: json(it),
    })),
  };

  try {
    const summary = await session.executeWrite(async (tx) => {
      let acc: Neo4jWriteSummary = {
        nodesCreated: 0,
        nodesDeleted: 0,
        relationshipsCreated: 0,
        relationshipsDeleted: 0,
        propertiesSet: 0,
      };

      if (reset) {
        const res = await tx.run("MATCH (n {scenario: $scenario}) DETACH DELETE n", { scenario });
        acc = mergeSummary(acc, counterFromResult(res));
      }

      {
        const res = await tx.run(
          `
MERGE (o:Ontology {pk: $scenario})
ON CREATE SET o.createdAt = $now
SET o.scenario = $scenario,
    o.updatedAt = $now
`,
          { scenario, now }
        );
        acc = mergeSummary(acc, counterFromResult(res));
      }

      if (objectTypeRows.length) {
        const res = await tx.run(
          `
UNWIND $rows AS row
MERGE (n:ObjectType {pk: row.pk})
ON CREATE SET n.createdAt = $now
SET n.scenario = $scenario,
    n.id = row.id,
    n.apiName = row.apiName,
    n.displayName = row.displayName,
    n.propertyApiNames = row.propertyApiNames,
    n.propertyCount = row.propertyCount,
    n.propertiesRaw = row.propertiesRaw,
    n.raw = row.raw,
    n.updatedAt = $now
WITH n
MATCH (o:Ontology {pk: $scenario})
MERGE (o)-[:HAS_OBJECT_TYPE]->(n)
`,
          { rows: objectTypeRows, scenario, now }
        );
        acc = mergeSummary(acc, counterFromResult(res));
      }

      if (linkTypeRows.length) {
        const res = await tx.run(
          `
UNWIND $rows AS row
MATCH (s:ObjectType {pk: row.sourcePk})
MATCH (t:ObjectType {pk: row.targetPk})
MERGE (s)-[r:LINK {pk: row.pk}]->(t)
ON CREATE SET r.createdAt = $now
SET r.scenario = $scenario,
    r.id = row.id,
    r.apiName = row.apiName,
    r.displayName = row.displayName,
    r.cardinality = row.cardinality,
    r.relationshipType = row.relationshipType,
    r.raw = row.raw,
    r.updatedAt = $now
`,
          { rows: linkTypeRows, scenario, now }
        );
        acc = mergeSummary(acc, counterFromResult(res));
      }

      const upsertGeneric = async (label: string, rel: string, rows: any[]) => {
        if (!rows.length) return;
        const res = await tx.run(
          `
UNWIND $rows AS row
MERGE (n:${label} {pk: row.pk})
ON CREATE SET n.createdAt = $now
SET n.scenario = $scenario,
    n.id = row.id,
    n.apiName = row.apiName,
    n.displayName = row.displayName,
    n.raw = row.raw,
    n.updatedAt = $now
WITH n
MATCH (o:Ontology {pk: $scenario})
MERGE (o)-[:${rel}]->(n)
`,
          { rows, scenario, now }
        );
        acc = mergeSummary(acc, counterFromResult(res));
      };

      await upsertGeneric("ActionType", "HAS_ACTION_TYPE", metaNodeRows.actionTypes);
      await upsertGeneric("DataFlow", "HAS_DATA_FLOW", metaNodeRows.dataFlows);
      await upsertGeneric("BusinessRule", "HAS_BUSINESS_RULE", metaNodeRows.businessRules);
      await upsertGeneric("AIModel", "HAS_AI_MODEL", metaNodeRows.aiModels);
      await upsertGeneric("AnalysisInsight", "HAS_ANALYSIS_INSIGHT", metaNodeRows.analysisInsights);

      return acc;
    });

    const stats = await getScenarioStats(scenario, database);
    return { scenario, database, reset, summary, stats };
  } finally {
    await session.close();
  }
}
