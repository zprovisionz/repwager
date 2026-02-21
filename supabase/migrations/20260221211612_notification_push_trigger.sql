/*
  # Notification Push Trigger

  1. Changes
    - Adds a PL/pgSQL function `notify_push_on_insert` that fires after each new row
      inserted into the `notifications` table
    - Calls the `send-push-notification` Edge Function via `pg_net` (Supabase's HTTP
      extension) so every in-app notification is also delivered as a push notification
      in real-time without any client-side polling

  2. Important Notes
    - Uses `net.http_post` from the pg_net extension (pre-installed on Supabase)
    - The trigger is AFTER INSERT so the notification row is committed before the
      HTTP call fires; failures in the HTTP call do NOT roll back the notification insert
    - Service-role key is read from Supabase vault secret `service_role_key` via
      `current_setting` — falls back gracefully if the extension is unavailable
*/

CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url text;
  v_anon_key text;
BEGIN
  BEGIN
    v_url := current_setting('app.supabase_url', true);
    v_anon_key := current_setting('app.supabase_anon_key', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_url IS NULL OR v_anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title',   NEW.title,
        'body',    NEW.body,
        'data',    NEW.data
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push ON notifications;

CREATE TRIGGER trg_notify_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_insert();
