// ARHIV 9.1 · Cloudflare Worker + D1
// Auth: every POST must contain signed Telegram.WebApp.initData.
// Never expose BOT_TOKEN in GitHub Pages, browser JavaScript, or public wrangler config.
const ORIGIN = "https://hah18905-lab.github.io";
const MAX_AGE_SEC = 24 * 60 * 60;
const encoder = new TextEncoder();
const cors = Object.freeze({
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Vary": "Origin",
});
const respond = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store" },
});
async function mac(key, bytes) {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(bytes)));
}
function hexToBytes(hash) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error("Wrong Telegram hash format");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Number.parseInt(hash.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
function constantEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function userIdFromTelegram(initData, botToken) {
  if (typeof initData !== "string" || initData.length < 35 || initData.length > 8192)
    throw new Error("Open this app through Telegram");
  const params = new URLSearchParams(initData);
  const unique = new Set();
  for (const [key] of params) {
    if (unique.has(key)) throw new Error("Duplicate Telegram field");
    unique.add(key);
  }
  const hash = hexToBytes(params.get("hash") || "");
  const authDate = Number(params.get("auth_date"));
  const current = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate > current + 60 || current - authDate > MAX_AGE_SEC)
    throw new Error("Telegram session expired — reopen Mini App");
  const checkString = Array.from(params)
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key,value]) => key + "=" + value).join("\n");
  const secret = await mac(encoder.encode("WebAppData"), botToken);
  const expected = await mac(secret, checkString);
  if (!constantEqual(hash, expected)) throw new Error("Invalid Telegram signature");
  const rawUser = params.get("user");
  if (!rawUser) throw new Error("User field missing");
  const user = JSON.parse(rawUser);
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) throw new Error("Invalid Telegram user");
  return user.id;
}
async function bootstrap(env, telegramId) {
  await env.DB.prepare(
    "INSERT INTO archive_users(telegram_id) VALUES(?) ON CONFLICT(telegram_id) DO UPDATE SET last_seen_at=unixepoch()"
  ).bind(telegramId).run();
  const {results} = await env.DB.prepare(
    "SELECT story_id, rating, bookmarked, progress_pct, updated_at FROM archive_story_state WHERE telegram_id=? ORDER BY updated_at DESC LIMIT 1000"
  ).bind(telegramId).all();
  return {ok:true,telegram_id:telegramId,states:results||[]};
}
async function updateState(env,telegramId,storyId,action,value) {
  await env.DB.prepare(
    "INSERT INTO archive_users(telegram_id) VALUES(?) ON CONFLICT(telegram_id) DO UPDATE SET last_seen_at=unixepoch()"
  ).bind(telegramId).run();
  if (action === "rate") {
    await env.DB.prepare(
      "INSERT INTO archive_story_state(telegram_id,story_id,rating) VALUES(?,?,?) "+
      "ON CONFLICT(telegram_id,story_id) DO UPDATE SET rating=excluded.rating,updated_at=unixepoch()"
    ).bind(telegramId,storyId,value).run();
  } else if (action === "bookmark") {
    await env.DB.prepare(
      "INSERT INTO archive_story_state(telegram_id,story_id,bookmarked) VALUES(?,?,?) "+
      "ON CONFLICT(telegram_id,story_id) DO UPDATE SET bookmarked=excluded.bookmarked,updated_at=unixepoch()"
    ).bind(telegramId,storyId,value).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO archive_story_state(telegram_id,story_id,progress_pct,last_read_at) VALUES(?,?,?,unixepoch()) "+
      "ON CONFLICT(telegram_id,story_id) DO UPDATE SET progress_pct=max(progress_pct,excluded.progress_pct),"+
      "last_read_at=unixepoch(),updated_at=unixepoch()"
    ).bind(telegramId,storyId,value).run();
  }
  return {ok:true};
}
export default {
  async fetch(request, env) {
    if (request.headers.get("Origin") &&
        request.headers.get("Origin") !== ORIGIN)
      return respond(403, {error:"Origin not allowed"});
    if (request.method === "OPTIONS") return new Response(null, {status:204,headers:cors});
    if (request.method !== "POST") return respond(405, {error:"POST required"});
    if (!env.DB || !env.BOT_TOKEN) return respond(503,{error:"Database or Telegram secret not configured"});
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 24000) return respond(413,{error:"Request too large"});
    try {
      const raw = await request.text();
      if (raw.length > 24000) return respond(413,{error:"Request too large"});
      const body = JSON.parse(raw);
      if (!body || typeof body !== "object") return respond(400,{error:"Bad JSON payload"});
      let telegramId;
      try {
        telegramId = await userIdFromTelegram(body.initData,env.BOT_TOKEN);
      } catch(e) {
        return respond(401,{error:e?.message||"Telegram authorization failed"});
      }
      if (body.action === "bootstrap") return respond(200,await bootstrap(env,telegramId));
      if (!["rate","bookmark","progress"].includes(body.action))
        return respond(400,{error:"Unknown action"});
      const storyId=body.storyId, value=body.value;
      if (!Number.isSafeInteger(storyId) || storyId<1 || storyId>1000000 ||
          !Number.isSafeInteger(value)) return respond(400,{error:"Invalid ID or value"});
      if (body.action==="rate" && ![-1,0,1].includes(value))
        return respond(400,{error:"Invalid rating"});
      if (body.action==="bookmark" && ![0,1].includes(value))
        return respond(400,{error:"Invalid bookmark"});
      if (body.action==="progress" && (value<0 || value>100))
        return respond(400,{error:"Invalid progress"});
      return respond(200,await updateState(env,telegramId,storyId,body.action,value));
    } catch(e) {
      console.error("ARHIV storage error:",e?.message||e);
      return respond(500,{error:"Cloud storage is currently unavailable"});
    }
  }
};
