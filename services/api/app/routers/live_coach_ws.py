"""WebSocket: Live Coach — real-time delivery coaching during free practice.

Transcribes like /ws/live-session, but also runs a real-time coach over the
transcript stream, pushing nudges + live meters. On stop it persists the
transcript and runs the normal evaluation (so it feeds analytics + memory).

Protocol:
  client → server  binary PCM frames OR {"type":"audio","data":base64}
                   {"type":"stop"}
  server → client  {"type":"ready"}
                   {"type":"transcript_delta","text":...}
                   {"type":"nudge","kind":...,"text":...}
                   {"type":"meters","pacing":int,"clarity":int,"confidence":int,"wpm":..}
                   {"type":"coach_summary", ...}
                   {"type":"error","detail":...}
"""

import asyncio
import base64
import json
import uuid

from fastapi import APIRouter, WebSocket
from sqlalchemy import select

from app.auth import verify_token
from app.db import get_session_factory
from app.models import Attempt, Challenge, Session, Transcript
from app.services.evaluator import run_evaluation
from app.services.gemini_config import resolve_for_user
from app.services.live_coach import LiveCoach
from app.services.live_transcriber import LiveTranscriber

router = APIRouter(tags=["live-coach"])


@router.websocket("/ws/live-coach")
async def live_coach_session(ws: WebSocket, token: str, attempt_id: uuid.UUID) -> None:
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
        session = await db.get(Session, attempt.session_id)
        challenge = await db.get(Challenge, session.challenge_id)
        slug = challenge.slug
        cfg = await resolve_for_user(db, user.id)

    coach = LiveCoach(challenge_slug=slug)

    try:
        async with LiveTranscriber(api_key=cfg.api_key, live_model=cfg.live_model) as transcriber:

            async def pump_deltas() -> None:
                async for seg in transcriber.deltas():
                    await ws.send_json({"type": "transcript_delta", "text": seg.text})
                    for nudge in coach.on_delta(seg.text, seg.end_ms):
                        await ws.send_json({"type": "nudge", **nudge})

            async def pump_meters() -> None:
                # Live meters on a steady cadence, independent of speech bursts.
                while True:
                    await asyncio.sleep(2.0)
                    await ws.send_json(
                        {"type": "meters", **coach.meters(transcriber.elapsed_ms())}
                    )

            delta_task = asyncio.create_task(pump_deltas())
            meter_task = asyncio.create_task(pump_meters())
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
            meter_task.cancel()

            full_text = transcriber.full_text
            await ws.send_json({"type": "coach_summary", **coach.summary()})

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
                    db_attempt = await db.get(Attempt, attempt_id)
                    db_attempt.status = "evaluating"
                    if attempt.duration_seconds is None:
                        db_attempt.duration_seconds = transcriber.elapsed_ms() / 1000
                    await db.commit()
                asyncio.create_task(run_evaluation(attempt_id))
            await ws.close()
    except Exception as exc:
        try:
            await ws.send_json({"type": "error", "detail": str(exc)})
            await ws.close(code=4500)
        except Exception:
            pass
