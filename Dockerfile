FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md README.fa.md ./
COPY src ./src
COPY fonts ./fonts

RUN pip install --no-cache-dir -e ".[dev]"

ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:///./data/pagezy.db

RUN mkdir -p /app/data /app/exports

CMD ["python", "-m", "pagezy_bot.main"]