import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_VERIFY_ATTEMPTS = 5;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Hashing utility (must match send-otp) ---
// v2 binds the OTP to BOTH channel and identifier. A code generated for
// channel=email can only be verified against an email-channel record, and vice
// versa, even if the identifier string is identical in another context.
async function hashOtp(code: string, channel: string, identifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`otp:${channel}:${identifier}:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// v1 fallback for phone-channel rows that predate the channel-aware hash, so
// in-flight SMS OTPs remain verifiable during the transition.
async function legacyHashOtp(code: string, identifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`otp:${identifier}:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { email?: string; phone?: string; code?: string; password?: string; channel?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "صيغة الطلب غير صالحة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { email, phone, code, password: providedPassword } = body;
    const channel: "email" | "phone" = body.channel === "phone" ? "phone" : "email";

    let identifier: string;
    if (channel === "phone") {
      if (!phone || !code || typeof phone !== "string" || typeof code !== "string") {
        return new Response(
          JSON.stringify({ error: "رقم الهاتف والرمز مطلوبان" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!/^\+\d{9,15}$/.test(phone)) {
        return new Response(
          JSON.stringify({ error: "رقم هاتف غير صالح" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      identifier = phone;
    } else {
      if (!email || !code || typeof email !== "string" || typeof code !== "string") {
        return new Response(
          JSON.stringify({ error: "البريد الإلكتروني والرمز مطلوبان" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      identifier = email.toLowerCase().trim();
      if (!EMAIL_REGEX.test(identifier)) {
        return new Response(
          JSON.stringify({ error: "البريد الإلكتروني غير صالح" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Hash the submitted code and compare against stored hash
    const submittedHash = await hashOtp(code, channel, identifier);
    const submittedLegacyHash = channel === "phone" ? await legacyHashOtp(code, identifier) : null;

    // Find the latest unverified, non-expired OTP for this (identifier, channel).
    // Lookup is bound to BOTH keys — an email-channel OTP can never collide
    // with a phone-channel record.
    const { data: otpRecord, error: fetchErr } = await supabase
      .from("otp_codes")
      .select("id, otp_hash, attempts")
      .eq("identifier", identifier)
      .eq("channel", channel)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!otpRecord) {
      console.log("[verify-otp] no valid OTP record found");
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max verification attempts
    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);
      return new Response(
        JSON.stringify({ error: "تم تجاوز عدد المحاولات، أعد إرسال الرمز" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempts
    await supabase
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Compare hashes (v2, plus the v1 fallback for legacy phone rows)
    const matched =
      otpRecord.otp_hash === submittedHash ||
      (submittedLegacyHash !== null && otpRecord.otp_hash === submittedLegacyHash);
    if (!matched) {
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OTP verified — mark as used (replay protection)
    await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);
    console.log("[verify-otp] OTP hash matched, proceeding to auth bridge");

    // Block banned phone-channel users from logging in
    if (channel === "phone") {
      const { data: bannedProfile } = await supabase
        .from("profiles")
        .select("id, is_active")
        .eq("phone", identifier)
        .maybeSingle();
      if (bannedProfile && bannedProfile.is_active === false) {
        console.log("[verify-otp] banned user attempted login");
        return new Response(
          JSON.stringify({ error: "تم حظر حسابك. تواصل مع الإدارة." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ──────────────────────────────────────────────────────────
    // AUTH BRIDGE (channel-aware)
    // Email channel: user signs up with a real email (+ optional phone data).
    // Phone channel: existing users fall back to deterministic email.
    // ──────────────────────────────────────────────────────────
    const isEmailChannel = channel === "email";
    const authEmail = isEmailChannel
      ? identifier
      : phoneChannelEmail(body.email, identifier);
    const password = providedPassword || crypto.randomUUID() + crypto.randomUUID();
    let isNew = false;

    // Duplicate checks for email signups (anonymous; binds identifier+channel)
    if (isEmailChannel) {
      const { data: emailExists } = await supabase.rpc("check_email_exists", { p_email: identifier });
      if (emailExists) {
        return new Response(
          JSON.stringify({ error: "البريد الإلكتروني مستخدم مسبقًا" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (body.phone && typeof body.phone === "string") {
        const { data: existingPhone } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", body.phone)
          .maybeSingle();
        if (existingPhone) {
          return new Response(
            JSON.stringify({ error: "رقم الهاتف مستخدم مسبقًا" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else if (body.email && providedPassword) {
      // Legacy phone signup with explicit email+password
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", identifier)
        .maybeSingle();
      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: "رقم الهاتف مستخدم مسبقًا" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: emailExists } = await supabase.rpc("check_email_exists", { p_email: body.email.trim().toLowerCase() });
      if (emailExists) {
        return new Response(
          JSON.stringify({ error: "البريد الإلكتروني مستخدم مسبقًا" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const createUserPayload: Record<string, unknown> = {
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "",
        phone: isEmailChannel ? (typeof body.phone === "string" ? body.phone : "") : identifier,
      },
    };
    if (isEmailChannel) {
      // Phone remains pure user data on email-channel signups.
      if (typeof body.phone === "string" && body.phone) {
        createUserPayload.phone = body.phone;
        createUserPayload.phone_confirm = true;
      }
    } else {
      createUserPayload.phone = identifier;
      createUserPayload.phone_confirm = true;
    }

    // Strategy: try createUser first. If user already exists (422),
    // we know it's an existing user and skip to session generation.
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser(createUserPayload);

    if (createErr) {
      console.error("[verify-otp] createUser error:", {
        message: createErr.message,
        code: (createErr as any)?.code ?? null,
        status: (createErr as any)?.status ?? null,
        details: (createErr as any)?.details ?? null,
        hint: (createErr as any)?.hint ?? null,
      });
      // Check if user already exists
      const errMsg = createErr.message || "";
      if (errMsg.includes("already been registered") || errMsg.includes("already exists")) {
        console.log("[verify-otp] existing user detected via createUser 422");
        // User exists — proceed to generate session below
      } else {
        console.error("[verify-otp] VERIFY_STEP_CREATE_USER_FAILED:", errMsg);
        throw createErr;
      }
    } else {
      console.log("[verify-otp] new user created with email:", authEmail);
      isNew = true;
    }

    // Generate a magic link and extract the token to create a session
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
    });

    if (linkErr) {
      console.error("[verify-otp] VERIFY_STEP_GENERATE_LINK_FAILED:", linkErr.message);
      throw linkErr;
    }

    if (!linkData?.properties?.hashed_token) {
      console.error("[verify-otp] VERIFY_STEP_GENERATE_LINK_NO_TOKEN");
      throw new Error("Session generation failed — no hashed_token");
    }

    // Verify the magic link token server-side to get a session
    const { data: sessionData, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (verifyErr) {
      console.error("[verify-otp] VERIFY_STEP_VERIFY_MAGICLINK_FAILED:", verifyErr.message);
      throw verifyErr;
    }

    if (!sessionData?.session) {
      console.error("[verify-otp] VERIFY_STEP_NO_SESSION_RETURNED");
      throw new Error("Session verification failed — no session");
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData.session,
        isNew,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[verify-otp] unhandled error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code ?? null,
        details: (error as any)?.details ?? null,
        hint: (error as any)?.hint ?? null,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Phone-channel keeps the legacy deterministic-email logic.
// body.email is the destructured alias used by the legacy phone flow only.
function phoneChannelEmail(bodyEmail: string | undefined, identifier: string): string {
  const provided = typeof bodyEmail === "string" && bodyEmail ? bodyEmail.trim().toLowerCase() : "";
  if (provided) return provided;
  return `${identifier.replace("+", "")}@phone.miftah.app`;
}