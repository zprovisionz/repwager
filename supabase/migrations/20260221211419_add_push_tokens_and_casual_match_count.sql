/*
  # Add Push Tokens and Casual Match Count

  1. New Tables
    - `push_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to profiles)
      - `token` (text, Expo push token)
      - `platform` (text, ios/android/web)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (user_id, token) to prevent duplicates

  2. Profile Additions
    - `casual_match_count` (int, default 0) — tracks casual matches played for unlock gate
    - `onboarding_shown` (boolean, default false) — tracks if new user modal was shown

  3. Security
    - Enable RLS on push_tokens table
    - Users can only manage their own tokens
*/

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'unknown',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push tokens"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
  ON push_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'casual_match_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN casual_match_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_shown'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_shown boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
