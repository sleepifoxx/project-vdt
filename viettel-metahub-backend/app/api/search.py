import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel

from app.services.semantic_search import SearchService

router = APIRouter(prefix="/api/search", tags=["search"])
_service = SearchService()
logger = logging.getLogger(__name__)


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
    ai_search: bool = Query(False, description="Use vector semantic search (Qdrant)"),
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
        use_vector = ai_search and q.strip() and q.strip() != "*"
        if use_vector:
            result = await _service.vector_search(
                query=q,
                entity_types=entity_types,
                count=count,
            )
        else:
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


@router.post("/ingest/all", status_code=202)
async def trigger_ingest_all(background_tasks: BackgroundTasks) -> dict:
    """Re-index ALL entities into Qdrant (no platform filter)."""
    from app.services.ingest_service import ingest_all
    from app.services.datahub_client import DataHubClient

    async def _run() -> None:
        try:
            n = await ingest_all(DataHubClient())
            logger.info("Ingest all done: %d entities", n)
        except Exception as exc:
            logger.error("Ingest all failed: %s", exc)

    background_tasks.add_task(_run)
    return {"status": "ingest started", "platform": "all"}


@router.post("/ingest", status_code=202)
async def trigger_ingest(
    background_tasks: BackgroundTasks,
    platform: str = Query(..., description="DataHub platform name (e.g. mysql, postgres, kafka)"),
) -> dict:
    """Re-index entities of a specific platform into Qdrant (triggered by 'Chạy ngay')."""
    from app.services.ingest_service import ingest_by_platform
    from app.services.datahub_client import DataHubClient

    async def _run() -> None:
        try:
            n = await ingest_by_platform(DataHubClient(), platform)
            logger.info("Ingest done: %d entities for platform=%s", n, platform)
        except Exception as exc:
            logger.error("Ingest failed for platform=%s: %s", platform, exc)

    background_tasks.add_task(_run)
    return {"status": "ingest started", "platform": platform}
