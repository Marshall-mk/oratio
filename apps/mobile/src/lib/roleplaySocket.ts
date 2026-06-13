import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface RoleplayHandlers {
  onReady: () => void;
  onUserDelta: (text: string) => void;
  onPersonaDelta: (text: string) => void;
  onPersonaTurn: (text: string, audioBase64: string | null) => void;
  onSaved: (turnCount: number) => void;
  onError: (detail: string) => void;
  onClose: () => void;
}

/** Client for the multi-turn roleplay WebSocket protocol. */
export class RoleplaySocket {
  private ws: WebSocket | null = null;

  async connect(attemptId: string, handlers: RoleplayHandlers): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const wsUrl = `${API_URL.replace(/^http/, 'ws')}/ws/roleplay-session?token=${encodeURIComponent(
      token,
    )}&attempt_id=${attemptId}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      switch (msg.type) {
        case 'ready':
          handlers.onReady();
          break;
        case 'user_delta':
          handlers.onUserDelta(msg.text);
          break;
        case 'persona_delta':
          handlers.onPersonaDelta(msg.text);
          break;
        case 'persona_turn':
          handlers.onPersonaTurn(msg.text, msg.audio);
          break;
        case 'conversation_saved':
          handlers.onSaved(msg.turn_count);
          break;
        case 'error':
          handlers.onError(msg.detail);
          break;
      }
    };
    this.ws.onerror = () => handlers.onError('connection error');
    this.ws.onclose = () => handlers.onClose();
  }

  startUserTurn(): void {
    this.send({ type: 'user_turn_start' });
  }

  sendAudio(base64Pcm: string): void {
    this.send({ type: 'audio', data: base64Pcm });
  }

  endUserTurn(): void {
    this.send({ type: 'user_turn_end' });
  }

  endConversation(): void {
    this.send({ type: 'end_conversation' });
  }

  private send(obj: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
