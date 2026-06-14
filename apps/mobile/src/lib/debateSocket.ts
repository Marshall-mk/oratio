import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface DebateTurnHandlers {
  onReady: () => void;
  onDelta: (text: string) => void;
  onSaved: (transcript: string) => void;
  onError: (detail: string) => void;
  onClose: () => void;
}

/** Transcribes a single debate turn over the /ws/debate-turn socket. */
export class DebateSocket {
  private ws: WebSocket | null = null;

  async connect(
    debateId: string,
    participant: string,
    round: number,
    handlers: DebateTurnHandlers,
  ): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    const qs = `token=${encodeURIComponent(token)}&debate_id=${debateId}&participant=${encodeURIComponent(
      participant,
    )}&round=${round}`;
    this.ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws/debate-turn?${qs}`);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      switch (msg.type) {
        case 'ready':
          handlers.onReady();
          break;
        case 'transcript_delta':
          handlers.onDelta(msg.text);
          break;
        case 'turn_saved':
          handlers.onSaved(msg.transcript);
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
