from pydantic import BaseModel, Field

# ---- Gemini structured-output schemas ----


class Definition(BaseModel):
    term: str
    meaning: str


class ArgumentNode(BaseModel):
    claim: str
    support: str = Field(description="The evidence or reasoning given for this claim")


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=3, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str


class ReadingPack(BaseModel):
    summary: str = Field(description="A tight 3-5 sentence summary")
    definitions: list[Definition] = Field(min_length=2, max_length=8)
    key_ideas: list[str] = Field(min_length=2, max_length=6)
    argument_map: list[ArgumentNode] = Field(min_length=1, max_length=6)
    quiz: list[QuizQuestion] = Field(min_length=4, max_length=6)


class VocabChange(BaseModel):
    original: str
    replacement: str
    reason: str


class VocabResult(BaseModel):
    improved: str = Field(description="The rewritten/upgraded version of the user's text")
    vocabulary_score: float = Field(ge=1.0, le=10.0, description="Quality of the user's ORIGINAL text")
    changes: list[VocabChange] = Field(min_length=1, max_length=8)
    feedback: str


# ---- API request/response ----


class ReadingCreate(BaseModel):
    source_title: str | None = None
    source_text: str | None = None
    pdf_base64: str | None = None  # alternative to source_text


class ReadingSubmit(BaseModel):
    answers: list[int]  # selected option index per quiz question


class VocabularyCreate(BaseModel):
    subtype: str  # word_upgrade | sentence_upgrade | academic_rewrite | ...
    source_text: str


class TextExerciseOut(BaseModel):
    id: str
    kind: str
    subtype: str
    source_title: str | None
    source_text: str
    content: dict | None
    submission: dict | None
    score: float | None
    feedback: dict | None
    status: str
    created_at: str
