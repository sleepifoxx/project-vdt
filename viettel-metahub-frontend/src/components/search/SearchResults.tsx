import React from 'react';
import { Table, Tag, Badge, Typography, Space, Button, Tooltip, Empty } from 'antd';
import {
    DatabaseOutlined,
    DashboardOutlined,
    BarChartOutlined,
    NodeIndexOutlined,
    EyeOutlined,
    EditOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { ColumnsType } from 'antd/es/table';
import type { MetadataEntity, EntityType } from '../../types';

const { Text, Link } = Typography;

const ResultsWrapper = styled.div`
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

const ResultCount = styled(Text)`
    font-size: 14px;
    color: #616161;
`;

const PlatformBadge = styled.span`
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    font-size: 11px;
    font-weight: 600;
    color: #424242;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const EntityIcon: Record<EntityType, React.ReactNode> = {
    DATASET: <DatabaseOutlined style={{ color: '#1677ff' }} />,
    DASHBOARD: <DashboardOutlined style={{ color: '#722ed1' }} />,
    CHART: <BarChartOutlined style={{ color: '#13c2c2' }} />,
    DATA_FLOW: <NodeIndexOutlined style={{ color: '#fa8c16' }} />,
    DATA_JOB: <NodeIndexOutlined style={{ color: '#52c41a' }} />,
    CORP_USER: <DatabaseOutlined style={{ color: '#eb2f96' }} />,
    CORP_GROUP: <DatabaseOutlined style={{ color: '#faad14' }} />,
};

const EntityTypeLabel: Record<EntityType, string> = {
    DATASET: 'Bộ dữ liệu',
    DASHBOARD: 'Dashboard',
    CHART: 'Biểu đồ',
    DATA_FLOW: 'Luồng dữ liệu',
    DATA_JOB: 'Công việc',
    CORP_USER: 'Người dùng',
    CORP_GROUP: 'Nhóm',
};

const StatusBadge: Record<string, 'success' | 'warning' | 'error'> = {
    ACTIVE: 'success',
    DEPRECATED: 'warning',
    REMOVED: 'error',
};

const StatusLabel: Record<string, string> = {
    ACTIVE: 'Hoạt động',
    DEPRECATED: 'Lỗi thời',
    REMOVED: 'Đã xoá',
};

type Props = {
    entities: MetadataEntity[];
    total: number;
    loading?: boolean;
    page: number;
    pageSize: number;
    onPageChange: (page: number, pageSize: number) => void;
    onEdit?: (entity: MetadataEntity) => void;
};

export default function SearchResults({ entities, total, loading, page, pageSize, onPageChange, onEdit }: Props) {
    const columns: ColumnsType<MetadataEntity> = [
        {
            title: 'Tên đối tượng',
            dataIndex: 'name',
            key: 'name',
            width: 240,
            render: (name: string, record) => (
                <Space>
                    {EntityIcon[record.type]}
                    <div>
                        <Link style={{ color: '#EE0033', fontWeight: 600, fontSize: 13 }}>{name}</Link>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.urn}
                        </Text>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (type: EntityType) => (
                <Tag color="blue" style={{ borderRadius: 4 }}>
                    {EntityTypeLabel[type]}
                </Tag>
            ),
        },
        {
            title: 'Nền tảng',
            dataIndex: 'platform',
            key: 'platform',
            width: 100,
            render: (platform: string) => <PlatformBadge>{platform}</PlatformBadge>,
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (desc: string) => (
                <Tooltip title={desc}>
                    <Text style={{ fontSize: 13, color: '#616161' }}>{desc || '—'}</Text>
                </Tooltip>
            ),
        },
        {
            title: 'Phòng ban / Dự án',
            key: 'department',
            width: 180,
            render: (_, record) => (
                <div>
                    {record.department && (
                        <Text style={{ fontSize: 12, display: 'block' }}>{record.department.name}</Text>
                    )}
                    {record.project && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.project.name}
                        </Text>
                    )}
                </div>
            ),
        },
        {
            title: 'Tags',
            dataIndex: 'tags',
            key: 'tags',
            width: 160,
            render: (tags: string[]) => (
                <Space wrap size={[4, 4]}>
                    {tags.slice(0, 3).map((tag) => (
                        <Tag key={tag} style={{ borderRadius: 4, fontSize: 11, margin: 0 }}>
                            {tag}
                        </Tag>
                    ))}
                    {tags.length > 3 && (
                        <Tag style={{ borderRadius: 4, fontSize: 11, margin: 0 }}>+{tags.length - 3}</Tag>
                    )}
                </Space>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (status: string) => (
                <Badge status={StatusBadge[status]} text={StatusLabel[status]} />
            ),
        },
        {
            title: 'Cập nhật',
            dataIndex: 'lastUpdated',
            key: 'lastUpdated',
            width: 110,
            render: (date: string) => (
                <Text style={{ fontSize: 12, color: '#9e9e9e' }}>
                    {new Date(date).toLocaleDateString('vi-VN')}
                </Text>
            ),
        },
        {
            title: '',
            key: 'actions',
            width: 80,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Xem chi tiết">
                        <Button type="text" icon={<EyeOutlined />} size="small" />
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button
                            type="text"
                            icon={<EditOutlined style={{ color: '#ee0033' }} />}
                            size="small"
                            onClick={() => onEdit?.(record)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <ResultsWrapper>
            <ResultsHeader>
                <ResultCount>
                    Tìm thấy <strong>{total}</strong> kết quả
                </ResultCount>
            </ResultsHeader>

            <Table
                columns={columns}
                dataSource={entities}
                rowKey="urn"
                loading={loading}
                size="middle"
                locale={{
                    emptyText: (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Không tìm thấy kết quả phù hợp"
                        />
                    ),
                }}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: onPageChange,
                    showSizeChanger: true,
                    showTotal: (tot) => `Tổng ${tot} kết quả`,
                    pageSizeOptions: ['10', '20', '50'],
                }}
                scroll={{ x: 1000 }}
            />
        </ResultsWrapper>
    );
}
