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
                    platform { name urn }
                    properties { description name qualifiedName }
                    editableProperties { description }
                    lastIngested
                    status { removed }
                    ownership {
                        owners {
                            owner {
                                ... on CorpUser { username }
                                ... on CorpGroup { name }
                            }
                        }
                    }
                    tags { tags { tag { name urn } } }
                    domain { domain { urn ... on Domain { properties { name } } } }
                }
                ... on Dashboard {
                    dashboardId
                    properties { name description }
                    platform { name urn }
                    tags { tags { tag { name urn } } }
                    ownership {
                        owners {
                            owner {
                                ... on CorpUser { username }
                            }
                        }
                    }
                }
                ... on Chart {
                    chartId
                    properties { name description }
                    platform { name urn }
                    tags { tags { tag { name urn } } }
                }
                ... on DataFlow {
                    flowId
                    properties { name description }
                    platform { name urn }
                }
                ... on DataJob {
                    jobId
                    properties { name description }
                    dataFlow { platform { name urn } }
                }
                ... on CorpUser {
                    username
                    properties { displayName email }
                }
                ... on CorpGroup {
                    name
                    properties { displayName description }
                }
            }
            matchedFields { name value }
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
                "types": entity_types or [
                    "DATASET", "DASHBOARD", "CHART",
                    "DATA_FLOW", "DATA_JOB", "CORP_USER", "CORP_GROUP",
                ],
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
