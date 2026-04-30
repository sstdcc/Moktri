// One-shot helper to create a confirmed email+password test user.
// Protected by a shared secret query param to avoid abuse.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (token !== "miftah-test-2026") {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const email = "test.miftah@example.com";
  const password = "TestPass123!";
  const phone = "+967737777778";
  const fullName = "حساب اختبار";

  // Delete existing if present
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email === email || u.phone === phone.replace("+", ""));
  if (existing) {
    await supabase.auth.admin.deleteUser(existing.id);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    phone,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Ensure profile row
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      phone,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      user_id: data.user?.id,
      email,
      password,
      phone,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
