import { NextResponse } from "next/server";
import { ensureSchema, normalizeCode, randomToken, runtimeEnv, SESSION_COOKIE, sha256 } from "@/app/api/key-store";

export async function POST(request: Request) {
  const { DB } = runtimeEnv();
  if (!DB) return NextResponse.json({ error: "卡密服务尚未启用" }, { status: 503 });
  await ensureSchema(DB);
  const body = await request.json().catch(() => ({})) as { code?: string };
  const normalized = normalizeCode(body.code || "");
  if (normalized.length < 10) return NextResponse.json({ error: "请输入完整卡密" }, { status: 400 });
  const codeHash = await sha256(normalized);
  const now = new Date();
  const key = await DB.prepare(`SELECT id, code_prefix, plan, usage_limit, used_count, expires_at, status FROM access_keys WHERE code_hash = ? LIMIT 1`)
    .bind(codeHash).first<{ id: string; code_prefix: string; plan: string; usage_limit: number; used_count: number; expires_at: string | null; status: string }>();
  if (!key || key.status !== "active") return NextResponse.json({ error: "卡密不存在或已停用" }, { status: 404 });
  if (key.used_count >= key.usage_limit) return NextResponse.json({ error: "这张卡密的次数已经用完" }, { status: 409 });
  if (key.expires_at && key.expires_at <= now.toISOString()) return NextResponse.json({ error: "这张卡密已过期" }, { status: 410 });
  const token = randomToken();
  const sessionExpiry = new Date(Math.min(now.getTime() + 180 * 86400000, key.expires_at ? new Date(key.expires_at).getTime() : Infinity));
  await DB.batch([
    DB.prepare("INSERT INTO key_sessions (id, key_id, token_hash, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), key.id, await sha256(token), sessionExpiry.toISOString(), now.toISOString(), now.toISOString()),
    DB.prepare("INSERT INTO key_events (id, key_id, event_type, created_at) VALUES (?, ?, 'redeemed', ?)").bind(crypto.randomUUID(), key.id, now.toISOString()),
  ]);
  const response = NextResponse.json({ status: { active: true, codePrefix: key.code_prefix, plan: key.plan, remaining: key.usage_limit - key.used_count, expiresAt: key.expires_at } });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", expires: sessionExpiry });
  return response;
}
