import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_VERIFY_ATTEMPTS = 5;

// --- Hashing utility (must match send-otp) ---
async function hashOtp(code: string, phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`otp:${phone}:${code}`);
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
    const { phone, code, email: providedEmail, password: providedPassword } = await req.json();
    console.log("[verify-otp] request received");

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
    const submittedHash = await hashOtp(code, phone);

    // Find the latest unverified, non-expired OTP for this phone
    const { data: otpRecord, error: fetchErr } = await supabase
      .from("otp_codes")
      .select("id, otp_hash, attempts")
      .eq("phone", phone)
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

    // Compare hashes
    if (otpRecord.otp_hash !== submittedHash) {
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OTP verified — mark as used
    await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);
    console.log("[verify-otp] OTP hash matched, proceeding to auth bridge");

    // Block banned users from logging in
    const { data: bannedProfile } = await supabase
      .from("profiles")
      .select("id, is_active")
      .eq("phone", phone)
      .maybeSingle();
    if (bannedProfile && bannedProfile.is_active === false) {
      console.log("[verify-otp] banned user attempted login");
      return new Response(
        JSON.stringify({ error: "تم حظر حسابك. تواصل مع الإدارة." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────────────────────────
    // AUTH BRIDGE
    // New signups (email+password provided): create user with real email + password.
    // Existing users / OTP-only: fall back to deterministic email + random password.
    // ──────────────────────────────────────────────────────────

    const email = providedEmail || `${phone.replace("+", "")}@phone.miftah.app`;
    const password = providedPassword || crypto.randomUUID() + crypto.randomUUID();
    let isNew = false;

    // Duplicate check for new signups (email+password provided)
    if (providedEmail && providedPassword) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: "رقم الهاتف مستخدم مسبقًا" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: emailExists } = await supabase.rpc("check_email_exists", { p_email: providedEmail.trim().toLowerCase() });
      if (emailExists) {
        return new Response(
          JSON.stringify({ error: "البريد الإلكتروني مستخدم مسبقًا" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Strategy: try createUser first. If user already exists (422),
    // we know it's an existing user and skip to session generation.
    // This avoids the broken listUsers paginated scan entirely.
    console.log("[verify-otp] createUser payload:", JSON.stringify({
      email,
      password: password ? `${password.slice(0, 2)}...` : null,
      phone,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: { phone, full_name: "" },
    }));
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      phone,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: { phone, full_name: "" },
    });

    if (createErr) {
      // Log full error details for debugging
      console.error("[verify-otp] createUser error:", {
        message: createErr.message,
        code: (createErr as any)?.code ?? null,
        status: (createErr as any)?.status ?? null,
        details: (createErr as any)?.details ?? null,
        hint: (createErr as any)?.hint ?? null,
        stack: (createErr as any)?.stack ?? null,
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
      console.log("[verify-otp] new user created with email:", email);
      isNew = true;
    }

    // Generate a magic link and extract the token to create a session
    console.log("[verify-otp] generating magic link for:", email);
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkErr) {
      console.error("[verify-otp] VERIFY_STEP_GENERATE_LINK_FAILED:", linkErr.message);
      throw linkErr;
    }

    if (!linkData?.properties?.hashed_token) {
      console.error("[verify-otp] VERIFY_STEP_GENERATE_LINK_NO_TOKEN");
      throw new Error("Session generation failed — no hashed_token");
    }

    console.log("[verify-otp] magic link generated, verifying token");

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

    console.log("[verify-otp] session created successfully, isNew:", isNew);

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
