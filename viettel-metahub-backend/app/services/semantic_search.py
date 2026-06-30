from typing import Any

from app.config import settings
from app.services.datahub_client import DataHubClient


_SYSTEM_PREFIXES = (
    "urn:li:document:",
    "urn:li:domain:",
    "urn:li:tag:",
    "urn:li:container:",
    "urn:li:glossaryTerm:",
    "urn:li:glossaryNode:",
    "urn:li:dataHubPolicy:",
    "urn:li:dataHubRole:",
    "urn:li:dataHubView:",
    "urn:li:assertion:",
    "urn:li:test:",
)


def _is_system_entity(urn: str) -> bool:
    return urn.startswith(_SYSTEM_PREFIXES)


def _deduplicate(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for r in results:
        urn = r.get("entity", {}).get("urn", "")
        if urn and urn not in seen and not _is_system_entity(urn):
            seen.add(urn)
            out.append(r)
    return out


def _build_wildcard_query(query: str) -> str:
    stripped = query.strip()
    if not stripped or stripped == "*":
        return "*"
    return " ".join(f"{w}*" for w in stripped.split())


class SearchService:
    def __init__(self) -> None:
        self._client = DataHubClient()

    async def search(
        self,
        query: str,
        entity_types: list[str] | None = None,
        start: int = 0,
        count: int = 20,
        filters: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Keyword search against DataHub (wildcard per word)."""
        keyword_query = _build_wildcard_query(query)

        result = await self._client.search(
            query=keyword_query,
            entity_types=entity_types,
            start=start,
            count=count,
            filters=filters,
        )
        deduplicated = _deduplicate(result.get("searchResults", []))
        return {
            "total": result.get("total", 0),
            "searchResults": deduplicated,
            "translatedTerms": [],
        }

    async def vector_search(
        self,
        query: str,
        entity_types: list[str] | None = None,
        count: int = 20,
    ) -> dict[str, Any]:
        """Semantic vector search via Qdrant. Falls back to keyword if Qdrant unavailable."""
        from app.services.embedding_service import embed_query
        from app.services import vector_store

        try:
            query_vec = embed_query(query)
            raw = vector_store.search(query_vec, top_k=min(count * 3, 100))
        except Exception:
            return await self.search(query=query, entity_types=entity_types, count=count)

        if not raw:
            return {"total": 0, "searchResults": [], "translatedTerms": []}

        # Reject results when scores are too flat (no clear winner = query too irrelevant).
        # With e5-large on short-name-only data, unrelated queries still score ~0.83-0.85.
        # A spread < min_spread means nothing stood out above the background noise.
        scores = [r["score"] for r in raw]
        top_score = scores[0]
        score_spread = top_score - scores[-1]
        if top_score < settings.vector_score_threshold or score_spread < settings.vector_min_spread:
            return {"total": 0, "searchResults": [], "translatedTerms": []}

        # Only keep results that are within min_spread of the top score
        cutoff = top_score - settings.vector_min_spread
        results: list[dict[str, Any]] = []
        for r in raw:
            if r["score"] < cutoff:
                break
            payload = r["payload"]
            urn = payload.get("urn", "")
            if not urn or _is_system_entity(urn):
                continue
            if entity_types and payload.get("type", "").upper() not in entity_types:
                continue
            results.append({"entity": payload})

        deduplicated = _deduplicate(results)[:count]
        return {
            "total": len(deduplicated),
            "searchResults": deduplicated,
            "translatedTerms": [],
        }
