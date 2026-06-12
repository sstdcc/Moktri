import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_FAILED_ATTEMPTS = 5;
const FIRST_LOCKOUT_MINUTES = 15;
const SECOND_LOCKOUT_HOURS = 24;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatRemaining(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes <= 60) {
    return `يرجى المحاولة بعد ${minutes} دقيقة`;
  }
  const hours = Math.ceil(minutes / 60);
  return `الحساب مقفل لمدة ${hours} ساعة بسبب محاولات فاشلة متكررة`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email: rawEmail, password } = await req.json();
    if (!rawEmail || !password || typeof rawEmail !== "string" || typeof password !== "string") {
      return json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }, 400);
    }
    const email = rawEmail.trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Check lockout
    const { data: attempt } = await admin
      .from("login_attempts")
      .select("failed_count, lockout_count, locked_until")
      .eq("email", email)
      .maybeSingle();

    const now = Date.now();
    if (attempt?.locked_until) {
      const until = new Date(attempt.locked_until).getTime();
      if (until > now) {
        return json({
          success: false,
          error: `تم قفل الحساب مؤقتاً بسبب محاولات تسجيل دخول فاشلة. ${formatRemaining(until - now)}`,
          locked: true,
          retry_after_ms: until - now,
        }, 200);
      }
    }

    // Attempt password sign-in via anon client
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr || !signInData?.session) {
      // Record failure
      const prevFailed = attempt?.failed_count ?? 0;
      const prevLockouts = attempt?.lockout_count ?? 0;
      const newFailed = prevFailed + 1;

      let newLockedUntil: string | null = null;
      let newLockoutCount = prevLockouts;
      let resetFailed = newFailed;

      if (newFailed >= MAX_FAILED_ATTEMPTS) {
        // Lockout: first => 15min, subsequent consecutive => 24h
        const ms = prevLockouts === 0
          ? FIRST_LOCKOUT_MINUTES * 60 * 1000
          : SECOND_LOCKOUT_HOURS * 60 * 60 * 1000;
        newLockedUntil = new Date(now + ms).toISOString();
        newLockoutCount = prevLockouts + 1;
        resetFailed = 0;
      }

      await admin.from("login_attempts").upsert({
        email,
        failed_count: resetFailed,
        lockout_count: newLockoutCount,
        locked_until: newLockedUntil,
        last_failed_at: new Date(now).toISOString(),
      }, { onConflict: "email" });

      if (newLockedUntil) {
        const ms = new Date(newLockedUntil).getTime() - now;
        return json({
          success: false,
          error: `تجاوزت الحد المسموح من محاولات الدخول. ${formatRemaining(ms)}`,
          locked: true,
          retry_after_ms: ms,
        }, 200);
      }

      const remaining = MAX_FAILED_ATTEMPTS - newFailed;
      return json({
        success: false,
        error: `بيانات الدخول غير صحيحة. تبقى لديك ${remaining} محاولة قبل قفل الحساب.`,
        invalid: true,
        remaining,
      }, 200);
    }

    // Success — reset attempts (keep row so lockout_count resets only on success)
    await admin.from("login_attempts").upsert({
      email,
      failed_count: 0,
      lockout_count: 0,
      locked_until: null,
      last_failed_at: null,
    }, { onConflict: "email" });

    return json({ success: true, session: signInData.session });
  } catch (error) {
    console.error("[secure-login] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "تعذر إكمال العملية، حاول مرة أخرى" }, 500);
  }
});
