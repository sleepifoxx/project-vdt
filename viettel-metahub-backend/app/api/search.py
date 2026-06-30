from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.semantic_search import SearchService, translate_query

router = APIRouter(prefix="/api/search", tags=["search"])
_service = SearchService()


class SearchResult(BaseModel):
    total: int
    searchResults: list[dict[str, Any]]
    translatedTerms: list[str]
    query: str


@router.get("", response_model=SearchResult)
async def search(
    q: str = Query("*", description="Search query (Vietnamese or English, '*' for all)"),
    types: str = Query(
        "DATASET,DASHBOARD,CHART,DATA_FLOW,DATA_JOB,CORP_USER,CORP_GROUP",
        description="Comma-separated entity types",
    ),
    start: int = Query(0, ge=0),
    count: int = Query(10, ge=1, le=100),
    domain: str | None = Query(None, description="Filter by domain URN"),
    tag: str | None = Query(None, description="Filter by tag URN"),
    platform: str | None = Query(None, description="Filter by platform name"),
    start_date: int | None = Query(None, description="Filter lastModifiedAt >= epoch ms"),
    end_date: int | None = Query(None, description="Filter lastModifiedAt <= epoch ms"),
) -> SearchResult:
    entity_types = [t.strip().upper() for t in types.split(",") if t.strip()]

    filters: list[dict[str, Any]] = []
    if domain:
        filters.append({"field": "domains", "values": [domain]})
    if tag:
        filters.append({"field": "tags", "values": [tag]})
    if platform:
        filters.append({
            "field": "platform",
            "values": [f"urn:li:dataPlatform:{platform}" if not platform.startswith("urn:") else platform],
        })
    if start_date:
        filters.append({
            "field": "lastModifiedAt",
            "values": [str(start_date)],
            "condition": "GREATER_THAN_OR_EQUAL_TO",
        })
    if end_date:
        filters.append({
            "field": "lastModifiedAt",
            "values": [str(end_date)],
            "condition": "LESS_THAN_OR_EQUAL_TO",
        })

    try:
        result = await _service.search(
            query=q,
            entity_types=entity_types,
            start=start,
            count=count,
            filters=filters if filters else None,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return SearchResult(
        total=result["total"],
        searchResults=result["searchResults"],
        translatedTerms=result["translatedTerms"],
        query=q,
    )


@router.get("/translate")
async def translate(q: str = Query(...)) -> dict:
    """Preview Vietnamese → English term expansion."""
    synonyms = translate_query(q)
    return {
        "query": q,
        "synonyms": synonyms,
        "allTerms": [q] + synonyms,
    }
