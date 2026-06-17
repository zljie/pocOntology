import { NextRequest, NextResponse } from "next/server";
import { validateAndParseOsiFiles } from "@/lib/osi/osi-validate";
import { osiToMetaCore } from "@/lib/osi/osi-to-metacore";
import { OSI_SAMPLES, OsiSampleId } from "@/lib/osi/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sampleId = String(body?.sampleId || "").trim() as OsiSampleId;
  const sample = OSI_SAMPLES[sampleId];
  if (!sample) {
    return NextResponse.json({ error: "sampleId 不合法" }, { status: 400 });
  }

  const yamlText = sample.yamlText;
  if (!yamlText || !yamlText.trim()) {
    return NextResponse.json({ error: "样例文件为空或不存在" }, { status: 500 });
  }

  const parsed = await validateAndParseOsiFiles([{ name: sample.fileName, yamlText }]);
  if (!parsed.ok) {
    return NextResponse.json({ error: "OSI 校验失败", errors: parsed.errors }, { status: 400 });
  }

  const converted = osiToMetaCore(parsed.parsedDocs);
  if (!converted.ok) {
    return NextResponse.json({ error: "OSI 转换失败", errors: converted.errors }, { status: 400 });
  }

  const report = {
    parsedCount: parsed.parsedDocs.length,
    semanticModelCount: parsed.parsedDocs.reduce((n, x) => n + (x.doc.semantic_model?.length || 0), 0),
    datasetCount: converted.meta.objectTypes.length,
    relationshipCount: converted.meta.linkTypes.length,
    fieldCount: converted.meta.objectTypes.reduce((n, ot) => n + (ot.properties?.length || 0), 0),
    actionTypeCount: converted.meta.actionTypes.length,
    businessRuleCount: converted.meta.businessRules.length,
    analysisInsightCount: converted.meta.analysisInsights.length,
  };

  return NextResponse.json({ success: true, meta: converted.meta, report });
}
