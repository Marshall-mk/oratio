import { Directory, File, Paths } from 'expo-file-system';
// The new File API has no download progress; the legacy resumable does.
import { createDownloadResumable } from 'expo-file-system/legacy';

/**
 * Whisper caption model management. tiny.en (~77 MB) is the only model small
 * enough to keep realtime re-transcription responsive on mid-range arm64.
 */
const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin';
const MODEL_NAME = 'ggml-tiny.en.bin';

function modelDir(): Directory {
  return new Directory(Paths.document, 'whisper');
}

export function whisperModelFile(): File {
  return new File(modelDir(), MODEL_NAME);
}

export function isWhisperModelDownloaded(): boolean {
  try {
    return whisperModelFile().exists;
  } catch {
    return false;
  }
}

export async function downloadWhisperModel(
  onProgress: (fraction: number) => void,
): Promise<void> {
  const dir = modelDir();
  if (!dir.exists) dir.create();
  const target = whisperModelFile();
  if (target.exists) return;

  const tmpUri = `${dir.uri}${MODEL_NAME}.part`;
  const download = createDownloadResumable(MODEL_URL, tmpUri, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const result = await download.downloadAsync();
  if (!result || (result.status !== 200 && result.status !== 206)) {
    new File(tmpUri).delete();
    throw new Error(`Model download failed (HTTP ${result?.status ?? '?'})`);
  }
  new File(tmpUri).move(target);
  onProgress(1);
}

export function deleteWhisperModel(): void {
  const f = whisperModelFile();
  if (f.exists) f.delete();
}
