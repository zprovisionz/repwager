/*
  # Create Storage Bucket for Match Videos

  Creates the match-videos storage bucket with appropriate policies.
  Videos are private and only accessible to match participants via signed URLs.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'match-videos',
  'match-videos',
  false,
  524288000,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Participants can upload match videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'match-videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Participants can read match videos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'match-videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
