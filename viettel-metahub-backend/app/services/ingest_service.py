"""
Ingest all DataHub entities into Qdrant for AI (vector) search.

Flow:
  1. Fetch all entities from DataHub (paginated, wildcard query)
  2. Build embedding text: name + type + platform + description + tags
  3. Batch-embed with multilingual-e5-base (Vietnamese & English)
  4. Upsert into Qdrant collection
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any

from app.services.datahub_client import DataHubClient
from app.services.embedding_service import embed_passages
from app.services import vector_store

logger = logging.getLogger(__name__)

_ALL_TYPES = ["DATASET", "DASHBOARD", "CHART", "DATA_FLOW", "DATA_JOB", "CORP_USER", "CORP_GROUP"]
_PAGE_SIZE = 200
_EMBED_BATCH = 50


def _urn_to_id(urn: str) -> int:
    """Stable numeric point ID from URN using MD5."""
    return int(hashlib.md5(urn.encode()).hexdigest()[:15], 16)


def _entity_text(entity: dict[str, Any]) -> str:
    """Build a rich text representation for embedding (bilingual-friendly)."""
    parts: list[str] = []

    name = (
        entity.get("name")
        or (entity.get("properties") or {}).get("name")
        or (entity.get("properties") or {}).get("displayName")
        or entity.get("username")
        or ""
    )
    if name:
        parts.append(name)

    etype = entity.get("type", "")
    if etype:
        parts.append(etype)

    platform = (entity.get("platform") or {}).get("name", "")
    if platform:
        parts.append(platform)

    desc = (
        (entity.get("properties") or {}).get("description")
        or (entity.get("editableProperties") or {}).get("description")
        or (entity.get("properties") or {}).get("displayName")
        or ""
    )
    if desc:
        parts.append(desc[:500])

    for tag_wrap in (entity.get("tags") or {}).get("tags", []):
        tag_name = (tag_wrap.get("tag") or {}).get("name", "")
        if tag_name:
            parts.append(tag_name)

    domain_name = (
        ((entity.get("domain") or {}).get("domain") or {})
        .get("properties", {})
        .get("name", "")
    )
    if domain_name:
        parts.append(domain_name)

    return " ".join(parts)


def _process_batch(raw: list[dict[str, Any]]) -> int:
    entities = [r["entity"] for r in raw]
    texts = [_entity_text(e) for e in entities]

    try:
        vectors = embed_passages(texts)
    except Exception as exc:
        logger.error("Embedding batch failed: %s", exc)
        return 0

    points: list[dict] = []
    for entity, vec in zip(entities, vectors):
        urn = entity.get("urn", "")
        if not urn:
            continue
        points.append({"id": _urn_to_id(urn), "vector": vec, "payload": entity})

    if not points:
        return 0

    try:
        vector_store.upsert(points)
    except Exception as exc:
        logger.error("Qdrant upsert failed: %s", exc)
        return 0

    return len(points)


async def ingest_all(client: DataHubClient) -> int:
    """Index ALL entities from DataHub into Qdrant (no platform filter)."""
    try:
        vector_store.ensure_collection()
    except Exception as exc:
        logger.error("Qdrant unreachable, skipping ingest: %s", exc)
        return 0

    total_ingested = 0
    start = 0

    while True:
        try:
            result = await client.search(
                query="*", entity_types=_ALL_TYPES, start=start, count=_PAGE_SIZE,
            )
        except Exception as exc:
            logger.error("DataHub fetch failed (start=%d): %s", start, exc)
            break

        raw = result.get("searchResults", [])
        if not raw:
            break

        for i in range(0, len(raw), _EMBED_BATCH):
            total_ingested += _process_batch(raw[i : i + _EMBED_BATCH])

        server_total = result.get("total", 0)
        start += _PAGE_SIZE
        if start >= server_total:
            break

    logger.info("Ingest complete: %d total entities indexed", total_ingested)
    return total_ingested


async def ingest_by_platform(client: DataHubClient, platform: str) -> int:
    """Re-index all entities belonging to a specific platform into Qdrant."""
    try:
        vector_store.ensure_collection()
    except Exception as exc:
        logger.error("Qdrant unreachable, skipping ingest: %s", exc)
        return 0

    platform_urn = platform if platform.startswith("urn:") else f"urn:li:dataPlatform:{platform}"
    filters = [{"field": "platform", "values": [platform_urn]}]

    total_ingested = 0
    start = 0

    while True:
        try:
            result = await client.search(
                query="*", entity_types=_ALL_TYPES, start=start, count=_PAGE_SIZE,
                filters=filters,
            )
        except Exception as exc:
            logger.error("DataHub fetch failed (platform=%s, start=%d): %s", platform, start, exc)
            break

        raw = result.get("searchResults", [])
        if not raw:
            break

        for i in range(0, len(raw), _EMBED_BATCH):
            total_ingested += _process_batch(raw[i : i + _EMBED_BATCH])

        server_total = result.get("total", 0)
        start += _PAGE_SIZE
        if start >= server_total:
            break

    logger.info("Ingest complete: %d entities indexed for platform=%s", total_ingested, platform)
    return total_ingested
