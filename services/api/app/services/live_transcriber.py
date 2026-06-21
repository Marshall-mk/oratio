"""Gemini Live session wrapper: a silent transcriber for streamed PCM audio.

Validated by scripts/live_spike.py: input transcription deltas arrive in real
time; the model is instructed to stay silent and any stray output is discarded.
"""

import array
import asyncio
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from google import genai
from google.genai import types

from app.config import get_settings

SILENT_LISTENER_INSTRUCTION = (
    "You are a silent transcription listener. The user is practicing a speech. "
    "Never respond, never speak, never comment. Remain completely silent at all times."
)

# Input-gain normalization for quiet capture (notably the iOS Simulator, which
# pipes the Mac mic in at low gain with no hardware tuning). Per-chunk peak AGC:
# boost each chunk toward a target peak, capped so we never blow up background
# noise, gated so near-silent chunks pass through, and clamped so it can't clip.
# On already-loud audio (a real device) the computed gain is <= 1, so it's a no-op.
_TARGET_PEAK = 22000  # ~ -3.4 dBFS for the loudest sample in a chunk
_MAX_GAIN = 8.0  # never amplify more than this (avoids amplifying hiss)
_NOISE_FLOOR_PEAK = 500  # peak below this ≈ silence/noise → leave untouched


def normalize_pcm16(pcm: bytes) -> bytes:
    """Boost quiet 16-bit mono PCM toward a target peak (see module note)."""
    if len(pcm) < 2:
        return pcm
    samples = array.array("h")  # signed 16-bit, native (little-)endian
    samples.frombytes(pcm if len(pcm) % 2 == 0 else pcm[:-1])
    peak = max((abs(s) for s in samples), default=0)
    if peak <= _NOISE_FLOOR_PEAK:
        return pcm
    gain = min(_MAX_GAIN, _TARGET_PEAK / peak)
    if gain <= 1.0:
        return pcm
    for i, s in enumerate(samples):
        v = int(s * gain)
        samples[i] = 32767 if v > 32767 else -32768 if v < -32768 else v
    return samples.tobytes()


@dataclass
class TranscriptSegment:
    text: str
    start_ms: int
    end_ms: int


@dataclass
class LiveTranscriber:
    """One Gemini Live session for one recording attempt.

    Usage:
        async with LiveTranscriber() as t:
            consumer = asyncio.create_task(handle(t.deltas()))
            await t.send_audio(chunk)  # repeatedly
            await t.finish()
    """

    api_key: str | None = None
    live_model: str | None = None
    segments: list[TranscriptSegment] = field(default_factory=list)
    _session: object = None
    _session_cm: object = None
    _recv_task: asyncio.Task | None = None
    _queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    _started_at: float = 0.0
    _last_delta_at_ms: int = 0

    async def __aenter__(self) -> "LiveTranscriber":
        settings = get_settings()
        client = genai.Client(api_key=self.api_key or settings.gemini_api_key)
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=SILENT_LISTENER_INSTRUCTION,
            input_audio_transcription=types.AudioTranscriptionConfig(),
        )
        self._session_cm = client.aio.live.connect(
            model=self.live_model or settings.gemini_live_model, config=config
        )
        self._session = await self._session_cm.__aenter__()
        self._started_at = time.monotonic()
        self._recv_task = asyncio.create_task(self._receive_loop())
        return self

    async def __aexit__(self, *exc) -> None:
        if self._recv_task:
            self._recv_task.cancel()
        if self._session_cm:
            await self._session_cm.__aexit__(*exc)

    async def _receive_loop(self) -> None:
        try:
            # receive() ends at each model turn boundary; loop across turns.
            while True:
                async for message in self._session.receive():
                    sc = message.server_content
                    if sc and sc.input_transcription and sc.input_transcription.text:
                        now_ms = int((time.monotonic() - self._started_at) * 1000)
                        seg = TranscriptSegment(
                            text=sc.input_transcription.text,
                            start_ms=self._last_delta_at_ms,
                            end_ms=now_ms,
                        )
                        self._last_delta_at_ms = now_ms
                        self.segments.append(seg)
                        await self._queue.put(seg)
                    # Stray model output (should be rare) is intentionally discarded.
        except asyncio.CancelledError:
            pass
        except Exception as exc:  # surface Live-API failures to the consumer
            await self._queue.put(exc)
        finally:
            await self._queue.put(None)  # sentinel: stream ended

    async def send_audio(self, pcm_chunk: bytes) -> None:
        await self._session.send_realtime_input(
            audio=types.Blob(data=normalize_pcm16(pcm_chunk), mime_type="audio/pcm;rate=16000")
        )

    async def finish(self, quiet_seconds: float = 1.5, max_wait: float = 15.0) -> None:
        """Signal end of audio, then drain until transcription goes quiet.

        Transcription lags the audio stream, so rather than a fixed sleep we
        wait until no new segments arrive for `quiet_seconds` (capped at
        `max_wait` in case the stream wedges).
        """
        await self._session.send_realtime_input(audio_stream_end=True)
        deadline = time.monotonic() + max_wait
        last_count = len(self.segments)
        quiet_since = time.monotonic()
        while time.monotonic() < deadline:
            await asyncio.sleep(0.3)
            if len(self.segments) != last_count:
                last_count = len(self.segments)
                quiet_since = time.monotonic()
            elif time.monotonic() - quiet_since >= quiet_seconds:
                break
        if self._recv_task:
            self._recv_task.cancel()

    async def deltas(self) -> AsyncIterator[TranscriptSegment]:
        """Yield transcript segments as they arrive; raises if the Live session errors."""
        while True:
            item = await self._queue.get()
            if item is None:
                return
            if isinstance(item, Exception):
                raise item
            yield item

    @property
    def full_text(self) -> str:
        return "".join(s.text for s in self.segments).strip()

    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self._started_at) * 1000) if self._started_at else 0
