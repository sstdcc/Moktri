// delete-account — permanent account deletion for the authenticated user.
//
// Security model:
//  - The caller must be authenticated. The user identity is taken EXCLUSIVELY
//    from the verified JWT in the Authorization header (never from the body).
//  - Service credentials stay server-side (Deno.env), never sent to the client.
//  - A user can only delete their own account.
//
// Credential model (Supabase API keys):
//  - New-style keys injected by the platform are JSON maps in env vars:
//      SUPABASE_PUBLISHABLE_KEYS -> { "default": "sb_publishable_..." }
//      SUPABASE_SECRET_KEYS     -> { "default": "sb_secret_..." }
//    Those are preferred. Legacy SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//    remain as fallbacks for older environments and for projects where the
//    gateway still only accepts the legacy JWT-based service key.
//  - The secret key is never returned in any response or set in CORS headers.
//
// Data model (project schema):
//  - auth.users -> profiles (FK, ON DELETE CASCADE)
//  - profiles -> listings / housing_requests / favorites / notifications /
//    device_tokens / notification_preferences / user_ratings / reports /
//    verification_applications / listing_conversations / listing_messages /
//    housing_request_offers (FKs, ON DELETE CASCADE)
//  - rentals has owner_id/renter_id as ON DELETE RESTRICT (deliberate
//    contractual protection). Accounts referenced by a rental are BLOCKED from
//    deletion and redirected to support — the DB will refuse otherwise.
//
// Storage cleanup (best-effort, keyed by the user id):
//  - avatars/{userId}/...
//  - verifications/{userId}/...
//  - listing-images/listings/{userId}/...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface StorageClient {
  storage: {
    from: (bucket: string) => {
      list: (prefix: string, opts?: { limit?: number }) => Promise<{ data: { name: string }[] | null; error: unknown }>;
      remove: (paths: string[]) => Promise<{ error: unknown }>;
    };
  };
}

// Best-effort cleanup of a user's objects inside a storage bucket folder.
async function removeFolder(client: StorageClient, bucket: string, prefix: string): Promise<void> {
  try {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) return;
    const paths = (data ?? [])
      .filter((o) => !o.name.endsWith("/"))
      .map((o) => `${prefix}/${o.name}`);
    if (paths.length > 0) {
      await client.storage.from(bucket).remove(paths);
    }
  } catch {
    // Non-fatal: DB cascade is authoritative; orphaned public files are only a
    // hygiene concern and must never block the deletion.
  }
}

// Extract the usable key from the platform-injected JSON key maps
// ({"default": "sb_..."}), mirroring the @supabase/server convention.
function keyFromMap(jsonValue: string | null): string | undefined {
  if (!jsonValue) return undefined;
  try {
    const parsed = JSON.parse(jsonValue) as Record<string, string>;
    if (parsed && typeof parsed === "object") {
      return parsed["default"] ?? Object.values(parsed)[0];
    }
  } catch {
    // Not JSON — treated as absent so callers fall back to legacy env vars.
  }
  return undefined;
}

// Detect a credential rejection (401, or a 403 that is JWT/key related) rather
// than an RLS/grant denial, so we can transparently retry with the legacy key.
function isKeyRejected(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (status === 401) return true;
  if (status === 403 && /jwt|unauthorized|invalid key|api key|forbidden/i.test(message)) return true;
  return false;
}

// The rentals table protects contractual records with owner/renter FKs on
// ON DELETE RESTRICT. GoTrue usually hides the underlying DB detail behind a
// generic error, so this is only a secondary signal; the primary detection is
// the caller-scoped pre-flight gate below.
function isRentalConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /foreign key constraint|still referenced from table|referenced from table|rentals/i.test(message);
}

const RENTALS_BLOCKED_MESSAGE =
  "لا يمكن حذف الحساب حاليًا لأن لديك عقد إيجار مرتبطًا بهذا الحساب. يمكنك حذف الحساب بعد انتهاء العقد وتسوية الالتزامات المرتبطة به.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ code: "method_not_allowed" }, 405);
  }

  try {
    // --- Verify caller from the JWT only ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ code: "unauthorized" }, 401);
    }
    const token = authHeader.slice("Bearer ".length).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const clientKey =
      keyFromMap(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) ??
      Deno.env.get("SUPABASE_ANON_KEY");
    const legacyAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const primaryAdminKey =
      keyFromMap(Deno.env.get("SUPABASE_SECRET_KEYS")) ??
      legacyAdminKey;
    const fallbackAdminKey =
      legacyAdminKey && legacyAdminKey !== primaryAdminKey ? legacyAdminKey : undefined;

    if (!supabaseUrl || !clientKey || !primaryAdminKey) {
      console.error("delete-account: missing server configuration");
      return json({ code: "server_error" }, 500);
    }

    // Validate the token and recover the authoritative user id.
    const verifier = createClient(supabaseUrl, clientKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data?.user) {
      return json({ code: "unauthorized" }, 401);
    }
    const userId = data.user.id;

    // The gateway on this project only accepts the publishable key as the
    // `apikey` header; service privileges are carried in `Authorization`.
    // supabase-js picks the passed key for BOTH headers by default, so the
    // Authorization header is overridden with the candidate admin credential.
    const makeAdmin = (key: string) =>
      createClient(supabaseUrl, clientKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${key}` } },
      });
    type AdminClient = ReturnType<typeof makeAdmin>;

    let admin = makeAdmin(primaryAdminKey);
    let hasFallback = !!fallbackAdminKey;

    // Run a DB/API operation on the primary (new-style) admin credential; if
    // that credential is rejected and a fallback exists, retry once with the
    // legacy env value and remember the working credential for the rest of the
    // request.
    async function withAdmin<T>(
      op: (c: AdminClient) => Promise<{ data: T | null; error: unknown | null }>
    ): Promise<{ data: T | null; error: unknown | null }> {
      const first = await op(admin);
      if (first.error && hasFallback && isKeyRejected(first.error)) {
        console.warn(
          "delete-account: new-style admin key rejected; retrying with fallback credential."
        );
        const second = await op(makeAdmin(fallbackAdminKey!));
        if (!second.error) {
          admin = makeAdmin(fallbackAdminKey!);
          hasFallback = false;
          return second;
        }
        return first;
      }
      return first;
    }

    // --- Block deletion for accounts referenced by a rental (ON DELETE RESTRICT) ---
    // The service credential has no SELECT grant on rentals in this project, so
    // the gate queries AS THE CALLER with their verified JWT: the RLS policy
    // "Parties can view own rentals" exposes every row where the caller is owner
    // or renter — the two FKs that are ON DELETE RESTRICT. broker_id is
    // ON DELETE SET NULL and deliberately excluded. No database grant needed.
    let callerRentals: { id: string }[] | null = null;
    try {
      const caller = createClient(supabaseUrl, clientKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data } = await caller
        .from("rentals")
        .select("id")
        .or(`owner_id.eq.${userId},renter_id.eq.${userId}`)
        .limit(1);
      callerRentals = (data as { id: string }[]) ?? null;
    } catch {
      // A failed pre-flight must never block a legit deletion; the DB-level
      // RESTRICT FK is the authoritative backstop (mapped below).
    }
    if (callerRentals && callerRentals.length > 0) {
      return json({
        code: "rentals_linked",
        error: RENTALS_BLOCKED_MESSAGE,
      }, 409);
    }

    // --- Best-effort storage cleanup (never blocks the deletion) ---
    await removeFolder(admin, "avatars", userId);
    await removeFolder(admin, "verifications", userId);
    await removeFolder(admin, "listing-images", `listings/${userId}`);

    // --- Delete the auth user (cascades to profiles and all user data) ---
    // supabase-js admin methods THROW on HTTP errors, so the call is wrapped.
    // The credential chain is tried in order: new-style secret key, legacy env
    // fallback, then DELETE_ADMIN_KEY (a dedicated server-side function secret;
    // never exposed to the client). The DB is only touched by the first
    // credential the gateway accepts for the destructive GoTrue endpoint.
    const deleteUserChains = [
      primaryAdminKey,
      ...(fallbackAdminKey ? [fallbackAdminKey] : []),
      ...(Deno.env.get("DELETE_ADMIN_KEY")
        ? [Deno.env.get("DELETE_ADMIN_KEY")!]
        : []),
    ].filter((k, i, arr) => arr.indexOf(k) === i);

    async function attemptUserDelete():
      | { status: "ok" }
      | { status: "error"; error: unknown; rentals?: boolean } {
      for (const key of deleteUserChains) {
        try {
          const delRes = await makeAdmin(key).auth.admin.deleteUser(userId);
          if (!delRes.error) return { status: "ok" };
          const status = (delRes.error as { status?: number })?.status;
          if (status === 404) return { status: "ok" }; // already gone
          if (isKeyRejected(delRes.error)) continue;
          return { status: "error", error: delRes.error, rentals: isRentalConstraintError(delRes.error) };
        } catch (e) {
          const status = (e as { status?: number })?.status;
          if (status === 404) return { status: "ok" }; // already gone
          if (isKeyRejected(e)) continue;
          return { status: "error", error: e, rentals: isRentalConstraintError(e) };
        }
      }
      return { status: "error", error: new Error("All admin credentials were rejected.") };
    }

    const del = await attemptUserDelete();
    if (del.status !== "ok") {
      console.error(
        `delete-account: user deletion failed for ${userId}`,
        (del.error as Error)?.message ?? String(del.error)
      );
      if (del.rentals) {
        return json({
          code: "rentals_linked",
          error: RENTALS_BLOCKED_MESSAGE,
        }, 409);
      }
      return json({
        code: "delete_failed",
        error: "تعذر حذف الحساب حاليًا. حاول مرة أخرى لاحقًا.",
      }, 409);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(
      "delete-account: unexpected error",
      e instanceof Error ? e.message : String(e)
    );
    return json({
      code: "server_error",
      error: "تعذر إكمال العملية، حاول مرة أخرى.",
    }, 500);
  }
});