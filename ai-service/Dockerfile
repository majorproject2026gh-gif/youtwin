FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .

# sentence-transformers depends on torch, and a plain `pip install` on
# Linux resolves the CUDA-enabled build by default — several GB of
# NVIDIA runtime libraries this service never touches (this host is
# CPU-only), that still get mapped into memory once loaded. That's a
# large, avoidable slice of a memory-constrained free-tier container.
# Installing the CPU-only wheel first satisfies sentence-transformers'
# torch requirement below without ever pulling the CUDA build.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm

# Bake the embedding model (M3) into the image. Otherwise every fresh
# container (each Render deploy / restart) downloads it from Hugging Face
# on the first question, which is slow and fails if HF is unreachable.
# Keep the name in sync with EMBEDDING_MODEL (app/config.py).
ENV HF_HOME=/opt/hf
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"
COPY . .

# Running as non-root is good practice regardless of host. The model
# cache stays writable so a different EMBEDDING_MODEL can still download.
RUN useradd -m -u 1000 appuser && chown -R appuser /opt/hf
USER appuser
ENV HOME=/home/appuser

# Render (and most PaaS Docker hosts) inject a PORT env var at runtime
# and expect the container to bind to it dynamically — they do NOT use
# a fixed port. This must be shell form (not the JSON-array exec form)
# specifically so $PORT actually gets expanded; exec form bypasses the
# shell entirely and would pass the literal string "$PORT" to uvicorn.
# Defaults to 8000 for local `docker run` testing where PORT isn't set.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
