"""The communication twin: embed each attempt as memory, retrieve to personalize.

Uses pgvector for similarity. All operations are best-effort — a failure here
must never block an evaluation, so callers wrap in try/except.
"""

import logging
import uuid

from google import genai
from google.genai import types
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

logger = logging.getLogger(__name__)

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768


async def _embed(content: str, task_type: str) -> list[float]:
    client = genai.Client(api_key=get_settings().gemini_api_key)
    resp = await client.aio.models.embed_content(
        model=EMBED_MODEL,
        contents=content,
        config=types.EmbedContentConfig(
            output_dimensionality=EMBED_DIM, task_type=task_type
        ),
    )
    return list(resp.embeddings[0].values)


async def store_memory(
    db: AsyncSession, user_id: uuid.UUID, attempt_id: uuid.UUID, summary: str
) -> None:
    embedding = await _embed(summary, "RETRIEVAL_DOCUMENT")
    vec = "[" + ",".join(str(x) for x in embedding) + "]"
    await db.execute(
        sql_text(
            "insert into memory_embeddings (id, user_id, attempt_id, summary, embedding) "
            "values (:id, :uid, :aid, :summary, :emb)"
        ),
        {
            "id": str(uuid.uuid4()),
            "uid": str(user_id),
            "aid": str(attempt_id),
            "summary": summary,
            "emb": vec,
        },
    )
    await db.commit()


async def retrieve_memories(
    db: AsyncSession, user_id: uuid.UUID, query: str, k: int = 5
) -> list[str]:
    """Return up to k past memory summaries most relevant to the current challenge."""
    try:
        embedding = await _embed(query, "RETRIEVAL_QUERY")
    except Exception:
        logger.exception("memory query embedding failed")
        return []
    vec = "[" + ",".join(str(x) for x in embedding) + "]"
    rows = (
        await db.execute(
            sql_text(
                "select summary from memory_embeddings where user_id = :uid "
                "order by embedding <=> :emb limit :k"
            ),
            {"uid": str(user_id), "emb": vec, "k": k},
        )
    ).all()
    return [r[0] for r in rows]
