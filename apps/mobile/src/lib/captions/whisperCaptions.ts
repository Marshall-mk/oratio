// whisper.rn's exports map has no root entry — subpaths must be explicit.
import { initWhisper, type WhisperContext } from 'whisper.rn/index';
import { RealtimeTranscriber } from 'whisper.rn/realtime-transcription/index';
import type {
  AudioStreamConfig,
  AudioStreamData,
  AudioStreamInterface,
} from 'whisper.rn/realtime-transcription/index';

import { whisperModelFile } from './whisperModel';

/**
 * Live captions from whisper.cpp (tiny.en) running fully on-device.
 *
 * Audio ownership stays with @siteed/audio-studio (which also writes the WAV
 * we upload for evaluation): its 250 ms base64 PCM16 chunks — the same stream
 * the Gemini engine sends over the WebSocket — are pushed into the transcriber
 * through this adapter. One recorder, no Android mic contention.
 */
class PushAudioStream implements AudioStreamInterface {
  private dataCb: ((data: AudioStreamData) => void) | null = null;
  private statusCb: ((recording: boolean) => void) | null = null;
  private recording = false;

  async initialize(_config: AudioStreamConfig): Promise<void> {}
  async start(): Promise<void> {
    this.recording = true;
    this.statusCb?.(true);
  }
  async stop(): Promise<void> {
    this.recording = false;
    this.statusCb?.(false);
  }
  isRecording(): boolean {
    return this.recording;
  }
  onData(cb: (data: AudioStreamData) => void): void {
    this.dataCb = cb;
  }
  onError(_cb: (error: string) => void): void {}
  onStatusChange(cb: (isRecording: boolean) => void): void {
    this.statusCb = cb;
  }
  async release(): Promise<void> {
    this.dataCb = null;
    this.statusCb = null;
  }

  /** Feed one base64 PCM16 chunk from audio-studio's onAudioStream. */
  pushBase64(base64: string): void {
    if (!this.recording || !this.dataCb) return;
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    this.dataCb({ data: bytes, sampleRate: 16000, channels: 1, timestamp: Date.now() });
  }
}

export interface WhisperCaptionHandlers {
  onText: (text: string) => void;
  onError: (detail: string) => void;
}

export class WhisperCaptionSession {
  private context: WhisperContext | null = null;
  private transcriber: RealtimeTranscriber | null = null;
  private stream = new PushAudioStream();
  private stableText = '';
  private interimBySlice = new Map<number, string>();

  async start(handlers: WhisperCaptionHandlers): Promise<void> {
    this.context = await initWhisper({ filePath: whisperModelFile().uri });

    this.transcriber = new RealtimeTranscriber(
      { whisperContext: this.context, audioStream: this.stream },
      {
        // Short slices keep re-transcription cheap on mid-range arm64: work
        // grows with slice length, so 15 s caps the worst-case inference.
        audioSliceSec: 15,
        audioMinSec: 0.5,
        transcribeOptions: { language: 'en' },
      },
      {
        onTranscribe: (event) => {
          const text = event.data?.result?.trim();
          if (text == null) return;
          this.interimBySlice.set(event.sliceIndex, text);
          handlers.onText(this.assemble());
        },
        onSliceTranscriptionStabilized: (text) => {
          this.stableText = this.stableText ? `${this.stableText} ${text.trim()}` : text.trim();
          this.interimBySlice.clear();
          handlers.onText(this.assemble());
        },
        onError: (error) => handlers.onError(String(error)),
      },
    );
    await this.transcriber.start();
  }

  private assemble(): string {
    const interim = [...this.interimBySlice.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, t]) => t)
      .join(' ')
      .trim();
    return [this.stableText, interim].filter(Boolean).join(' ');
  }

  /** Feed one base64 PCM chunk (call from audio-studio's onAudioStream). */
  pushAudio(base64: string): void {
    this.stream.pushBase64(base64);
  }

  async stop(): Promise<void> {
    try {
      await this.transcriber?.stop();
    } finally {
      await this.transcriber?.release().catch(() => {});
      await this.context?.release().catch(() => {});
      this.transcriber = null;
      this.context = null;
    }
  }
}
