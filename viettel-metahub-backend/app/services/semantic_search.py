"""
Vietnamese semantic search service.

Strategy (no external AI API required):
1. Normalize input (strip diacritics variant lookup + lowercase)
2. Lookup in the VN→EN business-term dictionary
3. Merge original query + all English synonyms into a multi-term DataHub search
4. De-duplicate results by URN, keeping highest-relevance hit
"""

import json
import unicodedata
from pathlib import Path
from typing import Any

from app.services.datahub_client import DataHubClient


_DICT_PATH = Path(__file__).parent.parent / "data" / "vn_en_dict.json"
_vn_en: dict[str, list[str]] = json.loads(_DICT_PATH.read_text(encoding="utf-8"))


def _normalize(text: str) -> str:
    """Lowercase + strip Vietnamese diacritics → ASCII."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def translate_query(query: str) -> list[str]:
    """
    Return a list of search terms to try:
    - original query (DataHub handles partial VN matches via Elasticsearch)
    - English synonyms from the dictionary
    """
    key_original = query.lower().strip()
    key_normalized = _normalize(query)

    terms: list[str] = [query]

    # Direct match on original
    if key_original in _vn_en:
        terms.extend(_vn_en[key_original])

    # Match on normalized (no diacritics) if different
    if key_normalized != key_original and key_normalized in _vn_en:
        terms.extend(_vn_en[key_normalized])

    # Partial phrase match — check if any dict key is contained in the query
    for key, synonyms in _vn_en.items():
        if len(key) > 2 and key in key_original and key != key_original:
            terms.extend(synonyms)

    # Remove duplicates while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for t in terms:
        if t.lower() not in seen:
            seen.add(t.lower())
            unique.append(t)

    return unique


def _deduplicate(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for r in results:
        urn = r.get("entity", {}).get("urn", "")
        if urn and urn not in seen:
            seen.add(urn)
            out.append(r)
    return out


class SemanticSearchService:
    def __init__(self) -> None:
        self._client = DataHubClient()

    async def search(
        self,
        query: str,
        entity_types: list[str] | None = None,
        start: int = 0,
        count: int = 20,
        filters: list[dict] | None = None,
    ) -> dict[str, Any]:
        terms = translate_query(query)

        all_results: list[dict[str, Any]] = []
        total = 0

        # Search with original query first (preserves Elasticsearch ranking)
        primary = await self._client.search(
            query=terms[0],
            entity_types=entity_types,
            start=start,
            count=count,
            filters=filters,
        )
        all_results.extend(primary.get("searchResults", []))
        total = primary.get("total", 0)

        # Search with English synonyms; take up to count - len(primary) extras
        remaining = count - len(all_results)
        for term in terms[1:]:
            if remaining <= 0:
                break
            try:
                extra = await self._client.search(
                    query=term,
                    entity_types=entity_types,
                    start=0,
                    count=remaining,
                    filters=filters,
                )
                new_hits = extra.get("searchResults", [])
                all_results.extend(new_hits)
                total = max(total, extra.get("total", 0))
                remaining -= len(new_hits)
            except Exception:
                # Synonym search is best-effort; don't fail the whole request
                continue

        deduplicated = _deduplicate(all_results)

        return {
            "total": max(total, len(deduplicated)),
            "searchResults": deduplicated[:count],
            "translatedTerms": terms,
        }
