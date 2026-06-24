import React, { useState, useEffect } from 'react';
import {
    Modal, Tabs, Tag, Typography, Space, Spin, Empty, Table, Badge,
    Button, Select, Tooltip, message,
} from 'antd';
import {
    DatabaseOutlined, DashboardOutlined, BarChartOutlined, NodeIndexOutlined,
    CopyOutlined, PlusOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { ColumnsType } from 'antd/es/table';
import type { MetadataEntity, EntityType, Department, Project } from '../../types';
import {
    fetchDatasetSchema, listDomains, getTagAggregations,
    updateEntityDomains, updateEntityTags, removeEntityTag, refetchEntityMeta,
} from '../../api/datahubApi';
import type { SchemaField } from '../../api/datahubApi';

const { Text, Paragraph } = Typography;

const Header = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding-right: 32px;
`;

const EntityIconWrap = styled.div`
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
`;

const HeaderInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const EntityName = styled.div`
    font-size: 16px;
    font-weight: 700;
    color: #212121;
    line-height: 1.3;
    word-break: break-word;
`;

const UrnRow = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
`;

const UrnText = styled(Text)`
    font-size: 11px;
    color: #9e9e9e;
    font-family: monospace;
    word-break: break-all;
`;

const SectionLabel = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: #757575;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    margin-top: 16px;
`;

const InfoRow = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
`;

const InfoLabel = styled(Text)`
    font-size: 12px;
    color: #9e9e9e;
    min-width: 100px;
    flex-shrink: 0;
`;

const AddButton = styled(Button)`
    font-size: 11px !important;
    height: 22px !important;
    padding: 0 6px !important;
    border-style: dashed !important;
`;

const ENTITY_ICON: Record<EntityType, React.ReactNode> = {
    DATASET: <DatabaseOutlined style={{ color: '#1677ff' }} />,
    DASHBOARD: <DashboardOutlined style={{ color: '#722ed1' }} />,
    CHART: <BarChartOutlined style={{ color: '#13c2c2' }} />,
    DATA_FLOW: <NodeIndexOutlined style={{ color: '#fa8c16' }} />,
    DATA_JOB: <NodeIndexOutlined style={{ color: '#52c41a' }} />,
    CORP_USER: <DatabaseOutlined style={{ color: '#eb2f96' }} />,
    CORP_GROUP: <DatabaseOutlined style={{ color: '#faad14' }} />,
};

const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
    DATASET: 'Bộ dữ liệu',
    DASHBOARD: 'Dashboard',
    CHART: 'Biểu đồ',
    DATA_FLOW: 'Luồng dữ liệu',
    DATA_JOB: 'Công việc',
    CORP_USER: 'Người dùng',
    CORP_GROUP: 'Nhóm',
};

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'error'> = {
    ACTIVE: 'success',
    DEPRECATED: 'warning',
    REMOVED: 'error',
};

const STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'Hoạt động',
    DEPRECATED: 'Lỗi thời',
    REMOVED: 'Đã xoá',
};

type Props = {
    entity: MetadataEntity | null;
    open: boolean;
    onClose: () => void;
    onEntityUpdated: (updated: MetadataEntity) => void;
};

export default function EntityDetailDrawer({ entity, open, onClose, onEntityUpdated }: Props) {
    const [localEntity, setLocalEntity] = useState<MetadataEntity | null>(null);
    const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [availableDomains, setAvailableDomains] = useState<Department[]>([]);
    const [availableTags, setAvailableTags] = useState<Project[]>([]);
    const [saving, setSaving] = useState(false);
    const [addingDomain, setAddingDomain] = useState(false);
    const [addingTag, setAddingTag] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (open && entity) {
            setLocalEntity(entity);
            setActiveTab('overview');
            listDomains().then(setAvailableDomains).catch(() => {});
            getTagAggregations().then(setAvailableTags).catch(() => {});
        }
    }, [open, entity]);

    useEffect(() => {
        if (activeTab === 'schema' && localEntity?.type === 'DATASET' && localEntity.urn) {
            setSchemaLoading(true);
            fetchDatasetSchema(localEntity.urn)
                .then(setSchemaFields)
                .catch(() => setSchemaFields([]))
                .finally(() => setSchemaLoading(false));
        }
    }, [activeTab, localEntity?.urn, localEntity?.type]);

    const applyUpdate = (updater: (e: MetadataEntity) => MetadataEntity) => {
        setLocalEntity((prev) => {
            if (!prev) return prev;
            const next = updater(prev);
            onEntityUpdated(next);
            return next;
        });
    };

    const withSaving = async (fn: () => Promise<void>) => {
        setSaving(true);
        try {
            await fn();
        } finally {
            setSaving(false);
        }
    };

    const refreshMeta = async (urn: string) => {
        const fresh = await refetchEntityMeta(urn);
        if (fresh) applyUpdate((e) => ({ ...e, ...fresh }));
    };

    const handleAddDomain = async (domainUrn: string) => {
        if (!localEntity) return;
        const domain = availableDomains.find((d) => d.id === domainUrn);
        if (!domain) return;
        setAddingDomain(false);
        await withSaving(async () => {
            const newDomains = [
                ...(localEntity.domains ?? []).filter((d) => d.urn !== domainUrn),
                { urn: domainUrn, name: domain.name },
            ];
            try {
                await updateEntityDomains(localEntity.urn, newDomains.map((d) => d.urn));
                applyUpdate((e) => ({ ...e, domains: newDomains }));
                await refreshMeta(localEntity.urn);
            } catch {
                message.error('Không thể gán domain');
            }
        });
    };

    const handleRemoveDomain = async (domainUrn: string) => {
        if (!localEntity) return;
        await withSaving(async () => {
            const newDomains = (localEntity.domains ?? []).filter((d) => d.urn !== domainUrn);
            try {
                await updateEntityDomains(localEntity.urn, newDomains.map((d) => d.urn));
                applyUpdate((e) => ({ ...e, domains: newDomains }));
                await refreshMeta(localEntity.urn);
            } catch {
                message.error('Không thể xoá domain');
            }
        });
    };

    const handleAddTag = async (tagUrn: string) => {
        if (!localEntity) return;
        const tag = availableTags.find((t) => t.id === tagUrn);
        if (!tag) return;
        setAddingTag(false);
        await withSaving(async () => {
            try {
                await updateEntityTags(localEntity.urn, [tagUrn]);
                applyUpdate((e) => ({
                    ...e,
                    tags: e.tags.includes(tag.name) ? e.tags : [...e.tags, tag.name],
                }));
                await refreshMeta(localEntity.urn);
            } catch {
                message.error('Không thể thêm tag');
            }
        });
    };

    const handleRemoveTag = async (tagName: string) => {
        if (!localEntity) return;
        await withSaving(async () => {
            try {
                await removeEntityTag(localEntity.urn, `urn:li:tag:${tagName}`);
                applyUpdate((e) => ({ ...e, tags: e.tags.filter((t) => t !== tagName) }));
                await refreshMeta(localEntity.urn);
            } catch {
                message.error('Không thể xoá tag');
            }
        });
    };

    const copyUrn = () => {
        if (!localEntity) return;
        navigator.clipboard.writeText(localEntity.urn).then(() => message.success('Đã sao chép URN'));
    };

    const currentDomainUrns = new Set((localEntity?.domains ?? []).map((d) => d.urn));
    const domainOptions = availableDomains
        .filter((d) => !currentDomainUrns.has(d.id))
        .map((d) => ({ value: d.id, label: d.name }));

    const currentTagNames = new Set(localEntity?.tags ?? []);
    const tagOptions = availableTags
        .filter((t) => !currentTagNames.has(t.name))
        .map((t) => ({ value: t.id, label: t.name }));

    const schemaColumns: ColumnsType<SchemaField> = [
        {
            title: 'Trường',
            dataIndex: 'fieldPath',
            key: 'fieldPath',
            render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
        },
        {
            title: 'Kiểu dữ liệu',
            dataIndex: 'nativeDataType',
            key: 'nativeDataType',
            width: 130,
            render: (v: string) => <Tag style={{ fontSize: 11 }}>{v}</Tag>,
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (v: string) => <Text style={{ fontSize: 12, color: '#616161' }}>{v || '—'}</Text>,
        },
        {
            title: 'PK',
            dataIndex: 'isPartOfKey',
            key: 'isPartOfKey',
            width: 50,
            render: (v: boolean) => v ? <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>PK</Tag> : null,
        },
        {
            title: 'Nullable',
            dataIndex: 'nullable',
            key: 'nullable',
            width: 75,
            render: (v: boolean) => (
                <Badge status={v ? 'default' : 'success'} text={v ? 'Có' : 'Không'} />
            ),
        },
    ];

    const overviewTab = localEntity && (
        <Spin spinning={saving}>
            <SectionLabel>Thông tin chung</SectionLabel>
            <InfoRow>
                <InfoLabel>Nền tảng</InfoLabel>
                <Tag style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                    {localEntity.platform || '—'}
                </Tag>
            </InfoRow>
            <InfoRow>
                <InfoLabel>Người sở hữu</InfoLabel>
                <Text style={{ fontSize: 13 }}>{localEntity.owner || '—'}</Text>
            </InfoRow>
            <InfoRow>
                <InfoLabel>Trạng thái</InfoLabel>
                <Badge
                    status={STATUS_BADGE[localEntity.status]}
                    text={STATUS_LABEL[localEntity.status]}
                />
            </InfoRow>

            {localEntity.description && (
                <>
                    <SectionLabel>Mô tả</SectionLabel>
                    <Paragraph style={{ fontSize: 13, color: '#424242', marginBottom: 0 }}>
                        {localEntity.description}
                    </Paragraph>
                </>
            )}

            <SectionLabel>Domain</SectionLabel>
            <Space wrap size={[6, 6]}>
                {(localEntity.domains ?? []).map((d) => (
                    <Tag
                        key={d.urn}
                        color="purple"
                        closable
                        onClose={(e) => { e.preventDefault(); handleRemoveDomain(d.urn); }}
                        style={{ fontSize: 12, margin: 0 }}
                    >
                        {d.name}
                    </Tag>
                ))}
                {addingDomain ? (
                    <Select
                        autoFocus
                        open
                        size="small"
                        style={{ minWidth: 180 }}
                        options={domainOptions}
                        placeholder="Chọn domain..."
                        onSelect={(val: string) => handleAddDomain(val)}
                        onBlur={() => setAddingDomain(false)}
                        showSearch
                        filterOption={(input, opt) =>
                            String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        notFoundContent="Không có domain"
                    />
                ) : (
                    <AddButton size="small" icon={<PlusOutlined />} onClick={() => setAddingDomain(true)}>
                        Thêm domain
                    </AddButton>
                )}
            </Space>

            <SectionLabel>Tags</SectionLabel>
            <Space wrap size={[6, 6]}>
                {localEntity.tags.map((tag) => (
                    <Tag
                        key={tag}
                        closable
                        onClose={(e) => { e.preventDefault(); handleRemoveTag(tag); }}
                        style={{ borderRadius: 4, fontSize: 12, margin: 0 }}
                    >
                        {tag}
                    </Tag>
                ))}
                {addingTag ? (
                    <Select
                        autoFocus
                        open
                        size="small"
                        style={{ minWidth: 180 }}
                        options={tagOptions}
                        placeholder="Chọn tag..."
                        onSelect={(val: string) => handleAddTag(val)}
                        onBlur={() => setAddingTag(false)}
                        showSearch
                        filterOption={(input, opt) =>
                            String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        notFoundContent="Không có tag"
                    />
                ) : (
                    <AddButton size="small" icon={<PlusOutlined />} onClick={() => setAddingTag(true)}>
                        Thêm tag
                    </AddButton>
                )}
            </Space>
        </Spin>
    );

    const schemaTab = (
        <Spin spinning={schemaLoading}>
            {schemaFields.length > 0 ? (
                <Table
                    columns={schemaColumns}
                    dataSource={schemaFields}
                    rowKey="fieldPath"
                    size="small"
                    pagination={{ pageSize: 20, hideOnSinglePage: true }}
                    scroll={{ x: 600 }}
                />
            ) : (
                !schemaLoading && (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Không có thông tin schema"
                    />
                )
            )}
        </Spin>
    );

    const historyTab = localEntity && (
        <div>
            <SectionLabel>Lịch sử</SectionLabel>
            <InfoRow>
                <InfoLabel>Cập nhật lần cuối</InfoLabel>
                <Text style={{ fontSize: 13 }}>
                    {new Date(localEntity.lastUpdated).toLocaleString('vi-VN')}
                </Text>
            </InfoRow>
            <InfoRow>
                <InfoLabel>Ngày tạo</InfoLabel>
                <Text style={{ fontSize: 13 }}>
                    {new Date(localEntity.createdAt).toLocaleString('vi-VN')}
                </Text>
            </InfoRow>
            <InfoRow>
                <InfoLabel>Trạng thái</InfoLabel>
                <Badge
                    status={STATUS_BADGE[localEntity.status]}
                    text={STATUS_LABEL[localEntity.status]}
                />
            </InfoRow>
            <SectionLabel>URN</SectionLabel>
            <Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                {localEntity.urn}
            </Text>
        </div>
    );

    const tabItems = [
        { key: 'overview', label: 'Tổng quan', children: overviewTab },
        ...(localEntity?.type === 'DATASET'
            ? [{ key: 'schema', label: 'Schema', children: schemaTab }]
            : []),
        { key: 'history', label: 'Lịch sử', children: historyTab },
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={800}
            footer={null}
            title={
                localEntity && (
                    <Header>
                        <EntityIconWrap>{ENTITY_ICON[localEntity.type]}</EntityIconWrap>
                        <HeaderInfo>
                            <EntityName>{localEntity.name}</EntityName>
                            <Space size={6} style={{ marginTop: 6 }}>
                                <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
                                    {ENTITY_TYPE_LABEL[localEntity.type]}
                                </Tag>
                                {localEntity.platform && (
                                    <Tag style={{ fontSize: 11, margin: 0, textTransform: 'uppercase', fontWeight: 600 }}>
                                        {localEntity.platform}
                                    </Tag>
                                )}
                            </Space>
                            <UrnRow>
                                <UrnText>{localEntity.urn}</UrnText>
                                <Tooltip title="Sao chép URN">
                                    <Button
                                        type="text"
                                        icon={<CopyOutlined />}
                                        size="small"
                                        style={{ color: '#9e9e9e', padding: '0 2px' }}
                                        onClick={copyUrn}
                                    />
                                </Tooltip>
                            </UrnRow>
                        </HeaderInfo>
                    </Header>
                )
            }
            styles={{ body: { padding: '0 24px 24px', maxHeight: '70vh', overflowY: 'auto' } }}
            destroyOnClose
        >
            {localEntity && (
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    size="small"
                />
            )}
        </Modal>
    );
}
