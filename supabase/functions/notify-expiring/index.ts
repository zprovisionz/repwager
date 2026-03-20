import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SEND_PUSH_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;

Deno.serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const in31Minutes = new Date(now.getTime() + 31 * 60 * 1000);

    const { data: expiringMatches, error } = await supabase
      .from("matches")
      .select(`
        id,
        challenger_id,
        opponent_id,
        exercise_type,
        wager_amount,
        challenger_submitted_at,
        opponent_submitted_at,
        profiles!matches_challenger_id_fkey(display_name),
        opponent_profile:profiles!matches_opponent_id_fkey(display_name)
      `)
      .in("status", ["accepted", "challenger_submitted", "opponent_submitted"])
      .gte("submission_deadline", now.toISOString())
      .lte("submission_deadline", in31Minutes.toISOString());

    if (error) throw error;
    if (!expiringMatches || expiringMatches.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let notified = 0;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    for (const match of expiringMatches) {
      const challenger = (match as any).profiles;
      const opponent = (match as any).opponent_profile;

      const promises: Promise<unknown>[] = [];

      if (!match.challenger_submitted_at && match.challenger_id) {
        const opponentName = opponent?.display_name ?? "your opponent";
        promises.push(
          fetch(SEND_PUSH_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              user_id: match.challenger_id,
              title: "⏰ 30 min left!",
              body: `Don't let ${opponentName} win by default. Submit your ${match.exercise_type === "push_ups" ? "push-ups" : "squats"} now!`,
              data: { match_id: match.id, type: "match_expiring" },
            }),
          })
        );
      }

      if (!match.opponent_submitted_at && match.opponent_id) {
        const challengerName = challenger?.display_name ?? "your opponent";
        promises.push(
          fetch(SEND_PUSH_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              user_id: match.opponent_id,
              title: "⏰ 30 min left!",
              body: `Don't let ${challengerName} win by default. Submit your ${match.exercise_type === "push_ups" ? "push-ups" : "squats"} now!`,
              data: { match_id: match.id, type: "match_expiring" },
            }),
          })
        );
      }

      await Promise.allSettled(promises);
      notified += promises.length;

      await supabase.from("notifications").upsert(
        [
          match.challenger_id && !match.challenger_submitted_at
            ? {
                user_id: match.challenger_id,
                type: "match_expiring",
                title: "⏰ 30 min left!",
                body: `Don't let ${(match as any).opponent_profile?.display_name ?? "your opponent"} win by default.`,
                data: { match_id: match.id },
                read: false,
              }
            : null,
          match.opponent_id && !match.opponent_submitted_at
            ? {
                user_id: match.opponent_id,
                type: "match_expiring",
                title: "⏰ 30 min left!",
                body: `Don't let ${(match as any).profiles?.display_name ?? "your opponent"} win by default.`,
                data: { match_id: match.id },
                read: false,
              }
            : null,
        ].filter(Boolean) as any[],
        { onConflict: "user_id,type,data->match_id" }
      );
    }

    return new Response(JSON.stringify({ notified, matches: expiringMatches.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
