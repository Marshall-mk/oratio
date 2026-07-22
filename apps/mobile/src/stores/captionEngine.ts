import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

/**
 * Which engine renders live captions during solo drills.
 *
 * - gemini:  cloud — PCM streams to the backend, Gemini Live sends deltas back.
 * - device:  the OS speech recognizer (Google/Apple) — on-device, lowest latency.
 * - whisper: whisper.cpp running in-app — on-device, needs a one-time model download.
 *
 * Conversational features (coach, debate, roleplay) always use Gemini Live:
 * the AI needs the words server-side to respond. Whatever the engine, the
 * final scored transcript comes from the uploaded WAV, so evaluation quality
 * is identical across engines.
 */
export type CaptionEngine = 'gemini' | 'device' | 'whisper';

const STORE_KEY = 'oratio.captionEngine';

interface CaptionEngineState {
  engine: CaptionEngine;
  setEngine: (engine: CaptionEngine) => void;
}

export const useCaptionEngine = create<CaptionEngineState>((set) => ({
  engine: 'gemini',
  setEngine: (engine) => {
    set({ engine });
    SecureStore.setItemAsync(STORE_KEY, engine).catch(() => {});
  },
}));

SecureStore.getItemAsync(STORE_KEY)
  .then((v) => {
    if (v === 'device' || v === 'whisper') useCaptionEngine.setState({ engine: v });
  })
  .catch(() => {});
