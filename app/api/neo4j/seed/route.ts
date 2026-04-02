import { NextRequest, NextResponse } from "next/server";
import { upsertMetaToNeo4j } from "@/lib/neo4j/meta-writer";
import {
  SAMPLE_ACTION_TYPES,
  SAMPLE_AI_MODELS,
  SAMPLE_ANALYSIS_INSIGHTS,
  SAMPLE_BUSINESS_RULES,
  SAMPLE_DATA_FLOWS,
  SAMPLE_LINK_TYPES,
  SAMPLE_OBJECT_TYPES,
} from "@/lib/types/ontology";
import {
  ERP_ACTION_TYPES,
  ERP_AI_MODELS,
  ERP_ANALYSIS_INSIGHTS,
  ERP_BUSINESS_RULES,
  ERP_DATA_FLOWS,
  ERP_LINK_TYPES,
  ERP_OBJECT_TYPES,
} from "@/lib/types/ontology-erp-sample";
import {
  SAP_HCM_ACTION_TYPES,
  SAP_HCM_AI_MODELS,
  SAP_HCM_ANALYSIS_INSIGHTS,
  SAP_HCM_BUSINESS_RULES,
  SAP_HCM_DATA_FLOWS,
  SAP_HCM_LINK_TYPES,
  SAP_HCM_OBJECT_TYPES,
} from "@/lib/types/ontology-sap-hcm-sample";
import { MetaCore, MetaScenario } from "@/lib/meta/meta-core";

export const runtime = "nodejs";

function buildMeta(scenario: MetaScenario): MetaCore {
  if (scenario === "erp") {
    return {
      scenario,
      objectTypes: ERP_OBJECT_TYPES,
      linkTypes: ERP_LINK_TYPES,
      actionTypes: ERP_ACTION_TYPES,
      dataFlows: ERP_DATA_FLOWS,
      businessRules: ERP_BUSINESS_RULES,
      aiModels: ERP_AI_MODELS,
      analysisInsights: ERP_ANALYSIS_INSIGHTS,
    };
  }
  if (scenario === "sap_hcm") {
    return {
      scenario,
      objectTypes: SAP_HCM_OBJECT_TYPES,
      linkTypes: SAP_HCM_LINK_TYPES,
      actionTypes: SAP_HCM_ACTION_TYPES,
      dataFlows: SAP_HCM_DATA_FLOWS,
      businessRules: SAP_HCM_BUSINESS_RULES,
      aiModels: SAP_HCM_AI_MODELS,
      analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
    };
  }

  return {
    scenario: "library",
    objectTypes: SAMPLE_OBJECT_TYPES,
    linkTypes: SAMPLE_LINK_TYPES,
    actionTypes: SAMPLE_ACTION_TYPES,
    dataFlows: SAMPLE_DATA_FLOWS,
    businessRules: SAMPLE_BUSINESS_RULES,
    aiModels: SAMPLE_AI_MODELS,
    analysisInsights: SAMPLE_ANALYSIS_INSIGHTS,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const scenarioRaw = body?.scenario?.toString?.().trim?.();
  const scenario: MetaScenario = scenarioRaw === "erp" ? "erp" : scenarioRaw === "sap_hcm" ? "sap_hcm" : "library";
  const reset = Boolean(body?.reset);

  const meta = buildMeta(scenario);
  const result = await upsertMetaToNeo4j({
    meta,
    scenario,
    reset,
  });

  return NextResponse.json({ success: true, result });
}
