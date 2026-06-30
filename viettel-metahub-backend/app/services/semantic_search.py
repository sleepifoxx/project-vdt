"""
Unified search service: keyword search + Vietnamese semantic expansion.

Flow for every query:
1. Build wildcard keyword query  ("khach hang" → "khach* hang*")
2. Translate VN → EN synonyms   ("khach hang" → ["customer", "client", "buyer"])
3. Run keyword query + all synonym queries in parallel against DataHub GraphQL
4. Merge results: keyword hits first (best relevance), synonyms fill in extras
5. Deduplicate by URN
"""

import asyncio
import json
import unicodedata
from pathlib import Path
from typing import Any

from app.services.datahub_client import DataHubClient


_DICT_PATH = Path(__file__).parent.parent / "data" / "vn_en_dict.json"
_vn_en: dict[str, list[str]] = json.loads(_DICT_PATH.read_text(encoding="utf-8"))

# System entity URN prefixes that should never appear in user-facing results
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


def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def _build_wildcard_query(query: str) -> str:
    """mirrors frontend buildSmartQuery: each word gets a * suffix."""
    stripped = query.strip()
    if not stripped or stripped == "*":
        return "*"
    words = stripped.split()
    return " ".join(f"{w}*" for w in words)


def translate_query(query: str) -> list[str]:
    """Return English synonyms for a Vietnamese query (empty list if none found)."""
    key_original = query.lower().strip()
    key_normalized = _normalize(query)

    synonyms: list[str] = []

    if key_original in _vn_en:
        synonyms.extend(_vn_en[key_original])

    if key_normalized != key_original and key_normalized in _vn_en:
        for s in _vn_en[key_normalized]:
            if s not in synonyms:
                synonyms.append(s)

    # Partial phrase match
    for key, syns in _vn_en.items():
        if len(key) > 2 and key in key_original and key != key_original:
            for s in syns:
                if s not in synonyms:
                    synonyms.append(s)

    return synonyms


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
        is_wildcard = not query.strip() or query.strip() == "*"

        if is_wildcard:
            result = await self._client.search(
                query="*",
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

        # Build keyword query with wildcards (mirrors frontend buildSmartQuery)
        keyword_query = _build_wildcard_query(query)

        # Get semantic synonyms
        synonyms = translate_query(query)

        # Run keyword search + all synonym searches in parallel
        tasks: list[asyncio.Task[dict[str, Any]]] = []

        async def _safe_search(q: str, s: int = 0, c: int = count) -> dict[str, Any]:
            try:
                return await self._client.search(
                    query=q,
                    entity_types=entity_types,
                    start=s,
                    count=c,
                    filters=filters,
                )
            except Exception:
                return {"total": 0, "searchResults": []}

        async with asyncio.TaskGroup() as tg:
            # Keyword search with pagination support
            keyword_task = tg.create_task(_safe_search(keyword_query, start, count))
            # Synonym searches always from page 0 (fill extras only)
            synonym_tasks = [
                tg.create_task(_safe_search(syn, 0, count))
                for syn in synonyms
            ]

        keyword_result = keyword_task.result()
        keyword_hits = keyword_result.get("searchResults", [])
        total = keyword_result.get("total", 0)

        # Collect synonym hits — append after keyword hits for dedup to prefer keyword order
        all_hits = list(keyword_hits)
        for task in synonym_tasks:
            all_hits.extend(task.result().get("searchResults", []))

        deduplicated = _deduplicate(all_hits)

        # total reflects keyword search total; add unique synonym-only hits
        synonym_only = len(deduplicated) - len(_deduplicate(keyword_hits))
        adjusted_total = max(total + max(synonym_only, 0), len(deduplicated))

        return {
            "total": adjusted_total,
            "searchResults": deduplicated[:count],
            "translatedTerms": [query] + synonyms if synonyms else [],
        }
