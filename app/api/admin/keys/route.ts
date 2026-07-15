import { NextResponse } from "next/server";
import { ensureSchema, generateAccessCode, normalizeCode, runtimeEnv, safeEqual, sha256 } from "@/app/api/key-store";

async function authorize(request: Request) {
  const supplied = request.headers.get("x-admin-secret") || "";
  const configured = runtimeEnv().ADMIN_SECRET || "";
  return configured.length >= 10 && safeEqual(supplied, configured);
}

export async function GET(request: Request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "管理密码不正确，或尚未配置" }, { status: 401 });
  const { DB } = runtimeEnv();
  if (!DB) return NextResponse.json({ error: "数据库尚未启用" }, { status: 503 });
  await ensureSchema(DB);
  const result = await DB.prepare(`SELECT id, code_prefix, plan, usage_limit, used_count, expires_at, status, note, created_at
    FROM access_keys ORDER BY created_at DESC LIMIT 200`).all();
  return NextResponse.json({ keys: result.results });
}

export async function POST(request: Request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "管理密码不正确，或尚未配置" }, { status: 401 });
  const { DB } = runtimeEnv();
  if (!DB) return NextResponse.json({ error: "数据库尚未启用" }, { status: 503 });
  await ensureSchema(DB);
  const body = await request.json().catch(() => ({})) as { count?: number; plan?: string; usageLimit?: number; validDays?: number; note?: string };
  const count = Math.max(1, Math.min(100, Math.floor(body.count || 1)));
  const usageLimit = Math.max(1, Math.min(10000, Math.floor(body.usageLimit || 10)));
  const validDays = Math.max(1, Math.min(3650, Math.floor(body.validDays || 365)));
  const plan = (body.plan || "体验卡").slice(0, 24);
  const note = (body.note || "").slice(0, 100);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validDays * 86400000).toISOString();
  const plainCodes: string[] = [];
  const statements: D1PreparedStatement[] = [];
  for (let index = 0; index < count; index++) {
    const code = generateAccessCode();
    plainCodes.push(code);
    statements.push(DB.prepare(`INSERT INTO access_keys
      (id, code_hash, code_prefix, plan, usage_limit, used_count, expires_at, status, note, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, 'active', ?, ?)`)
      .bind(crypto.randomUUID(), await sha256(normalizeCode(code)), code.slice(0, 7) + "••••••••", plan, usageLimit, expiresAt, note, now.toISOString()));
  }
  await DB.batch(statements);
  return NextResponse.json({ codes: plainCodes, plan, usageLimit, expiresAt });
}

export async function PATCH(request: Request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "管理密码不正确，或尚未配置" }, { status: 401 });
  const { DB } = runtimeEnv();
  if (!DB) return NextResponse.json({ error: "数据库尚未启用" }, { status: 503 });
  await ensureSchema(DB);
  const body = await request.json().catch(() => ({})) as { id?: string; status?: string };
  if (!body.id || !["active", "disabled"].includes(body.status || "")) return NextResponse.json({ error: "参数无效" }, { status: 400 });
  await DB.prepare("UPDATE access_keys SET status = ? WHERE id = ?").bind(body.status, body.id).run();
  return NextResponse.json({ ok: true });
}
