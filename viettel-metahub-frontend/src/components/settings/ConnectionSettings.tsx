import React, { useState, useEffect } from 'react';
import {
    Table, Tag, Button, Space, Modal, Form, Input, Select, Switch,
    InputNumber, Badge, Tooltip, Typography, Divider, message,
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined,
    CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
    ApiOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { ColumnsType } from 'antd/es/table';
import type { ConnectionConfig, ConnectionType } from '../../types';
import {
    listIngestionSources,
    createIngestionSource,
    updateIngestionSourceDetails,
    deleteIngestionSource,
    runIngestionSource,
} from '../../api/datahubApi';

const { Option } = Select;
const { Text } = Typography;
const { Password } = Input;

const PageHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    h2 {
        font-size: 16px;
        font-weight: 600;
        color: #212121;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;

        .anticon {
            color: #ee0033;
        }
    }
`;

const ConnectionCard = styled.div`
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
    overflow: hidden;
`;

const AddBtn = styled(Button)`
    background: #ee0033 !important;
    border-color: #ee0033 !important;
    color: white !important;
    border-radius: 6px;

    &:hover {
        background: #cc0029 !important;
        border-color: #cc0029 !important;
    }
`;

const StatusMap: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    CONNECTED: { color: 'success', label: 'Đã kết nối', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
    DISCONNECTED: { color: 'default', label: 'Chưa kết nối', icon: <CloseCircleOutlined style={{ color: '#9e9e9e' }} /> },
    ERROR: { color: 'error', label: 'Lỗi', icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> },
    TESTING: { color: 'processing', label: 'Đang kiểm tra', icon: <LoadingOutlined style={{ color: '#1677ff' }} /> },
};

const CONNECTION_TYPES: ConnectionType[] = [
    'MYSQL', 'POSTGRESQL', 'ORACLE', 'MSSQL', 'MONGODB', 'KAFKA', 'HIVE', 'SPARK', 'REST_API', 'JDBC',
];

const DEFAULT_PORTS: Record<ConnectionType, number> = {
    MYSQL: 3306, POSTGRESQL: 5432, ORACLE: 1521, MSSQL: 1433,
    MONGODB: 27017, KAFKA: 9092, HIVE: 10000, SPARK: 7077,
    REST_API: 443, JDBC: 5432,
};

type FormValues = Omit<ConnectionConfig, 'id' | 'status' | 'lastTestedAt'>;

export default function ConnectionSettings() {
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [loadingInit, setLoadingInit] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingConn, setEditingConn] = useState<ConnectionConfig | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm<FormValues>();

    const reload = () => {
        setLoadingInit(true);
        listIngestionSources()
            .then(setConnections)
            .catch(() => setConnections([]))
            .finally(() => setLoadingInit(false));
    };

    useEffect(() => { reload(); }, []);

    const openAdd = () => {
        setEditingConn(null);
        form.resetFields();
        form.setFieldsValue({ ssl: false, port: 3306, type: 'MYSQL' });
        setModalOpen(true);
    };

    const openEdit = (conn: ConnectionConfig) => {
        setEditingConn(conn);
        form.setFieldsValue(conn);
        setModalOpen(true);
    };

    const handleSave = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            if (editingConn) {
                await updateIngestionSourceDetails(editingConn.id, values);
                message.success('Đã cập nhật kết nối');
            } else {
                await createIngestionSource(values);
                message.success('Đã thêm kết nối mới');
            }
            setModalOpen(false);
            reload();
        } catch (err: unknown) {
            message.error(`Lỗi: ${err instanceof Error ? err.message : 'Không xác định'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: 'Xác nhận xoá',
            content: 'Xoá ingestion source này khỏi DataHub. Thao tác không thể hoàn tác.',
            okText: 'Xoá',
            okButtonProps: { danger: true },
            cancelText: 'Huỷ',
            onOk: async () => {
                try {
                    await deleteIngestionSource(id);
                    message.success('Đã xoá kết nối');
                    reload();
                } catch (err: unknown) {
                    message.error(`Lỗi khi xoá: ${err instanceof Error ? err.message : 'Không xác định'}`);
                }
            },
        });
    };

    const handleTest = async (id: string) => {
        setTesting(id);
        setConnections((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: 'TESTING' } : c)),
        );
        try {
            await runIngestionSource(id);
            message.info('Đã kích hoạt chạy thử — kết quả sẽ cập nhật sau vài giây');
            setTimeout(() => {
                reload();
                setTesting(null);
            }, 5000);
        } catch (err: unknown) {
            message.error(`Không thể kiểm tra: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
            setConnections((prev) =>
                prev.map((c) => (c.id === id ? { ...c, status: 'ERROR' } : c)),
            );
            setTesting(null);
        }
    };

    const columns: ColumnsType<ConnectionConfig> = [
        {
            title: 'Tên kết nối',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record) => (
                <Space>
                    {StatusMap[record.status].icon}
                    <div>
                        <Text strong style={{ fontSize: 13 }}>
                            {name}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.host ? `${record.host}:${record.port}` : 'DataHub ingestion source'}
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
            render: (type: string) => <Tag color="blue">{type}</Tag>,
        },
        {
            title: 'Database',
            dataIndex: 'database',
            key: 'database',
            width: 140,
            render: (db?: string) => <Text style={{ fontSize: 12 }}>{db || '—'}</Text>,
        },
        {
            title: 'SSL',
            dataIndex: 'ssl',
            key: 'ssl',
            width: 70,
            render: (ssl: boolean) => <Tag color={ssl ? 'green' : 'default'}>{ssl ? 'Bật' : 'Tắt'}</Tag>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (status: string) => {
                const s = StatusMap[status];
                return <Badge status={s.color as any} text={s.label} />;
            },
        },
        {
            title: 'Kiểm tra lần cuối',
            dataIndex: 'lastTestedAt',
            key: 'lastTestedAt',
            width: 140,
            render: (date?: string) =>
                date ? (
                    <Text style={{ fontSize: 12, color: '#9e9e9e' }}>
                        {new Date(date).toLocaleString('vi-VN')}
                    </Text>
                ) : (
                    '—'
                ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 180,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Kiểm tra kết nối">
                        <Button
                            size="small"
                            icon={<LinkOutlined />}
                            onClick={() => handleTest(record.id)}
                            loading={testing === record.id}
                        >
                            Kiểm tra
                        </Button>
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Xoá">
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(record.id)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <>
            <PageHeader>
                <h2>
                    <ApiOutlined />
                    Quản lý kết nối
                </h2>
                <AddBtn icon={<PlusOutlined />} onClick={openAdd}>
                    Thêm kết nối
                </AddBtn>
            </PageHeader>

            <ConnectionCard>
                <Table
                        columns={columns}
                        dataSource={connections}
                        rowKey="id"
                        size="middle"
                        pagination={false}
                        loading={loadingInit}
                    />
            </ConnectionCard>

            <Modal
                title={editingConn ? 'Chỉnh sửa kết nối' : 'Thêm kết nối mới'}
                open={modalOpen}
                onOk={handleSave}
                onCancel={() => setModalOpen(false)}
                okText="Lưu"
                cancelText="Huỷ"
                okButtonProps={{ style: { background: '#ee0033', borderColor: '#ee0033' }, loading: saving }}
                width={600}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item
                        name="name"
                        label="Tên kết nối"
                        rules={[{ required: true, message: 'Vui lòng nhập tên kết nối' }]}
                    >
                        <Input placeholder="VD: MySQL Production DWH" />
                    </Form.Item>

                    <Form.Item
                        name="type"
                        label="Loại kết nối"
                        rules={[{ required: true }]}
                    >
                        <Select
                            onChange={(type: ConnectionType) => {
                                form.setFieldValue('port', DEFAULT_PORTS[type]);
                            }}
                        >
                            {CONNECTION_TYPES.map((t) => (
                                <Option key={t} value={t}>
                                    {t}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={16}>
                        <Form.Item
                            name="host"
                            label="Host"
                            rules={[{ required: true, message: 'Vui lòng nhập host' }]}
                            style={{ flex: 2 }}
                        >
                            <Input placeholder="VD: mysql.viettel.internal" />
                        </Form.Item>
                        <Form.Item
                            name="port"
                            label="Port"
                            rules={[{ required: true }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={1} max={65535} />
                        </Form.Item>
                    </Space>

                    <Form.Item name="database" label="Tên database">
                        <Input placeholder="VD: viettel_dwh" />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={16}>
                        <Form.Item
                            name="username"
                            label="Tên đăng nhập"
                            rules={[{ required: true, message: 'Vui lòng nhập username' }]}
                            style={{ flex: 1 }}
                        >
                            <Input placeholder="username" />
                        </Form.Item>
                        <Form.Item name="password" label="Mật khẩu" style={{ flex: 1 }}>
                            <Password placeholder="password" />
                        </Form.Item>
                    </Space>

                    <Form.Item name="ssl" label="Bật SSL" valuePropName="checked">
                        <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
