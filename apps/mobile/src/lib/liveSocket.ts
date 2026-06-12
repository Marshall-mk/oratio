import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface TranscriptDelta {
  text: string;
  start_ms: number;
  end_ms: number;
}

export interface LiveSocketHandlers {
  onReady: () => void;
  onDelta: (delta: TranscriptDelta) => void;
  onFinal: (fullText: string, wordCount: number) => void;
  onError: (detail: string) => void;
  onClose: () => void;
}

/** Thin wrapper around the live-session WebSocket protocol. */
export class LiveSocket {
  private ws: WebSocket | null = null;

  async connect(attemptId: string, handlers: LiveSocketHandlers): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const wsUrl = `${API_URL.replace(/^http/, 'ws')}/ws/live-session?token=${encodeURIComponent(
      token,
    )}&attempt_id=${attemptId}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      switch (msg.type) {
        case 'ready':
          handlers.onReady();
          break;
        case 'transcript_delta':
          handlers.onDelta(msg as TranscriptDelta & { type: string });
          break;
        case 'transcript_final':
          handlers.onFinal(msg.full_text, msg.word_count);
          break;
        case 'error':
          handlers.onError(msg.detail);
          break;
      }
    };
    this.ws.onerror = () => handlers.onError('connection error');
    this.ws.onclose = () => handlers.onClose();
  }

  /** Forward a base64-encoded PCM chunk (RN-friendly JSON frame). */
  sendAudio(base64Pcm: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'audio', data: base64Pcm }));
    }
  }

  stop(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop' }));
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
