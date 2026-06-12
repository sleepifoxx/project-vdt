import { graphqlQuery, apiClient } from './client';
import type { MetadataEntity, EntityType, MetadataFormData } from '../types';

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const SEARCH_QUERY = `
    query searchAcrossEntities($input: SearchAcrossEntitiesInput!) {
        searchAcrossEntities(input: $input) {
            start
            count
            total
            searchResults {
                entity {
                    urn
                    type
                    ... on Dataset {
                        name
                        platform { name urn }
                        properties { name description }
                        editableProperties { description }
                        ownership {
                            owners {
                                owner {
                                    ... on CorpUser { username }
                                    ... on CorpGroup { name }
                                }
                            }
                        }
                        tags { tags { tag { name urn } } }
                        lastIngested
                        status { removed }
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
                        ownership {
                            owners {
                                owner {
                                    ... on CorpUser { username }
                                }
                            }
                        }
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
                    ... on CorpUser { username }
                    ... on CorpGroup { name }
                }
            }
        }
    }
`;

const COUNT_QUERY = `
    query getSearchCount($input: SearchAcrossEntitiesInput!) {
        searchAcrossEntities(input: $input) {
            total
        }
    }
`;

type GmsEntity = {
    urn: string;
    type: string;
    name?: string;
    username?: string;
    platform?: { name: string };
    properties?: { name?: string; description?: string };
    editableProperties?: { description?: string };
    ownership?: { owners: Array<{ owner: { username?: string; name?: string } }> };
    tags?: { tags: Array<{ tag: { name: string } }> };
    lastIngested?: number;
    status?: { removed: boolean };
    dashboardId?: string;
    chartId?: string;
    flowId?: string;
    jobId?: string;
    dataFlow?: { platform?: { name: string } };
};

function mapEntityType(gmsType: string): EntityType {
    const map: Record<string, EntityType> = {
        DATASET: 'DATASET',
        DASHBOARD: 'DASHBOARD',
        CHART: 'CHART',
        DATA_FLOW: 'DATA_FLOW',
        DATA_JOB: 'DATA_JOB',
        CORP_USER: 'CORP_USER',
        CORP_GROUP: 'CORP_GROUP',
    };
    return map[gmsType] ?? 'DATASET';
}

function resolveName(e: GmsEntity): string {
    if (e.properties?.name) return e.properties.name;
    if (e.name) return e.name;
    if (e.username) return e.username;
    if (e.dashboardId) return e.dashboardId;
    if (e.chartId) return e.chartId;
    if (e.flowId) return e.flowId;
    if (e.jobId) return e.jobId;
    return e.urn.split(',')[1] ?? e.urn;
}

function resolvePlatform(e: GmsEntity): string {
    if (e.platform?.name) return e.platform.name;
    if (e.dataFlow?.platform?.name) return e.dataFlow.platform.name;
    return '';
}

function resolveOwner(e: GmsEntity): string {
    const first = e.ownership?.owners?.[0]?.owner;
    return first?.username ?? first?.name ?? '';
}

export function mapGmsEntityToLocal(e: GmsEntity): MetadataEntity {
    const description =
        e.editableProperties?.description ?? e.properties?.description ?? '';
    return {
        urn: e.urn,
        type: mapEntityType(e.type),
        name: resolveName(e),
        platform: resolvePlatform(e),
        description,
        owner: resolveOwner(e),
        tags: e.tags?.tags.map((t) => t.tag.name) ?? [],
        status: e.status?.removed ? 'REMOVED' : 'ACTIVE',
        lastUpdated: e.lastIngested
            ? new Date(e.lastIngested).toISOString()
            : new Date().toISOString(),
        createdAt: new Date().toISOString(),
    };
}

type SearchResponse = {
    searchAcrossEntities: {
        start: number;
        count: number;
        total: number;
        searchResults: Array<{ entity: GmsEntity }>;
    };
};

export async function searchEntities(params: {
    query: string;
    types?: EntityType[];
    platforms?: string[];
    start?: number;
    count?: number;
}): Promise<{ entities: MetadataEntity[]; total: number }> {
    const input: Record<string, unknown> = {
        query: params.query || '*',
        start: params.start ?? 0,
        count: params.count ?? 10,
    };

    if (params.types && params.types.length > 0) {
        input.types = params.types;
    }

    if (params.platforms && params.platforms.length > 0) {
        input.filters = params.platforms.map((p) => ({
            field: 'platform',
            value: `urn:li:dataPlatform:${p}`,
        }));
    }

    const data = await graphqlQuery<SearchResponse>(SEARCH_QUERY, { input });
    const { total, searchResults } = data.searchAcrossEntities;
    return {
        entities: searchResults.map((r) => mapGmsEntityToLocal(r.entity)),
        total,
    };
}

type CountResponse = { searchAcrossEntities: { total: number } };

export async function getEntityCount(types: EntityType[]): Promise<number> {
    const data = await graphqlQuery<CountResponse>(COUNT_QUERY, {
        input: { query: '*', types, start: 0, count: 0 },
    });
    return data.searchAcrossEntities.total;
}

// ---------------------------------------------------------------------------
// Metadata ingest (REST API via Play proxy → GMS)
// DataHub accepts MetadataChangeProposal (MCP) objects at /api/aspects
// ---------------------------------------------------------------------------

function buildUrn(type: EntityType, platform: string, name: string): string {
    const typeUrn: Record<EntityType, string> = {
        DATASET: `urn:li:dataset:(urn:li:dataPlatform:${platform},${name},PROD)`,
        DASHBOARD: `urn:li:dashboard:(urn:li:dataPlatform:${platform},${name})`,
        CHART: `urn:li:chart:(urn:li:dataPlatform:${platform},${name})`,
        DATA_FLOW: `urn:li:dataFlow:(${platform},${name},PROD)`,
        DATA_JOB: `urn:li:dataJob:(urn:li:dataFlow:(${platform},pipeline,PROD),${name})`,
        CORP_USER: `urn:li:corpuser:${name}`,
        CORP_GROUP: `urn:li:corpGroup:${name}`,
    };
    return typeUrn[type];
}

function jsonAspect(value: unknown): { value: string; contentType: string } {
    return { value: JSON.stringify(value), contentType: 'application/json' };
}

function buildMcp(
    entityType: string,
    entityUrn: string,
    aspectName: string,
    aspectValue: unknown,
) {
    return {
        entityType,
        entityUrn,
        changeType: 'UPSERT',
        aspectName,
        aspect: jsonAspect(aspectValue),
    };
}

// DataHub entity type strings used in MCP entityType field (lowercase camelCase)
const GMS_ENTITY_TYPE: Record<string, string> = {
    DATASET: 'dataset',
    DASHBOARD: 'dashboard',
    CHART: 'chart',
    DATA_FLOW: 'dataFlow',
    DATA_JOB: 'dataJob',
    CORP_USER: 'corpUser',
    CORP_GROUP: 'corpGroup',
};

// DataHub aspect name for the "core properties" of each entity type
const PROPS_ASPECT: Partial<Record<string, string>> = {
    DATASET: 'datasetProperties',
    DASHBOARD: 'dashboardInfo',
    CHART: 'chartInfo',
    DATA_FLOW: 'dataFlowInfo',
    DATA_JOB: 'dataJobInfo',
};

export async function ingestMetadata(data: MetadataFormData): Promise<void> {
    const urn = data.urn ?? buildUrn(data.type, data.platform, data.name);
    const entityType = GMS_ENTITY_TYPE[data.type] ?? data.type.toLowerCase();

    const proposals: unknown[] = [];

    // Core properties aspect
    const propsAspectName = PROPS_ASPECT[data.type] ?? null;

    if (propsAspectName) {
        const customProperties: Record<string, string> = {};
        data.customProperties.forEach(({ key, value }) => {
            if (key) customProperties[key] = value;
        });
        proposals.push(
            buildMcp(entityType, urn, propsAspectName, {
                name: data.name,
                description: data.description,
                customProperties,
            }),
        );
    }

    // Ownership aspect
    if (data.owner) {
        proposals.push(
            buildMcp(entityType, urn, 'ownership', {
                owners: [
                    {
                        owner: data.owner.includes(':')
                            ? data.owner
                            : `urn:li:corpuser:${data.owner}`,
                        type: 'DATAOWNER',
                    },
                ],
                lastModified: { time: Date.now(), actor: 'urn:li:corpuser:datahub' },
            }),
        );
    }

    // GlobalTags aspect
    if (data.tags.length > 0) {
        proposals.push(
            buildMcp(entityType, urn, 'globalTags', {
                tags: data.tags.map((tag) => ({
                    tag: tag.startsWith('urn:li:tag:')
                        ? tag
                        : `urn:li:tag:${tag}`,
                })),
            }),
        );
    }

    // SchemaMetadata aspect (only for datasets)
    if (data.type === 'DATASET' && data.schemaFields && data.schemaFields.length > 0) {
        proposals.push(
            buildMcp(entityType, urn, 'schemaMetadata', {
                schemaName: data.name,
                platform: `urn:li:dataPlatform:${data.platform}`,
                version: 0,
                hash: '',
                platformSchema: { tableSchema: '' },
                fields: data.schemaFields.map((f) => ({
                    fieldPath: f.fieldPath,
                    nativeDataType: f.nativeDataType,
                    type: { type: { com: { linkedin: { schema: { StringType: {} } } } } },
                    description: f.description,
                    nullable: f.nullable,
                    isPartOfKey: f.isKey,
                })),
            }),
        );
    }

    // Submit all proposals in a single batch call
    await apiClient.post('/api/aspects?action=ingestProposalBatch', {
        proposals,
        async: false,
    });
}
