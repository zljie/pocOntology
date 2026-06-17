import { NextRequest } from "next/server";
import { getDatasetProvider } from "@/lib/datasets";
import { QuerySpec } from "@/lib/datasets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeSpec(body: any): QuerySpec {
  const datasetId = String(body?.datasetId || "").trim();
  const entity = String(body?.entity || "").trim();
  const limitRaw = Number(body?.limit);
  const offsetRaw = Number(body?.offset);

  if (!datasetId) throw new Error("datasetId 不能为空");
  if (!entity) throw new Error("entity 不能为空");

  const spec: QuerySpec = {
    datasetId,
    entity,
    where: body?.where,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    offset: Number.isFinite(offsetRaw) ? offsetRaw : undefined,
  };
  return spec;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const spec = normalizeSpec(body);
    const provider = getDatasetProvider();
    const evidence = await provider.query(spec);
    return Response.json({ evidence });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "query 失败" },
      { status: 400 }
    );
  }
}

