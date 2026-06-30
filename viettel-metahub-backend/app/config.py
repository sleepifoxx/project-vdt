from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    datahub_gms_url: str = "http://localhost:8080"
    datahub_graphql_url: str = "http://localhost:9002/api/v2/graphql"
    datahub_token: str = ""

    # CORS - comma-separated list of allowed origins
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Search config
    max_search_results: int = 20
    translation_fallback: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
