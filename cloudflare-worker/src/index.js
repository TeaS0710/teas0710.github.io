import { CV_CONTEXT, SYSTEM_PROMPT } from "./cv-context.js";

const DEFAULT_MODEL = "gemma3:27b";
const MAX_MESSAGE_LENGTH = 500;
const MAX_MESSAGES_PER_SESSION = 10;
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
// How many prior turns of context the client may replay for a natural conversation.
const MAX_HISTORY_TURNS = 8;
const TEMPERATURE = 0.7;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env),
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (url.pathname === "/health") {
      return jsonResponse(env, { ok: true, service: "cv-assistant-proxy" });
    }

    return jsonError(env, "Not found.", 404);
  },
};

async function handleChat(request, env) {
  const origin = request.headers.get("Origin") || "";
  const referer = request.headers.get("Referer") || "";
  const xAssistant = request.headers.get("X-CV-Assistant") || "";

  if (!isAllowedOrigin(origin, env)) {
    return jsonError(env, "Origin not allowed.", 403);
  }

  if (referer && !referer.startsWith(env.ALLOWED_ORIGIN)) {
    return jsonError(env, "Referer not allowed.", 403);
  }

  if (xAssistant !== "1") {
    return jsonError(env, "Rejected request.", 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(env, "Invalid JSON body.", 400);
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return jsonError(env, "Message is required.", 400);
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonError(env, "Message too long.", 400);
  }

  const history = sanitizeHistory(body?.history);

  const fingerprint = await buildFingerprint(request, env);
  const tokenResult = await validateOrCreateToken(body?.token, fingerprint, env);

  if (!tokenResult.ok) {
    return jsonError(env, tokenResult.error, tokenResult.status, {
      remaining: 0,
    });
  }

  if (tokenResult.session.count >= MAX_MESSAGES_PER_SESSION) {
    return jsonError(env, "Session message limit reached.", 429, {
      remaining: 0,
    });
  }

  const nextSession = {
    ...tokenResult.session,
    count: tokenResult.session.count + 1,
  };

  let reply;
  try {
    reply = await queryOllamaCloud(message, history, env);
  } catch (error) {
    return jsonError(env, "Assistant upstream is temporarily unavailable.", 502);
  }

  const token = await signSession(nextSession, env);

  return jsonResponse(env, {
    reply,
    token,
    used: nextSession.count,
    remaining: Math.max(0, MAX_MESSAGES_PER_SESSION - nextSession.count),
  });
}

async function queryOllamaCloud(message, history, env) {
  const baseUrl = (env.OLLAMA_BASE_URL || "https://ollama.com").replace(/\/$/, "");
  const model = env.OLLAMA_MODEL || DEFAULT_MODEL;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Adrien's CV context:\n${CV_CONTEXT}` },
    ...history,
    { role: "user", content: message },
  ];

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OLLAMA_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      options: {
        temperature: TEMPERATURE,
      },
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Upstream error ${response.status}`);
  }

  const data = await response.json();
  const text = data?.message?.content || data?.response || "";

  if (!text || typeof text !== "string") {
    throw new Error("Invalid upstream payload");
  }

  return text.trim();
}

// Trust nothing from the client: keep only well-formed user/assistant turns,
// drop system messages, clamp length and cap how far back we replay.
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];

  const cleaned = [];
  for (const entry of raw) {
    const role = entry?.role === "assistant" ? "assistant" : entry?.role === "user" ? "user" : null;
    const content = typeof entry?.content === "string" ? entry.content.trim() : "";
    if (!role || !content) continue;
    cleaned.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) });
  }

  // Keep the most recent turns only (a turn ~= one user + one assistant message).
  return cleaned.slice(-MAX_HISTORY_TURNS * 2);
}

async function validateOrCreateToken(rawToken, fingerprint, env) {
  if (!rawToken) {
    return {
      ok: true,
      session: {
        sid: crypto.randomUUID(),
        fp: fingerprint,
        count: 0,
        exp: Date.now() + SESSION_TTL_MS,
        v: 1,
      },
    };
  }

  const verified = await verifySession(rawToken, env);
  if (!verified.ok) {
    return { ok: false, status: 403, error: "Invalid session token." };
  }

  if (verified.session.exp < Date.now()) {
    return { ok: false, status: 403, error: "Session expired." };
  }

  if (verified.session.fp !== fingerprint) {
    return { ok: false, status: 403, error: "Session fingerprint mismatch." };
  }

  return { ok: true, session: verified.session };
}

async function buildFingerprint(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "unknown";
  const payload = `${ip}|${userAgent}|${env.SESSION_SECRET}`;
  const digest = await crypto.subtle.digest("SHA-256", textEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(digest)).slice(0, 32);
}

async function signSession(session, env) {
  const payload = base64UrlEncode(textEncoder().encode(JSON.stringify(session)));
  const signature = await hmacSign(payload, env.SESSION_SECRET);
  return `${payload}.${signature}`;
}

async function verifySession(token, env) {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) {
    return { ok: false };
  }

  const expectedSignature = await hmacSign(payload, env.SESSION_SECRET);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { ok: false };
  }

  try {
    const session = JSON.parse(textDecoder().decode(base64UrlDecode(payload)));
    return { ok: true, session };
  } catch {
    return { ok: false };
  }
}

async function hmacSign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, textEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

function isAllowedOrigin(origin, env) {
  return Boolean(env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN);
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-CV-Assistant",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(env, payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(env),
    },
  });
}

function jsonError(env, detail, status, extra = {}) {
  return jsonResponse(env, { error: detail, ...extra }, status);
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

let encoder;
function textEncoder() {
  if (!encoder) encoder = new TextEncoder();
  return encoder;
}

let decoder;
function textDecoder() {
  if (!decoder) decoder = new TextDecoder();
  return decoder;
}
