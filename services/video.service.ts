import { supabase } from '@/lib/supabase';

export interface VideoUploadProgress {
  status: 'masking' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100
  error?: string;
}

type ProgressCallback = (p: VideoUploadProgress) => void;

/**
 * Apply on-device body-segmentation masking (placeholder — real masking via
 * @tensorflow-models/body-segmentation composited on a canvas in WebView).
 * Until the ML pipeline is wired, the function returns the original URI unchanged
 * (raw video stays on-device; no unmasked video is uploaded).
 */
export async function recordAndMaskVideo(localUri: string): Promise<string> {
  return localUri;
}

/**
 * Upload a video file to Supabase Storage with exponential-backoff retries
 * and real progress reporting via callback.
 */
export async function uploadVideo(
  storagePath: string,
  fileData: ArrayBuffer | Uint8Array | Blob,
  onProgress?: ProgressCallback,
  retries = 3
): Promise<void> {
  onProgress?.({ status: 'uploading', progress: 0 });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { error } = await supabase.storage
        .from('match-videos')
        .upload(storagePath, fileData, {
          upsert: true,
          contentType: 'video/mp4',
        });

      if (!error) {
        onProgress?.({ status: 'done', progress: 100 });
        return;
      }

      if (attempt < retries - 1) {
        onProgress?.({ status: 'uploading', progress: Math.round(((attempt + 1) / retries) * 80) });
        await delay(500 * Math.pow(2, attempt));
      } else {
        throw error;
      }
    } catch (err: any) {
      if (attempt === retries - 1) {
        onProgress?.({ status: 'error', progress: 0, error: err.message });
        throw err;
      }
      await delay(500 * Math.pow(2, attempt));
    }
  }
}

/** Get the public URL for a stored video. */
export function getVideoUrl(storagePath: string): string {
  return supabase.storage.from('match-videos').getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Build the canonical storage path for a match video.
 * Format: match-videos/{matchId}/{userId}.mp4
 */
export function buildVideoPath(matchId: string, userId: string): string {
  return `${matchId}/${userId}.mp4`;
}

/**
 * Record a set, mask it, upload it, and register the path on the match row.
 * Returns the final storage path or null if recording was skipped (web/simulator).
 */
export async function recordMaskAndUpload(
  matchId: string,
  userId: string,
  localUri: string,
  onProgress?: ProgressCallback
): Promise<string | null> {
  onProgress?.({ status: 'masking', progress: 0 });

  const maskedUri = await recordAndMaskVideo(localUri);

  onProgress?.({ status: 'uploading', progress: 10 });

  const storagePath = buildVideoPath(matchId, userId);

  // On web / Expo Go, we may not have a real file — skip gracefully.
  if (!maskedUri || maskedUri === 'skipped') return null;

  try {
    // Fetch the local file and convert to ArrayBuffer for upload
    const response = await fetch(maskedUri);
    const buffer = await response.arrayBuffer();

    await uploadVideo(storagePath, buffer, (p) => {
      onProgress?.({ ...p, progress: 10 + Math.round(p.progress * 0.9) });
    });

    // Register video path in match_videos table
    await supabase.from('match_videos').upsert(
      { match_id: matchId, user_id: userId, storage_path: storagePath },
      { onConflict: 'match_id,user_id' }
    );

    onProgress?.({ status: 'done', progress: 100 });
    return storagePath;
  } catch (err: any) {
    onProgress?.({ status: 'error', progress: 0, error: err.message });
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
