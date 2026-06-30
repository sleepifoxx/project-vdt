from __future__ import annotations

import logging
from fastembed import TextEmbedding
from app.config import settings

logger = logging.getLogger(__name__)

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        logger.info("Loading embedding model: %s", settings.embedding_model)
        _model = TextEmbedding(settings.embedding_model)
        logger.info("Embedding model loaded")
    return _model


def embed_query(text: str) -> list[float]:
    """Embed a user search query. e5 models require 'query: ' prefix."""
    return list(next(iter(_get_model().embed([f"query: {text}"]))))


def embed_passages(texts: list[str]) -> list[list[float]]:
    """Embed document passages for indexing. e5 models require 'passage: ' prefix."""
    prefixed = [f"passage: {t}" for t in texts]
    return [list(v) for v in _get_model().embed(prefixed)]
