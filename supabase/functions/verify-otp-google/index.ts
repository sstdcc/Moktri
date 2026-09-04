import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_VERIFY_ATTEMPTS = 5;

// --- Hashing utility (must match send-otp) ---
// v2 binds the OTP to channel + identifier so the Google verification only
// matches OTPs sent to the authenticated user's own email/channel.
async function hashOtp(code: string, channel: string, identifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`otp:${channel}:${identifier}:${code}`);
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
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The email is taken from the authenticated session — never from client
    // input — so the OTP can only be verified for the signed-in account.
    const identifier = (user.email ?? "").toLowerCase().trim();
    if (!identifier) {
      return new Response(
        JSON.stringify({ error: "حساب Google بلا بريد إلكتروني" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: { code?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "صيغة الطلب غير صالحة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { code } = body;
    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "الرمز مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channel = "email";
    const submittedHash = await hashOtp(code, channel, identifier);

    // Lookup bound to BOTH identifier and channel (email)
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
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);
      return new Response(
        JSON.stringify({ error: "تم تجاوز عدد المحاولات، أعد إرسال الرمز" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    if (otpRecord.otp_hash !== submittedHash) {
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);

    // Block banned users
    const { data: bannedProfile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (bannedProfile && bannedProfile.is_active === false) {
      return new Response(
        JSON.stringify({ error: "تم حظر حسابك. تواصل مع الإدارة." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[verify-otp-google] error:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "تعذر إكمال العملية، حاول مرة أخرى" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});