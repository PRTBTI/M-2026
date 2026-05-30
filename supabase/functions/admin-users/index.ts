import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "client" | "admin";

type AdminRequest = {
  action: "create" | "update" | "delete";
  userId?: string;
  role?: Role;
  verified?: boolean;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    nickname?: string;
    password: string;
    role: Role;
    verified: boolean;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Missing Supabase environment variables" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || callerProfile?.role !== "admin") return json({ error: "Forbidden" }, 403);

  const body = (await req.json()) as AdminRequest;

  if (body.action === "create") {
    const user = body.user;
    if (!user?.email || !user.password || !user.firstName || !user.lastName) {
      return json({ error: "Missing user data" }, 400);
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: Boolean(user.verified),
      user_metadata: {
        first_name: user.firstName,
        last_name: user.lastName,
        nickname: user.nickname || "",
      },
    });
    if (createError || !created.user) return json({ error: createError?.message || "Create failed" }, 400);

    const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
      id: created.user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      nickname: user.nickname || "",
      role: user.role === "admin" ? "admin" : "client",
      verified: Boolean(user.verified),
    });
    if (profileUpsertError) return json({ error: profileUpsertError.message }, 400);

    return json({ ok: true, userId: created.user.id });
  }

  if (!body.userId) return json({ error: "Missing userId" }, 400);
  if (body.userId === authData.user.id && body.action === "delete") {
    return json({ error: "Administrator nie może usunąć własnego konta." }, 400);
  }

  const { count: adminCount } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", body.userId)
    .single();

  const isLastAdmin = targetProfile?.role === "admin" && (adminCount || 0) <= 1;

  if (body.action === "update") {
    if (isLastAdmin && body.role && body.role !== "admin") {
      return json({ error: "Nie można odebrać roli ostatniemu administratorowi." }, 400);
    }

    const patch: Record<string, unknown> = {};
    if (body.role) patch.role = body.role === "admin" ? "admin" : "client";
    if (typeof body.verified === "boolean") patch.verified = body.verified;
    if (Object.keys(patch).length) {
      const { error: profileUpdateError } = await adminClient.from("profiles").update(patch).eq("id", body.userId);
      if (profileUpdateError) return json({ error: profileUpdateError.message }, 400);
    }
    if (typeof body.verified === "boolean") {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(body.userId, {
        email_confirm: body.verified,
      });
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);
    }
    return json({ ok: true });
  }

  if (body.action === "delete") {
    if (isLastAdmin) return json({ error: "Nie można usunąć ostatniego administratora." }, 400);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(body.userId);
    if (deleteError) return json({ error: deleteError.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
