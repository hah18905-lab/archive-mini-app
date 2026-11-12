// ARCHIVE 9.1: verified Telegram Mini App identity -> private Supabase storage.
// Runtime: Supabase Edge Functions (Deno). Deploy with verify_jwt=false.
// This is NOT unauthenticated: every request checks the Telegram HMAC signature.
const ROOT = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const ORIGIN = "https://hah18905-lab.github.io";
const MAX_INITDATA_AGE = 24 * 60 * 60;
const encoder = new TextEncoder();
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "3600",
  "Vary": "Origin",
};
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data)));
}
function hexBytes(hex: string): Uint8Array {
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) throw Error("Invalid hash");
  return Uint8Array.from(hex.match(/../g)!.map(p => parseInt(p, 16)));
}
function safeMatch(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}
async function verifyTelegram(raw: unknown): Promise<number> {
  if (typeof raw !== "string" || raw.length < 30 || raw.length > 8192) throw Error("Missing Telegram initData");
  const params = new URLSearchParams(raw);
  const seen = new Set<string>();
  for (const [key] of params) {
    if (seen.has(key)) throw Error("Duplicate Telegram field");
    seen.add(key);
  }
  const hash = hexBytes(params.get("hash") || "");
  const age = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(age) || age > now + 60 || age < now - MAX_INITDATA_AGE)
    throw Error("Expired Telegram authorization; reopen the Mini App");
  const checkString = [...params.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([key, value]) => key + "=" + value).join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), BOT_TOKEN);
  const expected = await hmac(secret, checkString);
  if (!safeMatch(hash, expected)) throw Error("Invalid Telegram signature");
  const userRaw = params.get("user");
  if (!userRaw) throw Error("No Telegram user supplied");
  const user = JSON.parse(userRaw);
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) throw Error("Invalid Telegram user");
  return user.id;
}
async function db(path: string, method: string, data?: unknown): Promise<unknown> {
  const url = ROOT.replace(/\/$/, "") + "/rest/v1/" + path;
  const headers: Record<string,string> = {
    "apikey": SERVICE_KEY,
    "Authorization": "Bearer " + SERVICE_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (method === "POST") headers["Prefer"] = path.startsWith("archive_users?")
    ? "resolution=merge-duplicates,return=minimal" : "return=representation";
  const response = await fetch(url, {
    method, headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) {
    console.error("Database request failed:", response.status, path.split("?")[0]);
    throw Error("Database temporarily unavailable");
  }
  if (response.status === 204) return null;
  const content = await response.text();
  return content ? JSON.parse(content) : null;
}
Deno.serve(async (req) => {
  if (req.headers.get("origin") && req.headers.get("origin") !== ORIGIN)
    return reply(403, { error: "Origin not allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST only" });
  if (!ROOT || !SERVICE_KEY || !BOT_TOKEN)
    return reply(503, { error: "Cloud backend is not configured" });
  try {
    if (Number(req.headers.get("content-length") || "0") > 24000)
      return reply(413, { error: "Payload too large" });
    const body = await req.json();
    if (!body || typeof body !== "object" || JSON.stringify(body).length > 24000)
      return reply(400, { error: "Invalid request" });
    let telegramId: number;
    try { telegramId = await verifyTelegram(body.initData); }
    catch (err) { return reply(401, { error: err instanceof Error ? err.message : "Not authorized" }); }
    if (body.action === "bootstrap") {
      await db("archive_users?on_conflict=telegram_id", "POST", {
        telegram_id: telegramId,
        last_seen_at: new Date().toISOString(),
      });
      const rows = await db(
        "archive_story_state?telegram_id=eq." + telegramId +
        "&select=story_id,rating,bookmarked,progress_pct,updated_at&order=updated_at.desc&limit=1000",
        "GET",
      );
      return reply(200, { ok: true, telegram_id: telegramId, states: rows });
    }
    if (!["rate","bookmark","progress"].includes(body.action)) return reply(400, { error: "Unknown action" });
    if (!Number.isSafeInteger(body.storyId) || body.storyId < 1 || body.storyId > 1000000 ||
        !Number.isSafeInteger(body.value)) return reply(400, { error: "Invalid story or value" });
    const allowed = body.action === "rate" ? [-1,0,1]
      : body.action === "bookmark" ? [0,1] : null;
    if (allowed ? !allowed.includes(body.value) : (body.value < 0 || body.value > 100))
      return reply(400, { error: "Invalid value" });
    const state = await db("rpc/archive_write_state", "POST", {
      p_telegram_id: telegramId,
      p_story_id: body.storyId,
      p_action: body.action,
      p_value: body.value,
    });
    return reply(200, { ok: true, state });
  } catch (error) {
    console.error("Archive cloud function:", error instanceof Error ? error.message : error);
    return reply(500, { error: "Cloud backend failed" });
  }
});
