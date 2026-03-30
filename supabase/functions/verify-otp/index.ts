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
    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: "رقم الهاتف والرمز مطلوبان" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check code validity
    const { data: otpRecord, error: fetchErr } = await supabase
      .from("otp_codes")
      .select("*")
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
        JSON.stringify({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as verified
    await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);

    // Derive a deterministic email from phone for Supabase auth
    const email = `${phone.replace("+", "")}@phone.miftah.app`;
    const password = `miftah_phone_${phone}_secret_key_2026`;

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
          user: signInData.user,
          isNew: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If sign-in failed, check if user exists but with wrong password
    // Try to find user by email using admin API
    const { data: userByEmail } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    // Search through all users for matching email or phone
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
          user: session.user,
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
        user: newSession.user,
        isNew: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-otp error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
