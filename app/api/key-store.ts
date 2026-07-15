export const SESSION_COOKIE = "pindou_session";

type RuntimeEnv = { DB?: D1Database; ADMIN_SECRET?: string };

export function runtimeEnv() {
  return (globalThis as typeof globalThis & { __PINDOU_ENV__?: RuntimeEnv }).__PINDOU_ENV__ || {};
}

export async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS access_keys (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL UNIQUE,
      code_prefix TEXT NOT NULL,
      plan TEXT NOT NULL,
      usage_limit INTEGER NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS access_keys_created_idx ON access_keys(created_at DESC)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS key_sessions (
      id TEXT PRIMARY KEY,
      key_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS key_sessions_token_idx ON key_sessions(token_hash)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS key_events (
      id TEXT PRIMARY KEY,
      key_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS key_events_key_idx ON key_events(key_id, created_at DESC)"),
  ]);
}

export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 24) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const data = crypto.getRandomValues(new Uint8Array(12));
  const raw = [...data].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `PD-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function getSessionStatus(db: D1Database, request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return { active: false as const };
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const row = await db.prepare(`SELECT k.id, k.code_prefix, k.plan, k.usage_limit, k.used_count, k.expires_at, k.status
    FROM key_sessions s JOIN access_keys k ON k.id = s.key_id
    WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`).bind(tokenHash, now).first<{
      id: string; code_prefix: string; plan: string; usage_limit: number; used_count: number; expires_at: string | null; status: string;
    }>();
  if (!row || row.status !== "active" || (row.expires_at && row.expires_at <= now) || row.used_count >= row.usage_limit) return { active: false as const };
  return { active: true as const, keyId: row.id, codePrefix: row.code_prefix, plan: row.plan, remaining: row.usage_limit - row.used_count, expiresAt: row.expires_at };
}

export function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index++) result |= a[index] ^ b[index];
  return result === 0;
}
