from __future__ import annotations

import logging
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

from app.config import settings

logger = logging.getLogger(__name__)

VECTOR_SIZE = 1024  # intfloat/multilingual-e5-large output dimension

_client: QdrantClient | None = None


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.qdrant_url)
    return _client


def ensure_collection() -> None:
    client = _get_client()
    existing = {c.name for c in client.get_collections().collections}
    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection: %s", settings.qdrant_collection)


def upsert(points: list[dict]) -> None:
    """points: list of {id: int, vector: list[float], payload: dict}"""
    _get_client().upsert(
        collection_name=settings.qdrant_collection,
        points=[
            PointStruct(id=p["id"], vector=p["vector"], payload=p["payload"])
            for p in points
        ],
    )


def search(query_vector: list[float], top_k: int = 20, score_threshold: float | None = None) -> list[dict]:
    results = _get_client().search(
        collection_name=settings.qdrant_collection,
        query_vector=query_vector,
        limit=top_k,
        with_payload=True,
        score_threshold=score_threshold,
    )
    return [{"score": r.score, "payload": r.payload} for r in results]


def count() -> int:
    try:
        return _get_client().count(collection_name=settings.qdrant_collection).count
    except Exception:
        return 0
