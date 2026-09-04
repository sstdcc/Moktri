import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Hashing utility (must match verify-otp) ---
// v2 binds the OTP to BOTH channel and identifier so an email-channel OTP can
// never be matched against a phone-channel record (or vice versa).
async function hashOtp(code: string, channel: string, identifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`otp:${channel}:${identifier}:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildEmailHtml(code: string): string {
  return `<!doctype html>
<html dir="rtl">
  <body style="margin:0;padding:0;background:#f7f7fb;font-family:Tahoma,Arial,sans-serif;">
    <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef3;">
      <div style="background:#16327a;color:#ffffff;padding:20px 24px;">
        <span style="font-size:18px;font-weight:bold;">منصة مكتري</span>
      </div>
      <div style="padding:28px 24px;color:#1c2233;font-size:15px;line-height:1.9;">
        <p>مرحباً،</p>
        <p>رمز التحقق الخاص بك هو:</p>
        <div style="text-align:center;margin:20px 0;">
          <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#16327a;direction:ltr;unicode-bidi:embed;">${code}</span>
        </div>
        <p>الرمز صالح لمدة 5 دقائق. لا تشاركه مع أي شخص.</p>
        <p style="color:#7a8194;font-size:13px;">إذا لم تكن قد طلبت هذا الرمز، فتجاهل هذه الرسالة.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendEmailOtp(to: string, code: string): Promise<void> {
  // All SMTP settings come from Supabase Edge Function secrets (server-side only).
  const host = Deno.env.get("SMTP_HOST");
  const port = Deno.env.get("SMTP_PORT");
  const username = Deno.env.get("SMTP_USERNAME");
  const password = Deno.env.get("SMTP_PASSWORD");
  const from = Deno.env.get("SMTP_FROM");
  if (!host || !port || !username || !password || !from) {
    throw new Error("Missing SMTP server configuration");
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Deno.env.get("SMTP_TLS") === "true",
    auth: { user: username, pass: password },
  });

  await transporter.sendMail({
    from,
    to,
    subject: "رمز التحقق - مكتري",
    text: `رمز التحقق الخاص بك في منصة مكتري هو: ${code}\nالرمز صالح لمدة 5 دقائق.\nإذا لم تكن قد طلبت هذا الرمز، فتجاهل هذه الرسالة.`,
    html: buildEmailHtml(code),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { email?: string; phone?: string; channel?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "صيغة الطلب غير صالحة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { email, phone } = body;
    const channel: "email" | "phone" = body.channel === "phone" ? "phone" : "email";

    // Resolve the authenticated user (best-effort). When present (Google flow),
    // the identifier is bound to the session email, never to client input.
    let sessionEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(supabaseUrl, anonKey);
      const { data } = await authClient.auth.getUser(authHeader.slice("Bearer ".length));
      if (data?.user?.email) sessionEmail = data.user.email.toLowerCase().trim();
    }

    let identifier: string;
    if (channel === "phone") {
      if (!phone || typeof phone !== "string" || !/^\+\d{9,15}$/.test(phone)) {
        return new Response(
          JSON.stringify({ error: "رقم هاتف غير صالح" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      identifier = phone;
    } else {
      identifier = (sessionEmail ?? email ?? "").toLowerCase().trim();
      if (!EMAIL_REGEX.test(identifier)) {
        return new Response(
          JSON.stringify({ error: "البريد الإلكتروني غير صالح" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Duplicate checks only for anonymous signup (no session). Authenticated
    // users (Google) belong to an existing account, so no dedup.
    if (channel === "email" && !sessionEmail) {
      const { data: emailExists } = await supabase.rpc("check_email_exists", { p_email: identifier });
      if (emailExists) {
        return new Response(
          JSON.stringify({ error: "البريد الإلكتروني مستخدم مسبقًا" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (phone && typeof phone === "string") {
        const { data: existingPhone } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();
        if (existingPhone) {
          return new Response(
            JSON.stringify({ error: "رقم الهاتف مستخدم مسبقًا" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

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

    // 1) 60-second cooldown per (identifier, channel)
    const { count: lastMinCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier)
      .eq("channel", channel)
      .gte("created_at", oneMinAgo);
    if ((lastMinCount ?? 0) >= 1) {
      return new Response(
        JSON.stringify({ error: "يرجى الانتظار 60 ثانية قبل طلب رمز جديد" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Max 5 per (identifier, channel) per hour
    const { count: hourCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier)
      .eq("channel", channel)
      .gte("created_at", oneHourAgo);
    if ((hourCount ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول بعد ساعة" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Max 15 per (identifier, channel) per day
    const { count: dayCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier)
      .eq("channel", channel)
      .gte("created_at", oneDayAgo);
    if ((dayCount ?? 0) >= 15) {
      return new Response(
        JSON.stringify({ error: "تم تجاوز الحد اليومي، حاول غداً" }),
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
    const otpHash = await hashOtp(code, channel, identifier);

    // Invalidate old pending codes for this (identifier, channel)
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("identifier", identifier)
      .eq("channel", channel)
      .eq("verified", false);

    // Store hashed code only — `code` column set to placeholder
    const row: Record<string, unknown> = {
      identifier,
      channel,
      code: "***",
      otp_hash: otpHash,
      expires_at: expiresAt,
      ip_address: clientIp,
    };
    if (channel === "phone") row.phone = identifier;
    const { error: insertErr } = await supabase.from("otp_codes").insert(row);
    if (insertErr) throw insertErr;

    if (channel === "email") {
      await sendEmailOtp(identifier, code);
    } else {
      // --- Twilio path (preserved so SMS/phone can be re-enabled later) ---
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      if (!TWILIO_ACCOUNT_SID) throw new Error("Missing server config");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      if (!TWILIO_AUTH_TOKEN) throw new Error("Missing server config");
      const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
      const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_PHONE_NUMBER) throw new Error("Missing server config");

      const smsParams: Record<string, string> = {
        To: identifier,
        Body: `رمز التحقق الخاص بك في مكتري: ${code}`,
      };
      if (TWILIO_MESSAGING_SERVICE_SID) {
        smsParams.MessagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
      } else if (TWILIO_PHONE_NUMBER) {
        smsParams.From = TWILIO_PHONE_NUMBER;
      }

      const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

      const smsRes = await fetch(twilioApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(smsParams),
      });

      if (!smsRes.ok) {
        const errorBody = await smsRes.text();
        console.error("SMS send failed with status:", smsRes.status, "body:", errorBody);
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
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-otp error", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "تعذر إكمال العملية، حاول مرة أخرى" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});