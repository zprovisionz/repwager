import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send notification to database and push via send-push-notification function
 */
async function sendNotification(
  supabase: any,
  supabaseUrl: string,
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  try {
    // Save to notifications table
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data,
    });

    // Send push notification
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        user_id: userId,
        title,
        body,
        data: { type, ...data },
      }),
    });
  } catch (err) {
    console.error(`Failed to send notification to ${userId}:`, err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const now = new Date();

    // ─── INACTIVITY NUDGE ──────────────────────────────────────────────────
    // Target: Users inactive 3–7 days
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveUsers } = await supabase
      .from('profiles')
      .select('id, display_name, current_streak')
      .lt('last_active_date', threeDaysAgo)
      .gt('last_active_date', sevenDaysAgo);

    for (const user of inactiveUsers ?? []) {
      const streakMsg = user.current_streak > 0
        ? `Your ${user.current_streak}-day streak is at risk!`
        : 'New challenges are waiting for you.';

      await sendNotification(
        supabase,
        supabaseUrl,
        user.id,
        'inactivity_nudge',
        '👋 Miss the grind?',
        streakMsg,
        { streak: user.current_streak, action: 'play_match' }
      );
    }

    // ─── DAILY STREAK REMINDER ────────────────────────────────────────────
    // Target: Users with active streaks who haven't played today
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const { data: streakUsers } = await supabase
      .from('profiles')
      .select('id, display_name, current_streak')
      .gte('current_streak', 1)
      .lt('last_active_date', `${today}T00:00:00Z`);

    for (const user of streakUsers ?? []) {
      await sendNotification(
        supabase,
        supabaseUrl,
        user.id,
        'streak_reminder',
        `🔥 Streak reminder!`,
        `Keep your ${user.current_streak}-day streak alive. Challenge someone today!`,
        { streak: user.current_streak, action: 'play_match' }
      );
    }

    return new Response(
      JSON.stringify({
        inactivity: inactiveUsers?.length ?? 0,
        streaks: streakUsers?.length ?? 0,
        timestamp: now.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('scheduled-nudges error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
