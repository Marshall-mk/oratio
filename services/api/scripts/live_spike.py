"""M2 spike: validate Gemini Live as a silent transcriber.

Streams a local WAV file to a Gemini Live session (as 16 kHz PCM chunks, paced
like a real microphone) and prints input-transcription events as they arrive.

Validates:
  1. input_audio_transcription events arrive with reasonable latency/quality
  2. the model can be instructed to stay silent (we count/discard model output)

Usage:
    GEMINI_API_KEY=... uv run python scripts/live_spike.py path/to/audio.wav
    # optional: --model gemini-2.5-flash-native-audio-preview-12-2025
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

SILENT_LISTENER_INSTRUCTION = (
    "You are a silent transcription listener. The user is practicing a speech. "
    "Never respond, never speak, never comment. Remain completely silent at all times."
)


def read_pcm_16k(path: str) -> bytes:
    """Read a WAV file and return raw 16-bit mono PCM at 16 kHz."""
    with wave.open(path, "rb") as wf:
        rate, channels, width = wf.getframerate(), wf.getnchannels(), wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())
    if width != 2:
        sys.exit(f"Expected 16-bit PCM WAV, got sample width {width}")
    if channels == 2:
        import audioop

        frames = audioop.tomono(frames, 2, 0.5, 0.5)
    if rate != 16000:
        import audioop

        frames, _ = audioop.ratecv(frames, 2, 1, rate, 16000, None)
    return frames


async def run(path: str, model: str) -> None:
    settings = get_settings()
    if not settings.gemini_api_key:
        sys.exit("GEMINI_API_KEY not set (env or services/api/.env)")

    pcm = read_pcm_16k(path)
    chunk_bytes = int(16000 * 2 * CHUNK_MS / 1000)
    duration_s = len(pcm) / (16000 * 2)
    print(f"Audio: {duration_s:.1f}s, streaming in {CHUNK_MS}ms chunks → model {model}")

    client = genai.Client(api_key=settings.gemini_api_key)
    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=SILENT_LISTENER_INSTRUCTION,
        input_audio_transcription=types.AudioTranscriptionConfig(),
    )

    transcript_parts: list[str] = []
    model_output_events = 0
    start = time.monotonic()

    async with client.aio.live.connect(model=model, config=config) as session:

        async def sender() -> None:
            for i in range(0, len(pcm), chunk_bytes):
                await session.send_realtime_input(
                    audio=types.Blob(data=pcm[i : i + chunk_bytes], mime_type="audio/pcm;rate=16000")
                )
                await asyncio.sleep(CHUNK_MS / 1000)  # pace like a live mic
            await session.send_realtime_input(audio_stream_end=True)
            print(f"[{time.monotonic() - start:6.2f}s] -- audio fully sent --")

        send_task = asyncio.create_task(sender())

        try:
            async with asyncio.timeout(duration_s + 30):
                async for message in session.receive():
                    sc = message.server_content
                    if sc and sc.input_transcription and sc.input_transcription.text:
                        text = sc.input_transcription.text
                        transcript_parts.append(text)
                        print(f"[{time.monotonic() - start:6.2f}s] transcript: {text!r}")
                    if sc and sc.model_turn:
                        model_output_events += 1  # should stay ~0 if silence works
        except TimeoutError:
            print("(receive loop timed out — closing)")
        finally:
            send_task.cancel()

    print("\n=== RESULTS ===")
    print(f"Transcript ({len(transcript_parts)} events):\n{''.join(transcript_parts)}")
    print(f"\nModel output events (want 0 or near-0): {model_output_events}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("wav", help="Path to a WAV file of speech")
    parser.add_argument("--model", default=None)
    args = parser.parse_args()
    asyncio.run(run(args.wav, args.model or get_settings().gemini_live_model))
