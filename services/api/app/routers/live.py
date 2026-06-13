"""WebSocket proxy: phone mic (PCM) → Gemini Live → transcript deltas → phone.

Protocol (client ↔ server):
  client → server  binary frames: raw 16-bit/16 kHz/mono PCM chunks
  client → server  text frames:   {"type": "audio", "data": <base64 PCM>}  (RN-friendly)
                                  {"type": "stop"}
  server → client  {"type": "ready"}
  server → client  {"type": "transcript_delta", "text": str, "start_ms": int, "end_ms": int}
  server → client  {"type": "transcript_final", "full_text": str, "word_count": int}
  server → client  {"type": "error", "detail": str}

On "stop" the server finalizes the transcript, persists it, and closes.
The JWT rides as a query param because RN WebSocket headers are unreliable.
"""

import asyncio
import base64
import json
import uuid

from fastapi import APIRouter, WebSocket
from sqlalchemy import select

from app.auth import verify_token
from app.db import get_session_factory
from app.models import Attempt, Transcript
from app.services.gemini_config import resolve_for_user
from app.services.live_transcriber import LiveTranscriber

router = APIRouter(tags=["live"])


@router.websocket("/ws/live-session")
async def live_session(ws: WebSocket, token: str, attempt_id: uuid.UUID) -> None:
    await ws.accept()

    try:
        user = await verify_token(token)
    except Exception:
        await ws.send_json({"type": "error", "detail": "unauthorized"})
        await ws.close(code=4401)
        return

    factory = get_session_factory()
    async with factory() as db:
        attempt = (
            await db.execute(
                select(Attempt).where(
                    Attempt.id == attempt_id, Attempt.user_id == uuid.UUID(user.id)
                )
            )
        ).scalar_one_or_none()
        if attempt is None or attempt.status != "recording":
            await ws.send_json({"type": "error", "detail": "attempt not found or not recording"})
            await ws.close(code=4404)
            return
        cfg = await resolve_for_user(db, user.id)

    try:
        async with LiveTranscriber(api_key=cfg.api_key, live_model=cfg.live_model) as transcriber:

            async def pump_deltas() -> None:
                async for seg in transcriber.deltas():
                    await ws.send_json(
                        {
                            "type": "transcript_delta",
                            "text": seg.text,
                            "start_ms": seg.start_ms,
                            "end_ms": seg.end_ms,
                        }
                    )

            delta_task = asyncio.create_task(pump_deltas())
            await ws.send_json({"type": "ready"})

            stopped = False
            while not stopped:
                message = await ws.receive()
                if message.get("type") == "websocket.disconnect":
                    break
                if (data := message.get("bytes")) is not None:
                    await transcriber.send_audio(data)
                elif (text := message.get("text")) is not None:
                    control = json.loads(text)
                    if control.get("type") == "audio":
                        await transcriber.send_audio(base64.b64decode(control["data"]))
                    elif control.get("type") == "stop":
                        stopped = True

            await transcriber.finish()
            delta_task.cancel()

            full_text = transcriber.full_text
            if stopped and full_text:
                async with factory() as db:
                    db.add(
                        Transcript(
                            id=uuid.uuid4(),
                            attempt_id=attempt_id,
                            user_id=uuid.UUID(user.id),
                            full_text=full_text,
                            segments=[
                                {"text": s.text, "start_ms": s.start_ms, "end_ms": s.end_ms}
                                for s in transcriber.segments
                            ],
                            word_count=len(full_text.split()),
                            source="gemini_live",
                        )
                    )
                    await db.commit()
                await ws.send_json(
                    {
                        "type": "transcript_final",
                        "full_text": full_text,
                        "word_count": len(full_text.split()),
                    }
                )
            await ws.close()
    except Exception as exc:
        # Client falls back to record-then-upload transcription.
        try:
            await ws.send_json({"type": "error", "detail": str(exc)})
            await ws.close(code=4500)
        except Exception:
            pass
