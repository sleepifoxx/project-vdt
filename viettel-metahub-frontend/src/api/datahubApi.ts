import { graphqlQuery, apiClient } from './client';
import type { MetadataEntity, EntityType, MetadataFormData, Department, Project, ConnectionConfig, ConnectionType, AutoUpdateSchedule, ScheduleFrequency } from '../types';

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
                        domain { domain { urn ... on Domain { properties { name } } } }
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
    tags?: { tags: Array<{ tag: { name: string; urn: string } }> };
    domain?: { domain?: { urn: string; properties?: { name: string } } };
    domains?: { domains: Array<{ urn: string; properties?: { name: string } }> };
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

function resolveDomains(e: GmsEntity): Array<{ urn: string; name: string }> {
    // DataHub <0.12 exposes domain (singular aspect), newer versions may use domains
    if (e.domain?.domain) {
        const d = e.domain.domain;
        return [{ urn: d.urn, name: d.properties?.name ?? d.urn.replace('urn:li:domain:', '') }];
    }
    if (e.domains?.domains?.length) {
        return e.domains.domains.map((d) => ({
            urn: d.urn,
            name: d.properties?.name ?? d.urn.replace('urn:li:domain:', ''),
        }));
    }
    return [];
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
        domains: resolveDomains(e),
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
    domainUrns?: string[];
    tagUrns?: string[];
    startDate?: number;
    endDate?: number;
    start?: number;
    count?: number;
}): Promise<{ entities: MetadataEntity[]; total: number }> {
    const input: Record<string, unknown> = {
        query: params.query || '*',
        start: params.start ?? 0,
        count: params.count ?? 10,
    };

    // Always filter by explicit types so DataHub excludes system entities server-side.
    // Fallback covers SearchPage's "search all" case (no user-selected filter).
    const USER_FACING_TYPES: EntityType[] = ['DATASET', 'DASHBOARD', 'CHART', 'DATA_FLOW', 'DATA_JOB', 'CORP_USER', 'CORP_GROUP'];
    input.types = params.types && params.types.length > 0 ? params.types : USER_FACING_TYPES;

    const andFilters: Array<{ field: string; values: string[]; condition?: string }> = [];

    if (params.platforms && params.platforms.length > 0) {
        andFilters.push({
            field: 'platform',
            values: params.platforms.map((p) => `urn:li:dataPlatform:${p}`),
        });
    }

    if (params.domainUrns && params.domainUrns.length > 0) {
        andFilters.push({
            field: 'domains',
            values: params.domainUrns,
        });
    }

    if (params.tagUrns && params.tagUrns.length > 0) {
        andFilters.push({
            field: 'tags',
            values: params.tagUrns,
        });
    }

    if (params.startDate) {
        andFilters.push({
            field: 'lastModifiedAt',
            values: [String(params.startDate)],
            condition: 'GREATER_THAN_OR_EQUAL_TO',
        });
    }

    if (params.endDate) {
        andFilters.push({
            field: 'lastModifiedAt',
            values: [String(params.endDate)],
            condition: 'LESS_THAN_OR_EQUAL_TO',
        });
    }

    if (andFilters.length > 0) {
        input.orFilters = [{ and: andFilters }];
    }

    const data = await graphqlQuery<SearchResponse>(SEARCH_QUERY, { input });
    const { total, searchResults } = data.searchAcrossEntities;
    const filtered = searchResults.filter(
        (r) => !SYSTEM_ENTITY_URN_PREFIXES.some((prefix) => r.entity.urn.startsWith(prefix)),
    );
    return {
        entities: filtered.map((r) => mapGmsEntityToLocal(r.entity)),
        total: filtered.length < searchResults.length ? total - (searchResults.length - filtered.length) : total,
    };
}

// ---------------------------------------------------------------------------
// Semantic search (via viettel-metahub-backend)
// Translates Vietnamese queries → English synonyms before querying DataHub.
// ---------------------------------------------------------------------------
// Vector ingest trigger — called after "Chạy ngay" to re-embed a platform's entities
// ---------------------------------------------------------------------------

/** Map from ConnectionType to DataHub platform name */
export const CONNECTION_TYPE_TO_PLATFORM: Record<string, string> = {
    MYSQL:      'mysql',
    POSTGRESQL: 'postgres',
    ORACLE:     'oracle',
    MSSQL:      'mssql',
    MONGODB:    'mongodb',
    KAFKA:      'kafka',
    HIVE:       'hive',
    SPARK:      'spark',
};

export async function triggerVectorIngest(platform: string): Promise<void> {
    const url = new URL('/semantic/api/search/ingest', window.location.origin);
    url.searchParams.set('platform', platform);
    await fetch(url.toString(), { method: 'POST', credentials: 'include' });
}

// ---------------------------------------------------------------------------

export async function semanticSearchEntities(params: {
    query: string;
    types?: EntityType[];
    platforms?: string[];
    domainUrns?: string[];
    tagUrns?: string[];
    startDate?: number;
    endDate?: number;
    start?: number;
    count?: number;
    aiSearch?: boolean;
}): Promise<{ entities: MetadataEntity[]; total: number; translatedTerms: string[] }> {
    const url = new URL('/semantic/api/search', window.location.origin);
    url.searchParams.set('q', params.query || '*');
    if (params.types && params.types.length > 0) {
        url.searchParams.set('types', params.types.join(','));
    }
    if (params.platforms && params.platforms.length > 0) {
        url.searchParams.set('platform', params.platforms[0]);
    }
    if (params.domainUrns && params.domainUrns.length > 0) {
        url.searchParams.set('domain', params.domainUrns[0]);
    }
    if (params.tagUrns && params.tagUrns.length > 0) {
        url.searchParams.set('tag', params.tagUrns[0]);
    }
    if (params.startDate) {
        url.searchParams.set('start_date', String(params.startDate));
    }
    if (params.endDate) {
        url.searchParams.set('end_date', String(params.endDate));
    }
    url.searchParams.set('start', String(params.start ?? 0));
    url.searchParams.set('count', String(params.count ?? 10));
    if (params.aiSearch && params.query && params.query !== '*') {
        url.searchParams.set('ai_search', 'true');
    }

    const resp = await fetch(url.toString(), { credentials: 'include' });
    if (!resp.ok) {
        throw new Error(`Search failed: ${resp.status} ${resp.statusText}`);
    }
    const json = await resp.json();

    const entities: MetadataEntity[] = (json.searchResults as Array<{ entity: GmsEntity }>)
        .map((r) => mapGmsEntityToLocal(r.entity));

    return {
        entities,
        total: json.total as number,
        translatedTerms: (json.translatedTerms as string[]) ?? [],
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
// Domains (used as department/org tree)
// ---------------------------------------------------------------------------

const CREATE_DOMAIN_MUTATION = `
    mutation createDomainViettel($input: CreateDomainInput!) {
        createDomain(input: $input)
    }
`;

export async function createDomain(params: {
    name: string;
    description?: string;
    parentDomain?: string;
}): Promise<string> {
    const input: Record<string, unknown> = { name: params.name };
    if (params.description) input.description = params.description;
    if (params.parentDomain) input.parentDomain = params.parentDomain;
    const data = await graphqlQuery<{ createDomain: string }>(CREATE_DOMAIN_MUTATION, { input });
    return data.createDomain;
}

const CREATE_TAG_MUTATION = `
    mutation createTagViettel($input: CreateTagInput!) {
        createTag(input: $input)
    }
`;

export async function createTag(params: {
    name: string;
    description?: string;
}): Promise<string> {
    const input: Record<string, unknown> = { id: params.name, name: params.name };
    if (params.description) input.description = params.description;
    const data = await graphqlQuery<{ createTag: string }>(CREATE_TAG_MUTATION, { input });
    return data.createTag;
}

const LIST_DOMAINS_QUERY = `
    query listDomainsViettel($input: ListDomainsInput!) {
        listDomains(input: $input) {
            total
            domains {
                urn
                properties {
                    name
                    description
                }
            }
        }
    }
`;

type GmsDomainItem = {
    urn: string;
    properties?: { name: string; description?: string };
};

type ListDomainsResponse = {
    listDomains: {
        total: number;
        domains: GmsDomainItem[];
    };
};

export async function listDomains(): Promise<Department[]> {
    const data = await graphqlQuery<ListDomainsResponse>(LIST_DOMAINS_QUERY, {
        input: { start: 0, count: 200 },
    });

    return data.listDomains.domains.map((d) => {
        const label = d.properties?.name ?? d.urn.replace('urn:li:domain:', '');
        const shortCode = label.slice(0, 6).toUpperCase();
        return {
            id: d.urn,
            name: label,
            code: shortCode,
            children: [],
        };
    });
}

// ---------------------------------------------------------------------------
// Aggregations (platform coverage + tag list as "projects")
// ---------------------------------------------------------------------------

const AGGREGATE_QUERY = `
    query aggregateForViettel($input: AggregateAcrossEntitiesInput!) {
        aggregateAcrossEntities(input: $input) {
            facets {
                field
                aggregations {
                    value
                    count
                }
            }
        }
    }
`;

type AggregationItem = {
    value: string;
    count: number;
};

type AggregateResponse = {
    aggregateAcrossEntities: {
        facets: Array<{
            field: string;
            aggregations: AggregationItem[];
        }>;
    };
};

export async function getPlatformAggregations(): Promise<
    Array<{ name: string; count: number; percent: number }>
> {
    const data = await graphqlQuery<AggregateResponse>(AGGREGATE_QUERY, {
        input: { query: '*', types: [], orFilters: [], facets: ['platform'] },
    });

    const facet = data.aggregateAcrossEntities.facets.find((f) => f.field === 'platform');
    if (!facet || facet.aggregations.length === 0) return [];

    const sorted = [...facet.aggregations].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, 6);
    const total = sorted.reduce((s, a) => s + a.count, 0);
    const topTotal = top.reduce((s, a) => s + a.count, 0);

    const result = top.map((a) => ({
        name: a.value.replace('urn:li:dataPlatform:', ''),
        count: a.count,
        percent: total > 0 ? Math.round((a.count / total) * 100) : 0,
    }));

    // Add "Khác" bucket if there are more platforms
    if (sorted.length > 6) {
        const otherCount = total - topTotal;
        result.push({
            name: 'Khác',
            count: otherCount,
            percent: total > 0 ? Math.round((otherCount / total) * 100) : 0,
        });
    }

    return result;
}

const LIST_TAGS_QUERY = `
    query listTagsViettel($input: SearchAcrossEntitiesInput!) {
        searchAcrossEntities(input: $input) {
            total
            searchResults {
                entity {
                    urn
                    ... on Tag {
                        properties { name description }
                    }
                }
            }
        }
    }
`;

type ListTagsResponse = {
    searchAcrossEntities: {
        total: number;
        searchResults: Array<{
            entity: {
                urn: string;
                properties?: { name: string; description?: string };
            };
        }>;
    };
};

export async function getTagAggregations(): Promise<Project[]> {
    const data = await graphqlQuery<ListTagsResponse>(LIST_TAGS_QUERY, {
        input: { query: '*', types: ['TAG'], start: 0, count: 200 },
    });

    return data.searchAcrossEntities.searchResults.map((r) => {
        const displayName = r.entity.properties?.name ?? r.entity.urn.replace('urn:li:tag:', '');
        return {
            id: r.entity.urn,
            name: displayName,
            code: displayName.slice(0, 6).toUpperCase(),
            departmentId: '',
            description: r.entity.properties?.description,
            status: 'ACTIVE' as const,
        };
    });
}

// ---------------------------------------------------------------------------
// Entity domain & tag mutations via GraphQL
// ---------------------------------------------------------------------------

const SET_DOMAIN_MUTATION = `
    mutation setDomain($entityUrn: String!, $domainUrn: String!) {
        setDomain(entityUrn: $entityUrn, domainUrn: $domainUrn)
    }
`;

const UNSET_DOMAIN_MUTATION = `
    mutation unsetDomain($entityUrn: String!) {
        unsetDomain(entityUrn: $entityUrn)
    }
`;

const ADD_TAGS_MUTATION = `
    mutation addTags($input: AddTagsInput!) {
        addTags(input: $input)
    }
`;

const REMOVE_TAG_MUTATION = `
    mutation removeTag($input: TagAssociationInput!) {
        removeTag(input: $input)
    }
`;

// Direct GMS query (not Elasticsearch) — used to read back confirmed state after mutation
const DATASET_TAGS_DOMAINS_QUERY = `
    query getDatasetMeta($urn: String!) {
        dataset(urn: $urn) {
            urn
            tags { tags { tag { name urn } } }
            domain { domain { urn ... on Domain { properties { name } } } }
        }
    }
`;

type DatasetMetaResponse = {
    dataset: {
        urn: string;
        tags?: { tags: Array<{ tag: { name: string; urn: string } }> };
        domain?: { domain?: { urn: string; properties?: { name: string } } };
    } | null;
};

// After a mutation, refetch the entity directly from GMS to get confirmed state.
// This bypasses Elasticsearch so we always get the latest persisted data.
export async function refetchEntityMeta(
    urn: string,
): Promise<{ tags: string[]; domains: Array<{ urn: string; name: string }> } | null> {
    if (!urn.startsWith('urn:li:dataset:')) return null; // only datasets supported for now
    try {
        const data = await graphqlQuery<DatasetMetaResponse>(DATASET_TAGS_DOMAINS_QUERY, { urn });
        if (!data.dataset) return null;
        const tags = data.dataset.tags?.tags.map((t) => t.tag.name) ?? [];
        const domainNode = data.dataset.domain?.domain;
        const domains = domainNode
            ? [{ urn: domainNode.urn, name: domainNode.properties?.name ?? domainNode.urn.replace('urn:li:domain:', '') }]
            : [];
        return { tags, domains };
    } catch {
        return null;
    }
}

export async function updateEntityTags(entityUrn: string, tagUrns: string[]): Promise<void> {
    // Remove all tags not in the new list, add all new ones.
    // Simplest: add the full set via ADD_TAGS, then the caller handles removal separately.
    // Here we do it in two calls: removeTags for old, addTags for new.
    // DataHub's addTags/removeTags are idempotent so safe to call in any order.
    if (tagUrns.length > 0) {
        const result = await graphqlQuery<{ addTags: boolean }>(ADD_TAGS_MUTATION, {
            input: { tagUrns, resourceUrn: entityUrn },
        });
        if (!result.addTags) {
            console.error('[updateEntityTags] addTags returned false for', entityUrn, tagUrns);
            throw new Error('addTags returned false');
        }
    }
}

export async function removeEntityTag(entityUrn: string, tagUrn: string): Promise<void> {
    const result = await graphqlQuery<{ removeTag: boolean }>(REMOVE_TAG_MUTATION, {
        input: { tagUrn, resourceUrn: entityUrn },
    });
    if (!result.removeTag) {
        console.error('[removeEntityTag] removeTag returned false', entityUrn, tagUrn);
        throw new Error('removeTag returned false');
    }
}

export async function updateEntityDomains(entityUrn: string, domainUrns: string[]): Promise<void> {
    if (domainUrns.length === 0) {
        const result = await graphqlQuery<{ unsetDomain: boolean }>(UNSET_DOMAIN_MUTATION, { entityUrn });
        if (!result.unsetDomain) {
            console.error('[updateEntityDomains] unsetDomain returned false for', entityUrn);
            throw new Error('unsetDomain returned false');
        }
    } else {
        for (const domainUrn of domainUrns) {
            const result = await graphqlQuery<{ setDomain: boolean }>(SET_DOMAIN_MUTATION, { entityUrn, domainUrn });
            if (!result.setDomain) {
                console.error('[updateEntityDomains] setDomain returned false for', entityUrn, domainUrn);
                throw new Error('setDomain returned false');
            }
        }
    }
}

const BATCH_SOFT_DELETE_MUTATION = `
    mutation batchUpdateSoftDeleted($input: BatchUpdateSoftDeletedInput!) {
        batchUpdateSoftDeleted(input: $input)
    }
`;

export async function deleteEntity(urn: string): Promise<void> {
    await graphqlQuery<{ batchUpdateSoftDeleted: boolean }>(BATCH_SOFT_DELETE_MUTATION, {
        input: { urns: [urn], deleted: true },
    });
}

const DATASET_SCHEMA_QUERY = `
    query getDatasetSchema($urn: String!) {
        dataset(urn: $urn) {
            schemaMetadata {
                fields {
                    fieldPath
                    nativeDataType
                    description
                    nullable
                    isPartOfKey
                }
            }
            editableSchemaMetadata {
                editableSchemaFieldInfo {
                    fieldPath
                    description
                }
            }
        }
    }
`;

export type SchemaField = {
    fieldPath: string;
    nativeDataType: string;
    description?: string;
    nullable: boolean;
    isPartOfKey: boolean;
};

type DatasetSchemaResponse = {
    dataset: {
        schemaMetadata?: { fields: SchemaField[] };
        editableSchemaMetadata?: {
            editableSchemaFieldInfo: Array<{ fieldPath: string; description?: string }>;
        };
    } | null;
};

export async function fetchDatasetSchema(urn: string): Promise<SchemaField[]> {
    const data = await graphqlQuery<DatasetSchemaResponse>(DATASET_SCHEMA_QUERY, { urn });
    const fields = data.dataset?.schemaMetadata?.fields ?? [];
    const editableMap = new Map(
        (data.dataset?.editableSchemaMetadata?.editableSchemaFieldInfo ?? []).map(
            (f) => [f.fieldPath, f.description],
        ),
    );
    return fields.map((f) => ({
        ...f,
        description: editableMap.get(f.fieldPath) ?? f.description,
    }));
}

// ---------------------------------------------------------------------------
// Description mutations
// ---------------------------------------------------------------------------

const UPDATE_DESCRIPTION_MUTATION = `
    mutation updateDescription($input: DescriptionUpdateInput!) {
        updateDescription(input: $input)
    }
`;

export async function updateEntityDescription(urn: string, description: string): Promise<void> {
    await graphqlQuery<{ updateDescription: boolean }>(UPDATE_DESCRIPTION_MUTATION, {
        input: { description, resourceUrn: urn },
    });
}

export async function updateDatasetFieldDescription(
    datasetUrn: string,
    fieldPath: string,
    description: string,
): Promise<void> {
    await graphqlQuery<{ updateDescription: boolean }>(UPDATE_DESCRIPTION_MUTATION, {
        input: {
            description,
            resourceUrn: datasetUrn,
            subResourceType: 'DATASET_FIELD',
            subResource: fieldPath,
        },
    });
}

// ---------------------------------------------------------------------------
// Ingestion sources — ConnectionConfig + AutoUpdateSchedule
// ---------------------------------------------------------------------------

const LIST_INGESTION_SOURCES_QUERY = `
    query listIngestionSourcesViettel($input: ListIngestionSourcesInput!) {
        listIngestionSources(input: $input) {
            total
            ingestionSources {
                urn
                name
                type
                config {
                    recipe
                }
                schedule {
                    interval
                    timezone
                }
                executions(start: 0, count: 1) {
                    total
                    executionRequests {
                        input {
                            requestedAt
                        }
                        result {
                            status
                            startTimeMs
                            durationMs
                        }
                    }
                }
            }
        }
    }
`;

const RUN_INGESTION_MUTATION = `
    mutation createIngestionExecutionRequest($input: CreateIngestionExecutionRequestInput!) {
        createIngestionExecutionRequest(input: $input)
    }
`;

type GmsExecRequest = {
    input?: { requestedAt?: number };
    result?: { status: string; startTimeMs: number; durationMs?: number };
};

type GmsIngestionSource = {
    urn: string;
    name: string;
    type: string;
    config?: { recipe?: string };
    schedule?: { interval?: string; timezone?: string };
    executions?: {
        total: number;
        executionRequests: GmsExecRequest[];
    };
};

type ListIngestionResponse = {
    listIngestionSources: {
        total: number;
        ingestionSources: GmsIngestionSource[];
    };
};

// Map connector type string → ConnectionType enum
function mapIngestionType(type: string): ConnectionType {
    const m: Record<string, ConnectionType> = {
        mysql: 'MYSQL',
        postgresql: 'POSTGRESQL',
        postgres: 'POSTGRESQL',
        oracle: 'ORACLE',
        mssql: 'MSSQL',
        sqlserver: 'MSSQL',
        mongodb: 'MONGODB',
        kafka: 'KAFKA',
        hive: 'HIVE',
        spark: 'SPARK',
        rest_api: 'REST_API',
    };
    return m[type.toLowerCase()] ?? 'JDBC';
}

// Map last execution status → ConnectionConfig status
function mapExecStatus(exec?: GmsExecRequest): ConnectionConfig['status'] {
    if (!exec?.result) return 'DISCONNECTED';
    const s = exec.result.status.toUpperCase();
    if (s === 'SUCCESS') return 'CONNECTED';
    if (s === 'FAILURE' || s === 'FAILED') return 'ERROR';
    if (s === 'RUNNING' || s === 'PENDING') return 'TESTING';
    return 'DISCONNECTED';
}

// Parse the JSON recipe to extract host, port, database, username
function parseRecipe(recipe?: string, sourceType?: string): Pick<ConnectionConfig, 'host' | 'port' | 'database' | 'username'> {
    const empty = { host: '', port: 0, database: '', username: '' };
    if (!recipe) return empty;
    try {
        const r = JSON.parse(recipe);
        const cfg = r?.source?.config ?? {};

        // Most relational connectors: host_port = "host:port"
        if (cfg.host_port) {
            const [host, portStr] = String(cfg.host_port).split(':');
            return {
                host: host ?? '',
                port: parseInt(portStr, 10) || 0,
                database: cfg.database ?? cfg.database_pattern?.allow?.[0] ?? '',
                username: cfg.username ?? '',
            };
        }

        // Separate host + port fields (some connectors)
        if (cfg.host) {
            return {
                host: cfg.host,
                port: parseInt(cfg.port, 10) || 0,
                database: cfg.database ?? '',
                username: cfg.username ?? '',
            };
        }

        // Kafka: connection.bootstrap = "broker:9092"
        if (cfg.connection?.bootstrap) {
            const [host, portStr] = String(cfg.connection.bootstrap).split(':');
            return { host: host ?? '', port: parseInt(portStr, 10) || 9092, database: '', username: '' };
        }

        // MongoDB: connect_uri = "mongodb://user:pass@host:27017/db"
        if (cfg.connect_uri) {
            try {
                const uri = new URL(String(cfg.connect_uri).replace('mongodb+srv://', 'https://').replace('mongodb://', 'https://'));
                return {
                    host: uri.hostname,
                    port: parseInt(uri.port, 10) || 27017,
                    database: uri.pathname.replace('/', '') || '',
                    username: uri.username || '',
                };
            } catch { /* fall through */ }
        }

        return empty;
    } catch {
        return empty;
    }
}

// Map cron interval → ScheduleFrequency
// Only map to a preset when the interval exactly matches what frequencyToCron() produces.
// Anything else is treated as CUSTOM to preserve the original expression.
function mapCronToFrequency(interval?: string): { frequency: ScheduleFrequency; cronExpression?: string } {
    if (!interval) return { frequency: 'CUSTOM' };
    const norm = interval.trim();

    if (norm === '@hourly'   || norm === '0 * * * *')   return { frequency: 'HOURLY' };
    if (norm === '@daily'    || norm === '@midnight'
                             || norm === '0 0 * * *')   return { frequency: 'DAILY' };
    if (norm === '@weekly'   || norm === '0 0 * * 0')   return { frequency: 'WEEKLY' };
    if (norm === '@monthly'  || norm === '0 0 1 * *')   return { frequency: 'MONTHLY' };

    return { frequency: 'CUSTOM', cronExpression: norm };
}

// ---------------------------------------------------------------------------
// Filter options cache — domain / tag / platform names for keyword auto-detection
// ---------------------------------------------------------------------------

export type FilterOptions = {
    domains: Array<{ urn: string; name: string }>;
    tags: Array<{ urn: string; name: string }>;
    platforms: Array<{ name: string; displayName: string }>;
};

let _filterOptionsCache: FilterOptions | null = null;

// Loads and caches domain/tag/platform options once per session.
// Used by search to auto-detect which filter to apply based on the keyword.
export async function getFilterOptions(): Promise<FilterOptions> {
    if (_filterOptionsCache) return _filterOptionsCache;

    const [domains, tags, platforms, platformNameMap] = await Promise.all([
        listDomains(),
        getTagAggregations(),
        getPlatformAggregations(),
        getPlatformNameMap(),
    ]);

    _filterOptionsCache = {
        domains: domains.map((d) => ({ urn: d.id, name: d.name })),
        tags: tags.map((t) => ({ urn: t.id, name: t.name })),
        platforms: platforms.map((p) => ({
            name: p.name,
            displayName: platformNameMap[p.name] ?? p.name.toUpperCase(),
        })),
    };

    return _filterOptionsCache;
}

// DataHub internal system source types that are auto-recreated on restart and cannot be permanently deleted
// URN prefixes for DataHub internal system entities that should not appear in user-facing search
const SYSTEM_ENTITY_URN_PREFIXES = [
    'urn:li:document:',
    'urn:li:domain:',
    'urn:li:tag:',
    'urn:li:container:',
    'urn:li:glossaryTerm:',
    'urn:li:glossaryNode:',
    'urn:li:dataHubPolicy:',
    'urn:li:dataHubRole:',
    'urn:li:dataHubView:',
    'urn:li:assertion:',
    'urn:li:test:',
];

const SYSTEM_SOURCE_TYPES = new Set([
    'datahub-gc',
    'datahub-documents',
    'datahub-business-attribute-definitions',
    'datahub-lineage-summary',
]);

// Fetch all ingestion sources (raw) — used by both listIngestionSources and listIngestionSchedules
async function fetchIngestionSources(): Promise<GmsIngestionSource[]> {
    const data = await graphqlQuery<ListIngestionResponse>(LIST_INGESTION_SOURCES_QUERY, {
        input: { start: 0, count: 100 },
    });
    return data.listIngestionSources.ingestionSources.filter(
        (src) => !SYSTEM_SOURCE_TYPES.has(src.type.toLowerCase()),
    );
}

export async function listIngestionSources(): Promise<ConnectionConfig[]> {
    const sources = await fetchIngestionSources();
    return sources.map((src) => {
        const lastExec = src.executions?.executionRequests?.[0];
        const connDetails = parseRecipe(src.config?.recipe, src.type);
        return {
            id: src.urn,
            name: src.name,
            type: mapIngestionType(src.type),
            host: connDetails.host,
            port: connDetails.port,
            database: connDetails.database,
            username: connDetails.username,
            ssl: false,
            status: mapExecStatus(lastExec),
            lastTestedAt: lastExec?.result?.startTimeMs
                ? new Date(lastExec.result.startTimeMs).toISOString()
                : undefined,
        };
    });
}

export async function listIngestionSchedules(): Promise<AutoUpdateSchedule[]> {
    const sources = await fetchIngestionSources();
    return sources.map((src) => {
        const lastExec = src.executions?.executionRequests?.[0];
        const { frequency, cronExpression } = mapCronToFrequency(src.schedule?.interval);
        const hasSchedule = !!src.schedule?.interval;

        let lastRunStatus: AutoUpdateSchedule['lastRunStatus'];
        const rawStatus = lastExec?.result?.status?.toUpperCase();
        if (rawStatus === 'SUCCESS') lastRunStatus = 'SUCCESS';
        else if (rawStatus === 'FAILURE' || rawStatus === 'FAILED') lastRunStatus = 'FAILED';
        else if (rawStatus === 'RUNNING' || rawStatus === 'PENDING') lastRunStatus = 'RUNNING';

        return {
            id: src.urn,
            connectionId: src.urn,
            connectionName: src.name,
            frequency,
            cronExpression,
            enabled: hasSchedule,
            lastRunAt: lastExec?.result?.startTimeMs
                ? new Date(lastExec.result.startTimeMs).toISOString()
                : undefined,
            lastRunStatus,
            retainHistory: 30,
        };
    });
}

// Map platform type key (e.g. "mysql") → connection name (e.g. "MySQL Kho Hàng").
// If multiple connections share the same type, the first one wins.
export async function getPlatformNameMap(): Promise<Record<string, string>> {
    const sources = await listIngestionSources();
    const map: Record<string, string> = {};
    for (const src of sources) {
        // Use CONNECTION_TYPE_TO_SOURCE_TYPE to get the actual DataHub platform key
        // e.g. POSTGRESQL → 'postgres' (matches urn:li:dataPlatform:postgres)
        const key = CONNECTION_TYPE_TO_SOURCE_TYPE[src.type] ?? src.type.toLowerCase();
        if (!map[key]) map[key] = src.name;
    }
    return map;
}

const INGESTION_SOURCE_EXECUTIONS_QUERY = `
    query getIngestionSourceExecutions($urn: String!, $start: Int, $count: Int) {
        ingestionSource(urn: $urn) {
            executions(start: $start, count: $count) {
                total
                executionRequests {
                    urn
                    input { requestedAt executorId }
                    result {
                        status
                        startTimeMs
                        durationMs
                        report
                    }
                }
            }
        }
    }
`;

export type IngestionExecution = {
    urn: string;
    input?: { requestedAt?: number; executorId?: string };
    result?: {
        status: string;
        startTimeMs?: number;
        durationMs?: number;
        report?: string;
    };
};

export async function getIngestionExecutions(
    sourceUrn: string,
    count = 5,
): Promise<IngestionExecution[]> {
    const data = await graphqlQuery<{
        ingestionSource: { executions: { executionRequests: IngestionExecution[] } };
    }>(INGESTION_SOURCE_EXECUTIONS_QUERY, { urn: sourceUrn, start: 0, count });
    return data.ingestionSource?.executions?.executionRequests ?? [];
}

// Trigger an immediate ingestion run for the given source URN
export async function runIngestionSource(ingestionSourceUrn: string): Promise<string> {
    const data = await graphqlQuery<{ createIngestionExecutionRequest: string }>(
        RUN_INGESTION_MUTATION,
        { input: { ingestionSourceUrn } },
    );
    return data.createIngestionExecutionRequest;
}

// ---------------------------------------------------------------------------
// Ingestion source mutations
// ---------------------------------------------------------------------------

const CREATE_INGESTION_SOURCE_MUTATION = `
    mutation createIngestionSource($input: UpdateIngestionSourceInput!) {
        createIngestionSource(input: $input)
    }
`;

const UPDATE_INGESTION_SOURCE_MUTATION = `
    mutation updateIngestionSource($urn: String!, $input: UpdateIngestionSourceInput!) {
        updateIngestionSource(urn: $urn, input: $input)
    }
`;

const DELETE_INGESTION_SOURCE_MUTATION = `
    mutation deleteIngestionSource($urn: String!) {
        deleteIngestionSource(urn: $urn)
    }
`;

const CONNECTION_TYPE_TO_SOURCE_TYPE: Record<ConnectionType, string> = {
    CUSTOM: 'custom',
    MYSQL: 'mysql',
    POSTGRESQL: 'postgres',
    ORACLE: 'oracle',
    MSSQL: 'mssql',
    MONGODB: 'mongodb',
    KAFKA: 'kafka',
    HIVE: 'hive',
    SPARK: 'spark',
    REST_API: 'openapi',
    JDBC: 'jdbc',
};

export function frequencyToCron(frequency: ScheduleFrequency, cronExpression?: string): string {
    if (frequency === 'CUSTOM') return cronExpression ?? '0 0 * * *';
    const map: Record<Exclude<ScheduleFrequency, 'CUSTOM'>, string> = {
        HOURLY: '0 * * * *',
        DAILY: '0 0 * * *',
        WEEKLY: '0 0 * * 0',
        MONTHLY: '0 0 1 * *',
    };
    return map[frequency];
}

function buildRecipe(values: {
    type: ConnectionType;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    schema?: string;
    serviceNameOrSid?: string;
    bootstrapServers?: string;
    schemaRegistryUrl?: string;
    connectionUrl?: string;
    token?: string;
    customRecipe?: string;
}): string {
    const { type } = values;

    if (type === 'CUSTOM') {
        return values.customRecipe ?? '{}';
    }

    const sourceType = CONNECTION_TYPE_TO_SOURCE_TYPE[type];
    const config: Record<string, unknown> = {};
    const sink = { type: 'datahub-rest', config: { server: 'http://datahub-gms:8080' } };

    if (type === 'KAFKA') {
        config.connection = {
            bootstrap: values.bootstrapServers ?? `${values.host}:${values.port}`,
            ...(values.schemaRegistryUrl ? { schema_registry_url: values.schemaRegistryUrl } : {}),
        };
    } else if (type === 'MONGODB') {
        const auth = values.username ? `${values.username}${values.password ? `:${values.password}` : ''}@` : '';
        config.connect_uri = `mongodb://${auth}${values.host}:${values.port}/${values.database ?? ''}`;
    } else if (type === 'REST_API') {
        config.url = values.connectionUrl ?? `http://${values.host}:${values.port}`;
        if (values.token) config.token = values.token;
    } else if (type === 'JDBC') {
        config.connect_uri = values.connectionUrl ?? '';
        if (values.username) config.username = values.username;
        if (values.password) config.password = values.password;
    } else if (type === 'ORACLE') {
        config.host_port = `${values.host}:${values.port}`;
        if (values.serviceNameOrSid) config.service_name = values.serviceNameOrSid;
        if (values.username) config.username = values.username;
        if (values.password) config.password = values.password;
    } else {
        // MySQL, POSTGRESQL, MSSQL, HIVE, SPARK
        config.host_port = `${values.host}:${values.port}`;
        if (values.database) config.database = values.database;
        if (values.username) config.username = values.username;
        if (values.password) config.password = values.password;
        if (values.ssl) config.use_ssl = true;
        if (type === 'POSTGRESQL' && values.schema) config.schema_pattern = { allow: [values.schema] };
    }

    return JSON.stringify({ source: { type: sourceType, config }, sink });
}

export async function createIngestionSource(values: Omit<ConnectionConfig, 'id' | 'status' | 'lastTestedAt'>): Promise<string> {
    const recipe = buildRecipe(values);
    const data = await graphqlQuery<{ createIngestionSource: string }>(
        CREATE_INGESTION_SOURCE_MUTATION,
        {
            input: {
                name: values.name,
                type: values.type === 'CUSTOM' ? 'custom' : CONNECTION_TYPE_TO_SOURCE_TYPE[values.type],
                config: { recipe, executorId: 'default' },
            },
        },
    );
    return data.createIngestionSource;
}

export async function updateIngestionSourceDetails(urn: string, values: Omit<ConnectionConfig, 'id' | 'status' | 'lastTestedAt'>): Promise<void> {
    const sources = await fetchIngestionSources();
    const src = sources.find((s) => s.urn === urn);
    const recipe = buildRecipe(values);

    const input: Record<string, unknown> = {
        name: values.name,
        type: values.type === 'CUSTOM' ? 'custom' : CONNECTION_TYPE_TO_SOURCE_TYPE[values.type],
        config: { recipe, executorId: 'default' },
    };
    if (src?.schedule?.interval) {
        input.schedule = {
            interval: src.schedule.interval,
            timezone: src.schedule.timezone ?? 'Asia/Ho_Chi_Minh',
        };
    }

    await graphqlQuery(UPDATE_INGESTION_SOURCE_MUTATION, { urn, input });
}

export async function updateIngestionSourceSchedule(
    urn: string,
    enabled: boolean,
    frequency: ScheduleFrequency,
    cronExpression?: string,
): Promise<void> {
    const sources = await fetchIngestionSources();
    const src = sources.find((s) => s.urn === urn);
    if (!src) throw new Error(`Ingestion source not found: ${urn}`);

    const input: Record<string, unknown> = {
        name: src.name,
        type: src.type,
        config: { recipe: src.config?.recipe ?? '{}', executorId: 'default' },
    };
    if (enabled) {
        input.schedule = {
            interval: frequencyToCron(frequency, cronExpression),
            timezone: src.schedule?.timezone ?? 'Asia/Ho_Chi_Minh',
        };
    }

    await graphqlQuery(UPDATE_INGESTION_SOURCE_MUTATION, { urn, input });
}

export async function deleteIngestionSource(urn: string): Promise<void> {
    await graphqlQuery<{ deleteIngestionSource: boolean }>(
        DELETE_INGESTION_SOURCE_MUTATION,
        { urn },
    );
}


// ---------------------------------------------------------------------------
// Lineage
// ---------------------------------------------------------------------------

const LINEAGE_QUERY = `
    query getLineage($input: SearchAcrossLineageInput!) {
        searchAcrossLineage(input: $input) {
            searchResults {
                degree
                entity {
                    urn
                    type
                    ... on Dataset {
                        name
                        platform { name }
                        properties { name }
                    }
                    ... on Dashboard {
                        properties { name }
                        platform { name }
                    }
                    ... on Chart {
                        properties { name }
                        platform { name }
                    }
                    ... on DataJob {
                        jobId
                        properties { name }
                        dataFlow { platform { name } }
                    }
                    ... on DataFlow {
                        flowId
                        properties { name }
                        platform { name }
                    }
                    ... on CorpUser { username }
                    ... on CorpGroup { name }
                }
            }
        }
    }
`;

export type LineageEntity = {
    urn: string;
    name: string;
    type: EntityType;
    platform: string;
};

type LineageResponse = {
    searchAcrossLineage: {
        searchResults: Array<{ degree: number; entity: GmsEntity }>;
    };
};

export async function fetchEntityLineage(urn: string): Promise<{
    upstreams: LineageEntity[];
    downstreams: LineageEntity[];
}> {
    const [upResult, downResult] = await Promise.all([
        graphqlQuery<LineageResponse>(LINEAGE_QUERY, {
            input: { urn, direction: 'UPSTREAM', start: 0, count: 30 },
        }),
        graphqlQuery<LineageResponse>(LINEAGE_QUERY, {
            input: { urn, direction: 'DOWNSTREAM', start: 0, count: 30 },
        }),
    ]);

    const mapNode = (e: GmsEntity): LineageEntity => ({
        urn: e.urn,
        name: resolveName(e),
        type: mapEntityType(e.type),
        platform: resolvePlatform(e),
    });

    return {
        upstreams: upResult.searchAcrossLineage.searchResults
            .filter((r) => r.degree === 1)
            .map((r) => mapNode(r.entity)),
        downstreams: downResult.searchAcrossLineage.searchResults
            .filter((r) => r.degree === 1)
            .map((r) => mapNode(r.entity)),
    };
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

const GMS_ENTITY_TYPE: Record<string, string> = {
    DATASET: 'dataset',
    DASHBOARD: 'dashboard',
    CHART: 'chart',
    DATA_FLOW: 'dataFlow',
    DATA_JOB: 'dataJob',
    CORP_USER: 'corpUser',
    CORP_GROUP: 'corpGroup',
};

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

    // Combine manually typed tags + selected project tag
    const allTags = [...data.tags];
    if (data.projectId && !allTags.includes(data.projectId)) {
        allTags.push(data.projectId);
    }
    if (allTags.length > 0) {
        proposals.push(
            buildMcp(entityType, urn, 'globalTags', {
                tags: allTags.map((tag) => ({
                    tag: tag.startsWith('urn:li:tag:') ? tag : `urn:li:tag:${tag}`,
                })),
            }),
        );
    }

    // Domain assignment (departmentId is a domain URN when using real data)
    if (data.departmentId && data.departmentId.startsWith('urn:li:domain:')) {
        proposals.push(
            buildMcp(entityType, urn, 'domains', {
                domains: [data.departmentId],
            }),
        );
    }

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

    await apiClient.post('/api/aspects?action=ingestProposalBatch', {
        proposals,
        async: false,
    });
}
