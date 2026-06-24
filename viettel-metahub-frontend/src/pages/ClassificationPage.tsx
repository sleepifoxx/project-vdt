import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Typography, Badge, Tag, Table, Space, Empty, Button, Spin, Select, message } from 'antd';
import type { EntityType } from '../types';

const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
    DATASET: 'Bộ dữ liệu',
    DASHBOARD: 'Dashboard',
    CHART: 'Biểu đồ',
    DATA_FLOW: 'Luồng dữ liệu',
    DATA_JOB: 'Công việc',
    CORP_USER: 'Người dùng',
    CORP_GROUP: 'Nhóm',
};
import { ApartmentOutlined, FilterOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import AppLayout from '../components/layout/AppLayout';
import DepartmentTree from '../components/classification/DepartmentTree';
import ProjectFilter from '../components/classification/ProjectFilter';
import type { MetadataEntity, Department, Project } from '../types';
import {
    searchEntities,
    listDomains,
    getTagAggregations,
    updateEntityTags,
    removeEntityTag,
    updateEntityDomains,
    refetchEntityMeta,
} from '../api/datahubApi';

const { Text } = Typography;

const PageWrapper = styled.div`
    padding: 24px;
`;

const PageTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;

    h2 {
        font-size: 18px;
        font-weight: 700;
        color: #212121;
        margin: 0;
    }

    .anticon {
        color: #ee0033;
        font-size: 20px;
    }
`;

const ResultsPanel = styled.div`
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
    overflow: hidden;
`;

const ResultsHeader = styled.div`
    padding: 14px 20px;
    border-bottom: 1px solid #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const ActiveFilterBadge = styled(Badge)`
    .ant-badge-count {
        background: #ee0033;
    }
`;

const AddButton = styled(Button)`
    font-size: 11px !important;
    height: 22px !important;
    padding: 0 6px !important;
    border-style: dashed !important;
`;

export default function ClassificationPage() {
    const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [entities, setEntities] = useState<MetadataEntity[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);

    const [availableDomains, setAvailableDomains] = useState<Department[]>([]);
    const [availableTags, setAvailableTags] = useState<Project[]>([]);
    const [addingDomainFor, setAddingDomainFor] = useState<string | null>(null);
    const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
    const [saving, setSaving] = useState<Set<string>>(new Set());

    const pageSize = 10;

    useEffect(() => {
        listDomains().then(setAvailableDomains).catch(() => {});
        getTagAggregations().then(setAvailableTags).catch(() => {});
    }, []);

    const loadEntities = useCallback(
        async (currentPage: number) => {
            setLoading(true);
            try {
                const result = await searchEntities({
                    query: '*',
                    types: ['DATASET', 'DASHBOARD', 'CHART', 'DATA_FLOW', 'DATA_JOB'],
                    domainUrns: selectedDomains.length > 0 ? selectedDomains : undefined,
                    tagUrns: selectedTags.length > 0 ? selectedTags : undefined,
                    start: (currentPage - 1) * pageSize,
                    count: pageSize,
                });
                setEntities(result.entities);
                setTotal(result.total);
            } catch {
                setEntities([]);
                setTotal(0);
            } finally {
                setLoading(false);
            }
        },
        [selectedDomains, selectedTags],
    );

    useEffect(() => {
        setPage(1);
        loadEntities(1);
    }, [selectedDomains, selectedTags, loadEntities]);

    const updateEntity = (urn: string, updater: (e: MetadataEntity) => MetadataEntity) => {
        setEntities((prev) => prev.map((e) => (e.urn === urn ? updater(e) : e)));
    };

    const setSavingFor = (urn: string, on: boolean) => {
        setSaving((prev) => {
            const next = new Set(prev);
            on ? next.add(urn) : next.delete(urn);
            return next;
        });
    };

    const applyConfirmedMeta = async (urn: string) => {
        const fresh = await refetchEntityMeta(urn);
        if (fresh) updateEntity(urn, (e) => ({ ...e, ...fresh }));
    };

    const handleAddDomain = async (entity: MetadataEntity, domainUrn: string) => {
        const domain = availableDomains.find((d) => d.id === domainUrn);
        if (!domain) return;
        setAddingDomainFor(null);
        setSavingFor(entity.urn, true);
        const newDomains = [
            ...(entity.domains ?? []).filter((d) => d.urn !== domainUrn),
            { urn: domainUrn, name: domain.name },
        ];
        try {
            await updateEntityDomains(entity.urn, newDomains.map((d) => d.urn));
            updateEntity(entity.urn, (e) => ({ ...e, domains: newDomains }));
            await applyConfirmedMeta(entity.urn);
        } catch (err) {
            console.error('[handleAddDomain]', err);
            message.error('Không thể gán domain');
        } finally {
            setSavingFor(entity.urn, false);
        }
    };

    const handleRemoveDomain = async (entity: MetadataEntity, domainUrn: string) => {
        setSavingFor(entity.urn, true);
        const newDomains = (entity.domains ?? []).filter((d) => d.urn !== domainUrn);
        try {
            await updateEntityDomains(entity.urn, newDomains.map((d) => d.urn));
            updateEntity(entity.urn, (e) => ({ ...e, domains: newDomains }));
            await applyConfirmedMeta(entity.urn);
        } catch (err) {
            console.error('[handleRemoveDomain]', err);
            message.error('Không thể xoá domain');
        } finally {
            setSavingFor(entity.urn, false);
        }
    };

    const handleAddTag = async (entity: MetadataEntity, tagUrn: string) => {
        const tag = availableTags.find((t) => t.id === tagUrn);
        if (!tag) return;
        setAddingTagFor(null);
        setSavingFor(entity.urn, true);
        try {
            await updateEntityTags(entity.urn, [tagUrn]);
            updateEntity(entity.urn, (e) => ({
                ...e,
                tags: e.tags.includes(tag.name) ? e.tags : [...e.tags, tag.name],
            }));
            await applyConfirmedMeta(entity.urn);
        } catch (err) {
            console.error('[handleAddTag]', err);
            message.error('Không thể thêm tag');
        } finally {
            setSavingFor(entity.urn, false);
        }
    };

    const handleRemoveTag = async (entity: MetadataEntity, tagName: string) => {
        setSavingFor(entity.urn, true);
        try {
            await removeEntityTag(entity.urn, `urn:li:tag:${tagName}`);
            updateEntity(entity.urn, (e) => ({ ...e, tags: e.tags.filter((t) => t !== tagName) }));
            await applyConfirmedMeta(entity.urn);
        } catch (err) {
            console.error('[handleRemoveTag]', err);
            message.error('Không thể xoá tag');
        } finally {
            setSavingFor(entity.urn, false);
        }
    };

    const columns = [
        {
            title: 'Tên đối tượng',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: MetadataEntity) => (
                <div>
                    <Text strong style={{ fontSize: 13, color: '#ee0033' }}>
                        {name}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        {record.platform.toUpperCase()}
                    </Text>
                </div>
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            key: 'type',
            width: 130,
            render: (type: EntityType) => (
                <Tag color="blue">{ENTITY_TYPE_LABEL[type] ?? type}</Tag>
            ),
        },
        {
            title: 'Domain',
            key: 'domains',
            width: 260,
            render: (_: unknown, record: MetadataEntity) => {
                const isSaving = saving.has(record.urn);
                const isAdding = addingDomainFor === record.urn;
                const currentDomainUrns = new Set((record.domains ?? []).map((d) => d.urn));
                const domainOptions = availableDomains
                    .filter((d) => !currentDomainUrns.has(d.id))
                    .map((d) => ({ value: d.id, label: d.name }));

                return (
                    <Spin spinning={isSaving} size="small">
                        <Space wrap size={[4, 4]}>
                            {(record.domains ?? []).map((d) => (
                                <Tag
                                    key={d.urn}
                                    color="purple"
                                    closeIcon={<CloseOutlined style={{ fontSize: 10, color: '#9b59b6' }} />}
                                    closable
                                    onClose={(e) => {
                                        e.preventDefault();
                                        handleRemoveDomain(record, d.urn);
                                    }}
                                    style={{ fontSize: 12, margin: 0, paddingRight: 4 }}
                                >
                                    {d.name}
                                </Tag>
                            ))}
                            {isAdding ? (
                                <Select
                                    autoFocus
                                    open
                                    size="small"
                                    style={{ minWidth: 150 }}
                                    options={domainOptions}
                                    placeholder="Chọn domain..."
                                    onSelect={(val: string) => handleAddDomain(record, val)}
                                    onBlur={() => setAddingDomainFor(null)}
                                    showSearch
                                    filterOption={(input, opt) =>
                                        String(opt?.label ?? '')
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    notFoundContent="Không có domain"
                                />
                            ) : (
                                <AddButton
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => setAddingDomainFor(record.urn)}
                                />
                            )}
                        </Space>
                    </Spin>
                );
            },
        },
        {
            title: 'Tags',
            key: 'tags',
            render: (_: unknown, record: MetadataEntity) => {
                const isSaving = saving.has(record.urn);
                const isAdding = addingTagFor === record.urn;
                const currentTagNames = new Set(record.tags);
                const tagOptions = availableTags
                    .filter((t) => !currentTagNames.has(t.name))
                    .map((t) => ({ value: t.id, label: t.name }));

                return (
                    <Spin spinning={isSaving} size="small">
                        <Space wrap size={[4, 4]}>
                            {record.tags.map((tag) => (
                                <Tag
                                    key={tag}
                                    closeIcon={<CloseOutlined style={{ fontSize: 10 }} />}
                                    closable
                                    onClose={(e) => {
                                        e.preventDefault();
                                        handleRemoveTag(record, tag);
                                    }}
                                    style={{ borderRadius: 4, fontSize: 12, margin: 0, paddingRight: 4 }}
                                >
                                    {tag}
                                </Tag>
                            ))}
                            {isAdding ? (
                                <Select
                                    autoFocus
                                    open
                                    size="small"
                                    style={{ minWidth: 150 }}
                                    options={tagOptions}
                                    placeholder="Chọn tag..."
                                    onSelect={(val: string) => handleAddTag(record, val)}
                                    onBlur={() => setAddingTagFor(null)}
                                    showSearch
                                    filterOption={(input, opt) =>
                                        String(opt?.label ?? '')
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    notFoundContent="Không có tag"
                                />
                            ) : (
                                <AddButton
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => setAddingTagFor(record.urn)}
                                />
                            )}
                        </Space>
                    </Spin>
                );
            },
        },
        {
            title: 'Người sở hữu',
            dataIndex: 'owner',
            key: 'owner',
            width: 130,
            render: (owner: string) =>
                owner ? (
                    <Text style={{ fontSize: 12 }}>{owner}</Text>
                ) : (
                    <Text type="secondary">—</Text>
                ),
        },
    ];

    const totalFilters = selectedDomains.length + selectedTags.length;

    const clearFilters = () => {
        setSelectedDomains([]);
        setSelectedTags([]);
    };

    return (
        <AppLayout pageTitle="Phân loại dữ liệu">
            <PageWrapper>
                <PageTitle>
                    <ApartmentOutlined />
                    <h2>Phân loại theo Domain & Tag</h2>
                    {totalFilters > 0 && (
                        <ActiveFilterBadge
                            count={totalFilters}
                            title={`${totalFilters} bộ lọc đang áp dụng`}
                        />
                    )}
                </PageTitle>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={7}>
                        <Space direction="vertical" style={{ width: '100%' }} size={16}>
                            <DepartmentTree
                                onSelect={setSelectedDomains}
                                selectedKeys={selectedDomains}
                            />
                            <ProjectFilter
                                selectedDepartmentIds={selectedDomains}
                                selectedProjectIds={selectedTags}
                                onProjectSelect={setSelectedTags}
                            />
                        </Space>
                    </Col>

                    <Col xs={24} lg={17}>
                        <ResultsPanel>
                            <ResultsHeader>
                                <Space>
                                    <FilterOutlined style={{ color: '#ee0033' }} />
                                    <Text style={{ fontSize: 14, fontWeight: 600 }}>
                                        Kết quả phân loại
                                    </Text>
                                    <Tag color="red">{total} đối tượng</Tag>
                                </Space>

                                {totalFilters > 0 && (
                                    <Button size="small" onClick={clearFilters}>
                                        Xoá bộ lọc
                                    </Button>
                                )}
                            </ResultsHeader>

                            <Table
                                columns={columns}
                                dataSource={entities}
                                rowKey="urn"
                                size="middle"
                                loading={loading}
                                pagination={{
                                    current: page,
                                    pageSize,
                                    total,
                                    showTotal: (t) => `Tổng ${t} kết quả`,
                                    onChange: (p) => {
                                        setPage(p);
                                        loadEntities(p);
                                    },
                                }}
                                locale={{
                                    emptyText: (
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description={
                                                totalFilters > 0
                                                    ? 'Không có dữ liệu phù hợp với bộ lọc'
                                                    : 'Chọn domain hoặc tag để lọc dữ liệu'
                                            }
                                        />
                                    ),
                                }}
                            />
                        </ResultsPanel>
                    </Col>
                </Row>
            </PageWrapper>
        </AppLayout>
    );
}
