import { Directory, File, Paths } from 'expo-file-system';

/** Write a base64-encoded WAV to a temp file and return its URI (for playback). */
export function writeWavBase64(base64: string, name: string): string {
  const dir = new Directory(Paths.cache, 'persona');
  if (!dir.exists) dir.create();
  const file = new File(dir, `${name}.wav`);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}
