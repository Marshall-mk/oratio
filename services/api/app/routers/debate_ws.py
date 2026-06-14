"""WebSocket: transcribe one debate turn (reuses the live transcriber)."""

import asyncio
import base64
import json
import uuid

from fastapi import APIRouter, WebSocket
from sqlalchemy import select

from app.auth import verify_token
from app.db import get_session_factory
from app.models import Debate, DebateTurn
from app.services.gemini_config import resolve_for_user
from app.services.live_transcriber import LiveTranscriber

router = APIRouter(tags=["debate"])


@router.websocket("/ws/debate-turn")
async def debate_turn(
    ws: WebSocket, token: str, debate_id: uuid.UUID, participant: str, round: int = 1
) -> None:
    await ws.accept()
    try:
        user = await verify_token(token)
    except Exception:
        await ws.send_json({"type": "error", "detail": "unauthorized"})
        await ws.close(code=4401)
        return

    factory = get_session_factory()
    async with factory() as db:
        debate = (
            await db.execute(
                select(Debate).where(Debate.id == debate_id, Debate.user_id == uuid.UUID(user.id))
            )
        ).scalar_one_or_none()
        if debate is None or debate.status != "in_progress":
            await ws.send_json({"type": "error", "detail": "debate not found or finished"})
            await ws.close(code=4404)
            return
        cfg = await resolve_for_user(db, user.id)

    try:
        async with LiveTranscriber(api_key=cfg.api_key, live_model=cfg.live_model) as transcriber:

            async def pump() -> None:
                async for seg in transcriber.deltas():
                    await ws.send_json({"type": "transcript_delta", "text": seg.text})

            delta_task = asyncio.create_task(pump())
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
            if stopped:
                async with factory() as db:
                    db.add(
                        DebateTurn(
                            id=uuid.uuid4(),
                            debate_id=debate_id,
                            user_id=uuid.UUID(user.id),
                            participant=participant,
                            round=round,
                            transcript=full_text,
                        )
                    )
                    await db.commit()
                await ws.send_json({"type": "turn_saved", "transcript": full_text})
            await ws.close()
    except Exception as exc:
        try:
            await ws.send_json({"type": "error", "detail": str(exc)})
            await ws.close(code=4500)
        except Exception:
            pass
