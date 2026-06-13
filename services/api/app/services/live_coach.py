"""Real-time delivery coach: runs over the live transcript stream and emits
nudges + live meters. Pure/deterministic and cheap (no per-delta LLM calls)."""

import re
from dataclasses import dataclass, field

from app.services.metrics import FILLERS

# Per-mode thresholds. Interviews/meetings reward concision; presentations care
# most about pacing; research defense tolerates a slower, denser delivery.
MODE_TUNING = {
    "coach-presentation": {"wpm_high": 175, "ramble_s": 22},
    "coach-interview": {"wpm_high": 185, "ramble_s": 16},
    "coach-meeting": {"wpm_high": 185, "ramble_s": 16},
    "coach-research-defense": {"wpm_high": 165, "ramble_s": 26},
}
DEFAULT_TUNING = {"wpm_high": 180, "ramble_s": 20}

NUDGE_COOLDOWN_MS = 9000  # min gap between nudges of the same kind
WPM_WINDOW_MS = 12000
FILLER_WINDOW_MS = 15000
IDEAL_WPM = (120, 160)


@dataclass
class LiveCoach:
    challenge_slug: str = ""
    _tuning: dict = field(default_factory=dict)
    _words: list[tuple[int, int]] = field(default_factory=list)  # (t_ms, word_count)
    _fillers: list[int] = field(default_factory=list)  # filler timestamps
    _last_sentence_end_ms: int = 0
    _last_nudge: dict[str, int] = field(default_factory=dict)
    # running totals for the end-of-session summary
    total_words: int = 0
    total_fillers: int = 0
    nudge_count: int = 0
    _wpm_samples: list[float] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._tuning = MODE_TUNING.get(self.challenge_slug, DEFAULT_TUNING)

    def on_delta(self, text: str, now_ms: int) -> list[dict]:
        """Ingest a transcript delta; return any nudges to push."""
        words = re.findall(r"[A-Za-z']+", text)
        if words:
            self._words.append((now_ms, len(words)))
            self.total_words += len(words)
        lower = text.lower()
        for f in FILLERS:
            for _ in range(lower.count(f)):
                self._fillers.append(now_ms)
                self.total_fillers += 1
        if re.search(r"[.!?]", text):
            self._last_sentence_end_ms = now_ms

        self._trim(now_ms)
        return self._detect(now_ms)

    def _trim(self, now_ms: int) -> None:
        self._words = [(t, c) for t, c in self._words if now_ms - t <= WPM_WINDOW_MS]
        self._fillers = [t for t in self._fillers if now_ms - t <= FILLER_WINDOW_MS]

    def _current_wpm(self, now_ms: int) -> float | None:
        if len(self._words) < 2:
            return None
        span_ms = now_ms - self._words[0][0]
        if span_ms < 4000:
            return None
        words = sum(c for _, c in self._words)
        return round(words / (span_ms / 60000), 0)

    def _can_nudge(self, kind: str, now_ms: int) -> bool:
        return now_ms - self._last_nudge.get(kind, -NUDGE_COOLDOWN_MS) >= NUDGE_COOLDOWN_MS

    def _emit(self, kind: str, text: str, now_ms: int) -> dict:
        self._last_nudge[kind] = now_ms
        self.nudge_count += 1
        return {"kind": kind, "text": text}

    def _detect(self, now_ms: int) -> list[dict]:
        nudges: list[dict] = []
        wpm = self._current_wpm(now_ms)
        if wpm is not None:
            self._wpm_samples.append(wpm)
            if wpm > self._tuning["wpm_high"] and self._can_nudge("pace", now_ms):
                nudges.append(self._emit("pace", "Slow down a touch — breathe.", now_ms))

        if len(self._fillers) >= 3 and self._can_nudge("filler", now_ms):
            nudges.append(self._emit("filler", "Watch the filler words.", now_ms))

        # Rambling: long stretch of speech without landing a sentence.
        since_sentence = now_ms - self._last_sentence_end_ms
        if (
            self.total_words > 25
            and since_sentence > self._tuning["ramble_s"] * 1000
            and self._can_nudge("ramble", now_ms)
        ):
            nudges.append(self._emit("ramble", "Land your point — wrap this thought.", now_ms))
        return nudges

    def meters(self, now_ms: int) -> dict:
        """Heuristic 0-100 live meters."""
        wpm = self._current_wpm(now_ms)
        # Pacing: full marks inside the ideal band, dropping off outside it.
        if wpm is None:
            pacing = 70
        elif IDEAL_WPM[0] <= wpm <= IDEAL_WPM[1]:
            pacing = 100
        else:
            dist = IDEAL_WPM[0] - wpm if wpm < IDEAL_WPM[0] else wpm - IDEAL_WPM[1]
            pacing = max(20, 100 - dist)
        # Clarity: fewer recent fillers = clearer.
        clarity = max(20, 100 - len(self._fillers) * 18)
        # Confidence: blend of steady pace + low filler.
        confidence = round(0.6 * pacing + 0.4 * clarity)
        return {
            "pacing": int(pacing),
            "clarity": int(clarity),
            "confidence": int(confidence),
            "wpm": wpm,
        }

    def summary(self) -> dict:
        avg_wpm = round(sum(self._wpm_samples) / len(self._wpm_samples), 0) if self._wpm_samples else None
        return {
            "total_words": self.total_words,
            "total_fillers": self.total_fillers,
            "avg_wpm": avg_wpm,
            "nudges": self.nudge_count,
        }
