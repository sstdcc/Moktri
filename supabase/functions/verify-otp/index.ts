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
    const { phone, code } = await req.json();
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

    // ── Dev bypass: skip OTP validation for test phone ──
    const bypassPhones = ["+967777777777", "+967712345678", "+967772867128", "+967737777777"];
    const isDevBypass = bypassPhones.includes(phone) && code === "000000";

    if (!isDevBypass) {
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
    } else {
      console.log("[verify-otp] DEV BYPASS active for test phone");
    }

    // ──────────────────────────────────────────────────────────
    // TEMPORARY AUTH BRIDGE
    // Uses deterministic email + admin API to create sessions.
    // Avoids listUsers (which crashes on NULL email_change columns).
    // ──────────────────────────────────────────────────────────

    const email = `${phone.replace("+", "")}@phone.miftah.app`;
    let isNew = false;

    // Strategy: try createUser first. If user already exists (422),
    // we know it's an existing user and skip to session generation.
    // This avoids the broken listUsers paginated scan entirely.
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: randomPassword,
      phone,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: { phone, full_name: "" },
    });

    if (createErr) {
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
      console.log("[verify-otp] new user created");
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
    console.error("[verify-otp] unhandled error:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "تعذر إكمال العملية، حاول مرة أخرى" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
