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
      // Generic error — do not reveal whether phone exists
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max verification attempts
    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      // Burn the code
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

    // ──────────────────────────────────────────────────────────
    // TEMPORARY AUTH BRIDGE
    // This section bridges custom OTP verification with Supabase Auth.
    // It uses a deterministic email + admin API magic link to create
    // sessions without storing or deriving passwords.
    //
    // TODO: Replace with native Supabase phone auth or a dedicated
    // auth provider when the project migrates to production phone auth.
    // ──────────────────────────────────────────────────────────

    const email = `${phone.replace("+", "")}@phone.miftah.app`;

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    // Search for existing user by email
    let existingUser = null;
    let page = 1;
    // NOTE: Paginated scan is needed because Supabase admin API does not
    // support filtering by email directly. This should be replaced when
    // a native phone auth flow is adopted.
    while (true) {
      const { data: usersPage } = await supabase.auth.admin.listUsers({
        page,
        perPage: 100,
      });
      if (!usersPage?.users?.length) break;
      existingUser = usersPage.users.find(
        (u) => u.email === email || u.phone === phone
      );
      if (existingUser) break;
      if (usersPage.users.length < 100) break;
      page++;
    }

    let userId: string;
    let isNew = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user with no password — auth via magic link only
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword,
        phone,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: { phone, full_name: "" },
      });
      if (createErr) throw createErr;
      userId = newUser.user.id;
      isNew = true;
    }

    // Generate a magic link and extract the token to create a session
    // This avoids storing or deriving any password from secrets.
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      throw new Error("Session generation failed");
    }

    // Verify the magic link token server-side to get a session
    const { data: sessionData, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (verifyErr || !sessionData?.session) {
      throw new Error("Session verification failed");
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
    // Server-side only — no details leaked to client
    console.error("verify-otp error");
    return new Response(
      JSON.stringify({ error: "تعذر إكمال العملية، حاول مرة أخرى" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
