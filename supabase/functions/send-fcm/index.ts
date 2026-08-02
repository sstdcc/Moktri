// FCM Integration V2 Final — send-fcm Edge Function.
// Single delivery function: receives a notification that was just inserted
// into the notifications table (fired by the AFTER INSERT trigger via
// pg_net), checks the recipient's push preferences, resolves their registered
// device tokens, and sends each device an FCM message.
//
// Contract (FCM_Integration_V2_Final.md §4.2):
//   - Auth:         X-FCM-Secret header === Deno.env.FCM_FUNCTION_SECRET
//   - Skip rule:    prefs[type] === false → skip; everything else → deliver
//   - No queue. No retry. Best-effort delivery.
//
// Error response uses HTTP 200 for expected/operational outcomes so the DB
// trigger (which is fire-and-forget via pg_net) is not affected by statuses.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { JWT } from "npm:google-auth-library@9";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes (FCM tokens last 60 min)

// OAuth access token cache — persists across warm invocations.
// Reset to null on cold start; regenerated lazily on first request.
interface OAuthCache {
  token: string;
  expiresAt: number;
}
let oauthCache: OAuthCache | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Loads and caches the FCM service account. The project_id needed to build
// the FCM HTTP v1 endpoint is read from the service account JSON itself, so
// only the three secrets in the V2 Final spec (§4.1) are required.
let serviceAccountCache: Record<string, string> | null = null;

function getServiceAccount(): Record<string, string> {
  if (serviceAccountCache) return serviceAccountCache;
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Missing FCM_SERVICE_ACCOUNT_JSON");
  serviceAccountCache = JSON.parse(raw);
  return serviceAccountCache;
}

// Returns a cached FCM OAuth token, generating a new one when missing/expired.
async function getFcmAccessToken(): Promise<string> {
  if (oauthCache && oauthCache.expiresAt > Date.now()) {
    return oauthCache.token;
  }

  const serviceAccount = getServiceAccount();
  const client = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: [FCM_SCOPE],
  });

  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("Failed to obtain FCM access token");
  }

  oauthCache = { token, expiresAt: Date.now() + CACHE_TTL_MS };
  return token;
}

function buildFcmMessage(
  payload: {
    type: string;
    title_ar: string | null;
    body_ar: string | null;
    link: string | null;
  }
): Record<string, unknown> {
  return {
    message: {
      token: "",
      notification: {
        title: payload.title_ar ?? "",
        body: payload.body_ar ?? "",
      },
      data: {
        type: payload.type,
        link: payload.link ?? "",
        title_ar: payload.title_ar ?? "",
        body_ar: payload.body_ar ?? "",
      },
      webpush: {
        fcm_options: { link: "/notifications" },
      },
    },
  };
}

// Sends one FCM message. Returns "ok", "invalid" (token must be deleted), or
// throws on transport/5xx errors so the caller can degrade gracefully.
async function sendFcm(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  message: Record<string, unknown>
): Promise<"ok" | "invalid"> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    }
  );

  if (res.ok) return "ok";

  // 401 UNAUTHENTICATED → the cached token is expired/invalid.
  // Caller regenerates the token and retries once. (V2 Final §4.3)
  if (res.status === 401) {
    throw new InvalidTokenError();
  }

  // Token-level invalidation: FCM reports the device token as unusable.
  // Only UNREGISTERED / INVALID_ARGUMENT / SENDER_ID_MISMATCH mean the token
  // itself is bad — a plain 400 can also mean a malformed message body, in
  // which case the token must be kept.
  const errorCode = await parseFcmErrorCode(res);
  if (
    errorCode === "UNREGISTERED" ||
    errorCode === "INVALID_ARGUMENT" ||
    errorCode === "SENDER_ID_MISMATCH"
  ) {
    return "invalid";
  }

  // Other failures (429, 500, 503) are transient — not retried in V2.
  throw new Error(`FCM responded with status ${res.status} (${errorCode || "unknown"})`);
}

// Extracts the FCM error code from the HTTP v1 error envelope, e.g. the
// `error.status` field ("UNREGISTERED") when present.
async function parseFcmErrorCode(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    if (body?.error?.status && typeof body.error.status === "string") {
      return body.error.status;
    }
  } catch {
    // Response body was not JSON — fall through to null.
  }
  return null;
}

class InvalidTokenError extends Error {
  constructor() {
    super("FCM access token invalid/expired");
    this.name = "InvalidTokenError";
  }
}

Deno.serve(async (req) => {
  // OPTIONS preflight (not used by pg_net, but keeps the function invokable
  // from browsers/devtools for manual testing).
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // 1. Authenticate the request via shared secret.
  const expectedSecret = Deno.env.get("FCM_FUNCTION_SECRET");
  const providedSecret = req.headers.get("X-FCM-Secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }

  // 2. Extract payload.
  let body: {
    notification_id?: string;
    user_id?: string;
    type?: string;
    title_ar?: string | null;
    body_ar?: string | null;
    link?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  if (!body.notification_id || !body.user_id || !body.type) {
    return jsonResponse(
      { error: "MISSING_FIELDS", message: "notification_id, user_id, and type are required" },
      400
    );
  }

  const supabase = await getSupabase();

  // 3. Preference check — skip ONLY when prefs[type] === false.
  // Missing preference values / missing row / true → deliver by default.
  try {
    const { data: prefsRow } = await supabase
      .from("notification_preferences")
      .select("prefs")
      .eq("user_id", body.user_id)
      .maybeSingle();

    if (prefsRow?.prefs?.[body.type!] === false) {
      return jsonResponse({ skipped: "user_disabled", type: body.type });
    }
  } catch (err) {
    console.error("[send-fcm] preference query failed:", err);
  }

  // 4. Resolve the recipient's registered devices.
  let tokens: { token: string }[] = [];
  try {
    const { data } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", body.user_id);
    tokens = data ?? [];
  } catch (err) {
    console.error("[send-fcm] token query failed:", err);
  }

  if (tokens.length === 0) {
    return jsonResponse({ skipped: "no_tokens" });
  }

  // 5. Resolve FCM project + OAuth token.
  let projectId: string;
  try {
    projectId = getServiceAccount().project_id;
  } catch (err) {
    console.error("[send-fcm] missing FCM_SERVICE_ACCOUNT_JSON:", err);
    return jsonResponse({ error: "MISSING_SERVICE_ACCOUNT" }, 500);
  }

  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken();
  } catch (err) {
    console.error("[send-fcm] OAuth token generation failed:", err);
    return jsonResponse({ error: "OAUTH_FAILED" }, 500);
  }

  const message = buildFcmMessage({
    type: body.type!,
    title_ar: body.title_ar ?? null,
    body_ar: body.body_ar ?? null,
    link: body.link ?? null,
  });

  // 6. Deliver to each token.
  let delivered = 0;
  const invalidTokens: string[] = [];

  for (const { token } of tokens) {
    let outcome: "ok" | "invalid";
    try {
      outcome = await sendFcm(accessToken, projectId, token, {
        ...message,
        message: { ...message.message, token },
      });
    } catch (err) {
      // 401 → regenerate token and retry once.
      if (err instanceof InvalidTokenError) {
        try {
          oauthCache = null;
          accessToken = await getFcmAccessToken();
          outcome = await sendFcm(accessToken, projectId, token, {
            ...message,
            message: { ...message.message, token },
          });
        } catch (retryErr) {
          console.error("[send-fcm] retry after OAuth refresh failed:", retryErr);
          continue;
        }
      } else {
        console.error("[send-fcm] delivery failed:", err);
        continue;
      }
    }

    if (outcome === "ok") {
      delivered += 1;
    } else {
      invalidTokens.push(token);
    }
  }

  // 7. Remove invalidated tokens so future deliveries skip them.
  if (invalidTokens.length > 0) {
    try {
      await supabase.from("device_tokens").delete().in("token", invalidTokens);
    } catch (err) {
      console.error("[send-fcm] failed to delete invalid tokens:", err);
    }
  }

  return jsonResponse({ delivered, invalidated: invalidTokens.length });
});
