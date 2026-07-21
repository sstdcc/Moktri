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

    // Extract client IP (best-effort)
    const ipHeader =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "";
    const clientIp = ipHeader.split(",")[0].trim() || "unknown";

    const now = Date.now();
    const oneMinAgo = new Date(now - 60 * 1000).toISOString();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // 1) 60-second cooldown per phone
    const { count: lastMinCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", oneMinAgo);
    if ((lastMinCount ?? 0) >= 1) {
      return new Response(
        JSON.stringify({ error: "يرجى الانتظار 60 ثانية قبل طلب رمز جديد" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Max 5 per phone per hour
    const { count: hourPhoneCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", oneHourAgo);
    if ((hourPhoneCount ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "تم تجاوز الحد المسموح لهذا الرقم، حاول بعد ساعة" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Max 15 per phone per day
    const { count: dayPhoneCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", oneDayAgo);
    if ((dayPhoneCount ?? 0) >= 15) {
      return new Response(
        JSON.stringify({ error: "تم تجاوز الحد اليومي لهذا الرقم، حاول غداً" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Max 10 per IP per hour
    if (clientIp && clientIp !== "unknown") {
      const { count: hourIpCount } = await supabase
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", clientIp)
        .gte("created_at", oneHourAgo);
      if ((hourIpCount ?? 0) >= 10) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول بعد ساعة" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      .insert({ phone, code: "***", otp_hash: otpHash, expires_at: expiresAt, ip_address: clientIp });
    if (insertErr) throw insertErr;

    // Build SMS params — prefer MessagingServiceSid, fall back to From number
    const smsParams: Record<string, string> = {
      To: phone,
      Body: `رمز التحقق الخاص بك في مفتاح: ${code}`,
    };
    // if (TWILIO_MESSAGING_SERVICE_SID) {
    //   smsParams.MessagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
    // } else if (TWILIO_PHONE_NUMBER) {
    //   smsParams.From = TWILIO_PHONE_NUMBER;
    // }
    
    if (TWILIO_PHONE_NUMBER) {
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
