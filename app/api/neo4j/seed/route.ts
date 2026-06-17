import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  void req;
  return NextResponse.json(
    {
      success: false,
      error: "Seed endpoint has been disabled. Please import OSI YAML via /api/osi/import or /api/osi/import-sample.",
    },
    { status: 410 }
  );
}
