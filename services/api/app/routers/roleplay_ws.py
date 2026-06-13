"""WebSocket: multi-turn roleplay with an AI persona.

Protocol:
  client → server  {"type":"user_turn_start"}
                   binary PCM frames  OR  {"type":"audio","data":base64}
                   {"type":"user_turn_end"}
                   {"type":"end_conversation"}
  server → client  {"type":"ready"}
                   {"type":"user_delta","text":...}
                   {"type":"persona_delta","text":...}
                   {"type":"persona_turn","text":...,"audio":base64_wav}
                   {"type":"conversation_saved","turn_count":int}
                   {"type":"error","detail":...}

On end_conversation the full multi-turn transcript is persisted and the attempt
moves to `evaluating` (social stage included for roleplay).
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
from app.services.roleplay import RoleplayConductor

router = APIRouter(tags=["roleplay"])


@router.websocket("/ws/roleplay-session")
async def roleplay_session(ws: WebSocket, token: str, attempt_id: uuid.UUID) -> None:
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
        if challenge.mode != "roleplay" or not challenge.persona:
            await ws.send_json({"type": "error", "detail": "challenge is not roleplay"})
            await ws.close(code=4400)
            return
        persona = challenge.persona
        cfg = await resolve_for_user(db, user.id)

    try:
        async with RoleplayConductor(
            persona=persona, api_key=cfg.api_key, live_model=cfg.live_model
        ) as rp:

            async def pump_events() -> None:
                async for kind, payload in rp.events():
                    if kind == "user_delta":
                        await ws.send_json({"type": "user_delta", "text": payload})
                    elif kind == "persona_delta":
                        await ws.send_json({"type": "persona_delta", "text": payload})
                    elif kind == "persona_turn":
                        text, wav = payload
                        await ws.send_json(
                            {
                                "type": "persona_turn",
                                "text": text,
                                "audio": base64.b64encode(wav).decode() if wav else None,
                            }
                        )

            event_task = asyncio.create_task(pump_events())
            await ws.send_json({"type": "ready"})
            await rp.deliver_opener()

            ended = False
            while not ended:
                message = await ws.receive()
                if message.get("type") == "websocket.disconnect":
                    break
                if (data := message.get("bytes")) is not None:
                    await rp.send_audio(data)
                elif (text := message.get("text")) is not None:
                    control = json.loads(text)
                    ctype = control.get("type")
                    if ctype == "user_turn_start":
                        await rp.start_user_turn()
                    elif ctype == "audio":
                        await rp.send_audio(base64.b64decode(control["data"]))
                    elif ctype == "user_turn_end":
                        await rp.end_user_turn()
                    elif ctype == "end_conversation":
                        ended = True

            # Give any final persona audio a moment to flush, then close events.
            await asyncio.sleep(0.5)
            event_task.cancel()

            segments = rp.transcript_segments()
            full_text = rp.full_text()
            if segments:
                async with factory() as db:
                    db.add(
                        Transcript(
                            id=uuid.uuid4(),
                            attempt_id=attempt_id,
                            user_id=uuid.UUID(user.id),
                            full_text=full_text,
                            segments=segments,
                            word_count=len(full_text.split()),
                            turn_count=len(segments),
                            source="gemini_live",
                        )
                    )
                    db_attempt = await db.get(Attempt, attempt_id)
                    db_attempt.status = "evaluating"
                    await db.commit()
                await ws.send_json(
                    {"type": "conversation_saved", "turn_count": len(segments)}
                )
                asyncio.create_task(run_evaluation(attempt_id))
            await ws.close()
    except Exception as exc:
        try:
            await ws.send_json({"type": "error", "detail": str(exc)})
            await ws.close(code=4500)
        except Exception:
            pass
