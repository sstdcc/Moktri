import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Validate phone format
    if (!/^\+\d{9,15}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "رقم هاتف غير صالح" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "الرمز غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check code validity
    const { data: otpRecord, error: fetchErr } = await supabase
      .from("otp_codes")
      .select("id")
      .eq("phone", phone)
      .eq("code", code)
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

    // Mark as verified
    await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);

    // Derive a deterministic email from phone for Supabase auth
    const email = `${phone.replace("+", "")}@phone.miftah.app`;
    const password = `miftah_phone_${phone}_${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(-8)}`;

    // Try to sign in first (existing user)
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInErr && signInData?.session) {
      return new Response(
        JSON.stringify({
          success: true,
          session: signInData.session,
          isNew: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look for existing user by email or phone
    let existingUser = null;
    let page = 1;
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

    if (existingUser) {
      // Update password and sign in
      await supabase.auth.admin.updateUserById(existingUser.id, { password });
      const { data: session, error: signErr } = await supabase.auth.signInWithPassword({
        email: existingUser.email || email,
        password,
      });
      if (signErr) throw signErr;

      return new Response(
        JSON.stringify({
          success: true,
          session: session.session,
          isNew: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new user
    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      phone,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: { phone, full_name: "" },
    });
    if (createErr) throw createErr;

    const { data: newSession, error: newSignErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (newSignErr) throw newSignErr;

    return new Response(
      JSON.stringify({
        success: true,
        session: newSession.session,
        isNew: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Server-side only, no details leaked
    console.error("verify-otp error");
    return new Response(
      JSON.stringify({ error: "تعذر إكمال العملية، حاول مرة أخرى" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
