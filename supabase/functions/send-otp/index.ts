import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

// --- Hashing utility ---
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
    const { phone } = await req.json();
    if (!phone || typeof phone !== "string" || !/^\+\d{9,15}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "رقم هاتف غير صالح" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing server config");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("Missing server config");
    const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_PHONE_NUMBER) throw new Error("Missing server config");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit: max 3 OTPs per phone in 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", tenMinAgo);

    if ((count ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول بعد قليل" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Hash the code — raw code is NEVER stored
    const otpHash = await hashOtp(code, phone);

    // Invalidate old pending codes for this phone
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("phone", phone)
      .eq("verified", false);

    // Store hashed code only — `code` column set to placeholder
    const { error: insertErr } = await supabase
      .from("otp_codes")
      .insert({ phone, code: "***", otp_hash: otpHash, expires_at: expiresAt });
    if (insertErr) throw insertErr;

    // Build SMS params — prefer MessagingServiceSid, fall back to From number
    const smsParams: Record<string, string> = {
      To: phone,
      Body: `رمز التحقق الخاص بك في مفتاح: ${code}`,
    };
    if (TWILIO_MESSAGING_SERVICE_SID) {
      smsParams.MessagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
    } else if (TWILIO_PHONE_NUMBER) {
      smsParams.From = TWILIO_PHONE_NUMBER;
    }

    const smsRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(smsParams),
    });

    if (!smsRes.ok) {
      const errorBody = await smsRes.text();
      console.error("SMS send failed with status:", smsRes.status, "body:", errorBody);
      
      // Parse Twilio error for user-friendly messages
      try {
        const twilioErr = JSON.parse(errorBody);
        if (twilioErr.code === 21211 || twilioErr.code === 21614) {
          return new Response(
            JSON.stringify({ error: "رقم الهاتف غير صالح، تأكد من الرقم وحاول مرة أخرى" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (twilioErr.code === 21608) {
          return new Response(
            JSON.stringify({ error: "الرقم غير مدعوم حالياً، حاول برقم آخر" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch { /* ignore parse errors */ }
      
      throw new Error("فشل إرسال الرسالة");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-otp error");
    return new Response(
      JSON.stringify({ error: "تعذر إكمال العملية، حاول مرة أخرى" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
