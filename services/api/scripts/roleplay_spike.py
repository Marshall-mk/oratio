"""M7 spike: validate Gemini Live as a responding PERSONA (not silent listener).

Streams a user utterance to a Gemini Live session configured with a persona
system instruction, then checks that we get back, for the model's turn:
  1. input_transcription  (what the user said)
  2. output_transcription  (what the persona said)
  3. model audio bytes     (24 kHz PCM to play on the phone)

This is the roleplay engine's core. Usage:
    GEMINI_API_KEY=... PYTHONPATH=. uv run python scripts/roleplay_spike.py /tmp/roleplay_user.wav
"""

import argparse
import asyncio
import sys
import time
import wave

from google import genai
from google.genai import types

from app.config import get_settings

CHUNK_MS = 250

PERSONA = (
    "You are Marcus Chen, a sharp, time-pressed venture capitalist hearing a "
    "founder's seed pitch. Stay in character. Be skeptical but fair. Ask one "
    "pointed follow-up question at a time. Keep each response under 25 words. "
    "Never break character or mention you are an AI."
)


def read_pcm_16k(path: str) -> bytes:
    with wave.open(path, "rb") as wf:
        rate, channels, width = wf.getframerate(), wf.getnchannels(), wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())
    if width != 2 or channels != 1 or rate != 16000:
        sys.exit(f"Need 16-bit mono 16kHz WAV; got width={width} ch={channels} rate={rate}")
    return frames


async def run(path: str, model: str) -> None:
    settings = get_settings()
    if not settings.gemini_api_key:
        sys.exit("GEMINI_API_KEY not set")

    pcm = read_pcm_16k(path)
    chunk_bytes = int(16000 * 2 * CHUNK_MS / 1000)
    print(f"User audio: {len(pcm) / 32000:.1f}s → persona model {model}")

    client = genai.Client(api_key=settings.gemini_api_key)
    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=PERSONA,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        # User controls turn boundaries (the Stop button), not server-side VAD,
        # so a mid-sentence pause never makes the persona barge in.
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(disabled=True),
        ),
    )

    user_text: list[str] = []
    persona_text: list[str] = []
    audio_bytes = 0
    start = time.monotonic()

    async with client.aio.live.connect(model=model, config=config) as session:

        async def sender() -> None:
            await session.send_realtime_input(activity_start=types.ActivityStart())
            for i in range(0, len(pcm), chunk_bytes):
                await session.send_realtime_input(
                    audio=types.Blob(
                        data=pcm[i : i + chunk_bytes], mime_type="audio/pcm;rate=16000"
                    )
                )
                await asyncio.sleep(CHUNK_MS / 1000)
            await session.send_realtime_input(activity_end=types.ActivityEnd())
            print(f"[{time.monotonic() - start:5.1f}s] -- user turn ended, awaiting persona --")

        send_task = asyncio.create_task(sender())
        try:
            async with asyncio.timeout(40):
                async for message in session.receive():
                    sc = message.server_content
                    if not sc:
                        continue
                    if sc.input_transcription and sc.input_transcription.text:
                        user_text.append(sc.input_transcription.text)
                    if sc.output_transcription and sc.output_transcription.text:
                        persona_text.append(sc.output_transcription.text)
                    if sc.model_turn:
                        for part in sc.model_turn.parts or []:
                            if part.inline_data and part.inline_data.data:
                                audio_bytes += len(part.inline_data.data)
                    if sc.turn_complete:
                        print(f"[{time.monotonic() - start:5.1f}s] -- persona turn complete --")
                        break
        except TimeoutError:
            print("(timed out)")
        finally:
            send_task.cancel()

    print("\n=== RESULTS ===")
    print(f"USER said:    {''.join(user_text).strip()!r}")
    print(f"PERSONA said: {''.join(persona_text).strip()!r}")
    sr = 24000
    print(f"Persona audio: {audio_bytes} bytes ≈ {audio_bytes / (sr * 2):.1f}s @24kHz PCM")
    ok = bool(user_text) and bool(persona_text) and audio_bytes > 0
    print(f"\nROLEPLAY VIABLE: {ok}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("wav")
    parser.add_argument("--model", default=None)
    args = parser.parse_args()
    asyncio.run(run(args.wav, args.model or get_settings().gemini_live_model))
