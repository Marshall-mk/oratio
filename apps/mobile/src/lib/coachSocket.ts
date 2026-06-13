import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface Meters {
  pacing: number;
  clarity: number;
  confidence: number;
  wpm: number | null;
}

export interface CoachSummary {
  total_words: number;
  total_fillers: number;
  avg_wpm: number | null;
  nudges: number;
}

export interface CoachHandlers {
  onReady: () => void;
  onDelta: (text: string) => void;
  onNudge: (kind: string, text: string) => void;
  onMeters: (m: Meters) => void;
  onSummary: (s: CoachSummary) => void;
  onError: (detail: string) => void;
  onClose: () => void;
}

/** Client for the Live Coach WebSocket (transcription + real-time coaching). */
export class CoachSocket {
  private ws: WebSocket | null = null;

  async connect(attemptId: string, handlers: CoachHandlers): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    const wsUrl = `${API_URL.replace(/^http/, 'ws')}/ws/live-coach?token=${encodeURIComponent(
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
          handlers.onDelta(msg.text);
          break;
        case 'nudge':
          handlers.onNudge(msg.kind, msg.text);
          break;
        case 'meters':
          handlers.onMeters(msg as Meters);
          break;
        case 'coach_summary':
          handlers.onSummary(msg as CoachSummary);
          break;
        case 'error':
          handlers.onError(msg.detail);
          break;
      }
    };
    this.ws.onerror = () => handlers.onError('connection error');
    this.ws.onclose = () => handlers.onClose();
  }

  sendAudio(base64Pcm: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'audio', data: base64Pcm }));
    }
  }

  stop(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'stop' }));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
