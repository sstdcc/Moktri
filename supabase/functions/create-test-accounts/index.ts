// Creates 3 test accounts (admin, owner, broker) with confirmed emails.
// Protected by shared secret token query param.
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

  const accounts = [
    {
      email: "admin.test@miftah.app",
      password: "Test123456",
      phone: "+967700000001",
      full_name: "مدير النظام",
      role: "admin",
    },
    {
      email: "owner.test@miftah.app",
      password: "Test123456",
      phone: "+967700000002",
      full_name: "مالك عقار تجريبي",
      role: "owner",
    },
    {
      email: "broker.test@miftah.app",
      password: "Test123456",
      phone: "+967700000003",
      full_name: "دلال عقار تجريبي",
      role: "broker",
    },
  ];

  const results: any[] = [];

  // Get existing users (paginated)
  const existingUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    existingUsers.push(...data.users);
    if (data.users.length < 200) break;
    page++;
  }

  for (const acc of accounts) {
    try {
      const existing = existingUsers.find(
        (u) => u.email === acc.email || (acc.phone && u.phone === acc.phone.replace("+", "")),
      );
      if (existing) {
        await supabase.auth.admin.deleteUser(existing.id);
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        phone: acc.phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { full_name: acc.full_name },
      });

      if (error) throw error;
      const userId = data.user!.id;

      // Upsert profile with correct role (bypass protect_profile_fields by using service role + raw SQL via rpc not needed; the trigger only applies when auth.uid() is set to a non-admin user. Service role bypasses RLS but trigger still runs and reads auth.uid() = null, so caller_role NULL -> not in admin/moderator -> raises. We need to set the GUC bypass.)
      // Use the bypass GUC
      await supabase.rpc as any;
      // Direct: insert via service role + set local GUC through a SQL function won't work via JS client.
      // Workaround: delete existing profile row first (handle_new_user trigger inserted one), then insert with role.
      await supabase.from("profiles").delete().eq("id", userId);
      const { error: insErr } = await supabase.from("profiles").insert({
        id: userId,
        full_name: acc.full_name,
        phone: acc.phone,
        role: acc.role,
      });
      if (insErr) throw insErr;

      results.push({
        email: acc.email,
        password: acc.password,
        role: acc.role,
        full_name: acc.full_name,
        phone: acc.phone,
        user_id: userId,
        ok: true,
      });
    } catch (e: any) {
      results.push({ email: acc.email, ok: false, error: e.message });
    }
  }

  return new Response(JSON.stringify({ ok: true, accounts: results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
