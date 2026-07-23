"""Roleplay conductor: a persistent Gemini Live session that responds in character.

Unlike LiveTranscriber (silent listener), this drives a multi-turn conversation:
the user speaks a turn (manual activity boundaries — no server VAD barge-in), the
persona responds with audio + transcription. Validated by scripts/roleplay_spike.py.

Turn boundaries are explicit so a mid-sentence pause never triggers the persona.
"""

import asyncio
import io
import wave
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from google import genai
from google.genai import types

from app.config import get_settings

PERSONA_AUDIO_RATE = 24000  # Gemini Live output PCM sample rate


def pcm_to_wav(pcm: bytes, rate: int = PERSONA_AUDIO_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm)
    return buf.getvalue()


@dataclass
class ConversationTurn:
    role: str  # 'user' | 'persona'
    text: str


@dataclass
class RoleplayConductor:
    persona: dict  # {name, voice, instruction, opener}
    api_key: str | None = None
    live_model: str | None = None
    turns: list[ConversationTurn] = field(default_factory=list)
    _session: object = None
    _session_cm: object = None
    _recv_task: asyncio.Task | None = None
    _events: asyncio.Queue = field(default_factory=asyncio.Queue)
    # accumulators for the in-progress turn
    _user_buf: list[str] = field(default_factory=list)
    _persona_buf: list[str] = field(default_factory=list)
    _persona_audio: bytearray = field(default_factory=bytearray)

    async def __aenter__(self) -> "RoleplayConductor":
        settings = get_settings()
        client = genai.Client(api_key=self.api_key or settings.gemini_api_key)
        speech = None
        if voice := self.persona.get("voice"):
            speech = types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                )
            )
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=self.persona["instruction"],
            # No language_codes: the parameter is enterprise-platform-only;
            # the persona instruction already fixes the conversation language.
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            speech_config=speech,
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(disabled=True),
            ),
        )
        self._session_cm = client.aio.live.connect(
            model=self.live_model or settings.gemini_live_model, config=config
        )
        self._session = await self._session_cm.__aenter__()
        self._recv_task = asyncio.create_task(self._receive_loop())
        return self

    async def __aexit__(self, *exc) -> None:
        if self._recv_task:
            self._recv_task.cancel()
        if self._session_cm:
            await self._session_cm.__aexit__(*exc)

    async def _receive_loop(self) -> None:
        try:
            while True:
                async for message in self._session.receive():
                    sc = message.server_content
                    if not sc:
                        continue
                    if sc.input_transcription and sc.input_transcription.text:
                        self._user_buf.append(sc.input_transcription.text)
                        await self._events.put(
                            ("user_delta", sc.input_transcription.text)
                        )
                    if sc.output_transcription and sc.output_transcription.text:
                        self._persona_buf.append(sc.output_transcription.text)
                        await self._events.put(
                            ("persona_delta", sc.output_transcription.text)
                        )
                    if sc.model_turn:
                        for part in sc.model_turn.parts or []:
                            if part.inline_data and part.inline_data.data:
                                self._persona_audio.extend(part.inline_data.data)
                    if sc.turn_complete:
                        # Finalize the user's turn HERE, not in end_user_turn:
                        # input transcription lags the audio, so by the time the
                        # persona's turn completes all the user's deltas have
                        # arrived and land correctly ordered before the reply.
                        user_text = "".join(self._user_buf).strip()
                        if user_text:
                            self.turns.append(ConversationTurn("user", user_text))
                        self._user_buf.clear()
                        persona_text = "".join(self._persona_buf).strip()
                        if persona_text:
                            self.turns.append(ConversationTurn("persona", persona_text))
                        wav = (
                            pcm_to_wav(bytes(self._persona_audio))
                            if self._persona_audio
                            else b""
                        )
                        await self._events.put(("persona_turn", (persona_text, wav)))
                        self._persona_buf.clear()
                        self._persona_audio.clear()
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            await self._events.put(("error", exc))
        finally:
            await self._events.put(("closed", None))

    async def deliver_opener(self) -> None:
        """Make the persona speak first, setting the scene."""
        await self._session.send_client_content(
            turns=types.Content(
                role="user",
                parts=[
                    types.Part(
                        text="Begin the scene now. Say your opening line to start the conversation."
                    )
                ],
            ),
            turn_complete=True,
        )

    async def start_user_turn(self) -> None:
        self._user_buf.clear()
        await self._session.send_realtime_input(activity_start=types.ActivityStart())

    async def send_audio(self, pcm_chunk: bytes) -> None:
        await self._session.send_realtime_input(
            audio=types.Blob(data=pcm_chunk, mime_type="audio/pcm;rate=16000")
        )

    async def end_user_turn(self) -> None:
        """Close the user's turn; the persona will respond. The user turn text
        is finalized at the persona's turn_complete (see _receive_loop), once
        all of the user's input-transcription deltas have arrived."""
        await self._session.send_realtime_input(activity_end=types.ActivityEnd())

    async def events(self) -> AsyncIterator[tuple[str, object]]:
        while True:
            kind, payload = await self._events.get()
            if kind == "closed":
                return
            if kind == "error":
                raise payload  # type: ignore[misc]
            yield kind, payload

    def transcript_segments(self) -> list[dict]:
        return [
            {"role": t.role, "text": t.text, "turn": i} for i, t in enumerate(self.turns)
        ]

    def full_text(self) -> str:
        return "\n".join(f"{t.role.upper()}: {t.text}" for t in self.turns)
