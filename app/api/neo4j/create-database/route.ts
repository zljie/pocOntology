import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "@/lib/neo4j/driver";

export const runtime = "nodejs";

function isValidNeo4jDbName(name: string) {
  return /^[a-z][a-z0-9.-]{0,62}$/.test(name);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const dbName = body?.dbName?.toString?.().trim?.() || "";

  if (!dbName) {
    return NextResponse.json({ error: "dbName 不能为空" }, { status: 400 });
  }
  if (!isValidNeo4jDbName(dbName)) {
    return NextResponse.json(
      { error: "dbName 不符合要求：小写字母开头，仅小写字母/数字/点/短横线" },
      { status: 400 }
    );
  }

  const driver = getNeo4jDriver();
  const session = driver.session({ database: "system", defaultAccessMode: neo4j.session.WRITE });
  try {
    await session.run(`CREATE DATABASE \`${dbName}\` IF NOT EXISTS`);
    return NextResponse.json({ success: true, dbName });
  } catch (e: any) {
    const message = e?.message?.toString?.() || "创建数据库失败";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await session.close();
  }
}
