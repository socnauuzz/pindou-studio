import { NextResponse } from "next/server";
import { ensureSchema, getSessionStatus, runtimeEnv } from "@/app/api/key-store";

export async function POST(request: Request) {
  const { DB } = runtimeEnv();
  if (!DB) return NextResponse.json({ error: "卡密服务尚未启用" }, { status: 503 });
  await ensureSchema(DB);
  const current = await getSessionStatus(DB, request);
  if (!current.active) return NextResponse.json({ error: "请先兑换有效卡密" }, { status: 401 });
  const now = new Date().toISOString();
  const update = await DB.prepare(`UPDATE access_keys SET used_count = used_count + 1
    WHERE id = ? AND status = 'active' AND used_count < usage_limit AND (expires_at IS NULL OR expires_at > ?)`)
    .bind(current.keyId, now).run();
  if (!update.meta.changes) return NextResponse.json({ error: "卡密额度不足或已过期" }, { status: 409 });
  await DB.prepare("INSERT INTO key_events (id, key_id, event_type, created_at) VALUES (?, ?, 'exported', ?)").bind(crypto.randomUUID(), current.keyId, now).run();
  const remaining = Math.max(0, current.remaining - 1);
  const publicStatus = { active: true, codePrefix: current.codePrefix, plan: current.plan, remaining, expiresAt: current.expiresAt };
  return NextResponse.json({ status: remaining > 0 ? publicStatus : { active: false } });
}
