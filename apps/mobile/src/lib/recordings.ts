import { File } from 'expo-file-system';

import { supabase } from './supabase';

/** Upload a recorded WAV to the private recordings bucket. Returns the storage path. */
export async function uploadRecording(fileUri: string, attemptId: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Not authenticated');

  const bytes = await new File(fileUri).bytes();
  const storagePath = `${userId}/${attemptId}.wav`;

  const { error } = await supabase.storage
    .from('recordings')
    .upload(storagePath, bytes.buffer as ArrayBuffer, {
      contentType: 'audio/wav',
      upsert: true,
    });
  if (error) throw error;
  return storagePath;
}

/** Get a short-lived playback URL for a stored recording. */
export async function getPlaybackUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('recordings')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
