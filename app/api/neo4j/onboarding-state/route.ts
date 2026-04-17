import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "@/lib/neo4j/driver";

export const runtime = "nodejs";

function isValidNeo4jDbName(name: string) {
  return /^[a-z][a-z0-9.-]{0,62}$/.test(name);
}

async function readState(database: string) {
  const driver = getNeo4jDriver();
  const session = driver.session({ database, defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(
      `MATCH (o:ProjectOnboarding { id: $id }) RETURN o.stateJson as stateJson LIMIT 1`,
      { id: "onboarding" }
    );
    const record = result.records[0];
    const stateJson = record?.get?.("stateJson");
    if (!stateJson) return null;
    try {
      return JSON.parse(String(stateJson));
    } catch {
      return null;
    }
  } finally {
    await session.close();
  }
}

async function writeState(database: string, state: unknown) {
  const driver = getNeo4jDriver();
  const session = driver.session({ database, defaultAccessMode: neo4j.session.WRITE });
  try {
    const stateJson = JSON.stringify(state ?? null);
    const updatedAt = new Date().toISOString();
    await session.run(
      `MERGE (o:ProjectOnboarding { id: $id })
       SET o.stateJson = $stateJson, o.updatedAt = $updatedAt
       RETURN o.id as id`,
      { id: "onboarding", stateJson, updatedAt }
    );
  } finally {
    await session.close();
  }
}

export async function GET(req: NextRequest) {
  const database = req.nextUrl.searchParams.get("database")?.trim() || "";
  if (!database) return NextResponse.json({ error: "database 不能为空" }, { status: 400 });
  if (!isValidNeo4jDbName(database)) {
    return NextResponse.json({ error: "database 不符合要求" }, { status: 400 });
  }
  try {
    const state = await readState(database);
    return NextResponse.json({ success: true, state });
  } catch (e: any) {
    const message = e?.message?.toString?.() || "读取 onboarding state 失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const database = body?.database?.toString?.().trim?.() || "";
  const state = body?.state;

  if (!database) return NextResponse.json({ error: "database 不能为空" }, { status: 400 });
  if (!isValidNeo4jDbName(database)) {
    return NextResponse.json({ error: "database 不符合要求" }, { status: 400 });
  }
  try {
    await writeState(database, state);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const message = e?.message?.toString?.() || "写入 onboarding state 失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

