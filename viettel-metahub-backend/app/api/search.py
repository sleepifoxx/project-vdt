from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.semantic_search import SemanticSearchService, translate_query

router = APIRouter(prefix="/api/search", tags=["search"])
_service = SemanticSearchService()


class SearchResult(BaseModel):
    total: int
    searchResults: list[dict[str, Any]]
    translatedTerms: list[str]
    query: str


@router.get("", response_model=SearchResult)
async def search(
    q: str = Query(..., description="Search query (Vietnamese or English)"),
    types: str = Query(
        "DATASET,DASHBOARD,CHART",
        description="Comma-separated entity types",
    ),
    start: int = Query(0, ge=0),
    count: int = Query(20, ge=1, le=100),
    domain: str | None = Query(None, description="Filter by domain URN"),
    platform: str | None = Query(None, description="Filter by platform name"),
) -> SearchResult:
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    entity_types = [t.strip().upper() for t in types.split(",") if t.strip()]

    filters: list[dict] = []
    if domain:
        filters.append({"field": "domains", "values": [domain]})
    if platform:
        filters.append({"field": "platform", "values": [platform]})

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
async def translate(q: str = Query(..., description="Vietnamese query to translate")) -> dict:
    """Preview how a query is expanded to English search terms."""
    return {
        "query": q,
        "terms": translate_query(q),
    }
