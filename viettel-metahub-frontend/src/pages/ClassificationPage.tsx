import React, { useState } from 'react';
import { Row, Col, Typography, Badge, Tag, Table, Space, Empty, Button } from 'antd';
import { ApartmentOutlined, FilterOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import AppLayout from '../components/layout/AppLayout';
import DepartmentTree from '../components/classification/DepartmentTree';
import ProjectFilter from '../components/classification/ProjectFilter';
import type { MetadataEntity } from '../types';
import { mockEntities } from '../api/mockData';

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

export default function ClassificationPage() {
    const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

    const filteredEntities = mockEntities.filter((e) => {
        const deptMatch =
            selectedDepts.length === 0 || (e.department && selectedDepts.includes(e.department.id));
        const projMatch =
            selectedProjects.length === 0 || (e.project && selectedProjects.includes(e.project.id));
        return deptMatch && projMatch;
    });

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
            render: (type: string) => <Tag color="blue">{type}</Tag>,
        },
        {
            title: 'Phòng ban',
            key: 'department',
            width: 200,
            render: (_: unknown, record: MetadataEntity) =>
                record.department ? (
                    <Text style={{ fontSize: 12 }}>{record.department.name}</Text>
                ) : (
                    <Text type="secondary">—</Text>
                ),
        },
        {
            title: 'Dự án',
            key: 'project',
            width: 180,
            render: (_: unknown, record: MetadataEntity) =>
                record.project ? (
                    <Tag style={{ borderRadius: 4, fontSize: 11 }}>{record.project.name}</Tag>
                ) : (
                    <Text type="secondary">—</Text>
                ),
        },
        {
            title: 'Tags',
            dataIndex: 'tags',
            key: 'tags',
            render: (tags: string[]) => (
                <Space wrap size={[4, 4]}>
                    {tags.map((tag) => (
                        <Tag key={tag} style={{ borderRadius: 4, fontSize: 11, margin: 0 }}>
                            {tag}
                        </Tag>
                    ))}
                </Space>
            ),
        },
        {
            title: 'Người sở hữu',
            dataIndex: 'owner',
            key: 'owner',
            width: 130,
            render: (owner: string) => <Text style={{ fontSize: 12 }}>{owner}</Text>,
        },
    ];

    const totalFilters = selectedDepts.length + selectedProjects.length;

    return (
        <AppLayout pageTitle="Phân loại dữ liệu">
            <PageWrapper>
                <PageTitle>
                    <ApartmentOutlined />
                    <h2>Phân loại theo Phòng ban & Dự án</h2>
                    {totalFilters > 0 && (
                        <ActiveFilterBadge count={totalFilters} title={`${totalFilters} bộ lọc đang áp dụng`} />
                    )}
                </PageTitle>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={7}>
                        <Space direction="vertical" style={{ width: '100%' }} size={16}>
                            <DepartmentTree
                                onSelect={setSelectedDepts}
                                selectedKeys={selectedDepts}
                            />
                            <ProjectFilter
                                selectedDepartmentIds={selectedDepts}
                                selectedProjectIds={selectedProjects}
                                onProjectSelect={setSelectedProjects}
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
                                    <Tag color="red">{filteredEntities.length} đối tượng</Tag>
                                </Space>

                                {totalFilters > 0 && (
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setSelectedDepts([]);
                                            setSelectedProjects([]);
                                        }}
                                    >
                                        Xoá bộ lọc
                                    </Button>
                                )}
                            </ResultsHeader>

                            <Table
                                columns={columns}
                                dataSource={filteredEntities}
                                rowKey="urn"
                                size="middle"
                                pagination={{
                                    pageSize: 10,
                                    showTotal: (total) => `Tổng ${total} kết quả`,
                                }}
                                locale={{
                                    emptyText: (
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description={
                                                totalFilters > 0
                                                    ? 'Không có dữ liệu phù hợp với bộ lọc hiện tại'
                                                    : 'Chọn phòng ban hoặc dự án để lọc dữ liệu'
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
