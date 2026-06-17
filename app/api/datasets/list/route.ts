import { NextRequest } from "next/server";
import { getDatasetProvider } from "@/lib/datasets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const provider = getDatasetProvider();
    const datasets = await provider.listDatasets();
    return Response.json({ datasets });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "list datasets 失败" },
      { status: 500 }
    );
  }
}

