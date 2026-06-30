import httpx
from typing import Any

from app.config import settings


SEARCH_QUERY = """
query searchAcrossEntities($input: SearchAcrossEntitiesInput!) {
    searchAcrossEntities(input: $input) {
        total
        searchResults {
            entity {
                urn
                type
                ... on Dataset {
                    name
                    platform { name }
                    properties { description name qualifiedName }
                    editableProperties { description }
                    ownership {
                        owners {
                            owner {
                                ... on CorpUser { username properties { displayName } }
                            }
                        }
                    }
                    tags {
                        tags { tag { urn name } }
                    }
                    domain {
                        domain { urn properties { name } }
                    }
                }
                ... on Dashboard {
                    dashboardId
                    properties { name description }
                    platform { name }
                }
                ... on Chart {
                    chartId
                    properties { name description }
                    platform { name }
                }
            }
            matchedFields {
                name
                value
            }
            insights {
                text
            }
        }
    }
}
"""


class DataHubClient:
    def __init__(self) -> None:
        self.graphql_url = settings.datahub_graphql_url
        headers = {"Content-Type": "application/json"}
        if settings.datahub_token:
            headers["Authorization"] = f"Bearer {settings.datahub_token}"
        self._headers = headers

    async def search(
        self,
        query: str,
        entity_types: list[str] | None = None,
        start: int = 0,
        count: int = 20,
        filters: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        variables: dict[str, Any] = {
            "input": {
                "query": query,
                "start": start,
                "count": count,
                "types": entity_types or ["DATASET", "DASHBOARD", "CHART"],
            }
        }
        if filters:
            variables["input"]["orFilters"] = [{"and": filters}]

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                self.graphql_url,
                json={"query": SEARCH_QUERY, "variables": variables},
                headers=self._headers,
            )
            resp.raise_for_status()
            body = resp.json()

        if "errors" in body:
            raise RuntimeError(f"DataHub GraphQL error: {body['errors']}")

        return body["data"]["searchAcrossEntities"]
