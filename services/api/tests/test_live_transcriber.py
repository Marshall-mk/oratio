"""PcmAutoGain tests: boost speech, never noise.

The AGC exists for genuinely quiet capture (iOS Simulator). On real devices it
must be a no-op — and critically it must never amplify pause/room-tone chunks,
which Gemini transcribes as hallucinated words.
"""

import array
import math

from app.services.live_transcriber import _MAX_GAIN, PcmAutoGain


def make_chunk(amplitude: int, n: int = 4000, freq: float = 200.0) -> bytes:
    """A 16-bit mono sine chunk (250 ms at 16 kHz by default)."""
    samples = array.array(
        "h", (int(amplitude * math.sin(2 * math.pi * freq * i / 16000)) for i in range(n))
    )
    return samples.tobytes()


def peak_of(pcm: bytes) -> int:
    samples = array.array("h")
    samples.frombytes(pcm)
    return max(abs(s) for s in samples)


def test_room_tone_never_boosted() -> None:
    """Chunks near the session's noise floor pass through byte-identical."""
    agc = PcmAutoGain()
    tone = make_chunk(amplitude=800)  # steady room tone / breath level
    for _ in range(20):
        assert agc.process(tone) == tone


def test_quiet_speech_over_quiet_floor_is_boosted() -> None:
    """After hearing a quiet floor, clearly-louder chunks (speech) get gain."""
    agc = PcmAutoGain()
    for _ in range(4):
        agc.process(make_chunk(amplitude=100))  # simulator-quiet background
    speech = make_chunk(amplitude=2000)
    out = agc.process(speech)
    assert peak_of(out) > peak_of(speech)
    assert peak_of(out) <= peak_of(speech) * _MAX_GAIN + 1


def test_loud_speech_untouched() -> None:
    """Device-level speech is already loud: gain <= 1 → exact passthrough."""
    agc = PcmAutoGain()
    agc.process(make_chunk(amplitude=600))  # establish a floor
    loud = make_chunk(amplitude=25000)
    assert agc.process(loud) == loud


def test_pause_after_speech_not_amplified() -> None:
    """The failure mode from the field: pauses between phrases must stay quiet."""
    agc = PcmAutoGain()
    agc.process(make_chunk(amplitude=500))  # room tone establishes the floor
    agc.process(make_chunk(amplitude=12000))  # a spoken phrase
    pause = make_chunk(amplitude=900)  # breath / trailing noise
    assert agc.process(pause) == pause


def test_digital_silence_passthrough() -> None:
    agc = PcmAutoGain()
    silence = b"\x00\x00" * 4000
    assert agc.process(silence) == silence
    assert agc.process(b"") == b""
