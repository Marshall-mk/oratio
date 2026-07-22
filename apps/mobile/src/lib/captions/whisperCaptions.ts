// whisper.rn's exports map has no root entry — subpaths must be explicit.
import { initWhisper, type WhisperContext } from 'whisper.rn/index';

import { whisperModelFile } from './whisperModel';

/**
 * Live captions from whisper.cpp (tiny.en) running fully on-device.
 *
 * Audio ownership stays with @siteed/audio-studio (which also writes the WAV
 * we upload for evaluation): its 250 ms base64 PCM16 chunks — the same stream
 * the Gemini engine sends over the WebSocket — are decoded and fed straight to
 * WhisperContext.transcribeData (whose native side expects exactly these int16
 * bytes; see decodePcm16 in RNWhisperJSI.cpp).
 *
 * We deliberately do NOT use whisper.rn's RealtimeTranscriber: on-device it
 * returned empty transcriptions for verified-good speech audio. This drives
 * the same underlying transcribe call with buffers we assemble ourselves:
 * a rolling window is re-transcribed every second (serialized — one inference
 * at a time), and when the window passes WINDOW_SEC its text is committed to
 * the stable transcript and a fresh window begins.
 */

const BYTES_PER_SECOND = 16000 * 2; // 16 kHz mono int16
const WINDOW_SEC = 12; // cap per-inference audio so tiny.en stays responsive
const MIN_SEC = 0.6; // don't bother transcribing less than this

export interface WhisperCaptionHandlers {
  onText: (text: string) => void;
  onError: (detail: string) => void;
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export class WhisperCaptionSession {
  private context: WhisperContext | null = null;
  private handlers: WhisperCaptionHandlers | null = null;
  private window: Uint8Array[] = [];
  private windowBytes = 0;
  private stableText = '';
  private busy = false;
  private dirty = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  async start(handlers: WhisperCaptionHandlers): Promise<void> {
    this.handlers = handlers;
    this.context = await initWhisper({ filePath: whisperModelFile().uri });
    this.timer = setInterval(() => void this.tick(), 1000);
  }

  /** Feed one base64 PCM16 chunk (call from audio-studio's onAudioStream). */
  pushAudio(base64: string): void {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    this.window.push(bytes);
    this.windowBytes += bytes.length;
    this.dirty = true;
  }

  private async tick(): Promise<void> {
    if (this.busy || !this.context || !this.dirty) return;
    if (this.windowBytes < MIN_SEC * BYTES_PER_SECOND) return;
    this.busy = true;
    this.dirty = false;

    // Snapshot the window: chunks arriving during inference stay queued.
    const chunks = this.window.slice();
    const total = chunks.reduce((n, c) => n + c.length, 0);

    try {
      const audio = concat(chunks, total);
      const { promise } = this.context.transcribeData(audio.buffer as ArrayBuffer, {
        language: 'en',
      });
      const result = await promise;
      // Whisper labels non-speech in brackets ("[BLANK_AUDIO]", "[MUSIC]",
      // "(wind blowing)") — noise, not captions.
      const text = (result.result ?? '')
        .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      this.handlers?.onText([this.stableText, text].filter(Boolean).join(' '));

      // Rollover: commit this window's text and drop exactly what we transcribed.
      if (total >= WINDOW_SEC * BYTES_PER_SECOND) {
        if (text) this.stableText = [this.stableText, text].filter(Boolean).join(' ');
        this.window.splice(0, chunks.length);
        this.windowBytes -= total;
      }
    } catch (e) {
      this.handlers?.onError(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy = false;
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Let an in-flight inference finish before releasing the context.
    for (let i = 0; i < 40 && this.busy; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    await this.context?.release().catch(() => {});
    this.context = null;
  }
}
