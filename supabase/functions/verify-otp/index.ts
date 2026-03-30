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

    // Check code
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
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.phone === phone
    );

    let session;
    if (existingUser) {
      // Generate a magic link / session for existing user
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: existingUser.email || `${phone.replace("+", "")}@phone.miftah.app`,
      });
      if (error) throw error;

      // Sign in with the token
      const { data: signInData, error: signInErr } =
        await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: existingUser.email || `${phone.replace("+", "")}@phone.miftah.app`,
        });

      // Use admin to create session
      const { data: sessionData, error: sessionErr } = await supabase.auth.signInWithPassword({
        phone,
        password: "_unused_",
      }).catch(() => ({ data: null, error: null }));

      // Fallback: return user info for client-side handling
      session = { user: existingUser };
    } else {
      // Create new user with phone
      const email = `${phone.replace("+", "")}@phone.miftah.app`;
      const password = crypto.randomUUID();

      const { data: newUser, error: createErr } =
        await supabase.auth.admin.createUser({
          phone,
          email,
          password,
          phone_confirm: true,
          email_confirm: true,
          user_metadata: { phone, full_name: "" },
        });
      if (createErr) throw createErr;
      session = { user: newUser.user, isNew: true };
    }

    // Generate access token for the user
    const userId = session.user?.id;
    if (!userId) throw new Error("No user ID");

    // Use admin API to generate a session
    const { data: tokenData, error: tokenErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: session.user.email || `${phone.replace("+", "")}@phone.miftah.app`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        token_hash: tokenData?.properties?.hashed_token,
        verification_url: tokenData?.properties?.verification_type,
        email: session.user.email || `${phone.replace("+", "")}@phone.miftah.app`,
        isNew: !existingUser,
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
