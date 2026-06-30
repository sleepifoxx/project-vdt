from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.search import router as search_router

app = FastAPI(
    title="Viettel MetaHub Backend",
    description="Vietnamese semantic search layer over DataHub GraphQL",
    version="1.0.0",
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "viettel-metahub-backend"}
