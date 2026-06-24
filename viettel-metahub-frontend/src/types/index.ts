export type EntityType =
    | 'DATASET'
    | 'DASHBOARD'
    | 'CHART'
    | 'DATA_FLOW'
    | 'DATA_JOB'
    | 'CORP_USER'
    | 'CORP_GROUP';

export type MetadataStatus = 'ACTIVE' | 'DEPRECATED' | 'REMOVED';

export type ConnectionType = 'MYSQL' | 'POSTGRESQL' | 'ORACLE' | 'MSSQL' | 'MONGODB' | 'KAFKA' | 'HIVE' | 'SPARK' | 'REST_API' | 'JDBC';

export type ScheduleFrequency = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface Department {
    id: string;
    name: string;
    code: string;
    parentId?: string;
    children?: Department[];
}

export interface Project {
    id: string;
    name: string;
    code: string;
    departmentId: string;
    description?: string;
    status: 'ACTIVE' | 'INACTIVE';
}

export interface MetadataEntity {
    urn: string;
    type: EntityType;
    name: string;
    platform: string;
    description?: string;
    department?: Department;
    project?: Project;
    owner?: string;
    tags: string[];
    domains?: Array<{ urn: string; name: string }>;
    status: MetadataStatus;
    lastUpdated: string;
    createdAt: string;
}

export interface SearchResult {
    entities: MetadataEntity[];
    total: number;
    page: number;
    pageSize: number;
}

export interface SearchFilters {
    keyword: string;
    entityTypes: EntityType[];
    departments: string[];
    projects: string[];
    platforms: string[];
    tags: string[];
    status?: MetadataStatus;
    dateRange?: {
        from: string;
        to: string;
    };
}

export interface ConnectionConfig {
    id: string;
    name: string;
    type: ConnectionType;
    host: string;
    port: number;
    database?: string;
    username: string;
    password?: string;
    ssl: boolean;
    extraParams?: Record<string, string>;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'TESTING';
    lastTestedAt?: string;
}

export interface AutoUpdateSchedule {
    id: string;
    connectionId: string;
    connectionName: string;
    frequency: ScheduleFrequency;
    cronExpression?: string;
    enabled: boolean;
    lastRunAt?: string;
    nextRunAt?: string;
    lastRunStatus?: 'SUCCESS' | 'FAILED' | 'RUNNING';
    retainHistory: number;
}

export interface MetadataFormData {
    urn?: string;
    type: EntityType;
    name: string;
    platform: string;
    subType?: string;
    description: string;
    departmentId: string;
    projectId: string;
    owner: string;
    tags: string[];
    customProperties: Array<{ key: string; value: string }>;
    schemaFields?: Array<{
        fieldPath: string;
        nativeDataType: string;
        description: string;
        nullable: boolean;
        isKey: boolean;
    }>;
}
