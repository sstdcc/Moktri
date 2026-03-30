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

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.phone === phone);

    if (!existingUser) {
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
    }

    // Sign in to get a real session
    // We use the deterministic password approach
    if (!existingUser) {
      // New user - sign in with the password we just set
      const { data: session, error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) throw signErr;

      return new Response(
        JSON.stringify({
          success: true,
          session: session.session,
          user: session.user,
          isNew: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Existing user - use admin to generate link and extract token
      // Update password to our deterministic one so we can sign in
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
  } catch (error) {
    console.error("verify-otp error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
