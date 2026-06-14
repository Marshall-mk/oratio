# oratio FastAPI backend. Works on any host that runs containers + WebSockets
# (Railway, Render, Fly.io, etc.).
FROM python:3.12-slim

# uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install deps first for layer caching
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project

# App code
COPY app ./app

ENV PORT=8000
# Shell form so $PORT (injected by the host) is expanded
CMD uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
