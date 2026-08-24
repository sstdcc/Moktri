import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_SUBJECT = 150;
const MAX_MESSAGE = 2000;
const MAX_EMAIL = 254;
// Same pragmatic pattern used in the frontend (UsersManagement.tsx).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort in-memory rate limit (per-isolate; resets on redeploy).
// Enough to blunt simple spam loops without shared-state infrastructure.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

interface ContactEmailMeta {
  userId: string | null;
  userPhone: string | null;
}

function buildEmailHtml(
  subject: string,
  message: string,
  email: string,
  meta: ContactEmailMeta
): string {
  const sender = meta.userId
    ? `مستخدم مسجل${meta.userPhone ? ` — الهاتف: ${escapeHtml(meta.userPhone)}` : ""}<br/>معرّف المستخدم: ${escapeHtml(meta.userId)}`
    : "زائر غير مسجل";
  return `<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;color:#1a1a1a;">
  <h2 style="margin:0 0 12px;">رسالة جديدة من نموذج «تواصل معنا»</h2>
  <p style="margin:0 0 4px;"><strong>العنوان:</strong> ${escapeHtml(subject)}</p>
  <p style="margin:0 0 4px;"><strong>بريد المرسل:</strong> <span dir="ltr">${escapeHtml(email)}</span></p>
  <p style="margin:0 0 4px;"><strong>المرسل:</strong> ${sender}</p>
  <hr style="border:none;border-top:1px solid #ddd;margin:12px 0;" />
  <p style="white-space:pre-wrap;margin:0;">${escapeHtml(message)}</p>
</div>`;
}

function buildEmailText(
  subject: string,
  message: string,
  email: string,
  meta: ContactEmailMeta
): string {
  const sender = meta.userId
    ? `مستخدم مسجل${meta.userPhone ? ` — الهاتف: ${meta.userPhone}` : ""}\nمعرّف المستخدم: ${meta.userId}`
    : "زائر غير مسجل";
  return `رسالة جديدة من نموذج «تواصل معنا»\n\nالعنوان: ${subject}\nبريد المرسل: ${email}\nالمرسل: ${sender}\n\n---\n${message}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // --- Secrets (server-side only; never sent to the client) ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supportEmail = Deno.env.get("SUPPORT_EMAIL"); // destination; never accepted from frontend
    // TEST-ONLY fallback until a sending domain is verified in Resend:
    // onboarding@resend.dev can deliver solely to the Resend account owner's
    // own inbox. Once SUPPORT_FROM_EMAIL secret is set it takes precedence.
    const fromEmail = Deno.env.get("SUPPORT_FROM_EMAIL") ?? "onboarding@resend.dev";
    if (!resendApiKey || !supportEmail) {
      console.error("contact-support: missing server configuration");
      return json({ error: "خطأ في إعدادات الخادم" }, 500);
    }

    // --- Rate limit ---
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    if (isRateLimited(ip)) {
      return json({ error: "عدد كبير من المحاولات، يرجى المحاولة لاحقًا" }, 429);
    }

    // --- Body validation ---
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "صيغة الطلب غير صالحة" }, 400);
    }
    if (typeof body !== "object" || body === null) {
      return json({ error: "صيغة الطلب غير صالحة" }, 400);
    }
    const { subject, email, message } = body as Record<string, unknown>;
    if (typeof subject !== "string") {
      return json({ error: "عنوان الرسالة مطلوب" }, 400);
    }
    if (typeof email !== "string") {
      return json({ error: "البريد الإلكتروني مطلوب" }, 400);
    }
    if (typeof message !== "string") {
      return json({ error: "نص الرسالة مطلوب" }, 400);
    }
    const cleanSubject = subject.trim().replace(/[\r\n]+/g, " ");
    const cleanEmail = email.trim().toLowerCase();
    const cleanMessage = message.trim();
    if (!cleanSubject) return json({ error: "عنوان الرسالة مطلوب" }, 400);
    if (cleanSubject.length > MAX_SUBJECT) {
      return json({ error: `العنوان طويل جدًا (الحد ${MAX_SUBJECT} حرفًا)` }, 400);
    }
    if (!cleanEmail) return json({ error: "البريد الإلكتروني مطلوب" }, 400);
    if (cleanEmail.length > MAX_EMAIL || !EMAIL_REGEX.test(cleanEmail)) {
      return json({ error: "صيغة البريد الإلكتروني غير صحيحة" }, 400);
    }
    if (!cleanMessage) return json({ error: "نص الرسالة مطلوب" }, 400);
    if (cleanMessage.length > MAX_MESSAGE) {
      return json({ error: `الشرح طويل جدًا (الحد ${MAX_MESSAGE} حرفًا)` }, 400);
    }

    // --- Optional authentication context (the /contact page is public) ---
    // Used only to enrich the email body for support; never for From/To.
    const meta: ContactEmailMeta = { userId: null, userPhone: null };
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!
        );
        const token = authHeader.slice("Bearer ".length);
        const { data } = await supabase.auth.getUser(token);
        const user = data.user;
        if (user) {
          meta.userId = user.id;
          meta.userPhone = user.phone ?? null;
        }
      } catch (e) {
        console.error("contact-support: auth check failed", e instanceof Error ? e.message : e);
      }
    }

    // --- Send via Resend ---
    // Destination is ALWAYS SUPPORT_EMAIL from secrets — never taken from the
    // request. Customer email is used ONLY as Reply-To, never as From.
    const payload: Record<string, unknown> = {
      from: fromEmail,
      to: [supportEmail],
      reply_to: cleanEmail,
      subject: cleanSubject,
      text: buildEmailText(cleanSubject, cleanMessage, cleanEmail, meta),
      html: buildEmailHtml(cleanSubject, cleanMessage, cleanEmail, meta),
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resendRes.ok) {
      console.error(
        `contact-support: resend failed (${resendRes.status})`,
        await resendRes.text()
      );
      return json({ error: "تعذر إرسال الرسالة حاليًا، حاول لاحقًا" }, 502);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    console.error("contact-support: unexpected error", e instanceof Error ? e.message : e);
    return json({ error: "حدث خطأ غير متوقع" }, 500);
  }
});
