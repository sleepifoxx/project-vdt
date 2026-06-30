import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.search import router as search_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model_ready
    # Pre-load embedding model so the first search doesn't hang
    try:
        from app.services.embedding_service import embed_query
        embed_query("warmup")
        _model_ready = True
        logger.info("Embedding model loaded and ready")
    except Exception as exc:
        logger.warning("Could not pre-load embedding model: %s", exc)
    yield


app = FastAPI(
    title="Viettel MetaHub Backend",
    description="Vietnamese semantic search layer over DataHub GraphQL",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)


_model_ready = False


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "viettel-metahub-backend", "model_ready": _model_ready}
