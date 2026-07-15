import { NextResponse } from "next/server";
import { ensureSchema, getSessionStatus, runtimeEnv } from "@/app/api/key-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { DB } = runtimeEnv();
  if (!DB) return NextResponse.json({ active: false });
  await ensureSchema(DB);
  const status = await getSessionStatus(DB, request);
  if (!status.active) return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
  return NextResponse.json({ active: true, codePrefix: status.codePrefix, plan: status.plan, remaining: status.remaining, expiresAt: status.expiresAt }, { headers: { "cache-control": "no-store" } });
}
