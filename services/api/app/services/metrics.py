"""Deterministic per-attempt communication metrics, computed from the transcript."""

import re

FILLERS = [
    "um", "uh", "er", "ah", "like", "you know", "i mean", "sort of", "kind of",
    "basically", "actually", "literally", "so yeah", "right",
]


def _syllables(word: str) -> int:
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word:
        return 0
    groups = re.findall(r"[aeiouy]+", word)
    count = len(groups)
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def compute_metrics(
    text: str, duration_seconds: float | None, segments: list[dict] | None = None
) -> dict:
    """Return a metrics dict for one attempt. Pause stats need live segments."""
    words = re.findall(r"[A-Za-z']+", text)
    word_count = len(words)
    lower = text.lower()

    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    sentence_count = max(len(sentences), 1)

    unique = {w.lower() for w in words}
    filler_count = sum(lower.count(f) for f in FILLERS)
    syllable_total = sum(_syllables(w) for w in words)

    wpm = None
    if duration_seconds and duration_seconds > 0:
        wpm = round(word_count / (duration_seconds / 60), 1)

    avg_sentence_length = round(word_count / sentence_count, 1)

    reading_ease = None
    if word_count > 0:
        # Flesch reading ease (approx; higher = easier).
        reading_ease = round(
            206.835
            - 1.015 * (word_count / sentence_count)
            - 84.6 * (syllable_total / word_count),
            1,
        )

    # Pause distribution: gaps > 2s between consecutive live transcript segments.
    long_pause_count = 0
    if segments:
        for prev, nxt in zip(segments, segments[1:]):
            gap = (nxt.get("start_ms", 0) or 0) - (prev.get("end_ms", 0) or 0)
            if gap > 2000:
                long_pause_count += 1

    return {
        "words": word_count,
        "duration_seconds": round(duration_seconds, 1) if duration_seconds else None,
        "wpm": wpm,
        "unique_words": len(unique),
        "unique_ratio": round(len(unique) / word_count, 3) if word_count else None,
        "avg_sentence_length": avg_sentence_length,
        "filler_count": filler_count,
        "filler_rate": round(filler_count / word_count * 100, 1) if word_count else None,
        "question_count": text.count("?"),
        "reading_ease": reading_ease,
        "long_pause_count": long_pause_count,
    }
