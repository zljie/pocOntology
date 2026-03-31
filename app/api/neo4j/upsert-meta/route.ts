import { NextRequest, NextResponse } from "next/server";
import { MetaCore } from "@/lib/meta/meta-core";
import { upsertMetaToNeo4j } from "@/lib/neo4j/meta-writer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const meta = body?.meta as MetaCore | undefined;
  const scenario =
    body?.scenario?.toString?.().trim?.() || (meta as any)?.scenario?.toString?.().trim?.() || "custom";
  const reset = Boolean(body?.reset);
  const database = body?.database?.toString?.().trim?.() || undefined;

  if (!meta || typeof meta !== "object") {
    return NextResponse.json({ error: "meta 不能为空" }, { status: 400 });
  }

  const result = await upsertMetaToNeo4j({
    meta,
    scenario,
    reset,
    database,
  });

  return NextResponse.json({ success: true, result });
}
