"""Evaluation prompt assembly: base rubric + challenge context + user profile."""

from app.models import Challenge, Profile

BASE_RUBRIC = """\
You are Veritas, an expert communication coach. You evaluate a spoken practice \
attempt on THREE INDEPENDENT stages. A speaker can score high on one stage and \
low on another — judge each in isolation. Scores are 1.0–10.0 with one decimal.

Anchors: 2 = seriously deficient · 4 = below par, clear gaps · 6 = competent \
but unremarkable · 8 = strong, minor flaws · 9.5 = exceptional. Use the full \
range; do not cluster around 7. The transcript is verbatim speech-to-text: \
ignore transcription artifacts (missing punctuation, homophone errors) and do \
not penalize Delivery for them.

STAGE 1 — THOUGHT (quality of the underlying ideas)
Dimensions: logic, reasoning, depth, insight, completeness, originality.

STAGE 2 — STRUCTURE (organization of those ideas)
Dimensions: organization, flow, hierarchy, transitions, redundancy (higher = \
less redundant), completeness (opening/body/close).

STAGE 3 — DELIVERY (expression in language)
Dimensions: clarity, vocabulary, confidence, persuasion, pacing, engagement, \
conciseness. Judge pacing/confidence from textual evidence: filler words, \
hedging, false starts, run-ons, sentence rhythm.

Then produce:
- diagnosis: the single most useful cross-stage insight for this speaker
- strengths / weaknesses: concrete, citing the transcript
- best_sentence / worst_sentence: verbatim sentences with reasons
- suggested_rewrite: rewrite the weakest section in the speaker's own voice
- retry_challenge: ONE specific instruction for their next attempt
- detections: anti-patterns actually present (rambling, jargon, tangents, \
defensiveness, weak_arguments, circular_logic, overexplaining, filler_heavy)

Be honest and specific. Generic praise is useless to the speaker."""


def challenge_context(challenge: Challenge) -> str:
    parts = [
        f"CHALLENGE ({challenge.category}, {challenge.difficulty}): {challenge.title}",
        f"PROMPT GIVEN TO SPEAKER: {challenge.prompt}",
        f"Time allowed: {challenge.max_speak_seconds}s with {challenge.prep_seconds}s preparation.",
    ]
    if challenge.framework:
        framework_specs = {
            "prep": "PREP (Point, Reason, Example, Point)",
            "star": "STAR (Situation, Task, Action, Result)",
            "scientific": "Scientific (Problem, Gap, Method, Result, Impact)",
            "story": "Story arc (Context, Conflict, Resolution, Lesson)",
            "pyramid": "Pyramid Principle (conclusion first, evidence after)",
        }
        parts.append(
            f"The speaker was asked to use the {framework_specs[challenge.framework]} framework. "
            "Weight Structure scoring heavily on framework adherence: are all components "
            "present, identifiable, and in order?"
        )
    if challenge.evaluation_focus:
        parts.append(f"Evaluation emphasis (stage → dimension weights): {challenge.evaluation_focus}")
    return "\n".join(parts)


def speaker_context(profile: Profile | None) -> str:
    if profile is None:
        return ""
    parts = ["SPEAKER PROFILE (calibrate feedback tone and examples to this person):"]
    if profile.profession:
        parts.append(f"- Profession: {profile.profession}" + (f" ({profile.industry})" if profile.industry else ""))
    if profile.goals:
        parts.append(f"- Goals: {', '.join(profile.goals)}")
    if profile.weaknesses:
        parts.append(f"- Self-reported weaknesses (watch for these): {', '.join(profile.weaknesses)}")
    if profile.speaking_confidence:
        parts.append(f"- Self-rated speaking confidence: {profile.speaking_confidence}/5")
    return "\n".join(parts)


def build_evaluation_prompt(
    challenge: Challenge, profile: Profile | None, transcript: str, duration_seconds: float | None
) -> str:
    duration_note = (
        f"\nActual speaking time: {duration_seconds:.0f}s." if duration_seconds else ""
    )
    return (
        f"{challenge_context(challenge)}\n\n"
        f"{speaker_context(profile)}\n\n"
        f"TRANSCRIPT OF THE ATTEMPT:{duration_note}\n"
        f'"""\n{transcript}\n"""'
    )
