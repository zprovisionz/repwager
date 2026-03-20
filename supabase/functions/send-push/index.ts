import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const { token, title, body, data } = await req.json();
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data }),
  });
  return new Response(await response.text(), { status: response.status });
});
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushPayload {
  user_id?: string;
  token?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: PushPayload = await req.json();
    let pushToken = payload.token;

    if (!pushToken && payload.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("expo_push_token, push_enabled")
        .eq("id", payload.user_id)
        .maybeSingle();

      if (!profile?.expo_push_token || !profile.push_enabled) {
        return new Response(JSON.stringify({ skipped: true, reason: "no token or push disabled" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      pushToken = profile.expo_push_token;
    }

    if (!pushToken) {
      return new Response(JSON.stringify({ error: "no push token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = {
      to: pushToken,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
